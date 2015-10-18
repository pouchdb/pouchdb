'use strict';

var abstractMapReduce = require('../../lib/abstract-mapreduce');

module.exports = function (dbName, dbType, viewType, Pouch) {

  describe('custom mapper', function () {

    var db;
    beforeEach(function () {
      db = new Pouch(dbName);
    });
    afterEach(function () {
      return db.destroy();
    });

    it('basic custom mapper test', function () {
      var customMapper = abstractMapReduce({
        name: 'custom',
        mapper: function (fields, emit) {
          // mapFunDef is an array
          return function (doc) {
            emit(doc[fields[0]]);
          };
        },
        reducer: function () {
          throw new Error('reduce not supported');
        },
        ddocValidator: function () {
          // do nothing
        }
      });

      return db.put({
        _id: '_design/foo',
        views: {
          foo: {
            map: ['somefield']
          }
        }
      }).then(function () {
        return db.bulkDocs([
          {_id: 'foo', somefield: 'foo'},
          {_id: 'bar', somefield: 'bar'},
        ]);
      }).then(function () {
        return customMapper.query.apply(db, ['foo']).then(function (res) {
          res.rows.should.deep.equal([
            {key: 'bar', id: 'bar', value: null},
            {key: 'foo', id: 'foo', value: null}
          ]);
        });
      });
    });
  });
};