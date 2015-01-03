'use strict';

var utils = require('../../utils');
var merge = require('../../merge');
var idbUtils = require('./idb-utils');
var idbConstants = require('./idb-constants');

var ADAPTER_VERSION = idbConstants.ADAPTER_VERSION;
var ATTACH_AND_SEQ_STORE = idbConstants.ATTACH_AND_SEQ_STORE;
var ATTACH_STORE = idbConstants.ATTACH_STORE;
var BY_SEQ_STORE = idbConstants.BY_SEQ_STORE;
var DETECT_BLOB_SUPPORT_STORE = idbConstants.DETECT_BLOB_SUPPORT_STORE;
var DOC_STORE = idbConstants.DOC_STORE;
var LOCAL_STORE = idbConstants.LOCAL_STORE;
var META_STORE = idbConstants.META_STORE;

var decodeMetadata = idbUtils.decodeMetadata;
var encodeMetadata = idbUtils.encodeMetadata;
var idbError = idbUtils.idbError;
var cachedDBs = idbUtils.cachedDBs;
var openReqList = idbUtils.openReqList;

var blobSupportPromise;

// called when creating a fresh new database
function createSchema(db) {
  var docStore = db.createObjectStore(DOC_STORE, {keyPath : 'id'});
  db.createObjectStore(BY_SEQ_STORE, {autoIncrement: true})
    .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
  db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
  db.createObjectStore(META_STORE, {keyPath: 'id', autoIncrement: false});
  db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);

  // added in v2
  docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique : false});

  // added in v3
  db.createObjectStore(LOCAL_STORE, {keyPath: '_id'});

  // added in v4
  var attAndSeqStore = db.createObjectStore(ATTACH_AND_SEQ_STORE,
    {autoIncrement: true});
  attAndSeqStore.createIndex('seq', 'seq');
  attAndSeqStore.createIndex('digestSeq', 'digestSeq', {unique: true});
}

// migration to version 2
// unfortunately "deletedOrLocal" is a misnomer now that we no longer
// store local docs in the main doc-store, but whaddyagonnado
function addDeletedOrLocalIndex(txn, callback) {
  var docStore = txn.objectStore(DOC_STORE);
  docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique : false});

  docStore.openCursor().onsuccess = function (event) {
    var cursor = event.target.result;
    if (cursor) {
      var metadata = cursor.value;
      var deleted = utils.isDeleted(metadata);
      metadata.deletedOrLocal = deleted ? "1" : "0";
      docStore.put(metadata);
      cursor.continue();
    } else {
      callback();
    }
  };
}

// migration to version 3 (part 1)
function createLocalStoreSchema(db) {
  db.createObjectStore(LOCAL_STORE, {keyPath: '_id'})
    .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
}

// migration to version 3 (part 2)
function migrateLocalStore(txn, cb) {
  var localStore = txn.objectStore(LOCAL_STORE);
  var docStore = txn.objectStore(DOC_STORE);
  var seqStore = txn.objectStore(BY_SEQ_STORE);

  var cursor = docStore.openCursor();
  cursor.onsuccess = function (event) {
    var cursor = event.target.result;
    if (cursor) {
      var metadata = cursor.value;
      var docId = metadata.id;
      var local = utils.isLocalId(docId);
      var rev = merge.winningRev(metadata);
      if (local) {
        var docIdRev = docId + "::" + rev;
        // remove all seq entries
        // associated with this docId
        var start = docId + "::";
        var end = docId + "::~";
        var index = seqStore.index('_doc_id_rev');
        var range = IDBKeyRange.bound(start, end, false, false);
        var seqCursor = index.openCursor(range);
        seqCursor.onsuccess = function (e) {
          seqCursor = e.target.result;
          if (!seqCursor) {
            // done
            docStore.delete(cursor.primaryKey);
            cursor.continue();
          } else {
            var data = seqCursor.value;
            if (data._doc_id_rev === docIdRev) {
              localStore.put(data);
            }
            seqStore.delete(seqCursor.primaryKey);
            seqCursor.continue();
          }
        };
      } else {
        cursor.continue();
      }
    } else if (cb) {
      cb();
    }
  };
}

