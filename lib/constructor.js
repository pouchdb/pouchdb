"use strict";

var Adapter = require('./adapter')(PouchDB);
var utils = require('./utils');
var Promise = typeof global.Promise === 'function' ? global.Promise : require('bluebird');

function defaultCallback(err) {
  if (err) {
    process.nextTick(function () {
      throw err;
    });
  }
}

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
    callback = defaultCallback;
  }
  var oldCB = callback;
  var promise = new Promise(function (fulfill, reject) {
    callback = function (err, resp) {
      if (err) {
        return reject(err);
      }
      delete resp.then;
      fulfill(resp);
    };
  });
  promise.then(function (resp) {
    oldCB(null, resp);
  }, oldCB);
  this.then = promise.then.bind(promise);
  //prevent deoptimizing
  (function () {
    try {
      self.catch = promise.catch.bind(promise);
    } catch (e) {}
  }());
  opts = utils.extend(true, {}, opts);
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

  var adapter = new Adapter(opts, function (err) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return;
    }

    for (var plugin in PouchDB.plugins) {
      if (PouchDB.plugins.hasOwnProperty(plugin)) {
        // In future these will likely need to be async to allow the plugin
        // to initialise
        var pluginObj = PouchDB.plugins[plugin](self);
        for (var api in pluginObj) {
          if (pluginObj.hasOwnProperty(api)) {
            // We let things like the http adapter use its own implementation
            // as it shares a lot of code
            if (!(api in self)) {
              self[api] = pluginObj[api];
            }
          }
        }
      }
    }

    self.taskqueue.ready(true);
    self.taskqueue.execute(self);
    callback(null, self);
  });
  for (var j in adapter) {
    if (adapter.hasOwnProperty(j)) {
      this[j] = adapter[j];
    }
  }
  for (var plugin in PouchDB.plugins) {
    if (PouchDB.plugins.hasOwnProperty(plugin)) {

      // In future these will likely need to be async to allow the plugin
      // to initialise
      var pluginObj = PouchDB.plugins[plugin](this);
      for (var api in pluginObj) {
        if (pluginObj.hasOwnProperty(api)) {
          // We let things like the http adapter use its own implementation
          // as it shares a lot of code
          if (!(api in this)) {
            this[api] = pluginObj[api];
          }
        }
      }
    }
  }
}

module.exports = PouchDB;
