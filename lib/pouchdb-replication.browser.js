import { defaultBackOff, uuid } from './pouchdb-utils.browser.js';
import { c as clone } from './clone-abfcddc8.js';
import { e as events } from './__node-resolve_empty-5ffda92e.js';
import { i as immediate } from './functionName-9335a350.js';
import { createError, BAD_REQUEST } from './pouchdb-errors.browser.js';
import { f as flatten } from './flatten-994f45c6.js';
import { i as isRemote } from './isRemote-f9121da9.js';
import './spark-md5-2c57e5fc.js';
import Checkpointer from './pouchdb-checkpointer.browser.js';
import generateReplicationId from './pouchdb-generate-replication-id.browser.js';
import { f as filterChange } from './parseUri-b061a2c5.js';
import './bulkGetShim-d4877145.js';
import './toPromise-9dada06a.js';
import './guardedConsole-f54e5a40.js';
import './explainError-browser-c025e6c9.js';
import './rev-5645662a.js';
import './stringMd5-browser-5aecd2bd.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './scopeEval-ff3a416d.js';
import './upsert-331b6913.js';
import './_commonjsHelpers-24198af3.js';
import './index-3a476dad.js';
import './binaryMd5-browser-25ce905b.js';
import './pouchdb-binary-utils.browser.js';
import './base64StringToBlobOrBuffer-browser-cdc72594.js';
import './blobOrBufferToBase64-browser-bbef19a6.js';

function fileHasChanged(localDoc, remoteDoc, filename) {
  return !localDoc._attachments ||
         !localDoc._attachments[filename] ||
         localDoc._attachments[filename].digest !== remoteDoc._attachments[filename].digest;
}

function getDocAttachments(db, doc) {
  var filenames = Object.keys(doc._attachments);
  return Promise.all(filenames.map(function (filename) {
    return db.getAttachment(doc._id, filename, {rev: doc._rev});
  }));
}

function getDocAttachmentsFromTargetOrSource(target, src, doc) {
  var doCheckForLocalAttachments = isRemote(src) && !isRemote(target);
  var filenames = Object.keys(doc._attachments);

  if (!doCheckForLocalAttachments) {
    return getDocAttachments(src, doc);
  }

  return target.get(doc._id).then(function (localDoc) {
    return Promise.all(filenames.map(function (filename) {
      if (fileHasChanged(localDoc, doc, filename)) {
        return src.getAttachment(doc._id, filename);
      }

      return target.getAttachment(localDoc._id, filename);
    }));
  }).catch(function (error) {
    /* istanbul ignore if */
    if (error.status !== 404) {
      throw error;
    }

    return getDocAttachments(src, doc);
  });
}

function createBulkGetOpts(diffs) {
  var requests = [];
  Object.keys(diffs).forEach(function (id) {
    var missingRevs = diffs[id].missing;
    missingRevs.forEach(function (missingRev) {
      requests.push({
        id: id,
        rev: missingRev
      });
    });
  });

  return {
    docs: requests,
    revs: true,
    latest: true
  };
}

//
// Fetch all the documents from the src as described in the "diffs",
// which is a mapping of docs IDs to revisions. If the state ever
// changes to "cancelled", then the returned promise will be rejected.
// Else it will be resolved with a list of fetched documents.
//
function getDocs(src, target, diffs, state) {
  diffs = clone(diffs); // we do not need to modify this

  var resultDocs = [],
      ok = true;

  function getAllDocs() {

    var bulkGetOpts = createBulkGetOpts(diffs);

    if (!bulkGetOpts.docs.length) { // optimization: skip empty requests
      return;
    }

    return src.bulkGet(bulkGetOpts).then(function (bulkGetResponse) {
      /* istanbul ignore if */
      if (state.cancelled) {
        throw new Error('cancelled');
      }
      return Promise.all(bulkGetResponse.results.map(function (bulkGetInfo) {
        return Promise.all(bulkGetInfo.docs.map(function (doc) {
          var remoteDoc = doc.ok;

          if (doc.error) {
            // when AUTO_COMPACTION is set, docs can be returned which look
            // like this: {"missing":"1-7c3ac256b693c462af8442f992b83696"}
            ok = false;
          }

          if (!remoteDoc || !remoteDoc._attachments) {
            return remoteDoc;
          }

          return getDocAttachmentsFromTargetOrSource(target, src, remoteDoc)
                   .then(function (attachments) {
                           var filenames = Object.keys(remoteDoc._attachments);
                           attachments
                             .forEach(function (attachment, i) {
                                        var att = remoteDoc._attachments[filenames[i]];
                                        delete att.stub;
                                        delete att.length;
                                        att.data = attachment;
                                      });

                                      return remoteDoc;
                                    });
        }));
      }))

      .then(function (results) {
        resultDocs = resultDocs.concat(flatten(results).filter(Boolean));
      });
    });
  }

  function returnResult() {
    return { ok:ok, docs:resultDocs };
  }

  return Promise.resolve()
    .then(getAllDocs)
    .then(returnResult);
}

var STARTING_BACK_OFF = 0;

function backOff(opts, returnValue, error, callback) {
  if (opts.retry === false) {
    returnValue.emit('error', error);
    returnValue.removeAllListeners();
    return;
  }
  /* istanbul ignore if */
  if (typeof opts.back_off_function !== 'function') {
    opts.back_off_function = defaultBackOff;
  }
  returnValue.emit('requestError', error);
  if (returnValue.state === 'active' || returnValue.state === 'pending') {
    returnValue.emit('paused', error);
    returnValue.state = 'stopped';
    var backOffSet = function backoffTimeSet() {
      opts.current_back_off = STARTING_BACK_OFF;
    };
    var removeBackOffSetter = function removeBackOffTimeSet() {
      returnValue.removeListener('active', backOffSet);
    };
    returnValue.once('paused', removeBackOffSetter);
    returnValue.once('active', backOffSet);
  }

  opts.current_back_off = opts.current_back_off || STARTING_BACK_OFF;
  opts.current_back_off = opts.back_off_function(opts.current_back_off);
  setTimeout(callback, opts.current_back_off);
}