// migration to version 4 (part 1)
function addAttachAndSeqStore(db) {
  var attAndSeqStore = db.createObjectStore(ATTACH_AND_SEQ_STORE,
    {autoIncrement: true});
  attAndSeqStore.createIndex('seq', 'seq');
  attAndSeqStore.createIndex('digestSeq', 'digestSeq', {unique: true});
}

// migration to version 4 (part 2)
function migrateAttsAndSeqs(txn, callback) {
  var seqStore = txn.objectStore(BY_SEQ_STORE);
  var attStore = txn.objectStore(ATTACH_STORE);
  var attAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);

  // need to actually populate the table. this is the expensive part,
  // so as an optimization, check first that this database even
  // contains attachments
  var req = attStore.count();
  req.onsuccess = function (e) {
    var count = e.target.result;
    if (!count) {
      return callback(); // done
    }

    seqStore.openCursor().onsuccess = function (e) {
      var cursor = e.target.result;
      if (!cursor) {
        return callback(); // done
      }
      var doc = cursor.value;
      var seq = cursor.primaryKey;
      var atts = Object.keys(doc._attachments || {});
      var digestMap = {};
      for (var j = 0; j < atts.length; j++) {
        var att = doc._attachments[atts[j]];
        digestMap[att.digest] = true; // uniq digests, just in case
      }
      var digests = Object.keys(digestMap);
      for (j = 0; j < digests.length; j++) {
        var digest = digests[j];
        attAndSeqStore.put({
          seq: seq,
          digestSeq: digest + '::' + seq
        });
      }
      cursor.continue();
    };
  };
}

// migration to version 5
// Instead of relying on on-the-fly migration of metadata,
// this brings the doc-store to its modern form:
// - metadata.winningrev
// - metadata.seq
// - stringify the metadata when storing it
function migrateMetadata(txn) {

  function decodeMetadataCompat(storedObject) {
    if (!storedObject.data) {
      // old format, when we didn't store it stringified
      storedObject.deletedOrLocal = storedObject.deletedOrLocal === '1';
      return storedObject;
    }
    return decodeMetadata(storedObject);
  }

  // ensure that every metadata has a winningRev and seq,
  // which was previously created on-the-fly but better to migrate
  var bySeqStore = txn.objectStore(BY_SEQ_STORE);
  var docStore = txn.objectStore(DOC_STORE);
  var cursor = docStore.openCursor();
  cursor.onsuccess = function (e) {
    var cursor = e.target.result;
    if (!cursor) {
      return; // done
    }
    var metadata = decodeMetadataCompat(cursor.value);

    metadata.winningRev = metadata.winningRev || merge.winningRev(metadata);

    function fetchMetadataSeq() {
      // metadata.seq was added post-3.2.0, so if it's missing,
      // we need to fetch it manually
      var start = metadata.id + '::';
      var end = metadata.id + '::\uffff';
      var req = bySeqStore.index('_doc_id_rev').openCursor(
        IDBKeyRange.bound(start, end));

      var metadataSeq = 0;
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) {
          metadata.seq = metadataSeq;
          return onGetMetadataSeq();
        }
        var seq = cursor.primaryKey;
        if (seq > metadataSeq) {
          metadataSeq = seq;
        }
        cursor.continue();
      };
    }

    function onGetMetadataSeq() {
      var metadataToStore = encodeMetadata(metadata,
        metadata.winningRev, metadata.deletedOrLocal);

      var req = docStore.put(metadataToStore);
      req.onsuccess = function () {
        cursor.continue();
      };
    }

    if (metadata.seq) {
      return onGetMetadataSeq();
    }

    fetchMetadataSeq();
  };
}

