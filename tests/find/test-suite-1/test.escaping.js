'use strict';

describe('test.escaping.js', function () {
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

  it('initial dollar sign can be escaped', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": [
          "$foobar"
        ]
      },
      "name": "foo-index",
      "type": "json"
    };
    return db.bulkDocs([
      {_id: 'doc', '$foobar': 'a'}
    ]).then(function () {
      return db.createIndex(index);
    }).then(function () {
      return db.find({
        selector: {'\\$foobar': 'a'},
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

  it('internal digits are not escaped', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": [
          "foo0bar"
        ]
      },
      "name": "foo-index",
      "type": "json"
    };
    return db.bulkDocs([
      {_id: 'doc', 'foo0bar': 'a'}
    ]).then(function () {
      return db.createIndex(index);
    }).then(function () {
      return db.find({
        selector: {'foo0bar': 'a'},
        fields: ['_id', 'foo0bar']
      });
    }).then(function (res) {
      res.docs.should.deep.equal([{ "_id": "doc", "foo0bar": "a" }]);
    });
  });

  it('handles escape patterns', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": [
          "foo_c46_bar"
        ]
      },
      "name": "foo-index",
      "type": "json"
    };
    return db.bulkDocs([
      {_id: 'doc', 'foo_c46_bar': 'a'}
    ]).then(function () {
      return db.createIndex(index);
    }).then(function () {
      return db.find({
        selector: {'foo_c46_bar': 'a'},
        fields: ['_id', 'foo_c46_bar']
      });
    }).then(function (res) {
      res.docs.should.deep.equal([{ "_id": "doc", "foo_c46_bar": "a" }]);
    });
  });

  it('#8808 handles escape patterns without collisions (with indexes)', function () {
    var db = context.db;
    var index1 = {
      "index": {
        "fields": [
          "foo/bar"
        ]
      },
      "name": "foo-index-1",
      "type": "json"
    };
    var index2 = {
      "index": {
        "fields": [
          "foo_c47_bar"
        ]
      },
      "name": "foo-index-2",
      "type": "json"
    };
    return db.bulkDocs([
      {_id: 'doc1', 'foo/bar': 'a'},
      {_id: 'doc2', 'foo_c47_bar': 'a'},
    ]).then(function () {
      return db.createIndex(index1);
    }).then(function () {
      return db.createIndex(index2);
    }).then(function () {
      return db.find({
        selector: {'foo/bar': 'a'},
        fields: ['_id', 'foo/bar', 'foo_c47_bar']
      });
    }).then(function (res) {
      res.docs.should.deep.equal([{ _id: 'doc1', 'foo/bar': 'a' }]);
    }).then(function () {
      return db.find({
        selector: {'foo_c47_bar': 'a'},
        fields: ['_id', 'foo/bar', 'foo_c47_bar']
      });
    }).then(function (res) {
      res.docs.should.deep.equal([{ _id: 'doc2', foo_c47_bar: 'a' }]);
    });
  });

  it('#8808 handles escape patterns without collisions (no indexes)', function () {
    var db = context.db;
    return db.bulkDocs([
      {_id: 'doc1', 'foo/bar': 'a'},
      {_id: 'doc2', 'foo_c47_bar': 'a'},
    ]).then(function () {
      return db.find({
        selector: {'foo/bar': 'a'},
        fields: ['_id', 'foo/bar', 'foo_c47_bar']
      });
    }).then(function (res) {
      res.docs.should.deep.equal([{ _id: 'doc1', 'foo/bar': 'a' }]);
    }).then(function () {
      return db.find({
        selector: {'foo_c47_bar': 'a'},
        fields: ['_id', 'foo/bar', 'foo_c47_bar']
      });
    }).then(function (res) {
      res.docs.should.deep.equal([{ _id: 'doc2', foo_c47_bar: 'a' }]);
    });
  });

  it('#8808 bulk docs id escaping collisions in same doc (with indexes)', function () {
    var db = context.db;
    var docs = [ { _id: 'doc', 'foo/bar': -1, foo_c47_bar: 2 } ];
    var index1 = {
      "index": {
        "fields": [
          "foo/bar"
        ]
      },
      "name": "foo-index-1",
      "type": "json"
    };
    var index2 = {
      "index": {
        "fields": [
          "foo_c47_bar"
        ]
      },
      "name": "foo-index-2",
      "type": "json"
    };
    return db.bulkDocs(docs).then(function (results) {
      results.should.have.length(1, 'results length did not match');
      results[0].ok.should.equal(true);
    }).then(function () {
      return db.allDocs({ include_docs: true });
    }).then(function (results) {
      results.rows.should.have.length(1, 'results length did not match');

      results.rows[0].doc._id.should.equal('doc');
      results.rows[0].doc['foo/bar'].should.equal(-1);
      results.rows[0].doc['foo_c47_bar'].should.equal(2);
    }).then(function () {
      return db.createIndex(index1);
    }).then(function () {
      return db.createIndex(index2);
    }).then(function () {
      return db.find({ selector: {'foo/bar': {$gt: 0}}, fields: ['_id', 'foo/bar', 'foo_c47_bar'] });
    }).then(function (res) {
      res.docs.length.should.equal(0, 'foo/bar should not be greater than 0');
    }).then(function () {
      return db.find({ selector: {'foo/bar': {$lt: 0}}, fields: ['_id', 'foo/bar', 'foo_c47_bar'] });
    }).then(function (res) {
      res.docs.should.deep.equal([{ _id: 'doc', 'foo/bar': -1, foo_c47_bar: 2 }]);
    }).then(function () {
      return db.find({ selector: {'foo_c47_bar': {$lt: 0}}, fields: ['_id', 'foo/bar', 'foo_c47_bar'] });
    }).then(function (res) {
      res.docs.length.should.equal(0, 'foo_c47_bar should not be less than 0');
    }).then(function () {
      return db.find({ selector: {'foo_c47_bar': {$gt: 0}}, fields: ['_id', 'foo/bar', 'foo_c47_bar'] });
    }).then(function (res) {
      res.docs.should.deep.equal([{ _id: 'doc', 'foo/bar': -1, foo_c47_bar: 2 } ]);
    });
  });

  it('#8808 bulk docs id escaping collisions in same doc (no indexes)', function () {
    var db = context.db;
    var docs = [ { _id: 'doc', 'foo/bar': -1, foo_c47_bar: 2 } ];
    return db.bulkDocs(docs).then(function (results) {
      results.should.have.length(1, 'results length did not match');
      results[0].ok.should.equal(true);
    }).then(function () {
      return db.allDocs({ include_docs: true });
    }).then(function (results) {
      results.rows.should.have.length(1, 'results length did not match');

      results.rows[0].doc._id.should.equal('doc');
      results.rows[0].doc['foo/bar'].should.equal(-1);
      results.rows[0].doc['foo_c47_bar'].should.equal(2);
    }).then(function () {
      return db.find({ selector: {'foo/bar': {$gt: 0}}, fields: ['_id', 'foo/bar', 'foo_c47_bar'] });
    }).then(function (res) {
      res.docs.length.should.equal(0, 'foo/bar should not be greater than 0');
    }).then(function () {
      return db.find({ selector: {'foo/bar': {$lt: 0}}, fields: ['_id', 'foo/bar', 'foo_c47_bar'] });
    }).then(function (res) {
      res.docs.should.deep.equal([ { _id: 'doc', 'foo/bar': -1, foo_c47_bar: 2 } ]);
    }).then(function () {
      return db.find({ selector: {'foo_c47_bar': {$lt: 0}}, fields: ['_id', 'foo/bar', 'foo_c47_bar'] });
    }).then(function (res) {
      res.docs.length.should.equal(0, 'foo_c47_bar should not be less than 0');
    }).then(function () {
      return db.find({ selector: {'foo_c47_bar': {$gt: 0}}, fields: ['_id', 'foo/bar', 'foo_c47_bar'] });
    }).then(function (res) {
      res.docs.should.deep.equal([ { _id: 'doc', 'foo/bar': -1, foo_c47_bar: 2 } ]);
    });
  });

  it('#9002: query works without rewrite in nested object', async () => {
    const db = context.db;
    await db.bulkDocs([{ _id: "issue9002", foo: { bar: "baz" }, 2: "value"}]);
    await db.createIndex({ index: { "fields": ["foo.bar"] }});
    const resp = await context.db.find({
      selector: { "foo.bar": "baz" },
      fields: ["_id"]
    });
    resp.docs.should.deep.equal([{ _id: "issue9002"}]);
  });

  it('#9003 index works with rewrite in later field', async () => {
    const db = context.db;
    await db.bulkDocs([ { _id: "issue9003", anobject: { without: "need to rewrite" }, year: { 2024: [] }} ]);
    await db.createIndex({ index: { "fields": ["year.2024"] }});
    const resp = await context.db.find({
      selector: { "year.2024": { $exists: true }},
      fields: ["_id"]
    });
    resp.docs.should.deep.equal([{ _id: "issue9003"}]);
  });
});