function replicate(src, target, opts, returnValue, result) {
  var batches = [];               // list of batches to be processed
  var currentBatch;               // the batch currently being processed
  var pendingBatch = {
    seq: 0,
    changes: [],
    docs: []
  }; // next batch, not yet ready to be processed
  var writingCheckpoint = false;  // true while checkpoint is being written
  var changesCompleted = false;   // true when all changes received
  var replicationCompleted = false; // true when replication has completed
  // initial_last_seq is the state of the source db before
  // replication started, and it is _not_ updated during
  // replication or used anywhere else, as opposed to last_seq
  var initial_last_seq = 0;
  var last_seq = 0;
  var continuous = opts.continuous || opts.live || false;
  var batch_size = opts.batch_size || 100;
  var batches_limit = opts.batches_limit || 10;
  var style = opts.style || 'all_docs';
  var changesPending = false;     // true while src.changes is running
  var doc_ids = opts.doc_ids;
  var selector = opts.selector;
  var repId;
  var checkpointer;
  var changedDocs = [];
  // Like couchdb, every replication gets a unique session id
  var session = uuid();
  var taskId;

  result = result || {
    ok: true,
    start_time: new Date().toISOString(),
    docs_read: 0,
    docs_written: 0,
    doc_write_failures: 0,
    errors: []
  };

  var changesOpts = {};
  returnValue.ready(src, target);

  function initCheckpointer() {
    if (checkpointer) {
      return Promise.resolve();
    }
    return generateReplicationId(src, target, opts).then(function (res) {
      repId = res;

      var checkpointOpts = {};
      if (opts.checkpoint === false) {
        checkpointOpts = { writeSourceCheckpoint: false, writeTargetCheckpoint: false };
      } else if (opts.checkpoint === 'source') {
        checkpointOpts = { writeSourceCheckpoint: true, writeTargetCheckpoint: false };
      } else if (opts.checkpoint === 'target') {
        checkpointOpts = { writeSourceCheckpoint: false, writeTargetCheckpoint: true };
      } else {
        checkpointOpts = { writeSourceCheckpoint: true, writeTargetCheckpoint: true };
      }

      checkpointer = new Checkpointer(src, target, repId, returnValue, checkpointOpts);
    });
  }

  function writeDocs() {
    changedDocs = [];

    if (currentBatch.docs.length === 0) {
      return;
    }
    var docs = currentBatch.docs;
    var bulkOpts = {timeout: opts.timeout};
    return target.bulkDocs({docs: docs, new_edits: false}, bulkOpts).then(function (res) {
      /* istanbul ignore if */
      if (returnValue.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }

      // `res` doesn't include full documents (which live in `docs`), so we create a map of
      // (id -> error), and check for errors while iterating over `docs`
      var errorsById = Object.create(null);
      res.forEach(function (res) {
        if (res.error) {
          errorsById[res.id] = res;
        }
      });

      var errorsNo = Object.keys(errorsById).length;
      result.doc_write_failures += errorsNo;
      result.docs_written += docs.length - errorsNo;

      docs.forEach(function (doc) {
        var error = errorsById[doc._id];
        if (error) {
          result.errors.push(error);
          // Normalize error name. i.e. 'Unauthorized' -> 'unauthorized' (eg Sync Gateway)
          var errorName = (error.name || '').toLowerCase();
          if (errorName === 'unauthorized' || errorName === 'forbidden') {
            returnValue.emit('denied', clone(error));
          } else {
            throw error;
          }
        } else {
          changedDocs.push(doc);
        }
      });

    }, function (err) {
      result.doc_write_failures += docs.length;
      throw err;
    });
  }

  function finishBatch() {
    if (currentBatch.error) {
      throw new Error('There was a problem getting docs.');
    }
    result.last_seq = last_seq = currentBatch.seq;
    var outResult = clone(result);
    if (changedDocs.length) {
      outResult.docs = changedDocs;
      // Attach 'pending' property if server supports it (CouchDB 2.0+)
      /* istanbul ignore if */
      if (typeof currentBatch.pending === 'number') {
        outResult.pending = currentBatch.pending;
        delete currentBatch.pending;
      }
      returnValue.emit('change', outResult);
    }
    writingCheckpoint = true;

    src.info().then(function (info) {
      var task = src.activeTasks.get(taskId);
      if (!currentBatch || !task) {
        return;
      }

      var completed = task.completed_items || 0;
      var total_items = parseInt(info.update_seq, 10) - parseInt(initial_last_seq, 10);
      src.activeTasks.update(taskId, {
        completed_items: completed + currentBatch.changes.length,
        total_items
      });
    });

    return checkpointer.writeCheckpoint(currentBatch.seq,
        session).then(function () {
      returnValue.emit('checkpoint', { 'checkpoint': currentBatch.seq });
      writingCheckpoint = false;
      /* istanbul ignore if */
      if (returnValue.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }
      currentBatch = undefined;
      getChanges();
    }).catch(function (err) {
      onCheckpointError(err);
      throw err;
    });
  }

  function getDiffs() {
    var diff = {};
    currentBatch.changes.forEach(function (change) {
      returnValue.emit('checkpoint', { 'revs_diff': change });
      // Couchbase Sync Gateway emits these, but we can ignore them
      /* istanbul ignore if */
      if (change.id === "_user/") {
        return;
      }
      diff[change.id] = change.changes.map(function (x) {
        return x.rev;
      });
    });
    return target.revsDiff(diff).then(function (diffs) {
      /* istanbul ignore if */
      if (returnValue.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }
      // currentBatch.diffs elements are deleted as the documents are written
      currentBatch.diffs = diffs;
    });
  }

  function getBatchDocs() {
    return getDocs(src, target, currentBatch.diffs, returnValue).then(function (got) {
      currentBatch.error = !got.ok;
      got.docs.forEach(function (doc) {
        delete currentBatch.diffs[doc._id];
        result.docs_read++;
        currentBatch.docs.push(doc);
      });
    });
  }

  function startNextBatch() {
    if (returnValue.cancelled || currentBatch) {
      return;
    }
    if (batches.length === 0) {
      processPendingBatch(true);
      return;
    }
    currentBatch = batches.shift();
    returnValue.emit('checkpoint', { 'start_next_batch': currentBatch.seq });
    getDiffs()
      .then(getBatchDocs)
      .then(writeDocs)
      .then(finishBatch)
      .then(startNextBatch)
      .catch(function (err) {
        abortReplication('batch processing terminated with error', err);
      });
  }


  function processPendingBatch(immediate) {
    if (pendingBatch.changes.length === 0) {
      if (batches.length === 0 && !currentBatch) {
        if ((continuous && changesOpts.live) || changesCompleted) {
          returnValue.state = 'pending';
          returnValue.emit('paused');
        }
        if (changesCompleted) {
          completeReplication();
        }
      }
      return;
    }
    if (
      immediate ||
      changesCompleted ||
      pendingBatch.changes.length >= batch_size
    ) {
      batches.push(pendingBatch);
      pendingBatch = {
        seq: 0,
        changes: [],
        docs: []
      };
      if (returnValue.state === 'pending' || returnValue.state === 'stopped') {
        returnValue.state = 'active';
        returnValue.emit('active');
      }
      startNextBatch();
    }
  }


  function abortReplication(reason, err) {
    if (replicationCompleted) {
      return;
    }
    if (!err.message) {
      err.message = reason;
    }
    result.ok = false;
    result.status = 'aborting';
    batches = [];
    pendingBatch = {
      seq: 0,
      changes: [],
      docs: []
    };
    completeReplication(err);
  }


  function completeReplication(fatalError) {
    if (replicationCompleted) {
      return;
    }
    /* istanbul ignore if */
    if (returnValue.cancelled) {
      result.status = 'cancelled';
      if (writingCheckpoint) {
        return;
      }
    }
    result.status = result.status || 'complete';
    result.end_time = new Date().toISOString();
    result.last_seq = last_seq;
    replicationCompleted = true;

    src.activeTasks.remove(taskId, fatalError);

    if (fatalError) {
      // need to extend the error because Firefox considers ".result" read-only
      fatalError = createError(fatalError);
      fatalError.result = result;

      // Normalize error name. i.e. 'Unauthorized' -> 'unauthorized' (eg Sync Gateway)
      var errorName = (fatalError.name || '').toLowerCase();
      if (errorName === 'unauthorized' || errorName === 'forbidden') {
        returnValue.emit('error', fatalError);
        returnValue.removeAllListeners();
      } else {
        backOff(opts, returnValue, fatalError, function () {
          replicate(src, target, opts, returnValue);
        });
      }
    } else {
      returnValue.emit('complete', result);
      returnValue.removeAllListeners();
    }
  }

  function onChange(change, pending, lastSeq) {
    /* istanbul ignore if */
    if (returnValue.cancelled) {
      return completeReplication();
    }
    // Attach 'pending' property if server supports it (CouchDB 2.0+)
    /* istanbul ignore if */
    if (typeof pending === 'number') {
      pendingBatch.pending = pending;
    }

    var filter = filterChange(opts)(change);
    if (!filter) {
      // update processed items count by 1
      var task = src.activeTasks.get(taskId);
      if (task) {
        // we can assume that task exists here? shouldn't be deleted by here.
        var completed = task.completed_items || 0;
        src.activeTasks.update(taskId, {completed_items: ++completed});
      }
      return;
    }
    pendingBatch.seq = change.seq || lastSeq;
    pendingBatch.changes.push(change);
    returnValue.emit('checkpoint', { 'pending_batch': pendingBatch.seq });
    immediate(function () {
      processPendingBatch(batches.length === 0 && changesOpts.live);
    });
  }


  function onChangesComplete(changes) {
    changesPending = false;
    /* istanbul ignore if */
    if (returnValue.cancelled) {
      return completeReplication();
    }

    // if no results were returned then we're done,
    // else fetch more
    if (changes.results.length > 0) {
      changesOpts.since = changes.results[changes.results.length - 1].seq;
      getChanges();
      processPendingBatch(true);
    } else {

      var complete = function () {
        if (continuous) {
          changesOpts.live = true;
          getChanges();
        } else {
          changesCompleted = true;
        }
        processPendingBatch(true);
      };

      // update the checkpoint so we start from the right seq next time
      if (!currentBatch && changes.results.length === 0) {
        writingCheckpoint = true;
        checkpointer.writeCheckpoint(changes.last_seq,
            session).then(function () {
          writingCheckpoint = false;
          result.last_seq = last_seq = changes.last_seq;
          if (returnValue.cancelled) {
            completeReplication();
            throw new Error('cancelled');
          } else {
            complete();
          }
        })
        .catch(onCheckpointError);
      } else {
        complete();
      }
    }
  }


  function onChangesError(err) {
    changesPending = false;
    /* istanbul ignore if */
    if (returnValue.cancelled) {
      return completeReplication();
    }
    abortReplication('changes rejected', err);
  }


  function getChanges() {
    if (!(
      !changesPending &&
      !changesCompleted &&
      batches.length < batches_limit
      )) {
      return;
    }
    changesPending = true;
    function abortChanges() {
      changes.cancel();
    }
    function removeListener() {
      returnValue.removeListener('cancel', abortChanges);
    }

    if (returnValue._changes) { // remove old changes() and listeners
      returnValue.removeListener('cancel', returnValue._abortChanges);
      returnValue._changes.cancel();
    }
    returnValue.once('cancel', abortChanges);

    var changes = src.changes(changesOpts)
      .on('change', onChange);
    changes.then(removeListener, removeListener);
    changes.then(onChangesComplete)
      .catch(onChangesError);

    if (opts.retry) {
      // save for later so we can cancel if necessary
      returnValue._changes = changes;
      returnValue._abortChanges = abortChanges;
    }
  }

  function createTask(checkpoint) {
    return src.info().then(function (info) {
      var total_items = typeof opts.since === 'undefined' ?
        parseInt(info.update_seq, 10) - parseInt(checkpoint, 10) :
        parseInt(info.update_seq, 10);

      taskId = src.activeTasks.add({
        name: `${continuous ? 'continuous ' : ''}replication from ${info.db_name}` ,
        total_items,
      });

      return checkpoint;
    });
  }

  function startChanges() {
    initCheckpointer().then(function () {
      /* istanbul ignore if */
      if (returnValue.cancelled) {
        completeReplication();
        return;
      }
      return checkpointer.getCheckpoint().then(createTask).then(function (checkpoint) {
        last_seq = checkpoint;
        initial_last_seq = checkpoint;
        changesOpts = {
          since: last_seq,
          limit: batch_size,
          batch_size: batch_size,
          style: style,
          doc_ids: doc_ids,
          selector: selector,
          return_docs: true // required so we know when we're done
        };
        if (opts.filter) {
          if (typeof opts.filter !== 'string') {
            // required for the client-side filter in onChange
            changesOpts.include_docs = true;
          } else { // ddoc filter
            changesOpts.filter = opts.filter;
          }
        }
        if ('heartbeat' in opts) {
          changesOpts.heartbeat = opts.heartbeat;
        }
        if ('timeout' in opts) {
          changesOpts.timeout = opts.timeout;
        }
        if (opts.query_params) {
          changesOpts.query_params = opts.query_params;
        }
        if (opts.view) {
          changesOpts.view = opts.view;
        }
        getChanges();
      });
    }).catch(function (err) {
      abortReplication('getCheckpoint rejected with ', err);
    });
  }

  /* istanbul ignore next */
  function onCheckpointError(err) {
    writingCheckpoint = false;
    abortReplication('writeCheckpoint completed with error', err);
  }

  /* istanbul ignore if */
  if (returnValue.cancelled) { // cancelled immediately
    completeReplication();
    return;
  }

  if (!returnValue._addedListeners) {
    returnValue.once('cancel', completeReplication);

    if (typeof opts.complete === 'function') {
      returnValue.once('error', opts.complete);
      returnValue.once('complete', function (result) {
        opts.complete(null, result);
      });
    }
    returnValue._addedListeners = true;
  }

  if (typeof opts.since === 'undefined') {
    startChanges();
  } else {
    initCheckpointer().then(function () {
      writingCheckpoint = true;
      return checkpointer.writeCheckpoint(opts.since, session);
    }).then(function () {
      writingCheckpoint = false;
      /* istanbul ignore if */
      if (returnValue.cancelled) {
        completeReplication();
        return;
      }
      last_seq = opts.since;
      startChanges();
    }).catch(onCheckpointError);
  }
}

// We create a basic promise so the caller can cancel the replication possibly
// before we have actually started listening to changes etc
class Replication extends events {
  constructor() {
    super();
    this.cancelled = false;
    this.state = 'pending';
    const promise = new Promise((fulfill, reject) => {
      this.once('complete', fulfill);
      this.once('error', reject);
    });
    this.then = function (resolve, reject) {
      return promise.then(resolve, reject);
    };
    this.catch = function (reject) {
      return promise.catch(reject);
    };
    // As we allow error handling via "error" event as well,
    // put a stub in here so that rejecting never throws UnhandledError.
    this.catch(function () {});
  }

  cancel() {
    this.cancelled = true;
    this.state = 'cancelled';
    this.emit('cancel');
  }

  ready(src, target) {
    if (this._readyCalled) {
      return;
    }
    this._readyCalled = true;
  
    const onDestroy = () => {
      this.cancel();
    };
    src.once('destroyed', onDestroy);
    target.once('destroyed', onDestroy);
    function cleanup() {
      src.removeListener('destroyed', onDestroy);
      target.removeListener('destroyed', onDestroy);
    }
    this.once('complete', cleanup);
    this.once('error', cleanup);
  }
}

function toPouch(db, opts) {
  var PouchConstructor = opts.PouchConstructor;
  if (typeof db === 'string') {
    return new PouchConstructor(db, opts);
  } else {
    return db;
  }
}

function replicateWrapper(src, target, opts, callback) {

  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }

  if (opts.doc_ids && !Array.isArray(opts.doc_ids)) {
    throw createError(BAD_REQUEST,
                       "`doc_ids` filter parameter is not a list.");
  }

  opts.complete = callback;
  opts = clone(opts);
  opts.continuous = opts.continuous || opts.live;
  opts.retry = ('retry' in opts) ? opts.retry : false;
  /*jshint validthis:true */
  opts.PouchConstructor = opts.PouchConstructor || this;
  var replicateRet = new Replication(opts);
  var srcPouch = toPouch(src, opts);
  var targetPouch = toPouch(target, opts);
  replicate(srcPouch, targetPouch, opts, replicateRet);
  return replicateRet;
}

function sync(src, target, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }
  opts = clone(opts);
  /*jshint validthis:true */
  opts.PouchConstructor = opts.PouchConstructor || this;
  src = toPouch(src, opts);
  target = toPouch(target, opts);
  return new Sync(src, target, opts, callback);
}

class Sync extends events {
  constructor(src, target, opts, callback) {
    super();
    this.canceled = false;

    const optsPush = opts.push ? Object.assign({}, opts, opts.push) : opts;
    const optsPull = opts.pull ? Object.assign({}, opts, opts.pull) : opts;

    this.push = replicateWrapper(src, target, optsPush);
    this.pull = replicateWrapper(target, src, optsPull);

    this.pushPaused = true;
    this.pullPaused = true;

    const pullChange = (change) => {
      this.emit('change', {
        direction: 'pull',
        change: change
      });
    };
    const pushChange = (change) => {
      this.emit('change', {
        direction: 'push',
        change: change
      });
    };
    const pushDenied = (doc) => {
      this.emit('denied', {
        direction: 'push',
        doc: doc
      });
    };
    const pullDenied = (doc) => {
      this.emit('denied', {
        direction: 'pull',
        doc: doc
      });
    };
    const pushPaused = () => {
      this.pushPaused = true;
      /* istanbul ignore if */
      if (this.pullPaused) {
        this.emit('paused');
      }
    };
    const pullPaused = () => {
      this.pullPaused = true;
      /* istanbul ignore if */
      if (this.pushPaused) {
        this.emit('paused');
      }
    };
    const pushActive = () => {
      this.pushPaused = false;
      /* istanbul ignore if */
      if (this.pullPaused) {
        this.emit('active', {
          direction: 'push'
        });
      }
    };
    const pullActive = () => {
      this.pullPaused = false;
      /* istanbul ignore if */
      if (this.pushPaused) {
        this.emit('active', {
          direction: 'pull'
        });
      }
    };

    let removed = {};

    const removeAll = (type) => { // type is 'push' or 'pull'
      return (event, func) => {
        const isChange = event === 'change' &&
          (func === pullChange || func === pushChange);
        const isDenied = event === 'denied' &&
          (func === pullDenied || func === pushDenied);
        const isPaused = event === 'paused' &&
          (func === pullPaused || func === pushPaused);
        const isActive = event === 'active' &&
          (func === pullActive || func === pushActive);

        if (isChange || isDenied || isPaused || isActive) {
          if (!(event in removed)) {
            removed[event] = {};
          }
          removed[event][type] = true;
          if (Object.keys(removed[event]).length === 2) {
            // both push and pull have asked to be removed
            this.removeAllListeners(event);
          }
        }
      };
    };

    if (opts.live) {
      this.push.on('complete', this.pull.cancel.bind(this.pull));
      this.pull.on('complete', this.push.cancel.bind(this.push));
    }

    function addOneListener(ee, event, listener) {
      if (ee.listeners(event).indexOf(listener) == -1) {
        ee.on(event, listener);
      }
    }

    this.on('newListener', function (event) {
      if (event === 'change') {
        addOneListener(this.pull, 'change', pullChange);
        addOneListener(this.push, 'change', pushChange);
      } else if (event === 'denied') {
        addOneListener(this.pull, 'denied', pullDenied);
        addOneListener(this.push, 'denied', pushDenied);
      } else if (event === 'active') {
        addOneListener(this.pull, 'active', pullActive);
        addOneListener(this.push, 'active', pushActive);
      } else if (event === 'paused') {
        addOneListener(this.pull, 'paused', pullPaused);
        addOneListener(this.push, 'paused', pushPaused);
      }
    });

    this.on('removeListener', function (event) {
      if (event === 'change') {
        this.pull.removeListener('change', pullChange);
        this.push.removeListener('change', pushChange);
      } else if (event === 'denied') {
        this.pull.removeListener('denied', pullDenied);
        this.push.removeListener('denied', pushDenied);
      } else if (event === 'active') {
        this.pull.removeListener('active', pullActive);
        this.push.removeListener('active', pushActive);
      } else if (event === 'paused') {
        this.pull.removeListener('paused', pullPaused);
        this.push.removeListener('paused', pushPaused);
      }
    });

    this.pull.on('removeListener', removeAll('pull'));
    this.push.on('removeListener', removeAll('push'));

    const promise = Promise.all([
      this.push,
      this.pull
    ]).then((resp) => {
      const out = {
        push: resp[0],
        pull: resp[1]
      };
      this.emit('complete', out);
      if (callback) {
        callback(null, out);
      }
      this.removeAllListeners();
      return out;
    }, (err) => {
      this.cancel();
      if (callback) {
        // if there's a callback, then the callback can receive
        // the error event
        callback(err);
      } else {
        // if there's no callback, then we're safe to emit an error
        // event, which would otherwise throw an unhandled error
        // due to 'error' being a special event in EventEmitters
        this.emit('error', err);
      }
      this.removeAllListeners();
      if (callback) {
        // no sense throwing if we're already emitting an 'error' event
        throw err;
      }
    });

    this.then = function (success, err) {
      return promise.then(success, err);
    };

    this.catch = function (err) {
      return promise.catch(err);
    };
  }

