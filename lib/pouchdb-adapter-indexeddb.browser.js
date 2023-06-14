import './functionName-9335a350.js';
import { uuid, changesHandler as Changes } from './pouchdb-utils.browser.js';
import { createError, IDB_ERROR, MISSING_DOC, UNKNOWN_ERROR, REV_CONFLICT, MISSING_STUB, BAD_ARG } from './pouchdb-errors.browser.js';
import './__node-resolve_empty-5ffda92e.js';
import './spark-md5-2c57e5fc.js';
import { btoa } from './pouchdb-binary-utils.browser.js';
import { r as readAsBinaryString } from './blobOrBufferToBase64-browser-bbef19a6.js';
import { l as latest, c as compactTree } from './latest-0521537f.js';
import { b as binStringToBluffer } from './base64StringToBlobOrBuffer-browser-cdc72594.js';
import { p as parseDoc } from './parseDoc-5d2a34bd.js';
import { b as binaryMd5 } from './binaryMd5-browser-25ce905b.js';
import { w as winningRev, t as traverseRevTree } from './rootToLeaf-f8d0e78a.js';
import { m as merge } from './merge-7299d068.js';
import { c as collectConflicts } from './collectConflicts-6afe46fc.js';
import { f as filterChange } from './parseUri-b061a2c5.js';
import { r as removeLeafFromRevTree } from './removeLeafFromTree-e50643f7.js';
import './_commonjsHelpers-24198af3.js';
import './bulkGetShim-d4877145.js';
import './toPromise-9dada06a.js';
import './clone-abfcddc8.js';
import './guardedConsole-f54e5a40.js';
import './explainError-browser-c025e6c9.js';
import './flatten-994f45c6.js';
import './rev-5645662a.js';
import './stringMd5-browser-5aecd2bd.js';
import './isRemote-f9121da9.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './scopeEval-ff3a416d.js';
import './upsert-331b6913.js';

// 'use strict'; is default when ESM

var IDB_NULL = Number.MIN_SAFE_INTEGER;
var IDB_FALSE = Number.MIN_SAFE_INTEGER + 1;
var IDB_TRUE = Number.MIN_SAFE_INTEGER + 2;

// These are the same as bellow but without the global flag
// we want to use RegExp.test because it's really fast, but the global flag
// makes the regex const stateful (seriously) as it walked through all instances
var TEST_KEY_INVALID = /^[^a-zA-Z_$]|[^a-zA-Z0-9_$]+/;
var TEST_PATH_INVALID = /\\.|(^|\.)[^a-zA-Z_$]|[^a-zA-Z0-9_$.]+/;
function needsSanitise(name, isPath) {
  if (isPath) {
    return TEST_PATH_INVALID.test(name);
  } else {
    return TEST_KEY_INVALID.test(name);
  }
}

//
// IndexedDB only allows valid JS names in its index paths, whereas JSON allows
// for any string at all. This converts invalid JS names to valid ones, to allow
// for them to be indexed.
//
// For example, "foo-bar" is a valid JSON key, but cannot be a valid JS name
// (because that would be read as foo minus bar).
//
// Very high level rules for valid JS names are:
//  - First character cannot start with a number
//  - Otherwise all characters must be be a-z, A-Z, 0-9, $ or _.
//  - We allow . unless the name represents a single field, as that represents
//    a deep index path.
//
// This is more aggressive than it needs to be, but also simpler.
//
var KEY_INVALID = new RegExp(TEST_KEY_INVALID.source, 'g');
var PATH_INVALID = new RegExp(TEST_PATH_INVALID.source, 'g');
var SLASH = '\\'.charCodeAt(0);
const IS_DOT = '.'.charCodeAt(0);

function sanitise(name, isPath) {
  var correctCharacters = function (match) {
    var good = '';
    for (var i = 0; i < match.length; i++) {
      var code = match.charCodeAt(i);
      // If you're sanitising a path, a slash character is there to be interpreted
      // by whatever parses the path later as "escape the next thing".
      //
      // e.g., if you want to index THIS string:
      //   {"foo": {"bar.baz": "THIS"}}
      // Your index path would be "foo.bar\.baz".

      if (code === IS_DOT && isPath && i === 0) {
        good += '.';
      } else if (code === SLASH && isPath) {
        continue;
      } else {
        good += '_c' + code + '_';
      }
    }
    return good;
  };

  if (isPath) {
    return name.replace(PATH_INVALID, correctCharacters);
  } else {
    return name.replace(KEY_INVALID, correctCharacters);
  }
}

function needsRewrite(data) {
  for (var key of Object.keys(data)) {
    if (needsSanitise(key)) {
      return true;
    } else if (data[key] === null || typeof data[key] === 'boolean') {
      return true;
    } else if (typeof data[key] === 'object') {
      return needsRewrite(data[key]);
    }
  }
}

function rewrite(data) {
  if (!needsRewrite(data)) {
    return false;
  }

  var isArray = Array.isArray(data);
  var clone = isArray
    ? []
    : {};

  Object.keys(data).forEach(function (key) {
    var safeKey = isArray ? key : sanitise(key);

    if (data[key] === null) {
      clone[safeKey] = IDB_NULL;
    } else if (typeof data[key] === 'boolean') {
      clone[safeKey] = data[key] ? IDB_TRUE : IDB_FALSE;
    } else if (typeof data[key] === 'object') {
      clone[safeKey] = rewrite(data[key]);
    } else {
      clone[safeKey] = data[key];
    }
  });

  return clone;
}

// 'use strict'; is default when ESM


var DOC_STORE = 'docs';
var META_STORE = 'meta';

function idbError(callback) {
  return function (evt) {
    var message = 'unknown_error';
    if (evt.target && evt.target.error) {
      message = evt.target.error.name || evt.target.error.message;
    }
    callback(createError(IDB_ERROR, message, evt.type));
  };
}

function processAttachment(name, src, doc, isBinary) {

  delete doc._attachments[name].stub;

  if (isBinary) {
    doc._attachments[name].data =
      src.attachments[doc._attachments[name].digest].data;
    return Promise.resolve();
  }

  return new Promise(function (resolve) {
    var data = src.attachments[doc._attachments[name].digest].data;
    readAsBinaryString(data, function (binString) {
      doc._attachments[name].data = btoa(binString);
      delete doc._attachments[name].length;
      resolve();
    });
  });
}

function rawIndexFields(ddoc, viewName) {
  // fields are an array of either the string name of the field, or a key value
  var fields = ddoc.views[viewName].options &&
               ddoc.views[viewName].options.def &&
               ddoc.views[viewName].options.def.fields || [];

  // Either ['foo'] or [{'foo': 'desc'}]
  return fields.map(function (field) {
    if (typeof field === 'string') {
      return field;
    } else {
      return Object.keys(field)[0];
    }
  });
}

/**
 * true if the view is has a "partial_filter_selector".
 */
function isPartialFilterView(ddoc, viewName) {
  return viewName in ddoc.views &&
    ddoc.views[viewName].options &&
    ddoc.views[viewName].options.def &&
    ddoc.views[viewName].options.def.partial_filter_selector;
}

function naturalIndexName(fields) {
  return '_find_idx/' + fields.join('/');
}

/**
 * Convert the fields the user gave us in the view and convert them to work for
 * indexeddb.
 *
 * fields is an array of field strings. A field string could be one field:
 *   'foo'
 * Or it could be a json path:
 *   'foo.bar'
 */
function correctIndexFields(fields) {
  // Every index has to have deleted at the front, because when we do a query
  // we need to filter out deleted documents.
  return ['deleted'].concat(
    fields.map(function (field) {
      if (['_id', '_rev', '_deleted', '_attachments'].includes(field)) {
        // These properties are stored at the top level without the underscore
        return field.substr(1);
      } else {
        // The custom document fields are inside the `data` property
        return 'data.' + sanitise(field, true);
      }
    })
  );
}

// 'use strict'; is default when ESM


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

function setup (openDatabases, api, opts) {
  if (!openDatabases[opts.name] || openDatabases[opts.name].versionchanged) {
    opts.versionchanged = openDatabases[opts.name] &&
                          openDatabases[opts.name].versionchanged;

    openDatabases[opts.name] = new Promise(function (resolve, reject) {
      openDatabase(openDatabases, api, opts, resolve, reject);
    });
  }

  return openDatabases[opts.name];
}

// 'use strict'; is default when ESM

function info (metadata, callback) {
  callback(null, {
    doc_count: metadata.doc_count,
    update_seq: metadata.seq
  });
}

// 'use strict'; is default when ESM


function get (txn, id, opts, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  txn.txn.objectStore(DOC_STORE).get(id).onsuccess = function (e) {
    var doc = e.target.result;
    var rev;
    if (!opts.rev) {
      rev = (doc && doc.rev);
    } else {
      rev = opts.latest ? latest(opts.rev, doc) : opts.rev;
    }

    if (!doc || (doc.deleted && !opts.rev) || !(rev in doc.revs)) {
      callback(createError(MISSING_DOC, 'missing'));
      return;
    }

    var result = doc.revs[rev].data;
    result._id = doc.id;
    result._rev = rev;

    // WARNING: expecting possible old format
    // TODO: why are we passing the transaction in the context?
    //       It's not clear we ever thread these txns usefully
    callback(null, {
      doc: result,
      metadata: doc,
      ctx: txn
    });
  };
}

// 'use strict'; is default when ESM


function parseAttachment(attachment, opts, cb) {
  if (opts.binary) {
    return cb(null, attachment);
  } else {
    readAsBinaryString(attachment, function (binString) {
      cb(null, btoa(binString));
    });
  }
}

function getAttachment(txn, docId, attachId, _, opts, cb) {
  if (txn.error) {
    return cb(txn.error);
  }

  var attachment;

  txn.txn.objectStore(DOC_STORE).get(docId).onsuccess = function (e) {
    var doc = e.target.result;
    var rev = doc.revs[opts.rev || doc.rev].data;
    var digest = rev._attachments[attachId].digest;
    attachment = doc.attachments[digest].data;
  };

  txn.txn.oncomplete = function () {
    parseAttachment(attachment, opts, cb);
  };

  txn.txn.onabort = cb;
}

// 'use strict'; is default when ESM


function bulkDocs (api, req, opts, metadata, dbOpts, idbChanges, callback) {

  var txn;

  // TODO: I would prefer to get rid of these globals
  var error;
  var results = [];
  var docs = [];
  var lastWriteIndex;

  var revsLimit = dbOpts.revs_limit || 1000;
  var rewriteEnabled = dbOpts.name.indexOf("-mrview-") === -1;
  const autoCompaction = dbOpts.auto_compaction;

  // We only need to track 1 revision for local documents
  function docsRevsLimit(doc) {
    return doc.id.startsWith('_local/') ? 1 : revsLimit;
  }

  function rootIsMissing(doc) {
    return doc.rev_tree[0].ids[1].status === 'missing';
  }

  function parseBase64(data) {
    try {
      return atob(data);
    } catch (e) {
      return {
        error: createError(BAD_ARG, 'Attachment is not a valid base64 string')
      };
    }
  }

  // Reads the original doc from the store if available
  // As in allDocs with keys option using multiple get calls is the fastest way
  function fetchExistingDocs(txn, docs) {
    var fetched = 0;
    var oldDocs = {};

    function readDone(e) {
      if (e.target.result) {
        oldDocs[e.target.result.id] = e.target.result;
      }
      if (++fetched === docs.length) {
        processDocs(txn, docs, oldDocs);
      }
    }

    docs.forEach(function (doc) {
      txn.objectStore(DOC_STORE).get(doc.id).onsuccess = readDone;
    });
  }

  function revHasAttachment(doc, rev, digest) {
    return doc.revs[rev] &&
      doc.revs[rev].data._attachments &&
      Object.values(doc.revs[rev].data._attachments).find(function (att) {
        return att.digest === digest;
      });
  }

  function processDocs(txn, docs, oldDocs) {

    docs.forEach(function (doc, i) {
      var newDoc;

      // The first document write cannot be a deletion
      if ('was_delete' in opts && !(Object.prototype.hasOwnProperty.call(oldDocs, doc.id))) {
        newDoc = createError(MISSING_DOC, 'deleted');

      // The first write of a document cannot specify a revision
      } else if (opts.new_edits &&
                 !Object.prototype.hasOwnProperty.call(oldDocs, doc.id) &&
                 rootIsMissing(doc)) {
        newDoc = createError(REV_CONFLICT);

      // Update the existing document
      } else if (Object.prototype.hasOwnProperty.call(oldDocs, doc.id)) {
        newDoc = update(txn, doc, oldDocs[doc.id]);
        // The update can be rejected if it is an update to an existing
        // revision, if so skip it
        if (newDoc == false) {
          return;
        }

      // New document
      } else {
        // Ensure new documents are also stemmed
        var merged = merge([], doc.rev_tree[0], docsRevsLimit(doc));
        doc.rev_tree = merged.tree;
        doc.stemmedRevs = merged.stemmedRevs;
        newDoc = doc;
        newDoc.isNewDoc = true;
        newDoc.wasDeleted = doc.revs[doc.rev].deleted ? 1 : 0;
      }

      if (newDoc.error) {
        results[i] = newDoc;
      } else {
        oldDocs[newDoc.id] = newDoc;
        lastWriteIndex = i;
        write(txn, newDoc, i);
      }
    });
  }

  // Converts from the format returned by parseDoc into the new format
  // we use to store
  function convertDocFormat(doc) {

    var newDoc = {
      id: doc.metadata.id,
      rev: doc.metadata.rev,
      rev_tree: doc.metadata.rev_tree,
      revs: doc.metadata.revs || {}
    };

    newDoc.revs[newDoc.rev] = {
      data: doc.data,
      deleted: doc.metadata.deleted
    };

    return newDoc;
  }

  function update(txn, doc, oldDoc) {

    // Ignore updates to existing revisions
    if ((doc.rev in oldDoc.revs) && !opts.new_edits) {
      return false;
    }

    var isRoot = /^1-/.test(doc.rev);

    // Reattach first writes after a deletion to last deleted tree
    if (oldDoc.deleted && !doc.deleted && opts.new_edits && isRoot) {
      var tmp = doc.revs[doc.rev].data;
      tmp._rev = oldDoc.rev;
      tmp._id = oldDoc.id;
      doc = convertDocFormat(parseDoc(tmp, opts.new_edits, dbOpts));
    }

    var merged = merge(oldDoc.rev_tree, doc.rev_tree[0], docsRevsLimit(doc));
    doc.stemmedRevs = merged.stemmedRevs;
    doc.rev_tree = merged.tree;

    // Merge the old and new rev data
    var revs = oldDoc.revs;
    revs[doc.rev] = doc.revs[doc.rev];
    doc.revs = revs;

    doc.attachments = oldDoc.attachments;

    var inConflict = opts.new_edits && (((oldDoc.deleted && doc.deleted) ||
       (!oldDoc.deleted && merged.conflicts !== 'new_leaf') ||
       (oldDoc.deleted && !doc.deleted && merged.conflicts === 'new_branch') ||
       (oldDoc.rev === doc.rev)));

    if (inConflict) {
      return createError(REV_CONFLICT);
    }

    doc.wasDeleted = oldDoc.deleted;

    return doc;
  }

  function write(txn, doc, i) {

    // We copy the data from the winning revision into the root
    // of the document so that it can be indexed
    var winningRev$1 = winningRev(doc);
    // rev of new doc for attachments and to return it
    var writtenRev = doc.rev;
    var isLocal = doc.id.startsWith('_local/');

    var theDoc = doc.revs[winningRev$1].data;

    const isNewDoc = doc.isNewDoc;

    if (rewriteEnabled) {
      // doc.data is what we index, so we need to clone and rewrite it, and clean
      // it up for indexability
      var result = rewrite(theDoc);
      if (result) {
        doc.data = result;
        delete doc.data._attachments;
      } else {
        doc.data = theDoc;
      }
    } else {
      doc.data = theDoc;
    }

    doc.rev = winningRev$1;
    // .deleted needs to be an int for indexing
    doc.deleted = doc.revs[winningRev$1].deleted ? 1 : 0;

    // Bump the seq for every new (non local) revision written
    // TODO: index expects a unique seq, not sure if ignoring local will
    // work
    if (!isLocal) {
      doc.seq = ++metadata.seq;

      var delta = 0;
      // If its a new document, we wont decrement if deleted
      if (doc.isNewDoc) {
        delta = doc.deleted ? 0 : 1;
      } else if (doc.wasDeleted !== doc.deleted) {
        delta = doc.deleted ? -1 : 1;
      }
      metadata.doc_count += delta;
    }
    delete doc.isNewDoc;
    delete doc.wasDeleted;

    // If there have been revisions stemmed when merging trees,
    // delete their data
    let revsToDelete = doc.stemmedRevs || [];

    if (autoCompaction && !isNewDoc) {
      const result = compactTree(doc);
      if (result.length) {
        revsToDelete = revsToDelete.concat(result);
      }
    }

    if (revsToDelete.length) {
      revsToDelete.forEach(function (rev) { delete doc.revs[rev]; });
    }

    delete doc.stemmedRevs;

    if (!('attachments' in doc)) {
      doc.attachments = {};
    }

    if (theDoc._attachments) {
      for (var k in theDoc._attachments) {
        var attachment = theDoc._attachments[k];
        if (attachment.stub) {
          if (!(attachment.digest in doc.attachments)) {
            error = createError(MISSING_STUB);
            // TODO: Not sure how safe this manual abort is, seeing
            // console issues
            txn.abort();
            return;
          }

          if (revHasAttachment(doc, writtenRev, attachment.digest)) {
            doc.attachments[attachment.digest].revs[writtenRev] = true;
          }

        } else {

          doc.attachments[attachment.digest] = attachment;
          doc.attachments[attachment.digest].revs = {};
          doc.attachments[attachment.digest].revs[writtenRev] = true;

          theDoc._attachments[k] = {
            stub: true,
            digest: attachment.digest,
            content_type: attachment.content_type,
            length: attachment.length,
            revpos: parseInt(writtenRev, 10)
          };
        }
      }
    }

    // Local documents have different revision handling
    if (isLocal && doc.deleted) {
      txn.objectStore(DOC_STORE).delete(doc.id).onsuccess = function () {
        results[i] = {
          ok: true,
          id: doc.id,
          rev: '0-0'
        };
      };
      updateSeq(i);
      return;
    }

    txn.objectStore(DOC_STORE).put(doc).onsuccess = function () {
      results[i] = {
        ok: true,
        id: doc.id,
        rev: writtenRev
      };
      updateSeq(i);
    };
  }

  function updateSeq(i) {
    if (i === lastWriteIndex) {
      txn.objectStore(META_STORE).put(metadata);
    }
  }

  function preProcessAttachment(attachment) {
    if (attachment.stub) {
      return Promise.resolve(attachment);
    }

    var binData;
    if (typeof attachment.data === 'string') {
      binData = parseBase64(attachment.data);
      if (binData.error) {
        return Promise.reject(binData.error);
      }
      attachment.data = binStringToBluffer(binData, attachment.content_type);
    } else {
      binData = attachment.data;
    }

    return new Promise(function (resolve) {
      binaryMd5(binData, function (result) {
        attachment.digest = 'md5-' + result;
        attachment.length = binData.size || binData.length || 0;
        resolve(attachment);
      });
    });
  }

  function preProcessAttachments() {
    var promises = docs.map(function (doc) {
      var data = doc.revs[doc.rev].data;
      if (!data._attachments) {
        return Promise.resolve(data);
      }
      var attachments = Object.keys(data._attachments).map(function (k) {
        data._attachments[k].name = k;
        return preProcessAttachment(data._attachments[k]);
      });

      return Promise.all(attachments).then(function (newAttachments) {
        var processed = {};
        newAttachments.forEach(function (attachment) {
          processed[attachment.name] = attachment;
          delete attachment.name;
        });
        data._attachments = processed;
        return data;
      });
    });
    return Promise.all(promises);
  }

  for (var i = 0, len = req.docs.length; i < len; i++) {
    var result;
    // TODO: We should get rid of throwing for invalid docs, also not sure
    // why this is needed in idb-next and not idb
    try {
      result = parseDoc(req.docs[i], opts.new_edits, dbOpts);
    } catch (err) {
      result = err;
    }
    if (result.error) {
      return callback(result);
    }

    // Ideally parseDoc would return data in this format, but it is currently
    // shared so we need to convert
    docs.push(convertDocFormat(result));
  }

  preProcessAttachments().then(function () {
    api._openTransactionSafely([DOC_STORE, META_STORE], 'readwrite', function (err, _txn) {
      if (err) {
        return callback(err);
      }

      txn = _txn;

      txn.onabort = function () {
        callback(error || createError(UNKNOWN_ERROR, 'transaction was aborted'));
      };
      txn.ontimeout = idbError(callback);

      txn.oncomplete = function () {
        idbChanges.notify(dbOpts.name);
        callback(null, results);
      };

      // We would like to use promises here, but idb sucks
      fetchExistingDocs(txn, docs);
    });
  }).catch(function (err) {
    callback(err);
  });
}

// 'use strict'; is default when ESM


function allDocsKeys(keys, docStore, allDocsInner) {
  // It's not guaranted to be returned in right order
  var valuesBatch = new Array(keys.length);
  var count = 0;
  keys.forEach(function (key, index) {
    docStore.get(key).onsuccess = function (event) {
      if (event.target.result) {
      valuesBatch[index] = event.target.result;
      } else {
        valuesBatch[index] = {key: key, error: 'not_found'};
      }
      count++;
      if (count === keys.length) {
        valuesBatch.forEach(function (doc) {
            allDocsInner(doc);
        });
      }
    };
  });
}

function createKeyRange(start, end, inclusiveEnd, key, descending) {
  try {
    if (start && end) {
      if (descending) {
        return IDBKeyRange.bound(end, start, !inclusiveEnd, false);
      } else {
        return IDBKeyRange.bound(start, end, false, !inclusiveEnd);
      }
    } else if (start) {
      if (descending) {
        return IDBKeyRange.upperBound(start);
      } else {
        return IDBKeyRange.lowerBound(start);
      }
    } else if (end) {
      if (descending) {
        return IDBKeyRange.lowerBound(end, !inclusiveEnd);
      } else {
        return IDBKeyRange.upperBound(end, !inclusiveEnd);
      }
    } else if (key) {
      return IDBKeyRange.only(key);
    }
  } catch (e) {
    return {error: e};
  }
  return null;
}

function handleKeyRangeError(opts, metadata, err, callback) {
  if (err.name === "DataError" && err.code === 0) {
    // data error, start is less than end
    var returnVal = {
      total_rows: metadata.doc_count,
      offset: opts.skip,
      rows: []
    };
    /* istanbul ignore if */
    if (opts.update_seq) {
      returnVal.update_seq = metadata.seq;
    }
    return callback(null, returnVal);
  }
  callback(createError(IDB_ERROR, err.name, err.message));
}

