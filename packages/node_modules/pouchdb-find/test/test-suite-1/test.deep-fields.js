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

    it('should create a deep multi mapper', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo.bar", "bar.baz"
          ]
        }
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a', foo: {bar: 'yo'}, bar: {baz: 'hey'}},
          {_id: 'b', foo: {bar: 'sup'}, bar: {baz: 'dawg'}}
        ]);
      }).then(function () {
        return db.find({
          selector: {"foo.bar": 'yo', "bar.baz": 'hey'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.deep.equal([{_id: 'a'}]);
        return db.find({
          selector: {"foo.bar": 'yo', "bar.baz": 'sup'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.have.length(0);
        return db.find({
          selector: {"foo.bar": 'bruh', "bar.baz": 'nah'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.have.length(0);
      });
    });

    it('should create a deep multi mapper, tricky docs', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo.bar", "bar.baz"
          ]
        }
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a', foo: {bar: 'yo'}, bar: {baz: 'hey'}},
          {_id: 'b', foo: {bar: 'sup'}, bar: {baz: 'dawg'}},
          {_id: 'c', foo: true, bar: "yo"},
          {_id: 'd', foo: null, bar: []}
        ]);
      }).then(function () {
        return db.find({
          selector: {"foo.bar": 'yo', "bar.baz": 'hey'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.deep.equal([{_id: 'a'}]);
        return db.find({
          selector: {"foo.bar": 'yo', "bar.baz": 'sup'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.have.length(0);
        return db.find({
          selector: {"foo.bar": 'bruh', "bar.baz": 'nah'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.have.length(0);
      });
    });
  });
};
