/*
 * Simple task queue to sequentialize actions. Assumes
 * callbacks will eventually fire (once).
 */

import Promise from '../deps/promise';

function TaskQueue() {
  this.promise = new Promise(function (fulfill) {fulfill(); });
}
TaskQueue.prototype.add = function (promiseFactory) {
  this.promise = this.promise.catch(function () {
    // just recover
  }).then(function () {
    return promiseFactory();
  });
  return this.promise;
};
TaskQueue.prototype.finish = function () {
  return this.promise;
};

export default TaskQueue;
