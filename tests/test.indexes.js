/*jshint expr:true */
'use strict';

describe('plugin indexes', function () {

  var dbs = {};

  beforeEach(function (done) {
    dbs.name = testUtils.adapterUrl('local', 'test_indexes');
    dbs.indexName = 'fooIndex';
    testUtils.cleanup([dbs.name], done);
  });

  afterEach(function (done) {
    new PouchDB(dbs.name).then(function (db) {
      return db.index(dbs.indexName).destroy();
    }).then(function () {
      testUtils.cleanup([dbs.name], done);
    }, done);
  });

  it('Test basic index', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
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
      }, done);
    }, done);
  });

  it('Test simple get', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.get('1');
      }).then(function (result) {
        result.should.deep.equal([{
          id: 'fooDoc',
          key: '1',
          value: 'one'
        }]);
        return index.get('2');
      }).then(function (result) {
        result.should.deep.equal([{
          id: 'fooDoc',
          key: '2',
          value: 'two'
        }]);
        return index.get('3');
      }).then(function (result) {
        result.should.deep.equal([{
          id: 'fooDoc',
          key: '3',
          value: 'three'
        }]);
        done();
      }, done);
    }, done);
  });

  it('Test start and end', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

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
        ], '1-3');

        return index.get({startkey: '1', endkey : '2'});
      }).then(function (results) {
        results.should.have.length(2, '1-2');
        return index.get({startkey: '2', endkey : '3'});
      }).then(function (results) {
        results.should.have.length(2, '2-3');
        return index.get({startkey: '3', endkey : '4'});
      }).then(function (results) {
        results.should.have.length(1, '3-4');
        return index.get({startkey: '4', endkey : '5'});
      }).then(function (results) {
        results.should.have.length(0, '4-5');
        return index.get({endkey : '1'});
      }).then(function (results) {
        results.should.have.length(1, 'null-1');
        return index.get({startkey: '2'});
      }).then(function (results) {
        results.should.have.length(2, '2-null');
        return index.get({startkey: '2', endkey : '1'});
      }).then(function (results) {
        results.should.have.length(0, '2-1');
        return index.get({startkey: '0', endkey : '5'});
      }).then(function (results) {
        results.should.have.length(3, '0-3');
        return index.get({startkey: '0', endkey : '1'});
      }).then(function (results) {
        results.should.have.length(1, '0-1');
        done();
      }, done);
    }, done);
  });

  it('Test limit and skip', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

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
        results.should.have.length(0, '1,2,0');
        return index.get({startkey: '2', endkey : '3', limit : 1});
      }).then(function (results) {
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }
        ]);
        return index.get({startkey: '3', endkey : '4', skip : 2});
      }).then(function (results) {
        results.should.have.length(0, '3,4,2');
        return index.get({startkey: '4', endkey : '5', skip : 1});
      }).then(function (results) {
        results.should.have.length(0, '4,5,1');
        return index.get({endkey : '1', limit : 2});
      }).then(function (results) {
        results.should.have.length(1, 'null,1,2');
        return index.get({startkey: '2', skip : 1});
      }).then(function (results) {
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '3',
            value: 'three'
          }
        ]);
        return index.get({startkey: '2', endkey : '1', skip : 10, limit : 2});
      }).then(function (results) {
        results.should.have.length(0, '2,1,10,2');
        return index.get({startkey: '0', endkey : '5', skip : 1, limit : 1});
      }).then(function (results) {
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }
        ]);
        return index.get({startkey: '0', endkey : '1', skip : 1, limit : 1});
      }).then(function (results) {
        results.should.have.length(0, '0,1,1,1');
        done();
      }, done);
    }, done);
  });

  it('Test descending', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.get({startkey: '3', endkey : '1', descending : true});
      }).then(function (results) {
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
        results.should.deep.equal([
          {
            id: 'fooDoc',
            key: '2',
            value: 'two'
          }
        ]);
        return index.get({startkey: '1', descending : true});
      }).then(function (results) {
        results.should.have.length(1, '1a');
        return index.get({endkey: '3', descending : true});
      }).then(function (results) {
        results.should.have.length(1, '3');
        return index.get({endkey: '3', descending : true, skip : 1});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({endkey: '3', descending : true, limit : 1});
      }).then(function (results) {
        results.should.have.length(1, '3, limit');
        done();
      }, done);
    }, done);
  });

  it('Test empty map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

      var map = {
      };

      index.put('fooDoc', map).then(function () {
        return index.get({});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '1'});
      }).then(function (results) {
        results.should.have.length(0);
        done();
      }, done);
    }, done);
  });

  it('Test deleted map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.put('fooDoc', {});
      }).then(function () {
        return index.get({});
      }).then(function (results) {
        results.should.have.length(0);
        return index.get({startkey: '1'});
      }).then(function (results) {
        results.should.have.length(0);
        done();
      }, done);
    }, done);
  });

  it('Test replaced map', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

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
        return index.get({startkey: '1', endkey : '3'});
      }).then(function (results) {
        results.should.have.length(3);
        return index.get({startkey : '4'});
      }).then(function (results) {
        results.should.have.length(0);
        done();
      }, done);
    }, done);
  });

  it('Test multiple maps', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

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
      }, done);
    }, done);
  });

  it('Test count', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

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
      }, done);
    }, done);
  });

  it('Test destroy', function (done) {
    new PouchDB(dbs.name).then(function (db) {

      var index = db.index(dbs.indexName);

      var map = {
        '1' : 'one',
        '2' : 'two',
        '3' : 'three'
      };

      index.put('fooDoc', map).then(function () {
        return index.get({});
      }).then(function (results) {
        results.should.have.length(3);
        return index.destroy();
      }).then(function () {
        var index2 = db.index(dbs.indexName);

        return index2.get({}).then(function (results) {
          results.should.have.length(0);
          done();
        });
      }, done);
    }, done);
  });

  it('Test empty string keys', function (done) {
    new PouchDB(dbs.name).then(function (db) {
      var index = db.index(dbs.indexName);

      var map = {
        '' : 'empty'
      };

      index.put('fooDoc', map).then(function () {
        return index.get({});
      }).then(function (results) {
        results.should.deep.equal([{
          key : '',
          value : 'empty',
          id : 'fooDoc'
        }]);
        return index.get('');
      }).then(function (result) {
        result.should.deep.equal([{
          key : '',
          value : 'empty',
          id : 'fooDoc'
        }]);
        done();
      }, done);
    }, done);
  });
  it('Test values with multiple types', function (done) {
    new PouchDB(dbs.name).then(function (db) {
      var index = db.index(dbs.indexName);

      var map = {
        '1' : '1',
        '2' : 2,
        '3' : 3.3,
        '4' : true,
        '5' : false,
        '6' : undefined,
        '7' : null,
        '8' : ['1', 2, 3.3, true, false, undefined, null, '0', null, ''],
        '9' : {
          '9' : {
            '9' : null
          },
          'a' : [null, 3, undefined, Number.MAX_VALUE]
        },
        'a' : '',
        'b' : '0',
        'c' : 0,
        'd' : new Date(0)
      };

      var getValues = function (obj) {
        return obj.value;
      };

      index.put('fooDoc', map).then(function () {
        return index.get({});
      }).then(function (results) {
          results.map(getValues).should.deep.equal([
            '1', 2, 3.3, true, false, null, null,
            [ '1', 2, 3.3, true, false, null, null, '0', null, ''],
            { '9': { '9': null }, 'a': [ null, 3, null, Number.MAX_VALUE ] },
            '', '0', 0, '1970-01-01T00:00:00.000Z'
          ]);
          done();
        }, done);
    }, done);
  });

  it('Test duplicate keys', function (done) {
    new PouchDB(dbs.name).then(function (db) {
      var index = db.index(dbs.indexName);

      var map = {
        '1'   : '1',
        '2'   : '2',
        '10'  : '10',
        '100' : '100'
      };

      var sortByDoc = function (a, b) {
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      };

      index.put('doc1', map).then(function () {
        return index.put('doc2', map);
      }).then(function () {
        return index.put('doc3', {'1' : '1'});
      }).then(function () {
        return index.get('1');
      }).then(function (res) {
        res.sort(sortByDoc).should.deep.equal([
          {
            key : '1',
            value: '1',
            id : 'doc1'
          },
          {
            key : '1',
            value: '1',
            id : 'doc2'
          },
          {
            key : '1',
            value: '1',
            id : 'doc3'
          }
        ], 'get-1');
        return index.get({startkey : '1', endkey : '1'});
      }).then(function (res) {
        res.sort(sortByDoc).should.deep.equal([
          {
            key : '1',
            value: '1',
            id : 'doc1'
          },
          {
            key : '1',
            value: '1',
            id : 'doc2'
          },
          {
            key : '1',
            value: '1',
            id : 'doc3'
          }
        ], 'start-1,end-1');
        return index.get({startkey : '1', endkey : '10'});
      }).then(function (res) {
        res.should.have.length(5, '1-10');
        return index.get({startkey : '10', endkey : '2'});
      }).then(function (res) {
        res.should.have.length(6, '10-2');
        return index.get({startkey : '10', endkey : '1',
          descending : true});
      }).then(function (res) {
        res.should.have.length(5, '10-1');
        return index.get({startkey : '1'});
      }).then(function (res) {
        res.should.have.length(9, '1-');
        return index.get({endkey : '10'});
      }).then(function (res) {
        res.should.have.length(5, '-10');
        return index.get({startkey : '1', limit : 2});
      }).then(function (res) {
        res.should.have.length(2, '1-limit2');
        done();
      }, done);
    }, done);
  });
});