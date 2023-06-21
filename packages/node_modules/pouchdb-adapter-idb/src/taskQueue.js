// This task queue ensures that IDB open calls are done in their own tick
// and sequentially - i.e. we wait for the async IDB open to *fully* complete
// before calling the next one. This works around IE/Edge race conditions in IDB.

import { nextTick } from 'pouchdb-utils';

var running = false;
var queue = [];

function tryCode(fun, err, res, PouchDB) {
  try {
    fun(err, res);
  } catch (err) {
    // Shouldn't happen, but in some odd cases
    // IndexedDB implementations might throw a sync
    // error, in which case this will at least log it.
    PouchDB.emit('error', err);
  }
}

function applyNext() {
  if (running || !queue.length) {
    return;
  }
  running = true;
  queue.shift()();
}

function enqueueTask(action, callback, PouchDB) {
  queue.push(function runAction() {
    action(function runCallback(err, res) {
      tryCode(callback, err, res, PouchDB);
      running = false;
      nextTick(function runNext() {
        applyNext(PouchDB);
      });
    });
  });
  applyNext();
}

export {
  enqueueTask,
};
