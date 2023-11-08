import {
  clone,
  listenerCount,
  once,
  guardedConsole
} from 'pouchdb-utils';
import {
  isDeleted,
  collectLeaves,
  collectConflicts
} from 'pouchdb-merge';
import EE from 'events';


import PouchDB from './setup';

function tryCatchInChangeListener(self, change, pending, lastSeq) {
  // isolate try/catches to avoid V8 deoptimizations
  try {
    self.emit('change', change, pending, lastSeq);
  } catch (e) {
    guardedConsole('error', 'Error in .on("change", function):', e);
  }
}

function processChange(doc, metadata, opts) {
  var changeList = [{rev: doc._rev}];
  if (opts.style === 'all_docs') {
    changeList = collectLeaves(metadata.rev_tree)
    .map(function (x) { return {rev: x.rev}; });
  }
  var change = {
    id: metadata.id,
    changes: changeList,
    doc
  };

  if (isDeleted(metadata, doc._rev)) {
    change.deleted = true;
  }
  if (opts.conflicts) {
    change.doc._conflicts = collectConflicts(metadata);
    if (!change.doc._conflicts.length) {
      delete change.doc._conflicts;
    }
  }
  return change;
}

class Changes extends EE {
  constructor(db, opts, callback) {
    super();
    this.db = db;
    opts = opts ? clone(opts) : {};
    var complete = opts.complete = once((err, resp) => {
      if (err) {
        if (listenerCount(this, 'error') > 0) {
          this.emit('error', err);
        }
      } else {
        this.emit('complete', resp);
      }
      this.removeAllListeners();
      db.removeListener('destroyed', onDestroy);
    });
    if (callback) {
      this.on('complete', function (resp) {
        callback(null, resp);
      });
      this.on('error', callback);
    }
    const onDestroy = () => {
      this.cancel();
    };
    db.once('destroyed', onDestroy);

    opts.onChange = (change, pending, lastSeq) => {
      /* istanbul ignore if */
      if (this.isCancelled) {
        return;
      }
      tryCatchInChangeListener(this, change, pending, lastSeq);
    };

    var promise = new Promise(function (fulfill, reject) {
      opts.complete = function (err, res) {
        if (err) {
          reject(err);
        } else {
          fulfill(res);
        }
      };
    });
    this.once('cancel', function () {
      db.removeListener('destroyed', onDestroy);
      opts.complete(null, {status: 'cancelled'});
    });
    this.then = promise.then.bind(promise);
    this['catch'] = promise['catch'].bind(promise);
    this.then(function (result) {
      complete(null, result);
    }, complete);



    if (!db.taskqueue.isReady) {
      db.taskqueue.addTask((failed) => {
        if (failed) {
          opts.complete(failed);
        } else if (this.isCancelled) {
          this.emit('cancel');
        } else {
          this.validateChanges(opts);
        }
      });
    } else {
      this.validateChanges(opts);
    }
  }

  cancel() {
    this.isCancelled = true;
    if (this.db.taskqueue.isReady) {
      this.emit('cancel');
    }
  }

  validateChanges(opts) {
    var callback = opts.complete;

    /* istanbul ignore else */
    if (PouchDB._changesFilterPlugin) {
      PouchDB._changesFilterPlugin.validate(opts, (err) => {
        if (err) {
          return callback(err);
        }
        this.doChanges(opts);
      });
    } else {
      this.doChanges(opts);
    }
  }

  doChanges(opts) {
    var callback = opts.complete;

    opts = clone(opts);
    if ('live' in opts && !('continuous' in opts)) {
      opts.continuous = opts.live;
    }
    opts.processChange = processChange;

    if (opts.since === 'latest') {
      opts.since = 'now';
    }
    if (!opts.since) {
      opts.since = 0;
    }
    if (opts.since === 'now') {
      this.db.info().then((info) => {
        /* istanbul ignore if */
        if (this.isCancelled) {
          callback(null, {status: 'cancelled'});
          return;
        }
        opts.since = info.update_seq;
        this.doChanges(opts);
      }, callback);
      return;
    }

    /* istanbul ignore else */
    if (PouchDB._changesFilterPlugin) {
      PouchDB._changesFilterPlugin.normalize(opts);
      if (PouchDB._changesFilterPlugin.shouldFilter(this, opts)) {
        return PouchDB._changesFilterPlugin.filter(this, opts);
      }
    } else {
      ['doc_ids', 'filter', 'selector', 'view'].forEach(function (key) {
        if (key in opts) {
          guardedConsole('warn',
            'The "' + key + '" option was passed in to changes/replicate, ' +
            'but pouchdb-changes-filter plugin is not installed, so it ' +
            'was ignored. Please install the plugin to enable filtering.'
          );
        }
      });
    }

    if (!('descending' in opts)) {
      opts.descending = false;
    }

    // 0 and 1 should return 1 document
    opts.limit = opts.limit === 0 ? 1 : opts.limit;
    opts.complete = callback;
    var newPromise = this.db._changes(opts);
    /* istanbul ignore else */
    if (newPromise && typeof newPromise.cancel === 'function') {
      const cancel = this.cancel;
      this.cancel = (...args) => {
        newPromise.cancel();
        cancel.apply(this, args);
      };
    }
  }
}

export default Changes;
