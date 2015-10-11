'use strict';

var Promise = require('./promise');
var toPromise = require('./toPromise');
var getArguments = require('argsarray');
var errors = require('./errors');
var parseDoc = require('./docs/parseDoc');
var log = require('debug')('pouchdb:api');

function logApiCall(self, name, args) {
  /* istanbul ignore if */
  if (log.enabled) {
    var logArgs = [self._db_name, name];
    for (var i = 0; i < args.length - 1; i++) {
      logArgs.push(args[i]);
    }
    log.apply(null, logArgs);

    // override the callback itself to log the response
    var origCallback = args[args.length - 1];
    args[args.length - 1] = function (err, res) {
      var responseArgs = [self._db_name, name];
      responseArgs = responseArgs.concat(
        err ? ['error', err] : ['success', res]
      );
      log.apply(null, responseArgs);
      origCallback(err, res);
    };
  }
}

function massagePutOrPostArgs(name, args) {
  var temp, temptype, opts;
  var doc = args.shift();
  var callback = args.pop();
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    return callback(errors.error(errors.NOT_AN_OBJECT));
  }

  if (name === 'put') {
    parseDoc.invalidIdError(doc._id);
  }

  var id = '_id' in doc;
  while (true) {
    temp = args.shift();
    temptype = typeof temp;
    if (temptype === "string" && !id) {
      doc._id = temp;
      id = true;
    } else if (temptype === "string" && id && !('_rev' in doc)) {
      doc._rev = temp;
    } else if (temptype === "object") {
      opts = temp;
    }
    if (!args.length) {
      break;
    }
  }
  return args;
}

function massageArgs(name, args) {
  if (name === 'put' || name === 'post') {
    return massagePutOrPostArgs(args);
  }
  if (typeof args[args.length - 2] !== 'object') {
    args.splice(args.length - 1, 0, {});
  }
  return args;
}

module.exports = function adapterFun(name, callback) {
  return toPromise(getArguments(function (args) {
    if (this._closed) {
      return Promise.reject(new Error('database is closed'));
    }
    var self = this;
    args = massageArgs(name, args);
    logApiCall(self, name, args);
    if (!this.taskqueue.isReady) {
      return new Promise(function (fulfill, reject) {
        self.taskqueue.addTask(function (failed) {
          if (failed) {
            reject(failed);
          } else {
            fulfill(self[name].apply(self, args));
          }
        });
      });
    }
    return callback.apply(this, args);
  }));
};