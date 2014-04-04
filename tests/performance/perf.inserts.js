'use strict';

var PouchDB = require('../..');
var test = require('tape');
var reporter = require('./perf.reporter');

test('benchmarking', function (t) {

  var db;

  t.test('setup', function (t) {
    new PouchDB('test').then(function (d) {
      db = d;
      reporter.start('inserts');
      t.end();
    });
  });

  t.test('basic-inserts', function (t) {
    t.plan(1);
    var num = 100;
    function after(err) {
      if (err) {
        t.error(err);
      }
      num--;
      if (num) {
        process.nextTick(function () {
          db.put({'yo': 'dawg'}, '' + num, after);
        });
      } else {
        t.ok('Inserts completed');
      }
    }
    db.put({'yo': 'dawg'}, '' + num, after);
  });

  t.test('teardown', function (t) {
    reporter.end('inserts');
    db.destroy(function () {
      t.end();
      reporter.complete();
    });
  });
});
