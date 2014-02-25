'use strict';

var PouchUtils = require('./utils');
var Pouch = require('./index');

// We create a basic promise so the caller can cancel the replication possibly
// before we have actually started listening to changes etc
function Promise() {
  var that = this;
  this.cancelled = false;
  this.cancel = function () {
    that.cancelled = true;
  };
}


// A batch of changes to be processed as a unit
function Batch() {
  this.seq = 0;
  this.state = 'start';
  this.changes = [];
  this.docs = [];
}


// TODO: check CouchDB's replication id generation
// Generate a unique id particular to this replication
function genReplicationId(src, target, opts, callback) {
  var filterFun = opts.filter ? opts.filter.toString() : '';
  src.id(function (err, src_id) {
    target.id(function (err, target_id) {
      var queryData = src_id + target_id + filterFun +
        JSON.stringify(opts.query_params);
      callback('_local/' + PouchUtils.Crypto.MD5(queryData));
    });
  });
}


// A checkpoint lets us restart replications from when they were last cancelled
function fetchCheckpoint(src, target, id, callback) {
  target.get(id, function (err, targetDoc) {
    if (err && err.status === 404) {
      callback(null, 0);
    } else if (err) {
      callback(err);
    } else {
      src.get(id, function (err, sourceDoc) {
        if (err && err.status === 404 ||
            (!err && (targetDoc.last_seq !== sourceDoc.last_seq))) {
          callback(null, 0);
        } else if (err) {
          callback(err);
        } else {
          callback(null, sourceDoc.last_seq);
        }
      });
    }
  });
}


function writeCheckpoint(src, target, id, checkpoint, callback) {
  function updateCheckpoint(db, callback) {
    db.get(id, function (err, doc) {
      if (err && err.status === 404) {
        doc = {_id: id};
      } else if (err) {
        return callback(err);
      }
      doc.last_seq = checkpoint;
      db.put(doc, callback);
    });
  }
  updateCheckpoint(target, function (err, doc) {
    updateCheckpoint(src, function (err, doc) {
      callback();
    });
  });
}


function replicate(repId, src, target, opts, promise) {
  var batches = [];     // queue of batches of changes to be processed
  var pendingBatch = new Batch();
  var changesCompleted = false;
  var completeCalled = false;
  var last_seq = 0;
  var continuous = opts.continuous || false;
  var batch_size = opts.batch_size || 1;
  var doc_ids = opts.doc_ids;
  var result = {
    ok: true,
    start_time: new Date(),
    docs_read: 0,
    docs_written: 0,
    errors: []
  };


  function writeDocs() {
    if (batches[0].docs.length === 0) {
      // This should never happen:
      // batch processing continues past onRevsDiff only if there are diffs
      // and replication is aborted if a get fails.
      // TODO: throw or log the error
      return finishBatch();
    }

    var docs = batches[0].docs;
    target.bulkDocs({docs: docs}, {new_edits: false}, function (err, res) {
      if (err) {
        return abortReplication('target.bulkDocs completed with error', err);
      }

      result.docs_written += docs.length;
      finishBatch();
    });
  }


  function onGet(err, docs) {
    if (promise.cancelled) {
      return replicationCancelled();
    }

    if (err) {
      return abortReplication('src.get completed with error', err);
    }

    Object.keys(docs).forEach(function (revpos) {
      var doc = docs[revpos].ok;

      if (doc) {
        result.docs_read++;
        batches[0].pendingRevs++;
        batches[0].docs.push(doc);
      }
    });

    fetchRev();
  }


  function fetchRev() {
    var diffs = batches[0].diffs;

    if (Object.keys(diffs).length === 0) {
      writeDocs();
      return;
    }

    var id = Object.keys(diffs)[0];
    var revs = diffs[id].missing;
    delete diffs[id];

    src.get(id, {revs: true, open_revs: revs, attachments: true}, onGet);
  }


  function abortReplication(reason, err) {
    if (completeCalled) {
      return;
    }
    result.ok = false;
    result.status = 'aborted';
    result.errors.push(err);
    result.end_time = new Date();
    result.last_seq = last_seq;
    promise.cancel();
    batches = [];
    pendingBatch = new Batch();
    var error = {
      status: 500,
      error: 'Replication aborted',
      reason: reason,
      details: err
    };
    completeCalled = true;
    PouchUtils.call(opts.complete, error, result);
  }


  function finishBatch() {
    writeCheckpoint(src, target, repId, batches[0].seq, function (err, res) {
      if (err) {
        return abortReplication('writeCheckpoint completed with error', err);
      }
      last_seq = batches[0].seq;
      result.last_seq = last_seq;
      PouchUtils.call(opts.onChange, null, result);
      batches.shift();
      startNextBatch();
    });
  }

  function onRevsDiff(err, diffs) {
    if (promise.cancelled) {
      return replicationCancelled();
    }

    if (err) {
      return abortReplication('target.revsDiff completed with error', err);
    }

    if (Object.keys(diffs).length === 0) {
      finishBatch();
      return;
    }

    batches[0].diffs = diffs;
    batches[0].pendingRevs = 0;
    fetchRev();
  }


  function fetchRevsDiff() {
    var diff = {};
    batches[0].changes.forEach(function (change) {
      diff[change.id] = change.changes.map(function (x) { return x.rev; });
    });

    target.revsDiff(diff, onRevsDiff);
  }


  function startNextBatch() {
    if (promise.cancelled) {
      return replicationCancelled();
    }

    if (batches.length === 0) {
      processPendingBatch();
      return;
    }

    if (batches[0].state === 'start') {
      batches[0].state = 'processing';
      fetchRevsDiff();
    }
  }


  function processPendingBatch() {
    if (pendingBatch.changes.length === 0) {
      if (changesCompleted && batches.length === 0) {
        replicationComplete();
      }
      return;
    }

    if (changesCompleted || pendingBatch.changes.length >= batch_size) {
      batches.push(pendingBatch);
      pendingBatch = new Batch();
      startNextBatch();
    }
  }


  function replicationCancelled() {
    result.status = 'cancelled';
    replicationComplete();
  }

  
  function replicationComplete() {
    if (completeCalled) {
      return;
    }
    result.status = result.status || 'complete';
    result.end_time = new Date();
    result.last_seq = last_seq;
    completeCalled = true;
    return PouchUtils.call(opts.complete, null, result);
  }


  function onChange(change) {
    if (promise.cancelled) {
      return replicationCancelled();
    }

    if (completeCalled) {
      // This should never happen
      // The complete callback has already been called
      // How to raise an exception in PouchDB?
      return;
    }

    pendingBatch.seq = change.seq;
    pendingBatch.changes.push(change);

    processPendingBatch();
  }


  function complete(err, result) {
    changesCompleted = true;
    if (promise.cancelled) {
      return replicationCancelled();
    }

    if (err) {
      return abortReplication('src.changes completed with error', err);
    }

    processPendingBatch();
  }


  function getChanges() {
    fetchCheckpoint(src, target, repId, function (err, checkpoint) {
      if (err) {
        return abortReplication('fetchCheckpoint completed with error', err);
      }

      last_seq = checkpoint;

      // Was the replication cancelled by the caller before it had a chance
      // to start. Shouldnt we be calling complete?
      if (promise.cancelled) {
        return replicationCancelled();
      }

      // Call changes on the source database, with callbacks to onChange for
      // each change and complete when done.
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
        promise.cancel = function () {
          cancel();
          changes.cancel();
        };
      }
    });
  }

  // If opts.since is given, set the checkpoint to opts.since
  if (typeof opts.since === 'undefined') {
    getChanges();
  } else {
    writeCheckpoint(src, target, repId, opts.since, function (err, res) {
      if (err) {
        return abortReplication('writeCheckpoint completed with error', err);
      }
      last_seq = opts.since;
      getChanges();
    });
  }
}

