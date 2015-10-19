'use strict';

var utils = require('./utils');

var httpIndexes = require('./adapters/http');
var localIndexes = require('./adapters/local');

exports.createIndex = utils.toPromise(function (requestDef, callback) {

  if (typeof requestDef !== 'object') {
    return callback(new Error('you must provide an index to create'));
  }

  var adapter = this.type() === 'http' ? httpIndexes : localIndexes;

  adapter.createIndex(this, requestDef, callback);
});

exports.find = utils.toPromise(function (requestDef, callback) {

  if (typeof callback === 'undefined') {
    callback = requestDef;
    requestDef = undefined;
  }

  if (typeof requestDef !== 'object') {
    return callback(new Error('you must provide search parameters to find()'));
  }

  var adapter = this.type() === 'http' ? httpIndexes : localIndexes;

  adapter.find(this, requestDef, callback);
});

exports.getIndexes = utils.toPromise(function (callback) {

  var adapter = this.type() === 'http' ? httpIndexes : localIndexes;

  adapter.getIndexes(this, callback);
});

exports.deleteIndex = utils.toPromise(function (indexDef, callback) {

  if (typeof indexDef !== 'object') {
    return callback(new Error('you must provide an index to delete'));
  }

  var adapter = this.type() === 'http' ? httpIndexes : localIndexes;

  adapter.deleteIndex(this, indexDef, callback);
});

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}
