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

          return index.get('1', '2');
        }).then(function (results) {
          results.should.have.length(2);
          return index.get('2', '3');
        }).then(function (results) {
          results.should.have.length(2);
          return index.get('3', '4');
        }).then(function (results) {
          results.should.have.length(1);
          return index.get('4', '5');
        }).then(function (results) {
          results.should.have.length(0);
          return index.get('0', '1');
        }).then(function (results) {
          results.should.have.length(1);
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

  it('Test empty map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
      };

      index.put('fooDoc', map).then(function () {
        return index.get();
      }).then(function (results) {
        results.should.have.length(0);
        return index.get('1');
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

  it('Test deleted map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.put('fooDoc', {});
      }).then(function () {
        return index.get();
      }).then(function (results) {
        results.should.have.length(0);
        return index.get('1');
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

  it('Test replaced map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '4' : 'four',
        '5' : 'five',
        '6' : 'six'
      };

      index.put('fooDoc', map).then(function () {
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
      }).catch(function (err) {
        should.not.exist(err);
        done();
      });
    }).catch(function (err) {
        should.not.exist(err);
        done();
      });
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

      index.put('fooDoc', fooMap).then(function () {
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
      }).catch(function (err) {
        should.not.exist(err);
        done();
      });
    }).catch(function (err) {
        should.not.exist(err);
        done();
      });
  });

  it('Test count', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.count();
      }).then(function (count) {
        count.should.equal(3);
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

  it('Test destroy', function (done) {
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
          return index.destroy();
        }).then(function () {
          var index2 = db.index('fooIndex');

          index2.get().then(function (results) {
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
    }).catch(function (err) {
        should.not.exist(err);
        done();
      });
  });
});