function allDocs (txn, metadata, opts, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  // TODO: Weird hack, I dont like it
  if (opts.limit === 0) {
    var returnVal = {
      total_rows: metadata.doc_count,
      offset: opts.skip,
      rows: []
    };

    /* istanbul ignore if */
    if (opts.update_seq) {
      returnVal.update_seq = metadata.seq;
    }
    return callback(null, returnVal);
  }

  var results = [];
  var processing = [];

  var start = 'startkey' in opts ? opts.startkey : false;
  var end = 'endkey' in opts ? opts.endkey : false;
  var key = 'key' in opts ? opts.key : false;
  var keys = 'keys' in opts ? opts.keys : false;
  var skip = opts.skip || 0;
  var limit = typeof opts.limit === 'number' ? opts.limit : -1;
  var inclusiveEnd = opts.inclusive_end !== false;
  var descending = 'descending' in opts && opts.descending ? 'prev' : null;

  var keyRange;
  if (!keys) {
    keyRange = createKeyRange(start, end, inclusiveEnd, key, descending);
    if (keyRange && keyRange.error) {
      return handleKeyRangeError(opts, metadata, keyRange.error, callback);
    }
  }

  var docStore = txn.txn.objectStore(DOC_STORE);

  txn.txn.oncomplete = onTxnComplete;

  if (keys) {
    return allDocsKeys(opts.keys, docStore, allDocsInner);
  }

  function include_doc(row, doc) {
    var docData = doc.revs[doc.rev].data;

    row.doc = docData;
    row.doc._id = doc.id;
    row.doc._rev = doc.rev;
    if (opts.conflicts) {
      var conflicts = collectConflicts(doc);
      if (conflicts.length) {
        row.doc._conflicts = conflicts;
      }
    }
    if (opts.attachments && docData._attachments) {
      for (var name in docData._attachments) {
        processing.push(processAttachment(name, doc, row.doc, opts.binary));
      }
    }
  }

  function allDocsInner(doc) {
    if (doc.error && keys) {
      // key was not found with "keys" requests
      results.push(doc);
      return true;
    }

    var row = {
      id: doc.id,
      key: doc.id,
      value: {
        rev: doc.rev
      }
    };

    var deleted = doc.deleted;
    if (deleted) {
      if (keys) {
        results.push(row);
        row.value.deleted = true;
        row.doc = null;
      }
    } else if (skip-- <= 0) {
      results.push(row);
      if (opts.include_docs) {
        include_doc(row, doc);
      }
      if (--limit === 0) {
        return false;
      }
    }
    return true;
  }

  function onTxnComplete() {
    Promise.all(processing).then(function () {
      var returnVal = {
        total_rows: metadata.doc_count,
        offset: 0,
        rows: results
      };

      /* istanbul ignore if */
      if (opts.update_seq) {
        returnVal.update_seq = metadata.seq;
      }
      callback(null, returnVal);
    });
  }

  var cursor = descending ?
    docStore.openCursor(keyRange, descending) :
    docStore.openCursor(keyRange);

  cursor.onsuccess = function (e) {

    var doc = e.target.result && e.target.result.value;

    // Happens if opts does not have limit,
    // because cursor will end normally then,
    // when all docs are retrieved.
    // Would not be needed, if getAll() optimization was used like in #6059
    if (!doc) { return; }

    // Skip local docs
    if (doc.id.startsWith('_local/')) {
      return e.target.result.continue();
    }

    var continueCursor = allDocsInner(doc);
    if (continueCursor) {
      e.target.result.continue();
    }
  };

}

function changes (txn, idbChanges, api, dbOpts, opts) {
  if (txn.error) {
    return opts.complete(txn.error);
  }

  if (opts.continuous) {
    var id = dbOpts.name + ':' + uuid();
    idbChanges.addListener(dbOpts.name, id, api, opts);
    idbChanges.notify(dbOpts.name);
    return {
      cancel: function () {
        idbChanges.removeListener(dbOpts.name, id);
      }
    };
  }

  var limit = 'limit' in opts ? opts.limit : -1;
  if (limit === 0) {
    limit = 1;
  }

  var store = txn.txn.objectStore(DOC_STORE).index('seq');

  var filter = filterChange(opts);
  var received = 0;

  var lastSeq = opts.since || 0;
  var results = [];

  var processing = [];

  function onReqSuccess(e) {
    if (!e.target.result) { return; }
    var cursor = e.target.result;
    var doc = cursor.value;
    // Overwrite doc.data, which may have been rewritten (see rewrite.js) with
    // the clean version for that rev
    doc.data = doc.revs[doc.rev].data;
    doc.data._id = doc.id;
    doc.data._rev = doc.rev;
    if (doc.deleted) {
      doc.data._deleted = true;
    }

    if (opts.doc_ids && opts.doc_ids.indexOf(doc.id) === -1) {
      return cursor.continue();
    }

    // WARNING: expecting possible old format
    var change = opts.processChange(doc.data, doc, opts);
    change.seq = doc.seq;
    lastSeq = doc.seq;
    var filtered = filter(change);

    // If its an error
    if (typeof filtered === 'object') {
      return opts.complete(filtered);
    }

    if (filtered) {
      received++;
      if (opts.return_docs) {
        results.push(change);
      }

      if (opts.include_docs && opts.attachments && doc.data._attachments) {
        var promises = [];
        for (var name in doc.data._attachments) {
          var p = processAttachment(name, doc, change.doc, opts.binary);
          // We add the processing promise to 2 arrays, one tracks all
          // the promises needed before we fire onChange, the other
          // ensure we process all attachments before onComplete
          promises.push(p);
          processing.push(p);
        }

        Promise.all(promises).then(function () {
          opts.onChange(change);
        });
      } else {
        opts.onChange(change);
      }
    }
    if (received !== limit) {
      cursor.continue();
    }
  }

  function onTxnComplete() {
    Promise.all(processing).then(function () {
      opts.complete(null, {
        results: results,
        last_seq: lastSeq
      });
    });
  }

  var req;
  if (opts.descending) {
    req = store.openCursor(null, 'prev');
  } else {
    req = store.openCursor(IDBKeyRange.lowerBound(opts.since, true));
  }

  txn.txn.oncomplete = onTxnComplete;
  req.onsuccess = onReqSuccess;
}

// 'use strict'; is default when ESM


function getRevisionTree (txn, id, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  var req = txn.txn.objectStore(DOC_STORE).get(id);
  req.onsuccess = function (e) {
    if (!e.target.result) {
      callback(createError(MISSING_DOC));
    } else {
      callback(null, e.target.result.rev_tree);
    }
  };
}

// 'use strict'; is default when ESM


function doCompaction (txn, id, revs, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  var docStore = txn.txn.objectStore(DOC_STORE);

  docStore.get(id).onsuccess = function (e) {
    var doc = e.target.result;

    traverseRevTree(doc.rev_tree, function (isLeaf, pos, revHash, ctx, opts) {
      var rev = pos + '-' + revHash;
      if (revs.indexOf(rev) !== -1) {
        opts.status = 'missing';
      }
    });

    var attachments = [];

    revs.forEach(function (rev) {
      if (rev in doc.revs) {
        // Make a list of attachments that are used by the revisions being
        // deleted
        if (doc.revs[rev].data._attachments) {
          for (var k in doc.revs[rev].data._attachments) {
            attachments.push(doc.revs[rev].data._attachments[k].digest);
          }
        }
        delete doc.revs[rev];
      }
    });

    // Attachments have a list of revisions that are using them, when
    // that list becomes empty we can delete the attachment.
    attachments.forEach(function (digest) {
      revs.forEach(function (rev) {
        delete doc.attachments[digest].revs[rev];
      });
      if (!Object.keys(doc.attachments[digest].revs).length) {
        delete doc.attachments[digest];
      }
    });

    docStore.put(doc);
  };

  txn.txn.oncomplete = function () {
    callback();
  };
}

function destroy (dbOpts, openDatabases, idbChanges, callback) {

  idbChanges.removeAllListeners(dbOpts.name);

  function doDestroy() {
    var req = indexedDB.deleteDatabase(dbOpts.name);
    req.onsuccess = function () {
      delete openDatabases[dbOpts.name];
      callback(null, {ok: true});
    };
  }

  // If the database is open we need to close it
  if (dbOpts.name in openDatabases) {
    openDatabases[dbOpts.name].then(function (res) {
      res.idb.close();
      doDestroy();
    });
  } else {
    doDestroy();
  }

}

// 'use strict'; is default when ESM


// Adapted from
// https://github.com/pouchdb/pouchdb/blob/master/packages/node_modules/pouchdb-find/src/adapters/local/find/query-planner.js#L20-L24
// This could change / improve in the future?
var COUCH_COLLATE_LO = null;
var COUCH_COLLATE_HI = '\uffff'; // actually used as {"\uffff": {}}

// Adapted from: https://www.w3.org/TR/IndexedDB/#compare-two-keys
// Importantly, *there is no upper bound possible* in idb. The ideal data
// structure an infintely deep array:
//   var IDB_COLLATE_HI = []; IDB_COLLATE_HI.push(IDB_COLLATE_HI)
// But IDBKeyRange is not a fan of shenanigans, so I've just gone with 12 layers
// because it looks nice and surely that's enough!
var IDB_COLLATE_LO = Number.NEGATIVE_INFINITY;
var IDB_COLLATE_HI = [[[[[[[[[[[[]]]]]]]]]]]];

//
// TODO: this should be made offical somewhere and used by AllDocs / get /
// changes etc as well.
//
function externaliseRecord(idbDoc) {
  var doc = idbDoc.revs[idbDoc.rev].data;
  doc._id = idbDoc.id;
  doc._rev = idbDoc.rev;
  if (idbDoc.deleted) {
    doc._deleted = true;
  }

  return doc;
}

/**
 * Generates a keyrange based on the opts passed to query
 *
 * The first key is always 0, as that's how we're filtering out deleted entries.
 */
function generateKeyRange(opts) {
  function defined(obj, k) {
    return obj[k] !== void 0;
  }

  // Converts a valid CouchDB key into a valid IndexedDB one
  function convert(key, exact) {
    // The first item in every native index is doc.deleted, and we always want
    // to only search documents that are not deleted.
    // "foo" -> [0, "foo"]
    var filterDeleted = [0].concat(key);

    return filterDeleted.map(function (k) {
      // null, true and false are not indexable by indexeddb. When we write
      // these values we convert them to these constants, and so when we
      // query for them we need to convert the query also.
      if (k === null && exact) {
        // for non-exact queries we treat null as a collate property
        // see `if (!exact)` block below
        return IDB_NULL;
      } else if (k === true) {
        return IDB_TRUE;
      } else if (k === false) {
        return IDB_FALSE;
      }

      if (!exact) {
        // We get passed CouchDB's collate low and high values, so for non-exact
        // ranged queries we're going to convert them to our IDB equivalents
        if (k === COUCH_COLLATE_LO) {
          return IDB_COLLATE_LO;
        } else if (Object.prototype.hasOwnProperty.call(k, COUCH_COLLATE_HI)) {
          return IDB_COLLATE_HI;
        }
      }

      return k;
    });
  }

  // CouchDB and so PouchdB defaults to true. We need to make this explicit as
  // we invert these later for IndexedDB.
  if (!defined(opts, 'inclusive_end')) {
    opts.inclusive_end = true;
  }
  if (!defined(opts, 'inclusive_start')) {
    opts.inclusive_start = true;
  }

  if (opts.descending) {
    // Flip before generating. We'll check descending again later when performing
    // an index request
    var realEndkey = opts.startkey,
        realInclusiveEnd = opts.inclusive_start;

    opts.startkey = opts.endkey;
    opts.endkey = realEndkey;
    opts.inclusive_start = opts.inclusive_end;
    opts.inclusive_end = realInclusiveEnd;
  }

  try {
    if (defined(opts, 'key')) {
      return IDBKeyRange.only(convert(opts.key, true));
    }

    if (defined(opts, 'startkey') && !defined(opts, 'endkey')) {
      // lowerBound, but without the deleted docs.
      // [1] is the start of the deleted doc range, and we don't want to include then.
      return IDBKeyRange.bound(
        convert(opts.startkey), [1],
        !opts.inclusive_start, true
      );
    }

    if (!defined(opts, 'startkey') && defined(opts, 'endkey')) {
      return IDBKeyRange.upperBound(convert(opts.endkey), !opts.inclusive_end);
    }

    if (defined(opts, 'startkey') && defined(opts, 'endkey')) {
      return IDBKeyRange.bound(
        convert(opts.startkey),    convert(opts.endkey),
        !opts.inclusive_start, !opts.inclusive_end
      );
    }

    return IDBKeyRange.only([0]);
  } catch (err) {
    console.error('Could not generate keyRange', err, opts);
    throw Error('Could not generate key range with ' + JSON.stringify(opts));
  }
}

function getIndexHandle(pdb, fields, reject) {
  var indexName = naturalIndexName(fields);

  return new Promise(function (resolve) {
    pdb._openTransactionSafely([DOC_STORE], 'readonly', function (err, txn) {
      if (err) {
        return idbError(reject)(err);
      }

      txn.onabort = idbError(reject);
      txn.ontimeout = idbError(reject);

      var existingIndexNames = Array.from(txn.objectStore(DOC_STORE).indexNames);

      if (existingIndexNames.indexOf(indexName) === -1) {
        // The index is missing, force a db restart and try again
        pdb._freshen()
          .then(function () { return getIndexHandle(pdb, fields, reject); })
          .then(resolve);
      } else {
        resolve(txn.objectStore(DOC_STORE).index(indexName));
      }
    });
  });
}

// In theory we should return something like the doc example below, but find
// only needs rows: [{doc: {...}}], so I think we can just not bother for now
// {
//   "offset" : 0,
//   "rows": [{
//     "id": "doc3",
//     "key": "Lisa Says",
//     "value": null,
//     "doc": {
//       "_id": "doc3",
//       "_rev": "1-z",
//       "title": "Lisa Says"
//     }
//   }],
//   "total_rows" : 4
// }
function query(idb, signature, opts, fallback) {
  // At this stage, in the current implementation, find has already gone through
  // and determined if the index already exists from PouchDB's perspective (eg
  // there is a design doc for it).
  //
  // If we find that the index doesn't exist this means we have to close and
  // re-open the DB to correct indexes before proceeding, at which point the
  // index should exist.

  var pdb = this;

  // Assumption, there will be only one /, between the design document name
  // and the view name.
  var parts = signature.split('/');

  return new Promise(function (resolve, reject) {
    pdb.get('_design/' + parts[0]).then(function (ddoc) {
      if (isPartialFilterView(ddoc, parts[1])) {
        // Fix for #8522
        // An IndexedDB index is always over all entries. And there is no way to filter them.
        // Therefore the normal findAbstractMapper will be used
        // for indexes with partial_filter_selector.
        return fallback(signature, opts).then(resolve, reject);
      }

      var fields = rawIndexFields(ddoc, parts[1]);
      if (!fields) {
        throw new Error('ddoc ' + ddoc._id +' with view ' + parts[1] +
          ' does not have map.options.def.fields defined.');
      }

      var skip = opts.skip;
      var limit = Number.isInteger(opts.limit) && opts.limit;

      return getIndexHandle(pdb, fields, reject)
        .then(function (indexHandle) {
          var keyRange = generateKeyRange(opts);
          var req = indexHandle.openCursor(keyRange, opts.descending ? 'prev' : 'next');

          var rows = [];
          req.onerror = idbError(reject);
          req.onsuccess = function (e) {
            var cursor = e.target.result;

            if (!cursor || limit === 0) {
              return resolve({
                rows: rows
              });
            }

            if (skip) {
              cursor.advance(skip);
              skip = false;
              return;
            }

            if (limit) {
              limit = limit - 1;
            }

            rows.push({doc: externaliseRecord(cursor.value)});
            cursor.continue();
          };
        });
      })
      .catch(reject);
  });

}

function viewCleanup(idb, fallback) {
  // I'm not sure we have to do anything here.
  //
  // One option is to just close and re-open the DB, which performs the same
  // action. The only reason you'd want to call this is if you deleted a bunch
  // of indexes and wanted the space back immediately.
  //
  // Otherwise index cleanup happens when:
  //  - A DB is opened
  //  - A find query is performed against an index that doesn't exist but should

  // Fix for #8522
  // On views with partial_filter_selector the standard find-abstract-mapper is used.
  // Its indexes must be cleaned up.
  // Fallback is the standard viewCleanup.
  return fallback();
}

function purgeAttachments(doc, revs) {
  if (!doc.attachments) {
    // If there are no attachments, doc.attachments is an empty object
    return {};
  }

  // Iterate over all attachments and remove the respective revs
  for (let key in doc.attachments) {
    const attachment = doc.attachments[key];

    for (let rev of revs) {
      if (attachment.revs[rev]) {
        delete attachment.revs[rev];
      }
    }

    if (Object.keys(attachment.revs).length === 0) {
      delete doc.attachments[key];
    }
  }

  return doc.attachments;
}

// `purge()` expects a path of revisions in its revs argument that:
// - starts with a leaf rev
// - continues sequentially with the remaining revs of that leaf’s branch
//
// eg. for this rev tree:
// 1-9692 ▶ 2-37aa ▶ 3-df22 ▶ 4-6e94 ▶ 5-df4a ▶ 6-6a3a ▶ 7-57e5
//          ┃                 ┗━━━━━━▶ 5-8d8c ▶ 6-65e0
//          ┗━━━━━━▶ 3-43f6 ▶ 4-a3b4
//
// …if you wanted to purge '7-57e5', you would provide ['7-57e5', '6-6a3a', '5-df4a']
//
// The purge adapter implementation in `pouchdb-core` uses the helper function `findPathToLeaf`
// from `pouchdb-merge` to construct this array correctly. Since this purge implementation is
// only ever called from there, we do no additional checks here as to whether `revs` actually
// fulfills the criteria above, since `findPathToLeaf` already does these.
function purge(txn, docId, revs, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  const docStore = txn.txn.objectStore(DOC_STORE);
  const deletedRevs = [];
  let documentWasRemovedCompletely = false;
  docStore.get(docId).onsuccess = (e) => {
    const doc = e.target.result;

    // we could do a dry run here to check if revs is a proper path towards a leaf in the rev tree

    for (const rev of revs) {
      // purge rev from tree
      doc.rev_tree = removeLeafFromRevTree(doc.rev_tree, rev);

      // assign new revs
      delete doc.revs[rev];
      deletedRevs.push(rev);
    }

    if (doc.rev_tree.length === 0) {
      // if the rev tree is empty, we can delete the entire document
      docStore.delete(doc.id);
      documentWasRemovedCompletely = true;
      return;
    }

    // find new winning rev
    doc.rev = winningRev(doc);
    doc.data = doc.revs[doc.rev].data;
    doc.attachments = purgeAttachments(doc, revs);

    // finally, write the purged doc
    docStore.put(doc);
  };

  txn.txn.oncomplete = function () {
    callback(null, {
      ok: true,
      deletedRevs,
      documentWasRemovedCompletely
    });
  };
}

// 'use strict'; is default when ESM

var ADAPTER_NAME = 'indexeddb';

// TODO: Constructor should be capitalised
var idbChanges = new Changes();

// A shared list of database handles
var openDatabases = {};

function IdbPouch(dbOpts, callback) {

  if (dbOpts.view_adapter) {
    console.log('Please note that the indexeddb adapter manages _find indexes itself, therefore it is not using your specified view_adapter');
  }
  
  var api = this;
  var metadata = {};

  // Wrapper that gives you an active DB handle. You probably want $t.
  var $ = function (fun) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      setup(openDatabases, api, dbOpts).then(function (res) {
        metadata = res.metadata;
        args.unshift(res.idb);
        fun.apply(api, args);
      }).catch(function (err) {
        var last = args.pop();
        if (typeof last === 'function') {
          last(err);
        } else {
          console.error(err);
        }
      });
    };
  };
  // the promise version of $
  var $p = function (fun) {
    return function () {
      var args = Array.prototype.slice.call(arguments);

      return setup(openDatabases, api, dbOpts).then(function (res) {
        metadata = res.metadata;
        args.unshift(res.idb);

        return fun.apply(api, args);
      });
    };
  };
  // Wrapper that gives you a safe transaction handle. It's important to use
  // this instead of opening your own transaction from a db handle got from $,
  // because in the time between getting the db handle and opening the
  // transaction it may have been invalidated by index changes.
  var $t = function (fun, stores, mode) {
    stores = stores || [DOC_STORE];
    mode = mode || 'readonly';

    return function () {
      var args = Array.prototype.slice.call(arguments);
      var txn = {};
      setup(openDatabases, api, dbOpts).then(function (res) {
        metadata = res.metadata;
        txn.txn = res.idb.transaction(stores, mode);
      }).catch(function (err) {
        console.error('Failed to establish transaction safely');
        console.error(err);
        txn.error = err;
      }).then(function () {
        args.unshift(txn);
        fun.apply(api, args);
      });
    };
  };

  api._openTransactionSafely = function (stores, mode, callback) {
    $t(function (txn, callback) {
      callback(txn.error, txn.txn);
    }, stores, mode)(callback);
  };

  api._remote = false;
  api.type = function () { return ADAPTER_NAME; };

  api._id = $(function (_, cb) {
    cb(null, metadata.db_uuid);
  });

  api._info = $(function (_, cb) {
    return info(metadata, cb);
  });

  api._get = $t(get);

  api._bulkDocs = $(function (_, req, opts, callback) {
    bulkDocs(api, req, opts, metadata, dbOpts, idbChanges, callback);
  });

  api._allDocs = $t(function (txn, opts, cb) {
    allDocs(txn, metadata, opts, cb);
  });

  api._getAttachment = $t(getAttachment);

  api._changes = $t(function (txn, opts) {
    changes(txn, idbChanges, api, dbOpts, opts);
  });

  api._getRevisionTree = $t(getRevisionTree);
  api._doCompaction = $t(doCompaction, [DOC_STORE], 'readwrite');

  api._customFindAbstractMapper = {
    query: $p(query),
    viewCleanup: $p(viewCleanup)
  };

  api._destroy = function (opts, callback) {
    return destroy(dbOpts, openDatabases, idbChanges, callback);
  };

  api._close = $(function (db, cb) {
    delete openDatabases[dbOpts.name];
    db.close();
    cb();
  });

  // Closing and re-opening the DB re-generates native indexes
  api._freshen = function () {
    return new Promise(function (resolve) {
      api._close(function () {
        $(resolve)();
      });
    });
  };

  api._purge = $t(purge, [DOC_STORE], 'readwrite');

  // TODO: this setTimeout seems nasty, if its needed lets
  // figure out / explain why
  setTimeout(function () {
    callback(null, api);
  });
}

// TODO: this isnt really valid permanently, just being lazy to start
IdbPouch.valid = function () {
  return true;
};

function index (PouchDB) {
  PouchDB.adapter(ADAPTER_NAME, IdbPouch, true);
}

