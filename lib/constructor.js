"use strict";

var Adapter = require('./adapter')(PouchDB);
function PouchDB(name, opts, callback) {

  if (!(this instanceof PouchDB)) {
    return new PouchDB(name, opts, callback);
  }

  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (typeof name === 'object') {
    opts = name;
    name = undefined;
  }

  if (typeof callback === 'undefined') {
    callback = function () {};
  }

  var originalName = opts.name || name;
  var backend = PouchDB.parseAdapter(originalName);
  
  opts.originalName = originalName;
  opts.name = backend.name;
  opts.adapter = opts.adapter || backend.adapter;

  if (!PouchDB.adapters[opts.adapter]) {
    throw 'Adapter is missing';
  }

  if (!PouchDB.adapters[opts.adapter].valid()) {
    throw 'Invalid Adapter';
  }

  var adapter = new Adapter(opts, function (err, db) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return;
    }

    for (var plugin in PouchDB.plugins) {
      // In future these will likely need to be async to allow the plugin
      // to initialise
      var pluginObj = PouchDB.plugins[plugin](db);
      for (var api in pluginObj) {
        // We let things like the http adapter use its own implementation
        // as it shares a lot of code
        if (!(api in db)) {
          db[api] = pluginObj[api];
        }
      }
    }
    db.taskqueue.ready(true);
    db.taskqueue.execute(db);
    callback(null, db);
  });
  for (var j in adapter) {
    this[j] = adapter[j];
  }
  for (var plugin in PouchDB.plugins) {
    // In future these will likely need to be async to allow the plugin
    // to initialise
    var pluginObj = PouchDB.plugins[plugin](this);
    for (var api in pluginObj) {
      // We let things like the http adapter use its own implementation
      // as it shares a lot of code
      if (!(api in this)) {
        this[api] = pluginObj[api];
      }
    }
  }
}

module.exports = PouchDB;