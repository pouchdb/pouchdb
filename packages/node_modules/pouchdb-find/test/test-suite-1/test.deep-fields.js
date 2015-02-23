'use strict';

module.exports = function (dbType, context) {

  describe(dbType + ': deep fields', function () {

    it('deep fields', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo.bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'doc', foo: {bar: 'a'}},
        ]);
      }).then(function () {
        return db.find({
          selector: {'foo.bar': 'a'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.should.deep.equal({
          "docs": [
            {
              "_id": "doc"
            }
          ]
        });
      });
    });

    it('deeper fields', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo.bar.baz"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'doc', foo: {bar: {baz: 'a'}}},
        ]);
      }).then(function () {
        return db.find({
          selector: {'foo.bar.baz': 'a'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.should.deep.equal({
          "docs": [
            {
              "_id": "doc"
            }
          ]
        });
      });
    });

    it('deep fields escaped', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo\\.bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'doc1', foo: {bar: 'a'}},
          {_id: 'doc2', 'foo.bar': 'a'}
        ]);
      }).then(function () {
        return db.find({
          selector: {'foo\\.bar': 'a'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.should.deep.equal({
          "docs": [{ "_id": "doc2"}]
        });
      });
    });
  });
};