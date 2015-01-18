'use strict';

var utils = require('../utils');
var upsert = require('pouchdb-upsert');
var callbackify = utils.callbackify;

function putIfNotExists(db, doc) {
  return upsert.putIfNotExists.call(db, doc);
}

function createIndex(db, requestDef) {

  var md5 = utils.MD5(JSON.stringify(requestDef));

  return putIfNotExists(db, {
    _id: '_design/' + md5
  }).then(function (res) {
    return {result: res.updated ? 'created' : 'exists'};
  });
}

function find(db, requestDef) {
  throw new Error('not implemented');
}

function getIndexes(db) {
  throw new Error('not implemented');
}

function deleteIndex(db, indexDef) {
  throw new Error('not implemented');
}

exports.createIndex = callbackify(createIndex);
exports.find = callbackify(find);
exports.getIndexes = callbackify(getIndexes);
exports.deleteIndex = callbackify(deleteIndex);