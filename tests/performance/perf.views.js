'use strict';

module.exports = function (PouchDB, opts) {

  var Promise = require('lie');
  var utils = require('./utils');

  function makeTestDocs() {
    return [
      {key: null},
      {key: true},
      {key: false},
      {key: -1},
      {key: 0},
      {key: 1},
      {key: 2},
      {key: 3},
      {key: Math.random()},
      {key: 'bar' + Math.random()},
      {key: 'foo' + Math.random()},
      {key: 'foobar' + Math.random()}
    ];
  }

  var testCases = [
    {
      name: 'temp-views',
      assertions: 1,
      iterations: 1,
      setup: function (db, callback) {
        var tasks = [];
        for (var i = 0; i < 100; i++) {
          tasks.push(i);
        }
        Promise.all(tasks.map(function () {
          return db.bulkDocs({docs : makeTestDocs()});
        })).then(function () {
          callback();
        }, callback);
      },
      test: function (db, itr, doc, done) {
        var tasks = [
          {startkey: 'foo', limit: 5},
          {startkey: 'foobar', limit: 5},
          {startkey: 'foo', limit: 5},
          {startkey: -1, limit: 5},
          {startkey: null, limit: 5}
        ];
        Promise.all(tasks.map(function (task) {
          return db.query(function (doc) {
            emit(doc.key);
          }, task);
        })).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'persisted-views',
      assertions: 1,
      iterations: 10,
      setup: function (db, callback) {
        var tasks = [];
        for (var i = 0; i < 100; i++) {
          tasks.push(i);
        }
        Promise.all(tasks.map(function () {
          return db.bulkDocs({docs : makeTestDocs()});
        })).then(function () {
          return db.put({
            _id : '_design/myview',
            views : {
              myview : {
                map : function (doc) {
                  emit(doc.key);
                }.toString()
              }
            }
          });
        }).then(function () {
          return db.query('myview/myview');
        }).then(function () {
          callback();
        }, callback);
      },
      test: function (db, itr, doc, done) {
        var tasks = [
          {startkey: 'foo', limit: 5},
          {startkey: 'foobar', limit: 5},
          {startkey: 'foo', limit: 5},
          {startkey: -1, limit: 5},
          {startkey: null, limit: 5}
        ];
        Promise.all(tasks.map(function (task) {
            return db.query('myview/myview', task);
          })).then(function () {
            done();
          }, done);
      }
    },
    {
      name: 'persisted-views-stale-ok',
      assertions: 1,
      iterations: 10,
      setup: function (db, callback) {
        var tasks = [];
        for (var i = 0; i < 100; i++) {
          tasks.push(i);
        }
        Promise.all(tasks.map(function () {
            return db.bulkDocs({docs : makeTestDocs()});
          })).then(function () {
            return db.put({
              _id : '_design/myview',
              views : {
                myview : {
                  map : function (doc) {
                    emit(doc.key);
                  }.toString()
                }
              }
            });
          }).then(function () {
            return db.query('myview/myview');
          }).then(function () {
            callback();
          }, callback);
      },
      test: function (db, itr, doc, done) {
        var tasks = [
          {startkey: 'foo', limit: 5, stale : 'ok'},
          {startkey: 'foobar', limit: 5, stale : 'ok'},
          {startkey: 'foo', limit: 5, stale : 'ok'},
          {startkey: -1, limit: 5, stale : 'ok'},
          {startkey: null, limit: 5, stale : 'ok'}
        ];
        Promise.all(tasks.map(function (task) {
            return db.query('myview/myview', task);
          })).then(function () {
            done();
          }, done);
      }
    }
  ];

  utils.runTests(PouchDB, 'views', testCases, opts);

};
