'use strict';

var PouchDB = require('../constructor');
var destroyQueue = [];
var destroyInProgress = false;

function destroyNext() {
  if (destroyInProgress || !destroyQueue.length) {
    return;
  }
  destroyInProgress = true;
  var task = destroyQueue.shift();
  function callback(err, resp) {
    task.callback(err, resp);
    destroyInProgress = false;
    destroyNext();
  }
  new PouchDB(task.name, {adapter : task.adapter}, function (err, db) {
    if (err) {
      return callback(err);
    }
    db.destroy(task.opts, callback);
  });
}

function destroyPouch(name, adapter, opts, callback) {
  destroyQueue.push({
    name : name,
    adapter : adapter,
    opts : opts,
    callback : callback
  });
  destroyNext();
}

module.exports = destroyPouch;

