/*globals call: false */

'use strict';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Pouch;
}

// We create a basic promise so the caller can cancel the replication possibly
// before we have actually started listening to changes etc
var Promise = function() {
  this.cancelled = false;
  this.cancel = function() {
    this.cancelled = true;
  };
};

// The RequestManager ensures that only one database request is active at
// at time, it ensures we dont max out simultaneous HTTP requests and makes
// the replication process easier to reason about
var RequestManager = function() {

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
    if (processing || !queue.length) {
      return;
    }
    processing = true;
    var task = queue.shift();
    task.fun.apply(null, task.args);
  }

  // We need to be notified whenever a request is complete to process
  // the next request
  api.notifyRequestComplete = function() {
    processing = false;
    api.process();
  }

  return api;
};

// TODO: check CouchDB's replication id generation, generate a unique id particular
// to this replication
var genReplicationId = function(src, target, opts) {
  var filterFun = opts.filter ? opts.filter.toString() : '';
  return '_local/' + Crypto.MD5(src.id() + target.id() + filterFun);
}

// A checkpoint lets us restart replications from when they were last cancelled
var fetchCheckpoint = function(src, id, callback) {
  src.get(id, function(err, doc) {
    if (err && err.status === 404) {
      callback(null, 0);
    } else {
      callback(null, doc.last_seq);
    }
  });
};

var writeCheckpoint = function(src, id, checkpoint, callback) {
  var check = {
    _id: id,
    last_seq: checkpoint
  };
  src.get(check._id, function(err, doc) {
    if (doc && doc._rev) {
      check._rev = doc._rev;
    }
    src.put(check, function(err, doc) {
      callback();
    });
  });
};

function replicate(src, target, opts, promise) {

  var requests = new RequestManager();
  var writeQueue = [];
  var repId = genReplicationId(src, target, opts);
  var results = [];
  var completed = false;
  var pending = 0;
  var last_seq = 0;
  var continuous = opts.continuous || false;
  var result = {
    ok: true,
    start_time: new Date(),
    docs_read: 0,
    docs_written: 0
  };

  function docsWritten(err, res, len) {
    requests.notifyRequestComplete();
    if (opts.onChange) {
      for (var i = 0; i < len; i++) {
        opts.onChange.apply(this, [result]);
      }
    }
    pending -= len;
    result.docs_written += len;
    isCompleted();
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
      requests.notifyRequestComplete();
      writeQueue.push(doc);
      requests.enqueue(writeDocs);
    });
  }

  function onRevsDiff(err, diffs) {
    requests.notifyRequestComplete();
    if (err) {
      if (continuous) {
        promise.cancel();
      }
      call(opts.complete, err, null);
      return;
    }

    // We already have the full document stored
    if (Object.keys(diffs).length === 0) {
      pending--;
      isCompleted();
      return;
    }

    for (var id in diffs) {
      diffs[id].missing.forEach(function(rev) {
        requests.enqueue(eachRev, [id, rev]);
      });
    }
  }

  function fetchRevsDiff(diff) {
    target.revsDiff(diff, onRevsDiff);
  }

  function onChange(change) {
    last_seq = change.seq;
    results.push(change);
    result.docs_read++;
    pending++;
    var diff = {};
    diff[change.id] = change.changes.map(function(x) { return x.rev; });
    requests.enqueue(fetchRevsDiff, [diff]);
  }

  function complete() {
    completed = true;
    isCompleted();
  }

  function isCompleted() {
    if (completed && pending === 0) {
      result.end_time = Date.now();
      writeCheckpoint(src, repId, last_seq, function(err, res) {
        call(opts.complete, err, result);
      });
    }
  }

  fetchCheckpoint(src, repId, function(err, checkpoint) {

    if (err) {
      return call(opts.complete, err);
    }

    last_seq = checkpoint;

    // Was the replication cancelled by the caller before it had a chance
    // to start. Shouldnt we be calling complete?
    if (promise.cancelled) {
      return;
    }

    var repOpts = {
      limit: 25,
      continuous: continuous,
      since: last_seq,
      style: 'all_docs',
      onChange: onChange,
      complete: complete
    };

    if (opts.filter) {
      repOpts.filter = opts.filter;
    }

    if (opts.query_params) {
      repOpts.query_params = opts.query_params;
    }

    var changes = src.changes(repOpts);

    if (opts.continuous) {
      promise.cancel = changes.cancel;
    }
  });

};

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
  opts.complete = callback;
  var replicateRet = new Promise();
  toPouch(src, function(err, src) {
    if (err) {
      return call(callback, err);
    }
    toPouch(target, function(err, target) {
      if (err) {
        return call(callback, err);
      }
      replicate(src, target, opts, replicateRet);
    });
  });
  return replicateRet;
};