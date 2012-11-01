"use strict";

function makeDocs(start, end, templateDoc) {
  var templateDocSrc = templateDoc ? JSON.stringify(templateDoc) : "{}";
  if (end === undefined) {
    end = start;
    start = 0;
  }
  var docs = [];
  for (var i = start; i < end; i++) {
    /* jshint: evil */
    var newDoc = eval("(" + templateDocSrc + ")");
    newDoc._id = (i).toString();
    newDoc.integer = i;
    newDoc.string = (i).toString();
    docs.push(newDoc);
  }
  return docs;
}

function openTestDB(name, callback) {
  new Pouch(name, function(err, db) {
    if (err) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
    callback.apply(this, arguments);
  });
}

function initTestDB(name, callback) {
  // ignore errors, the database might not exist
  Pouch.destroy(name, function(err) {
    if (err && err.status !== 404) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
    openTestDB(name, callback);
  });
}

function initDBPair(local, remote, callback) {
  initTestDB(local, function(err, localDb) {
    initTestDB(remote, function(err, remoteDb) {
      callback(localDb, remoteDb);
    });
  });
}

function generateAdapterUrl(id) {
  var opt = id.split('-');
  if (opt[0] === 'idb') {
    return 'idb://test_suite_db' + opt[1];
  }
  if (opt[0] === 'http') {
    return 'http://localhost:2020/test_suite_db' + opt[1];
  }
  if (opt[0] === 'ldb') {
    return 'ldb://testdb' + opt[1];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  var Pouch = require('../src/pouch.js');
  module.exports = {
    makeDocs: makeDocs,
    initTestDB: initTestDB,
    initDBPair: initDBPair,
    generateAdapterUrl: generateAdapterUrl
  }
}
