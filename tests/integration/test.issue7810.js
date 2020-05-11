"use strict";

var adapters = ["local", "http"];

adapters.forEach(function (adapter) {
  describe("test.issue7810.js-" + adapter, function () {
    var dbs = {};

    beforeEach(function () {
      dbs.withIndexName = testUtils.adapterUrl(adapter, "with_index");
      dbs.withoutIndexName = testUtils.adapterUrl(adapter, "without_index");
      dbs.withIndex = new PouchDB(dbs.withIndexName);
      dbs.withoutIndex = new PouchDB(dbs.withoutIndexName);
      var docData = {
        _id: "foobar",
        indexedField: "foobaz",
        numericField: 1337,
      };

      return Promise.all([
        dbs.withIndex.createIndex({
          index: {
            fields: ["indexedField"],
          },
        }),
        dbs.withIndex.put(docData),
        dbs.withoutIndex.put(docData),
      ]);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.withIndexName, dbs.withoutIndexName], done);
    });

    it("Testing issue #7810 with selector {} - should return 1 docs", function () {
      var query = {
        selector: {},
        limit: 1,
      };
      return Promise.all([
        dbs.withIndex.find(query),
        dbs.withoutIndex.find(query),
      ]).then((results) => {
        const withIndexDocs = results[0].docs.length;
        const withoutIndexDocs = results[1].docs.length;
        withIndexDocs.should.equal(1, "indexed should return 1 docs");
        withoutIndexDocs.should.equal(1, "non-indexed should return 1 docs");
      });
    });

    it("Testing issue #7810 with selector { _id: {} } - should return 0 docs", function () {
      var query = {
        selector: {
          _id: {},
        },
        limit: 1,
      };
      return Promise.all([
        dbs.withIndex.find(query),
        dbs.withoutIndex.find(query),
      ]).then((results) => {
        const withIndexDocs = results[0].docs.length;
        const withoutIndexDocs = results[1].docs.length;
        should.equal(withIndexDocs, 0, "indexed should return 0 docs");
        should.equal(withoutIndexDocs, 0, "non-indexed should return 0 docs");
      });
    });

    it("Testing issue #7810 with selector { _id: 'foobar'} - should return 1 docs", function () {
      var query = {
        selector: {},
        limit: 1,
      };
      return Promise.all([
        dbs.withIndex.find(query),
        dbs.withoutIndex.find(query),
      ]).then((results) => {
        const withIndexDocs = results[0].docs.length;
        const withoutIndexDocs = results[1].docs.length;
        withIndexDocs.should.equal(1, "indexed should return 1 docs");
        withoutIndexDocs.should.equal(1, "non-indexed should return 1 docs");
      });
    });

    it("Testing issue #7810 with selector { indexedField: 'foobaz' } - should return 1 docs", function () {
      var query = {
        selector: {
          indexedField: "foobaz",
        },
        limit: 1,
      };
      return Promise.all([
        dbs.withIndex.find(query),
        dbs.withoutIndex.find(query),
      ]).then((results) => {
        const withIndexDocs = results[0].docs.length;
        const withoutIndexDocs = results[1].docs.length;
        withIndexDocs.should.equal(1, "indexed should return 1 docs");
        withoutIndexDocs.should.equal(1, "non-indexed should return 1 docs");
      });
    });

    it("Testing issue #7810 with selector { numericField: 1337} - should return 1 docs", function () {
      var query = {
        selector: {
          numericField: 1337,
        },
        limit: 1,
      };
      return Promise.all([
        dbs.withIndex.find(query),
        dbs.withoutIndex.find(query),
      ]).then((results) => {
        const withIndexDocs = results[0].docs.length;
        const withoutIndexDocs = results[1].docs.length;
        withIndexDocs.should.equal(1, "indexed should return 1 docs");
        withoutIndexDocs.should.equal(1, "non-indexed should return 1 docs");
      });
    });

    it("Testing issue #7810 with selector { numericField: 404 } - should return 0 docs", function () {
      var query = {
        selector: {
          numericField: 404,
        },
        limit: 1,
      };
      return Promise.all([
        dbs.withIndex.find(query),
        dbs.withoutIndex.find(query),
      ]).then((results) => {
        const withIndexDocs = results[0].docs.length;
        const withoutIndexDocs = results[1].docs.length;
        should.equal(withIndexDocs, 0, "indexed should return 0 docs");
        should.equal(withoutIndexDocs, 0, "non-indexed should return 0 docs");
      });
    });
  });
});
