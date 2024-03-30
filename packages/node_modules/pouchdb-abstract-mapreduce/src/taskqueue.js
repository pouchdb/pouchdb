/*
 * Simple task queue to sequentialize actions. Assumes
 * callbacks will eventually fire (once).
 */

class TaskQueue {
  constructor() {
    this.promise = Promise.resolve();
  }

  add(promiseFactory) {
    this.promise = this.promise
      // just recover
      .catch(() => { })
      .then(() => promiseFactory());
    return this.promise;
  }

  finish() {
    return this.promise;
  }
}

export default TaskQueue;