function toPouch(db, callback) {
  if (typeof db === 'string') {
    return new Pouch(db, callback);
  }
  callback(null, db);
}

function replicateWrapper(src, target, opts, callback) {
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
  toPouch(src, function (err, src) {
    if (err) {
      return callback(err);
    }
    toPouch(target, function (err, target) {
      if (err) {
        return callback(err);
      }
      if (opts.server) {
        if (typeof src.replicateOnServer !== 'function') {
          return callback({
            error: 'Server replication not supported for ' + src.type() +
              'adapter'
          });
        }
        if (src.type() !== target.type()) {
          return callback({
            error: 'Server replication for different adapter types (' +
              src.type() + ' and ' + target.type() + ') is not supported'
          });
        }
        src.replicateOnServer(target, opts, replicateRet);
      } else {
        genReplicationId(src, target, opts, function (repId) {
          replicate(repId, src, target, opts, replicateRet);
        });
      }
    });
  });
  return replicateRet;
}

function sync(db1, db2, opts, callback) {
  var push_promise;
  var pull_promise;

  function complete(callback) {
    return function (err, res) {
      if (err) {
        // cancel both replications if either experiences problems
        cancel();
      }
      callback(err, res);
    };
  }

  function onChange(src, callback) {
    callback = callback || function () {};
    return function (change) {
      return {
        source: src,
        change: callback(change)
      };
    };
  }

  function makeOpts(src, opts) {
    opts = PouchUtils.extend(true, {}, opts);
    opts.complete = complete(opts.complete);
    opts.onChange = onChange(src, opts.onChange);
    return opts;
  }

  function push() {
    push_promise = replicateWrapper(db1, db2, makeOpts(db1, opts), callback);
    return push_promise;
  }

  function pull() {
    pull_promise = replicateWrapper(db2, db1, makeOpts(db2, opts), callback);
    return pull_promise;
  }

  function cancel() {
    if (push_promise) {
      push_promise.cancel();
    }
    if (pull_promise) {
      pull_promise.cancel();
    }
  }

  return {
    push: push(),
    pull: pull(),
    cancel: cancel
  };
}

exports.replicate = replicateWrapper;
exports.sync = sync;
