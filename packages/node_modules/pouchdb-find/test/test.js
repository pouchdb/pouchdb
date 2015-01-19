/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');

var helloPlugin = require('../');
Pouch.plugin(helloPlugin);

var chai = require('chai');
chai.use(require("chai-as-promised"));

var should = chai.should();
require('bluebird'); // var Promise = require('bluebird');

var cloudantPassword = require('./.cloudant-password');

var dbs;
if (process.browser) {
  dbs = 'testdb' + Math.random() +
    ',http://pouch:' + cloudantPassword +
    '@pouch.cloudant.com/testdb' + Math.round(Math.random() * 100000);
} else {
  dbs = process.env.TEST_DB;
}

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {

  Pouch.debug.enable('*');

  describe(dbType + ' tests', function () {
    this.timeout(100000);

    var db;

    beforeEach(function () {
      db = new Pouch(dbName);
      return db;
    });
    afterEach(function () {
      return Pouch.destroy(dbName);
    });

    it('should create an index', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index);
      }).then(function (response) {
        response.should.deep.equal({result: 'exists'});
      });
    });

    it('should not recognize duplicate indexes', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      var index2 = {
        "index": {
          "fields": ["foo"]
        },
        "name": "bar-index",
        "type": "json"
      };

      return db.createIndex(index).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index2);
      }).then(function (response) {
        response.should.deep.equal({result: 'created'});
        return db.getIndexes();
      }).then(function (res) {
        res.indexes.should.have.length(3);
        var ddoc1 = res.indexes[1].ddoc;
        var ddoc2 = res.indexes[2].ddoc;
        ddoc1.should.not.equal(ddoc2,
          'essentially duplicate indexes are not md5summed to the' +
          'same ddoc');
      });
    });

    it('should find existing indexes', function () {

      return db.getIndexes().then(function (response) {
        response.should.deep.equal({
          indexes: [{
            ddoc: null,
            name: '_all_docs',
            type: 'special',
            def: {fields: [{_id: 'asc'}]}
          }]
        });
        var index = {
          "index": {
            "fields": ["foo"]
          },
          "name": "foo-index",
          "type": "json"
        };
        return db.createIndex(index);
      }).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        var ddoc = resp.indexes[1].ddoc;
        ddoc.should.match(/_design\/.+/);
        delete resp.indexes[1].ddoc;
        resp.should.deep.equal({
          "indexes": [
            {
              "ddoc": null,
              "name": "_all_docs",
              "type": "special",
              "def": {
                "fields": [
                  {
                    "_id": "asc"
                  }
                ]
              }
            },
            {
              //"ddoc": "_design/a5f4711fc9448864a13c81dc71e660b524d7410c",
              "name": "foo-index",
              "type": "json",
              "def": {
                "fields": [
                  {
                    "foo": "asc"
                  }
                ]
              }
            }
          ]
        });
      });
    });

    it('should create ddocs automatically', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      var ddocId;
      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        ddocId = resp.indexes[1].ddoc;
        return db.get(ddocId);
      }).then(function (ddoc) {
        ddoc._id.should.equal(ddocId);
        should.exist(ddoc._rev);
        delete ddoc._id;
        delete ddoc._rev;
        delete ddoc.views['foo-index'].options.w; // wtf is this?
        ddoc.should.deep.equal({
          "language": "query",
          "views": {
            "foo-index": {
              "map": {
                "fields": {
                  "foo": "asc"
                }
              },
              "reduce": "_count",
              "options": {
                "def": {
                  "fields": [
                    "foo"
                  ]
                }
              }
            }
          }
        });
      });
    });

    it('should create ddocs automatically 2', function () {
      var index = {
        "index": {
          "fields": [{"foo": "asc"}]
        },
        "name": "foo-index",
        "type": "json"
      };
      var ddocId;
      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        ddocId = resp.indexes[1].ddoc;
        return db.get(ddocId);
      }).then(function (ddoc) {
        ddoc._id.should.equal(ddocId);
        should.exist(ddoc._rev);
        delete ddoc._id;
        delete ddoc._rev;
        delete ddoc.views['foo-index'].options.w; // wtf is this?
        ddoc.should.deep.equal({
          "language": "query",
          "views": {
            "foo-index": {
              "map": {
                "fields": {
                  "foo": "asc"
                }
              },
              "reduce": "_count",
              "options": {
                "def": {
                  "fields": [
                    {"foo": "asc"}
                  ]
                }
              }
            }
          }
        });
      });
    });

    it('should create ddocs automatically 3', function () {
      var index = {
        "index": {
          "fields": [
            {"foo": "asc"},
            "bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      var ddocId;
      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        ddocId = resp.indexes[1].ddoc;
        return db.get(ddocId);
      }).then(function (ddoc) {
        ddoc._id.should.equal(ddocId);
        should.exist(ddoc._rev);
        delete ddoc._id;
        delete ddoc._rev;
        delete ddoc.views['foo-index'].options.w; // wtf is this?
        ddoc.should.deep.equal({
          "language": "query",
          "views": {
            "foo-index": {
              "map": {
                "fields": {
                  "foo": "asc",
                  "bar": "asc"
                }
              },
              "reduce": "_count",
              "options": {
                "def": {
                  "fields": [
                    {"foo": "asc"},
                    "bar"
                  ]
                }
              }
            }
          }
        });
      });
    });

    it('sorts correctly - just _id', function () {
      return db.bulkDocs([
        {_id: 'a', foo: 'a'},
        {_id: 'b', foo: 'b'}
      ]).then(function () {
        return db.find({
          "selector": {"_id": {$gte: "a"}},
          "fields": ["_id", "foo"],
          "sort": [{"_id": "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            {"_id": "a", "foo": "a"},
            {"_id": "b", "foo": "b"}
          ]
        });
      });
    });

    it('sorts correctly - just _id desc', function () {
      return db.bulkDocs([
        {_id: 'a', foo: 'a'},
        {_id: 'b', foo: 'b'}
      ]).then(function () {
        return db.find({
          "selector": {"_id": {$gte: "a"}},
          "fields": ["_id", "foo"],
          "sort": [{"_id": "desc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            {"_id": "b", "foo": "b"},
            {"_id": "a", "foo": "a"}
          ]
        });
      });
    });

    it('sorts correctly - foo desc', function () {
      var index = {
        "index": {
          "fields": [{"foo": "desc"}]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a', foo: 'b'},
          {_id: 'b', foo: 'a'},
          {_id: 'c', foo: 'c'},
          {_id: '0', foo: 'd'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {"foo": {$lte: "d"}},
          "fields": ["foo"]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            {"foo": "a"},
            {"foo": "b"},
            {"foo": "c"},
            {"foo": "d"}
          ]
        });
      });
    });

    it('sorts correctly - foo desc 2', function () {
      var index = {
        "index": {
          "fields": [{"foo": "desc"}]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a', foo: 'b'},
          {_id: 'b', foo: 'a'},
          {_id: 'c', foo: 'c'},
          {_id: '0', foo: 'd'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {"foo": {$lte: "d"}},
          "fields": ["foo"],
          "sort": [{foo: "desc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            {"foo": "d"},
            {"foo": "c"},
            {"foo": "b"},
            {"foo": "a"}
          ]
        });
      });
    });

    it('sorts correctly - complex', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'AAA'},
          { _id: '2', foo: 'aAA' },
          { _id: '3', foo: 'BAA'},
          { _id: '4', foo: 'bAA'},
          { _id: '5', foo: '\u0000aAA'},
          { _id: '6', foo: '\u0001AAA'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {"foo": {"$gt": "\u0000\u0000"}},
          "fields": ["_id", "foo"],
          "sort": [{"foo": "asc"}]
        });
      }).then(function (resp) {
        // ASCII vs ICU ordering. just gonna hack this
        if (dbType === 'http') {
          resp.should.deep.equal({
            "docs": [
              { "_id": "2", "foo": "aAA"},
              { "_id": "5", "foo": "\u0000aAA"},
              { "_id": "1", "foo": "AAA"},
              { "_id": "6", "foo": "\u0001AAA"},
              { "_id": "4", "foo": "bAA"},
              { "_id": "3", "foo": "BAA"}
            ]
          });
        } else {
          resp.should.deep.equal({
            docs: [
              { _id: '5', foo: '\u0000aAA' },
              { _id: '6', foo: '\u0001AAA' },
              { _id: '1', foo: 'AAA' },
              { _id: '3', foo: 'BAA' },
              { _id: '2', foo: 'aAA' },
              { _id: '4', foo: 'bAA' }
            ]
          });
        }
      });
    });

    it('deletes indexes', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        return db.deleteIndex(resp.indexes[1]);
      }).then(function (resp) {
        resp.should.deep.equal({ok: true});
        return db.getIndexes();
      }).then(function (resp) {
        resp.should.deep.equal({"indexes":[
          {"ddoc":null,"name":"_all_docs","type":"special","def":{"fields":[{"_id":"asc"}]}}
        ]});
      });
    });

    it('does gt queries', function () {
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
          selector: {foo: {"$gt": "eb"}},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'},
            {_id: '2', foo: 'ebb'},
            {_id: '1', foo: 'eyo'}
          ]
        });
      });
    });

    it('does lt queries', function () {
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
          selector: {foo: {"$lt": "eb"}},
          fields: ["_id", "foo"]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '4', foo: 'abo'}
          ]
        });
      });
    });

    it('does lte queries', function () {
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
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '4', foo: 'abo'},
            {_id: '3', foo: 'eba'},
          ]
        });
      });
    });

    it('does gt queries, desc sort', function () {
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
          selector: {foo: {"$gt": "eb"}},
          fields: ["_id", "foo"],
          sort: [{foo: "desc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '1', foo: 'eyo'},
            {_id: '2', foo: 'ebb'},
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('does eq queries', function () {
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
          selector: {foo: "eba"},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('does explicit $eq queries', function () {
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
          selector: {foo: {$eq: "eba"}},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            { _id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it.skip('does ne queries', function () {
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
          selector: {foo: {eq: "eba"}},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            { _id: '4', foo: 'abo'},
            { _id: '2', foo: 'ebb'},
            { _id: '1', foo: 'eyo'}
          ]
        });
      });
    });

    it('does eq queries, no fields', function () {
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
          selector: {foo: "eba"},
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        should.exist(resp.docs[0]._rev);
        delete resp.docs[0]._rev;
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('does eq queries, no fields or sort', function () {
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
          selector: {foo: "eba"}
        });
      }).then(function (resp) {
        should.exist(resp.docs[0]._rev);
        delete resp.docs[0]._rev;
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('does eq queries, no index name', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        // this is some kind of auto-generated hash
        resp.indexes[1].ddoc.should.match(/_design\/.*/);
        var ddocName = resp.indexes[1].ddoc.split('/')[1];
        resp.indexes[1].name.should.equal(ddocName);
        delete resp.indexes[1].ddoc;
        delete resp.indexes[1].name;
        resp.should.deep.equal({
          "indexes": [
            {
              "ddoc": null,
              "name": "_all_docs",
              "type": "special",
              "def": {
                "fields": [
                  {
                    "_id": "asc"
                  }
                ]
              }
            },
            {
              "type": "json",
              "def": {
                "fields": [
                  {
                    "foo": "asc"
                  }
                ]
              }
            }
          ]
        });
        return db.get('_design/' + ddocName);
      }).then(function (ddoc) {
        var ddocId = ddoc._id.split('/')[1];

        Object.keys(ddoc.views).should.deep.equal([ddocId]);
        delete ddoc._id;
        delete ddoc._rev;
        ddoc.views.theView = ddoc.views[ddocId];
        delete ddoc.views[ddocId];
        delete ddoc.views.theView.options.w;

        ddoc.should.deep.equal({
          "language": "query",
          "views": {
            theView: {
              "map": {
                "fields": {
                  "foo": "asc"
                }
              },
              "reduce": "_count",
              "options": {
                "def": {
                  "fields": [
                    "foo"
                  ]
                }
              }
            }
          }
        });

        return db.find({
          selector: {foo: "eba"}
        });
      }).then(function (resp) {
        should.exist(resp.docs[0]._rev);
        delete resp.docs[0]._rev;
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('supported mixed sort', function () {
      var index = {
        "index": {
          "fields": [
            "foo",
            "bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a1', foo: 'a', bar: '1'},
          {_id: 'a2', foo: 'a', bar: '2'},
          {_id: 'b1', foo: 'b', bar: '1'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {$gte: 'a'}}
        });
      }).then(function (res) {
        res.docs.forEach(function (doc) {
          should.exist(doc._rev);
          delete doc._rev;
        });
        res.should.deep.equal({
          "docs": [
            {
              "_id": "a1",
              "foo": "a",
              "bar": "1"
            },
            {
              "_id": "a2",
              "foo": "a",
              "bar": "2"
            },
            {
              "_id": "b1",
              "foo": "b",
              "bar": "1"
            }
          ]
        });
      });
    });

    it('supported mixed sort 2', function () {
      var index = {
        "index": {
          "fields": [
            "foo",
            "bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a1', foo: 'a', bar: '1'},
          {_id: 'a2', foo: 'a', bar: '2'},
          {_id: 'b1', foo: 'b', bar: '1'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {$gte: 'b'}}
        });
      }).then(function (res) {
        res.docs.forEach(function (doc) {
          should.exist(doc._rev);
          delete doc._rev;
        });
        res.should.deep.equal({
          "docs": [
            {
              "_id": "b1",
              "foo": "b",
              "bar": "1"
            }
          ]
        });
      });
    });

    it('error: gimme some args', function () {
      return db.find().then(function () {
        throw Error('should not be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('error: missing required key selector', function () {
      return db.find({}).then(function () {
        throw Error('should not be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('error: unsupported mixed sort', function () {
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

  });
}
