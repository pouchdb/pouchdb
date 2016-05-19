'use strict';

import uuid from '../../deps/uuid';

import { META_STORE, DOC_STORE } from './util';

var IDB_VERSION = 1;

function createSchema (db) {

  var docStore = db.createObjectStore(DOC_STORE, {keyPath : 'id'});
  docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique: false});
  docStore.createIndex('seq', 'seq', {unique: true});

  db.createObjectStore(META_STORE, {keyPath: 'id'});
}

export default function(openDatabases, api, opts) {

  if (opts.name in openDatabases) {
    return openDatabases[opts.name];
  }

  openDatabases[opts.name] = new Promise(function(resolve, reject) {

    var req = opts.storage
      ? indexedDB.open(opts.name, {version: IDB_VERSION, storage: opts.storage})
      : indexedDB.open(opts.name, IDB_VERSION);

    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (e.oldVersion < 1) {
        createSchema(db);
      }
    };

    req.onsuccess = function (e) {

      var idb = e.target.result;
      idb.onabort = function (e) {
        console.error('Database has a global failure', e.target.error);
        delete openDatabases[opts.name];
        idb.close();
      };

      var metadata = {id: META_STORE};
      var txn = idb.transaction([META_STORE, DOC_STORE], 'readwrite');

      txn.oncomplete = function() {
        resolve({idb: idb, metadata: metadata});
      };

      function getDocCount() {
        txn.objectStore(DOC_STORE)
          .index('deletedOrLocal')
          .count(IDBKeyRange.only(0))
          .onsuccess = function (e) {
            metadata.doc_count = e.target.result;
          };
      }

      var metaStore = txn.objectStore(META_STORE);
      metaStore.get(META_STORE).onsuccess = function (e) {

        metadata = e.target.result || metadata;

        if (!('seq' in metadata)) {
          metadata.seq = 0;
        }

        if (!('db_uuid' in metadata)) {
          metadata.db_uuid = uuid();
          metaStore.put(metadata).onsuccess = getDocCount;
        } else {
          getDocCount();
        }
      }
    };
  });

  return openDatabases[opts.name];
}
