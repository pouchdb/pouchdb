"use strict";

var Adapter = require('./adapter');
var utils = require('./utils');
function PouchDB(name, opts, callback) {

  if (!(this instanceof PouchDB)) {
    return new PouchDB(name, opts, callback);
  }
  var self = this;
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
  opts = utils.extend(true, {}, opts);
  var originalName = opts.name || name;
  var backend = this.parseAdapter(originalName);
  
  opts.originalName = originalName;
  opts.name = backend.name;
  opts.adapter = opts.adapter || backend.adapter;

  if (!this.adapters[opts.adapter]) {
    throw 'Adapter is missing';
  }

  if (!this.adapters[opts.adapter].valid()) {
    throw 'Invalid Adapter';
  }
  var adapter = Adapter.call(self, opts, function (err, db) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return;
    }

    for (var plugin in self.plugins) {
      // In future these will likely need to be async to allow the plugin
      // to initialise
      var pluginObj = self.plugins[plugin](db);
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
  for (var plugin in self.plugins) {
    // In future these will likely need to be async to allow the plugin
    // to initialise
    var pluginObj = self.plugins[plugin](self);
    for (var api in pluginObj) {
      // We let things like the http adapter use its own implementation
      // as it shares a lot of code
      if (!(api in self)) {
        self[api] = pluginObj[api];
      }
    }
  }
}
PouchDB.prototype = Object.create(Adapter);
module.exports = PouchDB;