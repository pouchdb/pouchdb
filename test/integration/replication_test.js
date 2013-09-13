/*globals require */

'use strict';

var PouchDB = require('../../');
var utils = require('../test.utils.js');
var opts = require('browserify-getopts');

var db1 = opts.db1 || 'testdb1';
var db2 = opts.db2 || 'testdb2';
var db3 = opts.db2 || 'testdb3';

var test = require('wrapping-tape')(utils.setupDb(db1, db2, db3));

test('Replicate without creating src', function(t) {
  t.plan(2);
  var db = new PouchDB(db1);
  var docs = [{a: 'doc'}, {anew: 'doc'}];
  db.bulkDocs({docs: docs}, function() {
    PouchDB.replicate(db1, db2, {complete: function(err, changes) {
      t.equal(changes.docs_written, docs.length, 'Docs written');
      PouchDB.replicate(db1, db3, {complete: function(err, changes) {
        t.equal(changes.docs_written, docs.length, 'Docs written');
      }});
    }});
  });
});