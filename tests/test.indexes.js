/*jshint expr:true */
'use strict';

describe('plugin indexes', function () {

  var dbs = {};

  beforeEach(function (done) {
    dbs.name = testUtils.adapterUrl('local', 'test_indexes');
    testUtils.cleanup([dbs.name], done);
  });

  afterEach(function (done) {
    testUtils.cleanup([dbs.name], done);
  });

  it('Test basic index', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.get();
      }).then(function (results) {
        results.should.have.length(3);
        should.equal(results[0].id, 'fooDoc');
        should.equal(results[1].id, 'fooDoc');
        should.equal(results[2].id, 'fooDoc');
        should.equal(results[0].key, '1');
        should.equal(results[1].key, '2');
        should.equal(results[2].key, '3');
        should.equal(results[0].value, 'one');
        should.equal(results[1].value, 'two');
        should.equal(results[2].value, 'three');

        return index.get('1');
      }).then(function (results) {
        results.should.have.length(3);
        return index.get('2');
      }).then(function (results) {
        results.should.have.length(2);
        return index.get('3');
      }).then(function (results) {
        results.should.have.length(1);
        return index.get('0');
      }).then(function (results) {
        results.should.have.length(3);
        return index.get('4');
      }).then(function (results) {
        results.should.have.length(0);
        done();
      }).catch(function (err) {
        should.not.exist(err);
        done();
      });
    }).catch(function (err) {
      should.not.exist(err);
      done();
    });
  });
});