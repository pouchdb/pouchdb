/*globals PouchUtils: true */

'use strict';

var PouchUtils;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Pouch;
  PouchUtils = require('./pouch.utils.js');
}

// We create a basic promise so the caller can cancel the replication possibly
// before we have actually started listening to changes etc
var Promise = function() {
  var that = this;
  this.cancelled = false;
  this.cancel = function() {
    that.cancelled = true;
  };
};

// The RequestManager ensures that only one database request is active at
// at time, it ensures we dont max out simultaneous HTTP requests and makes
// the replication process easier to reason about
var RequestManager = function(promise) {

  var queue = [];
  var api = {};
  var processing = false;

  // Add a new request to the queue, if we arent currently processing anything
  // then process it immediately
  api.enqueue = function(fun, args) {
    queue.push({fun: fun, args: args});
    if (!processing) {
      api.process();
    }
  };

  // Process the next request
  api.process = function() {
    if (processing || !queue.length || promise.cancelled) {
      return;
    }
    processing = true;
    var task = queue.shift();
    task.fun.apply(null, task.args);
  };

  // We need to be notified whenever a request is complete to process
  // the next request
  api.notifyRequestComplete = function() {
    processing = false;
    api.process();
  };

  return api;
};

// TODO: check CouchDB's replication id generation, generate a unique id particular
// to this replication
var genReplicationId = function(src, target, opts) {
  var filterFun = opts.filter ? opts.filter.toString() : '';
  return '_local/' + PouchUtils.Crypto.MD5(src.id() + target.id() + filterFun);
};

// A checkpoint lets us restart replications from when they were last cancelled
var fetchCheckpoint = function(src, target, id, callback) {
  target.get(id, function(err, targetDoc) {
    if (err && err.status === 404) {
      callback(null, 0);
    } else {
      src.get(id, function(err, sourceDoc) {
        if (err && err.status === 404 || targetDoc.last_seq !== sourceDoc.last_seq) {
          callback(null, 0);
        } else {
          callback(null, sourceDoc.last_seq);
        }
      });
    }
  });
};

var writeCheckpoint = function(src, target, id, checkpoint, callback) {
  var updateCheckpoint = function (db, callback) {
    db.get(id, function(err, doc) {
      if (err && err.status === 404) {
          doc = {_id: id};
      }
      doc.last_seq = checkpoint;
      db.put(doc, callback);
    });
  };
  updateCheckpoint(target, function(err, doc) {
    updateCheckpoint(src, function(err, doc) {
      callback();
    });
  });
};

function replicate(src, target, opts, promise) {

  var requests = new RequestManager(promise);
  var writeQueue = [];
  var repId = genReplicationId(src, target, opts);
  var results = [];
  var completed = false;
  var pendingRevs = 0;
  var last_seq = 0;
  var continuous = opts.continuous || false;
  var doc_ids = opts.doc_ids;
  var result = {
    ok: true,
    start_time: new Date(),
    docs_read: 0,
    docs_written: 0
  };

  function docsWritten(err, res, len) {
    if (opts.onChange) {
      for (var i = 0; i < len; i++) {
        /*jshint validthis:true */
        opts.onChange.apply(this, [result]);
      }
    }
    pendingRevs -= len;
    result.docs_written += len;

    writeCheckpoint(src, target, repId, last_seq, function(err, res) {
      requests.notifyRequestComplete();
      isCompleted();
    });
  }

  function writeDocs() {
    if (!writeQueue.length) {
      return requests.notifyRequestComplete();
    }
    var len = writeQueue.length;
    target.bulkDocs({docs: writeQueue}, {new_edits: false}, function(err, res) {
      docsWritten(err, res, len);
    });
    writeQueue = [];
  }

  function eachRev(id, rev) {
    src.get(id, {revs: true, rev: rev, attachments: true}, function(err, doc) {
      result.docs_read++;
      requests.notifyRequestComplete();
      writeQueue.push(doc);
      requests.enqueue(writeDocs);
    });
  }

  function onRevsDiff(diffCounts) {
    return function (err, diffs) {
      requests.notifyRequestComplete();
      if (err) {
        if (continuous) {
          promise.cancel();
        }
        PouchUtils.call(opts.complete, err, null);
        return;
      }

      // We already have all diffs passed in `diffCounts`
      if (Object.keys(diffs).length === 0) {
        for (var docid in diffCounts) {
          pendingRevs -= diffCounts[docid];
        }
        isCompleted();
        return;
      }

      var _enqueuer = function (rev) {
        requests.enqueue(eachRev, [id, rev]);
      };

      for (var id in diffs) {
        var diffsAlreadyHere = diffCounts[id] - diffs[id].missing.length;
        pendingRevs -= diffsAlreadyHere;
        diffs[id].missing.forEach(_enqueuer);
      }
    };
  }

  function fetchRevsDiff(diff, diffCounts) {
    target.revsDiff(diff, onRevsDiff(diffCounts));
  }

  function onChange(change) {
    last_seq = change.seq;
    results.push(change);
    var diff = {};
    diff[change.id] = change.changes.map(function(x) { return x.rev; });
    var counts = {};
    counts[change.id] = change.changes.length;
    pendingRevs += change.changes.length;
    requests.enqueue(fetchRevsDiff, [diff, counts]);
  }

  function complete() {
    completed = true;
    isCompleted();
  }

  function isCompleted() {
    if (completed && pendingRevs === 0) {
      result.end_time = new Date();
      PouchUtils.call(opts.complete, null, result);
    }
  }

  fetchCheckpoint(src, target, repId, function(err, checkpoint) {

    if (err) {
      return PouchUtils.call(opts.complete, err);
    }

    last_seq = checkpoint;

    // Was the replication cancelled by the caller before it had a chance
    // to start. Shouldnt we be calling complete?
    if (promise.cancelled) {
      return;
    }

    var repOpts = {
      continuous: continuous,
      since: last_seq,
      style: 'all_docs',
      onChange: onChange,
      complete: complete,
      doc_ids: doc_ids
    };

    if (opts.filter) {
      repOpts.filter = opts.filter;
    }

    if (opts.query_params) {
      repOpts.query_params = opts.query_params;
    }

    var changes = src.changes(repOpts);

    if (opts.continuous) {
      var cancel = promise.cancel;
      promise.cancel = function() {
        cancel();
        changes.cancel();
      };
    }
  });

}

function toPouch(db, callback) {
  if (typeof db === 'string') {
    return new Pouch(db, callback);
  }
  callback(null, db);
}

Pouch.replicate = function(src, target, opts, callback) {
  if (opts instanceof Function) {
    callback = opts;
    opts = {};
  }
  if (opts === undefined) {
    opts = {};
  }
  if (!opts.complete) {
    opts.complete = callback;
  }
  var replicateRet = new Promise();
  toPouch(src, function(err, src) {
    if (err) {
      return PouchUtils.call(callback, err);
    }
    toPouch(target, function(err, target) {
      if (err) {
        return PouchUtils.call(callback, err);
      }
      if (opts.server) {
        if (typeof src.replicateOnServer !== 'function') {
          return PouchUtils.call(callback, { error: 'Server replication not supported for ' + src.type() + ' adapter' });
        }
        if (src.type() !== target.type()) {
          return PouchUtils.call(callback, { error: 'Server replication for different adapter types (' + src.type() + ' and ' + target.type() + ') is not supported' });
        }
        src.replicateOnServer(target, opts, replicateRet);
      } else {
        replicate(src, target, opts, replicateRet);
      }
    });
  });
  return replicateRet;
};
