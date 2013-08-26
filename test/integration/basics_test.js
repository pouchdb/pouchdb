/*globals require, test: true */

// This is purely a stub file so we can test integration tests
// across node and the browser, the canonical integration tests
// are still held in /tests/ and ran as the documentation instructs

'use strict';

var test = require('tape');
var PouchDB = require('../../');

var dbName = 'test';

test('Post a document', function(t) {
  t.plan(1);
  var db = new PouchDB(dbName);
  db.post({a: 'doc'}, function(err, res) {
    t.notOk(err, 'No error posting docs');
  });
});