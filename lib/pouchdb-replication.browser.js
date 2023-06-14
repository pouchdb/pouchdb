import { defaultBackOff, uuid } from './pouchdb-utils.browser.js';
import { c as clone } from './clone-f35bcc51.js';
import EE from 'node:events';
import { i as immediate } from './functionName-4d6db487.js';
import { createError, BAD_REQUEST } from './pouchdb-errors.browser.js';
import { f as flatten } from './flatten-994f45c6.js';
import { i as isRemote } from './isRemote-f9121da9.js';
import './spark-md5-2c57e5fc.js';
import Checkpointer from './pouchdb-checkpointer.browser.js';
import generateReplicationId from './pouchdb-generate-replication-id.browser.js';
import { f as filterChange } from './parseUri-b061a2c5.js';
import './bulkGetShim-75479c95.js';
import './toPromise-06b5d6a8.js';
import './guardedConsole-f54e5a40.js';
import './explainError-browser-c025e6c9.js';
import './rev-d51344b8.js';
import './stringMd5-browser-5aecd2bd.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './scopeEval-ff3a416d.js';
import './upsert-331b6913.js';
import './_commonjsHelpers-24198af3.js';
import './__node-resolve_empty-b1d43ca8.js';
import './index-3a476dad.js';
import './binaryMd5-browser-ff2f482d.js';
import './readAsArrayBuffer-625b2d33.js';

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
class Replication extends EE {
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

class Sync extends EE {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1yZXBsaWNhdGlvbi5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9wb3VjaGRiLXJlcGxpY2F0aW9uL3NyYy9nZXREb2NzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1yZXBsaWNhdGlvbi9zcmMvYmFja29mZi5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItcmVwbGljYXRpb24vc3JjL3JlcGxpY2F0ZS5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItcmVwbGljYXRpb24vc3JjL3JlcGxpY2F0aW9uLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1yZXBsaWNhdGlvbi9zcmMvcmVwbGljYXRlV3JhcHBlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItcmVwbGljYXRpb24vc3JjL3N5bmMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLXJlcGxpY2F0aW9uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjbG9uZSwgZmxhdHRlbiwgaXNSZW1vdGUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuZnVuY3Rpb24gZmlsZUhhc0NoYW5nZWQobG9jYWxEb2MsIHJlbW90ZURvYywgZmlsZW5hbWUpIHtcbiAgcmV0dXJuICFsb2NhbERvYy5fYXR0YWNobWVudHMgfHxcbiAgICAgICAgICFsb2NhbERvYy5fYXR0YWNobWVudHNbZmlsZW5hbWVdIHx8XG4gICAgICAgICBsb2NhbERvYy5fYXR0YWNobWVudHNbZmlsZW5hbWVdLmRpZ2VzdCAhPT0gcmVtb3RlRG9jLl9hdHRhY2htZW50c1tmaWxlbmFtZV0uZGlnZXN0O1xufVxuXG5mdW5jdGlvbiBnZXREb2NBdHRhY2htZW50cyhkYiwgZG9jKSB7XG4gIHZhciBmaWxlbmFtZXMgPSBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKTtcbiAgcmV0dXJuIFByb21pc2UuYWxsKGZpbGVuYW1lcy5tYXAoZnVuY3Rpb24gKGZpbGVuYW1lKSB7XG4gICAgcmV0dXJuIGRiLmdldEF0dGFjaG1lbnQoZG9jLl9pZCwgZmlsZW5hbWUsIHtyZXY6IGRvYy5fcmV2fSk7XG4gIH0pKTtcbn1cblxuZnVuY3Rpb24gZ2V0RG9jQXR0YWNobWVudHNGcm9tVGFyZ2V0T3JTb3VyY2UodGFyZ2V0LCBzcmMsIGRvYykge1xuICB2YXIgZG9DaGVja0ZvckxvY2FsQXR0YWNobWVudHMgPSBpc1JlbW90ZShzcmMpICYmICFpc1JlbW90ZSh0YXJnZXQpO1xuICB2YXIgZmlsZW5hbWVzID0gT2JqZWN0LmtleXMoZG9jLl9hdHRhY2htZW50cyk7XG5cbiAgaWYgKCFkb0NoZWNrRm9yTG9jYWxBdHRhY2htZW50cykge1xuICAgIHJldHVybiBnZXREb2NBdHRhY2htZW50cyhzcmMsIGRvYyk7XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0LmdldChkb2MuX2lkKS50aGVuKGZ1bmN0aW9uIChsb2NhbERvYykge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChmaWxlbmFtZXMubWFwKGZ1bmN0aW9uIChmaWxlbmFtZSkge1xuICAgICAgaWYgKGZpbGVIYXNDaGFuZ2VkKGxvY2FsRG9jLCBkb2MsIGZpbGVuYW1lKSkge1xuICAgICAgICByZXR1cm4gc3JjLmdldEF0dGFjaG1lbnQoZG9jLl9pZCwgZmlsZW5hbWUpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGFyZ2V0LmdldEF0dGFjaG1lbnQobG9jYWxEb2MuX2lkLCBmaWxlbmFtZSk7XG4gICAgfSkpO1xuICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoZXJyb3Iuc3RhdHVzICE9PSA0MDQpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cblxuICAgIHJldHVybiBnZXREb2NBdHRhY2htZW50cyhzcmMsIGRvYyk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCdWxrR2V0T3B0cyhkaWZmcykge1xuICB2YXIgcmVxdWVzdHMgPSBbXTtcbiAgT2JqZWN0LmtleXMoZGlmZnMpLmZvckVhY2goZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIG1pc3NpbmdSZXZzID0gZGlmZnNbaWRdLm1pc3Npbmc7XG4gICAgbWlzc2luZ1JldnMuZm9yRWFjaChmdW5jdGlvbiAobWlzc2luZ1Jldikge1xuICAgICAgcmVxdWVzdHMucHVzaCh7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgcmV2OiBtaXNzaW5nUmV2XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkb2NzOiByZXF1ZXN0cyxcbiAgICByZXZzOiB0cnVlLFxuICAgIGxhdGVzdDogdHJ1ZVxuICB9O1xufVxuXG4vL1xuLy8gRmV0Y2ggYWxsIHRoZSBkb2N1bWVudHMgZnJvbSB0aGUgc3JjIGFzIGRlc2NyaWJlZCBpbiB0aGUgXCJkaWZmc1wiLFxuLy8gd2hpY2ggaXMgYSBtYXBwaW5nIG9mIGRvY3MgSURzIHRvIHJldmlzaW9ucy4gSWYgdGhlIHN0YXRlIGV2ZXJcbi8vIGNoYW5nZXMgdG8gXCJjYW5jZWxsZWRcIiwgdGhlbiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuLy8gRWxzZSBpdCB3aWxsIGJlIHJlc29sdmVkIHdpdGggYSBsaXN0IG9mIGZldGNoZWQgZG9jdW1lbnRzLlxuLy9cbmZ1bmN0aW9uIGdldERvY3Moc3JjLCB0YXJnZXQsIGRpZmZzLCBzdGF0ZSkge1xuICBkaWZmcyA9IGNsb25lKGRpZmZzKTsgLy8gd2UgZG8gbm90IG5lZWQgdG8gbW9kaWZ5IHRoaXNcblxuICB2YXIgcmVzdWx0RG9jcyA9IFtdLFxuICAgICAgb2sgPSB0cnVlO1xuXG4gIGZ1bmN0aW9uIGdldEFsbERvY3MoKSB7XG5cbiAgICB2YXIgYnVsa0dldE9wdHMgPSBjcmVhdGVCdWxrR2V0T3B0cyhkaWZmcyk7XG5cbiAgICBpZiAoIWJ1bGtHZXRPcHRzLmRvY3MubGVuZ3RoKSB7IC8vIG9wdGltaXphdGlvbjogc2tpcCBlbXB0eSByZXF1ZXN0c1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJldHVybiBzcmMuYnVsa0dldChidWxrR2V0T3B0cykudGhlbihmdW5jdGlvbiAoYnVsa0dldFJlc3BvbnNlKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChzdGF0ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW5jZWxsZWQnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChidWxrR2V0UmVzcG9uc2UucmVzdWx0cy5tYXAoZnVuY3Rpb24gKGJ1bGtHZXRJbmZvKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChidWxrR2V0SW5mby5kb2NzLm1hcChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgdmFyIHJlbW90ZURvYyA9IGRvYy5vaztcblxuICAgICAgICAgIGlmIChkb2MuZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIHdoZW4gQVVUT19DT01QQUNUSU9OIGlzIHNldCwgZG9jcyBjYW4gYmUgcmV0dXJuZWQgd2hpY2ggbG9va1xuICAgICAgICAgICAgLy8gbGlrZSB0aGlzOiB7XCJtaXNzaW5nXCI6XCIxLTdjM2FjMjU2YjY5M2M0NjJhZjg0NDJmOTkyYjgzNjk2XCJ9XG4gICAgICAgICAgICBvayA9IGZhbHNlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghcmVtb3RlRG9jIHx8ICFyZW1vdGVEb2MuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVtb3RlRG9jO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBnZXREb2NBdHRhY2htZW50c0Zyb21UYXJnZXRPclNvdXJjZSh0YXJnZXQsIHNyYywgcmVtb3RlRG9jKVxuICAgICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChhdHRhY2htZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZpbGVuYW1lcyA9IE9iamVjdC5rZXlzKHJlbW90ZURvYy5fYXR0YWNobWVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZvckVhY2goZnVuY3Rpb24gKGF0dGFjaG1lbnQsIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXR0ID0gcmVtb3RlRG9jLl9hdHRhY2htZW50c1tmaWxlbmFtZXNbaV1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBhdHQuc3R1YjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgYXR0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdHQuZGF0YSA9IGF0dGFjaG1lbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZW1vdGVEb2M7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSkpO1xuICAgICAgfSkpXG5cbiAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXN1bHRzKSB7XG4gICAgICAgIHJlc3VsdERvY3MgPSByZXN1bHREb2NzLmNvbmNhdChmbGF0dGVuKHJlc3VsdHMpLmZpbHRlcihCb29sZWFuKSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJldHVyblJlc3VsdCgpIHtcbiAgICByZXR1cm4geyBvazpvaywgZG9jczpyZXN1bHREb2NzIH07XG4gIH1cblxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAudGhlbihnZXRBbGxEb2NzKVxuICAgIC50aGVuKHJldHVyblJlc3VsdCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGdldERvY3M7XG4iLCJ2YXIgU1RBUlRJTkdfQkFDS19PRkYgPSAwO1xuXG5pbXBvcnQgeyBkZWZhdWx0QmFja09mZiB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuXG5mdW5jdGlvbiBiYWNrT2ZmKG9wdHMsIHJldHVyblZhbHVlLCBlcnJvciwgY2FsbGJhY2spIHtcbiAgaWYgKG9wdHMucmV0cnkgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuVmFsdWUuZW1pdCgnZXJyb3InLCBlcnJvcik7XG4gICAgcmV0dXJuVmFsdWUucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAodHlwZW9mIG9wdHMuYmFja19vZmZfZnVuY3Rpb24gIT09ICdmdW5jdGlvbicpIHtcbiAgICBvcHRzLmJhY2tfb2ZmX2Z1bmN0aW9uID0gZGVmYXVsdEJhY2tPZmY7XG4gIH1cbiAgcmV0dXJuVmFsdWUuZW1pdCgncmVxdWVzdEVycm9yJywgZXJyb3IpO1xuICBpZiAocmV0dXJuVmFsdWUuc3RhdGUgPT09ICdhY3RpdmUnIHx8IHJldHVyblZhbHVlLnN0YXRlID09PSAncGVuZGluZycpIHtcbiAgICByZXR1cm5WYWx1ZS5lbWl0KCdwYXVzZWQnLCBlcnJvcik7XG4gICAgcmV0dXJuVmFsdWUuc3RhdGUgPSAnc3RvcHBlZCc7XG4gICAgdmFyIGJhY2tPZmZTZXQgPSBmdW5jdGlvbiBiYWNrb2ZmVGltZVNldCgpIHtcbiAgICAgIG9wdHMuY3VycmVudF9iYWNrX29mZiA9IFNUQVJUSU5HX0JBQ0tfT0ZGO1xuICAgIH07XG4gICAgdmFyIHJlbW92ZUJhY2tPZmZTZXR0ZXIgPSBmdW5jdGlvbiByZW1vdmVCYWNrT2ZmVGltZVNldCgpIHtcbiAgICAgIHJldHVyblZhbHVlLnJlbW92ZUxpc3RlbmVyKCdhY3RpdmUnLCBiYWNrT2ZmU2V0KTtcbiAgICB9O1xuICAgIHJldHVyblZhbHVlLm9uY2UoJ3BhdXNlZCcsIHJlbW92ZUJhY2tPZmZTZXR0ZXIpO1xuICAgIHJldHVyblZhbHVlLm9uY2UoJ2FjdGl2ZScsIGJhY2tPZmZTZXQpO1xuICB9XG5cbiAgb3B0cy5jdXJyZW50X2JhY2tfb2ZmID0gb3B0cy5jdXJyZW50X2JhY2tfb2ZmIHx8IFNUQVJUSU5HX0JBQ0tfT0ZGO1xuICBvcHRzLmN1cnJlbnRfYmFja19vZmYgPSBvcHRzLmJhY2tfb2ZmX2Z1bmN0aW9uKG9wdHMuY3VycmVudF9iYWNrX29mZik7XG4gIHNldFRpbWVvdXQoY2FsbGJhY2ssIG9wdHMuY3VycmVudF9iYWNrX29mZik7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGJhY2tPZmY7XG4iLCJpbXBvcnQgeyBjbG9uZSwgZmlsdGVyQ2hhbmdlLCBuZXh0VGljaywgdXVpZCB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IGdldERvY3MgZnJvbSAnLi9nZXREb2NzJztcbmltcG9ydCBDaGVja3BvaW50ZXIgZnJvbSAncG91Y2hkYi1jaGVja3BvaW50ZXInO1xuaW1wb3J0IGJhY2tPZmYgZnJvbSAnLi9iYWNrb2ZmJztcbmltcG9ydCBnZW5lcmF0ZVJlcGxpY2F0aW9uSWQgZnJvbSAncG91Y2hkYi1nZW5lcmF0ZS1yZXBsaWNhdGlvbi1pZCc7XG5pbXBvcnQgeyBjcmVhdGVFcnJvciB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcblxuZnVuY3Rpb24gcmVwbGljYXRlKHNyYywgdGFyZ2V0LCBvcHRzLCByZXR1cm5WYWx1ZSwgcmVzdWx0KSB7XG4gIHZhciBiYXRjaGVzID0gW107ICAgICAgICAgICAgICAgLy8gbGlzdCBvZiBiYXRjaGVzIHRvIGJlIHByb2Nlc3NlZFxuICB2YXIgY3VycmVudEJhdGNoOyAgICAgICAgICAgICAgIC8vIHRoZSBiYXRjaCBjdXJyZW50bHkgYmVpbmcgcHJvY2Vzc2VkXG4gIHZhciBwZW5kaW5nQmF0Y2ggPSB7XG4gICAgc2VxOiAwLFxuICAgIGNoYW5nZXM6IFtdLFxuICAgIGRvY3M6IFtdXG4gIH07IC8vIG5leHQgYmF0Y2gsIG5vdCB5ZXQgcmVhZHkgdG8gYmUgcHJvY2Vzc2VkXG4gIHZhciB3cml0aW5nQ2hlY2twb2ludCA9IGZhbHNlOyAgLy8gdHJ1ZSB3aGlsZSBjaGVja3BvaW50IGlzIGJlaW5nIHdyaXR0ZW5cbiAgdmFyIGNoYW5nZXNDb21wbGV0ZWQgPSBmYWxzZTsgICAvLyB0cnVlIHdoZW4gYWxsIGNoYW5nZXMgcmVjZWl2ZWRcbiAgdmFyIHJlcGxpY2F0aW9uQ29tcGxldGVkID0gZmFsc2U7IC8vIHRydWUgd2hlbiByZXBsaWNhdGlvbiBoYXMgY29tcGxldGVkXG4gIC8vIGluaXRpYWxfbGFzdF9zZXEgaXMgdGhlIHN0YXRlIG9mIHRoZSBzb3VyY2UgZGIgYmVmb3JlXG4gIC8vIHJlcGxpY2F0aW9uIHN0YXJ0ZWQsIGFuZCBpdCBpcyBfbm90XyB1cGRhdGVkIGR1cmluZ1xuICAvLyByZXBsaWNhdGlvbiBvciB1c2VkIGFueXdoZXJlIGVsc2UsIGFzIG9wcG9zZWQgdG8gbGFzdF9zZXFcbiAgdmFyIGluaXRpYWxfbGFzdF9zZXEgPSAwO1xuICB2YXIgbGFzdF9zZXEgPSAwO1xuICB2YXIgY29udGludW91cyA9IG9wdHMuY29udGludW91cyB8fCBvcHRzLmxpdmUgfHwgZmFsc2U7XG4gIHZhciBiYXRjaF9zaXplID0gb3B0cy5iYXRjaF9zaXplIHx8IDEwMDtcbiAgdmFyIGJhdGNoZXNfbGltaXQgPSBvcHRzLmJhdGNoZXNfbGltaXQgfHwgMTA7XG4gIHZhciBzdHlsZSA9IG9wdHMuc3R5bGUgfHwgJ2FsbF9kb2NzJztcbiAgdmFyIGNoYW5nZXNQZW5kaW5nID0gZmFsc2U7ICAgICAvLyB0cnVlIHdoaWxlIHNyYy5jaGFuZ2VzIGlzIHJ1bm5pbmdcbiAgdmFyIGRvY19pZHMgPSBvcHRzLmRvY19pZHM7XG4gIHZhciBzZWxlY3RvciA9IG9wdHMuc2VsZWN0b3I7XG4gIHZhciByZXBJZDtcbiAgdmFyIGNoZWNrcG9pbnRlcjtcbiAgdmFyIGNoYW5nZWREb2NzID0gW107XG4gIC8vIExpa2UgY291Y2hkYiwgZXZlcnkgcmVwbGljYXRpb24gZ2V0cyBhIHVuaXF1ZSBzZXNzaW9uIGlkXG4gIHZhciBzZXNzaW9uID0gdXVpZCgpO1xuICB2YXIgdGFza0lkO1xuXG4gIHJlc3VsdCA9IHJlc3VsdCB8fCB7XG4gICAgb2s6IHRydWUsXG4gICAgc3RhcnRfdGltZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIGRvY3NfcmVhZDogMCxcbiAgICBkb2NzX3dyaXR0ZW46IDAsXG4gICAgZG9jX3dyaXRlX2ZhaWx1cmVzOiAwLFxuICAgIGVycm9yczogW11cbiAgfTtcblxuICB2YXIgY2hhbmdlc09wdHMgPSB7fTtcbiAgcmV0dXJuVmFsdWUucmVhZHkoc3JjLCB0YXJnZXQpO1xuXG4gIGZ1bmN0aW9uIGluaXRDaGVja3BvaW50ZXIoKSB7XG4gICAgaWYgKGNoZWNrcG9pbnRlcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVSZXBsaWNhdGlvbklkKHNyYywgdGFyZ2V0LCBvcHRzKS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgIHJlcElkID0gcmVzO1xuXG4gICAgICB2YXIgY2hlY2twb2ludE9wdHMgPSB7fTtcbiAgICAgIGlmIChvcHRzLmNoZWNrcG9pbnQgPT09IGZhbHNlKSB7XG4gICAgICAgIGNoZWNrcG9pbnRPcHRzID0geyB3cml0ZVNvdXJjZUNoZWNrcG9pbnQ6IGZhbHNlLCB3cml0ZVRhcmdldENoZWNrcG9pbnQ6IGZhbHNlIH07XG4gICAgICB9IGVsc2UgaWYgKG9wdHMuY2hlY2twb2ludCA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgY2hlY2twb2ludE9wdHMgPSB7IHdyaXRlU291cmNlQ2hlY2twb2ludDogdHJ1ZSwgd3JpdGVUYXJnZXRDaGVja3BvaW50OiBmYWxzZSB9O1xuICAgICAgfSBlbHNlIGlmIChvcHRzLmNoZWNrcG9pbnQgPT09ICd0YXJnZXQnKSB7XG4gICAgICAgIGNoZWNrcG9pbnRPcHRzID0geyB3cml0ZVNvdXJjZUNoZWNrcG9pbnQ6IGZhbHNlLCB3cml0ZVRhcmdldENoZWNrcG9pbnQ6IHRydWUgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoZWNrcG9pbnRPcHRzID0geyB3cml0ZVNvdXJjZUNoZWNrcG9pbnQ6IHRydWUsIHdyaXRlVGFyZ2V0Q2hlY2twb2ludDogdHJ1ZSB9O1xuICAgICAgfVxuXG4gICAgICBjaGVja3BvaW50ZXIgPSBuZXcgQ2hlY2twb2ludGVyKHNyYywgdGFyZ2V0LCByZXBJZCwgcmV0dXJuVmFsdWUsIGNoZWNrcG9pbnRPcHRzKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlRG9jcygpIHtcbiAgICBjaGFuZ2VkRG9jcyA9IFtdO1xuXG4gICAgaWYgKGN1cnJlbnRCYXRjaC5kb2NzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgZG9jcyA9IGN1cnJlbnRCYXRjaC5kb2NzO1xuICAgIHZhciBidWxrT3B0cyA9IHt0aW1lb3V0OiBvcHRzLnRpbWVvdXR9O1xuICAgIHJldHVybiB0YXJnZXQuYnVsa0RvY3Moe2RvY3M6IGRvY3MsIG5ld19lZGl0czogZmFsc2V9LCBidWxrT3B0cykudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgY29tcGxldGVSZXBsaWNhdGlvbigpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbmNlbGxlZCcpO1xuICAgICAgfVxuXG4gICAgICAvLyBgcmVzYCBkb2Vzbid0IGluY2x1ZGUgZnVsbCBkb2N1bWVudHMgKHdoaWNoIGxpdmUgaW4gYGRvY3NgKSwgc28gd2UgY3JlYXRlIGEgbWFwIG9mXG4gICAgICAvLyAoaWQgLT4gZXJyb3IpLCBhbmQgY2hlY2sgZm9yIGVycm9ycyB3aGlsZSBpdGVyYXRpbmcgb3ZlciBgZG9jc2BcbiAgICAgIHZhciBlcnJvcnNCeUlkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgIHJlcy5mb3JFYWNoKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgaWYgKHJlcy5lcnJvcikge1xuICAgICAgICAgIGVycm9yc0J5SWRbcmVzLmlkXSA9IHJlcztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHZhciBlcnJvcnNObyA9IE9iamVjdC5rZXlzKGVycm9yc0J5SWQpLmxlbmd0aDtcbiAgICAgIHJlc3VsdC5kb2Nfd3JpdGVfZmFpbHVyZXMgKz0gZXJyb3JzTm87XG4gICAgICByZXN1bHQuZG9jc193cml0dGVuICs9IGRvY3MubGVuZ3RoIC0gZXJyb3JzTm87XG5cbiAgICAgIGRvY3MuZm9yRWFjaChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIHZhciBlcnJvciA9IGVycm9yc0J5SWRbZG9jLl9pZF07XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHJlc3VsdC5lcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgICAgLy8gTm9ybWFsaXplIGVycm9yIG5hbWUuIGkuZS4gJ1VuYXV0aG9yaXplZCcgLT4gJ3VuYXV0aG9yaXplZCcgKGVnIFN5bmMgR2F0ZXdheSlcbiAgICAgICAgICB2YXIgZXJyb3JOYW1lID0gKGVycm9yLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgaWYgKGVycm9yTmFtZSA9PT0gJ3VuYXV0aG9yaXplZCcgfHwgZXJyb3JOYW1lID09PSAnZm9yYmlkZGVuJykge1xuICAgICAgICAgICAgcmV0dXJuVmFsdWUuZW1pdCgnZGVuaWVkJywgY2xvbmUoZXJyb3IpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNoYW5nZWREb2NzLnB1c2goZG9jKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICByZXN1bHQuZG9jX3dyaXRlX2ZhaWx1cmVzICs9IGRvY3MubGVuZ3RoO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZmluaXNoQmF0Y2goKSB7XG4gICAgaWYgKGN1cnJlbnRCYXRjaC5lcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGVyZSB3YXMgYSBwcm9ibGVtIGdldHRpbmcgZG9jcy4nKTtcbiAgICB9XG4gICAgcmVzdWx0Lmxhc3Rfc2VxID0gbGFzdF9zZXEgPSBjdXJyZW50QmF0Y2guc2VxO1xuICAgIHZhciBvdXRSZXN1bHQgPSBjbG9uZShyZXN1bHQpO1xuICAgIGlmIChjaGFuZ2VkRG9jcy5sZW5ndGgpIHtcbiAgICAgIG91dFJlc3VsdC5kb2NzID0gY2hhbmdlZERvY3M7XG4gICAgICAvLyBBdHRhY2ggJ3BlbmRpbmcnIHByb3BlcnR5IGlmIHNlcnZlciBzdXBwb3J0cyBpdCAoQ291Y2hEQiAyLjArKVxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAodHlwZW9mIGN1cnJlbnRCYXRjaC5wZW5kaW5nID09PSAnbnVtYmVyJykge1xuICAgICAgICBvdXRSZXN1bHQucGVuZGluZyA9IGN1cnJlbnRCYXRjaC5wZW5kaW5nO1xuICAgICAgICBkZWxldGUgY3VycmVudEJhdGNoLnBlbmRpbmc7XG4gICAgICB9XG4gICAgICByZXR1cm5WYWx1ZS5lbWl0KCdjaGFuZ2UnLCBvdXRSZXN1bHQpO1xuICAgIH1cbiAgICB3cml0aW5nQ2hlY2twb2ludCA9IHRydWU7XG5cbiAgICBzcmMuaW5mbygpLnRoZW4oZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgIHZhciB0YXNrID0gc3JjLmFjdGl2ZVRhc2tzLmdldCh0YXNrSWQpO1xuICAgICAgaWYgKCFjdXJyZW50QmF0Y2ggfHwgIXRhc2spIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgY29tcGxldGVkID0gdGFzay5jb21wbGV0ZWRfaXRlbXMgfHwgMDtcbiAgICAgIHZhciB0b3RhbF9pdGVtcyA9IHBhcnNlSW50KGluZm8udXBkYXRlX3NlcSwgMTApIC0gcGFyc2VJbnQoaW5pdGlhbF9sYXN0X3NlcSwgMTApO1xuICAgICAgc3JjLmFjdGl2ZVRhc2tzLnVwZGF0ZSh0YXNrSWQsIHtcbiAgICAgICAgY29tcGxldGVkX2l0ZW1zOiBjb21wbGV0ZWQgKyBjdXJyZW50QmF0Y2guY2hhbmdlcy5sZW5ndGgsXG4gICAgICAgIHRvdGFsX2l0ZW1zXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBjaGVja3BvaW50ZXIud3JpdGVDaGVja3BvaW50KGN1cnJlbnRCYXRjaC5zZXEsXG4gICAgICAgIHNlc3Npb24pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuVmFsdWUuZW1pdCgnY2hlY2twb2ludCcsIHsgJ2NoZWNrcG9pbnQnOiBjdXJyZW50QmF0Y2guc2VxIH0pO1xuICAgICAgd3JpdGluZ0NoZWNrcG9pbnQgPSBmYWxzZTtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKHJldHVyblZhbHVlLmNhbmNlbGxlZCkge1xuICAgICAgICBjb21wbGV0ZVJlcGxpY2F0aW9uKCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY2FuY2VsbGVkJyk7XG4gICAgICB9XG4gICAgICBjdXJyZW50QmF0Y2ggPSB1bmRlZmluZWQ7XG4gICAgICBnZXRDaGFuZ2VzKCk7XG4gICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgb25DaGVja3BvaW50RXJyb3IoZXJyKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldERpZmZzKCkge1xuICAgIHZhciBkaWZmID0ge307XG4gICAgY3VycmVudEJhdGNoLmNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAoY2hhbmdlKSB7XG4gICAgICByZXR1cm5WYWx1ZS5lbWl0KCdjaGVja3BvaW50JywgeyAncmV2c19kaWZmJzogY2hhbmdlIH0pO1xuICAgICAgLy8gQ291Y2hiYXNlIFN5bmMgR2F0ZXdheSBlbWl0cyB0aGVzZSwgYnV0IHdlIGNhbiBpZ25vcmUgdGhlbVxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAoY2hhbmdlLmlkID09PSBcIl91c2VyL1wiKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGRpZmZbY2hhbmdlLmlkXSA9IGNoYW5nZS5jaGFuZ2VzLm1hcChmdW5jdGlvbiAoeCkge1xuICAgICAgICByZXR1cm4geC5yZXY7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGFyZ2V0LnJldnNEaWZmKGRpZmYpLnRoZW4oZnVuY3Rpb24gKGRpZmZzKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgY29tcGxldGVSZXBsaWNhdGlvbigpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbmNlbGxlZCcpO1xuICAgICAgfVxuICAgICAgLy8gY3VycmVudEJhdGNoLmRpZmZzIGVsZW1lbnRzIGFyZSBkZWxldGVkIGFzIHRoZSBkb2N1bWVudHMgYXJlIHdyaXR0ZW5cbiAgICAgIGN1cnJlbnRCYXRjaC5kaWZmcyA9IGRpZmZzO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0QmF0Y2hEb2NzKCkge1xuICAgIHJldHVybiBnZXREb2NzKHNyYywgdGFyZ2V0LCBjdXJyZW50QmF0Y2guZGlmZnMsIHJldHVyblZhbHVlKS50aGVuKGZ1bmN0aW9uIChnb3QpIHtcbiAgICAgIGN1cnJlbnRCYXRjaC5lcnJvciA9ICFnb3Qub2s7XG4gICAgICBnb3QuZG9jcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgZGVsZXRlIGN1cnJlbnRCYXRjaC5kaWZmc1tkb2MuX2lkXTtcbiAgICAgICAgcmVzdWx0LmRvY3NfcmVhZCsrO1xuICAgICAgICBjdXJyZW50QmF0Y2guZG9jcy5wdXNoKGRvYyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXJ0TmV4dEJhdGNoKCkge1xuICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQgfHwgY3VycmVudEJhdGNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChiYXRjaGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcHJvY2Vzc1BlbmRpbmdCYXRjaCh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY3VycmVudEJhdGNoID0gYmF0Y2hlcy5zaGlmdCgpO1xuICAgIHJldHVyblZhbHVlLmVtaXQoJ2NoZWNrcG9pbnQnLCB7ICdzdGFydF9uZXh0X2JhdGNoJzogY3VycmVudEJhdGNoLnNlcSB9KTtcbiAgICBnZXREaWZmcygpXG4gICAgICAudGhlbihnZXRCYXRjaERvY3MpXG4gICAgICAudGhlbih3cml0ZURvY3MpXG4gICAgICAudGhlbihmaW5pc2hCYXRjaClcbiAgICAgIC50aGVuKHN0YXJ0TmV4dEJhdGNoKVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgYWJvcnRSZXBsaWNhdGlvbignYmF0Y2ggcHJvY2Vzc2luZyB0ZXJtaW5hdGVkIHdpdGggZXJyb3InLCBlcnIpO1xuICAgICAgfSk7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIHByb2Nlc3NQZW5kaW5nQmF0Y2goaW1tZWRpYXRlKSB7XG4gICAgaWYgKHBlbmRpbmdCYXRjaC5jaGFuZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKGJhdGNoZXMubGVuZ3RoID09PSAwICYmICFjdXJyZW50QmF0Y2gpIHtcbiAgICAgICAgaWYgKChjb250aW51b3VzICYmIGNoYW5nZXNPcHRzLmxpdmUpIHx8IGNoYW5nZXNDb21wbGV0ZWQpIHtcbiAgICAgICAgICByZXR1cm5WYWx1ZS5zdGF0ZSA9ICdwZW5kaW5nJztcbiAgICAgICAgICByZXR1cm5WYWx1ZS5lbWl0KCdwYXVzZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbmdlc0NvbXBsZXRlZCkge1xuICAgICAgICAgIGNvbXBsZXRlUmVwbGljYXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICBpbW1lZGlhdGUgfHxcbiAgICAgIGNoYW5nZXNDb21wbGV0ZWQgfHxcbiAgICAgIHBlbmRpbmdCYXRjaC5jaGFuZ2VzLmxlbmd0aCA+PSBiYXRjaF9zaXplXG4gICAgKSB7XG4gICAgICBiYXRjaGVzLnB1c2gocGVuZGluZ0JhdGNoKTtcbiAgICAgIHBlbmRpbmdCYXRjaCA9IHtcbiAgICAgICAgc2VxOiAwLFxuICAgICAgICBjaGFuZ2VzOiBbXSxcbiAgICAgICAgZG9jczogW11cbiAgICAgIH07XG4gICAgICBpZiAocmV0dXJuVmFsdWUuc3RhdGUgPT09ICdwZW5kaW5nJyB8fCByZXR1cm5WYWx1ZS5zdGF0ZSA9PT0gJ3N0b3BwZWQnKSB7XG4gICAgICAgIHJldHVyblZhbHVlLnN0YXRlID0gJ2FjdGl2ZSc7XG4gICAgICAgIHJldHVyblZhbHVlLmVtaXQoJ2FjdGl2ZScpO1xuICAgICAgfVxuICAgICAgc3RhcnROZXh0QmF0Y2goKTtcbiAgICB9XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGFib3J0UmVwbGljYXRpb24ocmVhc29uLCBlcnIpIHtcbiAgICBpZiAocmVwbGljYXRpb25Db21wbGV0ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCFlcnIubWVzc2FnZSkge1xuICAgICAgZXJyLm1lc3NhZ2UgPSByZWFzb247XG4gICAgfVxuICAgIHJlc3VsdC5vayA9IGZhbHNlO1xuICAgIHJlc3VsdC5zdGF0dXMgPSAnYWJvcnRpbmcnO1xuICAgIGJhdGNoZXMgPSBbXTtcbiAgICBwZW5kaW5nQmF0Y2ggPSB7XG4gICAgICBzZXE6IDAsXG4gICAgICBjaGFuZ2VzOiBbXSxcbiAgICAgIGRvY3M6IFtdXG4gICAgfTtcbiAgICBjb21wbGV0ZVJlcGxpY2F0aW9uKGVycik7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGNvbXBsZXRlUmVwbGljYXRpb24oZmF0YWxFcnJvcikge1xuICAgIGlmIChyZXBsaWNhdGlvbkNvbXBsZXRlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAocmV0dXJuVmFsdWUuY2FuY2VsbGVkKSB7XG4gICAgICByZXN1bHQuc3RhdHVzID0gJ2NhbmNlbGxlZCc7XG4gICAgICBpZiAod3JpdGluZ0NoZWNrcG9pbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICByZXN1bHQuc3RhdHVzID0gcmVzdWx0LnN0YXR1cyB8fCAnY29tcGxldGUnO1xuICAgIHJlc3VsdC5lbmRfdGltZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICByZXN1bHQubGFzdF9zZXEgPSBsYXN0X3NlcTtcbiAgICByZXBsaWNhdGlvbkNvbXBsZXRlZCA9IHRydWU7XG5cbiAgICBzcmMuYWN0aXZlVGFza3MucmVtb3ZlKHRhc2tJZCwgZmF0YWxFcnJvcik7XG5cbiAgICBpZiAoZmF0YWxFcnJvcikge1xuICAgICAgLy8gbmVlZCB0byBleHRlbmQgdGhlIGVycm9yIGJlY2F1c2UgRmlyZWZveCBjb25zaWRlcnMgXCIucmVzdWx0XCIgcmVhZC1vbmx5XG4gICAgICBmYXRhbEVycm9yID0gY3JlYXRlRXJyb3IoZmF0YWxFcnJvcik7XG4gICAgICBmYXRhbEVycm9yLnJlc3VsdCA9IHJlc3VsdDtcblxuICAgICAgLy8gTm9ybWFsaXplIGVycm9yIG5hbWUuIGkuZS4gJ1VuYXV0aG9yaXplZCcgLT4gJ3VuYXV0aG9yaXplZCcgKGVnIFN5bmMgR2F0ZXdheSlcbiAgICAgIHZhciBlcnJvck5hbWUgPSAoZmF0YWxFcnJvci5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKGVycm9yTmFtZSA9PT0gJ3VuYXV0aG9yaXplZCcgfHwgZXJyb3JOYW1lID09PSAnZm9yYmlkZGVuJykge1xuICAgICAgICByZXR1cm5WYWx1ZS5lbWl0KCdlcnJvcicsIGZhdGFsRXJyb3IpO1xuICAgICAgICByZXR1cm5WYWx1ZS5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJhY2tPZmYob3B0cywgcmV0dXJuVmFsdWUsIGZhdGFsRXJyb3IsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXBsaWNhdGUoc3JjLCB0YXJnZXQsIG9wdHMsIHJldHVyblZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVyblZhbHVlLmVtaXQoJ2NvbXBsZXRlJywgcmVzdWx0KTtcbiAgICAgIHJldHVyblZhbHVlLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uQ2hhbmdlKGNoYW5nZSwgcGVuZGluZywgbGFzdFNlcSkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgIHJldHVybiBjb21wbGV0ZVJlcGxpY2F0aW9uKCk7XG4gICAgfVxuICAgIC8vIEF0dGFjaCAncGVuZGluZycgcHJvcGVydHkgaWYgc2VydmVyIHN1cHBvcnRzIGl0IChDb3VjaERCIDIuMCspXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHR5cGVvZiBwZW5kaW5nID09PSAnbnVtYmVyJykge1xuICAgICAgcGVuZGluZ0JhdGNoLnBlbmRpbmcgPSBwZW5kaW5nO1xuICAgIH1cblxuICAgIHZhciBmaWx0ZXIgPSBmaWx0ZXJDaGFuZ2Uob3B0cykoY2hhbmdlKTtcbiAgICBpZiAoIWZpbHRlcikge1xuICAgICAgLy8gdXBkYXRlIHByb2Nlc3NlZCBpdGVtcyBjb3VudCBieSAxXG4gICAgICB2YXIgdGFzayA9IHNyYy5hY3RpdmVUYXNrcy5nZXQodGFza0lkKTtcbiAgICAgIGlmICh0YXNrKSB7XG4gICAgICAgIC8vIHdlIGNhbiBhc3N1bWUgdGhhdCB0YXNrIGV4aXN0cyBoZXJlPyBzaG91bGRuJ3QgYmUgZGVsZXRlZCBieSBoZXJlLlxuICAgICAgICB2YXIgY29tcGxldGVkID0gdGFzay5jb21wbGV0ZWRfaXRlbXMgfHwgMDtcbiAgICAgICAgc3JjLmFjdGl2ZVRhc2tzLnVwZGF0ZSh0YXNrSWQsIHtjb21wbGV0ZWRfaXRlbXM6ICsrY29tcGxldGVkfSk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHBlbmRpbmdCYXRjaC5zZXEgPSBjaGFuZ2Uuc2VxIHx8IGxhc3RTZXE7XG4gICAgcGVuZGluZ0JhdGNoLmNoYW5nZXMucHVzaChjaGFuZ2UpO1xuICAgIHJldHVyblZhbHVlLmVtaXQoJ2NoZWNrcG9pbnQnLCB7ICdwZW5kaW5nX2JhdGNoJzogcGVuZGluZ0JhdGNoLnNlcSB9KTtcbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBwcm9jZXNzUGVuZGluZ0JhdGNoKGJhdGNoZXMubGVuZ3RoID09PSAwICYmIGNoYW5nZXNPcHRzLmxpdmUpO1xuICAgIH0pO1xuICB9XG5cblxuICBmdW5jdGlvbiBvbkNoYW5nZXNDb21wbGV0ZShjaGFuZ2VzKSB7XG4gICAgY2hhbmdlc1BlbmRpbmcgPSBmYWxzZTtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAocmV0dXJuVmFsdWUuY2FuY2VsbGVkKSB7XG4gICAgICByZXR1cm4gY29tcGxldGVSZXBsaWNhdGlvbigpO1xuICAgIH1cblxuICAgIC8vIGlmIG5vIHJlc3VsdHMgd2VyZSByZXR1cm5lZCB0aGVuIHdlJ3JlIGRvbmUsXG4gICAgLy8gZWxzZSBmZXRjaCBtb3JlXG4gICAgaWYgKGNoYW5nZXMucmVzdWx0cy5sZW5ndGggPiAwKSB7XG4gICAgICBjaGFuZ2VzT3B0cy5zaW5jZSA9IGNoYW5nZXMucmVzdWx0c1tjaGFuZ2VzLnJlc3VsdHMubGVuZ3RoIC0gMV0uc2VxO1xuICAgICAgZ2V0Q2hhbmdlcygpO1xuICAgICAgcHJvY2Vzc1BlbmRpbmdCYXRjaCh0cnVlKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICB2YXIgY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChjb250aW51b3VzKSB7XG4gICAgICAgICAgY2hhbmdlc09wdHMubGl2ZSA9IHRydWU7XG4gICAgICAgICAgZ2V0Q2hhbmdlcygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNoYW5nZXNDb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHByb2Nlc3NQZW5kaW5nQmF0Y2godHJ1ZSk7XG4gICAgICB9O1xuXG4gICAgICAvLyB1cGRhdGUgdGhlIGNoZWNrcG9pbnQgc28gd2Ugc3RhcnQgZnJvbSB0aGUgcmlnaHQgc2VxIG5leHQgdGltZVxuICAgICAgaWYgKCFjdXJyZW50QmF0Y2ggJiYgY2hhbmdlcy5yZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB3cml0aW5nQ2hlY2twb2ludCA9IHRydWU7XG4gICAgICAgIGNoZWNrcG9pbnRlci53cml0ZUNoZWNrcG9pbnQoY2hhbmdlcy5sYXN0X3NlcSxcbiAgICAgICAgICAgIHNlc3Npb24pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHdyaXRpbmdDaGVja3BvaW50ID0gZmFsc2U7XG4gICAgICAgICAgcmVzdWx0Lmxhc3Rfc2VxID0gbGFzdF9zZXEgPSBjaGFuZ2VzLmxhc3Rfc2VxO1xuICAgICAgICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgICAgIGNvbXBsZXRlUmVwbGljYXRpb24oKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY2FuY2VsbGVkJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbXBsZXRlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2gob25DaGVja3BvaW50RXJyb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcGxldGUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIGZ1bmN0aW9uIG9uQ2hhbmdlc0Vycm9yKGVycikge1xuICAgIGNoYW5nZXNQZW5kaW5nID0gZmFsc2U7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHJldHVyblZhbHVlLmNhbmNlbGxlZCkge1xuICAgICAgcmV0dXJuIGNvbXBsZXRlUmVwbGljYXRpb24oKTtcbiAgICB9XG4gICAgYWJvcnRSZXBsaWNhdGlvbignY2hhbmdlcyByZWplY3RlZCcsIGVycik7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGdldENoYW5nZXMoKSB7XG4gICAgaWYgKCEoXG4gICAgICAhY2hhbmdlc1BlbmRpbmcgJiZcbiAgICAgICFjaGFuZ2VzQ29tcGxldGVkICYmXG4gICAgICBiYXRjaGVzLmxlbmd0aCA8IGJhdGNoZXNfbGltaXRcbiAgICAgICkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2hhbmdlc1BlbmRpbmcgPSB0cnVlO1xuICAgIGZ1bmN0aW9uIGFib3J0Q2hhbmdlcygpIHtcbiAgICAgIGNoYW5nZXMuY2FuY2VsKCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlbW92ZUxpc3RlbmVyKCkge1xuICAgICAgcmV0dXJuVmFsdWUucmVtb3ZlTGlzdGVuZXIoJ2NhbmNlbCcsIGFib3J0Q2hhbmdlcyk7XG4gICAgfVxuXG4gICAgaWYgKHJldHVyblZhbHVlLl9jaGFuZ2VzKSB7IC8vIHJlbW92ZSBvbGQgY2hhbmdlcygpIGFuZCBsaXN0ZW5lcnNcbiAgICAgIHJldHVyblZhbHVlLnJlbW92ZUxpc3RlbmVyKCdjYW5jZWwnLCByZXR1cm5WYWx1ZS5fYWJvcnRDaGFuZ2VzKTtcbiAgICAgIHJldHVyblZhbHVlLl9jaGFuZ2VzLmNhbmNlbCgpO1xuICAgIH1cbiAgICByZXR1cm5WYWx1ZS5vbmNlKCdjYW5jZWwnLCBhYm9ydENoYW5nZXMpO1xuXG4gICAgdmFyIGNoYW5nZXMgPSBzcmMuY2hhbmdlcyhjaGFuZ2VzT3B0cylcbiAgICAgIC5vbignY2hhbmdlJywgb25DaGFuZ2UpO1xuICAgIGNoYW5nZXMudGhlbihyZW1vdmVMaXN0ZW5lciwgcmVtb3ZlTGlzdGVuZXIpO1xuICAgIGNoYW5nZXMudGhlbihvbkNoYW5nZXNDb21wbGV0ZSlcbiAgICAgIC5jYXRjaChvbkNoYW5nZXNFcnJvcik7XG5cbiAgICBpZiAob3B0cy5yZXRyeSkge1xuICAgICAgLy8gc2F2ZSBmb3IgbGF0ZXIgc28gd2UgY2FuIGNhbmNlbCBpZiBuZWNlc3NhcnlcbiAgICAgIHJldHVyblZhbHVlLl9jaGFuZ2VzID0gY2hhbmdlcztcbiAgICAgIHJldHVyblZhbHVlLl9hYm9ydENoYW5nZXMgPSBhYm9ydENoYW5nZXM7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlVGFzayhjaGVja3BvaW50KSB7XG4gICAgcmV0dXJuIHNyYy5pbmZvKCkudGhlbihmdW5jdGlvbiAoaW5mbykge1xuICAgICAgdmFyIHRvdGFsX2l0ZW1zID0gdHlwZW9mIG9wdHMuc2luY2UgPT09ICd1bmRlZmluZWQnID9cbiAgICAgICAgcGFyc2VJbnQoaW5mby51cGRhdGVfc2VxLCAxMCkgLSBwYXJzZUludChjaGVja3BvaW50LCAxMCkgOlxuICAgICAgICBwYXJzZUludChpbmZvLnVwZGF0ZV9zZXEsIDEwKTtcblxuICAgICAgdGFza0lkID0gc3JjLmFjdGl2ZVRhc2tzLmFkZCh7XG4gICAgICAgIG5hbWU6IGAke2NvbnRpbnVvdXMgPyAnY29udGludW91cyAnIDogJyd9cmVwbGljYXRpb24gZnJvbSAke2luZm8uZGJfbmFtZX1gICxcbiAgICAgICAgdG90YWxfaXRlbXMsXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNoZWNrcG9pbnQ7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBzdGFydENoYW5nZXMoKSB7XG4gICAgaW5pdENoZWNrcG9pbnRlcigpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAocmV0dXJuVmFsdWUuY2FuY2VsbGVkKSB7XG4gICAgICAgIGNvbXBsZXRlUmVwbGljYXRpb24oKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNoZWNrcG9pbnRlci5nZXRDaGVja3BvaW50KCkudGhlbihjcmVhdGVUYXNrKS50aGVuKGZ1bmN0aW9uIChjaGVja3BvaW50KSB7XG4gICAgICAgIGxhc3Rfc2VxID0gY2hlY2twb2ludDtcbiAgICAgICAgaW5pdGlhbF9sYXN0X3NlcSA9IGNoZWNrcG9pbnQ7XG4gICAgICAgIGNoYW5nZXNPcHRzID0ge1xuICAgICAgICAgIHNpbmNlOiBsYXN0X3NlcSxcbiAgICAgICAgICBsaW1pdDogYmF0Y2hfc2l6ZSxcbiAgICAgICAgICBiYXRjaF9zaXplOiBiYXRjaF9zaXplLFxuICAgICAgICAgIHN0eWxlOiBzdHlsZSxcbiAgICAgICAgICBkb2NfaWRzOiBkb2NfaWRzLFxuICAgICAgICAgIHNlbGVjdG9yOiBzZWxlY3RvcixcbiAgICAgICAgICByZXR1cm5fZG9jczogdHJ1ZSAvLyByZXF1aXJlZCBzbyB3ZSBrbm93IHdoZW4gd2UncmUgZG9uZVxuICAgICAgICB9O1xuICAgICAgICBpZiAob3B0cy5maWx0ZXIpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIG9wdHMuZmlsdGVyICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gcmVxdWlyZWQgZm9yIHRoZSBjbGllbnQtc2lkZSBmaWx0ZXIgaW4gb25DaGFuZ2VcbiAgICAgICAgICAgIGNoYW5nZXNPcHRzLmluY2x1ZGVfZG9jcyA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHsgLy8gZGRvYyBmaWx0ZXJcbiAgICAgICAgICAgIGNoYW5nZXNPcHRzLmZpbHRlciA9IG9wdHMuZmlsdGVyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoJ2hlYXJ0YmVhdCcgaW4gb3B0cykge1xuICAgICAgICAgIGNoYW5nZXNPcHRzLmhlYXJ0YmVhdCA9IG9wdHMuaGVhcnRiZWF0O1xuICAgICAgICB9XG4gICAgICAgIGlmICgndGltZW91dCcgaW4gb3B0cykge1xuICAgICAgICAgIGNoYW5nZXNPcHRzLnRpbWVvdXQgPSBvcHRzLnRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdHMucXVlcnlfcGFyYW1zKSB7XG4gICAgICAgICAgY2hhbmdlc09wdHMucXVlcnlfcGFyYW1zID0gb3B0cy5xdWVyeV9wYXJhbXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdHMudmlldykge1xuICAgICAgICAgIGNoYW5nZXNPcHRzLnZpZXcgPSBvcHRzLnZpZXc7XG4gICAgICAgIH1cbiAgICAgICAgZ2V0Q2hhbmdlcygpO1xuICAgICAgfSk7XG4gICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgYWJvcnRSZXBsaWNhdGlvbignZ2V0Q2hlY2twb2ludCByZWplY3RlZCB3aXRoICcsIGVycik7XG4gICAgfSk7XG4gIH1cblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBmdW5jdGlvbiBvbkNoZWNrcG9pbnRFcnJvcihlcnIpIHtcbiAgICB3cml0aW5nQ2hlY2twb2ludCA9IGZhbHNlO1xuICAgIGFib3J0UmVwbGljYXRpb24oJ3dyaXRlQ2hlY2twb2ludCBjb21wbGV0ZWQgd2l0aCBlcnJvcicsIGVycik7XG4gIH1cblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKHJldHVyblZhbHVlLmNhbmNlbGxlZCkgeyAvLyBjYW5jZWxsZWQgaW1tZWRpYXRlbHlcbiAgICBjb21wbGV0ZVJlcGxpY2F0aW9uKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCFyZXR1cm5WYWx1ZS5fYWRkZWRMaXN0ZW5lcnMpIHtcbiAgICByZXR1cm5WYWx1ZS5vbmNlKCdjYW5jZWwnLCBjb21wbGV0ZVJlcGxpY2F0aW9uKTtcblxuICAgIGlmICh0eXBlb2Ygb3B0cy5jb21wbGV0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuVmFsdWUub25jZSgnZXJyb3InLCBvcHRzLmNvbXBsZXRlKTtcbiAgICAgIHJldHVyblZhbHVlLm9uY2UoJ2NvbXBsZXRlJywgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICBvcHRzLmNvbXBsZXRlKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuVmFsdWUuX2FkZGVkTGlzdGVuZXJzID0gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb3B0cy5zaW5jZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzdGFydENoYW5nZXMoKTtcbiAgfSBlbHNlIHtcbiAgICBpbml0Q2hlY2twb2ludGVyKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICB3cml0aW5nQ2hlY2twb2ludCA9IHRydWU7XG4gICAgICByZXR1cm4gY2hlY2twb2ludGVyLndyaXRlQ2hlY2twb2ludChvcHRzLnNpbmNlLCBzZXNzaW9uKTtcbiAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgIHdyaXRpbmdDaGVja3BvaW50ID0gZmFsc2U7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChyZXR1cm5WYWx1ZS5jYW5jZWxsZWQpIHtcbiAgICAgICAgY29tcGxldGVSZXBsaWNhdGlvbigpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBsYXN0X3NlcSA9IG9wdHMuc2luY2U7XG4gICAgICBzdGFydENoYW5nZXMoKTtcbiAgICB9KS5jYXRjaChvbkNoZWNrcG9pbnRFcnJvcik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgcmVwbGljYXRlO1xuIiwiaW1wb3J0IEVFIGZyb20gJ25vZGU6ZXZlbnRzJztcblxuLy8gV2UgY3JlYXRlIGEgYmFzaWMgcHJvbWlzZSBzbyB0aGUgY2FsbGVyIGNhbiBjYW5jZWwgdGhlIHJlcGxpY2F0aW9uIHBvc3NpYmx5XG4vLyBiZWZvcmUgd2UgaGF2ZSBhY3R1YWxseSBzdGFydGVkIGxpc3RlbmluZyB0byBjaGFuZ2VzIGV0Y1xuY2xhc3MgUmVwbGljYXRpb24gZXh0ZW5kcyBFRSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5jYW5jZWxsZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXRlID0gJ3BlbmRpbmcnO1xuICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgoZnVsZmlsbCwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLm9uY2UoJ2NvbXBsZXRlJywgZnVsZmlsbCk7XG4gICAgICB0aGlzLm9uY2UoJ2Vycm9yJywgcmVqZWN0KTtcbiAgICB9KTtcbiAgICB0aGlzLnRoZW4gPSBmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZXR1cm4gcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgfTtcbiAgICB0aGlzLmNhdGNoID0gZnVuY3Rpb24gKHJlamVjdCkge1xuICAgICAgcmV0dXJuIHByb21pc2UuY2F0Y2gocmVqZWN0KTtcbiAgICB9O1xuICAgIC8vIEFzIHdlIGFsbG93IGVycm9yIGhhbmRsaW5nIHZpYSBcImVycm9yXCIgZXZlbnQgYXMgd2VsbCxcbiAgICAvLyBwdXQgYSBzdHViIGluIGhlcmUgc28gdGhhdCByZWplY3RpbmcgbmV2ZXIgdGhyb3dzIFVuaGFuZGxlZEVycm9yLlxuICAgIHRoaXMuY2F0Y2goZnVuY3Rpb24gKCkge30pO1xuICB9XG5cbiAgY2FuY2VsKCkge1xuICAgIHRoaXMuY2FuY2VsbGVkID0gdHJ1ZTtcbiAgICB0aGlzLnN0YXRlID0gJ2NhbmNlbGxlZCc7XG4gICAgdGhpcy5lbWl0KCdjYW5jZWwnKTtcbiAgfVxuXG4gIHJlYWR5KHNyYywgdGFyZ2V0KSB7XG4gICAgaWYgKHRoaXMuX3JlYWR5Q2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuX3JlYWR5Q2FsbGVkID0gdHJ1ZTtcbiAgXG4gICAgY29uc3Qgb25EZXN0cm95ID0gKCkgPT4ge1xuICAgICAgdGhpcy5jYW5jZWwoKTtcbiAgICB9O1xuICAgIHNyYy5vbmNlKCdkZXN0cm95ZWQnLCBvbkRlc3Ryb3kpO1xuICAgIHRhcmdldC5vbmNlKCdkZXN0cm95ZWQnLCBvbkRlc3Ryb3kpO1xuICAgIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gICAgICB0YXJnZXQucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gICAgfVxuICAgIHRoaXMub25jZSgnY29tcGxldGUnLCBjbGVhbnVwKTtcbiAgICB0aGlzLm9uY2UoJ2Vycm9yJywgY2xlYW51cCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUmVwbGljYXRpb247XG4iLCJpbXBvcnQgcmVwbGljYXRlIGZyb20gJy4vcmVwbGljYXRlJztcbmltcG9ydCBSZXBsaWNhdGlvbiBmcm9tICcuL3JlcGxpY2F0aW9uJztcbmltcG9ydCB7IGNsb25lIH0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5pbXBvcnQgeyBjcmVhdGVFcnJvciwgQkFEX1JFUVVFU1QgfSBmcm9tICdwb3VjaGRiLWVycm9ycyc7XG5cbmZ1bmN0aW9uIHRvUG91Y2goZGIsIG9wdHMpIHtcbiAgdmFyIFBvdWNoQ29uc3RydWN0b3IgPSBvcHRzLlBvdWNoQ29uc3RydWN0b3I7XG4gIGlmICh0eXBlb2YgZGIgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIG5ldyBQb3VjaENvbnN0cnVjdG9yKGRiLCBvcHRzKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGI7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVwbGljYXRlV3JhcHBlcihzcmMsIHRhcmdldCwgb3B0cywgY2FsbGJhY2spIHtcblxuICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgb3B0cyA9IHt9O1xuICB9XG4gIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBvcHRzID0ge307XG4gIH1cblxuICBpZiAob3B0cy5kb2NfaWRzICYmICFBcnJheS5pc0FycmF5KG9wdHMuZG9jX2lkcykpIHtcbiAgICB0aHJvdyBjcmVhdGVFcnJvcihCQURfUkVRVUVTVCxcbiAgICAgICAgICAgICAgICAgICAgICAgXCJgZG9jX2lkc2AgZmlsdGVyIHBhcmFtZXRlciBpcyBub3QgYSBsaXN0LlwiKTtcbiAgfVxuXG4gIG9wdHMuY29tcGxldGUgPSBjYWxsYmFjaztcbiAgb3B0cyA9IGNsb25lKG9wdHMpO1xuICBvcHRzLmNvbnRpbnVvdXMgPSBvcHRzLmNvbnRpbnVvdXMgfHwgb3B0cy5saXZlO1xuICBvcHRzLnJldHJ5ID0gKCdyZXRyeScgaW4gb3B0cykgPyBvcHRzLnJldHJ5IDogZmFsc2U7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIG9wdHMuUG91Y2hDb25zdHJ1Y3RvciA9IG9wdHMuUG91Y2hDb25zdHJ1Y3RvciB8fCB0aGlzO1xuICB2YXIgcmVwbGljYXRlUmV0ID0gbmV3IFJlcGxpY2F0aW9uKG9wdHMpO1xuICB2YXIgc3JjUG91Y2ggPSB0b1BvdWNoKHNyYywgb3B0cyk7XG4gIHZhciB0YXJnZXRQb3VjaCA9IHRvUG91Y2godGFyZ2V0LCBvcHRzKTtcbiAgcmVwbGljYXRlKHNyY1BvdWNoLCB0YXJnZXRQb3VjaCwgb3B0cywgcmVwbGljYXRlUmV0KTtcbiAgcmV0dXJuIHJlcGxpY2F0ZVJldDtcbn1cblxuZXhwb3J0IHtcbiAgcmVwbGljYXRlV3JhcHBlciBhcyByZXBsaWNhdGUsXG4gIHRvUG91Y2hcbn07IiwiXG5pbXBvcnQge1xuICByZXBsaWNhdGUsXG4gIHRvUG91Y2hcbn0gZnJvbSAnLi9yZXBsaWNhdGVXcmFwcGVyJztcbmltcG9ydCBFRSBmcm9tICdub2RlOmV2ZW50cyc7XG5pbXBvcnQgeyBjbG9uZSB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuXG5leHBvcnQgZGVmYXVsdCBzeW5jO1xuZnVuY3Rpb24gc3luYyhzcmMsIHRhcmdldCwgb3B0cywgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgIG9wdHMgPSB7fTtcbiAgfVxuICBpZiAodHlwZW9mIG9wdHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgb3B0cyA9IHt9O1xuICB9XG4gIG9wdHMgPSBjbG9uZShvcHRzKTtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgb3B0cy5Qb3VjaENvbnN0cnVjdG9yID0gb3B0cy5Qb3VjaENvbnN0cnVjdG9yIHx8IHRoaXM7XG4gIHNyYyA9IHRvUG91Y2goc3JjLCBvcHRzKTtcbiAgdGFyZ2V0ID0gdG9Qb3VjaCh0YXJnZXQsIG9wdHMpO1xuICByZXR1cm4gbmV3IFN5bmMoc3JjLCB0YXJnZXQsIG9wdHMsIGNhbGxiYWNrKTtcbn1cblxuY2xhc3MgU3luYyBleHRlbmRzIEVFIHtcbiAgY29uc3RydWN0b3Ioc3JjLCB0YXJnZXQsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmNhbmNlbGVkID0gZmFsc2U7XG5cbiAgICBjb25zdCBvcHRzUHVzaCA9IG9wdHMucHVzaCA/IE9iamVjdC5hc3NpZ24oe30sIG9wdHMsIG9wdHMucHVzaCkgOiBvcHRzO1xuICAgIGNvbnN0IG9wdHNQdWxsID0gb3B0cy5wdWxsID8gT2JqZWN0LmFzc2lnbih7fSwgb3B0cywgb3B0cy5wdWxsKSA6IG9wdHM7XG5cbiAgICB0aGlzLnB1c2ggPSByZXBsaWNhdGUoc3JjLCB0YXJnZXQsIG9wdHNQdXNoKTtcbiAgICB0aGlzLnB1bGwgPSByZXBsaWNhdGUodGFyZ2V0LCBzcmMsIG9wdHNQdWxsKTtcblxuICAgIHRoaXMucHVzaFBhdXNlZCA9IHRydWU7XG4gICAgdGhpcy5wdWxsUGF1c2VkID0gdHJ1ZTtcblxuICAgIGNvbnN0IHB1bGxDaGFuZ2UgPSAoY2hhbmdlKSA9PiB7XG4gICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHtcbiAgICAgICAgZGlyZWN0aW9uOiAncHVsbCcsXG4gICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHB1c2hDaGFuZ2UgPSAoY2hhbmdlKSA9PiB7XG4gICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHtcbiAgICAgICAgZGlyZWN0aW9uOiAncHVzaCcsXG4gICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHB1c2hEZW5pZWQgPSAoZG9jKSA9PiB7XG4gICAgICB0aGlzLmVtaXQoJ2RlbmllZCcsIHtcbiAgICAgICAgZGlyZWN0aW9uOiAncHVzaCcsXG4gICAgICAgIGRvYzogZG9jXG4gICAgICB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHB1bGxEZW5pZWQgPSAoZG9jKSA9PiB7XG4gICAgICB0aGlzLmVtaXQoJ2RlbmllZCcsIHtcbiAgICAgICAgZGlyZWN0aW9uOiAncHVsbCcsXG4gICAgICAgIGRvYzogZG9jXG4gICAgICB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHB1c2hQYXVzZWQgPSAoKSA9PiB7XG4gICAgICB0aGlzLnB1c2hQYXVzZWQgPSB0cnVlO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAodGhpcy5wdWxsUGF1c2VkKSB7XG4gICAgICAgIHRoaXMuZW1pdCgncGF1c2VkJyk7XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBwdWxsUGF1c2VkID0gKCkgPT4ge1xuICAgICAgdGhpcy5wdWxsUGF1c2VkID0gdHJ1ZTtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKHRoaXMucHVzaFBhdXNlZCkge1xuICAgICAgICB0aGlzLmVtaXQoJ3BhdXNlZCcpO1xuICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgcHVzaEFjdGl2ZSA9ICgpID0+IHtcbiAgICAgIHRoaXMucHVzaFBhdXNlZCA9IGZhbHNlO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAodGhpcy5wdWxsUGF1c2VkKSB7XG4gICAgICAgIHRoaXMuZW1pdCgnYWN0aXZlJywge1xuICAgICAgICAgIGRpcmVjdGlvbjogJ3B1c2gnXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgcHVsbEFjdGl2ZSA9ICgpID0+IHtcbiAgICAgIHRoaXMucHVsbFBhdXNlZCA9IGZhbHNlO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAodGhpcy5wdXNoUGF1c2VkKSB7XG4gICAgICAgIHRoaXMuZW1pdCgnYWN0aXZlJywge1xuICAgICAgICAgIGRpcmVjdGlvbjogJ3B1bGwnXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsZXQgcmVtb3ZlZCA9IHt9O1xuXG4gICAgY29uc3QgcmVtb3ZlQWxsID0gKHR5cGUpID0+IHsgLy8gdHlwZSBpcyAncHVzaCcgb3IgJ3B1bGwnXG4gICAgICByZXR1cm4gKGV2ZW50LCBmdW5jKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzQ2hhbmdlID0gZXZlbnQgPT09ICdjaGFuZ2UnICYmXG4gICAgICAgICAgKGZ1bmMgPT09IHB1bGxDaGFuZ2UgfHwgZnVuYyA9PT0gcHVzaENoYW5nZSk7XG4gICAgICAgIGNvbnN0IGlzRGVuaWVkID0gZXZlbnQgPT09ICdkZW5pZWQnICYmXG4gICAgICAgICAgKGZ1bmMgPT09IHB1bGxEZW5pZWQgfHwgZnVuYyA9PT0gcHVzaERlbmllZCk7XG4gICAgICAgIGNvbnN0IGlzUGF1c2VkID0gZXZlbnQgPT09ICdwYXVzZWQnICYmXG4gICAgICAgICAgKGZ1bmMgPT09IHB1bGxQYXVzZWQgfHwgZnVuYyA9PT0gcHVzaFBhdXNlZCk7XG4gICAgICAgIGNvbnN0IGlzQWN0aXZlID0gZXZlbnQgPT09ICdhY3RpdmUnICYmXG4gICAgICAgICAgKGZ1bmMgPT09IHB1bGxBY3RpdmUgfHwgZnVuYyA9PT0gcHVzaEFjdGl2ZSk7XG5cbiAgICAgICAgaWYgKGlzQ2hhbmdlIHx8IGlzRGVuaWVkIHx8IGlzUGF1c2VkIHx8IGlzQWN0aXZlKSB7XG4gICAgICAgICAgaWYgKCEoZXZlbnQgaW4gcmVtb3ZlZCkpIHtcbiAgICAgICAgICAgIHJlbW92ZWRbZXZlbnRdID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlbW92ZWRbZXZlbnRdW3R5cGVdID0gdHJ1ZTtcbiAgICAgICAgICBpZiAoT2JqZWN0LmtleXMocmVtb3ZlZFtldmVudF0pLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgLy8gYm90aCBwdXNoIGFuZCBwdWxsIGhhdmUgYXNrZWQgdG8gYmUgcmVtb3ZlZFxuICAgICAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoZXZlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgaWYgKG9wdHMubGl2ZSkge1xuICAgICAgdGhpcy5wdXNoLm9uKCdjb21wbGV0ZScsIHRoaXMucHVsbC5jYW5jZWwuYmluZCh0aGlzLnB1bGwpKTtcbiAgICAgIHRoaXMucHVsbC5vbignY29tcGxldGUnLCB0aGlzLnB1c2guY2FuY2VsLmJpbmQodGhpcy5wdXNoKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkT25lTGlzdGVuZXIoZWUsIGV2ZW50LCBsaXN0ZW5lcikge1xuICAgICAgaWYgKGVlLmxpc3RlbmVycyhldmVudCkuaW5kZXhPZihsaXN0ZW5lcikgPT0gLTEpIHtcbiAgICAgICAgZWUub24oZXZlbnQsIGxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm9uKCduZXdMaXN0ZW5lcicsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgaWYgKGV2ZW50ID09PSAnY2hhbmdlJykge1xuICAgICAgICBhZGRPbmVMaXN0ZW5lcih0aGlzLnB1bGwsICdjaGFuZ2UnLCBwdWxsQ2hhbmdlKTtcbiAgICAgICAgYWRkT25lTGlzdGVuZXIodGhpcy5wdXNoLCAnY2hhbmdlJywgcHVzaENoYW5nZSk7XG4gICAgICB9IGVsc2UgaWYgKGV2ZW50ID09PSAnZGVuaWVkJykge1xuICAgICAgICBhZGRPbmVMaXN0ZW5lcih0aGlzLnB1bGwsICdkZW5pZWQnLCBwdWxsRGVuaWVkKTtcbiAgICAgICAgYWRkT25lTGlzdGVuZXIodGhpcy5wdXNoLCAnZGVuaWVkJywgcHVzaERlbmllZCk7XG4gICAgICB9IGVsc2UgaWYgKGV2ZW50ID09PSAnYWN0aXZlJykge1xuICAgICAgICBhZGRPbmVMaXN0ZW5lcih0aGlzLnB1bGwsICdhY3RpdmUnLCBwdWxsQWN0aXZlKTtcbiAgICAgICAgYWRkT25lTGlzdGVuZXIodGhpcy5wdXNoLCAnYWN0aXZlJywgcHVzaEFjdGl2ZSk7XG4gICAgICB9IGVsc2UgaWYgKGV2ZW50ID09PSAncGF1c2VkJykge1xuICAgICAgICBhZGRPbmVMaXN0ZW5lcih0aGlzLnB1bGwsICdwYXVzZWQnLCBwdWxsUGF1c2VkKTtcbiAgICAgICAgYWRkT25lTGlzdGVuZXIodGhpcy5wdXNoLCAncGF1c2VkJywgcHVzaFBhdXNlZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLm9uKCdyZW1vdmVMaXN0ZW5lcicsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgaWYgKGV2ZW50ID09PSAnY2hhbmdlJykge1xuICAgICAgICB0aGlzLnB1bGwucmVtb3ZlTGlzdGVuZXIoJ2NoYW5nZScsIHB1bGxDaGFuZ2UpO1xuICAgICAgICB0aGlzLnB1c2gucmVtb3ZlTGlzdGVuZXIoJ2NoYW5nZScsIHB1c2hDaGFuZ2UpO1xuICAgICAgfSBlbHNlIGlmIChldmVudCA9PT0gJ2RlbmllZCcpIHtcbiAgICAgICAgdGhpcy5wdWxsLnJlbW92ZUxpc3RlbmVyKCdkZW5pZWQnLCBwdWxsRGVuaWVkKTtcbiAgICAgICAgdGhpcy5wdXNoLnJlbW92ZUxpc3RlbmVyKCdkZW5pZWQnLCBwdXNoRGVuaWVkKTtcbiAgICAgIH0gZWxzZSBpZiAoZXZlbnQgPT09ICdhY3RpdmUnKSB7XG4gICAgICAgIHRoaXMucHVsbC5yZW1vdmVMaXN0ZW5lcignYWN0aXZlJywgcHVsbEFjdGl2ZSk7XG4gICAgICAgIHRoaXMucHVzaC5yZW1vdmVMaXN0ZW5lcignYWN0aXZlJywgcHVzaEFjdGl2ZSk7XG4gICAgICB9IGVsc2UgaWYgKGV2ZW50ID09PSAncGF1c2VkJykge1xuICAgICAgICB0aGlzLnB1bGwucmVtb3ZlTGlzdGVuZXIoJ3BhdXNlZCcsIHB1bGxQYXVzZWQpO1xuICAgICAgICB0aGlzLnB1c2gucmVtb3ZlTGlzdGVuZXIoJ3BhdXNlZCcsIHB1c2hQYXVzZWQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5wdWxsLm9uKCdyZW1vdmVMaXN0ZW5lcicsIHJlbW92ZUFsbCgncHVsbCcpKTtcbiAgICB0aGlzLnB1c2gub24oJ3JlbW92ZUxpc3RlbmVyJywgcmVtb3ZlQWxsKCdwdXNoJykpO1xuXG4gICAgY29uc3QgcHJvbWlzZSA9IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMucHVzaCxcbiAgICAgIHRoaXMucHVsbFxuICAgIF0pLnRoZW4oKHJlc3ApID0+IHtcbiAgICAgIGNvbnN0IG91dCA9IHtcbiAgICAgICAgcHVzaDogcmVzcFswXSxcbiAgICAgICAgcHVsbDogcmVzcFsxXVxuICAgICAgfTtcbiAgICAgIHRoaXMuZW1pdCgnY29tcGxldGUnLCBvdXQpO1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG91dCk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgcmV0dXJuIG91dDtcbiAgICB9LCAoZXJyKSA9PiB7XG4gICAgICB0aGlzLmNhbmNlbCgpO1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIC8vIGlmIHRoZXJlJ3MgYSBjYWxsYmFjaywgdGhlbiB0aGUgY2FsbGJhY2sgY2FuIHJlY2VpdmVcbiAgICAgICAgLy8gdGhlIGVycm9yIGV2ZW50XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiB0aGVyZSdzIG5vIGNhbGxiYWNrLCB0aGVuIHdlJ3JlIHNhZmUgdG8gZW1pdCBhbiBlcnJvclxuICAgICAgICAvLyBldmVudCwgd2hpY2ggd291bGQgb3RoZXJ3aXNlIHRocm93IGFuIHVuaGFuZGxlZCBlcnJvclxuICAgICAgICAvLyBkdWUgdG8gJ2Vycm9yJyBiZWluZyBhIHNwZWNpYWwgZXZlbnQgaW4gRXZlbnRFbWl0dGVyc1xuICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgLy8gbm8gc2Vuc2UgdGhyb3dpbmcgaWYgd2UncmUgYWxyZWFkeSBlbWl0dGluZyBhbiAnZXJyb3InIGV2ZW50XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMudGhlbiA9IGZ1bmN0aW9uIChzdWNjZXNzLCBlcnIpIHtcbiAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oc3VjY2VzcywgZXJyKTtcbiAgICB9O1xuXG4gICAgdGhpcy5jYXRjaCA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIHJldHVybiBwcm9taXNlLmNhdGNoKGVycik7XG4gICAgfTtcbiAgfVxuXG4gIGNhbmNlbCgpIHtcbiAgICBpZiAoIXRoaXMuY2FuY2VsZWQpIHtcbiAgICAgIHRoaXMuY2FuY2VsZWQgPSB0cnVlO1xuICAgICAgdGhpcy5wdXNoLmNhbmNlbCgpO1xuICAgICAgdGhpcy5wdWxsLmNhbmNlbCgpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgcmVwbGljYXRlIH0gZnJvbSAnLi9yZXBsaWNhdGVXcmFwcGVyJztcbmltcG9ydCBzeW5jIGZyb20gJy4vc3luYyc7XG5cbmZ1bmN0aW9uIHJlcGxpY2F0aW9uKFBvdWNoREIpIHtcbiAgUG91Y2hEQi5yZXBsaWNhdGUgPSByZXBsaWNhdGU7XG4gIFBvdWNoREIuc3luYyA9IHN5bmM7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFBvdWNoREIucHJvdG90eXBlLCAncmVwbGljYXRlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLnJlcGxpY2F0ZU1ldGhvZHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMucmVwbGljYXRlTWV0aG9kcyA9IHtcbiAgICAgICAgICBmcm9tOiBmdW5jdGlvbiAob3RoZXIsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5jb25zdHJ1Y3Rvci5yZXBsaWNhdGUob3RoZXIsIHNlbGYsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRvOiBmdW5jdGlvbiAob3RoZXIsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5jb25zdHJ1Y3Rvci5yZXBsaWNhdGUoc2VsZiwgb3RoZXIsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5yZXBsaWNhdGVNZXRob2RzO1xuICAgIH1cbiAgfSk7XG5cbiAgUG91Y2hEQi5wcm90b3R5cGUuc3luYyA9IGZ1bmN0aW9uIChkYk5hbWUsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3Iuc3luYyh0aGlzLCBkYk5hbWUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcmVwbGljYXRpb247Il0sIm5hbWVzIjpbIm5leHRUaWNrIiwicmVwbGljYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVBLFNBQVMsY0FBYyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFO0FBQ3ZELEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxZQUFZO0FBQy9CLFNBQVMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztBQUN6QyxTQUFTLFFBQVEsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMs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SUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQztBQUN4RCxFQUFFLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzNCLEVBQUUsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDakMsRUFBRSxPQUFPLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFDRDtBQUNBLE1BQU0sSUFBSSxTQUFTLEVBQUUsQ0FBQztBQUN0QixFQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDM0MsSUFBSSxLQUFLLEVBQUUsQ0FBQztBQUNaLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7QUFDMUI7QUFDQSxJQUFJLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDM0UsSUFBSSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQzNFO0FBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHQyxnQkFBUyxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDakQsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHQSxnQkFBUyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDakQ7QUFDQSxJQUFJLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQzNCLElBQUksSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7QUFDM0I7QUFDQSxJ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
