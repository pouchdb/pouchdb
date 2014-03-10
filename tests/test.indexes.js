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

      return index.put('fooDoc', map).then(function () {
        return index.get();
      }).then(function (results) {
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '1',
            value: 'one'
          }, {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }, {
            id: 'fooDoc',
            key: '3',
            value: 'three'
          }
        ]);
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
      });
    }, done);
  });

  it('Test start and end', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.get('1', '3');
      }).then(function (results) {
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '1',
            value: 'one'
          }, {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }, {
            id: 'fooDoc',
            key: '3',
            value: 'three'
          }
        ]);

        return index.get('1', '2');
      }).then(function (results) {
        results.should.have.length(2, 'test1');
        return index.get('2', '3');
      }).then(function (results) {
        results.should.have.length(2, 'test2');
        return index.get('3', '4');
      }).then(function (results) {
        results.should.have.length(1, 'test3');
        return index.get('4', '5');
      }).then(function (results) {
        results.should.have.length(0, 'test4');
        return index.get(null, '1');
      }).then(function (results) {
        results.should.have.length(1, 'test5');
        return index.get('2', null);
      }).then(function (results) {
        results.should.have.length(2, 'test6');
        return index.get('2', '1');
      }).then(function (results) {
        results.should.have.length(0, 'test7');
        return index.get('0', '5');
      }).then(function (results) {
        results.should.have.length(3, 'test8');
        return index.get('0', '1');
      }).then(function (results) {
        results.should.have.length(1, 'test9');
        done();
      });
    }, done);
  });

  it('Test empty map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
      };

      return index.put('fooDoc', map).then(function () {
        return index.get();
      }).then(function (results) {
        results.should.have.length(0);
        return index.get('1');
      }).then(function (results) {
        results.should.have.length(0);
        done();
      });
    }, done);
  });

  it('Test deleted map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      return index.put('fooDoc', map).then(function () {
        return index.put('fooDoc', {});
      }).then(function () {
        return index.get();
      }).then(function (results) {
        results.should.have.length(0);
        return index.get('1');
      }).then(function (results) {
        results.should.have.length(0);
        done();
      });
    }, done);
  });

  it('Test replaced map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '4' : 'four',
        '5' : 'five',
        '6' : 'six'
      };

      return index.put('fooDoc', map).then(function () {
        var newMap = {
          '1' : 'one',
          '2' : 'two',
          '3' : 'three'
        };
        return index.put('fooDoc', newMap);
      }).then(function () {
        return index.get('1', '3');
      }).then(function (results) {
        results.should.have.length(3);
        return index.get('4');
      }).then(function (results) {
        results.should.have.length(0);
        done();
      });
    }, done);
  });

  it('Test multiple maps', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var fooMap = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      var barMap = {
        '4' : 'four',
        '5' : 'five',
        '6' : 'six'
      };

      return index.put('fooDoc', fooMap).then(function () {
        return index.put('barDoc', barMap);
      }).then(function () {
        return index.get('1', '3');
      }).then(function (results) {
        results.should.have.length(3);
        return index.get('1', '6');
      }).then(function (results) {
        results.should.have.length(6);
        return index.get('4', '6');
      }).then(function (results) {
        results.should.have.length(3);
        return index.get();
      }).then(function (results) {
        results.should.have.length(6);
        return index.put('barDoc', {});
      }).then(function () {
        return index.get();
      }).then(function (results) {
        results.should.have.length(3);
        done();
      });
    }, done);
  });

  it('Test count', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      return index.put('fooDoc', map).then(function () {
        return index.count();
      }).then(function (count) {
        count.should.equal(3);
        done();
      });
    }, done);
  });

  it('Test destroy', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      return index.put('fooDoc', map).then(function () {
        return index.get();
      }).then(function (results) {
          results.should.have.length(3);
          return index.destroy();
        }).then(function () {
          var index2 = db.index('fooIndex');

          return index2.get().then(function (results) {
            results.should.have.length(0);
            done();
          });
        });
    }, done);
  });
});