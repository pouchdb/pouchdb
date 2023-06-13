"use strict";

var Promise = require('pouchdb-promise');
var utils = require('./utils');

var resolved = Promise.resolve();

function DaemonManager() {
  // There are a few things express-pouchdb needs to do outside of
  // requests. These things can't get a PouchDB object from the request
  // like other code does. Instead, they register themselves here and
  // get an object passed in. By providing both a start and stop
  // function, it is possible to switch PouchDB objects on the fly.
  this._daemons = [];
}

DaemonManager.prototype.registerDaemon = function (daemon) {
  this._daemons.push(daemon);
};

['start', 'stop'].forEach(function (name) {
  DaemonManager.prototype[name] = function (PouchDB) {
    var funcs = this._daemons.map(function (daemon) {
      return daemon[name];
    });
    return utils.callAsyncRecursive(funcs, function (func, next) {
      return resolved.then(function () {
        return func(PouchDB);
      }).then(next);
    });
  };
});

module.exports = DaemonManager;
