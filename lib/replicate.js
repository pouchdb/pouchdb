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
        JSON.stringify(opts.query_params) + opts.doc_ids;
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
    if (err) { return callback(err); }
    updateCheckpoint(src, function (err, doc) {
      if (err) { return callback(err); }
      callback();
    });
  });
}


function replicate(repId, src, target, opts, promise) {
  var batches = [];               // list of batches to be processed
  var currentBatch;               // the batch currently being processed
  var pendingBatch = new Batch(); // next batch, not yet ready to be processed
  var fetchAgain = [];  // queue of documents to be fetched again with api.get
  var writingCheckpoint = false;
  var changesCompleted = false;
  var completeCalled = false;
  var last_seq = 0;
  var continuous = opts.continuous || opts.live || false;
  var batch_size = opts.batch_size || 1;
  var doc_ids = opts.doc_ids;
  var result = {
    ok: true,
    start_time: new Date(),
    docs_read: 0,
    docs_written: 0,
    doc_write_failures: 0,
    errors: []
  };


  function writeDocs() {
    if (currentBatch.docs.length === 0) {
      // This should never happen:
      // batch processing continues past onRevsDiff only if there are diffs
      // and replication is aborted if a get fails.
      // TODO: throw or log the error
      return finishBatch();
    }

    var docs = currentBatch.docs;
    target.bulkDocs({docs: docs}, {new_edits: false}, function (err, res) {
      if (err) {
        result.doc_write_failures += docs.length;
        return abortReplication('target.bulkDocs completed with error', err);
      }

      var errors = [];
      res.forEach(function (res) {
        if (!res.ok) {
          result.doc_write_failures++;
          errors.push({
            status: 500,
            error: res.error || 'Unknown document write error',
            reason: res.reason || 'Unknown reason',
          });
        }
      });

      if (errors.length > 0) {
        return abortReplication('target.bulkDocs failed to write docs', errors);
      }

      result.docs_written += docs.length;
      finishBatch();
    });
  }


  function onGet(err, docs) {
    if (promise.cancelled) {
      return replicationComplete();
    }

    if (err) {
      return abortReplication('src.get completed with error', err);
    }

    Object.keys(docs).forEach(function (revpos) {
      var doc = docs[revpos].ok;

      if (doc) {
        result.docs_read++;
        currentBatch.pendingRevs++;
        currentBatch.docs.push(doc);
      }
    });

    fetchRev();
  }

  function fetchGenerationOneRevs(ids, revs) {
    src.allDocs({keys: ids, include_docs: true}, function (err, res) {
      if (promise.cancelled) {
        return replicationComplete();
      }
      if (err) {
        return abortReplication('src.get completed with error', err);
      }
      
      res.rows.forEach(function (row, i) {
        // fetch document again via api.get when doc
        // * is deleted document (could have data)
        // * is no longer generation 1
        // * has attachments
        var needsSingleFetch = !row.doc ||
          row.value.rev.slice(0, 2) !== '1-' ||
          row.doc._attachments && Object.keys(row.doc._attachments).length;

        if (needsSingleFetch) {
          return fetchAgain.push({
            id: row.error === 'not_found' ? row.key : row.id,
            rev: revs[i]
          });
        }

        result.docs_read++;
        currentBatch.pendingRevs++;
        currentBatch.docs.push(row.doc);
      });

      fetchRev();
    });
  }

  function fetchRev() {
    if (fetchAgain.length) {
      var doc = fetchAgain.shift();
      return fetchSingleRev(src, onGet, doc.id, [doc.rev]);
    }

    var diffs = currentBatch.diffs;

    if (Object.keys(diffs).length === 0) {
      writeDocs();
      return;
    }

    var generationOne = Object.keys(diffs).reduce(function (memo, id) {
      if (diffs[id].missing.length === 1 && diffs[id].missing[0].slice(0, 2) === '1-') {
        memo.ids.push(id);
        memo.revs.push(diffs[id].missing[0]);
        delete diffs[id];
      }

      return memo;
    }, {
      ids: [],
      revs: []
    });

    if (generationOne.ids.length) {
      return fetchGenerationOneRevs(generationOne.ids, generationOne.revs);
    }
    
    var id = Object.keys(diffs)[0];
    var revs = diffs[id].missing;
    delete diffs[id];

    fetchSingleRev(src, onGet, id, revs);
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
    promise.cancel();
  }


  function finishBatch() {
    writingCheckpoint = true;
    writeCheckpoint(src, target, repId, currentBatch.seq, function (err, res) {
      writingCheckpoint = false;
      if (promise.cancelled) {
        return replicationComplete();
      }
      if (err) {
        return abortReplication('writeCheckpoint completed with error', err);
      }
      result.last_seq = last_seq = currentBatch.seq;
      PouchUtils.call(opts.onChange, null, result);
      currentBatch = undefined;
      startNextBatch();
    });
  }

  function onRevsDiff(err, diffs) {
    if (promise.cancelled) {
      return replicationComplete();
    }

    if (err) {
      return abortReplication('target.revsDiff completed with error', err);
    }

    if (Object.keys(diffs).length === 0) {
      finishBatch();
      return;
    }

    currentBatch.diffs = diffs;
    currentBatch.pendingRevs = 0;
    fetchRev();
  }


  function fetchRevsDiff() {
    var diff = {};
    currentBatch.changes.forEach(function (change) {
      diff[change.id] = change.changes.map(function (x) { return x.rev; });
    });

    target.revsDiff(diff, onRevsDiff);
  }


  function startNextBatch() {
    if (promise.cancelled) {
      return replicationComplete();
    }

    if (currentBatch) {
      return;
    }

    if (batches.length === 0) {
      processPendingBatch();
      return;
    }

    currentBatch = batches.shift();
    fetchRevsDiff();
  }


  function processPendingBatch() {
    if (pendingBatch.changes.length === 0) {
      if (changesCompleted && batches.length === 0 && !currentBatch) {
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


  function replicationComplete() {
    if (completeCalled) {
      return;
    }
    if (promise.cancelled) {
      result.status = 'cancelled';
      if (writingCheckpoint) {
        return;
      }
    }
    result.status = result.status || 'complete';
    result.end_time = new Date();
    result.last_seq = last_seq;
    completeCalled = true;
    if (result.errors.length > 0) {
      return PouchUtils.call(opts.complete, result.errors[0], result);
    } else {
      return PouchUtils.call(opts.complete, null, result);
    }
  }


  function onChange(change) {
    if (promise.cancelled) {
      return replicationComplete();
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


  function complete(err, changes) {
    changesCompleted = true;
    if (promise.cancelled) {
      return replicationComplete();
    }

    if (err) {
      result.status = 'src.changes completed with error';
      result.errors.push(err);
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
        return replicationComplete();
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

      var cancelPromise = promise.cancel;
      promise.cancel = function () {
        cancelPromise();
        replicationComplete();
        if (changes && changes.cancel instanceof Function) {
          changes.cancel();
        }
      };

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

function fetchSingleRev(src, callback, id, revs) {
  src.get(id, {revs: true, open_revs: revs, attachments: true}, callback);
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
  opts = PouchUtils.extend(true, {}, opts);
  opts.continuous = opts.continuous || opts.live;
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

  if (opts instanceof Function) {
    callback = opts;
    opts = {};
  }
  if (opts === undefined) {
    opts = {};
  }
  if (callback instanceof Function && !opts.complete) {
    opts.complete = callback;
  }

  function complete(callback, direction) {
    return function (err, res) {
      if (err) {
        // cancel both replications if either experiences problems
        cancel();
      }
      res.direction = direction;
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

  function makeOpts(src, opts, direction) {
    opts = PouchUtils.extend(true, {}, opts);
    opts.complete = complete(opts.complete, direction);
    opts.onChange = onChange(src, opts.onChange);
    opts.continuous = opts.continuous || opts.live;
    return opts;
  }

  function push() {
    push_promise =
      replicateWrapper(db1, db2, makeOpts(db1, opts, 'push'), callback);
    return push_promise;
  }

  function pull() {
    pull_promise =
      replicateWrapper(db2, db1, makeOpts(db2, opts, 'pull'), callback);
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
