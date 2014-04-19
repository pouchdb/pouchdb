'use strict';

module.exports = function (PouchDB, opts) {

  // need to use bluebird for promises everywhere, so we're comparing
  // apples to apples
  var Promise = require('bluebird');

  var utils = require('./utils');

  function createDocId(i) {
    var intString = i.toString();
    while (intString.length < 10) {
      intString = '0' + intString;
    }
    return 'doc_' + intString;
  }

  var testCases = [
    {
      name: 'basic-inserts',
      assertions: 1,
      iterations: 1000,
      setup: function (db, callback) {
        callback(null, {'yo': 'dawg'});
      },
      test: function (db, itr, doc, done) {
        db.post(doc, done);
      }
    }, {
      name: 'bulk-inserts',
      assertions: 1,
      iterations: 100,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 100; i++) {
          docs.push({much : 'docs', very : 'bulk'});
        }
        callback(null, {docs : docs});
      },
      test: function (db, itr, docs, done) {
        db.bulkDocs(docs, done);
      }
    }, {
      name: 'basic-gets',
      assertions: 1,
      iterations: 10000,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 10000; i++) {
          docs.push({_id : createDocId(i), foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs : docs}, callback);
      },
      test: function (db, itr, docs, done) {
        db.get(createDocId(itr), done);
      }
    }, {
      name: 'all-docs-skip-limit',
      assertions: 1,
      iterations: 50,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({_id : createDocId(i), foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs : docs}, callback);
      },
      test: function (db, itr, docs, done) {
        var tasks = [];
        for (var i = 0; i < 10; i++) {
          tasks.push(i);
        }
        Promise.all(tasks.map(function (doc, i) {
          return db.allDocs({skip : i * 100, limit : 10});
        })).then(function () {
          done();
        }, done);
      }
    }, {
      name: 'all-docs-startkey-endkey',
      assertions: 1,
      iterations: 50,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({_id : createDocId(i), foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs : docs}, callback);
      },
      test: function (db, itr, docs, done) {
        var tasks = [];
        for (var i = 0; i < 10; i++) {
          tasks.push(i);
        }
        Promise.all(tasks.map(function (doc, i) {
          return db.allDocs({
            startkey : createDocId(i * 100),
            endkey : createDocId((i * 100) + 10)
          });
        })).then(function () {
          done();
        }, done);
      }
    }
  ];

  utils.runTests(PouchDB, 'basics', testCases, opts);

};