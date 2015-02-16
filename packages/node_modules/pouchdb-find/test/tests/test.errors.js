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
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
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

    it('error - no usable index', function () {
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
          "selector": {"foo": "$exists"},
          "fields": ["_id", "foo"],
          "sort": [{"bar": "asc"}]
        });
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('#7 invalid ne query', function () {
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
          selector: {foo: {$ne: "eba"}},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });
  });
};