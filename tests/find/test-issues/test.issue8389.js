"use strict";

describe("test.issue8389.js", function () {
  var adapter = testUtils.adapterType();
  var db = null;
  var dbName = null;
  
  const docData = {
    _id: "foobar",
    indexedField: "foobaz",
  };

  function createIndicesAndPutData() {
    return Promise.all([
      db.createIndex({
        index: {
          fields: ["indexedField", "_id"],
        },
      }),
      db.put(docData),
    ]);
  }

  function assertLengthOf(query, docLen) {
    return db.find(query).then((results) => {
      const suffix = docLen === 1 ? '' : 's';
      results.docs.length.should.equal(docLen, `find should return ${docLen} doc${suffix}`);
    });
  }

  beforeEach(function () {
    dbName = testUtils.adapterUrl(adapter, "issue8389");
    db = new PouchDB(dbName);

    return createIndicesAndPutData();
  });

  afterEach(function (done) {
    testUtils.cleanup([dbName], done);
  });

  it("Testing issue #8389 _id should work in find index: 0 with nonmatching query", function () {
    var query = {
      selector: {
        indexedField: 'bar',
        _id: 'bar',
      },
    };
    return assertLengthOf(query, 0);
  });
  
  it("Testing issue #8389 _id should work in find index: 1 with matching query", function () {
    var query = {
      selector: {
        indexedField: 'foobaz',
        _id: 'foobar',
      },
    };
    return assertLengthOf(query, 1);
  });

  it("Testing issue #8389 _id should work in find index: 1/2 with multiple docs", function () {
    var query = {
      selector: {
        indexedField: 'foobaz',
        _id: 'foobar',
      },
    };
    const otherDoc = {
      _id: "charlie",
      indexedField: "foobaz",
    };
    return db.put(otherDoc).then(function () {
      return assertLengthOf(query, 1);
    });
  });
  
  it("Testing issue #8389 _id should work in find index: 2/2 with multiple docs", function () {
    var query = {
      selector: {
        indexedField: 'foobaz',
        _id: {
          '$gt': 'a',
        }
      },
    };
    const otherDoc = {
      _id: "charlie",
      indexedField: "foobaz",
    };
    return db.put(otherDoc).then(function () {
      return assertLengthOf(query, 2);
    });
  });
});
