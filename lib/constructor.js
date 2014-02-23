/*globals cordova */
"use strict";

var Adapter = require('./adapter');
var utils = require('./utils');
var Promise = typeof global.Promise === 'function' ? global.Promise : require('bluebird');

function defaultCallback(err) {
  if (err && global.debug) {
    console.error(err);
  }
}
function makeFailFunction(error) {
  return utils.toPromise(function () {
    arguments[arguments.length - 1](error);
  });
}
utils.inherits(PouchDB, Adapter);
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
  opts = opts || {};
  var oldCB = callback;
  self.auto_compaction = opts.auto_compaction;
  self.prefix = PouchDB.prefix;
  Adapter.call(self);
  var taskqueue = {};

  taskqueue.ready = false;
  taskqueue.failed = false;
  taskqueue.queue = [];

  self.taskqueue = {};

  self.taskqueue.execute = function (db) {
    var d;
    if (taskqueue.failed) {
      while ((d = taskqueue.queue.shift())) {
        d.parameters[d.parameters.length - 1](this.failed);
      }
    } else if (taskqueue.ready) {
      while ((d = taskqueue.queue.shift())) {
        d.task = db[d.name].apply(db, d.parameters);
      }
    }
  };
  self.taskqueue.fail = function (err) {
    taskqueue.failed = err;
    this.taskqueue.execute();
  };

  self.taskqueue.ready = function () {
    if (taskqueue.failed) {
      return false;
    } else if (arguments.length === 0) {
      return taskqueue.ready;
    }
    taskqueue.ready = arguments[0];
  };

  self.taskqueue.addTask = function (name, parameters) {
    var task = { name: name, parameters: parameters };
    taskqueue.queue.push(task);
    if (taskqueue.failed) {
      this.taskqueue.execute();
    }
    return task;
  };
  var promise = new Promise(function (fulfill, reject) {
    callback = function (err, resp) {
      if (err) {
        return reject(err);
      }
      delete resp.then;
      fulfill(resp);
    };
  
    opts = utils.extend(true, {}, opts);
    var originalName = opts.name || name;
    var backend, error;
    (function () {
      try {

        if (typeof originalName !== 'string') {
          error = new Error('Missing/invalid DB name');
          error.code = 400;
          throw error;
        }

        backend = PouchDB.parseAdapter(originalName);
        
        opts.originalName = originalName;
        opts.name = backend.name;
        opts.adapter = opts.adapter || backend.adapter;

        if (!PouchDB.adapters[opts.adapter]) {
          error = new Error('Adapter is missing');
          error.code = 404;
          throw error;
        }

        if (!PouchDB.adapters[opts.adapter].valid()) {
          error = new Error('Invalid Adapter');
          error.code = 404;
          throw error;
        }
      } catch (err) {
        self.put = self.get = self.post = self.bulkDocs = makeFailFunction(err);
        self.allDocs = self.putAttachment = self.removeAttachment = self.put;
        self.remove = self.revsDiff = self.getAttachment = self.put;
        self.replicate = {};
        self.replicate.to = self.replicate.from = self.put;
        self.id = self.info = self.compact = self.put;
        self.changes = utils.toPromise(function (opts) {
          if (opts.complete) {
            opts.complete(err);
          }
        });
      }
    }());
    if (error) {
      return reject(error); // constructor error, see above
    }
    self.adapter = opts.adapter;
    // needs access to PouchDB;
    self.replicate = PouchDB.replicate.bind(self, self);
    self.replicate.from = function (url, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      return PouchDB.replicate(url, self, opts, callback);
    };

    self.replicate.to = function (dbName, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      return self.replicate(dbName, opts, callback);
    };

    self.replicate.sync = function (dbName, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      return PouchDB.sync(self, dbName, opts, callback);
    };
    self.destroy = utils.toPromise(function (callback) {
      var self = this;
      if (!self.taskqueue.ready()) {
        self.taskqueue.addTask('destroy', arguments);
        return;
      }
      self.id(function (err, id) {
        if (err) {
          return callback(err);
        }
        PouchDB.destroy(id, callback);
      });
    });
    PouchDB.adapters[opts.adapter].call(self, opts, function (err, db) {
      if (err) {
        if (callback) {
          callback(err);
        }
        return;
      }
      self.taskqueue.ready(true);
      self.taskqueue.execute(self);
      callback(null, self);
      
    });
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
    if (opts.skipSetup) {
      self.taskqueue.ready(true);
      self.taskqueue.execute(this);
    }

    if (utils.isCordova()) {
      //to inform websql adapter that we can use api
      cordova.fireWindowEvent(opts.name + "_pouch", {});
    }
  });
  promise.then(function (resp) {
    oldCB(null, resp);
  }, oldCB);
  self.then = promise.then.bind(promise);
  //prevent deoptimizing
  (function () {
    try {
      self.catch = promise.catch.bind(promise);
    } catch (e) {}
  }());
}

module.exports = PouchDB;