function idbSetup(api, callback) {

  function initIdb() {

    function onUpgradeNeeded(e) {
      var db = e.target.result;
      if (e.oldVersion < 1) {
        return createSchema(db); // new db, initial schema
      }
      // do migrations

      var txn = e.currentTarget.transaction;
      // these migrations have to be done in this function, before
      // control is returned to the event loop, because IndexedDB

      if (e.oldVersion < 3) {
        createLocalStoreSchema(db); // v2 -> v3
      }
      if (e.oldVersion < 4) {
        addAttachAndSeqStore(db); // v3 -> v4
      }

      var migrations = [
        addDeletedOrLocalIndex, // v1 -> v2
        migrateLocalStore,      // v2 -> v3
        migrateAttsAndSeqs,     // v3 -> v4
        migrateMetadata         // v4 -> v5
      ];

      var i = e.oldVersion;

      function next() {
        var migration = migrations[i - 1];
        i++;
        if (migration) {
          migration(txn, next);
        }
      }

      next();
    }

    function onOpenSuccess(e) {
      api._idb = e.target.result;

      api._idb.onversionchange = function () {
        api._idb.close();
        cachedDBs.delete(api._name);
      };
      api._idb.onabort = function () {
        api._idb.close();
        cachedDBs.delete(api._name);
      };

      var txn = api._idb.transaction([META_STORE, DETECT_BLOB_SUPPORT_STORE],
        'readwrite');

      var req = txn.objectStore(META_STORE).get(META_STORE);

      req.onsuccess = function (e) {
        var meta = e.target.result || {id: META_STORE};
        onGetMetadata(meta);
      };

      function onGetMetadata(meta) {

        function checkSetupComplete() {
          if (api._blobSupport === null || !api._instanceId) {
            return;
          } else {
            cachedDBs.set(api._name, {
              idb: api._idb,
              instanceId: api._instanceId,
              blobSupport: api._blobSupport,
              loaded: true
            });
            callback(null, api);
          }
        }

        function createBlobSupportPromise() {
          // make sure blob support is only checked one
          return new utils.Promise(function (resolve, reject) {
            // 1x1 transparent PNG
            var blob = utils.createBlob([utils.fixBinary(utils.atob(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAA' +
              'BCAQAAAC1HAwCAAAAC0lEQVQYV2NgYA' +
              'AAAAMAAWgmWQ0AAAAASUVORK5CYII='
            ))], {type: 'image/png'});
            txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');
            txn.oncomplete = function () {
              // have to do it in a separate transaction, else the correct
              // content type is always returned
              var blobTxn = api._idb.transaction([DETECT_BLOB_SUPPORT_STORE],
                'readwrite');
              var getBlobReq = blobTxn.objectStore(
                DETECT_BLOB_SUPPORT_STORE).get('key');

              getBlobReq.onerror = reject;
              getBlobReq.onsuccess = function (e) {
                var storedBlob = e.target.result;
                var url = URL.createObjectURL(storedBlob);

                utils.ajax({
                  url: url,
                  cache: true,
                  binary: true
                }, function (err, res) {
                  if (err && err.status === 405) {
                    // firefox won't let us do that. but firefox doesn't
                    // have the blob type bug that Chrome does, so that's ok
                    resolve(true);
                  } else {
                    resolve(!!(res && res.type === 'image/png'));
                  }
                  URL.revokeObjectURL(url);
                });
              };
            };
          }).catch(function (err) {
            return false; // error, so assume unsupported
          });
        }

        function storeId() {
          var idKey = api._name + '_id';
          if (idKey in meta) {
            api._instanceId = meta[idKey];
            checkSetupComplete();
          } else {
            var instanceId = utils.uuid();
            meta[idKey] = instanceId;
            txn.objectStore(META_STORE).put(meta).onsuccess = function () {
              api._instanceId = instanceId;
              checkSetupComplete();
            };
          }
        }

        function checkBlobSupport() {
          // Detect blob support. Chrome didn't support it until version 38.
          // in version 37 they had a broken version where PNGs (and possibly
          // other binary types) aren't stored correctly.
          if (!blobSupportPromise) {
            blobSupportPromise = createBlobSupportPromise();
          }

          blobSupportPromise.then(function (val) {
            api._blobSupport = val;
            checkSetupComplete();
          });
        }

        storeId();
        checkBlobSupport();
      }
    }

    var openReq = indexedDB.open(api._name, ADAPTER_VERSION);

    openReqList.set(api._name, openReq);

    openReq.onupgradeneeded = onUpgradeNeeded;
    openReq.onsuccess = onOpenSuccess;
    openReq.onerror = idbError(callback);
  }

  var cached = cachedDBs.get(api._name);

  if (cached) {
    api._idb = cached.idb;
    api._instanceId = cached.instanceId;
    api._blobSupport = cached.blobSupport;
    process.nextTick(function () {
      callback(null, api);
    });
  } else {
    initIdb();
  }
}

module.exports = idbSetup;