'use strict';

// These tests are written for #9002 and #9003, which only concerns the
// indexeddb-adapter, but they need to work on all backends anyway.

describe('test.issue9002f.js', () => {
  beforeEach(async () => {
    const db = context.db;
    await db.bulkDocs([
      { _id: "issue9002", foo: { bar: "baz" }, 2: "value"},
      { _id: "issue9003", anobject: { without: "need to rewrite" }, year: { 2024: [] }},
    ]);
    await db.createIndex({
      index: {
        "fields": ["year.2024"]
      }
    });
    await db.createIndex({
      index: {
        "fields": ["foo.bar"]
      },
    });
  });

  it('query works without rewrite in nested object (#9002)', async () => {
    const resp = await context.db.find({
      selector: {
        "foo.bar": "baz"
      },
      fields: ["_id"]
    });
    resp.docs.should.deep.equal([{ _id: "issue9002"}]);
  });

  it('index works with rewrite in later field (#9003)', async () => {
    const resp = await context.db.find({
      selector: {
        "year.2024": { $exists: true }
      },
      fields: ["_id"]
    });
    resp.docs.should.deep.equal([{ _id: "issue9003"}]);
  });

});
