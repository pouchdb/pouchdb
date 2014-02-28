/*globals cordova */
"use strict";

var Adapter = require('./adapter');
var utils = require('./utils');
var Promise = typeof global.Promise === 'function' ? global.Promise : require('bluebird');
var TaskQueue = require('./taskqueue');

function defaultCallback(err) {
  if (err && global.debug) {
    console.error(err);
  }
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
  self.taskqueue = new TaskQueue();
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
        self.taskqueue.fail(err);
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
      if (!self.taskqueue.isReady) {
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
          self.taskqueue.fail(err);
          callback(err);
        }
        return;
      }
      function destructionListner(event) {
        if (event === 'destroyed') {
          self.emit('destroyed');
          PouchDB.removeListener(opts.name, destructionListner);
        }
      }
      PouchDB.on(opts.name, destructionListner);
      self.emit('created', self);
      PouchDB.emit('created', opts.originalName);
      self.taskqueue.ready(self);
      callback(null, self);
      
    });
    if (opts.skipSetup) {
      self.taskqueue.ready(self);
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
