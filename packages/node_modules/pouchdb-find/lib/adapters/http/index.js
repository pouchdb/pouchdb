'use strict';

var massageCreateIndexRequest = require('../../massageCreateIndexRequest');

function createIndex(db, requestDef, callback) {
  requestDef = massageCreateIndexRequest(requestDef);

  db.request({
    method: 'POST',
    url: '_index',
    body: requestDef
  }, callback);
}

function find(db, requestDef, callback) {
  db.request({
    method: 'POST',
    url: '_find',
    body: requestDef
  }, callback);
}

function getIndexes(db, callback) {
  db.request({
    method: 'GET',
    url: '_index'
  }, callback);
}

function deleteIndex(db, indexDef, callback) {


  var ddoc = indexDef.ddoc;
  var type = indexDef.type || 'json';
  var name = indexDef.name;

  if (!ddoc) {
    return callback(new Error('you must provide an index\'s ddoc'));
  }

  if (!name) {
    return callback(new Error('you must provide an index\'s name'));
  }

  var url = '_index/' + [ddoc, type, name].map(encodeURIComponent).join('/');

  db.request({
    method: 'DELETE',
    url: url
  }, callback);
}

exports.createIndex = createIndex;
exports.find = find;
exports.getIndexes = getIndexes;
exports.deleteIndex = deleteIndex;