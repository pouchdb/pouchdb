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
        return index.get({});
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
        return index.get({startkey : '1'});
      }).then(function (results) {
        results.should.have.length(3);
        return index.get({startkey : '2'});
      }).then(function (results) {
        results.should.have.length(2);
        return index.get({startkey : '3'});
      }).then(function (results) {
        results.should.have.length(1);
        return index.get({startkey : '0'});
      }).then(function (results) {
        results.should.have.length(3);
        return index.get({startkey : '4'});
      }).then(function (results) {
        results.should.have.length(0);
        done();
      });
    }, done);
  });

  it('Test simple get', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.get('1');
      }).then(function (result) {
        result.should.deep.equal({
          id: 'fooDoc',
          key: '1',
          value: 'one'
        });
        return index.get('2');
      }).then(function (result) {
        result.should.deep.equal({
          id: 'fooDoc',
          key: '2',
          value: 'two'
        });
        return index.get('3');
      }).then(function (result) {
        result.should.deep.equal({
          id: 'fooDoc',
          key: '3',
          value: 'three'
        });
        done();
      }, done);
    });
  });

  it('Test invalid input args', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        index.get('0', function (err, res) {
          should.not.exist(res);
          should.exist(err);
          index.get(0, function (err, res) {
            should.not.exist(res);
            should.exist(err);
            index.get(['0'], function (err, res) {
              should.not.exist(res);
              should.exist(err);
              index.get(null, function (err, res) {
                should.not.exist(res);
                should.exist(err);
                index.get(undefined, function (err, res) {
                  should.not.exist(res);
                  should.exist(err);
                  done();
                });
              });
            });
          });
        });
      }, done);
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
        return index.get({startkey : '1', endkey : '3'});
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

        return index.get({startkey: '1', endkey : '2'});
      }).then(function (results) {
        results.should.have.length(2);
        return index.get({startkey: '2', endkey : '3'});
      }).then(function (results) {
        results.should.have.length(2);
        return index.get({startkey: '3', endkey : '4'});
      }).then(function (results) {
        results.should.have.length(1);
        return index.get({startkey: '4', endkey : '5'});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: null, endkey : '1'});
      }).then(function (results) {
        results.should.have.length(1);
        return index.get({startkey: '2', endkey : null});
      }).then(function (results) {
        results.should.have.length(2);
        return index.get({startkey: '2', endkey : '1'});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '0', endkey : '5'});
      }).then(function (results) {
        results.should.have.length(3);
        return index.get({startkey: '0', endkey : '1'});
      }).then(function (results) {
        results.should.have.length(1);
        done();
      });
    }, done);
  });

  it('Test limit and skip', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.get({startkey : '1', endkey : '3', limit : 2});
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
          }
        ]);
        return index.get({startkey: '1', endkey : '2', limit : 0});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '2', endkey : '3', limit : 1});
      }).then(function (results) {
        results.should.have.length(1);
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }
        ]);
        return index.get({startkey: '3', endkey : '4', skip : 2});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '4', endkey : '5', skip : 1});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: null, endkey : '1', limit : 2});
      }).then(function (results) {
        results.should.have.length(1);
        return index.get({startkey: '2', endkey : null, skip : 1});
      }).then(function (results) {
        results.should.have.length(1);
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '3',
            value: 'three'
          }
        ]);
        return index.get({startkey: '2', endkey : '1', skip : 10, limit : 2});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '0', endkey : '5', skip : 1, limit : 1});
      }).then(function (results) {
        results.should.have.length(1);
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }
        ]);
        return index.get({startkey: '0', endkey : '1', skip : 1, limit : 1});
      }).then(function (results) {
        results.should.have.length(0);
        done();
      });
    }, done);
  });

  it('Test descending', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index('fooIndex');

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.get({startkey: '3', endkey : '1', descending : true});
      }).then(function (results) {
        results.should.have.length(3);
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '3',
            value: 'three'
          }, {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }, {
            id: 'fooDoc',
            key: '1',
            value: 'one'
          }
        ]);
        return index.get({startkey: '4', endkey : '0', descending : true});
      }).then(function (results) {
        results.should.have.length(3);
        return index.get({startkey: '0', endkey : '3', descending : true});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '5', endkey : '3', skip : 1,
          descending : true});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '3', endkey : '1', limit : 1, skip : 1,
          descending : true});
      }).then(function (results) {
        results.should.have.length(1);
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }
        ]);
        return index.get({startkey: '1', descending : true});
      }).then(function (results) {
        results.should.have.length(1);
        return index.get({endkey: '3', descending : true});
      }).then(function (results) {
        results.should.have.length(1);
        return index.get({endkey: '3', descending : true, skip : 1});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({endkey: '3', descending : true, limit : 1});
      }).then(function (results) {
        results.should.have.length(1);
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
        return index.get({});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '1'});
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
        return index.get({});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '1'});
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
        return index.get({startkey: '1', endkey : '3'});
      }).then(function (results) {
        results.should.have.length(3);
        return index.get({startkey : '4'});
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
        return index.get({startkey: '1', endkey : '3'});
      }).then(function (results) {
        results.should.have.length(3);
        return index.get({startkey: '1', endkey : '6'});
      }).then(function (results) {
        results.should.have.length(6);
        return index.get({startkey: '4', endkey : '6'});
      }).then(function (results) {
        results.should.have.length(3);
        return index.get({});
      }).then(function (results) {
        results.should.have.length(6);
        return index.put('barDoc', {});
      }).then(function () {
        return index.get({});
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
        return index.get({});
      }).then(function (results) {
          results.should.have.length(3);
          return index.destroy();
        }).then(function () {
          var index2 = db.index('fooIndex');

          return index2.get({}).then(function (results) {
            results.should.have.length(0);
            done();
          });
        });
    }, done);
  });
});