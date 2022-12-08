var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');
var memoryAdapter = require('../../packages/node_modules/pouchdb-adapter-memory');
PouchDB.plugin(memoryAdapter);

describe('test.memory-adapter.js', () => {
  it('Race condition initially discovered with PouchDB in-memory-adapter 7.3.0', async () => {
    const func1 = async () => {
      const pouch1 = new PouchDB('test-db', {
        adapter: 'memory'
      });
      const docId = 'func1doc1';

      // insert
      await pouch1.bulkDocs({
        docs: [{
          _id: docId,
          value: 1,
          _rev: '1-51b2fae5721cc4d3cf7392f19e6cc118'
        }]
      }, {
        new_edits: false
      });

      // update
      let getDocs = await pouch1.bulkGet({
        docs: [{id: docId}],
        revs: true,
        latest: true
      });
      const useRevs = (getDocs).
      results[0].docs[0].ok._revisions;
      useRevs.start = useRevs.start + 1;
      useRevs.ids.unshift('a723631364fbfa906c5ffa8203ac9725');

      await pouch1.bulkDocs({
        docs: [{
          _id: docId,
          value: 2,
          _rev: '2-a723631364fbfa906c5ffa8203ac9725',
          _revisions: useRevs
        }]
      }, {
        new_edits: false
      });

      // delete
      getDocs = await pouch1.bulkGet({
        docs: [{id: docId}],
        revs: true,
        latest: true
      });

      // same via .get
      await pouch1.get(docId);
      // if this is switched to pouch1.destroy(); ... this test will pass.
      pouch1.close();
    };

    const func2 = async () => {
      const pouch2 = new PouchDB(
        'test-db-2', {
          adapter: 'memory',
        });

      await pouch2.createIndex({
        index: {
          fields: ['foo']
        }
      });
      pouch2.destroy();
    };

    // func1 succeeds when run alone.
    // func2 succeeds when run alone.
    // As of PouchDB 7.3.0, when running these functions in parallel, there is a race condition where func2 gets
    // impacted by func1. The result: func2 will hang and the test will timeout.
    await Promise.all([func1(), func2()]);
  });
});
