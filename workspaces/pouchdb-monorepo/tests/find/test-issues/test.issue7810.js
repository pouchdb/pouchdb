"use strict";

describe("test.issue7810.js", function () {
  var adapter = testUtils.adapterType();
  var dbs = {};

  const docData = {
    _id: "foobar",
    indexedField: "foobaz",
    numericField: 1337,
    indexedPairOne: 'foo',
    indexedPairTwo: 'bar'
  };

  function findInDbs(query) {
    return dbs.withIndex.find(query).then((withIndexResults) =>
      dbs.withoutIndex.find(query).then((withoutIndexResults) => ({
        withIndexResults,
        withoutIndexResults,
      }))
    );
  }

  function createIndicesAndPutData() {
    return Promise.all([
      dbs.withIndex.createIndex({
        index: {
          fields: ["indexedField"],
        },
      }),
      dbs.withIndex.createIndex({
        index: {
          fields: [
            'indexedPairOne',
            'indexedPairTwo',
          ],
        },
      }),
      dbs.withIndex.put(docData),
      dbs.withoutIndex.put(docData),
    ]);
  }

  function assertWithAndWithoutLengthOf(results, docLen) {
    const { withIndexResults, withoutIndexResults } = results;
    const withIndexDocs = withIndexResults.docs.length;
    const withoutIndexDocs = withoutIndexResults.docs.length;
    assert.deepEqual(
      withIndexResults.docs,
      withoutIndexResults.docs,
      "indexed and non-indexed should return same results"
    );
    const suffix = docLen === 1 ? '' : 's';
    withIndexDocs.should.equal(docLen, `indexed should return ${docLen} doc${suffix}`);
    withoutIndexDocs.should.equal(docLen, `non-indexed should return ${docLen} doc${suffix}`);
  }

  beforeEach(function () {
    dbs.withIndexName = testUtils.adapterUrl(adapter, "with_index");
    dbs.withoutIndexName = testUtils.adapterUrl(adapter, "without_index");
    dbs.withIndex = new PouchDB(dbs.withIndexName);
    dbs.withoutIndex = new PouchDB(dbs.withoutIndexName);

    return createIndicesAndPutData();
  });

  afterEach(function (done) {
    testUtils.cleanup([dbs.withIndexName, dbs.withoutIndexName], done);
  });

  it("Testing issue #7810 with selector {} - should return 1 doc", function () {
    var query = {
      selector: {},
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 1);
      }
    );
  });

  it("Testing issue #7810 with selector { _id: {} } - should return 0 docs", function () {
    var query = {
      selector: {
        _id: {},
      },
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 0);
      }
    );
  });

  it("Testing issue #7810 with selector { indexedField: {} } - should return 0 docs", function () {
    var query = {
      selector: {
        indexedField: {},
      },
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 0);
      }
    );
  });

  it("Testing issue #7810 with selector { _id: 'foobar'} - should return 1 doc", function () {
    var query = {
      selector: {
        _id: "foobar",
      },
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 1);
      }
    );
  });

  it("Testing issue #7810 with selector { indexedField: 'foobaz' } - should return 1 doc", function () {
    var query = {
      selector: {
        indexedField: "foobaz",
      },
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 1);
      }
    );
  });

  it("Testing issue #7810 with selector { numericField: 1337} - should return 1 doc", function () {
    var query = {
      selector: {
        numericField: 1337,
      },
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 1);
      }
    );
  });

  it("Testing issue #7810 with selector { numericField: 404 } - should return 0 docs", function () {
    var query = {
      selector: {
        numericField: 404,
      },
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 0);
      }
    );
  });


  it("Testing issue #7810 with selector { indexedPairOne: 'foo' } - should return 1 docs", function () {
    var query = {
      selector: {
        indexedPairOne: 'foo',
      },
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 1);
      }
    );
  });

  it("Testing issue #7810 with selector { indexedPairOne: 'baz' } - should return 0 docs", function () {
    var query = {
      selector: {
        indexedPairOne: 'baz'
      },
      limit: 1,
    };
    return findInDbs(query).then(
      (results) => {
        assertWithAndWithoutLengthOf(results, 0);
      }
    );
  });

  it("Testing issue #7810 with selector {} - should return 1 out of 2 docs", function () {
    var query = {
      selector: {},
      limit: 1,
    };
    const otherDoc = {
      _id: "charlie",
      indexedField: "alics",
      numericField: 420,
      indexedPairOne: 'bob',
      indexedPairTwo: 'david'
    };
    return Promise.all([
      dbs.withIndex.put(otherDoc),
      dbs.withoutIndex.put(otherDoc)
    ]).then(function () {
      return findInDbs(query).then(
        (results) => {
          assertWithAndWithoutLengthOf(results, 1);
        }
      );
    });
  });
});
