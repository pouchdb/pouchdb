'use strict';

testCases.push(function (dbType, context) {

  describe(dbType + ': test.escaping.js', function () {

    it('period can be escaped', function () {
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
      return db.bulkDocs([
        {_id: 'doc1', foo: {bar: 'a'}},
        {_id: 'doc2', 'foo.bar': 'a'}
      ]).then(function () {
        return db.createIndex(index);
      }).then(function () {
        return db.find({
          selector: {'foo\\.bar': 'a'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.deep.equal([{ "_id": "doc2"}]);
      });
    });

    it('space can be escaped', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.bulkDocs([
        {_id: 'doc', 'foo bar': 'a'}
      ]).then(function () {
        return db.createIndex(index);
      }).then(function () {
        return db.find({
          selector: {'foo bar': 'a'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.deep.equal([{ "_id": "doc"}]);
      });
    });

    it('dash can be escaped', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo-bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.bulkDocs([
        {_id: 'doc', 'foo-bar': 'a'}
      ]).then(function () {
        return db.createIndex(index);
      }).then(function () {
        return db.find({
          selector: {'foo-bar': 'a'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.deep.equal([{ "_id": "doc"}]);
      });
    });

    it('initial digits can be escaped', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "0foobar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.bulkDocs([
        {_id: 'doc', '0foobar': 'a'}
      ]).then(function () {
        return db.createIndex(index);
      }).then(function () {
        return db.find({
          selector: {'0foobar': 'a'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.deep.equal([{ "_id": "doc"}]);
      });
    });

    it('unicode can be escaped', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "授人以鱼不如授人以渔。"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.bulkDocs([
        {_id: 'doc', '授人以鱼不如授人以渔。': 'a'}
      ]).then(function () {
        return db.createIndex(index);
      }).then(function () {
        return db.find({
          selector: {'授人以鱼不如授人以渔。': 'a'},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.should.deep.equal([{ "_id": "doc"}]);
      });
    });
  });

  it('deeper values can be escaped', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo.bar.0foobar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      var doc = {
        _id: 'doc',
        foo: {
          bar: {
            '0foobar': 'a'
          },
          "0baz": false,
          just: {
            normal: "stuff"
          }
        }
      };
      return db.bulkDocs([doc])
      .then(function () {
        return db.createIndex(index);
      }).then(function () {
        return db.find({
          selector: {'foo.bar.0foobar': 'a'},
          fields: ['_id', 'foo']
        });
      }).then(function (res) {
        res.docs.should.deep.equal([doc]);
      });
    });

});
