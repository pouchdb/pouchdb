'use strict';

function createIndex(db, requestDef, callback) {
  callback(null, {not: 'implemented'});
}

function find(db, requestDef, callback) {
  callback(null, {not: 'implemented'});
}

function getIndexes(db, callback) {
  callback(null, {not: 'implemented'});
}

function deleteIndex(db, indexDef, callback) {
  callback(null, {not: 'implemented'});
}

exports.createIndex = createIndex;
exports.find = find;
exports.getIndexes = getIndexes;
exports.deleteIndex = deleteIndex;