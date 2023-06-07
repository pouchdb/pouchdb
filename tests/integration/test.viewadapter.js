'use strict';

const viewAdapters = testUtils.viewAdapters();

viewAdapters.forEach(viewAdapter => {
  describe('test.viewadapter.js-' + 'local' + '-' + viewAdapter, function () {
    let dbs = {};

    const docs = [
      {title : 'abc', value: 1, _id: 'doc1'},
      {title : 'def', value: 2, _id: 'doc2'},
      {
        _id: '_design/index',
        views: {
          index: {
            map: function mapFun(doc) {
              if (doc.title) {
                emit(doc.title);
              }
            }.toString()
          }
        }
      }
    ];

    function getDBNames(localStorage) {
      const savedDbNames = Object.keys(localStorage).filter(function (key) {
        return key.includes(dbs.name);
      });

      // This is the name of the db where view index data is stored.
      const viewDbName = savedDbNames.find(function (dbName) {
        return dbName.includes('-mrview-');
      });
      // This is the name of the db where documents are stored.
      const docDbName = savedDbNames.find(function (dbName) {
        return !dbName.includes('-mrview-');
      });
      return { viewDbName, docDbName };
    }

    function getDbNamesFromLevelDBFolder(name) {
      const dbs = global.fs.readdirSync('./tmp');
      return dbs.filter((dbName => dbName.includes(name)));
    }

    beforeEach(function () {
      dbs.name = testUtils.adapterUrl('local', 'testdb');
    });

    it('Create pouch with separate view adapters', async function () {
      const db = new PouchDB(dbs.name, {view_adapter: viewAdapter});

      if (db.adapter === viewAdapter) {
        return;
      }

      if (db.adapter !== 'leveldb' && db.adapter !== 'idb') {
        return;
      }

      await db.bulkDocs(docs);
      await db.query('index', { key: 'abc', include_docs: true });

      if (testUtils.isNode()) {
        const dbs = getDbNamesFromLevelDBFolder(db.name);
        dbs.length.should.equal(1); // only one db created on disk, no dependent db created
      } else {
        const { viewDbName, docDbName } = getDBNames(localStorage);
        // check indexedDB for saved views
        // need to add '_pouch_' because views are saved in memory
        const viewRequest = indexedDB.open('_pouch_' + viewDbName, 1);
        viewRequest.onupgradeneeded = function (event) {
          // The version of the view database created is 1 which shows that this
          // database was newly created in IndexedDB and did not exist there
          // before. So the view database was created in the database specified in
          // the view_adapter and not in the default `idb`adapter.
          event.oldVersion.should.equal(0);
          event.newVersion.should.equal(1);
        };

        viewRequest.onsuccess = function () {
          // Nothing is saved here
          viewRequest.result.objectStoreNames.length.should.equal(0);
          viewRequest.result.version.should.equal(1);
        };

        // check indexedDB for saved docs
        const docRequest = indexedDB.open(docDbName, 5);
        docRequest.onsuccess = function () {
          // something is saved here
          docRequest.result.objectStoreNames.length.should.equal(7);
        };
      }
    });

    it('Create pouch with no view adapters', async function () {
      const db = new PouchDB(dbs.name);

      if (db.adapter !== 'leveldb' && db.adapter !== 'idb') {
        return;
      }

      await db.bulkDocs(docs);
      await db.query('index', { key: 'abc', include_docs: true });

      if (testUtils.isNode()) {
        const dbs = getDbNamesFromLevelDBFolder(db.name);
        const expectedLength = db.adapter === 'memory' ? 0 : 2;
        dbs.length.should.equal(expectedLength);
      } else {
        const { viewDbName, docDbName } = getDBNames(localStorage);

        // check indexedDB for saved views
        const viewRequest = indexedDB.open(viewDbName, 5);
        viewRequest.onsuccess = function () {
          // Something is saved here
          // This shows that without a view_adapter specified
          // the view query data is stored in the default adapter database.
          viewRequest.result.objectStoreNames.length.should.equal(7);
        };

        // check indexedDB for saved docs
        const docRequest = indexedDB.open(docDbName, 5);
        docRequest.onsuccess = function () {
          // something is saved here
          docRequest.result.objectStoreNames.length.should.equal(7);
        };
      }
    });
  });
});
