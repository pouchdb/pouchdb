// 'use strict'; is default when ESM

import { uuid } from 'pouchdb-utils';

import { META_STORE, DOC_STORE, rawIndexFields, naturalIndexName, correctIndexFields } from './util.js';

//
// Core PouchDB schema version. Increment this if we, as a library, want to make
// schema changes in indexeddb. See upgradePouchDbSchema()
//
var POUCHDB_IDB_VERSION = 1;

//
// Functions that manage a combinate indexeddb version, by combining the current
// time in millis that represents user migrations with a large multiplier that
// represents PouchDB system migrations.
//
// This lets us use the idb version number to both represent
// PouchDB-library-level migrations as well as "user migrations" required for
// when design documents trigger the addition or removal of native indexes.
//
// Given that Number.MAX_SAFE_INTEGER = 9007199254740991
//
// We can easily use the largest 2-3 digits and either allow:
//  - 900 system migrations up to 2198/02/18
//  - or 89 system migrations up to 5050/02/14
//
// This impl does the former. If this code still exists after 2198 someone send my
// descendants a Spacebook message congratulating them on their impressive genes.
//
// 9007199254740991 <- MAX_SAFE_INTEGER
//   10000000000000 <- 10^13
//    7199254740991 <- 2198-02-18T16:59:00.991Z
//
var versionMultiplier = Math.pow(10, 13);
function createIdbVersion() {
  return (versionMultiplier * POUCHDB_IDB_VERSION) + new Date().getTime();
}
function getPouchDbVersion(version) {
  return Math.floor(version / versionMultiplier);
}

function maintainNativeIndexes(openReq, reject) {
  var docStore = openReq.transaction.objectStore(DOC_STORE);
  var ddocsReq = docStore.getAll(IDBKeyRange.bound('_design/', '_design/\uffff'));

  ddocsReq.onsuccess = function (e) {
    var results = e.target.result;
    var existingIndexNames = Array.from(docStore.indexNames);

    // NB: the only thing we're supporting here is the declared indexing
    // fields nothing more.
    var expectedIndexes = results.filter(function (row) {
      return row.deleted === 0 && row.revs[row.rev].data.views;
    }).map(function (row) {
      return row.revs[row.rev].data;
    }).reduce(function (indexes, ddoc) {
      return Object.keys(ddoc.views).reduce(function (acc, viewName) {
        var fields = rawIndexFields(ddoc, viewName);

        if (fields && fields.length > 0) {
          acc[naturalIndexName(fields)] = correctIndexFields(fields);
        }

        return acc;
      }, indexes);
    }, {});

    var expectedIndexNames = Object.keys(expectedIndexes);

    // Delete any indexes that aren't system indexes or expected
    var systemIndexNames = ['seq'];
    existingIndexNames.forEach(function (index) {
      if (systemIndexNames.indexOf(index) === -1  && expectedIndexNames.indexOf(index) === -1) {
        docStore.deleteIndex(index);
      }
    });

    // Work out which indexes are missing and create them
    var newIndexNames = expectedIndexNames.filter(function (ei) {
      return existingIndexNames.indexOf(ei) === -1;
    });

    try {
      newIndexNames.forEach(function (indexName) {
        docStore.createIndex(indexName, expectedIndexes[indexName]);
      });
    } catch (err) {
      reject(err);
    }
  };
}

function upgradePouchDbSchema(db, pouchdbVersion) {
  if (pouchdbVersion < 1) {
    var docStore = db.createObjectStore(DOC_STORE, {keyPath : 'id'});
    docStore.createIndex('seq', 'seq', {unique: true});

    db.createObjectStore(META_STORE, {keyPath: 'id'});
  }

  // Declare more PouchDB schema changes here
  // if (pouchdbVersion < 2) { .. }
}

function openDatabase(openDatabases, api, opts, resolve, reject) {
  var openReq = opts.versionchanged ?
    indexedDB.open(opts.name) :
    indexedDB.open(opts.name, createIdbVersion());

  openReq.onupgradeneeded = function (e) {
    if (e.oldVersion > 0 && e.oldVersion < versionMultiplier) {
      // This DB was created with the "idb" adapter, **not** this one.
      // For now we're going to just error out here: users must manually
      // migrate between the two. In the future, dependent on performance tests,
      // we might silently migrate
      throw new Error('Incorrect adapter: you should specify the "idb" adapter to open this DB');
    } else if (e.oldVersion === 0 && e.newVersion < versionMultiplier) {
      // Firefox still creates the database with version=1 even if we throw,
      // so we need to be sure to destroy the empty database before throwing
      indexedDB.deleteDatabase(opts.name);
      throw new Error('Database was deleted while open');
    }

    var db = e.target.result;

    var pouchdbVersion = getPouchDbVersion(e.oldVersion);
    upgradePouchDbSchema(db, pouchdbVersion);
    maintainNativeIndexes(openReq, reject);
  };

  openReq.onblocked = function (e) {
      // AFAICT this only occurs if, after sending `onversionchange` events to
      // all other open DBs (ie in different tabs), there are still open
      // connections to the DB. In this code we should never see this because we
      // close our DBs on these events, and all DB interactions are wrapped in
      // safely re-opening the DB.
      console.error('onblocked, this should never happen', e);
  };

  openReq.onsuccess = function (e) {
    var idb = e.target.result;

    idb.onabort = function (e) {
      console.error('Database has a global failure', e.target.error);
      delete openDatabases[opts.name];
      idb.close();
    };

    idb.onversionchange = function () {
      console.log('Database was made stale, closing handle');
      openDatabases[opts.name].versionchanged = true;
      idb.close();
    };

    idb.onclose = function () {
      console.log('Database was made stale, closing handle');
      if (opts.name in openDatabases) {
        openDatabases[opts.name].versionchanged = true;
      }
    };

    var metadata = {id: META_STORE};
    var txn = idb.transaction([META_STORE], 'readwrite');

    txn.oncomplete = function () {
      resolve({idb: idb, metadata: metadata});
    };

    var metaStore = txn.objectStore(META_STORE);
    metaStore.get(META_STORE).onsuccess = function (e) {
      metadata = e.target.result || metadata;
      var changed = false;

      if (!('doc_count' in metadata)) {
        changed = true;
        metadata.doc_count = 0;
      }

      if (!('seq' in metadata)) {
        changed = true;
        metadata.seq = 0;
      }

      if (!('db_uuid' in metadata)) {
        changed = true;
        metadata.db_uuid = uuid();
      }

      if (changed) {
        metaStore.put(metadata);
      }
    };
  };

  openReq.onerror = function (e) {
    reject(e.target.error);
  };
}

export default function (openDatabases, api, opts) {
  if (!openDatabases[opts.name] || openDatabases[opts.name].versionchanged) {
    opts.versionchanged = openDatabases[opts.name] &&
                          openDatabases[opts.name].versionchanged;

    openDatabases[opts.name] = new Promise(function (resolve, reject) {
      openDatabase(openDatabases, api, opts, resolve, reject);
    });
  }

  return openDatabases[opts.name];
}
