'use strict';


testCases.push(function (dbType, context) {

  describe(dbType + ': test.ddoc.js', function () {

    it.skip('should create an index', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["foo"]
        },
        name: "foo-index",
        type: "json",
        ddoc: 'foo'
      };
      return db.createIndex(index).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('foo-index');
        response.result.should.equal('created');
        return db.createIndex(index);
      }).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('foo-index');
        response.result.should.equal('exists');
        return db.getIndexes();
      }).then(function (resp) {
        resp.should.deep.equal({
          "total_rows": 2,
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
              "ddoc": "_design/foo",
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

    it.skip('should create an index, existing ddoc', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["foo"]
        },
        name: "foo-index",
        type: "json",
        ddoc: 'foo'
      };
      return db.put({
        _id: '_design/foo',
        "language": "query"
      }).then(function () {
        return db.createIndex(index);
      }).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('foo-index');
        response.result.should.equal('created');
        return db.createIndex(index);
      }).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('foo-index');
        response.result.should.equal('exists');
        return db.getIndexes();
      }).then(function (resp) {
        resp.should.deep.equal({
          "total_rows": 2,
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
              "ddoc": "_design/foo",
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

    it.skip('should create an index, reused ddoc', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["foo"]
        },
        name: "foo-index",
        type: "json",
        ddoc: 'myddoc'
      };
      var index2 = {
        index: {
          fields: ['bar']
        },
        name: "bar-index",
        ddoc: 'myddoc'
      };
      return db.createIndex(index).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('foo-index');
        response.result.should.equal('created');
        return db.createIndex(index);
      }).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('foo-index');
        response.result.should.equal('exists');
        return db.createIndex(index2);
      }).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('bar-index');
        response.result.should.equal('created');
        return db.createIndex(index2);
      }).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('bar-index');
        response.result.should.equal('exists');
      }).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        resp.should.deep.equal({
          "total_rows":3,
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
              "ddoc": "_design/myddoc",
              "name": "bar-index",
              "type": "json",
              "def": {
                "fields": [
                  {
                    "bar": "asc"
                  }
                ]
              }
            },
            {
              "ddoc": "_design/myddoc",
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

    it('Error: invalid ddoc lang', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["foo"]
        },
        name: "foo-index",
        type: "json",
        ddoc: 'foo'
      };
      return db.put({
        _id: '_design/foo'
      }).then(function () {
        return db.createIndex(index);
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('handles ddoc with no views and ignores it', function () {
      var db = context.db;

      return db.put({
        _id: '_design/missing-view',
        language: 'query'
      })
      .then(function () {
        return db.getIndexes();
      })
      .then(function (resp) {
        resp.indexes.length.should.equal(1);
      });

    });

    it('supports creating many indexes at the same time', function () {
      // This will time out in IDBNext. This happens because an index creation
      // also queries the view to "warm" it. This triggers our code to decide
      // that the idb handle needs to be dropped and re-created. This is fine if
      // it's done one by one, but if you're doing multiple at the same time
      // they aren't getting queued one after the other and their handles are
      // getting invalidated.
      //
      // We could fix this by being better with how we hold idb handles, or by
      // making sure createIndex (and mango and view queries, since it's the
      // same problem) are queued and don't run in parallel.
      this.timeout(5000);

      return Promise.all([
        context.db.createIndex({index: {fields: ['rank']}}),
        context.db.createIndex({index: {fields: ['series']}}),
        context.db.createIndex({index: {fields: ['debut']}}),
        context.db.createIndex({index: {fields: ['name']}}),
        context.db.createIndex({index: {fields: ['name', 'rank']}}),
        context.db.createIndex({index: {fields: ['name', 'series']}}),
        context.db.createIndex({index: {fields: ['series', 'debut', 'rank']}}),
        context.db.createIndex({index: {fields: ['rank', 'debut']}})
      ]).then(function () {
        // At time of writing the createIndex implentation also performs a
        // search to "warm" the indexes. If this changes to happen async, or not
        // at all, these queries will force the collision to be tested.
        return Promise.all([
          context.db.find({selector: {rank: 'foo'}}),
          context.db.find({selector: {series: 'foo'}}),
          context.db.find({selector: {debut: 'foo'}}),
          context.db.find({selector: {name: 'foo'}}),
          context.db.find({selector: {name: 'foo', rank: 'foo'}}),
          context.db.find({selector: {name: 'foo', series: 'foo'}}),
          context.db.find({selector: {series: 'foo', debut: 'foo', rank: 'foo'}}),
          context.db.find({selector: {rank: 'foo', debut: 'foo'}}),
        ]);
      });
    });
  });
});
