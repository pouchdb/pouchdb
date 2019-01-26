'use strict';

module.exports = function (PouchDB, opts, callback) {

  var utils = require('./utils');

  function makeTestDocs() {
    var docs = [];
    for (var i = 0; i < 10000; i++) {
      docs.push({
        key: i % 1337,
        even: i % 2 === 0,
        random: Math.random(),
        str: ['foo', 'bar', 'smang', 'foobar'][i % 3]
      });
    }
    return docs;
  }

  var testCases = [
    {
      name: 'create-index',
      assertions: 1,
      iterations: 1,
      setup: function (db, callback) {
        db.bulkDocs(makeTestDocs())
          .then(function () {
            callback();
          }, callback);
      },
      test: function (db, itr, doc, done) {
        db.createIndex({
          index: {
            fields: ['key']
          }
        }).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'simple-find-query',
      assertions: 1,
      iterations: 5,
      setup: function (db, callback) {
        db.bulkDocs(makeTestDocs())
          .then(function () {
            return db.createIndex({
              index: {
                fields: ['key']
              }
            });
          }).then(function () {
            callback();
          }, callback);
      },
      test: function (db, itr, doc, done) {
        db.find({
          selector: { key: 'foo'}
        }).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'simple-find-query-no-index',
      assertions: 1,
      iterations: 5,
      setup: function (db, callback) {
        db.bulkDocs(makeTestDocs())
          .then(function () {
            callback();
          }, callback);
      },
      test: function (db, itr, doc, done) {
        db.find({
          selector: { key: 'foo'}
        }).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'complex-find-query',
      assertions: 1,
      iterations: 5,
      setup: function (db, callback) {
        db.bulkDocs(makeTestDocs())
          .then(function () {
            return db.createIndex({
              index: {
                fields: ['key']
              }
            });
          }).then(function () {
            callback();
          }, callback);
      },
      test: function (db, itr, doc, done) {
        db.find({
          selector: {
            $and: [
              {key: { $gt: 4 }},
              {key: { $ne: 7 }}
            ]
          }
        }).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'complex-find-query-no-index',
      assertions: 1,
      iterations: 5,
      setup: function (db, callback) {
        db.bulkDocs(makeTestDocs())
          .then(function () {
            callback();
          }, callback);
      },
      test: function (db, itr, doc, done) {
        db.find({
          selector: {
            $and: [
              {key: { $gt: 4 }},
              {key: { $ne: 7 }}
            ]
          }
        }).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'multi-field-query',
      assertions: 1,
      iterations: 5,
      setup: function (db, callback) {
        db.bulkDocs(makeTestDocs())
          .then(function () {
            return db.createIndex({
              index: {
                fields: ['key']
              }
            });
          }).then(function () {
            callback();
          }, callback);
      },
      test: function (db, itr, doc, done) {
        db.find({
          selector: {
            key: { $gt: 5 },
            str: 'foo'
          }
        }).then(function () {
          done();
        }, done);
      }
    }
  ];

  utils.runTests(PouchDB, 'find', testCases, opts, callback);
};
