'use strict';

var testUtils = require('../test-utils');
var should = testUtils.should;

module.exports = function (dbType, context) {

  describe(dbType + ': errors', function () {

    it('error: gimme some args', function () {
      var db = context.db;
      return db.find().then(function () {
        throw Error('should not be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('error: missing required key selector', function () {
      var db = context.db;
      return db.find({}).then(function () {
        throw Error('should not be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('error: unsupported mixed sort', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            {"foo": "desc"},
            "bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        throw new Error('should not be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('error: invalid sort json', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {"$lte": "eba"}},
          fields: ["_id", "foo"],
          sort: {foo: "asc"}
        });
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('error: conflicting sort and selector', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.find({
          "selector": {"foo": {"$gt": "\u0000\u0000"}},
          "fields": ["_id", "foo"],
          "sort": [{"_id": "asc"}]
        });
      }).then(function (res) {
        res.warning.should.match(/no matching index found/);
      });
    });

    it('error - no selector', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.find({
          "fields": ["_id", "foo"],
          "sort": [{"foo": "asc"}]
        });
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('invalid ddoc', function () {
      var db = context.db;

      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "ddoc": "myddoc",
        "type": "json"
      };

      return db.put({
        _id: '_design/myddoc',
        views: {
          'foo-index': {
            map: "function (){emit(1)}"
          }
        }
      }).then(function () {
        return db.createIndex(index).then(function () {
          throw new Error('expected an error');
        }, function (err) {
          should.exist(err);
        });
      });
    });

    it('non-logical errors with no other selector', function () {
      var db = context.db;

      return db.createIndex({
        index: {
          fields: ['foo']
        }
      }).then(function () {
        return db.bulkDocs([
          {_id: '1', foo: 1},
          {_id: '2', foo: 2},
          {_id: '3', foo: 3},
          {_id: '4', foo: 4}
        ]);
      }).then(function () {
        return db.find({
          selector: {
            foo: {$mod: {gte: 3}}
          }
        }).then(function () {
          throw new Error('expected an error');
        }, function (err) {
          should.exist(err);
        });
      });
    });
  });
};
