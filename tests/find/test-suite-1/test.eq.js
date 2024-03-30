'use strict';

describe('test.eq.js', function () {
  it('does eq queries', function () {
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
        selector: {foo: "eba"},
        fields: ["_id", "foo"],
        sort: [{foo: "asc"}]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{_id: '3', foo: 'eba'}]);
    });
  });

  it('does explicit $eq queries', function () {
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
        selector: {foo: {$eq: "eba"}},
        fields: ["_id", "foo"],
        sort: [{foo: "asc"}]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{ _id: '3', foo: 'eba'}]);
    });
  });

  it('does eq queries, no fields', function () {
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
        selector: {foo: "eba"},
        sort: [{foo: "asc"}]
      });
    }).then(function (resp) {
      should.exist(resp.docs[0]._rev);
      delete resp.docs[0]._rev;
      resp.docs.should.deep.equal([{_id: '3', foo: 'eba'}]);
    });
  });

  it('does eq queries, no fields or sort', function () {
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
        selector: {foo: "eba"}
      });
    }).then(function (resp) {
      should.exist(resp.docs[0]._rev);
      delete resp.docs[0]._rev;
      resp.docs.should.deep.equal([{_id: '3', foo: 'eba'}]);
    });
  });

  it.skip('does eq queries, no index name', function () {
    var db = context.db;
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
        "total_rows":2,
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

  it('#7 does eq queries 1', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["foo"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        { _id: '1', foo: 'eyo', bar: 'zxy'},
        { _id: '2', foo: 'ebb', bar: 'zxy'},
        { _id: '3', foo: 'eba', bar: 'zxz'},
        { _id: '4', foo: 'abo', bar: 'zxz'}
      ]);
    }).then(function () {
      return db.find({
        selector: {foo: {$gt: "a"}, bar: {$eq: 'zxy'}},
        fields: ["_id"],
        sort: [{foo: "asc"}]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{ _id: '2'}, { _id: '1'}]);
    });
  });

  it('#7 does eq queries 2', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["foo", "bar"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', foo: 'eyo', bar: 'zxy'},
        {_id: '2', foo: 'ebb', bar: 'zxy'},
        {_id: '3', foo: 'eba', bar: 'zxz'},
        {_id: '4', foo: 'abo', bar: 'zxz'}
      ]);
    }).then(function () {
      return db.find({
        selector: {foo: {$gt: "a"}, bar: {$eq: 'zxy'}},
        fields: ["_id"],
        sort: [{foo: "asc"}]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{_id: '2'}, {_id: '1'}]);
    });
  });

  it('#170 does queries with a null value', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["field1"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', field1: null, field2: null },
        {_id: '2', field1: null, field2: "1" },
        {_id: '3', field1: "1", field2: null },
      ]);
    }).then(function () {
      return db.find({
        selector: {field1: null},
        fields: ["_id"]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{_id: '1'}, {_id: '2'}]);
    });
  });

  it('#170 does queries with a null value (explicit $eq)', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["field1"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', field1: null, field2: null },
        {_id: '2', field1: null, field2: "1" },
        {_id: '3', field1: "1", field2: null },
      ]);
    }).then(function () {
      return db.find({
        selector: {field1: {$eq: null}},
        fields: ["_id"]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{_id: '1'}, {_id: '2'}]);
    });
  });

  it('#170 does queries with multiple null values', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["field1"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', field1: null, field2: null },
        {_id: '2', field1: null, field2: "1" },
        {_id: '3', field1: "1", field2: null },
      ]);
    }).then(function () {
      return db.find({
        selector: {field1: null, field2: null},
        fields: ["_id"]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{_id: '1'}]);
    });
  });

  it('#170 does queries with multiple null values - $lte', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["field1"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', field1: null, field2: null },
        {_id: '2', field1: null, field2: "1" },
        {_id: '3', field1: "1", field2: null },
      ]);
    }).then(function () {
      return db.find({
        selector: {field1: null, field2: {$lte: null}},
        fields: ["_id"]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{_id: '1'}]);
    });
  });

  it('#170 does queries with multiple null values - $gte', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["field1"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', field1: null, field2: null },
        {_id: '2', field1: null, field2: "1" },
        {_id: '3', field1: "1", field2: null },
      ]);
    }).then(function () {
      return db.find({
        selector: {field1: null, field2: {$gte: null}},
        fields: ["_id"]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([
        {_id: '1'},
        {_id: '2'}
      ]);
    });
  });

  it('#170 does queries with multiple null values - $ne', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["field1"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', field1: null, field2: null },
        {_id: '2', field1: null, field2: "1" },
        {_id: '3', field1: "1", field2: null },
      ]);
    }).then(function () {
      return db.find({
        selector: {field1: null, field2: {$ne: null}},
        fields: ["_id"]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{_id: '2'}]);
    });
  });

  it('#170 does queries with multiple null values - $mod', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["field1"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', field1: null, field2: null },
        {_id: '2', field1: null, field2: 1 },
        {_id: '3', field1: 1, field2: null },
      ]);
    }).then(function () {
      return db.find({
        selector: {field1: null, field2: {$mod: [1, 0]}},
        fields: ["_id"]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([{_id: '2'}]);
    });
  });

  it('#170 does queries with multiple null values - $mod', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["field1"]
      }
    };

    return db.createIndex(index).then(function () {
      return db.bulkDocs([
        {_id: '1', field1: null, field2: null },
        {_id: '2', field1: null, field2: null },
        {_id: '3', field1: null, field2: null },
      ]);
    }).then(function () {
      return db.find({
        selector: {field1: null, field2: {$mod: [1, 0]}},
        fields: ["_id"]
      });
    }).then(function (resp) {
      resp.docs.should.deep.equal([]);
    });
  });

  it('does queries with array containing null', async () => {
    const db = context.db;

    await db.put({ _id: '1', field: [null] });

    const resp = await db.find({
      selector: { field: [null] }
    });

    resp.docs.should.have.length(1);
  });

  describe("implicit/explicit $eq", () => {
    it('implicit $eq queries against objects recurse', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [ "field.a" ]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: '1', field: {a: 1, b: 2}},
          {_id: '2', field: {a: 1, b: {$eq: 1}}},
          {_id: '3', field: {a: 1, b: 1}},
        ]);
      }).then(function () {
        return db.find({
          selector: { field: {a: 1, b: {$eq: 1}} },
          fields: [ "_id" ]
        });
      }).then(function (resp) {
        resp.docs.should.deep.equal([ {_id: '3'} ]);
      });
    });
    it('implicit $eq queries against objects using dot notation recurse', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [ "field.a" ]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: '1', field: {sub: {a: 1, b: 2}}},
          {_id: '2', field: {sub: {a: 1, b: {$eq: 1}}}},
          {_id: '3', field: {sub: {a: 1, b: 1}}},
        ]);
      }).then(function () {
        return db.find({
          selector: {field: {"sub.a": 1, "sub.b": {$eq: 1}}},
          fields: [ "_id" ]
        });
      }).then(function (resp) {
        resp.docs.should.deep.equal([ {_id: '3'} ]);
      });
    });
    it('$allMatch against objects using implicit $eq recurses', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [ "field.a" ]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: '1', field:[{sub: {a: 1, b: 2}}]},
          {_id: '2', field:[{sub: {a: 1, b: {$eq: 1}}}]},
          {_id: '3', field:[{sub: {a: 1, b: 1}}]},
        ]);
      }).then(function () {
        return db.find({
          selector: {field:{ $allMatch:{sub: {a: 1, b: {$eq: 1}}}}},
          fields: [ "_id" ]
        });
      }).then(function (resp) {
        resp.docs.should.deep.equal([ {_id: '3'} ]);
      });
    });
    it('explicit $eq queries against objects compare directly', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [ "field.a" ]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: '1', field: {a: 1, b: 2}},
          {_id: '2', field: {a: 1, b: {$eq: 1}}},
          {_id: '3', field: {a: 1, b: 1}},
        ]);
      }).then(function () {
        return db.find({
          selector: {field: {$eq: {a: 1, b: {$eq: 1}}}},
          fields: [ "_id" ]
        });
      }).then(function (resp) {
        resp.docs.should.deep.equal([{_id: '2'} ]);
      });
    });
    it('explicit $eq queries against objects using dot notation compare directly', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [ "field.a" ]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: '1', field: {sub: {a: 1, b: 2}}},
          {_id: '2', field: {"sub.a": 1, "sub.b": {$eq: 1}}},
          {_id: '3', field: {sub: {a: 1, b: 1}}},
        ]);
      }).then(function () {
        return db.find({
          selector: {field: {$eq: {"sub.a": 1, "sub.b": {$eq: 1}}}},
          fields: [ "_id" ]
        });
      }).then(function (resp) {
        resp.docs.should.deep.equal([ {_id: '2'} ]);
      });
    });
    it('$allMatch against objects using explicit $eq compares directly', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [ "field.a" ]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: '1', field: [ {sub: {a: 1, b: 2}} ]},
          {_id: '2', field: [ {sub: {a: 1, b: {$eq: 1}}} ]},
          {_id: '3', field: [ {sub: {a: 1, b: 1}} ]},
        ]);
      }).then(function () {
        return db.find({
          selector: {field: {$allMatch: {sub: {$eq: {a: 1, b: {$eq: 1}}}}}},
          fields: [ "_id" ]
        });
      }).then(function (resp) {
        resp.docs.should.deep.equal([ {_id: '2'} ]);
      });
    });
  });
});
