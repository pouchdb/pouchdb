"use strict";

var Promise = require('pouchdb-promise');
var utils = require('./utils');

function DatabaseWrapper() {
  // Databases can be wrapped to let them provide extra functionality.
  // Examples of this include document validation, authorisation, and
  // keeping track of the documents in _replicator.
  //
  // The logic of that is spread out through different parts of
  // express-pouchdb, all of which register their functionality on this
  // object. This way, the actual wrapping process is abstracted away.
  this._wrappers = [];
}
module.exports = DatabaseWrapper;

DatabaseWrapper.prototype.wrap = function (name, db) {
  if (typeof db === 'undefined') {
    throw new Error("no db defined!");
  }
  if (db.__wrappedByExpressPouch) {
    // dbs are cached, so it might already be wrapped
    return Promise.resolve(db);
  }
  db.__wrappedByExpressPouch = true;
  return utils.callAsyncRecursive(this._wrappers, function (wrapper, next) {
    return Promise.resolve(wrapper(name, db, next));
  }).then(function () {
    // https://github.com/pouchdb/pouchdb/issues/1940
    delete db.then;
    return db;
  });
};

DatabaseWrapper.prototype.registerWrapper = function (wrapper) {
  this._wrappers.push(wrapper);
};