export { index as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWluZGV4ZWRkYi5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaW5kZXhlZGRiL3NyYy9yZXdyaXRlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWluZGV4ZWRkYi9zcmMvdXRpbC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pbmRleGVkZGIvc3JjL3NldHVwLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWluZGV4ZWRkYi9zcmMvaW5mby5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pbmRleGVkZGIvc3JjL2dldC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pbmRleGVkZGIvc3JjL2dldEF0dGFjaG1lbnQuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaW5kZXhlZGRiL3NyYy9idWxrRG9jcy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pbmRleGVkZGIvc3JjL2FsbERvY3MuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaW5kZXhlZGRiL3NyYy9jaGFuZ2VzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWluZGV4ZWRkYi9zcmMvZ2V0UmV2aXNpb25UcmVlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWluZGV4ZWRkYi9zcmMvZG9Db21wYWN0aW9uLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWluZGV4ZWRkYi9zcmMvZGVzdHJveS5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pbmRleGVkZGIvc3JjL2ZpbmQuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaW5kZXhlZGRiL3NyYy9wdXJnZS5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pbmRleGVkZGIvc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vICd1c2Ugc3RyaWN0JzsgaXMgZGVmYXVsdCB3aGVuIEVTTVxuXG52YXIgSURCX05VTEwgPSBOdW1iZXIuTUlOX1NBRkVfSU5URUdFUjtcbnZhciBJREJfRkFMU0UgPSBOdW1iZXIuTUlOX1NBRkVfSU5URUdFUiArIDE7XG52YXIgSURCX1RSVUUgPSBOdW1iZXIuTUlOX1NBRkVfSU5URUdFUiArIDI7XG5cbi8vIFRoZXNlIGFyZSB0aGUgc2FtZSBhcyBiZWxsb3cgYnV0IHdpdGhvdXQgdGhlIGdsb2JhbCBmbGFnXG4vLyB3ZSB3YW50IHRvIHVzZSBSZWdFeHAudGVzdCBiZWNhdXNlIGl0J3MgcmVhbGx5IGZhc3QsIGJ1dCB0aGUgZ2xvYmFsIGZsYWdcbi8vIG1ha2VzIHRoZSByZWdleCBjb25zdCBzdGF0ZWZ1bCAoc2VyaW91c2x5KSBhcyBpdCB3YWxrZWQgdGhyb3VnaCBhbGwgaW5zdGFuY2VzXG52YXIgVEVTVF9LRVlfSU5WQUxJRCA9IC9eW15hLXpBLVpfJF18W15hLXpBLVowLTlfJF0rLztcbnZhciBURVNUX1BBVEhfSU5WQUxJRCA9IC9cXFxcLnwoXnxcXC4pW15hLXpBLVpfJF18W15hLXpBLVowLTlfJC5dKy87XG5mdW5jdGlvbiBuZWVkc1Nhbml0aXNlKG5hbWUsIGlzUGF0aCkge1xuICBpZiAoaXNQYXRoKSB7XG4gICAgcmV0dXJuIFRFU1RfUEFUSF9JTlZBTElELnRlc3QobmFtZSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFRFU1RfS0VZX0lOVkFMSUQudGVzdChuYW1lKTtcbiAgfVxufVxuXG4vL1xuLy8gSW5kZXhlZERCIG9ubHkgYWxsb3dzIHZhbGlkIEpTIG5hbWVzIGluIGl0cyBpbmRleCBwYXRocywgd2hlcmVhcyBKU09OIGFsbG93c1xuLy8gZm9yIGFueSBzdHJpbmcgYXQgYWxsLiBUaGlzIGNvbnZlcnRzIGludmFsaWQgSlMgbmFtZXMgdG8gdmFsaWQgb25lcywgdG8gYWxsb3dcbi8vIGZvciB0aGVtIHRvIGJlIGluZGV4ZWQuXG4vL1xuLy8gRm9yIGV4YW1wbGUsIFwiZm9vLWJhclwiIGlzIGEgdmFsaWQgSlNPTiBrZXksIGJ1dCBjYW5ub3QgYmUgYSB2YWxpZCBKUyBuYW1lXG4vLyAoYmVjYXVzZSB0aGF0IHdvdWxkIGJlIHJlYWQgYXMgZm9vIG1pbnVzIGJhcikuXG4vL1xuLy8gVmVyeSBoaWdoIGxldmVsIHJ1bGVzIGZvciB2YWxpZCBKUyBuYW1lcyBhcmU6XG4vLyAgLSBGaXJzdCBjaGFyYWN0ZXIgY2Fubm90IHN0YXJ0IHdpdGggYSBudW1iZXJcbi8vICAtIE90aGVyd2lzZSBhbGwgY2hhcmFjdGVycyBtdXN0IGJlIGJlIGEteiwgQS1aLCAwLTksICQgb3IgXy5cbi8vICAtIFdlIGFsbG93IC4gdW5sZXNzIHRoZSBuYW1lIHJlcHJlc2VudHMgYSBzaW5nbGUgZmllbGQsIGFzIHRoYXQgcmVwcmVzZW50c1xuLy8gICAgYSBkZWVwIGluZGV4IHBhdGguXG4vL1xuLy8gVGhpcyBpcyBtb3JlIGFnZ3Jlc3NpdmUgdGhhbiBpdCBuZWVkcyB0byBiZSwgYnV0IGFsc28gc2ltcGxlci5cbi8vXG52YXIgS0VZX0lOVkFMSUQgPSBuZXcgUmVnRXhwKFRFU1RfS0VZX0lOVkFMSUQuc291cmNlLCAnZycpO1xudmFyIFBBVEhfSU5WQUxJRCA9IG5ldyBSZWdFeHAoVEVTVF9QQVRIX0lOVkFMSUQuc291cmNlLCAnZycpO1xudmFyIFNMQVNIID0gJ1xcXFwnLmNoYXJDb2RlQXQoMCk7XG5jb25zdCBJU19ET1QgPSAnLicuY2hhckNvZGVBdCgwKTtcblxuZnVuY3Rpb24gc2FuaXRpc2UobmFtZSwgaXNQYXRoKSB7XG4gIHZhciBjb3JyZWN0Q2hhcmFjdGVycyA9IGZ1bmN0aW9uIChtYXRjaCkge1xuICAgIHZhciBnb29kID0gJyc7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYXRjaC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGNvZGUgPSBtYXRjaC5jaGFyQ29kZUF0KGkpO1xuICAgICAgLy8gSWYgeW91J3JlIHNhbml0aXNpbmcgYSBwYXRoLCBhIHNsYXNoIGNoYXJhY3RlciBpcyB0aGVyZSB0byBiZSBpbnRlcnByZXRlZFxuICAgICAgLy8gYnkgd2hhdGV2ZXIgcGFyc2VzIHRoZSBwYXRoIGxhdGVyIGFzIFwiZXNjYXBlIHRoZSBuZXh0IHRoaW5nXCIuXG4gICAgICAvL1xuICAgICAgLy8gZS5nLiwgaWYgeW91IHdhbnQgdG8gaW5kZXggVEhJUyBzdHJpbmc6XG4gICAgICAvLyAgIHtcImZvb1wiOiB7XCJiYXIuYmF6XCI6IFwiVEhJU1wifX1cbiAgICAgIC8vIFlvdXIgaW5kZXggcGF0aCB3b3VsZCBiZSBcImZvby5iYXJcXC5iYXpcIi5cblxuICAgICAgaWYgKGNvZGUgPT09IElTX0RPVCAmJiBpc1BhdGggJiYgaSA9PT0gMCkge1xuICAgICAgICBnb29kICs9ICcuJztcbiAgICAgIH0gZWxzZSBpZiAoY29kZSA9PT0gU0xBU0ggJiYgaXNQYXRoKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZ29vZCArPSAnX2MnICsgY29kZSArICdfJztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdvb2Q7XG4gIH07XG5cbiAgaWYgKGlzUGF0aCkge1xuICAgIHJldHVybiBuYW1lLnJlcGxhY2UoUEFUSF9JTlZBTElELCBjb3JyZWN0Q2hhcmFjdGVycyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5hbWUucmVwbGFjZShLRVlfSU5WQUxJRCwgY29ycmVjdENoYXJhY3RlcnMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5lZWRzUmV3cml0ZShkYXRhKSB7XG4gIGZvciAodmFyIGtleSBvZiBPYmplY3Qua2V5cyhkYXRhKSkge1xuICAgIGlmIChuZWVkc1Nhbml0aXNlKGtleSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZiAoZGF0YVtrZXldID09PSBudWxsIHx8IHR5cGVvZiBkYXRhW2tleV0gPT09ICdib29sZWFuJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YVtrZXldID09PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIG5lZWRzUmV3cml0ZShkYXRhW2tleV0pO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZXdyaXRlKGRhdGEpIHtcbiAgaWYgKCFuZWVkc1Jld3JpdGUoZGF0YSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkoZGF0YSk7XG4gIHZhciBjbG9uZSA9IGlzQXJyYXlcbiAgICA/IFtdXG4gICAgOiB7fTtcblxuICBPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICB2YXIgc2FmZUtleSA9IGlzQXJyYXkgPyBrZXkgOiBzYW5pdGlzZShrZXkpO1xuXG4gICAgaWYgKGRhdGFba2V5XSA9PT0gbnVsbCkge1xuICAgICAgY2xvbmVbc2FmZUtleV0gPSBJREJfTlVMTDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhW2tleV0gPT09ICdib29sZWFuJykge1xuICAgICAgY2xvbmVbc2FmZUtleV0gPSBkYXRhW2tleV0gPyBJREJfVFJVRSA6IElEQl9GQUxTRTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICBjbG9uZVtzYWZlS2V5XSA9IHJld3JpdGUoZGF0YVtrZXldKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2xvbmVbc2FmZUtleV0gPSBkYXRhW2tleV07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY2xvbmU7XG59XG5cbmV4cG9ydCB7XG4gIElEQl9OVUxMLFxuICBJREJfVFJVRSxcbiAgSURCX0ZBTFNFLFxuICByZXdyaXRlLFxuICBzYW5pdGlzZVxufTtcbiIsIi8vICd1c2Ugc3RyaWN0JzsgaXMgZGVmYXVsdCB3aGVuIEVTTVxuXG5pbXBvcnQgeyBjcmVhdGVFcnJvciwgSURCX0VSUk9SIH0gZnJvbSAncG91Y2hkYi1lcnJvcnMnO1xuaW1wb3J0IHsgYnRvYSwgcmVhZEFzQmluYXJ5U3RyaW5nIH0gZnJvbSAncG91Y2hkYi1iaW5hcnktdXRpbHMnO1xuaW1wb3J0IHsgc2FuaXRpc2UgfSBmcm9tICcuL3Jld3JpdGUnO1xuXG52YXIgRE9DX1NUT1JFID0gJ2RvY3MnO1xudmFyIE1FVEFfU1RPUkUgPSAnbWV0YSc7XG5cbmZ1bmN0aW9uIGlkYkVycm9yKGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgdmFyIG1lc3NhZ2UgPSAndW5rbm93bl9lcnJvcic7XG4gICAgaWYgKGV2dC50YXJnZXQgJiYgZXZ0LnRhcmdldC5lcnJvcikge1xuICAgICAgbWVzc2FnZSA9IGV2dC50YXJnZXQuZXJyb3IubmFtZSB8fCBldnQudGFyZ2V0LmVycm9yLm1lc3NhZ2U7XG4gICAgfVxuICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKElEQl9FUlJPUiwgbWVzc2FnZSwgZXZ0LnR5cGUpKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0F0dGFjaG1lbnQobmFtZSwgc3JjLCBkb2MsIGlzQmluYXJ5KSB7XG5cbiAgZGVsZXRlIGRvYy5fYXR0YWNobWVudHNbbmFtZV0uc3R1YjtcblxuICBpZiAoaXNCaW5hcnkpIHtcbiAgICBkb2MuX2F0dGFjaG1lbnRzW25hbWVdLmRhdGEgPVxuICAgICAgc3JjLmF0dGFjaG1lbnRzW2RvYy5fYXR0YWNobWVudHNbbmFtZV0uZGlnZXN0XS5kYXRhO1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgIHZhciBkYXRhID0gc3JjLmF0dGFjaG1lbnRzW2RvYy5fYXR0YWNobWVudHNbbmFtZV0uZGlnZXN0XS5kYXRhO1xuICAgIHJlYWRBc0JpbmFyeVN0cmluZyhkYXRhLCBmdW5jdGlvbiAoYmluU3RyaW5nKSB7XG4gICAgICBkb2MuX2F0dGFjaG1lbnRzW25hbWVdLmRhdGEgPSBidG9hKGJpblN0cmluZyk7XG4gICAgICBkZWxldGUgZG9jLl9hdHRhY2htZW50c1tuYW1lXS5sZW5ndGg7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByYXdJbmRleEZpZWxkcyhkZG9jLCB2aWV3TmFtZSkge1xuICAvLyBmaWVsZHMgYXJlIGFuIGFycmF5IG9mIGVpdGhlciB0aGUgc3RyaW5nIG5hbWUgb2YgdGhlIGZpZWxkLCBvciBhIGtleSB2YWx1ZVxuICB2YXIgZmllbGRzID0gZGRvYy52aWV3c1t2aWV3TmFtZV0ub3B0aW9ucyAmJlxuICAgICAgICAgICAgICAgZGRvYy52aWV3c1t2aWV3TmFtZV0ub3B0aW9ucy5kZWYgJiZcbiAgICAgICAgICAgICAgIGRkb2Mudmlld3Nbdmlld05hbWVdLm9wdGlvbnMuZGVmLmZpZWxkcyB8fCBbXTtcblxuICAvLyBFaXRoZXIgWydmb28nXSBvciBbeydmb28nOiAnZGVzYyd9XVxuICByZXR1cm4gZmllbGRzLm1hcChmdW5jdGlvbiAoZmllbGQpIHtcbiAgICBpZiAodHlwZW9mIGZpZWxkID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGZpZWxkO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMoZmllbGQpWzBdO1xuICAgIH1cbiAgfSk7XG59XG5cbi8qKlxuICogdHJ1ZSBpZiB0aGUgdmlldyBpcyBoYXMgYSBcInBhcnRpYWxfZmlsdGVyX3NlbGVjdG9yXCIuXG4gKi9cbmZ1bmN0aW9uIGlzUGFydGlhbEZpbHRlclZpZXcoZGRvYywgdmlld05hbWUpIHtcbiAgcmV0dXJuIHZpZXdOYW1lIGluIGRkb2Mudmlld3MgJiZcbiAgICBkZG9jLnZpZXdzW3ZpZXdOYW1lXS5vcHRpb25zICYmXG4gICAgZGRvYy52aWV3c1t2aWV3TmFtZV0ub3B0aW9ucy5kZWYgJiZcbiAgICBkZG9jLnZpZXdzW3ZpZXdOYW1lXS5vcHRpb25zLmRlZi5wYXJ0aWFsX2ZpbHRlcl9zZWxlY3Rvcjtcbn1cblxuZnVuY3Rpb24gbmF0dXJhbEluZGV4TmFtZShmaWVsZHMpIHtcbiAgcmV0dXJuICdfZmluZF9pZHgvJyArIGZpZWxkcy5qb2luKCcvJyk7XG59XG5cbi8qKlxuICogQ29udmVydCB0aGUgZmllbGRzIHRoZSB1c2VyIGdhdmUgdXMgaW4gdGhlIHZpZXcgYW5kIGNvbnZlcnQgdGhlbSB0byB3b3JrIGZvclxuICogaW5kZXhlZGRiLlxuICpcbiAqIGZpZWxkcyBpcyBhbiBhcnJheSBvZiBmaWVsZCBzdHJpbmdzLiBBIGZpZWxkIHN0cmluZyBjb3VsZCBiZSBvbmUgZmllbGQ6XG4gKiAgICdmb28nXG4gKiBPciBpdCBjb3VsZCBiZSBhIGpzb24gcGF0aDpcbiAqICAgJ2Zvby5iYXInXG4gKi9cbmZ1bmN0aW9uIGNvcnJlY3RJbmRleEZpZWxkcyhmaWVsZHMpIHtcbiAgLy8gRXZlcnkgaW5kZXggaGFzIHRvIGhhdmUgZGVsZXRlZCBhdCB0aGUgZnJvbnQsIGJlY2F1c2Ugd2hlbiB3ZSBkbyBhIHF1ZXJ5XG4gIC8vIHdlIG5lZWQgdG8gZmlsdGVyIG91dCBkZWxldGVkIGRvY3VtZW50cy5cbiAgcmV0dXJuIFsnZGVsZXRlZCddLmNvbmNhdChcbiAgICBmaWVsZHMubWFwKGZ1bmN0aW9uIChmaWVsZCkge1xuICAgICAgaWYgKFsnX2lkJywgJ19yZXYnLCAnX2RlbGV0ZWQnLCAnX2F0dGFjaG1lbnRzJ10uaW5jbHVkZXMoZmllbGQpKSB7XG4gICAgICAgIC8vIFRoZXNlIHByb3BlcnRpZXMgYXJlIHN0b3JlZCBhdCB0aGUgdG9wIGxldmVsIHdpdGhvdXQgdGhlIHVuZGVyc2NvcmVcbiAgICAgICAgcmV0dXJuIGZpZWxkLnN1YnN0cigxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZSBjdXN0b20gZG9jdW1lbnQgZmllbGRzIGFyZSBpbnNpZGUgdGhlIGBkYXRhYCBwcm9wZXJ0eVxuICAgICAgICByZXR1cm4gJ2RhdGEuJyArIHNhbml0aXNlKGZpZWxkLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9KVxuICApO1xufVxuXG5leHBvcnQge1xuICBET0NfU1RPUkUsXG4gIE1FVEFfU1RPUkUsXG4gIGlkYkVycm9yLFxuICBwcm9jZXNzQXR0YWNobWVudCxcbiAgcmF3SW5kZXhGaWVsZHMsXG4gIGlzUGFydGlhbEZpbHRlclZpZXcsXG4gIG5hdHVyYWxJbmRleE5hbWUsXG4gIGNvcnJlY3RJbmRleEZpZWxkc1xufTtcbiIsIi8vICd1c2Ugc3RyaWN0JzsgaXMgZGVmYXVsdCB3aGVuIEVTTVxuXG5pbXBvcnQgeyB1dWlkIH0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5cbmltcG9ydCB7IE1FVEFfU1RPUkUsIERPQ19TVE9SRSwgcmF3SW5kZXhGaWVsZHMsIG5hdHVyYWxJbmRleE5hbWUsIGNvcnJlY3RJbmRleEZpZWxkcyB9IGZyb20gJy4vdXRpbC5qcyc7XG5cbi8vXG4vLyBDb3JlIFBvdWNoREIgc2NoZW1hIHZlcnNpb24uIEluY3JlbWVudCB0aGlzIGlmIHdlLCBhcyBhIGxpYnJhcnksIHdhbnQgdG8gbWFrZVxuLy8gc2NoZW1hIGNoYW5nZXMgaW4gaW5kZXhlZGRiLiBTZWUgdXBncmFkZVBvdWNoRGJTY2hlbWEoKVxuLy9cbnZhciBQT1VDSERCX0lEQl9WRVJTSU9OID0gMTtcblxuLy9cbi8vIEZ1bmN0aW9ucyB0aGF0IG1hbmFnZSBhIGNvbWJpbmF0ZSBpbmRleGVkZGIgdmVyc2lvbiwgYnkgY29tYmluaW5nIHRoZSBjdXJyZW50XG4vLyB0aW1lIGluIG1pbGxpcyB0aGF0IHJlcHJlc2VudHMgdXNlciBtaWdyYXRpb25zIHdpdGggYSBsYXJnZSBtdWx0aXBsaWVyIHRoYXRcbi8vIHJlcHJlc2VudHMgUG91Y2hEQiBzeXN0ZW0gbWlncmF0aW9ucy5cbi8vXG4vLyBUaGlzIGxldHMgdXMgdXNlIHRoZSBpZGIgdmVyc2lvbiBudW1iZXIgdG8gYm90aCByZXByZXNlbnRcbi8vIFBvdWNoREItbGlicmFyeS1sZXZlbCBtaWdyYXRpb25zIGFzIHdlbGwgYXMgXCJ1c2VyIG1pZ3JhdGlvbnNcIiByZXF1aXJlZCBmb3Jcbi8vIHdoZW4gZGVzaWduIGRvY3VtZW50cyB0cmlnZ2VyIHRoZSBhZGRpdGlvbiBvciByZW1vdmFsIG9mIG5hdGl2ZSBpbmRleGVzLlxuLy9cbi8vIEdpdmVuIHRoYXQgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxXG4vL1xuLy8gV2UgY2FuIGVhc2lseSB1c2UgdGhlIGxhcmdlc3QgMi0zIGRpZ2l0cyBhbmQgZWl0aGVyIGFsbG93OlxuLy8gIC0gOTAwIHN5c3RlbSBtaWdyYXRpb25zIHVwIHRvIDIxOTgvMDIvMThcbi8vICAtIG9yIDg5IHN5c3RlbSBtaWdyYXRpb25zIHVwIHRvIDUwNTAvMDIvMTRcbi8vXG4vLyBUaGlzIGltcGwgZG9lcyB0aGUgZm9ybWVyLiBJZiB0aGlzIGNvZGUgc3RpbGwgZXhpc3RzIGFmdGVyIDIxOTggc29tZW9uZSBzZW5kIG15XG4vLyBkZXNjZW5kYW50cyBhIFNwYWNlYm9vayBtZXNzYWdlIGNvbmdyYXR1bGF0aW5nIHRoZW0gb24gdGhlaXIgaW1wcmVzc2l2ZSBnZW5lcy5cbi8vXG4vLyA5MDA3MTk5MjU0NzQwOTkxIDwtIE1BWF9TQUZFX0lOVEVHRVJcbi8vICAgMTAwMDAwMDAwMDAwMDAgPC0gMTBeMTNcbi8vICAgIDcxOTkyNTQ3NDA5OTEgPC0gMjE5OC0wMi0xOFQxNjo1OTowMC45OTFaXG4vL1xudmFyIHZlcnNpb25NdWx0aXBsaWVyID0gTWF0aC5wb3coMTAsIDEzKTtcbmZ1bmN0aW9uIGNyZWF0ZUlkYlZlcnNpb24oKSB7XG4gIHJldHVybiAodmVyc2lvbk11bHRpcGxpZXIgKiBQT1VDSERCX0lEQl9WRVJTSU9OKSArIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xufVxuZnVuY3Rpb24gZ2V0UG91Y2hEYlZlcnNpb24odmVyc2lvbikge1xuICByZXR1cm4gTWF0aC5mbG9vcih2ZXJzaW9uIC8gdmVyc2lvbk11bHRpcGxpZXIpO1xufVxuXG5mdW5jdGlvbiBtYWludGFpbk5hdGl2ZUluZGV4ZXMob3BlblJlcSwgcmVqZWN0KSB7XG4gIHZhciBkb2NTdG9yZSA9IG9wZW5SZXEudHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKTtcbiAgdmFyIGRkb2NzUmVxID0gZG9jU3RvcmUuZ2V0QWxsKElEQktleVJhbmdlLmJvdW5kKCdfZGVzaWduLycsICdfZGVzaWduL1xcdWZmZmYnKSk7XG5cbiAgZGRvY3NSZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgcmVzdWx0cyA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICB2YXIgZXhpc3RpbmdJbmRleE5hbWVzID0gQXJyYXkuZnJvbShkb2NTdG9yZS5pbmRleE5hbWVzKTtcblxuICAgIC8vIE5COiB0aGUgb25seSB0aGluZyB3ZSdyZSBzdXBwb3J0aW5nIGhlcmUgaXMgdGhlIGRlY2xhcmVkIGluZGV4aW5nXG4gICAgLy8gZmllbGRzIG5vdGhpbmcgbW9yZS5cbiAgICB2YXIgZXhwZWN0ZWRJbmRleGVzID0gcmVzdWx0cy5maWx0ZXIoZnVuY3Rpb24gKHJvdykge1xuICAgICAgcmV0dXJuIHJvdy5kZWxldGVkID09PSAwICYmIHJvdy5yZXZzW3Jvdy5yZXZdLmRhdGEudmlld3M7XG4gICAgfSkubWFwKGZ1bmN0aW9uIChyb3cpIHtcbiAgICAgIHJldHVybiByb3cucmV2c1tyb3cucmV2XS5kYXRhO1xuICAgIH0pLnJlZHVjZShmdW5jdGlvbiAoaW5kZXhlcywgZGRvYykge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKGRkb2Mudmlld3MpLnJlZHVjZShmdW5jdGlvbiAoYWNjLCB2aWV3TmFtZSkge1xuICAgICAgICB2YXIgZmllbGRzID0gcmF3SW5kZXhGaWVsZHMoZGRvYywgdmlld05hbWUpO1xuXG4gICAgICAgIGlmIChmaWVsZHMgJiYgZmllbGRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBhY2NbbmF0dXJhbEluZGV4TmFtZShmaWVsZHMpXSA9IGNvcnJlY3RJbmRleEZpZWxkcyhmaWVsZHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgIH0sIGluZGV4ZXMpO1xuICAgIH0sIHt9KTtcblxuICAgIHZhciBleHBlY3RlZEluZGV4TmFtZXMgPSBPYmplY3Qua2V5cyhleHBlY3RlZEluZGV4ZXMpO1xuXG4gICAgLy8gRGVsZXRlIGFueSBpbmRleGVzIHRoYXQgYXJlbid0IHN5c3RlbSBpbmRleGVzIG9yIGV4cGVjdGVkXG4gICAgdmFyIHN5c3RlbUluZGV4TmFtZXMgPSBbJ3NlcSddO1xuICAgIGV4aXN0aW5nSW5kZXhOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgaWYgKHN5c3RlbUluZGV4TmFtZXMuaW5kZXhPZihpbmRleCkgPT09IC0xICAmJiBleHBlY3RlZEluZGV4TmFtZXMuaW5kZXhPZihpbmRleCkgPT09IC0xKSB7XG4gICAgICAgIGRvY1N0b3JlLmRlbGV0ZUluZGV4KGluZGV4KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFdvcmsgb3V0IHdoaWNoIGluZGV4ZXMgYXJlIG1pc3NpbmcgYW5kIGNyZWF0ZSB0aGVtXG4gICAgdmFyIG5ld0luZGV4TmFtZXMgPSBleHBlY3RlZEluZGV4TmFtZXMuZmlsdGVyKGZ1bmN0aW9uIChlaSkge1xuICAgICAgcmV0dXJuIGV4aXN0aW5nSW5kZXhOYW1lcy5pbmRleE9mKGVpKSA9PT0gLTE7XG4gICAgfSk7XG5cbiAgICB0cnkge1xuICAgICAgbmV3SW5kZXhOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChpbmRleE5hbWUpIHtcbiAgICAgICAgZG9jU3RvcmUuY3JlYXRlSW5kZXgoaW5kZXhOYW1lLCBleHBlY3RlZEluZGV4ZXNbaW5kZXhOYW1lXSk7XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJlamVjdChlcnIpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gdXBncmFkZVBvdWNoRGJTY2hlbWEoZGIsIHBvdWNoZGJWZXJzaW9uKSB7XG4gIGlmIChwb3VjaGRiVmVyc2lvbiA8IDEpIHtcbiAgICB2YXIgZG9jU3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShET0NfU1RPUkUsIHtrZXlQYXRoIDogJ2lkJ30pO1xuICAgIGRvY1N0b3JlLmNyZWF0ZUluZGV4KCdzZXEnLCAnc2VxJywge3VuaXF1ZTogdHJ1ZX0pO1xuXG4gICAgZGIuY3JlYXRlT2JqZWN0U3RvcmUoTUVUQV9TVE9SRSwge2tleVBhdGg6ICdpZCd9KTtcbiAgfVxuXG4gIC8vIERlY2xhcmUgbW9yZSBQb3VjaERCIHNjaGVtYSBjaGFuZ2VzIGhlcmVcbiAgLy8gaWYgKHBvdWNoZGJWZXJzaW9uIDwgMikgeyAuLiB9XG59XG5cbmZ1bmN0aW9uIG9wZW5EYXRhYmFzZShvcGVuRGF0YWJhc2VzLCBhcGksIG9wdHMsIHJlc29sdmUsIHJlamVjdCkge1xuICB2YXIgb3BlblJlcSA9IG9wdHMudmVyc2lvbmNoYW5nZWQgP1xuICAgIGluZGV4ZWREQi5vcGVuKG9wdHMubmFtZSkgOlxuICAgIGluZGV4ZWREQi5vcGVuKG9wdHMubmFtZSwgY3JlYXRlSWRiVmVyc2lvbigpKTtcblxuICBvcGVuUmVxLm9udXBncmFkZW5lZWRlZCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgaWYgKGUub2xkVmVyc2lvbiA+IDAgJiYgZS5vbGRWZXJzaW9uIDwgdmVyc2lvbk11bHRpcGxpZXIpIHtcbiAgICAgIC8vIFRoaXMgREIgd2FzIGNyZWF0ZWQgd2l0aCB0aGUgXCJpZGJcIiBhZGFwdGVyLCAqKm5vdCoqIHRoaXMgb25lLlxuICAgICAgLy8gRm9yIG5vdyB3ZSdyZSBnb2luZyB0byBqdXN0IGVycm9yIG91dCBoZXJlOiB1c2VycyBtdXN0IG1hbnVhbGx5XG4gICAgICAvLyBtaWdyYXRlIGJldHdlZW4gdGhlIHR3by4gSW4gdGhlIGZ1dHVyZSwgZGVwZW5kZW50IG9uIHBlcmZvcm1hbmNlIHRlc3RzLFxuICAgICAgLy8gd2UgbWlnaHQgc2lsZW50bHkgbWlncmF0ZVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbmNvcnJlY3QgYWRhcHRlcjogeW91IHNob3VsZCBzcGVjaWZ5IHRoZSBcImlkYlwiIGFkYXB0ZXIgdG8gb3BlbiB0aGlzIERCJyk7XG4gICAgfSBlbHNlIGlmIChlLm9sZFZlcnNpb24gPT09IDAgJiYgZS5uZXdWZXJzaW9uIDwgdmVyc2lvbk11bHRpcGxpZXIpIHtcbiAgICAgIC8vIEZpcmVmb3ggc3RpbGwgY3JlYXRlcyB0aGUgZGF0YWJhc2Ugd2l0aCB2ZXJzaW9uPTEgZXZlbiBpZiB3ZSB0aHJvdyxcbiAgICAgIC8vIHNvIHdlIG5lZWQgdG8gYmUgc3VyZSB0byBkZXN0cm95IHRoZSBlbXB0eSBkYXRhYmFzZSBiZWZvcmUgdGhyb3dpbmdcbiAgICAgIGluZGV4ZWREQi5kZWxldGVEYXRhYmFzZShvcHRzLm5hbWUpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEYXRhYmFzZSB3YXMgZGVsZXRlZCB3aGlsZSBvcGVuJyk7XG4gICAgfVxuXG4gICAgdmFyIGRiID0gZS50YXJnZXQucmVzdWx0O1xuXG4gICAgdmFyIHBvdWNoZGJWZXJzaW9uID0gZ2V0UG91Y2hEYlZlcnNpb24oZS5vbGRWZXJzaW9uKTtcbiAgICB1cGdyYWRlUG91Y2hEYlNjaGVtYShkYiwgcG91Y2hkYlZlcnNpb24pO1xuICAgIG1haW50YWluTmF0aXZlSW5kZXhlcyhvcGVuUmVxLCByZWplY3QpO1xuICB9O1xuXG4gIG9wZW5SZXEub25ibG9ja2VkID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIC8vIEFGQUlDVCB0aGlzIG9ubHkgb2NjdXJzIGlmLCBhZnRlciBzZW5kaW5nIGBvbnZlcnNpb25jaGFuZ2VgIGV2ZW50cyB0b1xuICAgICAgLy8gYWxsIG90aGVyIG9wZW4gREJzIChpZSBpbiBkaWZmZXJlbnQgdGFicyksIHRoZXJlIGFyZSBzdGlsbCBvcGVuXG4gICAgICAvLyBjb25uZWN0aW9ucyB0byB0aGUgREIuIEluIHRoaXMgY29kZSB3ZSBzaG91bGQgbmV2ZXIgc2VlIHRoaXMgYmVjYXVzZSB3ZVxuICAgICAgLy8gY2xvc2Ugb3VyIERCcyBvbiB0aGVzZSBldmVudHMsIGFuZCBhbGwgREIgaW50ZXJhY3Rpb25zIGFyZSB3cmFwcGVkIGluXG4gICAgICAvLyBzYWZlbHkgcmUtb3BlbmluZyB0aGUgREIuXG4gICAgICBjb25zb2xlLmVycm9yKCdvbmJsb2NrZWQsIHRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbicsIGUpO1xuICB9O1xuXG4gIG9wZW5SZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgaWRiID0gZS50YXJnZXQucmVzdWx0O1xuXG4gICAgaWRiLm9uYWJvcnQgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignRGF0YWJhc2UgaGFzIGEgZ2xvYmFsIGZhaWx1cmUnLCBlLnRhcmdldC5lcnJvcik7XG4gICAgICBkZWxldGUgb3BlbkRhdGFiYXNlc1tvcHRzLm5hbWVdO1xuICAgICAgaWRiLmNsb3NlKCk7XG4gICAgfTtcblxuICAgIGlkYi5vbnZlcnNpb25jaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBjb25zb2xlLmxvZygnRGF0YWJhc2Ugd2FzIG1hZGUgc3RhbGUsIGNsb3NpbmcgaGFuZGxlJyk7XG4gICAgICBvcGVuRGF0YWJhc2VzW29wdHMubmFtZV0udmVyc2lvbmNoYW5nZWQgPSB0cnVlO1xuICAgICAgaWRiLmNsb3NlKCk7XG4gICAgfTtcblxuICAgIGlkYi5vbmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICAgICAgY29uc29sZS5sb2coJ0RhdGFiYXNlIHdhcyBtYWRlIHN0YWxlLCBjbG9zaW5nIGhhbmRsZScpO1xuICAgICAgaWYgKG9wdHMubmFtZSBpbiBvcGVuRGF0YWJhc2VzKSB7XG4gICAgICAgIG9wZW5EYXRhYmFzZXNbb3B0cy5uYW1lXS52ZXJzaW9uY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHZhciBtZXRhZGF0YSA9IHtpZDogTUVUQV9TVE9SRX07XG4gICAgdmFyIHR4biA9IGlkYi50cmFuc2FjdGlvbihbTUVUQV9TVE9SRV0sICdyZWFkd3JpdGUnKTtcblxuICAgIHR4bi5vbmNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmVzb2x2ZSh7aWRiOiBpZGIsIG1ldGFkYXRhOiBtZXRhZGF0YX0pO1xuICAgIH07XG5cbiAgICB2YXIgbWV0YVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKE1FVEFfU1RPUkUpO1xuICAgIG1ldGFTdG9yZS5nZXQoTUVUQV9TVE9SRSkub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIG1ldGFkYXRhID0gZS50YXJnZXQucmVzdWx0IHx8IG1ldGFkYXRhO1xuICAgICAgdmFyIGNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgaWYgKCEoJ2RvY19jb3VudCcgaW4gbWV0YWRhdGEpKSB7XG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICBtZXRhZGF0YS5kb2NfY291bnQgPSAwO1xuICAgICAgfVxuXG4gICAgICBpZiAoISgnc2VxJyBpbiBtZXRhZGF0YSkpIHtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIG1ldGFkYXRhLnNlcSA9IDA7XG4gICAgICB9XG5cbiAgICAgIGlmICghKCdkYl91dWlkJyBpbiBtZXRhZGF0YSkpIHtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIG1ldGFkYXRhLmRiX3V1aWQgPSB1dWlkKCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgIG1ldGFTdG9yZS5wdXQobWV0YWRhdGEpO1xuICAgICAgfVxuICAgIH07XG4gIH07XG5cbiAgb3BlblJlcS5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcbiAgICByZWplY3QoZS50YXJnZXQuZXJyb3IpO1xuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAob3BlbkRhdGFiYXNlcywgYXBpLCBvcHRzKSB7XG4gIGlmICghb3BlbkRhdGFiYXNlc1tvcHRzLm5hbWVdIHx8IG9wZW5EYXRhYmFzZXNbb3B0cy5uYW1lXS52ZXJzaW9uY2hhbmdlZCkge1xuICAgIG9wdHMudmVyc2lvbmNoYW5nZWQgPSBvcGVuRGF0YWJhc2VzW29wdHMubmFtZV0gJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb3BlbkRhdGFiYXNlc1tvcHRzLm5hbWVdLnZlcnNpb25jaGFuZ2VkO1xuXG4gICAgb3BlbkRhdGFiYXNlc1tvcHRzLm5hbWVdID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgb3BlbkRhdGFiYXNlKG9wZW5EYXRhYmFzZXMsIGFwaSwgb3B0cywgcmVzb2x2ZSwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBvcGVuRGF0YWJhc2VzW29wdHMubmFtZV07XG59XG4iLCIvLyAndXNlIHN0cmljdCc7IGlzIGRlZmF1bHQgd2hlbiBFU01cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKG1ldGFkYXRhLCBjYWxsYmFjaykge1xuICBjYWxsYmFjayhudWxsLCB7XG4gICAgZG9jX2NvdW50OiBtZXRhZGF0YS5kb2NfY291bnQsXG4gICAgdXBkYXRlX3NlcTogbWV0YWRhdGEuc2VxXG4gIH0pO1xufVxuIiwiLy8gJ3VzZSBzdHJpY3QnOyBpcyBkZWZhdWx0IHdoZW4gRVNNXG5cbmltcG9ydCB7IGNyZWF0ZUVycm9yLCBNSVNTSU5HX0RPQyB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcblxuaW1wb3J0IHsgRE9DX1NUT1JFIH0gZnJvbSAnLi91dGlsLmpzJztcblxuaW1wb3J0IHsgbGF0ZXN0IGFzIGdldExhdGVzdCB9IGZyb20gJ3BvdWNoZGItbWVyZ2UnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAodHhuLCBpZCwgb3B0cywgY2FsbGJhY2spIHtcbiAgaWYgKHR4bi5lcnJvcikge1xuICAgIHJldHVybiBjYWxsYmFjayh0eG4uZXJyb3IpO1xuICB9XG5cbiAgdHhuLnR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpLmdldChpZCkub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgZG9jID0gZS50YXJnZXQucmVzdWx0O1xuICAgIHZhciByZXY7XG4gICAgaWYgKCFvcHRzLnJldikge1xuICAgICAgcmV2ID0gKGRvYyAmJiBkb2MucmV2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV2ID0gb3B0cy5sYXRlc3QgPyBnZXRMYXRlc3Qob3B0cy5yZXYsIGRvYykgOiBvcHRzLnJldjtcbiAgICB9XG5cbiAgICBpZiAoIWRvYyB8fCAoZG9jLmRlbGV0ZWQgJiYgIW9wdHMucmV2KSB8fCAhKHJldiBpbiBkb2MucmV2cykpIHtcbiAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKE1JU1NJTkdfRE9DLCAnbWlzc2luZycpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcmVzdWx0ID0gZG9jLnJldnNbcmV2XS5kYXRhO1xuICAgIHJlc3VsdC5faWQgPSBkb2MuaWQ7XG4gICAgcmVzdWx0Ll9yZXYgPSByZXY7XG5cbiAgICAvLyBXQVJOSU5HOiBleHBlY3RpbmcgcG9zc2libGUgb2xkIGZvcm1hdFxuICAgIC8vIFRPRE86IHdoeSBhcmUgd2UgcGFzc2luZyB0aGUgdHJhbnNhY3Rpb24gaW4gdGhlIGNvbnRleHQ/XG4gICAgLy8gICAgICAgSXQncyBub3QgY2xlYXIgd2UgZXZlciB0aHJlYWQgdGhlc2UgdHhucyB1c2VmdWxseVxuICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgIGRvYzogcmVzdWx0LFxuICAgICAgbWV0YWRhdGE6IGRvYyxcbiAgICAgIGN0eDogdHhuXG4gICAgfSk7XG4gIH07XG59XG4iLCIvLyAndXNlIHN0cmljdCc7IGlzIGRlZmF1bHQgd2hlbiBFU01cblxuaW1wb3J0IHsgYnRvYSwgcmVhZEFzQmluYXJ5U3RyaW5nIH0gZnJvbSAncG91Y2hkYi1iaW5hcnktdXRpbHMnO1xuXG5pbXBvcnQgeyBET0NfU1RPUkUgfSBmcm9tICcuL3V0aWwuanMnO1xuXG5mdW5jdGlvbiBwYXJzZUF0dGFjaG1lbnQoYXR0YWNobWVudCwgb3B0cywgY2IpIHtcbiAgaWYgKG9wdHMuYmluYXJ5KSB7XG4gICAgcmV0dXJuIGNiKG51bGwsIGF0dGFjaG1lbnQpO1xuICB9IGVsc2Uge1xuICAgIHJlYWRBc0JpbmFyeVN0cmluZyhhdHRhY2htZW50LCBmdW5jdGlvbiAoYmluU3RyaW5nKSB7XG4gICAgICBjYihudWxsLCBidG9hKGJpblN0cmluZykpO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEF0dGFjaG1lbnQodHhuLCBkb2NJZCwgYXR0YWNoSWQsIF8sIG9wdHMsIGNiKSB7XG4gIGlmICh0eG4uZXJyb3IpIHtcbiAgICByZXR1cm4gY2IodHhuLmVycm9yKTtcbiAgfVxuXG4gIHZhciBhdHRhY2htZW50O1xuXG4gIHR4bi50eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKS5nZXQoZG9jSWQpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgdmFyIGRvYyA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICB2YXIgcmV2ID0gZG9jLnJldnNbb3B0cy5yZXYgfHwgZG9jLnJldl0uZGF0YTtcbiAgICB2YXIgZGlnZXN0ID0gcmV2Ll9hdHRhY2htZW50c1thdHRhY2hJZF0uZGlnZXN0O1xuICAgIGF0dGFjaG1lbnQgPSBkb2MuYXR0YWNobWVudHNbZGlnZXN0XS5kYXRhO1xuICB9O1xuXG4gIHR4bi50eG4ub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBwYXJzZUF0dGFjaG1lbnQoYXR0YWNobWVudCwgb3B0cywgY2IpO1xuICB9O1xuXG4gIHR4bi50eG4ub25hYm9ydCA9IGNiO1xufVxuXG5leHBvcnQge1xuICBnZXRBdHRhY2htZW50LFxuICBwYXJzZUF0dGFjaG1lbnRcbn07XG4iLCIvLyAndXNlIHN0cmljdCc7IGlzIGRlZmF1bHQgd2hlbiBFU01cblxuaW1wb3J0IHtcbiAgY3JlYXRlRXJyb3IsXG4gIFJFVl9DT05GTElDVCxcbiAgTUlTU0lOR19ET0MsXG4gIE1JU1NJTkdfU1RVQixcbiAgQkFEX0FSRyxcbiAgVU5LTk9XTl9FUlJPUlxufSBmcm9tICdwb3VjaGRiLWVycm9ycyc7XG5cbmltcG9ydCB7XG4gIGJpbmFyeVN0cmluZ1RvQmxvYk9yQnVmZmVyIGFzIGJpblN0cmluZ1RvQmxvYk9yQnVmZmVyXG59IGZyb20gJ3BvdWNoZGItYmluYXJ5LXV0aWxzJztcblxuaW1wb3J0IHsgcGFyc2VEb2MgfSBmcm9tICdwb3VjaGRiLWFkYXB0ZXItdXRpbHMnO1xuaW1wb3J0IHsgYmluYXJ5TWQ1IGFzIG1kNSB9IGZyb20gJ3BvdWNoZGItbWQ1JztcbmltcG9ydCB7IHdpbm5pbmdSZXYgYXMgY2FsY3VsYXRlV2lubmluZ1JldiwgbWVyZ2UsIGNvbXBhY3RUcmVlIH0gZnJvbSAncG91Y2hkYi1tZXJnZSc7XG5cbmltcG9ydCB7IERPQ19TVE9SRSwgTUVUQV9TVE9SRSwgaWRiRXJyb3IgfSBmcm9tICcuL3V0aWwuanMnO1xuXG5pbXBvcnQgeyByZXdyaXRlIH0gZnJvbSAnLi9yZXdyaXRlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGFwaSwgcmVxLCBvcHRzLCBtZXRhZGF0YSwgZGJPcHRzLCBpZGJDaGFuZ2VzLCBjYWxsYmFjaykge1xuXG4gIHZhciB0eG47XG5cbiAgLy8gVE9ETzogSSB3b3VsZCBwcmVmZXIgdG8gZ2V0IHJpZCBvZiB0aGVzZSBnbG9iYWxzXG4gIHZhciBlcnJvcjtcbiAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgdmFyIGRvY3MgPSBbXTtcbiAgdmFyIGxhc3RXcml0ZUluZGV4O1xuXG4gIHZhciByZXZzTGltaXQgPSBkYk9wdHMucmV2c19saW1pdCB8fCAxMDAwO1xuICB2YXIgcmV3cml0ZUVuYWJsZWQgPSBkYk9wdHMubmFtZS5pbmRleE9mKFwiLW1ydmlldy1cIikgPT09IC0xO1xuICBjb25zdCBhdXRvQ29tcGFjdGlvbiA9IGRiT3B0cy5hdXRvX2NvbXBhY3Rpb247XG5cbiAgLy8gV2Ugb25seSBuZWVkIHRvIHRyYWNrIDEgcmV2aXNpb24gZm9yIGxvY2FsIGRvY3VtZW50c1xuICBmdW5jdGlvbiBkb2NzUmV2c0xpbWl0KGRvYykge1xuICAgIHJldHVybiBkb2MuaWQuc3RhcnRzV2l0aCgnX2xvY2FsLycpID8gMSA6IHJldnNMaW1pdDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJvb3RJc01pc3NpbmcoZG9jKSB7XG4gICAgcmV0dXJuIGRvYy5yZXZfdHJlZVswXS5pZHNbMV0uc3RhdHVzID09PSAnbWlzc2luZyc7XG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZUJhc2U2NChkYXRhKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhdG9iKGRhdGEpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yOiBjcmVhdGVFcnJvcihCQURfQVJHLCAnQXR0YWNobWVudCBpcyBub3QgYSB2YWxpZCBiYXNlNjQgc3RyaW5nJylcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLy8gUmVhZHMgdGhlIG9yaWdpbmFsIGRvYyBmcm9tIHRoZSBzdG9yZSBpZiBhdmFpbGFibGVcbiAgLy8gQXMgaW4gYWxsRG9jcyB3aXRoIGtleXMgb3B0aW9uIHVzaW5nIG11bHRpcGxlIGdldCBjYWxscyBpcyB0aGUgZmFzdGVzdCB3YXlcbiAgZnVuY3Rpb24gZmV0Y2hFeGlzdGluZ0RvY3ModHhuLCBkb2NzKSB7XG4gICAgdmFyIGZldGNoZWQgPSAwO1xuICAgIHZhciBvbGREb2NzID0ge307XG5cbiAgICBmdW5jdGlvbiByZWFkRG9uZShlKSB7XG4gICAgICBpZiAoZS50YXJnZXQucmVzdWx0KSB7XG4gICAgICAgIG9sZERvY3NbZS50YXJnZXQucmVzdWx0LmlkXSA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGlmICgrK2ZldGNoZWQgPT09IGRvY3MubGVuZ3RoKSB7XG4gICAgICAgIHByb2Nlc3NEb2NzKHR4biwgZG9jcywgb2xkRG9jcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZG9jcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgIHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpLmdldChkb2MuaWQpLm9uc3VjY2VzcyA9IHJlYWREb25lO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmV2SGFzQXR0YWNobWVudChkb2MsIHJldiwgZGlnZXN0KSB7XG4gICAgcmV0dXJuIGRvYy5yZXZzW3Jldl0gJiZcbiAgICAgIGRvYy5yZXZzW3Jldl0uZGF0YS5fYXR0YWNobWVudHMgJiZcbiAgICAgIE9iamVjdC52YWx1ZXMoZG9jLnJldnNbcmV2XS5kYXRhLl9hdHRhY2htZW50cykuZmluZChmdW5jdGlvbiAoYXR0KSB7XG4gICAgICAgIHJldHVybiBhdHQuZGlnZXN0ID09PSBkaWdlc3Q7XG4gICAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2Nlc3NEb2NzKHR4biwgZG9jcywgb2xkRG9jcykge1xuXG4gICAgZG9jcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGkpIHtcbiAgICAgIHZhciBuZXdEb2M7XG5cbiAgICAgIC8vIFRoZSBmaXJzdCBkb2N1bWVudCB3cml0ZSBjYW5ub3QgYmUgYSBkZWxldGlvblxuICAgICAgaWYgKCd3YXNfZGVsZXRlJyBpbiBvcHRzICYmICEoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9sZERvY3MsIGRvYy5pZCkpKSB7XG4gICAgICAgIG5ld0RvYyA9IGNyZWF0ZUVycm9yKE1JU1NJTkdfRE9DLCAnZGVsZXRlZCcpO1xuXG4gICAgICAvLyBUaGUgZmlyc3Qgd3JpdGUgb2YgYSBkb2N1bWVudCBjYW5ub3Qgc3BlY2lmeSBhIHJldmlzaW9uXG4gICAgICB9IGVsc2UgaWYgKG9wdHMubmV3X2VkaXRzICYmXG4gICAgICAgICAgICAgICAgICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2xkRG9jcywgZG9jLmlkKSAmJlxuICAgICAgICAgICAgICAgICByb290SXNNaXNzaW5nKGRvYykpIHtcbiAgICAgICAgbmV3RG9jID0gY3JlYXRlRXJyb3IoUkVWX0NPTkZMSUNUKTtcblxuICAgICAgLy8gVXBkYXRlIHRoZSBleGlzdGluZyBkb2N1bWVudFxuICAgICAgfSBlbHNlIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2xkRG9jcywgZG9jLmlkKSkge1xuICAgICAgICBuZXdEb2MgPSB1cGRhdGUodHhuLCBkb2MsIG9sZERvY3NbZG9jLmlkXSk7XG4gICAgICAgIC8vIFRoZSB1cGRhdGUgY2FuIGJlIHJlamVjdGVkIGlmIGl0IGlzIGFuIHVwZGF0ZSB0byBhbiBleGlzdGluZ1xuICAgICAgICAvLyByZXZpc2lvbiwgaWYgc28gc2tpcCBpdFxuICAgICAgICBpZiAobmV3RG9jID09IGZhbHNlKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgIC8vIE5ldyBkb2N1bWVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRW5zdXJlIG5ldyBkb2N1bWVudHMgYXJlIGFsc28gc3RlbW1lZFxuICAgICAgICB2YXIgbWVyZ2VkID0gbWVyZ2UoW10sIGRvYy5yZXZfdHJlZVswXSwgZG9jc1JldnNMaW1pdChkb2MpKTtcbiAgICAgICAgZG9jLnJldl90cmVlID0gbWVyZ2VkLnRyZWU7XG4gICAgICAgIGRvYy5zdGVtbWVkUmV2cyA9IG1lcmdlZC5zdGVtbWVkUmV2cztcbiAgICAgICAgbmV3RG9jID0gZG9jO1xuICAgICAgICBuZXdEb2MuaXNOZXdEb2MgPSB0cnVlO1xuICAgICAgICBuZXdEb2Mud2FzRGVsZXRlZCA9IGRvYy5yZXZzW2RvYy5yZXZdLmRlbGV0ZWQgPyAxIDogMDtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld0RvYy5lcnJvcikge1xuICAgICAgICByZXN1bHRzW2ldID0gbmV3RG9jO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2xkRG9jc1tuZXdEb2MuaWRdID0gbmV3RG9jO1xuICAgICAgICBsYXN0V3JpdGVJbmRleCA9IGk7XG4gICAgICAgIHdyaXRlKHR4biwgbmV3RG9jLCBpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIENvbnZlcnRzIGZyb20gdGhlIGZvcm1hdCByZXR1cm5lZCBieSBwYXJzZURvYyBpbnRvIHRoZSBuZXcgZm9ybWF0XG4gIC8vIHdlIHVzZSB0byBzdG9yZVxuICBmdW5jdGlvbiBjb252ZXJ0RG9jRm9ybWF0KGRvYykge1xuXG4gICAgdmFyIG5ld0RvYyA9IHtcbiAgICAgIGlkOiBkb2MubWV0YWRhdGEuaWQsXG4gICAgICByZXY6IGRvYy5tZXRhZGF0YS5yZXYsXG4gICAgICByZXZfdHJlZTogZG9jLm1ldGFkYXRhLnJldl90cmVlLFxuICAgICAgcmV2czogZG9jLm1ldGFkYXRhLnJldnMgfHwge31cbiAgICB9O1xuXG4gICAgbmV3RG9jLnJldnNbbmV3RG9jLnJldl0gPSB7XG4gICAgICBkYXRhOiBkb2MuZGF0YSxcbiAgICAgIGRlbGV0ZWQ6IGRvYy5tZXRhZGF0YS5kZWxldGVkXG4gICAgfTtcblxuICAgIHJldHVybiBuZXdEb2M7XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGUodHhuLCBkb2MsIG9sZERvYykge1xuXG4gICAgLy8gSWdub3JlIHVwZGF0ZXMgdG8gZXhpc3RpbmcgcmV2aXNpb25zXG4gICAgaWYgKChkb2MucmV2IGluIG9sZERvYy5yZXZzKSAmJiAhb3B0cy5uZXdfZWRpdHMpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgaXNSb290ID0gL14xLS8udGVzdChkb2MucmV2KTtcblxuICAgIC8vIFJlYXR0YWNoIGZpcnN0IHdyaXRlcyBhZnRlciBhIGRlbGV0aW9uIHRvIGxhc3QgZGVsZXRlZCB0cmVlXG4gICAgaWYgKG9sZERvYy5kZWxldGVkICYmICFkb2MuZGVsZXRlZCAmJiBvcHRzLm5ld19lZGl0cyAmJiBpc1Jvb3QpIHtcbiAgICAgIHZhciB0bXAgPSBkb2MucmV2c1tkb2MucmV2XS5kYXRhO1xuICAgICAgdG1wLl9yZXYgPSBvbGREb2MucmV2O1xuICAgICAgdG1wLl9pZCA9IG9sZERvYy5pZDtcbiAgICAgIGRvYyA9IGNvbnZlcnREb2NGb3JtYXQocGFyc2VEb2ModG1wLCBvcHRzLm5ld19lZGl0cywgZGJPcHRzKSk7XG4gICAgfVxuXG4gICAgdmFyIG1lcmdlZCA9IG1lcmdlKG9sZERvYy5yZXZfdHJlZSwgZG9jLnJldl90cmVlWzBdLCBkb2NzUmV2c0xpbWl0KGRvYykpO1xuICAgIGRvYy5zdGVtbWVkUmV2cyA9IG1lcmdlZC5zdGVtbWVkUmV2cztcbiAgICBkb2MucmV2X3RyZWUgPSBtZXJnZWQudHJlZTtcblxuICAgIC8vIE1lcmdlIHRoZSBvbGQgYW5kIG5ldyByZXYgZGF0YVxuICAgIHZhciByZXZzID0gb2xkRG9jLnJldnM7XG4gICAgcmV2c1tkb2MucmV2XSA9IGRvYy5yZXZzW2RvYy5yZXZdO1xuICAgIGRvYy5yZXZzID0gcmV2cztcblxuICAgIGRvYy5hdHRhY2htZW50cyA9IG9sZERvYy5hdHRhY2htZW50cztcblxuICAgIHZhciBpbkNvbmZsaWN0ID0gb3B0cy5uZXdfZWRpdHMgJiYgKCgob2xkRG9jLmRlbGV0ZWQgJiYgZG9jLmRlbGV0ZWQpIHx8XG4gICAgICAgKCFvbGREb2MuZGVsZXRlZCAmJiBtZXJnZWQuY29uZmxpY3RzICE9PSAnbmV3X2xlYWYnKSB8fFxuICAgICAgIChvbGREb2MuZGVsZXRlZCAmJiAhZG9jLmRlbGV0ZWQgJiYgbWVyZ2VkLmNvbmZsaWN0cyA9PT0gJ25ld19icmFuY2gnKSB8fFxuICAgICAgIChvbGREb2MucmV2ID09PSBkb2MucmV2KSkpO1xuXG4gICAgaWYgKGluQ29uZmxpY3QpIHtcbiAgICAgIHJldHVybiBjcmVhdGVFcnJvcihSRVZfQ09ORkxJQ1QpO1xuICAgIH1cblxuICAgIGRvYy53YXNEZWxldGVkID0gb2xkRG9jLmRlbGV0ZWQ7XG5cbiAgICByZXR1cm4gZG9jO1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUodHhuLCBkb2MsIGkpIHtcblxuICAgIC8vIFdlIGNvcHkgdGhlIGRhdGEgZnJvbSB0aGUgd2lubmluZyByZXZpc2lvbiBpbnRvIHRoZSByb290XG4gICAgLy8gb2YgdGhlIGRvY3VtZW50IHNvIHRoYXQgaXQgY2FuIGJlIGluZGV4ZWRcbiAgICB2YXIgd2lubmluZ1JldiA9IGNhbGN1bGF0ZVdpbm5pbmdSZXYoZG9jKTtcbiAgICAvLyByZXYgb2YgbmV3IGRvYyBmb3IgYXR0YWNobWVudHMgYW5kIHRvIHJldHVybiBpdFxuICAgIHZhciB3cml0dGVuUmV2ID0gZG9jLnJldjtcbiAgICB2YXIgaXNMb2NhbCA9IGRvYy5pZC5zdGFydHNXaXRoKCdfbG9jYWwvJyk7XG5cbiAgICB2YXIgdGhlRG9jID0gZG9jLnJldnNbd2lubmluZ1Jldl0uZGF0YTtcblxuICAgIGNvbnN0IGlzTmV3RG9jID0gZG9jLmlzTmV3RG9jO1xuXG4gICAgaWYgKHJld3JpdGVFbmFibGVkKSB7XG4gICAgICAvLyBkb2MuZGF0YSBpcyB3aGF0IHdlIGluZGV4LCBzbyB3ZSBuZWVkIHRvIGNsb25lIGFuZCByZXdyaXRlIGl0LCBhbmQgY2xlYW5cbiAgICAgIC8vIGl0IHVwIGZvciBpbmRleGFiaWxpdHlcbiAgICAgIHZhciByZXN1bHQgPSByZXdyaXRlKHRoZURvYyk7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIGRvYy5kYXRhID0gcmVzdWx0O1xuICAgICAgICBkZWxldGUgZG9jLmRhdGEuX2F0dGFjaG1lbnRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jLmRhdGEgPSB0aGVEb2M7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGRvYy5kYXRhID0gdGhlRG9jO1xuICAgIH1cblxuICAgIGRvYy5yZXYgPSB3aW5uaW5nUmV2O1xuICAgIC8vIC5kZWxldGVkIG5lZWRzIHRvIGJlIGFuIGludCBmb3IgaW5kZXhpbmdcbiAgICBkb2MuZGVsZXRlZCA9IGRvYy5yZXZzW3dpbm5pbmdSZXZdLmRlbGV0ZWQgPyAxIDogMDtcblxuICAgIC8vIEJ1bXAgdGhlIHNlcSBmb3IgZXZlcnkgbmV3IChub24gbG9jYWwpIHJldmlzaW9uIHdyaXR0ZW5cbiAgICAvLyBUT0RPOiBpbmRleCBleHBlY3RzIGEgdW5pcXVlIHNlcSwgbm90IHN1cmUgaWYgaWdub3JpbmcgbG9jYWwgd2lsbFxuICAgIC8vIHdvcmtcbiAgICBpZiAoIWlzTG9jYWwpIHtcbiAgICAgIGRvYy5zZXEgPSArK21ldGFkYXRhLnNlcTtcblxuICAgICAgdmFyIGRlbHRhID0gMDtcbiAgICAgIC8vIElmIGl0cyBhIG5ldyBkb2N1bWVudCwgd2Ugd29udCBkZWNyZW1lbnQgaWYgZGVsZXRlZFxuICAgICAgaWYgKGRvYy5pc05ld0RvYykge1xuICAgICAgICBkZWx0YSA9IGRvYy5kZWxldGVkID8gMCA6IDE7XG4gICAgICB9IGVsc2UgaWYgKGRvYy53YXNEZWxldGVkICE9PSBkb2MuZGVsZXRlZCkge1xuICAgICAgICBkZWx0YSA9IGRvYy5kZWxldGVkID8gLTEgOiAxO1xuICAgICAgfVxuICAgICAgbWV0YWRhdGEuZG9jX2NvdW50ICs9IGRlbHRhO1xuICAgIH1cbiAgICBkZWxldGUgZG9jLmlzTmV3RG9jO1xuICAgIGRlbGV0ZSBkb2Mud2FzRGVsZXRlZDtcblxuICAgIC8vIElmIHRoZXJlIGhhdmUgYmVlbiByZXZpc2lvbnMgc3RlbW1lZCB3aGVuIG1lcmdpbmcgdHJlZXMsXG4gICAgLy8gZGVsZXRlIHRoZWlyIGRhdGFcbiAgICBsZXQgcmV2c1RvRGVsZXRlID0gZG9jLnN0ZW1tZWRSZXZzIHx8IFtdO1xuXG4gICAgaWYgKGF1dG9Db21wYWN0aW9uICYmICFpc05ld0RvYykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gY29tcGFjdFRyZWUoZG9jKTtcbiAgICAgIGlmIChyZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgIHJldnNUb0RlbGV0ZSA9IHJldnNUb0RlbGV0ZS5jb25jYXQocmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocmV2c1RvRGVsZXRlLmxlbmd0aCkge1xuICAgICAgcmV2c1RvRGVsZXRlLmZvckVhY2goZnVuY3Rpb24gKHJldikgeyBkZWxldGUgZG9jLnJldnNbcmV2XTsgfSk7XG4gICAgfVxuXG4gICAgZGVsZXRlIGRvYy5zdGVtbWVkUmV2cztcblxuICAgIGlmICghKCdhdHRhY2htZW50cycgaW4gZG9jKSkge1xuICAgICAgZG9jLmF0dGFjaG1lbnRzID0ge307XG4gICAgfVxuXG4gICAgaWYgKHRoZURvYy5fYXR0YWNobWVudHMpIHtcbiAgICAgIGZvciAodmFyIGsgaW4gdGhlRG9jLl9hdHRhY2htZW50cykge1xuICAgICAgICB2YXIgYXR0YWNobWVudCA9IHRoZURvYy5fYXR0YWNobWVudHNba107XG4gICAgICAgIGlmIChhdHRhY2htZW50LnN0dWIpIHtcbiAgICAgICAgICBpZiAoIShhdHRhY2htZW50LmRpZ2VzdCBpbiBkb2MuYXR0YWNobWVudHMpKSB7XG4gICAgICAgICAgICBlcnJvciA9IGNyZWF0ZUVycm9yKE1JU1NJTkdfU1RVQik7XG4gICAgICAgICAgICAvLyBUT0RPOiBOb3Qgc3VyZSBob3cgc2FmZSB0aGlzIG1hbnVhbCBhYm9ydCBpcywgc2VlaW5nXG4gICAgICAgICAgICAvLyBjb25zb2xlIGlzc3Vlc1xuICAgICAgICAgICAgdHhuLmFib3J0KCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHJldkhhc0F0dGFjaG1lbnQoZG9jLCB3cml0dGVuUmV2LCBhdHRhY2htZW50LmRpZ2VzdCkpIHtcbiAgICAgICAgICAgIGRvYy5hdHRhY2htZW50c1thdHRhY2htZW50LmRpZ2VzdF0ucmV2c1t3cml0dGVuUmV2XSA9IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICBkb2MuYXR0YWNobWVudHNbYXR0YWNobWVudC5kaWdlc3RdID0gYXR0YWNobWVudDtcbiAgICAgICAgICBkb2MuYXR0YWNobWVudHNbYXR0YWNobWVudC5kaWdlc3RdLnJldnMgPSB7fTtcbiAgICAgICAgICBkb2MuYXR0YWNobWVudHNbYXR0YWNobWVudC5kaWdlc3RdLnJldnNbd3JpdHRlblJldl0gPSB0cnVlO1xuXG4gICAgICAgICAgdGhlRG9jLl9hdHRhY2htZW50c1trXSA9IHtcbiAgICAgICAgICAgIHN0dWI6IHRydWUsXG4gICAgICAgICAgICBkaWdlc3Q6IGF0dGFjaG1lbnQuZGlnZXN0LFxuICAgICAgICAgICAgY29udGVudF90eXBlOiBhdHRhY2htZW50LmNvbnRlbnRfdHlwZSxcbiAgICAgICAgICAgIGxlbmd0aDogYXR0YWNobWVudC5sZW5ndGgsXG4gICAgICAgICAgICByZXZwb3M6IHBhcnNlSW50KHdyaXR0ZW5SZXYsIDEwKVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMb2NhbCBkb2N1bWVudHMgaGF2ZSBkaWZmZXJlbnQgcmV2aXNpb24gaGFuZGxpbmdcbiAgICBpZiAoaXNMb2NhbCAmJiBkb2MuZGVsZXRlZCkge1xuICAgICAgdHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSkuZGVsZXRlKGRvYy5pZCkub25zdWNjZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXN1bHRzW2ldID0ge1xuICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgIGlkOiBkb2MuaWQsXG4gICAgICAgICAgcmV2OiAnMC0wJ1xuICAgICAgICB9O1xuICAgICAgfTtcbiAgICAgIHVwZGF0ZVNlcShpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKS5wdXQoZG9jKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXN1bHRzW2ldID0ge1xuICAgICAgICBvazogdHJ1ZSxcbiAgICAgICAgaWQ6IGRvYy5pZCxcbiAgICAgICAgcmV2OiB3cml0dGVuUmV2XG4gICAgICB9O1xuICAgICAgdXBkYXRlU2VxKGkpO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVTZXEoaSkge1xuICAgIGlmIChpID09PSBsYXN0V3JpdGVJbmRleCkge1xuICAgICAgdHhuLm9iamVjdFN0b3JlKE1FVEFfU1RPUkUpLnB1dChtZXRhZGF0YSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcHJlUHJvY2Vzc0F0dGFjaG1lbnQoYXR0YWNobWVudCkge1xuICAgIGlmIChhdHRhY2htZW50LnN0dWIpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoYXR0YWNobWVudCk7XG4gICAgfVxuXG4gICAgdmFyIGJpbkRhdGE7XG4gICAgaWYgKHR5cGVvZiBhdHRhY2htZW50LmRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICBiaW5EYXRhID0gcGFyc2VCYXNlNjQoYXR0YWNobWVudC5kYXRhKTtcbiAgICAgIGlmIChiaW5EYXRhLmVycm9yKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChiaW5EYXRhLmVycm9yKTtcbiAgICAgIH1cbiAgICAgIGF0dGFjaG1lbnQuZGF0YSA9IGJpblN0cmluZ1RvQmxvYk9yQnVmZmVyKGJpbkRhdGEsIGF0dGFjaG1lbnQuY29udGVudF90eXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYmluRGF0YSA9IGF0dGFjaG1lbnQuZGF0YTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgIG1kNShiaW5EYXRhLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgIGF0dGFjaG1lbnQuZGlnZXN0ID0gJ21kNS0nICsgcmVzdWx0O1xuICAgICAgICBhdHRhY2htZW50Lmxlbmd0aCA9IGJpbkRhdGEuc2l6ZSB8fCBiaW5EYXRhLmxlbmd0aCB8fCAwO1xuICAgICAgICByZXNvbHZlKGF0dGFjaG1lbnQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcmVQcm9jZXNzQXR0YWNobWVudHMoKSB7XG4gICAgdmFyIHByb21pc2VzID0gZG9jcy5tYXAoZnVuY3Rpb24gKGRvYykge1xuICAgICAgdmFyIGRhdGEgPSBkb2MucmV2c1tkb2MucmV2XS5kYXRhO1xuICAgICAgaWYgKCFkYXRhLl9hdHRhY2htZW50cykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGRhdGEpO1xuICAgICAgfVxuICAgICAgdmFyIGF0dGFjaG1lbnRzID0gT2JqZWN0LmtleXMoZGF0YS5fYXR0YWNobWVudHMpLm1hcChmdW5jdGlvbiAoaykge1xuICAgICAgICBkYXRhLl9hdHRhY2htZW50c1trXS5uYW1lID0gaztcbiAgICAgICAgcmV0dXJuIHByZVByb2Nlc3NBdHRhY2htZW50KGRhdGEuX2F0dGFjaG1lbnRzW2tdKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwoYXR0YWNobWVudHMpLnRoZW4oZnVuY3Rpb24gKG5ld0F0dGFjaG1lbnRzKSB7XG4gICAgICAgIHZhciBwcm9jZXNzZWQgPSB7fTtcbiAgICAgICAgbmV3QXR0YWNobWVudHMuZm9yRWFjaChmdW5jdGlvbiAoYXR0YWNobWVudCkge1xuICAgICAgICAgIHByb2Nlc3NlZFthdHRhY2htZW50Lm5hbWVdID0gYXR0YWNobWVudDtcbiAgICAgICAgICBkZWxldGUgYXR0YWNobWVudC5uYW1lO1xuICAgICAgICB9KTtcbiAgICAgICAgZGF0YS5fYXR0YWNobWVudHMgPSBwcm9jZXNzZWQ7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSByZXEuZG9jcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciByZXN1bHQ7XG4gICAgLy8gVE9ETzogV2Ugc2hvdWxkIGdldCByaWQgb2YgdGhyb3dpbmcgZm9yIGludmFsaWQgZG9jcywgYWxzbyBub3Qgc3VyZVxuICAgIC8vIHdoeSB0aGlzIGlzIG5lZWRlZCBpbiBpZGItbmV4dCBhbmQgbm90IGlkYlxuICAgIHRyeSB7XG4gICAgICByZXN1bHQgPSBwYXJzZURvYyhyZXEuZG9jc1tpXSwgb3B0cy5uZXdfZWRpdHMsIGRiT3B0cyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXN1bHQgPSBlcnI7XG4gICAgfVxuICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayhyZXN1bHQpO1xuICAgIH1cblxuICAgIC8vIElkZWFsbHkgcGFyc2VEb2Mgd291bGQgcmV0dXJuIGRhdGEgaW4gdGhpcyBmb3JtYXQsIGJ1dCBpdCBpcyBjdXJyZW50bHlcbiAgICAvLyBzaGFyZWQgc28gd2UgbmVlZCB0byBjb252ZXJ0XG4gICAgZG9jcy5wdXNoKGNvbnZlcnREb2NGb3JtYXQocmVzdWx0KSk7XG4gIH1cblxuICBwcmVQcm9jZXNzQXR0YWNobWVudHMoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICBhcGkuX29wZW5UcmFuc2FjdGlvblNhZmVseShbRE9DX1NUT1JFLCBNRVRBX1NUT1JFXSwgJ3JlYWR3cml0ZScsIGZ1bmN0aW9uIChlcnIsIF90eG4pIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICB9XG5cbiAgICAgIHR4biA9IF90eG47XG5cbiAgICAgIHR4bi5vbmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBjYWxsYmFjayhlcnJvciB8fCBjcmVhdGVFcnJvcihVTktOT1dOX0VSUk9SLCAndHJhbnNhY3Rpb24gd2FzIGFib3J0ZWQnKSk7XG4gICAgICB9O1xuICAgICAgdHhuLm9udGltZW91dCA9IGlkYkVycm9yKGNhbGxiYWNrKTtcblxuICAgICAgdHhuLm9uY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlkYkNoYW5nZXMubm90aWZ5KGRiT3B0cy5uYW1lKTtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XG4gICAgICB9O1xuXG4gICAgICAvLyBXZSB3b3VsZCBsaWtlIHRvIHVzZSBwcm9taXNlcyBoZXJlLCBidXQgaWRiIHN1Y2tzXG4gICAgICBmZXRjaEV4aXN0aW5nRG9jcyh0eG4sIGRvY3MpO1xuICAgIH0pO1xuICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgY2FsbGJhY2soZXJyKTtcbiAgfSk7XG59XG4iLCIvLyAndXNlIHN0cmljdCc7IGlzIGRlZmF1bHQgd2hlbiBFU01cblxuaW1wb3J0IHsgY3JlYXRlRXJyb3IsIElEQl9FUlJPUiB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcbmltcG9ydCB7IGNvbGxlY3RDb25mbGljdHMgfSBmcm9tICdwb3VjaGRiLW1lcmdlJztcblxuaW1wb3J0IHsgRE9DX1NUT1JFLCBwcm9jZXNzQXR0YWNobWVudCB9IGZyb20gJy4vdXRpbC5qcyc7XG5cbmZ1bmN0aW9uIGFsbERvY3NLZXlzKGtleXMsIGRvY1N0b3JlLCBhbGxEb2NzSW5uZXIpIHtcbiAgLy8gSXQncyBub3QgZ3VhcmFudGVkIHRvIGJlIHJldHVybmVkIGluIHJpZ2h0IG9yZGVyXG4gIHZhciB2YWx1ZXNCYXRjaCA9IG5ldyBBcnJheShrZXlzLmxlbmd0aCk7XG4gIHZhciBjb3VudCA9IDA7XG4gIGtleXMuZm9yRWFjaChmdW5jdGlvbiAoa2V5LCBpbmRleCkge1xuICAgIGRvY1N0b3JlLmdldChrZXkpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgaWYgKGV2ZW50LnRhcmdldC5yZXN1bHQpIHtcbiAgICAgIHZhbHVlc0JhdGNoW2luZGV4XSA9IGV2ZW50LnRhcmdldC5yZXN1bHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZXNCYXRjaFtpbmRleF0gPSB7a2V5OiBrZXksIGVycm9yOiAnbm90X2ZvdW5kJ307XG4gICAgICB9XG4gICAgICBjb3VudCsrO1xuICAgICAgaWYgKGNvdW50ID09PSBrZXlzLmxlbmd0aCkge1xuICAgICAgICB2YWx1ZXNCYXRjaC5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgICAgIGFsbERvY3NJbm5lcihkb2MpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuICB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5UmFuZ2Uoc3RhcnQsIGVuZCwgaW5jbHVzaXZlRW5kLCBrZXksIGRlc2NlbmRpbmcpIHtcbiAgdHJ5IHtcbiAgICBpZiAoc3RhcnQgJiYgZW5kKSB7XG4gICAgICBpZiAoZGVzY2VuZGluZykge1xuICAgICAgICByZXR1cm4gSURCS2V5UmFuZ2UuYm91bmQoZW5kLCBzdGFydCwgIWluY2x1c2l2ZUVuZCwgZmFsc2UpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIElEQktleVJhbmdlLmJvdW5kKHN0YXJ0LCBlbmQsIGZhbHNlLCAhaW5jbHVzaXZlRW5kKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0KSB7XG4gICAgICBpZiAoZGVzY2VuZGluZykge1xuICAgICAgICByZXR1cm4gSURCS2V5UmFuZ2UudXBwZXJCb3VuZChzdGFydCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gSURCS2V5UmFuZ2UubG93ZXJCb3VuZChzdGFydCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlbmQpIHtcbiAgICAgIGlmIChkZXNjZW5kaW5nKSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS5sb3dlckJvdW5kKGVuZCwgIWluY2x1c2l2ZUVuZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gSURCS2V5UmFuZ2UudXBwZXJCb3VuZChlbmQsICFpbmNsdXNpdmVFbmQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoa2V5KSB7XG4gICAgICByZXR1cm4gSURCS2V5UmFuZ2Uub25seShrZXkpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiB7ZXJyb3I6IGV9O1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVLZXlSYW5nZUVycm9yKG9wdHMsIG1ldGFkYXRhLCBlcnIsIGNhbGxiYWNrKSB7XG4gIGlmIChlcnIubmFtZSA9PT0gXCJEYXRhRXJyb3JcIiAmJiBlcnIuY29kZSA9PT0gMCkge1xuICAgIC8vIGRhdGEgZXJyb3IsIHN0YXJ0IGlzIGxlc3MgdGhhbiBlbmRcbiAgICB2YXIgcmV0dXJuVmFsID0ge1xuICAgICAgdG90YWxfcm93czogbWV0YWRhdGEuZG9jX2NvdW50LFxuICAgICAgb2Zmc2V0OiBvcHRzLnNraXAsXG4gICAgICByb3dzOiBbXVxuICAgIH07XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKG9wdHMudXBkYXRlX3NlcSkge1xuICAgICAgcmV0dXJuVmFsLnVwZGF0ZV9zZXEgPSBtZXRhZGF0YS5zZXE7XG4gICAgfVxuICAgIHJldHVybiBjYWxsYmFjayhudWxsLCByZXR1cm5WYWwpO1xuICB9XG4gIGNhbGxiYWNrKGNyZWF0ZUVycm9yKElEQl9FUlJPUiwgZXJyLm5hbWUsIGVyci5tZXNzYWdlKSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh0eG4sIG1ldGFkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICBpZiAodHhuLmVycm9yKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKHR4bi5lcnJvcik7XG4gIH1cblxuICAvLyBUT0RPOiBXZWlyZCBoYWNrLCBJIGRvbnQgbGlrZSBpdFxuICBpZiAob3B0cy5saW1pdCA9PT0gMCkge1xuICAgIHZhciByZXR1cm5WYWwgPSB7XG4gICAgICB0b3RhbF9yb3dzOiBtZXRhZGF0YS5kb2NfY291bnQsXG4gICAgICBvZmZzZXQ6IG9wdHMuc2tpcCxcbiAgICAgIHJvd3M6IFtdXG4gICAgfTtcblxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmIChvcHRzLnVwZGF0ZV9zZXEpIHtcbiAgICAgIHJldHVyblZhbC51cGRhdGVfc2VxID0gbWV0YWRhdGEuc2VxO1xuICAgIH1cbiAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgcmV0dXJuVmFsKTtcbiAgfVxuXG4gIHZhciByZXN1bHRzID0gW107XG4gIHZhciBwcm9jZXNzaW5nID0gW107XG5cbiAgdmFyIHN0YXJ0ID0gJ3N0YXJ0a2V5JyBpbiBvcHRzID8gb3B0cy5zdGFydGtleSA6IGZhbHNlO1xuICB2YXIgZW5kID0gJ2VuZGtleScgaW4gb3B0cyA/IG9wdHMuZW5ka2V5IDogZmFsc2U7XG4gIHZhciBrZXkgPSAna2V5JyBpbiBvcHRzID8gb3B0cy5rZXkgOiBmYWxzZTtcbiAgdmFyIGtleXMgPSAna2V5cycgaW4gb3B0cyA/IG9wdHMua2V5cyA6IGZhbHNlO1xuICB2YXIgc2tpcCA9IG9wdHMuc2tpcCB8fCAwO1xuICB2YXIgbGltaXQgPSB0eXBlb2Ygb3B0cy5saW1pdCA9PT0gJ251bWJlcicgPyBvcHRzLmxpbWl0IDogLTE7XG4gIHZhciBpbmNsdXNpdmVFbmQgPSBvcHRzLmluY2x1c2l2ZV9lbmQgIT09IGZhbHNlO1xuICB2YXIgZGVzY2VuZGluZyA9ICdkZXNjZW5kaW5nJyBpbiBvcHRzICYmIG9wdHMuZGVzY2VuZGluZyA/ICdwcmV2JyA6IG51bGw7XG5cbiAgdmFyIGtleVJhbmdlO1xuICBpZiAoIWtleXMpIHtcbiAgICBrZXlSYW5nZSA9IGNyZWF0ZUtleVJhbmdlKHN0YXJ0LCBlbmQsIGluY2x1c2l2ZUVuZCwga2V5LCBkZXNjZW5kaW5nKTtcbiAgICBpZiAoa2V5UmFuZ2UgJiYga2V5UmFuZ2UuZXJyb3IpIHtcbiAgICAgIHJldHVybiBoYW5kbGVLZXlSYW5nZUVycm9yKG9wdHMsIG1ldGFkYXRhLCBrZXlSYW5nZS5lcnJvciwgY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIHZhciBkb2NTdG9yZSA9IHR4bi50eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKTtcblxuICB0eG4udHhuLm9uY29tcGxldGUgPSBvblR4bkNvbXBsZXRlO1xuXG4gIGlmIChrZXlzKSB7XG4gICAgcmV0dXJuIGFsbERvY3NLZXlzKG9wdHMua2V5cywgZG9jU3RvcmUsIGFsbERvY3NJbm5lcik7XG4gIH1cblxuICBmdW5jdGlvbiBpbmNsdWRlX2RvYyhyb3csIGRvYykge1xuICAgIHZhciBkb2NEYXRhID0gZG9jLnJldnNbZG9jLnJldl0uZGF0YTtcblxuICAgIHJvdy5kb2MgPSBkb2NEYXRhO1xuICAgIHJvdy5kb2MuX2lkID0gZG9jLmlkO1xuICAgIHJvdy5kb2MuX3JldiA9IGRvYy5yZXY7XG4gICAgaWYgKG9wdHMuY29uZmxpY3RzKSB7XG4gICAgICB2YXIgY29uZmxpY3RzID0gY29sbGVjdENvbmZsaWN0cyhkb2MpO1xuICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgcm93LmRvYy5fY29uZmxpY3RzID0gY29uZmxpY3RzO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob3B0cy5hdHRhY2htZW50cyAmJiBkb2NEYXRhLl9hdHRhY2htZW50cykge1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiBkb2NEYXRhLl9hdHRhY2htZW50cykge1xuICAgICAgICBwcm9jZXNzaW5nLnB1c2gocHJvY2Vzc0F0dGFjaG1lbnQobmFtZSwgZG9jLCByb3cuZG9jLCBvcHRzLmJpbmFyeSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFsbERvY3NJbm5lcihkb2MpIHtcbiAgICBpZiAoZG9jLmVycm9yICYmIGtleXMpIHtcbiAgICAgIC8vIGtleSB3YXMgbm90IGZvdW5kIHdpdGggXCJrZXlzXCIgcmVxdWVzdHNcbiAgICAgIHJlc3VsdHMucHVzaChkb2MpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgdmFyIHJvdyA9IHtcbiAgICAgIGlkOiBkb2MuaWQsXG4gICAgICBrZXk6IGRvYy5pZCxcbiAgICAgIHZhbHVlOiB7XG4gICAgICAgIHJldjogZG9jLnJldlxuICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgZGVsZXRlZCA9IGRvYy5kZWxldGVkO1xuICAgIGlmIChkZWxldGVkKSB7XG4gICAgICBpZiAoa2V5cykge1xuICAgICAgICByZXN1bHRzLnB1c2gocm93KTtcbiAgICAgICAgcm93LnZhbHVlLmRlbGV0ZWQgPSB0cnVlO1xuICAgICAgICByb3cuZG9jID0gbnVsbDtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNraXAtLSA8PSAwKSB7XG4gICAgICByZXN1bHRzLnB1c2gocm93KTtcbiAgICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcykge1xuICAgICAgICBpbmNsdWRlX2RvYyhyb3csIGRvYyk7XG4gICAgICB9XG4gICAgICBpZiAoLS1saW1pdCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gb25UeG5Db21wbGV0ZSgpIHtcbiAgICBQcm9taXNlLmFsbChwcm9jZXNzaW5nKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciByZXR1cm5WYWwgPSB7XG4gICAgICAgIHRvdGFsX3Jvd3M6IG1ldGFkYXRhLmRvY19jb3VudCxcbiAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICByb3dzOiByZXN1bHRzXG4gICAgICB9O1xuXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChvcHRzLnVwZGF0ZV9zZXEpIHtcbiAgICAgICAgcmV0dXJuVmFsLnVwZGF0ZV9zZXEgPSBtZXRhZGF0YS5zZXE7XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCByZXR1cm5WYWwpO1xuICAgIH0pO1xuICB9XG5cbiAgdmFyIGN1cnNvciA9IGRlc2NlbmRpbmcgP1xuICAgIGRvY1N0b3JlLm9wZW5DdXJzb3Ioa2V5UmFuZ2UsIGRlc2NlbmRpbmcpIDpcbiAgICBkb2NTdG9yZS5vcGVuQ3Vyc29yKGtleVJhbmdlKTtcblxuICBjdXJzb3Iub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcblxuICAgIHZhciBkb2MgPSBlLnRhcmdldC5yZXN1bHQgJiYgZS50YXJnZXQucmVzdWx0LnZhbHVlO1xuXG4gICAgLy8gSGFwcGVucyBpZiBvcHRzIGRvZXMgbm90IGhhdmUgbGltaXQsXG4gICAgLy8gYmVjYXVzZSBjdXJzb3Igd2lsbCBlbmQgbm9ybWFsbHkgdGhlbixcbiAgICAvLyB3aGVuIGFsbCBkb2NzIGFyZSByZXRyaWV2ZWQuXG4gICAgLy8gV291bGQgbm90IGJlIG5lZWRlZCwgaWYgZ2V0QWxsKCkgb3B0aW1pemF0aW9uIHdhcyB1c2VkIGxpa2UgaW4gIzYwNTlcbiAgICBpZiAoIWRvYykgeyByZXR1cm47IH1cblxuICAgIC8vIFNraXAgbG9jYWwgZG9jc1xuICAgIGlmIChkb2MuaWQuc3RhcnRzV2l0aCgnX2xvY2FsLycpKSB7XG4gICAgICByZXR1cm4gZS50YXJnZXQucmVzdWx0LmNvbnRpbnVlKCk7XG4gICAgfVxuXG4gICAgdmFyIGNvbnRpbnVlQ3Vyc29yID0gYWxsRG9jc0lubmVyKGRvYyk7XG4gICAgaWYgKGNvbnRpbnVlQ3Vyc29yKSB7XG4gICAgICBlLnRhcmdldC5yZXN1bHQuY29udGludWUoKTtcbiAgICB9XG4gIH07XG5cbn1cbiIsImltcG9ydCB7IERPQ19TVE9SRSwgcHJvY2Vzc0F0dGFjaG1lbnQgfSBmcm9tICcuL3V0aWwuanMnO1xuXG5pbXBvcnQgeyB1dWlkLCBmaWx0ZXJDaGFuZ2UgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHR4biwgaWRiQ2hhbmdlcywgYXBpLCBkYk9wdHMsIG9wdHMpIHtcbiAgaWYgKHR4bi5lcnJvcikge1xuICAgIHJldHVybiBvcHRzLmNvbXBsZXRlKHR4bi5lcnJvcik7XG4gIH1cblxuICBpZiAob3B0cy5jb250aW51b3VzKSB7XG4gICAgdmFyIGlkID0gZGJPcHRzLm5hbWUgKyAnOicgKyB1dWlkKCk7XG4gICAgaWRiQ2hhbmdlcy5hZGRMaXN0ZW5lcihkYk9wdHMubmFtZSwgaWQsIGFwaSwgb3B0cyk7XG4gICAgaWRiQ2hhbmdlcy5ub3RpZnkoZGJPcHRzLm5hbWUpO1xuICAgIHJldHVybiB7XG4gICAgICBjYW5jZWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWRiQ2hhbmdlcy5yZW1vdmVMaXN0ZW5lcihkYk9wdHMubmFtZSwgaWQpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICB2YXIgbGltaXQgPSAnbGltaXQnIGluIG9wdHMgPyBvcHRzLmxpbWl0IDogLTE7XG4gIGlmIChsaW1pdCA9PT0gMCkge1xuICAgIGxpbWl0ID0gMTtcbiAgfVxuXG4gIHZhciBzdG9yZSA9IHR4bi50eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKS5pbmRleCgnc2VxJyk7XG5cbiAgdmFyIGZpbHRlciA9IGZpbHRlckNoYW5nZShvcHRzKTtcbiAgdmFyIHJlY2VpdmVkID0gMDtcblxuICB2YXIgbGFzdFNlcSA9IG9wdHMuc2luY2UgfHwgMDtcbiAgdmFyIHJlc3VsdHMgPSBbXTtcblxuICB2YXIgcHJvY2Vzc2luZyA9IFtdO1xuXG4gIGZ1bmN0aW9uIG9uUmVxU3VjY2VzcyhlKSB7XG4gICAgaWYgKCFlLnRhcmdldC5yZXN1bHQpIHsgcmV0dXJuOyB9XG4gICAgdmFyIGN1cnNvciA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICB2YXIgZG9jID0gY3Vyc29yLnZhbHVlO1xuICAgIC8vIE92ZXJ3cml0ZSBkb2MuZGF0YSwgd2hpY2ggbWF5IGhhdmUgYmVlbiByZXdyaXR0ZW4gKHNlZSByZXdyaXRlLmpzKSB3aXRoXG4gICAgLy8gdGhlIGNsZWFuIHZlcnNpb24gZm9yIHRoYXQgcmV2XG4gICAgZG9jLmRhdGEgPSBkb2MucmV2c1tkb2MucmV2XS5kYXRhO1xuICAgIGRvYy5kYXRhLl9pZCA9IGRvYy5pZDtcbiAgICBkb2MuZGF0YS5fcmV2ID0gZG9jLnJldjtcbiAgICBpZiAoZG9jLmRlbGV0ZWQpIHtcbiAgICAgIGRvYy5kYXRhLl9kZWxldGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5kb2NfaWRzICYmIG9wdHMuZG9jX2lkcy5pbmRleE9mKGRvYy5pZCkgPT09IC0xKSB7XG4gICAgICByZXR1cm4gY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgfVxuXG4gICAgLy8gV0FSTklORzogZXhwZWN0aW5nIHBvc3NpYmxlIG9sZCBmb3JtYXRcbiAgICB2YXIgY2hhbmdlID0gb3B0cy5wcm9jZXNzQ2hhbmdlKGRvYy5kYXRhLCBkb2MsIG9wdHMpO1xuICAgIGNoYW5nZS5zZXEgPSBkb2Muc2VxO1xuICAgIGxhc3RTZXEgPSBkb2Muc2VxO1xuICAgIHZhciBmaWx0ZXJlZCA9IGZpbHRlcihjaGFuZ2UpO1xuXG4gICAgLy8gSWYgaXRzIGFuIGVycm9yXG4gICAgaWYgKHR5cGVvZiBmaWx0ZXJlZCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBvcHRzLmNvbXBsZXRlKGZpbHRlcmVkKTtcbiAgICB9XG5cbiAgICBpZiAoZmlsdGVyZWQpIHtcbiAgICAgIHJlY2VpdmVkKys7XG4gICAgICBpZiAob3B0cy5yZXR1cm5fZG9jcykge1xuICAgICAgICByZXN1bHRzLnB1c2goY2hhbmdlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdHMuaW5jbHVkZV9kb2NzICYmIG9wdHMuYXR0YWNobWVudHMgJiYgZG9jLmRhdGEuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgIHZhciBwcm9taXNlcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBuYW1lIGluIGRvYy5kYXRhLl9hdHRhY2htZW50cykge1xuICAgICAgICAgIHZhciBwID0gcHJvY2Vzc0F0dGFjaG1lbnQobmFtZSwgZG9jLCBjaGFuZ2UuZG9jLCBvcHRzLmJpbmFyeSk7XG4gICAgICAgICAgLy8gV2UgYWRkIHRoZSBwcm9jZXNzaW5nIHByb21pc2UgdG8gMiBhcnJheXMsIG9uZSB0cmFja3MgYWxsXG4gICAgICAgICAgLy8gdGhlIHByb21pc2VzIG5lZWRlZCBiZWZvcmUgd2UgZmlyZSBvbkNoYW5nZSwgdGhlIG90aGVyXG4gICAgICAgICAgLy8gZW5zdXJlIHdlIHByb2Nlc3MgYWxsIGF0dGFjaG1lbnRzIGJlZm9yZSBvbkNvbXBsZXRlXG4gICAgICAgICAgcHJvbWlzZXMucHVzaChwKTtcbiAgICAgICAgICBwcm9jZXNzaW5nLnB1c2gocCk7XG4gICAgICAgIH1cblxuICAgICAgICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgb3B0cy5vbkNoYW5nZShjaGFuZ2UpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdHMub25DaGFuZ2UoY2hhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHJlY2VpdmVkICE9PSBsaW1pdCkge1xuICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25UeG5Db21wbGV0ZSgpIHtcbiAgICBQcm9taXNlLmFsbChwcm9jZXNzaW5nKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgIG9wdHMuY29tcGxldGUobnVsbCwge1xuICAgICAgICByZXN1bHRzOiByZXN1bHRzLFxuICAgICAgICBsYXN0X3NlcTogbGFzdFNlcVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICB2YXIgcmVxO1xuICBpZiAob3B0cy5kZXNjZW5kaW5nKSB7XG4gICAgcmVxID0gc3RvcmUub3BlbkN1cnNvcihudWxsLCAncHJldicpO1xuICB9IGVsc2Uge1xuICAgIHJlcSA9IHN0b3JlLm9wZW5DdXJzb3IoSURCS2V5UmFuZ2UubG93ZXJCb3VuZChvcHRzLnNpbmNlLCB0cnVlKSk7XG4gIH1cblxuICB0eG4udHhuLm9uY29tcGxldGUgPSBvblR4bkNvbXBsZXRlO1xuICByZXEub25zdWNjZXNzID0gb25SZXFTdWNjZXNzO1xufVxuIiwiLy8gJ3VzZSBzdHJpY3QnOyBpcyBkZWZhdWx0IHdoZW4gRVNNXG5cbmltcG9ydCB7IGNyZWF0ZUVycm9yLCBNSVNTSU5HX0RPQyB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcblxuaW1wb3J0IHtET0NfU1RPUkV9IGZyb20gJy4vdXRpbC5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh0eG4sIGlkLCBjYWxsYmFjaykge1xuICBpZiAodHhuLmVycm9yKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKHR4bi5lcnJvcik7XG4gIH1cblxuICB2YXIgcmVxID0gdHhuLnR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpLmdldChpZCk7XG4gIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgIGlmICghZS50YXJnZXQucmVzdWx0KSB7XG4gICAgICBjYWxsYmFjayhjcmVhdGVFcnJvcihNSVNTSU5HX0RPQykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhudWxsLCBlLnRhcmdldC5yZXN1bHQucmV2X3RyZWUpO1xuICAgIH1cbiAgfTtcbn1cbiIsIi8vICd1c2Ugc3RyaWN0JzsgaXMgZGVmYXVsdCB3aGVuIEVTTVxuXG5pbXBvcnQgeyBET0NfU1RPUkUgfSBmcm9tICcuL3V0aWwuanMnO1xuXG5pbXBvcnQgeyB0cmF2ZXJzZVJldlRyZWUgfSBmcm9tICdwb3VjaGRiLW1lcmdlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHR4biwgaWQsIHJldnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eG4uZXJyb3IpIHtcbiAgICByZXR1cm4gY2FsbGJhY2sodHhuLmVycm9yKTtcbiAgfVxuXG4gIHZhciBkb2NTdG9yZSA9IHR4bi50eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKTtcblxuICBkb2NTdG9yZS5nZXQoaWQpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgdmFyIGRvYyA9IGUudGFyZ2V0LnJlc3VsdDtcblxuICAgIHRyYXZlcnNlUmV2VHJlZShkb2MucmV2X3RyZWUsIGZ1bmN0aW9uIChpc0xlYWYsIHBvcywgcmV2SGFzaCwgY3R4LCBvcHRzKSB7XG4gICAgICB2YXIgcmV2ID0gcG9zICsgJy0nICsgcmV2SGFzaDtcbiAgICAgIGlmIChyZXZzLmluZGV4T2YocmV2KSAhPT0gLTEpIHtcbiAgICAgICAgb3B0cy5zdGF0dXMgPSAnbWlzc2luZyc7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB2YXIgYXR0YWNobWVudHMgPSBbXTtcblxuICAgIHJldnMuZm9yRWFjaChmdW5jdGlvbiAocmV2KSB7XG4gICAgICBpZiAocmV2IGluIGRvYy5yZXZzKSB7XG4gICAgICAgIC8vIE1ha2UgYSBsaXN0IG9mIGF0dGFjaG1lbnRzIHRoYXQgYXJlIHVzZWQgYnkgdGhlIHJldmlzaW9ucyBiZWluZ1xuICAgICAgICAvLyBkZWxldGVkXG4gICAgICAgIGlmIChkb2MucmV2c1tyZXZdLmRhdGEuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgZm9yICh2YXIgayBpbiBkb2MucmV2c1tyZXZdLmRhdGEuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgICBhdHRhY2htZW50cy5wdXNoKGRvYy5yZXZzW3Jldl0uZGF0YS5fYXR0YWNobWVudHNba10uZGlnZXN0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRvYy5yZXZzW3Jldl07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBdHRhY2htZW50cyBoYXZlIGEgbGlzdCBvZiByZXZpc2lvbnMgdGhhdCBhcmUgdXNpbmcgdGhlbSwgd2hlblxuICAgIC8vIHRoYXQgbGlzdCBiZWNvbWVzIGVtcHR5IHdlIGNhbiBkZWxldGUgdGhlIGF0dGFjaG1lbnQuXG4gICAgYXR0YWNobWVudHMuZm9yRWFjaChmdW5jdGlvbiAoZGlnZXN0KSB7XG4gICAgICByZXZzLmZvckVhY2goZnVuY3Rpb24gKHJldikge1xuICAgICAgICBkZWxldGUgZG9jLmF0dGFjaG1lbnRzW2RpZ2VzdF0ucmV2c1tyZXZdO1xuICAgICAgfSk7XG4gICAgICBpZiAoIU9iamVjdC5rZXlzKGRvYy5hdHRhY2htZW50c1tkaWdlc3RdLnJldnMpLmxlbmd0aCkge1xuICAgICAgICBkZWxldGUgZG9jLmF0dGFjaG1lbnRzW2RpZ2VzdF07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBkb2NTdG9yZS5wdXQoZG9jKTtcbiAgfTtcblxuICB0eG4udHhuLm9uY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soKTtcbiAgfTtcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChkYk9wdHMsIG9wZW5EYXRhYmFzZXMsIGlkYkNoYW5nZXMsIGNhbGxiYWNrKSB7XG5cbiAgaWRiQ2hhbmdlcy5yZW1vdmVBbGxMaXN0ZW5lcnMoZGJPcHRzLm5hbWUpO1xuXG4gIGZ1bmN0aW9uIGRvRGVzdHJveSgpIHtcbiAgICB2YXIgcmVxID0gaW5kZXhlZERCLmRlbGV0ZURhdGFiYXNlKGRiT3B0cy5uYW1lKTtcbiAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgZGVsZXRlIG9wZW5EYXRhYmFzZXNbZGJPcHRzLm5hbWVdO1xuICAgICAgY2FsbGJhY2sobnVsbCwge29rOiB0cnVlfSk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIElmIHRoZSBkYXRhYmFzZSBpcyBvcGVuIHdlIG5lZWQgdG8gY2xvc2UgaXRcbiAgaWYgKGRiT3B0cy5uYW1lIGluIG9wZW5EYXRhYmFzZXMpIHtcbiAgICBvcGVuRGF0YWJhc2VzW2RiT3B0cy5uYW1lXS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgIHJlcy5pZGIuY2xvc2UoKTtcbiAgICAgIGRvRGVzdHJveSgpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGRvRGVzdHJveSgpO1xuICB9XG5cbn1cbiIsIi8vICd1c2Ugc3RyaWN0JzsgaXMgZGVmYXVsdCB3aGVuIEVTTVxuXG5pbXBvcnQge1xuICBET0NfU1RPUkUsXG4gIGlkYkVycm9yLFxuICByYXdJbmRleEZpZWxkcyxcbiAgaXNQYXJ0aWFsRmlsdGVyVmlldyxcbiAgbmF0dXJhbEluZGV4TmFtZVxufSBmcm9tICcuL3V0aWwuanMnO1xuXG5pbXBvcnQge1xuICBJREJfTlVMTCxcbiAgSURCX1RSVUUsXG4gIElEQl9GQUxTRSxcbn0gZnJvbSAnLi9yZXdyaXRlJztcblxuLy8gQWRhcHRlZCBmcm9tXG4vLyBodHRwczovL2dpdGh1Yi5jb20vcG91Y2hkYi9wb3VjaGRiL2Jsb2IvbWFzdGVyL3BhY2thZ2VzL25vZGVfbW9kdWxlcy9wb3VjaGRiLWZpbmQvc3JjL2FkYXB0ZXJzL2xvY2FsL2ZpbmQvcXVlcnktcGxhbm5lci5qcyNMMjAtTDI0XG4vLyBUaGlzIGNvdWxkIGNoYW5nZSAvIGltcHJvdmUgaW4gdGhlIGZ1dHVyZT9cbnZhciBDT1VDSF9DT0xMQVRFX0xPID0gbnVsbDtcbnZhciBDT1VDSF9DT0xMQVRFX0hJID0gJ1xcdWZmZmYnOyAvLyBhY3R1YWxseSB1c2VkIGFzIHtcIlxcdWZmZmZcIjoge319XG5cbi8vIEFkYXB0ZWQgZnJvbTogaHR0cHM6Ly93d3cudzMub3JnL1RSL0luZGV4ZWREQi8jY29tcGFyZS10d28ta2V5c1xuLy8gSW1wb3J0YW50bHksICp0aGVyZSBpcyBubyB1cHBlciBib3VuZCBwb3NzaWJsZSogaW4gaWRiLiBUaGUgaWRlYWwgZGF0YVxuLy8gc3RydWN0dXJlIGFuIGluZmludGVseSBkZWVwIGFycmF5OlxuLy8gICB2YXIgSURCX0NPTExBVEVfSEkgPSBbXTsgSURCX0NPTExBVEVfSEkucHVzaChJREJfQ09MTEFURV9ISSlcbi8vIEJ1dCBJREJLZXlSYW5nZSBpcyBub3QgYSBmYW4gb2Ygc2hlbmFuaWdhbnMsIHNvIEkndmUganVzdCBnb25lIHdpdGggMTIgbGF5ZXJzXG4vLyBiZWNhdXNlIGl0IGxvb2tzIG5pY2UgYW5kIHN1cmVseSB0aGF0J3MgZW5vdWdoIVxudmFyIElEQl9DT0xMQVRFX0xPID0gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO1xudmFyIElEQl9DT0xMQVRFX0hJID0gW1tbW1tbW1tbW1tbXV1dXV1dXV1dXV1dO1xuXG4vL1xuLy8gVE9ETzogdGhpcyBzaG91bGQgYmUgbWFkZSBvZmZpY2FsIHNvbWV3aGVyZSBhbmQgdXNlZCBieSBBbGxEb2NzIC8gZ2V0IC9cbi8vIGNoYW5nZXMgZXRjIGFzIHdlbGwuXG4vL1xuZnVuY3Rpb24gZXh0ZXJuYWxpc2VSZWNvcmQoaWRiRG9jKSB7XG4gIHZhciBkb2MgPSBpZGJEb2MucmV2c1tpZGJEb2MucmV2XS5kYXRhO1xuICBkb2MuX2lkID0gaWRiRG9jLmlkO1xuICBkb2MuX3JldiA9IGlkYkRvYy5yZXY7XG4gIGlmIChpZGJEb2MuZGVsZXRlZCkge1xuICAgIGRvYy5fZGVsZXRlZCA9IHRydWU7XG4gIH1cblxuICByZXR1cm4gZG9jO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhIGtleXJhbmdlIGJhc2VkIG9uIHRoZSBvcHRzIHBhc3NlZCB0byBxdWVyeVxuICpcbiAqIFRoZSBmaXJzdCBrZXkgaXMgYWx3YXlzIDAsIGFzIHRoYXQncyBob3cgd2UncmUgZmlsdGVyaW5nIG91dCBkZWxldGVkIGVudHJpZXMuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlS2V5UmFuZ2Uob3B0cykge1xuICBmdW5jdGlvbiBkZWZpbmVkKG9iaiwgaykge1xuICAgIHJldHVybiBvYmpba10gIT09IHZvaWQgMDtcbiAgfVxuXG4gIC8vIENvbnZlcnRzIGEgdmFsaWQgQ291Y2hEQiBrZXkgaW50byBhIHZhbGlkIEluZGV4ZWREQiBvbmVcbiAgZnVuY3Rpb24gY29udmVydChrZXksIGV4YWN0KSB7XG4gICAgLy8gVGhlIGZpcnN0IGl0ZW0gaW4gZXZlcnkgbmF0aXZlIGluZGV4IGlzIGRvYy5kZWxldGVkLCBhbmQgd2UgYWx3YXlzIHdhbnRcbiAgICAvLyB0byBvbmx5IHNlYXJjaCBkb2N1bWVudHMgdGhhdCBhcmUgbm90IGRlbGV0ZWQuXG4gICAgLy8gXCJmb29cIiAtPiBbMCwgXCJmb29cIl1cbiAgICB2YXIgZmlsdGVyRGVsZXRlZCA9IFswXS5jb25jYXQoa2V5KTtcblxuICAgIHJldHVybiBmaWx0ZXJEZWxldGVkLm1hcChmdW5jdGlvbiAoaykge1xuICAgICAgLy8gbnVsbCwgdHJ1ZSBhbmQgZmFsc2UgYXJlIG5vdCBpbmRleGFibGUgYnkgaW5kZXhlZGRiLiBXaGVuIHdlIHdyaXRlXG4gICAgICAvLyB0aGVzZSB2YWx1ZXMgd2UgY29udmVydCB0aGVtIHRvIHRoZXNlIGNvbnN0YW50cywgYW5kIHNvIHdoZW4gd2VcbiAgICAgIC8vIHF1ZXJ5IGZvciB0aGVtIHdlIG5lZWQgdG8gY29udmVydCB0aGUgcXVlcnkgYWxzby5cbiAgICAgIGlmIChrID09PSBudWxsICYmIGV4YWN0KSB7XG4gICAgICAgIC8vIGZvciBub24tZXhhY3QgcXVlcmllcyB3ZSB0cmVhdCBudWxsIGFzIGEgY29sbGF0ZSBwcm9wZXJ0eVxuICAgICAgICAvLyBzZWUgYGlmICghZXhhY3QpYCBibG9jayBiZWxvd1xuICAgICAgICByZXR1cm4gSURCX05VTEw7XG4gICAgICB9IGVsc2UgaWYgKGsgPT09IHRydWUpIHtcbiAgICAgICAgcmV0dXJuIElEQl9UUlVFO1xuICAgICAgfSBlbHNlIGlmIChrID09PSBmYWxzZSkge1xuICAgICAgICByZXR1cm4gSURCX0ZBTFNFO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWV4YWN0KSB7XG4gICAgICAgIC8vIFdlIGdldCBwYXNzZWQgQ291Y2hEQidzIGNvbGxhdGUgbG93IGFuZCBoaWdoIHZhbHVlcywgc28gZm9yIG5vbi1leGFjdFxuICAgICAgICAvLyByYW5nZWQgcXVlcmllcyB3ZSdyZSBnb2luZyB0byBjb252ZXJ0IHRoZW0gdG8gb3VyIElEQiBlcXVpdmFsZW50c1xuICAgICAgICBpZiAoayA9PT0gQ09VQ0hfQ09MTEFURV9MTykge1xuICAgICAgICAgIHJldHVybiBJREJfQ09MTEFURV9MTztcbiAgICAgICAgfSBlbHNlIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoaywgQ09VQ0hfQ09MTEFURV9ISSkpIHtcbiAgICAgICAgICByZXR1cm4gSURCX0NPTExBVEVfSEk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGs7XG4gICAgfSk7XG4gIH1cblxuICAvLyBDb3VjaERCIGFuZCBzbyBQb3VjaGRCIGRlZmF1bHRzIHRvIHRydWUuIFdlIG5lZWQgdG8gbWFrZSB0aGlzIGV4cGxpY2l0IGFzXG4gIC8vIHdlIGludmVydCB0aGVzZSBsYXRlciBmb3IgSW5kZXhlZERCLlxuICBpZiAoIWRlZmluZWQob3B0cywgJ2luY2x1c2l2ZV9lbmQnKSkge1xuICAgIG9wdHMuaW5jbHVzaXZlX2VuZCA9IHRydWU7XG4gIH1cbiAgaWYgKCFkZWZpbmVkKG9wdHMsICdpbmNsdXNpdmVfc3RhcnQnKSkge1xuICAgIG9wdHMuaW5jbHVzaXZlX3N0YXJ0ID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChvcHRzLmRlc2NlbmRpbmcpIHtcbiAgICAvLyBGbGlwIGJlZm9yZSBnZW5lcmF0aW5nLiBXZSdsbCBjaGVjayBkZXNjZW5kaW5nIGFnYWluIGxhdGVyIHdoZW4gcGVyZm9ybWluZ1xuICAgIC8vIGFuIGluZGV4IHJlcXVlc3RcbiAgICB2YXIgcmVhbEVuZGtleSA9IG9wdHMuc3RhcnRrZXksXG4gICAgICAgIHJlYWxJbmNsdXNpdmVFbmQgPSBvcHRzLmluY2x1c2l2ZV9zdGFydDtcblxuICAgIG9wdHMuc3RhcnRrZXkgPSBvcHRzLmVuZGtleTtcbiAgICBvcHRzLmVuZGtleSA9IHJlYWxFbmRrZXk7XG4gICAgb3B0cy5pbmNsdXNpdmVfc3RhcnQgPSBvcHRzLmluY2x1c2l2ZV9lbmQ7XG4gICAgb3B0cy5pbmNsdXNpdmVfZW5kID0gcmVhbEluY2x1c2l2ZUVuZDtcbiAgfVxuXG4gIHRyeSB7XG4gICAgaWYgKGRlZmluZWQob3B0cywgJ2tleScpKSB7XG4gICAgICByZXR1cm4gSURCS2V5UmFuZ2Uub25seShjb252ZXJ0KG9wdHMua2V5LCB0cnVlKSk7XG4gICAgfVxuXG4gICAgaWYgKGRlZmluZWQob3B0cywgJ3N0YXJ0a2V5JykgJiYgIWRlZmluZWQob3B0cywgJ2VuZGtleScpKSB7XG4gICAgICAvLyBsb3dlckJvdW5kLCBidXQgd2l0aG91dCB0aGUgZGVsZXRlZCBkb2NzLlxuICAgICAgLy8gWzFdIGlzIHRoZSBzdGFydCBvZiB0aGUgZGVsZXRlZCBkb2MgcmFuZ2UsIGFuZCB3ZSBkb24ndCB3YW50IHRvIGluY2x1ZGUgdGhlbi5cbiAgICAgIHJldHVybiBJREJLZXlSYW5nZS5ib3VuZChcbiAgICAgICAgY29udmVydChvcHRzLnN0YXJ0a2V5KSwgWzFdLFxuICAgICAgICAhb3B0cy5pbmNsdXNpdmVfc3RhcnQsIHRydWVcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFkZWZpbmVkKG9wdHMsICdzdGFydGtleScpICYmIGRlZmluZWQob3B0cywgJ2VuZGtleScpKSB7XG4gICAgICByZXR1cm4gSURCS2V5UmFuZ2UudXBwZXJCb3VuZChjb252ZXJ0KG9wdHMuZW5ka2V5KSwgIW9wdHMuaW5jbHVzaXZlX2VuZCk7XG4gICAgfVxuXG4gICAgaWYgKGRlZmluZWQob3B0cywgJ3N0YXJ0a2V5JykgJiYgZGVmaW5lZChvcHRzLCAnZW5ka2V5JykpIHtcbiAgICAgIHJldHVybiBJREJLZXlSYW5nZS5ib3VuZChcbiAgICAgICAgY29udmVydChvcHRzLnN0YXJ0a2V5KSwgICAgY29udmVydChvcHRzLmVuZGtleSksXG4gICAgICAgICFvcHRzLmluY2x1c2l2ZV9zdGFydCwgIW9wdHMuaW5jbHVzaXZlX2VuZFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gSURCS2V5UmFuZ2Uub25seShbMF0pO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgZ2VuZXJhdGUga2V5UmFuZ2UnLCBlcnIsIG9wdHMpO1xuICAgIHRocm93IEVycm9yKCdDb3VsZCBub3QgZ2VuZXJhdGUga2V5IHJhbmdlIHdpdGggJyArIEpTT04uc3RyaW5naWZ5KG9wdHMpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRJbmRleEhhbmRsZShwZGIsIGZpZWxkcywgcmVqZWN0KSB7XG4gIHZhciBpbmRleE5hbWUgPSBuYXR1cmFsSW5kZXhOYW1lKGZpZWxkcyk7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgcGRiLl9vcGVuVHJhbnNhY3Rpb25TYWZlbHkoW0RPQ19TVE9SRV0sICdyZWFkb25seScsIGZ1bmN0aW9uIChlcnIsIHR4bikge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICByZXR1cm4gaWRiRXJyb3IocmVqZWN0KShlcnIpO1xuICAgICAgfVxuXG4gICAgICB0eG4ub25hYm9ydCA9IGlkYkVycm9yKHJlamVjdCk7XG4gICAgICB0eG4ub250aW1lb3V0ID0gaWRiRXJyb3IocmVqZWN0KTtcblxuICAgICAgdmFyIGV4aXN0aW5nSW5kZXhOYW1lcyA9IEFycmF5LmZyb20odHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSkuaW5kZXhOYW1lcyk7XG5cbiAgICAgIGlmIChleGlzdGluZ0luZGV4TmFtZXMuaW5kZXhPZihpbmRleE5hbWUpID09PSAtMSkge1xuICAgICAgICAvLyBUaGUgaW5kZXggaXMgbWlzc2luZywgZm9yY2UgYSBkYiByZXN0YXJ0IGFuZCB0cnkgYWdhaW5cbiAgICAgICAgcGRiLl9mcmVzaGVuKClcbiAgICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7IHJldHVybiBnZXRJbmRleEhhbmRsZShwZGIsIGZpZWxkcywgcmVqZWN0KTsgfSlcbiAgICAgICAgICAudGhlbihyZXNvbHZlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc29sdmUodHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSkuaW5kZXgoaW5kZXhOYW1lKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuXG4vLyBJbiB0aGVvcnkgd2Ugc2hvdWxkIHJldHVybiBzb21ldGhpbmcgbGlrZSB0aGUgZG9jIGV4YW1wbGUgYmVsb3csIGJ1dCBmaW5kXG4vLyBvbmx5IG5lZWRzIHJvd3M6IFt7ZG9jOiB7Li4ufX1dLCBzbyBJIHRoaW5rIHdlIGNhbiBqdXN0IG5vdCBib3RoZXIgZm9yIG5vd1xuLy8ge1xuLy8gICBcIm9mZnNldFwiIDogMCxcbi8vICAgXCJyb3dzXCI6IFt7XG4vLyAgICAgXCJpZFwiOiBcImRvYzNcIixcbi8vICAgICBcImtleVwiOiBcIkxpc2EgU2F5c1wiLFxuLy8gICAgIFwidmFsdWVcIjogbnVsbCxcbi8vICAgICBcImRvY1wiOiB7XG4vLyAgICAgICBcIl9pZFwiOiBcImRvYzNcIixcbi8vICAgICAgIFwiX3JldlwiOiBcIjEtelwiLFxuLy8gICAgICAgXCJ0aXRsZVwiOiBcIkxpc2EgU2F5c1wiXG4vLyAgICAgfVxuLy8gICB9XSxcbi8vICAgXCJ0b3RhbF9yb3dzXCIgOiA0XG4vLyB9XG5mdW5jdGlvbiBxdWVyeShpZGIsIHNpZ25hdHVyZSwgb3B0cywgZmFsbGJhY2spIHtcbiAgLy8gQXQgdGhpcyBzdGFnZSwgaW4gdGhlIGN1cnJlbnQgaW1wbGVtZW50YXRpb24sIGZpbmQgaGFzIGFscmVhZHkgZ29uZSB0aHJvdWdoXG4gIC8vIGFuZCBkZXRlcm1pbmVkIGlmIHRoZSBpbmRleCBhbHJlYWR5IGV4aXN0cyBmcm9tIFBvdWNoREIncyBwZXJzcGVjdGl2ZSAoZWdcbiAgLy8gdGhlcmUgaXMgYSBkZXNpZ24gZG9jIGZvciBpdCkuXG4gIC8vXG4gIC8vIElmIHdlIGZpbmQgdGhhdCB0aGUgaW5kZXggZG9lc24ndCBleGlzdCB0aGlzIG1lYW5zIHdlIGhhdmUgdG8gY2xvc2UgYW5kXG4gIC8vIHJlLW9wZW4gdGhlIERCIHRvIGNvcnJlY3QgaW5kZXhlcyBiZWZvcmUgcHJvY2VlZGluZywgYXQgd2hpY2ggcG9pbnQgdGhlXG4gIC8vIGluZGV4IHNob3VsZCBleGlzdC5cblxuICB2YXIgcGRiID0gdGhpcztcblxuICAvLyBBc3N1bXB0aW9uLCB0aGVyZSB3aWxsIGJlIG9ubHkgb25lIC8sIGJldHdlZW4gdGhlIGRlc2lnbiBkb2N1bWVudCBuYW1lXG4gIC8vIGFuZCB0aGUgdmlldyBuYW1lLlxuICB2YXIgcGFydHMgPSBzaWduYXR1cmUuc3BsaXQoJy8nKTtcblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHBkYi5nZXQoJ19kZXNpZ24vJyArIHBhcnRzWzBdKS50aGVuKGZ1bmN0aW9uIChkZG9jKSB7XG4gICAgICBpZiAoaXNQYXJ0aWFsRmlsdGVyVmlldyhkZG9jLCBwYXJ0c1sxXSkpIHtcbiAgICAgICAgLy8gRml4IGZvciAjODUyMlxuICAgICAgICAvLyBBbiBJbmRleGVkREIgaW5kZXggaXMgYWx3YXlzIG92ZXIgYWxsIGVudHJpZXMuIEFuZCB0aGVyZSBpcyBubyB3YXkgdG8gZmlsdGVyIHRoZW0uXG4gICAgICAgIC8vIFRoZXJlZm9yZSB0aGUgbm9ybWFsIGZpbmRBYnN0cmFjdE1hcHBlciB3aWxsIGJlIHVzZWRcbiAgICAgICAgLy8gZm9yIGluZGV4ZXMgd2l0aCBwYXJ0aWFsX2ZpbHRlcl9zZWxlY3Rvci5cbiAgICAgICAgcmV0dXJuIGZhbGxiYWNrKHNpZ25hdHVyZSwgb3B0cykudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfVxuXG4gICAgICB2YXIgZmllbGRzID0gcmF3SW5kZXhGaWVsZHMoZGRvYywgcGFydHNbMV0pO1xuICAgICAgaWYgKCFmaWVsZHMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdkZG9jICcgKyBkZG9jLl9pZCArJyB3aXRoIHZpZXcgJyArIHBhcnRzWzFdICtcbiAgICAgICAgICAnIGRvZXMgbm90IGhhdmUgbWFwLm9wdGlvbnMuZGVmLmZpZWxkcyBkZWZpbmVkLicpO1xuICAgICAgfVxuXG4gICAgICB2YXIgc2tpcCA9IG9wdHMuc2tpcDtcbiAgICAgIHZhciBsaW1pdCA9IE51bWJlci5pc0ludGVnZXIob3B0cy5saW1pdCkgJiYgb3B0cy5saW1pdDtcblxuICAgICAgcmV0dXJuIGdldEluZGV4SGFuZGxlKHBkYiwgZmllbGRzLCByZWplY3QpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uIChpbmRleEhhbmRsZSkge1xuICAgICAgICAgIHZhciBrZXlSYW5nZSA9IGdlbmVyYXRlS2V5UmFuZ2Uob3B0cyk7XG4gICAgICAgICAgdmFyIHJlcSA9IGluZGV4SGFuZGxlLm9wZW5DdXJzb3Ioa2V5UmFuZ2UsIG9wdHMuZGVzY2VuZGluZyA/ICdwcmV2JyA6ICduZXh0Jyk7XG5cbiAgICAgICAgICB2YXIgcm93cyA9IFtdO1xuICAgICAgICAgIHJlcS5vbmVycm9yID0gaWRiRXJyb3IocmVqZWN0KTtcbiAgICAgICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG5cbiAgICAgICAgICAgIGlmICghY3Vyc29yIHx8IGxpbWl0ID09PSAwKSB7XG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHtcbiAgICAgICAgICAgICAgICByb3dzOiByb3dzXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2tpcCkge1xuICAgICAgICAgICAgICBjdXJzb3IuYWR2YW5jZShza2lwKTtcbiAgICAgICAgICAgICAgc2tpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsaW1pdCkge1xuICAgICAgICAgICAgICBsaW1pdCA9IGxpbWl0IC0gMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcm93cy5wdXNoKHtkb2M6IGV4dGVybmFsaXNlUmVjb3JkKGN1cnNvci52YWx1ZSl9KTtcbiAgICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChyZWplY3QpO1xuICB9KTtcblxufVxuXG5mdW5jdGlvbiB2aWV3Q2xlYW51cChpZGIsIGZhbGxiYWNrKSB7XG4gIC8vIEknbSBub3Qgc3VyZSB3ZSBoYXZlIHRvIGRvIGFueXRoaW5nIGhlcmUuXG4gIC8vXG4gIC8vIE9uZSBvcHRpb24gaXMgdG8ganVzdCBjbG9zZSBhbmQgcmUtb3BlbiB0aGUgREIsIHdoaWNoIHBlcmZvcm1zIHRoZSBzYW1lXG4gIC8vIGFjdGlvbi4gVGhlIG9ubHkgcmVhc29uIHlvdSdkIHdhbnQgdG8gY2FsbCB0aGlzIGlzIGlmIHlvdSBkZWxldGVkIGEgYnVuY2hcbiAgLy8gb2YgaW5kZXhlcyBhbmQgd2FudGVkIHRoZSBzcGFjZSBiYWNrIGltbWVkaWF0ZWx5LlxuICAvL1xuICAvLyBPdGhlcndpc2UgaW5kZXggY2xlYW51cCBoYXBwZW5zIHdoZW46XG4gIC8vICAtIEEgREIgaXMgb3BlbmVkXG4gIC8vICAtIEEgZmluZCBxdWVyeSBpcyBwZXJmb3JtZWQgYWdhaW5zdCBhbiBpbmRleCB0aGF0IGRvZXNuJ3QgZXhpc3QgYnV0IHNob3VsZFxuXG4gIC8vIEZpeCBmb3IgIzg1MjJcbiAgLy8gT24gdmlld3Mgd2l0aCBwYXJ0aWFsX2ZpbHRlcl9zZWxlY3RvciB0aGUgc3RhbmRhcmQgZmluZC1hYnN0cmFjdC1tYXBwZXIgaXMgdXNlZC5cbiAgLy8gSXRzIGluZGV4ZXMgbXVzdCBiZSBjbGVhbmVkIHVwLlxuICAvLyBGYWxsYmFjayBpcyB0aGUgc3RhbmRhcmQgdmlld0NsZWFudXAuXG4gIHJldHVybiBmYWxsYmFjaygpO1xufVxuXG5leHBvcnQgeyBxdWVyeSwgdmlld0NsZWFudXAgfTtcbiIsImltcG9ydCB7IERPQ19TVE9SRSB9IGZyb20gXCIuLi8uLi9wb3VjaGRiLWFkYXB0ZXItaW5kZXhlZGRiL3NyYy91dGlsLmpzXCI7XG5pbXBvcnQgeyByZW1vdmVMZWFmRnJvbVRyZWUsIHdpbm5pbmdSZXYgfSBmcm9tIFwicG91Y2hkYi1tZXJnZVwiO1xuXG5mdW5jdGlvbiBwdXJnZUF0dGFjaG1lbnRzKGRvYywgcmV2cykge1xuICBpZiAoIWRvYy5hdHRhY2htZW50cykge1xuICAgIC8vIElmIHRoZXJlIGFyZSBubyBhdHRhY2htZW50cywgZG9jLmF0dGFjaG1lbnRzIGlzIGFuIGVtcHR5IG9iamVjdFxuICAgIHJldHVybiB7fTtcbiAgfVxuXG4gIC8vIEl0ZXJhdGUgb3ZlciBhbGwgYXR0YWNobWVudHMgYW5kIHJlbW92ZSB0aGUgcmVzcGVjdGl2ZSByZXZzXG4gIGZvciAobGV0IGtleSBpbiBkb2MuYXR0YWNobWVudHMpIHtcbiAgICBjb25zdCBhdHRhY2htZW50ID0gZG9jLmF0dGFjaG1lbnRzW2tleV07XG5cbiAgICBmb3IgKGxldCByZXYgb2YgcmV2cykge1xuICAgICAgaWYgKGF0dGFjaG1lbnQucmV2c1tyZXZdKSB7XG4gICAgICAgIGRlbGV0ZSBhdHRhY2htZW50LnJldnNbcmV2XTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoT2JqZWN0LmtleXMoYXR0YWNobWVudC5yZXZzKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSBkb2MuYXR0YWNobWVudHNba2V5XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZG9jLmF0dGFjaG1lbnRzO1xufVxuXG4vLyBgcHVyZ2UoKWAgZXhwZWN0cyBhIHBhdGggb2YgcmV2aXNpb25zIGluIGl0cyByZXZzIGFyZ3VtZW50IHRoYXQ6XG4vLyAtIHN0YXJ0cyB3aXRoIGEgbGVhZiByZXZcbi8vIC0gY29udGludWVzIHNlcXVlbnRpYWxseSB3aXRoIHRoZSByZW1haW5pbmcgcmV2cyBvZiB0aGF0IGxlYWbigJlzIGJyYW5jaFxuLy9cbi8vIGVnLiBmb3IgdGhpcyByZXYgdHJlZTpcbi8vIDEtOTY5MiDilrYgMi0zN2FhIOKWtiAzLWRmMjIg4pa2IDQtNmU5NCDilrYgNS1kZjRhIOKWtiA2LTZhM2Eg4pa2IDctNTdlNVxuLy8gICAgICAgICAg4pSDICAgICAgICAgICAgICAgICDilJfilIHilIHilIHilIHilIHilIHilrYgNS04ZDhjIOKWtiA2LTY1ZTBcbi8vICAgICAgICAgIOKUl+KUgeKUgeKUgeKUgeKUgeKUgeKWtiAzLTQzZjYg4pa2IDQtYTNiNFxuLy9cbi8vIOKApmlmIHlvdSB3YW50ZWQgdG8gcHVyZ2UgJzctNTdlNScsIHlvdSB3b3VsZCBwcm92aWRlIFsnNy01N2U1JywgJzYtNmEzYScsICc1LWRmNGEnXVxuLy9cbi8vIFRoZSBwdXJnZSBhZGFwdGVyIGltcGxlbWVudGF0aW9uIGluIGBwb3VjaGRiLWNvcmVgIHVzZXMgdGhlIGhlbHBlciBmdW5jdGlvbiBgZmluZFBhdGhUb0xlYWZgXG4vLyBmcm9tIGBwb3VjaGRiLW1lcmdlYCB0byBjb25zdHJ1Y3QgdGhpcyBhcnJheSBjb3JyZWN0bHkuIFNpbmNlIHRoaXMgcHVyZ2UgaW1wbGVtZW50YXRpb24gaXNcbi8vIG9ubHkgZXZlciBjYWxsZWQgZnJvbSB0aGVyZSwgd2UgZG8gbm8gYWRkaXRpb25hbCBjaGVja3MgaGVyZSBhcyB0byB3aGV0aGVyIGByZXZzYCBhY3R1YWxseVxuLy8gZnVsZmlsbHMgdGhlIGNyaXRlcmlhIGFib3ZlLCBzaW5jZSBgZmluZFBhdGhUb0xlYWZgIGFscmVhZHkgZG9lcyB0aGVzZS5cbmZ1bmN0aW9uIHB1cmdlKHR4biwgZG9jSWQsIHJldnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eG4uZXJyb3IpIHtcbiAgICByZXR1cm4gY2FsbGJhY2sodHhuLmVycm9yKTtcbiAgfVxuXG4gIGNvbnN0IGRvY1N0b3JlID0gdHhuLnR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpO1xuICBjb25zdCBkZWxldGVkUmV2cyA9IFtdO1xuICBsZXQgZG9jdW1lbnRXYXNSZW1vdmVkQ29tcGxldGVseSA9IGZhbHNlO1xuICBkb2NTdG9yZS5nZXQoZG9jSWQpLm9uc3VjY2VzcyA9IChlKSA9PiB7XG4gICAgY29uc3QgZG9jID0gZS50YXJnZXQucmVzdWx0O1xuXG4gICAgLy8gd2UgY291bGQgZG8gYSBkcnkgcnVuIGhlcmUgdG8gY2hlY2sgaWYgcmV2cyBpcyBhIHByb3BlciBwYXRoIHRvd2FyZHMgYSBsZWFmIGluIHRoZSByZXYgdHJlZVxuXG4gICAgZm9yIChjb25zdCByZXYgb2YgcmV2cykge1xuICAgICAgLy8gcHVyZ2UgcmV2IGZyb20gdHJlZVxuICAgICAgZG9jLnJldl90cmVlID0gcmVtb3ZlTGVhZkZyb21UcmVlKGRvYy5yZXZfdHJlZSwgcmV2KTtcblxuICAgICAgLy8gYXNzaWduIG5ldyByZXZzXG4gICAgICBkZWxldGUgZG9jLnJldnNbcmV2XTtcbiAgICAgIGRlbGV0ZWRSZXZzLnB1c2gocmV2KTtcbiAgICB9XG5cbiAgICBpZiAoZG9jLnJldl90cmVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gaWYgdGhlIHJldiB0cmVlIGlzIGVtcHR5LCB3ZSBjYW4gZGVsZXRlIHRoZSBlbnRpcmUgZG9jdW1lbnRcbiAgICAgIGRvY1N0b3JlLmRlbGV0ZShkb2MuaWQpO1xuICAgICAgZG9jdW1lbnRXYXNSZW1vdmVkQ29tcGxldGVseSA9IHRydWU7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gZmluZCBuZXcgd2lubmluZyByZXZcbiAgICBkb2MucmV2ID0gd2lubmluZ1Jldihkb2MpO1xuICAgIGRvYy5kYXRhID0gZG9jLnJldnNbZG9jLnJldl0uZGF0YTtcbiAgICBkb2MuYXR0YWNobWVudHMgPSBwdXJnZUF0dGFjaG1lbnRzKGRvYywgcmV2cyk7XG5cbiAgICAvLyBmaW5hbGx5LCB3cml0ZSB0aGUgcHVyZ2VkIGRvY1xuICAgIGRvY1N0b3JlLnB1dChkb2MpO1xuICB9O1xuXG4gIHR4bi50eG4ub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICBvazogdHJ1ZSxcbiAgICAgIGRlbGV0ZWRSZXZzLFxuICAgICAgZG9jdW1lbnRXYXNSZW1vdmVkQ29tcGxldGVseVxuICAgIH0pO1xuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBwdXJnZTtcbiIsIi8vICd1c2Ugc3RyaWN0JzsgaXMgZGVmYXVsdCB3aGVuIEVTTVxuaW1wb3J0IHsgY2hhbmdlc0hhbmRsZXIgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuaW1wb3J0IHNldHVwIGZyb20gJy4vc2V0dXAnO1xuXG4vLyBBUEkgaW1wbGVtZW50YXRpb25zXG5pbXBvcnQgaW5mbyBmcm9tICcuL2luZm8nO1xuaW1wb3J0IGdldCBmcm9tICcuL2dldCc7XG5pbXBvcnQgeyBnZXRBdHRhY2htZW50IH0gZnJvbSAnLi9nZXRBdHRhY2htZW50JztcbmltcG9ydCBidWxrRG9jcyBmcm9tICcuL2J1bGtEb2NzJztcbmltcG9ydCBhbGxEb2NzIGZyb20gJy4vYWxsRG9jcyc7XG5pbXBvcnQgY2hhbmdlcyBmcm9tICcuL2NoYW5nZXMnO1xuaW1wb3J0IGdldFJldmlzaW9uVHJlZSBmcm9tICcuL2dldFJldmlzaW9uVHJlZSc7XG5pbXBvcnQgZG9Db21wYWN0aW9uIGZyb20gJy4vZG9Db21wYWN0aW9uJztcbmltcG9ydCBkZXN0cm95IGZyb20gJy4vZGVzdHJveSc7XG5pbXBvcnQge3F1ZXJ5LCB2aWV3Q2xlYW51cH0gZnJvbSAnLi9maW5kJztcbmltcG9ydCBwdXJnZSBmcm9tICcuL3B1cmdlJztcblxuaW1wb3J0IHsgRE9DX1NUT1JFIH0gZnJvbSAnLi91dGlsLmpzJztcblxudmFyIEFEQVBURVJfTkFNRSA9ICdpbmRleGVkZGInO1xuXG4vLyBUT0RPOiBDb25zdHJ1Y3RvciBzaG91bGQgYmUgY2FwaXRhbGlzZWRcbnZhciBpZGJDaGFuZ2VzID0gbmV3IGNoYW5nZXNIYW5kbGVyKCk7XG5cbi8vIEEgc2hhcmVkIGxpc3Qgb2YgZGF0YWJhc2UgaGFuZGxlc1xudmFyIG9wZW5EYXRhYmFzZXMgPSB7fTtcblxuZnVuY3Rpb24gSWRiUG91Y2goZGJPcHRzLCBjYWxsYmFjaykge1xuXG4gIGlmIChkYk9wdHMudmlld19hZGFwdGVyKSB7XG4gICAgY29uc29sZS5sb2coJ1BsZWFzZSBub3RlIHRoYXQgdGhlIGluZGV4ZWRkYiBhZGFwdGVyIG1hbmFnZXMgX2ZpbmQgaW5kZXhlcyBpdHNlbGYsIHRoZXJlZm9yZSBpdCBpcyBub3QgdXNpbmcgeW91ciBzcGVjaWZpZWQgdmlld19hZGFwdGVyJyk7XG4gIH1cbiAgXG4gIHZhciBhcGkgPSB0aGlzO1xuICB2YXIgbWV0YWRhdGEgPSB7fTtcblxuICAvLyBXcmFwcGVyIHRoYXQgZ2l2ZXMgeW91IGFuIGFjdGl2ZSBEQiBoYW5kbGUuIFlvdSBwcm9iYWJseSB3YW50ICR0LlxuICB2YXIgJCA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgc2V0dXAob3BlbkRhdGFiYXNlcywgYXBpLCBkYk9wdHMpLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgICAgICBtZXRhZGF0YSA9IHJlcy5tZXRhZGF0YTtcbiAgICAgICAgYXJncy51bnNoaWZ0KHJlcy5pZGIpO1xuICAgICAgICBmdW4uYXBwbHkoYXBpLCBhcmdzKTtcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgdmFyIGxhc3QgPSBhcmdzLnBvcCgpO1xuICAgICAgICBpZiAodHlwZW9mIGxhc3QgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBsYXN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuICB9O1xuICAvLyB0aGUgcHJvbWlzZSB2ZXJzaW9uIG9mICRcbiAgdmFyICRwID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgIHJldHVybiBzZXR1cChvcGVuRGF0YWJhc2VzLCBhcGksIGRiT3B0cykudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgIG1ldGFkYXRhID0gcmVzLm1ldGFkYXRhO1xuICAgICAgICBhcmdzLnVuc2hpZnQocmVzLmlkYik7XG5cbiAgICAgICAgcmV0dXJuIGZ1bi5hcHBseShhcGksIGFyZ3MpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfTtcbiAgLy8gV3JhcHBlciB0aGF0IGdpdmVzIHlvdSBhIHNhZmUgdHJhbnNhY3Rpb24gaGFuZGxlLiBJdCdzIGltcG9ydGFudCB0byB1c2VcbiAgLy8gdGhpcyBpbnN0ZWFkIG9mIG9wZW5pbmcgeW91ciBvd24gdHJhbnNhY3Rpb24gZnJvbSBhIGRiIGhhbmRsZSBnb3QgZnJvbSAkLFxuICAvLyBiZWNhdXNlIGluIHRoZSB0aW1lIGJldHdlZW4gZ2V0dGluZyB0aGUgZGIgaGFuZGxlIGFuZCBvcGVuaW5nIHRoZVxuICAvLyB0cmFuc2FjdGlvbiBpdCBtYXkgaGF2ZSBiZWVuIGludmFsaWRhdGVkIGJ5IGluZGV4IGNoYW5nZXMuXG4gIHZhciAkdCA9IGZ1bmN0aW9uIChmdW4sIHN0b3JlcywgbW9kZSkge1xuICAgIHN0b3JlcyA9IHN0b3JlcyB8fCBbRE9DX1NUT1JFXTtcbiAgICBtb2RlID0gbW9kZSB8fCAncmVhZG9ubHknO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIHZhciB0eG4gPSB7fTtcbiAgICAgIHNldHVwKG9wZW5EYXRhYmFzZXMsIGFwaSwgZGJPcHRzKS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgbWV0YWRhdGEgPSByZXMubWV0YWRhdGE7XG4gICAgICAgIHR4bi50eG4gPSByZXMuaWRiLnRyYW5zYWN0aW9uKHN0b3JlcywgbW9kZSk7XG4gICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBlc3RhYmxpc2ggdHJhbnNhY3Rpb24gc2FmZWx5Jyk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgdHhuLmVycm9yID0gZXJyO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGFyZ3MudW5zaGlmdCh0eG4pO1xuICAgICAgICBmdW4uYXBwbHkoYXBpLCBhcmdzKTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH07XG5cbiAgYXBpLl9vcGVuVHJhbnNhY3Rpb25TYWZlbHkgPSBmdW5jdGlvbiAoc3RvcmVzLCBtb2RlLCBjYWxsYmFjaykge1xuICAgICR0KGZ1bmN0aW9uICh0eG4sIGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayh0eG4uZXJyb3IsIHR4bi50eG4pO1xuICAgIH0sIHN0b3JlcywgbW9kZSkoY2FsbGJhY2spO1xuICB9O1xuXG4gIGFwaS5fcmVtb3RlID0gZmFsc2U7XG4gIGFwaS50eXBlID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gQURBUFRFUl9OQU1FOyB9O1xuXG4gIGFwaS5faWQgPSAkKGZ1bmN0aW9uIChfLCBjYikge1xuICAgIGNiKG51bGwsIG1ldGFkYXRhLmRiX3V1aWQpO1xuICB9KTtcblxuICBhcGkuX2luZm8gPSAkKGZ1bmN0aW9uIChfLCBjYikge1xuICAgIHJldHVybiBpbmZvKG1ldGFkYXRhLCBjYik7XG4gIH0pO1xuXG4gIGFwaS5fZ2V0ID0gJHQoZ2V0KTtcblxuICBhcGkuX2J1bGtEb2NzID0gJChmdW5jdGlvbiAoXywgcmVxLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIGJ1bGtEb2NzKGFwaSwgcmVxLCBvcHRzLCBtZXRhZGF0YSwgZGJPcHRzLCBpZGJDaGFuZ2VzLCBjYWxsYmFjayk7XG4gIH0pO1xuXG4gIGFwaS5fYWxsRG9jcyA9ICR0KGZ1bmN0aW9uICh0eG4sIG9wdHMsIGNiKSB7XG4gICAgYWxsRG9jcyh0eG4sIG1ldGFkYXRhLCBvcHRzLCBjYik7XG4gIH0pO1xuXG4gIGFwaS5fZ2V0QXR0YWNobWVudCA9ICR0KGdldEF0dGFjaG1lbnQpO1xuXG4gIGFwaS5fY2hhbmdlcyA9ICR0KGZ1bmN0aW9uICh0eG4sIG9wdHMpIHtcbiAgICBjaGFuZ2VzKHR4biwgaWRiQ2hhbmdlcywgYXBpLCBkYk9wdHMsIG9wdHMpO1xuICB9KTtcblxuICBhcGkuX2dldFJldmlzaW9uVHJlZSA9ICR0KGdldFJldmlzaW9uVHJlZSk7XG4gIGFwaS5fZG9Db21wYWN0aW9uID0gJHQoZG9Db21wYWN0aW9uLCBbRE9DX1NUT1JFXSwgJ3JlYWR3cml0ZScpO1xuXG4gIGFwaS5fY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyID0ge1xuICAgIHF1ZXJ5OiAkcChxdWVyeSksXG4gICAgdmlld0NsZWFudXA6ICRwKHZpZXdDbGVhbnVwKVxuICB9O1xuXG4gIGFwaS5fZGVzdHJveSA9IGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgIHJldHVybiBkZXN0cm95KGRiT3B0cywgb3BlbkRhdGFiYXNlcywgaWRiQ2hhbmdlcywgY2FsbGJhY2spO1xuICB9O1xuXG4gIGFwaS5fY2xvc2UgPSAkKGZ1bmN0aW9uIChkYiwgY2IpIHtcbiAgICBkZWxldGUgb3BlbkRhdGFiYXNlc1tkYk9wdHMubmFtZV07XG4gICAgZGIuY2xvc2UoKTtcbiAgICBjYigpO1xuICB9KTtcblxuICAvLyBDbG9zaW5nIGFuZCByZS1vcGVuaW5nIHRoZSBEQiByZS1nZW5lcmF0ZXMgbmF0aXZlIGluZGV4ZXNcbiAgYXBpLl9mcmVzaGVuID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgICAgYXBpLl9jbG9zZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICQocmVzb2x2ZSkoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIGFwaS5fcHVyZ2UgPSAkdChwdXJnZSwgW0RPQ19TVE9SRV0sICdyZWFkd3JpdGUnKTtcblxuICAvLyBUT0RPOiB0aGlzIHNldFRpbWVvdXQgc2VlbXMgbmFzdHksIGlmIGl0cyBuZWVkZWQgbGV0c1xuICAvLyBmaWd1cmUgb3V0IC8gZXhwbGFpbiB3aHlcbiAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgYXBpKTtcbiAgfSk7XG59XG5cbi8vIFRPRE86IHRoaXMgaXNudCByZWFsbHkgdmFsaWQgcGVybWFuZW50bHksIGp1c3QgYmVpbmcgbGF6eSB0byBzdGFydFxuSWRiUG91Y2gudmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKFBvdWNoREIpIHtcbiAgUG91Y2hEQi5hZGFwdGVyKEFEQVBURVJfTkFNRSwgSWRiUG91Y2gsIHRydWUpO1xufVxuIl0sIm5hbWVzIjpbImdldExhdGVzdCIsIndpbm5pbmdSZXYiLCJjYWxjdWxhdGVXaW5uaW5nUmV2IiwiYmluU3RyaW5nVG9CbG9iT3JCdWZmZXIiLCJtZDUiLCJyZW1vdmVMZWFmRnJvbVRyZWUiLCJjaGFuZ2VzSGFuZGxlciJdLCJtYXBwaW5ncyI6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
