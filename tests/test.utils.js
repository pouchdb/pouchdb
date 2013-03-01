/*globals extend: false */
"use strict";

var PERSIST_DATABASES = false;

function uuid() {
  var S4 = function() {
    return Math.floor(Math.random() * 0x10000).toString(16);
  };

  return (
    S4() + S4() + "-" +
      S4() + "-" +
      S4() + "-" +
      S4() + "-" +
      S4() + S4() + S4()
  );
}

function makeDocs(start, end, templateDoc) {
  var templateDocSrc = templateDoc ? JSON.stringify(templateDoc) : "{}";
  if (end === undefined) {
    end = start;
    start = 0;
  }
  var docs = [];
  for (var i = start; i < end; i++) {
    /*jshint evil:true */
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
    if (err && err.status !== 404 && err.statusText !== 'timeout') {
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

var testId = uuid();

function generateAdapterUrl(id) {
  var opt = id.split('-');
  if (opt[0] === 'local') {
    return 'testdb_' + testId + '_' + opt[1];
  }
  if (opt[0] === 'http') {
    return (typeof module !== 'undefined' && module.exports) ?
      'http://localhost:5984/testdb_' + testId + '_' + opt[1] :
      'http://localhost:2020/testdb_' + testId + '_' + opt[1];
  }
}


function putAfter(db, doc, prevRev, callback){
  var newDoc = extend({}, doc);
  newDoc._revisions = {
    start: +newDoc._rev.split('-')[0],
    ids: [
      newDoc._rev.split('-')[1],
      prevRev.split('-')[1]
    ]
  };
  db.put(newDoc, {new_edits: false}, callback);
}

if (typeof module !== 'undefined' && module.exports) {
  Pouch = require('../src/pouch.js');
  module.exports = {
    makeDocs: makeDocs,
    initTestDB: initTestDB,
    initDBPair: initDBPair,
    openTestDB: openTestDB,
    generateAdapterUrl: generateAdapterUrl,
    putAfter: putAfter,
    PERSIST_DATABASES: PERSIST_DATABASES
  };
}
