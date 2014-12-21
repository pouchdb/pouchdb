'use strict';

var utils = require('./utils');

var httpIndexes = require('./adapters/http');
var localIndexes = require('./adapters/local');

exports.createIndex = utils.toPromise(function (requestDef, callback) {

  var adapter = this.type() === 'http' ? httpIndexes : localIndexes;

  adapter.createIndex(this, requestDef, callback);
});

exports.find = utils.toPromise(function (requestDef, callback) {

  var adapter = this.type() === 'http' ? httpIndexes : localIndexes;

  adapter.find(this, requestDef, callback);
});

exports.getIndexes = utils.toPromise(function (callback) {

  var adapter = this.type() === 'http' ? httpIndexes : localIndexes;

  adapter.getIndexes(this, callback);
});

exports.deleteIndex = utils.toPromise(function (indexDef, callback) {

  var adapter = this.type() === 'http' ? httpIndexes : localIndexes;

  adapter.deleteIndex(this, indexDef, callback);
});

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}
