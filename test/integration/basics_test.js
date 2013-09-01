/*globals require, test: true */

// This is purely a stub file so we can test integration tests
// across node and the browser, the canonical integration tests
// are still held in /tests/ and ran as the documentation instructs

'use strict';

var PouchDB = require('../../');
var utils = require('../test.utils.js');
var opts = require('browserify-getopts');

var db1 = opts.db1 || 'testdb';
var test = require('wrapping-tape')(utils.setupDb(db1));

test('Post a document', function(t) {
  t.plan(1);
  var db = new PouchDB(db1);
  db.post({a: 'doc'}, function(err, res) {
    t.notOk(err, 'No error posting docs');
  });
});