  cancel() {
    if (!this.canceled) {
      this.canceled = true;
      this.push.cancel();
      this.pull.cancel();
    }
  }
}

function replication(PouchDB) {
  PouchDB.replicate = replicateWrapper;
  PouchDB.sync = sync;

  Object.defineProperty(PouchDB.prototype, 'replicate', {
    get: function () {
      var self = this;
      if (typeof this.replicateMethods === 'undefined') {
        this.replicateMethods = {
          from: function (other, opts, callback) {
            return self.constructor.replicate(other, self, opts, callback);
          },
          to: function (other, opts, callback) {
            return self.constructor.replicate(self, other, opts, callback);
          }
        };
      }
      return this.replicateMethods;
    }
  });

  PouchDB.prototype.sync = function (dbName, opts, callback) {
    return this.constructor.sync(this, dbName, opts, callback);
  };
}

export { replication as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1yZXBsaWNhdGlvbi5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9wb3VjaGRiLXJlcGxpY2F0aW9uL3NyYy9nZXREb2NzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1yZXBsaWNhdGlvbi9zcmMvYmFja29mZi5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItcmVwbGljYXRpb24vc3JjL3JlcGxpY2F0ZS5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItcmVwbGljYXRpb24vc3JjL3JlcGxpY2F0aW9uLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1yZXBsaWNhdGlvbi9zcmMvcmVwbGljYXRlV3JhcHBlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItcmVwbGljYXRpb24vc3JjL3N5bmMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLXJlcGxpY2F0aW9uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjbG9uZSwgZmxhdHRlbiwgaXNSZW1vdGUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuZnVuY3Rpb24gZmlsZUhhc0NoYW5nZWQobG9jYWxEb2MsIHJlbW90ZURvYywgZmlsZW5hbWUpIHtcbiAgcmV0dXJuICFsb2NhbERvYy5fYXR0YWNobWVudHMgfHxcbiAgICAgICAgICFsb2NhbERvYy5fYXR0YWNobWVudHNbZmlsZW5hbWVdIHx8XG4gICAgICAgICBsb2NhbERvYy5fYXR0YWNobWVudHNbZmlsZW5hbWVdLmRpZ2VzdCAhPT0gcmVtb3RlRG9jLl9hdHRhY2htZW50c1tmaWxlbmFtZV0uZGlnZXN0O1xufVxuXG5mdW5jdGlvbiBnZXREb2NBdHRhY2htZW50cyhkYiwgZG9jKSB7XG4gIHZhciBmaWxlbmFtZXMgPSBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKTtcbiAgcmV0dXJuIFByb21pc2UuYWxsKGZpbGVuYW1lcy5tYXAoZnVuY3Rpb24gKGZpbGVuYW1lKSB7XG4gICAgcmV0dXJuIGRiLmdldEF0dGFjaG1lbnQoZG9jLl9pZCwgZmlsZW5hbWUsIHtyZXY6IGRvYy5fcmV2fSk7XG4gIH0pKTtcbn1cblxuZnVuY3Rpb24gZ2V0RG9jQXR0YWNobWVudHNGcm9tVGFyZ2V0T3JTb3VyY2UodGFyZ2V0LCBzcmMsIGRvYykge1xuICB2YXIgZG9DaGVja0ZvckxvY2FsQXR0YWNobWVudHMgPSBpc1JlbW90ZShzcmMpICYmICFpc1JlbW90ZSh0YXJnZXQpO1xuICB2YXIgZmlsZW5hbWVzID0gT2JqZWN0LmtleXMoZG9jLl9hdHRhY2htZW50cyk7XG5cbiAgaWYgKCFkb0NoZWNrRm9yTG9jYWxBdHRhY2htZW50cykge1xuICAgIHJldHVybiBnZXREb2NBdHRhY2htZW50cyhzcmMsIGRvYyk7XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0LmdldChkb2MuX2lkKS50aGVuKGZ1bmN0aW9uIChsb2NhbERvYykge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChmaWxlbmFtZXMubWFwKGZ1bmN0aW9uIChmaWxlbmFtZSkge1xuICAgICAgaWYgKGZpbGVIYXNDaGFuZ2VkKGxvY2FsRG9jLCBkb2MsIGZpbGVuYW1lKSkge1xuICAgICAgICByZXR1cm4gc3JjLmdldEF0dGFjaG1lbnQoZG9jLl9pZCwgZmlsZW5hbWUpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGFyZ2V0LmdldEF0dGFjaG1lbnQobG9jYWxEb2MuX2lkLCBmaWxlbmFtZSk7XG4gICAgfSkpO1xuICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoZXJyb3Iuc3RhdHVzICE9PSA0MDQpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cblxuICAgIHJldHVybiBnZXREb2NBdHRhY2htZW50cyhzcmMsIGRvYyk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCdWxrR2V0T3B0cyhkaWZmcykge1xuICB2YXIgcmVxdWVzdHMgPSBbXTtcbiAgT2JqZWN0LmtleXMoZGlmZnMpLmZvckVhY2goZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIG1pc3NpbmdSZXZzID0gZGlmZnNbaWRdLm1pc3Npbmc7XG4gICAgbWlzc2luZ1JldnMuZm9yRWFjaChmdW5jdGlvbiAobWlzc2luZ1Jldikge1xuICAgICAgcmVxdWVzdHMucHVzaCh7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgcmV2OiBtaXNzaW5nUmV2XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkb2NzOiByZXF1ZXN0cyxcbiAgICByZXZzOiB0cnVlLFxuICAgIGxhdGVzdDogdHJ1ZVxuICB9O1xufVxuXG4vL1xuLy8gRmV0Y2ggYWxsIHRoZSBkb2N1bWVudHMgZnJvbSB0aGUgc3JjIGFzIGRlc2NyaWJlZCBpbiB0aGUgXCJkaWZmc1wiLFxuLy8gd2hpY2ggaXMgYSBtYXBwaW5nIG9mIGRvY3MgSURzIHRvIHJldmlzaW9ucy4gSWYgdGhlIHN0YXRlIGV2ZXJcbi8vIGNoYW5nZXMgdG8gXCJjYW5jZWxsZWRcIiwgdGhlbiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuLy8gRWxzZSBpdCB3aWxsIGJlIHJlc29sdmVkIHdpdGggYSBsaXN0IG9mIGZldGNoZWQgZG9jdW1lbnRzLlxuLy9cbmZ1bmN0aW9uIGdldERvY3Moc3JjLCB0YXJnZXQsIGRpZmZzLCBzdGF0ZSkge1xuICBkaWZmcyA9IGNsb25lKGRpZmZzKTsgLy8gd2UgZG8gbm90IG5lZWQgdG8gbW9kaWZ5IHRoaXNcblxuICB2YXIgcmVzdWx0RG9jcyA9IFtdLFxuICAgICAgb2sgPSB0cnVlO1xuXG4gIGZ1bmN0aW9uIGdldEFsbERvY3MoKSB7XG5cbiAgICB2YXIgYnVsa0dldE9wdHMgPSBjcmVhdGVCdWxrR2V0T3B0cyhkaWZmcyk7XG5cbiAgICBpZiAoIWJ1bGtHZXRPcHRzLmRvY3MubGVuZ3RoKSB7IC8vIG9wdGltaXphdGlvbjogc2tpcCBlbXB0eSByZXF1ZXN0c1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJldHVybiBzcmMuYnVsa0dldChidWxrR2V0T3B0cykudGhlbihmdW5jdGlvbiAoYnVsa0dldFJlc3BvbnNlKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChzdGF0ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW5jZWxsZWQnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChidWxrR2V0UmVzcG9uc2UucmVzdWx0cy5tYXAoZnVuY3Rpb24gKGJ1bGtHZXRJbmZvKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChidWxrR2V0SW5mby5kb2NzLm1hcChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgdmFyIHJlbW90ZURvYyA9IGRvYy5vaztcblxuICAgICAgICAgIGlmIChkb2MuZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIHdoZW4gQVVUT19DT01QQUNUSU9OIGlzIHNldCwgZG9jcyBjYW4gYmUgcmV0dXJuZWQgd2hpY2ggbG9va1xuICAgICAgICAgICAgLy8gbGlrZSB0aGlzOiB7XCJtaXNzaW5nXCI6XCIxLTdjM2FjMjU2YjY5M2M0NjJhZjg0NDJmOTkyYjgzNjk2XCJ9XG4gICAgICAgICAgICBvayA9IGZhbHNlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghcmVtb3RlRG9jIHx8ICFyZW1vdGVEb2MuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVtb3RlRG9jO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBnZXREb2NBdHRhY2htZW50c0Zyb21UYXJnZXRPclNvdXJjZSh0YXJnZXQsIHNyYywgcmVtb3RlRG9jKVxuICAgICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChhdHRhY2htZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZpbGVuYW1lcyA9IE9iamVjdC5rZXlzKHJlbW90ZURvYy5fYXR0YWNobWVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZvckVhY2goZnVuY3Rpb24gKGF0dGFjaG1lbnQsIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXR0ID0gcmVtb3RlRG9jLl9hdHRhY2htZW50c1tmaWxlbmFtZXNbaV1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBhdHQuc3R1YjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgYXR0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdHQuZGF0YSA9IGF0dGFjaG1lbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZW1vdGVEb2M7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSkpO1xuICAgICAgfSkpXG5cbiAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXN1bHRzKSB7XG4gICAgICAgIHJlc3VsdERvY3MgPSByZXN1bHREb2NzLmNvbmNhdChmbGF0dGVuKHJlc3VsdHMpLmZpbHRlcihCb29sZWFuKSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJldHVyblJlc3VsdCgpIHtcbiAgICByZXR1cm4geyBvazpvaywgZG9jczpyZXN1bHREb2NzIH07XG4gIH1cblxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAudGhlbihnZXRBbGxEb2NzKVxuICAgIC50aGVuKHJldHVyblJlc3VsdCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGdldERvY3M7XG4iLCJ2YXIgU1RBUlRJTkdfQkFDS19PRkYgPSAwO1xuXG5pbXBvcnQgeyBkZWZhdWx0QmFja09mZiB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuXG5mdW5jdGlvbiBiYWNrT2ZmKG9wdHMsIHJldHVyblZhbHVlLCBlcnJvciwgY2FsbGJhY2spIHtcbiAgaWYgKG9wdHMucmV0cnkgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuVmFsdWUuZW1pdCgnZXJyb3InLCBlcnJvcik7XG4gICAgcmV0dXJuVmFsdWUucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAodHlwZW9mIG9wdHMuYmFja19vZmZfZnVuY3Rpb24gIT09ICdmdW5jdGlvbicpIHtcbiAgICBvcHRzLmJhY2tfb2ZmX2Z1bmN0aW9uID0gZGVmYXVsdEJhY2tPZmY7XG4gIH1cbiAgcmV0dXJuVmFsdWUuZW1pdCgncmVxdWVzdEVycm9yJywgZXJyb3IpO1xuICBpZiAocmV0dXJuVmFsdWUuc3RhdGUgPT09ICdhY3RpdmUnIHx8IHJldHVyblZhbHVlLnN0YXRlID09PSAncGVuZGluZycpIHtcbiAgICByZXR1cm5WYWx1ZS5lbWl0KCdwYXVzZWQnLCBlcnJvcik7XG4gICAgcmV0dXJuVmFsdWUuc3RhdGUgPSAnc3RvcHBlZCc7XG4gICAgdmFyIGJhY2tPZmZTZXQgPSBmdW5jdGlvbiBiYWNrb2ZmVGltZVNldCgpIHtcbiAgICAgIG9wdHMuY3VycmVudF9iYWNrX29mZiA9IFNUQVJUSU5HX0JBQ0tfT0ZGO1xuICAgIH07XG4gICAgdmFyIHJlbW92ZUJhY2tPZmZTZXR0ZXIgPSBmdW5jdGlvbiByZW1vdmVCYWNrT2ZmVGltZVNldCgpIHtcbiAgICAgIHJldHVyblZhbHVlLnJlbW92ZUxpc3RlbmVyKCdhY3RpdmUnLCBiYWNrT2ZmU2V0KTtcbiAgICB9O1xuICAgIHJldHVyblZhbHVlLm9uY2UoJ3BhdXNlZCcsIHJlbW92ZUJhY2tPZmZTZXR0ZXIpO1xuICAgIHJldHVyblZhbHVlLm9uY2UoJ2FjdGl2ZScsIGJhY2tPZmZTZXQpO1xuICB9XG5cbiAgb3B0cy5jdXJyZW50X2JhY2tfb2ZmID0gb3B0cy5jdXJyZW50X2JhY2tfb2ZmIHx8IFNUQVJUSU5HX0JBQ0tfT0ZGO1xuICBvcHRzLmN1cnJlbnRfYmFja19vZmYgPSBvcHRzLmJhY2tfb2ZmX2Z1bmN0aW9uKG9wdHMuY3VycmVudF9iYWNrX29mZik7XG4gIHNldFRpbWVvdXQoY2FsbGJhY2ssIG9wdHMuY3VycmVudF9iYWNrX29mZik7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGJhY2tPZmY7XG4iLCJpbXBvcnQgeyBjbG9uZSwgZmlsdGVyQ2hhbmdlLCBuZXh0VGljaywgdXVpZCB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IGdldERvY3MgZnJvbSAnLi9nZXREb2NzJztcbmltcG9ydCBDaGVja3BvaW50ZXIgZnJvbSAncG91Y2hkYi1jaGVja3BvaW50ZXInO1xuaW1wb3J0IGJhY2tPZmYgZnJvbSAnLi9iYWNrb2ZmJztcbmltcG9ydCBnZW5lcmF0ZVJlcGxpY2F0aW9uSWQgZnJvbSAncG91Y2hkYi1nZW5lcmF0ZS1yZXBsaWNhdGlvbi1pZCc7XG5pbXBvcnQgeyBjcmVhdGVFcnJvciB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcblxuZnVuY3Rpb24gcmVwbGljYXRlKHNyYywgdGFyZ2V0LCBvcHRzLCByZXR1cm5WYWx1ZSwgcmVzdWx0KSB7XG4gIHZhciBiYXRjaGVzID0gW107ICAgICAgICAgICAgICAgLy8gbGlzdCBvZiBiYXRjaGVzIHRvIGJlIHByb2Nlc3NlZFxuICB2YXIgY3VycmVudEJhdGNoOyAgICAgICAgICAgICAgIC8vIHRoZSBiYXRjaCBjdXJyZW50bHkgYmVpbmcgcHJvY2Vzc2VkXG4gIHZhciBwZW5kaW5nQmF0Y2ggPSB7XG4gICAgc2VxOiAwLFxuICAgIGNoYW5nZXM6IFtdLFxuICAgIGRvY3M6IFtdXG4gIH07IC8vIG5leHQgYmF0Y2gsIG5vdCB5ZXQgcmVhZHkgdG8gYmUgcHJvY2Vzc2VkXG4gIHZhciB3cml0aW5nQ2hlY2twb2ludCA9IGZhbHNlOyAgLy8gdHJ1ZSB3aGlsZSBjaGVja3BvaW50IGlzIGJlaW5nIHdyaXR0ZW5cbiAgdmFyIGNoYW5nZXNDb21wbGV0ZWQgPSBmYWxzZTsgICAvLyB0cnVlIHdoZW4gYWxsIGNoYW5nZXMgcmVjZWl2ZWRcbiAgdmFyIHJlcGxpY2F0aW9uQ29tcGxldGVkID0gZmFsc2U7IC8vIHRydWUgd2hlbiByZXBsaWNhdGlvbiBoYXMgY29tcGxldGVkXG4gIC8vIGluaXRpYWxfbGFzdF9zZXEgaXMgdGhlIHN0YXRlIG9mIHRoZSBzb3VyY2UgZGIgYmVmb3JlXG4gIC8vIHJlcGxpY2F0aW9uIHN0YXJ0ZWQsIGFuZCBpdCBpcyBfbm90XyB1cGRhdGVkIGR1cmluZ1xuICAvLyByZXBsaWNhdGlvbiBvciB1c2VkIGFueXdoZXJlIGVsc2UsIGFzIG9wcG9zZWQgdG8gbGFzdF9zZXFcbiAgdmFyIGluaXRpYWxfbGFzdF9zZXEgPSAwO1xuICB2YXIgbGFzdF9zZXEgPSAwO1xuICB2YXIgY29udGludW91cyA9IG9wdHMuY29udGludW91cyB8fCBvcHRzLmxpdmUgfHwgZmFsc2U7XG4gIHZhciBiYXRjaF9zaXplID0gb3B0cy5iYXRjaF9zaXplIHx8IDEwMDtcbiAgdmFyIGJhdGNoZXNfbGltaXQgPSBvcHRzLmJhdGNoZXNfbGltaXQgfHwgMTA7XG4gIHZhciBzdHlsZSA9IG9wdHMuc3R5bGUgfHwgJ2FsbF9kb2NzJztcbiAgdmFyIGNoYW5nZXNQZW5kaW5nID0gZmFsc2U7ICAgICAvLyB0cnVlIHdoaWxlIHNyYy5jaGFuZ2VzIGlzIHJ1bm5pbmdcbiAgdmFyIGRvY19pZHMgPSBvcHRzLmRvY19pZHM7XG4gIHZhciBzZWxlY3RvciA9IG9wdHMuc2VsZWN0b3I7XG4gIHZhciByZXBJZDtcbiAgdmFyIGNoZWNrcG9pbnRlcjtcbiAgdmFyIGNoYW5nZWREb2NzID0gW107XG4gIC8vIExpa2UgY291Y2hkYiwgZXZlcnkgcmVwbGljYXRpb24gZ2V0cyBhIHVuaXF1ZSBzZXNzaW9uIGlkXG4gIHZhciBzZXNzaW9uID0gdXVpZCgpO1xuICB2YXIgdGFza0lkO1xuXG4gIHJlc3VsdCA9IHJlc3VsdCB8fCB7XG4gICAgb2s6IHRydWUsXG4gICAgc3RhcnRfdGltZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIGRvY3NfcmVhZDogMCxcbiAgICBkb2NzX3dyaXR0ZW46IDAsXG4gICAgZG9jX3dyaXRlX2ZhaWx1cmVzOiAwLFxuICAgIGVycm9yczogW11cbiAgfTtcblxuICB2YXIgY2hhbmdlc09wdHMgPSB7fTtcbiAgcmV0dXJuVmFsdWUucmVhZHkoc3JjLCB0YXJnZXQpO1xuXG4gIGZ1bmN0aW9uIGluaXRDaGVja3BvaW50ZXIoKSB7XG4gICAgaWYgKGNoZWNrcG9pbnRlcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVSZXBsaWNhdGlvbklkKHNyYywgdGFyZ2V0LCBvcHRzKS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgIHJlcElkID0gcmVzO1xuXG4gICAgICB2YXIgY2hlY2twb2ludE9wdHMgPSB7fTtcbiAgICAgIGlmIChvcHRzLmNoZWNrcG9pbnQgPT09IGZhbHNlKSB7XG4gICAgICAgIGNoZWNrcG9pbnRPcHRzID0geyB3cml0ZVNvdXJjZUNoZWNrcG9pbnQ6IGZhbHNlLCB3cml0ZVRhcmdldENoZWNrcG9pbnQ6IGZhbHNlIH07XG4gICAgICB9IGVsc2UgaWYgKG9wdHMuY2hlY2twb2ludCA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgY2hlY2twb2ludE9wdHMgPSB7IHdyaXRlU291cmNlQ2hlY2twb2ludDogdHJ1ZSwgd3JpdGVUYXJnZXRDaGVja3BvaW50OiBmYWxzZSB9O1xuICAgICAgfSBlbHNlIGlmIChvcHRzLmNoZWNrcG9pbnQgPT09ICd0YXJnZXQnKSB7XG4gICAgICAgIGNoZWNrcG9pbnRPcHRzID0geyB3cml0ZVNvdXJjZUNoZWNrcG9pbnQ6IGZhbHNlLCB3cml0ZVRhcmdldENoZWNrcG9pbnQ6IHRydWUgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoZWNrcG9pbnRPcHRzID0geyB3cml0ZVNvdXJjZUNoZWNrcG9pbnQ6IHRydWUsIHdyaXRlVGFyZ2V0Q2hlY2twb2ludDogdHJ1ZSB9O1xuICAgICAgfVxuXG4gICAgICBjaGVja3BvaW50ZXIgPSBuZXcgQ2hlY2twb2ludGVyKHNyYywgdGFyZ2V0LCByZXBJZCwgcmV0dXJuVmFsdWUsIGNoZWNrcG9pbnRPcHRzKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlRG9jcygpIHtcbiAgICBjaGFuZ2VkRG9jcyA9IFtdO1xuXG4gICAgaWYgKGN1cnJlbnRCYXRjaC5kb2NzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgZG9jcyA9IGN1cnJlbnRCYXRjaC5kb2NzO1xuICAgIHZhciBidWxrT3B0cyA9IHt0aW1lb3V0OiBvcHRzLnRpbWVvdXR9O1xuICAgIHJldHVybiB0YXJnZXQuYnVsa0RvY3Moe2RvY3M6IGRvY3MsIG5ld19lZGl0czogZmFsc2V9LCBidWxrT3B0cykudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgY29tcGxldGVSZXBsaWNhdGlvbigpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbmNlbGxlZCcpO1xuICAgICAgfVxuXG4gICAgICAvLyBgcmVzYCBkb2Vzbid0IGluY2x1ZGUgZnVsbCBkb2N1bWVudHMgKHdoaWNoIGxpdmUgaW4gYGRvY3NgKSwgc28gd2UgY3JlYXRlIGEgbWFwIG9mXG4gICAgICAvLyAoaWQgLT4gZXJyb3IpLCBhbmQgY2hlY2sgZm9yIGVycm9ycyB3aGlsZSBpdGVyYXRpbmcgb3ZlciBgZG9jc2BcbiAgICAgIHZhciBlcnJvcnNCeUlkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgIHJlcy5mb3JFYWNoKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgaWYgKHJlcy5lcnJvcikge1xuICAgICAgICAgIGVycm9yc0J5SWRbcmVzLmlkXSA9IHJlcztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHZhciBlcnJvcnNObyA9IE9iamVjdC5rZXlzKGVycm9yc0J5SWQpLmxlbmd0aDtcbiAgICAgIHJlc3VsdC5kb2Nfd3JpdGVfZmFpbHVyZXMgKz0gZXJyb3JzTm87XG4gICAgICByZXN1bHQuZG9jc193cml0dGVuICs9IGRvY3MubGVuZ3RoIC0gZXJyb3JzTm87XG5cbiAgICAgIGRvY3MuZm9yRWFjaChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIHZhciBlcnJvciA9IGVycm9yc0J5SWRbZG9jLl9pZF07XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHJlc3VsdC5lcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgICAgLy8gTm9ybWFsaXplIGVycm9yIG5hbWUuIGkuZS4gJ1VuYXV0aG9yaXplZCcgLT4gJ3VuYXV0aG9yaXplZCcgKGVnIFN5bmMgR2F0ZXdheSlcbiAgICAgICAgICB2YXIgZXJyb3JOYW1lID0gKGVycm9yLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgaWYgKGVycm9yTmFtZSA9PT0gJ3VuYXV0aG9yaXplZCcgfHwgZXJyb3JOYW1lID09PSAnZm9yYmlkZGVuJykge1xuICAgICAgICAgICAgcmV0dXJuVmFsdWUuZW1pdCgnZGVuaWVkJywgY2xvbmUoZXJyb3IpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNoYW5nZWREb2NzLnB1c2goZG9jKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICByZXN1bHQuZG9jX3dyaXRlX2ZhaWx1cmVzICs9IGRvY3MubGVuZ3RoO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZmluaXNoQmF0Y2goKSB7XG4gICAgaWYgKGN1cnJlbnRCYXRjaC5lcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGVyZSB3YXMgYSBwcm9ibGVtIGdldHRpbmcgZG9jcy4nKTtcbiAgICB9XG4gICAgcmVzdWx0Lmxhc3Rfc2VxID0gbGFzdF9zZXEgPSBjdXJyZW50QmF0Y2guc2VxO1xuICAgIHZhciBvdXRSZXN1bHQgPSBjbG9uZShyZXN1bHQpO1xuICAgIGlmIChjaGFuZ2VkRG9jcy5sZW5ndGgpIHtcbiAgICAgIG91dFJlc3VsdC5kb2NzID0gY2hhbmdlZERvY3M7XG4gICAgICAvLyBBdHRhY2ggJ3BlbmRpbmcnIHByb3BlcnR5IGlmIHNlcnZlciBzdXBwb3J0cyBpdCAoQ291Y2hEQiAyLjArKVxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAodHlwZW9mIGN1cnJlbnRCYXRjaC5wZW5kaW5nID09PSAnbnVtYmVyJykge1xuICAgICAgICBvdXRSZXN1bHQucGVuZGluZyA9IGN1cnJlbnRCYXRjaC5wZW5kaW5nO1xuICAgICAgICBkZWxldGUgY3VycmVudEJhdGNoLnBlbmRpbmc7XG4gICAgICB9XG4gICAgICByZXR1cm5WYWx1ZS5lbWl0KCdjaGFuZ2UnLCBvdXRSZXN1bHQpO1xuICAgIH1cbiAgICB3cml0aW5nQ2hlY2twb2ludCA9IHRydWU7XG5cbiAgICBzcmMuaW5mbygpLnRoZW4oZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgIHZhciB0YXNrID0gc3JjLmFjdGl2ZVRhc2tzLmdldCh0YXNrSWQpO1xuICAgICAgaWYgKCFjdXJyZW50QmF0Y2ggfHwgIXRhc2spIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgY29tcGxldGVkID0gdGFzay5jb21wbGV0ZWRfaXRlbXMgfHwgMDtcbiAgICAgIHZhciB0b3RhbF9pdGVtcyA9IHBhcnNlSW50KGluZm8udXBkYXRlX3NlcSwgMTApIC0gcGFyc2VJbnQoaW5pdGlhbF9sYXN0X3NlcSwgMTApO1xuICAgICAgc3JjLmFjdGl2ZVRhc2tzLnVwZGF0ZSh0YXNrSWQsIHtcbiAgICAgICAgY29tcGxldGVkX2l0ZW1zOiBjb21wbGV0ZWQgKyBjdXJyZW50QmF0Y2guY2hhbmdlcy5sZW5ndGgsXG4gICAgICAgIHRvdGFsX2l0ZW1zXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBjaGVja3BvaW50ZXIud3JpdGVDaGVja3BvaW50KGN1cnJlbnRCYXRjaC5zZXEsXG4gICAgICAgIHNlc3Npb24pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuVmFsdWUuZW1pdCgnY2hlY2twb2ludCcsIHsgJ2NoZWNrcG9pbnQnOiBjdXJyZW50QmF0Y2guc2VxIH0pO1xuICAgICAgd3JpdGluZ0NoZWNrcG9pbnQgPSBmYWxzZTtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKHJldHVyblZhbHVlLmNhbmNlbGxlZCkge1xuICAgICAgICBjb21wbGV0ZVJlcGxpY2F0aW9uKCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY2FuY2VsbGVkJyk7XG4gICAgICB9XG4gICAgICBjdXJyZW50QmF0Y2ggPSB1bmRlZmluZWQ7XG4gICAgICBnZXRDaGFuZ2VzKCk7XG4gICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgb25DaGVja3BvaW50RXJyb3IoZXJyKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldERpZmZzKCkge1xuICAgIHZhciBkaWZmID0ge307XG4gICAgY3VycmVudEJhdGNoLmNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAoY2hhbmdlKSB7XG4gICAgICByZXR1cm5WYWx1ZS5lbWl0KCdjaGVja3BvaW50JywgeyAncmV2c19kaWZmJzogY2hhbmdlIH0pO1xuICAgICAgLy8gQ291Y2hiYXNlIFN5bmMgR2F0ZXdheSBlbWl0cyB0aGVzZSwgYnV0IHdlIGNhbiBpZ25vcmUgdGhlbVxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAoY2hhbmdlLmlkID09PSBcIl91c2VyL1wiKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGRpZmZbY2hhbmdlLmlkXSA9IGNoYW5nZS5jaGFuZ2VzLm1hcChmdW5jdGlvbiAoeCkge1xuICAgICAgICByZXR1cm4geC5yZXY7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGFyZ2V0LnJldnNEaWZmKGRpZmYpLnRoZW4oZnVuY3Rpb24gKGRpZmZzKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgY29tcGxldGVSZXBsaWNhdGlvbigpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbmNlbGxlZCcpO1xuICAgICAgfVxuICAgICAgLy8gY3VycmVudEJhdGNoLmRpZmZzIGVsZW1lbnRzIGFyZSBkZWxldGVkIGFzIHRoZSBkb2N1bWVudHMgYXJlIHdyaXR0ZW5cbiAgICAgIGN1cnJlbnRCYXRjaC5kaWZmcyA9IGRpZmZzO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0QmF0Y2hEb2NzKCkge1xuICAgIHJldHVybiBnZXREb2NzKHNyYywgdGFyZ2V0LCBjdXJyZW50QmF0Y2guZGlmZnMsIHJldHVyblZhbHVlKS50aGVuKGZ1bmN0aW9uIChnb3QpIHtcbiAgICAgIGN1cnJlbnRCYXRjaC5lcnJvciA9ICFnb3Qub2s7XG4gICAgICBnb3QuZG9jcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgZGVsZXRlIGN1cnJlbnRCYXRjaC5kaWZmc1tkb2MuX2lkXTtcbiAgICAgICAgcmVzdWx0LmRvY3NfcmVhZCsrO1xuICAgICAgICBjdXJyZW50QmF0Y2guZG9jcy5wdXNoKGRvYyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXJ0TmV4dEJhdGNoKCkge1xuICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQgfHwgY3VycmVudEJhdGNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChiYXRjaGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcHJvY2Vzc1BlbmRpbmdCYXRjaCh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY3VycmVudEJhdGNoID0gYmF0Y2hlcy5zaGlmdCgpO1xuICAgIHJldHVyblZhbHVlLmVtaXQoJ2NoZWNrcG9pbnQnLCB7ICdzdGFydF9uZXh0X2JhdGNoJzogY3VycmVudEJhdGNoLnNlcSB9KTtcbiAgICBnZXREaWZmcygpXG4gICAgICAudGhlbihnZXRCYXRjaERvY3MpXG4gICAgICAudGhlbih3cml0ZURvY3MpXG4gICAgICAudGhlbihmaW5pc2hCYXRjaClcbiAgICAgIC50aGVuKHN0YXJ0TmV4dEJhdGNoKVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgYWJvcnRSZXBsaWNhdGlvbignYmF0Y2ggcHJvY2Vzc2luZyB0ZXJtaW5hdGVkIHdpdGggZXJyb3InLCBlcnIpO1xuICAgICAgfSk7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIHByb2Nlc3NQZW5kaW5nQmF0Y2goaW1tZWRpYXRlKSB7XG4gICAgaWYgKHBlbmRpbmdCYXRjaC5jaGFuZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKGJhdGNoZXMubGVuZ3RoID09PSAwICYmICFjdXJyZW50QmF0Y2gpIHtcbiAgICAgICAgaWYgKChjb250aW51b3VzICYmIGNoYW5nZXNPcHRzLmxpdmUpIHx8IGNoYW5nZXNDb21wbGV0ZWQpIHtcbiAgICAgICAgICByZXR1cm5WYWx1ZS5zdGF0ZSA9ICdwZW5kaW5nJztcbiAgICAgICAgICByZXR1cm5WYWx1ZS5lbWl0KCdwYXVzZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbmdlc0NvbXBsZXRlZCkge1xuICAgICAgICAgIGNvbXBsZXRlUmVwbGljYXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICBpbW1lZGlhdGUgfHxcbiAgICAgIGNoYW5nZXNDb21wbGV0ZWQgfHxcbiAgICAgIHBlbmRpbmdCYXRjaC5jaGFuZ2VzLmxlbmd0aCA+PSBiYXRjaF9zaXplXG4gICAgKSB7XG4gICAgICBiYXRjaGVzLnB1c2gocGVuZGluZ0JhdGNoKTtcbiAgICAgIHBlbmRpbmdCYXRjaCA9IHtcbiAgICAgICAgc2VxOiAwLFxuICAgICAgICBjaGFuZ2VzOiBbXSxcbiAgICAgICAgZG9jczogW11cbiAgICAgIH07XG4gICAgICBpZiAocmV0dXJuVmFsdWUuc3RhdGUgPT09ICdwZW5kaW5nJyB8fCByZXR1cm5WYWx1ZS5zdGF0ZSA9PT0gJ3N0b3BwZWQnKSB7XG4gICAgICAgIHJldHVyblZhbHVlLnN0YXRlID0gJ2FjdGl2ZSc7XG4gICAgICAgIHJldHVyblZhbHVlLmVtaXQoJ2FjdGl2ZScpO1xuICAgICAgfVxuICAgICAgc3RhcnROZXh0QmF0Y2goKTtcbiAgICB9XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGFib3J0UmVwbGljYXRpb24ocmVhc29uLCBlcnIpIHtcbiAgICBpZiAocmVwbGljYXRpb25Db21wbGV0ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCFlcnIubWVzc2FnZSkge1xuICAgICAgZXJyLm1lc3NhZ2UgPSByZWFzb247XG4gICAgfVxuICAgIHJlc3VsdC5vayA9IGZhbHNlO1xuICAgIHJlc3VsdC5zdGF0dXMgPSAnYWJvcnRpbmcnO1xuICAgIGJhdGNoZXMgPSBbXTtcbiAgICBwZW5kaW5nQmF0Y2ggPSB7XG4gICAgICBzZXE6IDAsXG4gICAgICBjaGFuZ2VzOiBbXSxcbiAgICAgIGRvY3M6IFtdXG4gICAgfTtcbiAgICBjb21wbGV0ZVJlcGxpY2F0aW9uKGVycik7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGNvbXBsZXRlUmVwbGljYXRpb24oZmF0YWxFcnJvcikge1xuICAgIGlmIChyZXBsaWNhdGlvbkNvbXBsZXRlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAocmV0dXJuVmFsdWUuY2FuY2VsbGVkKSB7XG4gICAgICByZXN1bHQuc3RhdHVzID0gJ2NhbmNlbGxlZCc7XG4gICAgICBpZiAod3JpdGluZ0NoZWNrcG9pbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICByZXN1bHQuc3RhdHVzID0gcmVzdWx0LnN0YXR1cyB8fCAnY29tcGxldGUnO1xuICAgIHJlc3VsdC5lbmRfdGltZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICByZXN1bHQubGFzdF9zZXEgPSBsYXN0X3NlcTtcbiAgICByZXBsaWNhdGlvbkNvbXBsZXRlZCA9IHRydWU7XG5cbiAgICBzcmMuYWN0aXZlVGFza3MucmVtb3ZlKHRhc2tJZCwgZmF0YWxFcnJvcik7XG5cbiAgICBpZiAoZmF0YWxFcnJvcikge1xuICAgICAgLy8gbmVlZCB0byBleHRlbmQgdGhlIGVycm9yIGJlY2F1c2UgRmlyZWZveCBjb25zaWRlcnMgXCIucmVzdWx0XCIgcmVhZC1vbmx5XG4gICAgICBmYXRhbEVycm9yID0gY3JlYXRlRXJyb3IoZmF0YWxFcnJvcik7XG4gICAgICBmYXRhbEVycm9yLnJlc3VsdCA9IHJlc3VsdDtcblxuICAgICAgLy8gTm9ybWFsaXplIGVycm9yIG5hbWUuIGkuZS4gJ1VuYXV0aG9yaXplZCcgLT4gJ3VuYXV0aG9yaXplZCcgKGVnIFN5bmMgR2F0ZXdheSlcbiAgICAgIHZhciBlcnJvck5hbWUgPSAoZmF0YWxFcnJvci5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKGVycm9yTmFtZSA9PT0gJ3VuYXV0aG9yaXplZCcgfHwgZXJyb3JOYW1lID09PSAnZm9yYmlkZGVuJykge1xuICAgICAgICByZXR1cm5WYWx1ZS5lbWl0KCdlcnJvcicsIGZhdGFsRXJyb3IpO1xuICAgICAgICByZXR1cm5WYWx1ZS5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJhY2tPZmYob3B0cywgcmV0dXJuVmFsdWUsIGZhdGFsRXJyb3IsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXBsaWNhdGUoc3JjLCB0YXJnZXQsIG9wdHMsIHJldHVyblZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVyblZhbHVlLmVtaXQoJ2NvbXBsZXRlJywgcmVzdWx0KTtcbiAgICAgIHJldHVyblZhbHVlLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uQ2hhbmdlKGNoYW5nZSwgcGVuZGluZywgbGFzdFNlcSkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgIHJldHVybiBjb21wbGV0ZVJlcGxpY2F0aW9uKCk7XG4gICAgfVxuICAgIC8vIEF0dGFjaCAncGVuZGluZycgcHJvcGVydHkgaWYgc2VydmVyIHN1cHBvcnRzIGl0IChDb3VjaERCIDIuMCspXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHR5cGVvZiBwZW5kaW5nID09PSAnbnVtYmVyJykge1xuICAgICAgcGVuZGluZ0JhdGNoLnBlbmRpbmcgPSBwZW5kaW5nO1xuICAgIH1cblxuICAgIHZhciBmaWx0ZXIgPSBmaWx0ZXJDaGFuZ2Uob3B0cykoY2hhbmdlKTtcbiAgICBpZiAoIWZpbHRlcikge1xuICAgICAgLy8gdXBkYXRlIHByb2Nlc3NlZCBpdGVtcyBjb3VudCBieSAxXG4gICAgICB2YXIgdGFzayA9IHNyYy5hY3RpdmVUYXNrcy5nZXQodGFza0lkKTtcbiAgICAgIGlmICh0YXNrKSB7XG4gICAgICAgIC8vIHdlIGNhbiBhc3N1bWUgdGhhdCB0YXNrIGV4aXN0cyBoZXJlPyBzaG91bGRuJ3QgYmUgZGVsZXRlZCBieSBoZXJlLlxuICAgICAgICB2YXIgY29tcGxldGVkID0gdGFzay5jb21wbGV0ZWRfaXRlbXMgfHwgMDtcbiAgICAgICAgc3JjLmFjdGl2ZVRhc2tzLnVwZGF0ZSh0YXNrSWQsIHtjb21wbGV0ZWRfaXRlbXM6ICsrY29tcGxldGVkfSk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHBlbmRpbmdCYXRjaC5zZXEgPSBjaGFuZ2Uuc2VxIHx8IGxhc3RTZXE7XG4gICAgcGVuZGluZ0JhdGNoLmNoYW5nZXMucHVzaChjaGFuZ2UpO1xuICAgIHJldHVyblZhbHVlLmVtaXQoJ2NoZWNrcG9pbnQnLCB7ICdwZW5kaW5nX2JhdGNoJzogcGVuZGluZ0JhdGNoLnNlcSB9KTtcbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBwcm9jZXNzUGVuZGluZ0JhdGNoKGJhdGNoZXMubGVuZ3RoID09PSAwICYmIGNoYW5nZXNPcHRzLmxpdmUpO1xuICAgIH0pO1xuICB9XG5cblxuICBmdW5jdGlvbiBvbkNoYW5nZXNDb21wbGV0ZShjaGFuZ2VzKSB7XG4gICAgY2hhbmdlc1BlbmRpbmcgPSBmYWxzZTtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAocmV0dXJuVmFsdWUuY2FuY2VsbGVkKSB7XG4gICAgICByZXR1cm4gY29tcGxldGVSZXBsaWNhdGlvbigpO1xuICAgIH1cblxuICAgIC8vIGlmIG5vIHJlc3VsdHMgd2VyZSByZXR1cm5lZCB0aGVuIHdlJ3JlIGRvbmUsXG4gICAgLy8gZWxzZSBmZXRjaCBtb3JlXG4gICAgaWYgKGNoYW5nZXMucmVzdWx0cy5sZW5ndGggPiAwKSB7XG4gICAgICBjaGFuZ2VzT3B0cy5zaW5jZSA9IGNoYW5nZXMucmVzdWx0c1tjaGFuZ2VzLnJlc3VsdHMubGVuZ3RoIC0gMV0uc2VxO1xuICAgICAgZ2V0Q2hhbmdlcygpO1xuICAgICAgcHJvY2Vzc1BlbmRpbmdCYXRjaCh0cnVlKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICB2YXIgY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChjb250aW51b3VzKSB7XG4gICAgICAgICAgY2hhbmdlc09wdHMubGl2ZSA9IHRydWU7XG4gICAgICAgICAgZ2V0Q2hhbmdlcygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNoYW5nZXNDb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHByb2Nlc3NQZW5kaW5nQmF0Y2godHJ1ZSk7XG4gICAgICB9O1xuXG4gICAgICAvLyB1cGRhdGUgdGhlIGNoZWNrcG9pbnQgc28gd2Ugc3RhcnQgZnJvbSB0aGUgcmlnaHQgc2VxIG5leHQgdGltZVxuICAgICAgaWYgKCFjdXJyZW50QmF0Y2ggJiYgY2hhbmdlcy5yZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB3cml0aW5nQ2hlY2twb2ludCA9IHRydWU7XG4gICAgICAgIGNoZWNrcG9pbnRlci53cml0ZUNoZWNrcG9pbnQoY2hhbmdlcy5sYXN0X3NlcSxcbiAgICAgICAgICAgIHNlc3Npb24pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHdyaXRpbmdDaGVja3BvaW50ID0gZmFsc2U7XG4gICAgICAgICAgcmVzdWx0Lmxhc3Rfc2VxID0gbGFzdF9zZXEgPSBjaGFuZ2VzLmxhc3Rfc2VxO1xuICAgICAgICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgICAgIGNvbXBsZXRlUmVwbGljYXRpb24oKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY2FuY2VsbGVkJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbXBsZXRlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2gob25DaGVja3BvaW50RXJyb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcGxldGUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIGZ1bmN0aW9uIG9uQ2hhbmdlc0Vycm9yKGVycikge1xuICAgIGNoYW5nZXNQZW5kaW5nID0gZmFsc2U7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHJldHVyblZhbHVlLmNhbmNlbGxlZCkge1xuICAgICAgcmV0dXJuIGNvbXBsZXRlUmVwbGljYXRpb24oKTtcbiAgICB9XG4gICAgYWJvcnRSZXBsaWNhdGlvbignY2hhbmdlcyByZWplY3RlZCcsIGVycik7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGdldENoYW5nZXMoKSB7XG4gICAgaWYgKCEoXG4gICAgICAhY2hhbmdlc1BlbmRpbmcgJiZcbiAgICAgICFjaGFuZ2VzQ29tcGxldGVkICYmXG4gICAgICBiYXRjaGVzLmxlbmd0aCA8IGJhdGNoZXNfbGltaXRcbiAgICAgICkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2hhbmdlc1BlbmRpbmcgPSB0cnVlO1xuICAgIGZ1bmN0aW9uIGFib3J0Q2hhbmdlcygpIHtcbiAgICAgIGNoYW5nZXMuY2FuY2VsKCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlbW92ZUxpc3RlbmVyKCkge1xuICAgICAgcmV0dXJuVmFsdWUucmVtb3ZlTGlzdGVuZXIoJ2NhbmNlbCcsIGFib3J0Q2hhbmdlcyk7XG4gICAgfVxuXG4gICAgaWYgKHJldHVyblZhbHVlLl9jaGFuZ2VzKSB7IC8vIHJlbW92ZSBvbGQgY2hhbmdlcygpIGFuZCBsaXN0ZW5lcnNcbiAgICAgIHJldHVyblZhbHVlLnJlbW92ZUxpc3RlbmVyKCdjYW5jZWwnLCByZXR1cm5WYWx1ZS5fYWJvcnRDaGFuZ2VzKTtcbiAgICAgIHJldHVyblZhbHVlLl9jaGFuZ2VzLmNhbmNlbCgpO1xuICAgIH1cbiAgICByZXR1cm5WYWx1ZS5vbmNlKCdjYW5jZWwnLCBhYm9ydENoYW5nZXMpO1xuXG4gICAgdmFyIGNoYW5nZXMgPSBzcmMuY2hhbmdlcyhjaGFuZ2VzT3B0cylcbiAgICAgIC5vbignY2hhbmdlJywgb25DaGFuZ2UpO1xuICAgIGNoYW5nZXMudGhlbihyZW1vdmVMaXN0ZW5lciwgcmVtb3ZlTGlzdGVuZXIpO1xuICAgIGNoYW5nZXMudGhlbihvbkNoYW5nZXNDb21wbGV0ZSlcbiAgICAgIC5jYXRjaChvbkNoYW5nZXNFcnJvcik7XG5cbiAgICBpZiAob3B0cy5yZXRyeSkge1xuICAgICAgLy8gc2F2ZSBmb3IgbGF0ZXIgc28gd2UgY2FuIGNhbmNlbCBpZiBuZWNlc3NhcnlcbiAgICAgIHJldHVyblZhbHVlLl9jaGFuZ2VzID0gY2hhbmdlcztcbiAgICAgIHJldHVyblZhbHVlLl9hYm9ydENoYW5nZXMgPSBhYm9ydENoYW5nZXM7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlVGFzayhjaGVja3BvaW50KSB7XG4gICAgcmV0dXJuIHNyYy5pbmZvKCkudGhlbihmdW5jdGlvbiAoaW5mbykge1xuICAgICAgdmFyIHRvdGFsX2l0ZW1zID0gdHlwZW9mIG9wdHMuc2luY2UgPT09ICd1bmRlZmluZWQnID9cbiAgICAgICAgcGFyc2VJbnQoaW5mby51cGRhdGVfc2VxLCAxMCkgLSBwYXJzZUludChjaGVja3BvaW50LCAxMCkgOlxuICAgICAgICBwYXJzZUludChpbmZvLnVwZGF0ZV9zZXEsIDEwKTtcblxuICAgICAgdGFza0lkID0gc3JjLmFjdGl2ZVRhc2tzLmFkZCh7XG4gICAgICAgIG5hbWU6IGAke2NvbnRpbnVvdXMgPyAnY29udGludW91cyAnIDogJyd9cmVwbGljYXRpb24gZnJvbSAke2luZm8uZGJfbmFtZX1gICxcbiAgICAgICAgdG90YWxfaXRlbXMsXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNoZWNrcG9pbnQ7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBzdGFydENoYW5nZXMoKSB7XG4gICAgaW5pdENoZWNrcG9pbnRlcigpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAocmV0dXJuVmFsdWUuY2FuY2VsbGVkKSB7XG4gICAgICAgIGNvbXBsZXRlUmVwbGljYXRpb24oKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNoZWNrcG9pbnRlci5nZXRDaGVja3BvaW50KCkudGhlbihjcmVhdGVUYXNrKS50aGVuKGZ1bmN0aW9uIChjaGVja3BvaW50KSB7XG4gICAgICAgIGxhc3Rfc2VxID0gY2hlY2twb2ludDtcbiAgICAgICAgaW5pdGlhbF9sYXN0X3NlcSA9IGNoZWNrcG9pbnQ7XG4gICAgICAgIGNoYW5nZXNPcHRzID0ge1xuICAgICAgICAgIHNpbmNlOiBsYXN0X3NlcSxcbiAgICAgICAgICBsaW1pdDogYmF0Y2hfc2l6ZSxcbiAgICAgICAgICBiYXRjaF9zaXplOiBiYXRjaF9zaXplLFxuICAgICAgICAgIHN0eWxlOiBzdHlsZSxcbiAgICAgICAgICBkb2NfaWRzOiBkb2NfaWRzLFxuICAgICAgICAgIHNlbGVjdG9yOiBzZWxlY3RvcixcbiAgICAgICAgICByZXR1cm5fZG9jczogdHJ1ZSAvLyByZXF1aXJlZCBzbyB3ZSBrbm93IHdoZW4gd2UncmUgZG9uZVxuICAgICAgICB9O1xuICAgICAgICBpZiAob3B0cy5maWx0ZXIpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIG9wdHMuZmlsdGVyICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gcmVxdWlyZWQgZm9yIHRoZSBjbGllbnQtc2lkZSBmaWx0ZXIgaW4gb25DaGFuZ2VcbiAgICAgICAgICAgIGNoYW5nZXNPcHRzLmluY2x1ZGVfZG9jcyA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHsgLy8gZGRvYyBmaWx0ZXJcbiAgICAgICAgICAgIGNoYW5nZXNPcHRzLmZpbHRlciA9IG9wdHMuZmlsdGVyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoJ2hlYXJ0YmVhdCcgaW4gb3B0cykge1xuICAgICAgICAgIGNoYW5nZXNPcHRzLmhlYXJ0YmVhdCA9IG9wdHMuaGVhcnRiZWF0O1xuICAgICAgICB9XG4gICAgICAgIGlmICgndGltZW91dCcgaW4gb3B0cykge1xuICAgICAgICAgIGNoYW5nZXNPcHRzLnRpbWVvdXQgPSBvcHRzLnRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdHMucXVlcnlfcGFyYW1zKSB7XG4gICAgICAgICAgY2hhbmdlc09wdHMucXVlcnlfcGFyYW1zID0gb3B0cy5xdWVyeV9wYXJhbXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdHMudmlldykge1xuICAgICAgICAgIGNoYW5nZXNPcHRzLnZpZXcgPSBvcHRzLnZpZXc7XG4gICAgICAgIH1cbiAgICAgICAgZ2V0Q2hhbmdlcygpO1xuICAgICAgfSk7XG4gICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgYWJvcnRSZXBsaWNhdGlvbignZ2V0Q2hlY2twb2ludCByZWplY3RlZCB3aXRoICcsIGVycik7XG4gICAgfSk7XG4gIH1cblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBmdW5jdGlvbiBvbkNoZWNrcG9pbnRFcnJvcihlcnIpIHtcbiAgICB3cml0aW5nQ2hlY2twb2ludCA9IGZhbHNlO1xuICAgIGFib3J0UmVwbGljYXRpb24oJ3dyaXRlQ2hlY2twb2ludCBjb21wbGV0ZWQgd2l0aCBlcnJvcicsIGVycik7XG4gIH1cblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKHJldHVyblZhbHVlLmNhbmNlbGxlZCkgeyAvLyBjYW5jZWxsZWQgaW1tZWRpYXRlbHlcbiAgICBjb21wbGV0ZVJlcGxpY2F0aW9uKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCFyZXR1cm5WYWx1ZS5fYWRkZWRMaXN0ZW5lcnMpIHtcbiAgICByZXR1cm5WYWx1ZS5vbmNlKCdjYW5jZWwnLCBjb21wbGV0ZVJlcGxpY2F0aW9uKTtcblxuICAgIGlmICh0eXBlb2Ygb3B0cy5jb21wbGV0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuVmFsdWUub25jZSgnZXJyb3InLCBvcHRzLmNvbXBsZXRlKTtcbiAgICAgIHJldHVyblZhbHVlLm9uY2UoJ2NvbXBsZXRlJywgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICBvcHRzLmNvbXBsZXRlKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuVmFsdWUuX2FkZGVkTGlzdGVuZXJzID0gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb3B0cy5zaW5jZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzdGFydENoYW5nZXMoKTtcbiAgfSBlbHNlIHtcbiAgICBpbml0Q2hlY2twb2ludGVyKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICB3cml0aW5nQ2hlY2twb2ludCA9IHRydWU7XG4gICAgICByZXR1cm4gY2hlY2twb2ludGVyLndyaXRlQ2hlY2twb2ludChvcHRzLnNpbmNlLCBzZXNzaW9uKTtcbiAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgIHdyaXRpbmdDaGVja3BvaW50ID0gZmFsc2U7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgY29tcGxldGVSZXBsaWNhdGlvbigpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBsYXN0X3NlcSA9IG9wdHMuc2luY2U7XG4gICAgICBzdGFydENoYW5nZXMoKTtcbiAgICB9KS5jYXRjaChvbkNoZWNrcG9pbnRFcnJvcik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgcmVwbGljYXRlO1xuIiwiaW1wb3J0IEVFIGZyb20gJ2V2ZW50cyc7XG5cbi8vIFdlIGNyZWF0ZSBhIGJhc2ljIHByb21pc2Ugc28gdGhlIGNhbGxlciBjYW4gY2FuY2VsIHRoZSByZXBsaWNhdGlvbiBwb3NzaWJseVxuLy8gYmVmb3JlIHdlIGhhdmUgYWN0dWFsbHkgc3RhcnRlZCBsaXN0ZW5pbmcgdG8gY2hhbmdlcyBldGNcbmNsYXNzIFJlcGxpY2F0aW9uIGV4dGVuZHMgRUUge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuY2FuY2VsbGVkID0gZmFsc2U7XG4gICAgdGhpcy5zdGF0ZSA9ICdwZW5kaW5nJztcbiAgICBjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2UoKGZ1bGZpbGwsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5vbmNlKCdjb21wbGV0ZScsIGZ1bGZpbGwpO1xuICAgICAgdGhpcy5vbmNlKCdlcnJvcicsIHJlamVjdCk7XG4gICAgfSk7XG4gICAgdGhpcy50aGVuID0gZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmV0dXJuIHByb21pc2UudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgIH07XG4gICAgdGhpcy5jYXRjaCA9IGZ1bmN0aW9uIChyZWplY3QpIHtcbiAgICAgIHJldHVybiBwcm9taXNlLmNhdGNoKHJlamVjdCk7XG4gICAgfTtcbiAgICAvLyBBcyB3ZSBhbGxvdyBlcnJvciBoYW5kbGluZyB2aWEgXCJlcnJvclwiIGV2ZW50IGFzIHdlbGwsXG4gICAgLy8gcHV0IGEgc3R1YiBpbiBoZXJlIHNvIHRoYXQgcmVqZWN0aW5nIG5ldmVyIHRocm93cyBVbmhhbmRsZWRFcnJvci5cbiAgICB0aGlzLmNhdGNoKGZ1bmN0aW9uICgpIHt9KTtcbiAgfVxuXG4gIGNhbmNlbCgpIHtcbiAgICB0aGlzLmNhbmNlbGxlZCA9IHRydWU7XG4gICAgdGhpcy5zdGF0ZSA9ICdjYW5jZWxsZWQnO1xuICAgIHRoaXMuZW1pdCgnY2FuY2VsJyk7XG4gIH1cblxuICByZWFkeShzcmMsIHRhcmdldCkge1xuICAgIGlmICh0aGlzLl9yZWFkeUNhbGxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9yZWFkeUNhbGxlZCA9IHRydWU7XG4gIFxuICAgIGNvbnN0IG9uRGVzdHJveSA9ICgpID0+IHtcbiAgICAgIHRoaXMuY2FuY2VsKCk7XG4gICAgfTtcbiAgICBzcmMub25jZSgnZGVzdHJveWVkJywgb25EZXN0cm95KTtcbiAgICB0YXJnZXQub25jZSgnZGVzdHJveWVkJywgb25EZXN0cm95KTtcbiAgICBmdW5jdGlvbiBjbGVhbnVwKCkge1xuICAgICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdkZXN0cm95ZWQnLCBvbkRlc3Ryb3kpO1xuICAgICAgdGFyZ2V0LnJlbW92ZUxpc3RlbmVyKCdkZXN0cm95ZWQnLCBvbkRlc3Ryb3kpO1xuICAgIH1cbiAgICB0aGlzLm9uY2UoJ2NvbXBsZXRlJywgY2xlYW51cCk7XG4gICAgdGhpcy5vbmNlKCdlcnJvcicsIGNsZWFudXApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFJlcGxpY2F0aW9uO1xuIiwiaW1wb3J0IHJlcGxpY2F0ZSBmcm9tICcuL3JlcGxpY2F0ZSc7XG5pbXBvcnQgUmVwbGljYXRpb24gZnJvbSAnLi9yZXBsaWNhdGlvbic7XG5pbXBvcnQgeyBjbG9uZSB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHsgY3JlYXRlRXJyb3IsIEJBRF9SRVFVRVNUIH0gZnJvbSAncG91Y2hkYi1lcnJvcnMnO1xuXG5mdW5jdGlvbiB0b1BvdWNoKGRiLCBvcHRzKSB7XG4gIHZhciBQb3VjaENvbnN0cnVjdG9yID0gb3B0cy5Qb3VjaENvbnN0cnVjdG9yO1xuICBpZiAodHlwZW9mIGRiID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBuZXcgUG91Y2hDb25zdHJ1Y3RvcihkYiwgb3B0cyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRiO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlcGxpY2F0ZVdyYXBwZXIoc3JjLCB0YXJnZXQsIG9wdHMsIGNhbGxiYWNrKSB7XG5cbiAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgIG9wdHMgPSB7fTtcbiAgfVxuICBpZiAodHlwZW9mIG9wdHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgb3B0cyA9IHt9O1xuICB9XG5cbiAgaWYgKG9wdHMuZG9jX2lkcyAmJiAhQXJyYXkuaXNBcnJheShvcHRzLmRvY19pZHMpKSB7XG4gICAgdGhyb3cgY3JlYXRlRXJyb3IoQkFEX1JFUVVFU1QsXG4gICAgICAgICAgICAgICAgICAgICAgIFwiYGRvY19pZHNgIGZpbHRlciBwYXJhbWV0ZXIgaXMgbm90IGEgbGlzdC5cIik7XG4gIH1cblxuICBvcHRzLmNvbXBsZXRlID0gY2FsbGJhY2s7XG4gIG9wdHMgPSBjbG9uZShvcHRzKTtcbiAgb3B0cy5jb250aW51b3VzID0gb3B0cy5jb250aW51b3VzIHx8IG9wdHMubGl2ZTtcbiAgb3B0cy5yZXRyeSA9ICgncmV0cnknIGluIG9wdHMpID8gb3B0cy5yZXRyeSA6IGZhbHNlO1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICBvcHRzLlBvdWNoQ29uc3RydWN0b3IgPSBvcHRzLlBvdWNoQ29uc3RydWN0b3IgfHwgdGhpcztcbiAgdmFyIHJlcGxpY2F0ZVJldCA9IG5ldyBSZXBsaWNhdGlvbihvcHRzKTtcbiAgdmFyIHNyY1BvdWNoID0gdG9Qb3VjaChzcmMsIG9wdHMpO1xuICB2YXIgdGFyZ2V0UG91Y2ggPSB0b1BvdWNoKHRhcmdldCwgb3B0cyk7XG4gIHJlcGxpY2F0ZShzcmNQb3VjaCwgdGFyZ2V0UG91Y2gsIG9wdHMsIHJlcGxpY2F0ZVJldCk7XG4gIHJldHVybiByZXBsaWNhdGVSZXQ7XG59XG5cbmV4cG9ydCB7XG4gIHJlcGxpY2F0ZVdyYXBwZXIgYXMgcmVwbGljYXRlLFxuICB0b1BvdWNoXG59OyIsIlxuaW1wb3J0IHtcbiAgcmVwbGljYXRlLFxuICB0b1BvdWNoXG59IGZyb20gJy4vcmVwbGljYXRlV3JhcHBlcic7XG5pbXBvcnQgRUUgZnJvbSAnZXZlbnRzJztcbmltcG9ydCB7IGNsb25lIH0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5cbmV4cG9ydCBkZWZhdWx0IHN5bmM7XG5mdW5jdGlvbiBzeW5jKHNyYywgdGFyZ2V0LCBvcHRzLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgb3B0cyA9IHt9O1xuICB9XG4gIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBvcHRzID0ge307XG4gIH1cbiAgb3B0cyA9IGNsb25lKG9wdHMpO1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICBvcHRzLlBvdWNoQ29uc3RydWN0b3IgPSBvcHRzLlBvdWNoQ29uc3RydWN0b3IgfHwgdGhpcztcbiAgc3JjID0gdG9Qb3VjaChzcmMsIG9wdHMpO1xuICB0YXJnZXQgPSB0b1BvdWNoKHRhcmdldCwgb3B0cyk7XG4gIHJldHVybiBuZXcgU3luYyhzcmMsIHRhcmdldCwgb3B0cywgY2FsbGJhY2spO1xufVxuXG5jbGFzcyBTeW5jIGV4dGVuZHMgRUUge1xuICBjb25zdHJ1Y3RvcihzcmMsIHRhcmdldCwgb3B0cywgY2FsbGJhY2spIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuY2FuY2VsZWQgPSBmYWxzZTtcblxuICAgIGNvbnN0IG9wdHNQdXNoID0gb3B0cy5wdXNoID8gT2JqZWN0LmFzc2lnbih7fSwgb3B0cywgb3B0cy5wdXNoKSA6IG9wdHM7XG4gICAgY29uc3Qgb3B0c1B1bGwgPSBvcHRzLnB1bGwgPyBPYmplY3QuYXNzaWduKHt9LCBvcHRzLCBvcHRzLnB1bGwpIDogb3B0cztcblxuICAgIHRoaXMucHVzaCA9IHJlcGxpY2F0ZShzcmMsIHRhcmdldCwgb3B0c1B1c2gpO1xuICAgIHRoaXMucHVsbCA9IHJlcGxpY2F0ZSh0YXJnZXQsIHNyYywgb3B0c1B1bGwpO1xuXG4gICAgdGhpcy5wdXNoUGF1c2VkID0gdHJ1ZTtcbiAgICB0aGlzLnB1bGxQYXVzZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgcHVsbENoYW5nZSA9IChjaGFuZ2UpID0+IHtcbiAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICBkaXJlY3Rpb246ICdwdWxsJyxcbiAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgIH0pO1xuICAgIH07XG4gICAgY29uc3QgcHVzaENoYW5nZSA9IChjaGFuZ2UpID0+IHtcbiAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICBkaXJlY3Rpb246ICdwdXNoJyxcbiAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgIH0pO1xuICAgIH07XG4gICAgY29uc3QgcHVzaERlbmllZCA9IChkb2MpID0+IHtcbiAgICAgIHRoaXMuZW1pdCgnZGVuaWVkJywge1xuICAgICAgICBkaXJlY3Rpb246ICdwdXNoJyxcbiAgICAgICAgZG9jOiBkb2NcbiAgICAgIH0pO1xuICAgIH07XG4gICAgY29uc3QgcHVsbERlbmllZCA9IChkb2MpID0+IHtcbiAgICAgIHRoaXMuZW1pdCgnZGVuaWVkJywge1xuICAgICAgICBkaXJlY3Rpb246ICdwdWxsJyxcbiAgICAgICAgZG9jOiBkb2NcbiAgICAgIH0pO1xuICAgIH07XG4gICAgY29uc3QgcHVzaFBhdXNlZCA9ICgpID0+IHtcbiAgICAgIHRoaXMucHVzaFBhdXNlZCA9IHRydWU7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmICh0aGlzLnB1bGxQYXVzZWQpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdwYXVzZWQnKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGNvbnN0IHB1bGxQYXVzZWQgPSAoKSA9PiB7XG4gICAgICB0aGlzLnB1bGxQYXVzZWQgPSB0cnVlO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAodGhpcy5wdXNoUGF1c2VkKSB7XG4gICAgICAgIHRoaXMuZW1pdCgncGF1c2VkJyk7XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBwdXNoQWN0aXZlID0gKCkgPT4ge1xuICAgICAgdGhpcy5wdXNoUGF1c2VkID0gZmFsc2U7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmICh0aGlzLnB1bGxQYXVzZWQpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdhY3RpdmUnLCB7XG4gICAgICAgICAgZGlyZWN0aW9uOiAncHVzaCdcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBwdWxsQWN0aXZlID0gKCkgPT4ge1xuICAgICAgdGhpcy5wdWxsUGF1c2VkID0gZmFsc2U7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmICh0aGlzLnB1c2hQYXVzZWQpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdhY3RpdmUnLCB7XG4gICAgICAgICAgZGlyZWN0aW9uOiAncHVsbCdcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxldCByZW1vdmVkID0ge307XG5cbiAgICBjb25zdCByZW1vdmVBbGwgPSAodHlwZSkgPT4geyAvLyB0eXBlIGlzICdwdXNoJyBvciAncHVsbCdcbiAgICAgIHJldHVybiAoZXZlbnQsIGZ1bmMpID0+IHtcbiAgICAgICAgY29uc3QgaXNDaGFuZ2UgPSBldmVudCA9PT0gJ2NoYW5nZScgJiZcbiAgICAgICAgICAoZnVuYyA9PT0gcHVsbENoYW5nZSB8fCBmdW5jID09PSBwdXNoQ2hhbmdlKTtcbiAgICAgICAgY29uc3QgaXNEZW5pZWQgPSBldmVudCA9PT0gJ2RlbmllZCcgJiZcbiAgICAgICAgICAoZnVuYyA9PT0gcHVsbERlbmllZCB8fCBmdW5jID09PSBwdXNoRGVuaWVkKTtcbiAgICAgICAgY29uc3QgaXNQYXVzZWQgPSBldmVudCA9PT0gJ3BhdXNlZCcgJiZcbiAgICAgICAgICAoZnVuYyA9PT0gcHVsbFBhdXNlZCB8fCBmdW5jID09PSBwdXNoUGF1c2VkKTtcbiAgICAgICAgY29uc3QgaXNBY3RpdmUgPSBldmVudCA9PT0gJ2FjdGl2ZScgJiZcbiAgICAgICAgICAoZnVuYyA9PT0gcHVsbEFjdGl2ZSB8fCBmdW5jID09PSBwdXNoQWN0aXZlKTtcblxuICAgICAgICBpZiAoaXNDaGFuZ2UgfHwgaXNEZW5pZWQgfHwgaXNQYXVzZWQgfHwgaXNBY3RpdmUpIHtcbiAgICAgICAgICBpZiAoIShldmVudCBpbiByZW1vdmVkKSkge1xuICAgICAgICAgICAgcmVtb3ZlZFtldmVudF0gPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVtb3ZlZFtldmVudF1bdHlwZV0gPSB0cnVlO1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhyZW1vdmVkW2V2ZW50XSkubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgICAvLyBib3RoIHB1c2ggYW5kIHB1bGwgaGF2ZSBhc2tlZCB0byBiZSByZW1vdmVkXG4gICAgICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhldmVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH07XG5cbiAgICBpZiAob3B0cy5saXZlKSB7XG4gICAgICB0aGlzLnB1c2gub24oJ2NvbXBsZXRlJywgdGhpcy5wdWxsLmNhbmNlbC5iaW5kKHRoaXMucHVsbCkpO1xuICAgICAgdGhpcy5wdWxsLm9uKCdjb21wbGV0ZScsIHRoaXMucHVzaC5jYW5jZWwuYmluZCh0aGlzLnB1c2gpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPbmVMaXN0ZW5lcihlZSwgZXZlbnQsIGxpc3RlbmVyKSB7XG4gICAgICBpZiAoZWUubGlzdGVuZXJzKGV2ZW50KS5pbmRleE9mKGxpc3RlbmVyKSA9PSAtMSkge1xuICAgICAgICBlZS5vbihldmVudCwgbGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMub24oJ25ld0xpc3RlbmVyJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICBpZiAoZXZlbnQgPT09ICdjaGFuZ2UnKSB7XG4gICAgICAgIGFkZE9uZUxpc3RlbmVyKHRoaXMucHVsbCwgJ2NoYW5nZScsIHB1bGxDaGFuZ2UpO1xuICAgICAgICBhZGRPbmVMaXN0ZW5lcih0aGlzLnB1c2gsICdjaGFuZ2UnLCBwdXNoQ2hhbmdlKTtcbiAgICAgIH0gZWxzZSBpZiAoZXZlbnQgPT09ICdkZW5pZWQnKSB7XG4gICAgICAgIGFkZE9uZUxpc3RlbmVyKHRoaXMucHVsbCwgJ2RlbmllZCcsIHB1bGxEZW5pZWQpO1xuICAgICAgICBhZGRPbmVMaXN0ZW5lcih0aGlzLnB1c2gsICdkZW5pZWQnLCBwdXNoRGVuaWVkKTtcbiAgICAgIH0gZWxzZSBpZiAoZXZlbnQgPT09ICdhY3RpdmUnKSB7XG4gICAgICAgIGFkZE9uZUxpc3RlbmVyKHRoaXMucHVsbCwgJ2FjdGl2ZScsIHB1bGxBY3RpdmUpO1xuICAgICAgICBhZGRPbmVMaXN0ZW5lcih0aGlzLnB1c2gsICdhY3RpdmUnLCBwdXNoQWN0aXZlKTtcbiAgICAgIH0gZWxzZSBpZiAoZXZlbnQgPT09ICdwYXVzZWQnKSB7XG4gICAgICAgIGFkZE9uZUxpc3RlbmVyKHRoaXMucHVsbCwgJ3BhdXNlZCcsIHB1bGxQYXVzZWQpO1xuICAgICAgICBhZGRPbmVMaXN0ZW5lcih0aGlzLnB1c2gsICdwYXVzZWQnLCBwdXNoUGF1c2VkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMub24oJ3JlbW92ZUxpc3RlbmVyJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICBpZiAoZXZlbnQgPT09ICdjaGFuZ2UnKSB7XG4gICAgICAgIHRoaXMucHVsbC5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgcHVsbENoYW5nZSk7XG4gICAgICAgIHRoaXMucHVzaC5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgcHVzaENoYW5nZSk7XG4gICAgICB9IGVsc2UgaWYgKGV2ZW50ID09PSAnZGVuaWVkJykge1xuICAgICAgICB0aGlzLnB1bGwucmVtb3ZlTGlzdGVuZXIoJ2RlbmllZCcsIHB1bGxEZW5pZWQpO1xuICAgICAgICB0aGlzLnB1c2gucmVtb3ZlTGlzdGVuZXIoJ2RlbmllZCcsIHB1c2hEZW5pZWQpO1xuICAgICAgfSBlbHNlIGlmIChldmVudCA9PT0gJ2FjdGl2ZScpIHtcbiAgICAgICAgdGhpcy5wdWxsLnJlbW92ZUxpc3RlbmVyKCdhY3RpdmUnLCBwdWxsQWN0aXZlKTtcbiAgICAgICAgdGhpcy5wdXNoLnJlbW92ZUxpc3RlbmVyKCdhY3RpdmUnLCBwdXNoQWN0aXZlKTtcbiAgICAgIH0gZWxzZSBpZiAoZXZlbnQgPT09ICdwYXVzZWQnKSB7XG4gICAgICAgIHRoaXMucHVsbC5yZW1vdmVMaXN0ZW5lcigncGF1c2VkJywgcHVsbFBhdXNlZCk7XG4gICAgICAgIHRoaXMucHVzaC5yZW1vdmVMaXN0ZW5lcigncGF1c2VkJywgcHVzaFBhdXNlZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnB1bGwub24oJ3JlbW92ZUxpc3RlbmVyJywgcmVtb3ZlQWxsKCdwdWxsJykpO1xuICAgIHRoaXMucHVzaC5vbigncmVtb3ZlTGlzdGVuZXInLCByZW1vdmVBbGwoJ3B1c2gnKSk7XG5cbiAgICBjb25zdCBwcm9taXNlID0gUHJvbWlzZS5hbGwoW1xuICAgICAgdGhpcy5wdXNoLFxuICAgICAgdGhpcy5wdWxsXG4gICAgXSkudGhlbigocmVzcCkgPT4ge1xuICAgICAgY29uc3Qgb3V0ID0ge1xuICAgICAgICBwdXNoOiByZXNwWzBdLFxuICAgICAgICBwdWxsOiByZXNwWzFdXG4gICAgICB9O1xuICAgICAgdGhpcy5lbWl0KCdjb21wbGV0ZScsIG91dCk7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgb3V0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgICByZXR1cm4gb3V0O1xuICAgIH0sIChlcnIpID0+IHtcbiAgICAgIHRoaXMuY2FuY2VsKCk7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgLy8gaWYgdGhlcmUncyBhIGNhbGxiYWNrLCB0aGVuIHRoZSBjYWxsYmFjayBjYW4gcmVjZWl2ZVxuICAgICAgICAvLyB0aGUgZXJyb3IgZXZlbnRcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIHRoZXJlJ3Mgbm8gY2FsbGJhY2ssIHRoZW4gd2UncmUgc2FmZSB0byBlbWl0IGFuIGVycm9yXG4gICAgICAgIC8vIGV2ZW50LCB3aGljaCB3b3VsZCBvdGhlcndpc2UgdGhyb3cgYW4gdW5oYW5kbGVkIGVycm9yXG4gICAgICAgIC8vIGR1ZSB0byAnZXJyb3InIGJlaW5nIGEgc3BlY2lhbCBldmVudCBpbiBFdmVudEVtaXR0ZXJzXG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAvLyBubyBzZW5zZSB0aHJvd2luZyBpZiB3ZSdyZSBhbHJlYWR5IGVtaXR0aW5nIGFuICdlcnJvcicgZXZlbnRcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy50aGVuID0gZnVuY3Rpb24gKHN1Y2Nlc3MsIGVycikge1xuICAgICAgcmV0dXJuIHByb21pc2UudGhlbihzdWNjZXNzLCBlcnIpO1xuICAgIH07XG5cbiAgICB0aGlzLmNhdGNoID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgcmV0dXJuIHByb21pc2UuY2F0Y2goZXJyKTtcbiAgICB9O1xuICB9XG5cbiAgY2FuY2VsKCkge1xuICAgIGlmICghdGhpcy5jYW5jZWxlZCkge1xuICAgICAgdGhpcy5jYW5jZWxlZCA9IHRydWU7XG4gICAgICB0aGlzLnB1c2guY2FuY2VsKCk7XG4gICAgICB0aGlzLnB1bGwuY2FuY2VsKCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyByZXBsaWNhdGUgfSBmcm9tICcuL3JlcGxpY2F0ZVdyYXBwZXInO1xuaW1wb3J0IHN5bmMgZnJvbSAnLi9zeW5jJztcblxuZnVuY3Rpb24gcmVwbGljYXRpb24oUG91Y2hEQikge1xuICBQb3VjaERCLnJlcGxpY2F0ZSA9IHJlcGxpY2F0ZTtcbiAgUG91Y2hEQi5zeW5jID0gc3luYztcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUG91Y2hEQi5wcm90b3R5cGUsICdyZXBsaWNhdGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICBpZiAodHlwZW9mIHRoaXMucmVwbGljYXRlTWV0aG9kcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5yZXBsaWNhdGVNZXRob2RzID0ge1xuICAgICAgICAgIGZyb206IGZ1bmN0aW9uIChvdGhlciwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLmNvbnN0cnVjdG9yLnJlcGxpY2F0ZShvdGhlciwgc2VsZiwgb3B0cywgY2FsbGJhY2spO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdG86IGZ1bmN0aW9uIChvdGhlciwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLmNvbnN0cnVjdG9yLnJlcGxpY2F0ZShzZWxmLCBvdGhlciwgb3B0cywgY2FsbGJhY2spO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnJlcGxpY2F0ZU1ldGhvZHM7XG4gICAgfVxuICB9KTtcblxuICBQb3VjaERCLnByb3RvdHlwZS5zeW5jID0gZnVuY3Rpb24gKGRiTmFtZSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5zeW5jKHRoaXMsIGRiTmFtZSwgb3B0cywgY2FsbGJhY2spO1xuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCByZXBsaWNhdGlvbjsiXSwibmFtZXMiOlsibmV4dFRpY2siLCJFRSIsInJlcGxpY2F0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUEsU0FBUyxjQUFjLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUU7QUFDdkQsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLFlBQVk7QUFDL0IsU0FBUyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO0FBQ3pDLFNBQVMsUUFBUSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFN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
