'use strict';

var utils = require('../utils');
var merge = require('../merge');
var errors = require('../deps/errors');
function quote(str) {
  return "'" + str + "'";
}

var cachedDatabases = {};

var openDB = utils.getArguments(function (args) {
  if (typeof global !== 'undefined') {
    if (global.navigator && global.navigator.sqlitePlugin &&
        global.navigator.sqlitePlugin.openDatabase) {
      return navigator.sqlitePlugin.openDatabase
        .apply(navigator.sqlitePlugin, args);
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return global.sqlitePlugin.openDatabase
        .apply(global.sqlitePlugin, args);
    } else {
      var db = cachedDatabases[args[0]];
      if (!db) {
        db = cachedDatabases[args[0]] =
          global.openDatabase.apply(global, args);
      }
      return db;
    }
  }
});

var POUCH_VERSION = 1;
var POUCH_SIZE = 0; // doesn't matter as long as it's <= 5000000
var ADAPTER_VERSION = 2; // used to manage migrations

// The object stores created for each database
// DOC_STORE stores the document meta data, its revision history and state
var DOC_STORE = quote('document-store');
// BY_SEQ_STORE stores a particular version of a document, keyed by its
// sequence id
var BY_SEQ_STORE = quote('by-sequence');
// Where we store attachments
var ATTACH_STORE = quote('attach-store');
var META_STORE = quote('metadata-store');

// these indexes cover the ground for most allDocs queries
var BY_SEQ_STORE_DELETED_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'by-seq-deleted-idx\' ON ' +
  BY_SEQ_STORE + ' (seq, deleted)';
var DOC_STORE_LOCAL_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'doc-store-local-idx\' ON ' +
  DOC_STORE + ' (local, id)';
var DOC_STORE_WINNINGSEQ_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'doc-winningseq-idx\' ON ' +
  DOC_STORE + ' (winningseq)';

var DOC_STORE_AND_BY_SEQ_JOINER = BY_SEQ_STORE +
  '.seq = ' + DOC_STORE + '.winningseq';

var SELECT_DOCS = BY_SEQ_STORE + '.seq AS seq, ' +
  BY_SEQ_STORE + '.deleted AS deleted, ' +
  BY_SEQ_STORE + '.json AS data, ' +
  DOC_STORE + '.json AS metadata';

function select(selector, table, joiner, where, orderBy) {
  return 'SELECT ' + selector + ' FROM ' +
    (typeof table === 'string' ? table : table.join(' JOIN ')) +
    (joiner ? (' ON ' + joiner) : '') +
    (where ? (' WHERE ' +
      (typeof where === 'string' ? where : where.join(' AND '))) : '') +
    (orderBy ? (' ORDER BY ' + orderBy) : '');
}

function unknownError(callback) {
  return function (event) {
    // event may actually be a SQLError object, so report is as such
    var errorNameMatch = event && event.constructor.toString()
      .match(/function ([^\(]+)/);
    var errorName = (errorNameMatch && errorNameMatch[1]) || event.type;
    var errorReason = event.target || event.message;
    callback(errors.error(errors.WSQ_ERROR, errorReason, errorName));
  };
}
function decodeUtf8(str) {
  return decodeURIComponent(window.escape(str));
}
function parseHexString(str, encoding) {
  var result = '';
  var charWidth = encoding === 'UTF-8' ? 2 : 4;
  for (var i = 0, len = str.length; i < len; i += charWidth) {
    var substring = str.substring(i, i + charWidth);
    if (charWidth === 4) { // UTF-16, twiddle the bits
      substring = substring.substring(2, 4) + substring.substring(0, 2);
    }
    result += String.fromCharCode(parseInt(substring, 16));
  }
  result = encoding === 'UTF-8' ? decodeUtf8(result) : result;
  return result;
}

function WebSqlPouch(opts, callback) {
  var api = this;
  var instanceId = null;
  var name = opts.name;
  var idRequests = [];
  var docCount = -1; // cache sqlite count(*) for performance
  var encoding;

  var db = openDB(name, POUCH_VERSION, name, POUCH_SIZE);
  if (!db) {
    return callback(errors.UNKNOWN_ERROR);
  } else if (typeof db.readTransaction !== 'function') {
    // doesn't exist in sqlite plugin
    db.readTransaction = db.transaction;
  }

  function dbCreated() {
    // note the db name in case the browser upgrades to idb
    if (utils.hasLocalStorage()) {
      global.localStorage['_pouch__websqldb_' + name] = true;
    }
    callback(null, api);
  }

  // In this migration, we added the 'deleted' and 'local' columns to the
  // by-seq and doc store tables.
  // To preserve existing user data, we re-process all the existing JSON
  // and add these values.
  // Called migration2 because it corresponds to adapter version (db_version) #2
  function runMigration2(tx) {
    // index used for the join in the allDocs query
    tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);

    tx.executeSql('ALTER TABLE ' + BY_SEQ_STORE +
      ' ADD COLUMN deleted TINYINT(1) DEFAULT 0', [], function () {
      tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
      tx.executeSql('ALTER TABLE ' + DOC_STORE +
        ' ADD COLUMN local TINYINT(1) DEFAULT 0', [], function () {
        tx.executeSql(DOC_STORE_LOCAL_INDEX_SQL);

        var sql = 'SELECT ' + DOC_STORE + '.winningseq AS seq, ' + DOC_STORE +
          '.json AS metadata FROM ' + BY_SEQ_STORE + ' JOIN ' + DOC_STORE +
          ' ON ' + BY_SEQ_STORE + '.seq = ' + DOC_STORE + '.winningseq';

        tx.executeSql(sql, [], function (tx, result) {

          var deleted = [];
          var local = [];

          for (var i = 0; i < result.rows.length; i++) {
            var item = result.rows.item(i);
            var seq = item.seq;
            var metadata = JSON.parse(item.metadata);
            if (utils.isDeleted(metadata)) {
              deleted.push(seq);
            }
            if (utils.isLocalId(metadata.id)) {
              local.push(metadata.id);
            }
          }

          tx.executeSql('UPDATE ' + DOC_STORE + 'SET local = 1 WHERE id IN (' +
            local.map(function () {
            return '?';
          }).join(',') + ')', local);
          tx.executeSql('UPDATE ' + BY_SEQ_STORE +
            ' SET deleted = 1 WHERE seq IN (' + deleted.map(function () {
            return '?';
          }).join(',') + ')', deleted);
        });
      });
    });
  }

  function onGetInstanceId(tx) {
    while (idRequests.length > 0) {
      var idCallback = idRequests.pop();
      idCallback(null, instanceId);
    }
    checkDbEncoding(tx);
  }

  function checkDbEncoding(tx) {
    // check db encoding - utf-8 (chrome, opera) or utf-16 (safari)?
    tx.executeSql('SELECT dbid, hex(dbid) AS hexId FROM ' + META_STORE, [],
      function (err, result) {
        var id = result.rows.item(0).dbid;
        var hexId = result.rows.item(0).hexId;
        encoding = (hexId.length === id.length * 2) ? 'UTF-8' : 'UTF-16';
      }
    );
  }

  function onGetVersion(tx, dbVersion) {
    if (dbVersion === 0) {
      // initial schema

      var meta = 'CREATE TABLE IF NOT EXISTS ' + META_STORE +
        ' (update_seq, dbid, db_version INTEGER)';
      var attach = 'CREATE TABLE IF NOT EXISTS ' + ATTACH_STORE +
        ' (digest, json, body BLOB)';
      var doc = 'CREATE TABLE IF NOT EXISTS ' + DOC_STORE +
        ' (id unique, json, winningseq, local TINYINT(1))';
      var seq = 'CREATE TABLE IF NOT EXISTS ' + BY_SEQ_STORE +
        ' (seq INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, ' +
        'doc_id_rev UNIQUE, json, deleted TINYINT(1))';

      // creates
      tx.executeSql(attach);
      tx.executeSql(doc, [], function () {
        tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);
        tx.executeSql(DOC_STORE_LOCAL_INDEX_SQL);
      });
      tx.executeSql(seq, [], function () {
        tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
      });
      tx.executeSql(meta, [], function () {
        // mark the update_seq, db version, and new dbid
        var initSeq = 'INSERT INTO ' + META_STORE +
          ' (update_seq, db_version, dbid) VALUES (?, ?, ?)';
        instanceId = utils.uuid();
        tx.executeSql(initSeq, [0, ADAPTER_VERSION, instanceId]);
        onGetInstanceId(tx);
      });
    } else { // version > 0

      if (dbVersion === 1) {
        runMigration2(tx);
        // mark the db version within this transaction
        tx.executeSql('UPDATE ' + META_STORE + ' SET db_version = ' +
                      ADAPTER_VERSION);
      } // in the future, add more migrations here

      // notify db.id() callers
      tx.executeSql('SELECT dbid FROM ' + META_STORE, [],
                    function (tx, result) {
        instanceId = result.rows.item(0).dbid;
        onGetInstanceId(tx);
      });
    }
  }

  function setup() {

    db.transaction(function (tx) {
      // first get the version
      tx.executeSql('SELECT sql FROM sqlite_master WHERE tbl_name = ' +
                    META_STORE, [], function (tx, result) {
        if (!result.rows.length) {
          // database hasn't even been created yet (version 0)
          onGetVersion(tx, 0);
        } else if (!/db_version/.test(result.rows.item(0).sql)) {
          // table was created, but without the new db_version column,
          // so add it.
          tx.executeSql('ALTER TABLE ' + META_STORE +
            ' ADD COLUMN db_version INTEGER', [], function () {
            // before version 2, this column didn't even exist
            onGetVersion(tx, 1);
          });
        } else { // column exists, we can safely get it
          tx.executeSql('SELECT db_version FROM ' + META_STORE, [],
            function (tx, result) {
            var dbVersion = result.rows.item(0).db_version;
            onGetVersion(tx, dbVersion);
          });
        }
      });
    }, unknownError(callback), dbCreated);
  }

  if (utils.isCordova() && typeof global !== 'undefined') {
    //to wait until custom api is made in pouch.adapters before doing setup
    global.addEventListener(name + '_pouch', function cordova_init() {
      global.removeEventListener(name + '_pouch', cordova_init, false);
      setup();
    }, false);
  } else {
    setup();
  }

  api.type = function () {
    return 'websql';
  };

  api._id = utils.toPromise(function (callback) {
    callback(null, instanceId);
  });

  api._info = function (callback) {
    db.readTransaction(function (tx) {
      countDocs(tx, function (docCount) {
        var sql = 'SELECT update_seq FROM ' + META_STORE;
        tx.executeSql(sql, [], function (tx, result) {
          var updateSeq = result.rows.item(0).update_seq;
          callback(null, {
            db_name: name,
            doc_count: docCount,
            update_seq: updateSeq
          });
        });
      });
    }, unknownError(callback));
  };

  api._bulkDocs = function (req, opts, callback) {

    var newEdits = opts.new_edits;
    var userDocs = req.docs;
    var docsWritten = 0;

    // Parse the docs, give them a sequence number for the result
    var docInfos = userDocs.map(function (doc, i) {
      var newDoc = utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      return newDoc;
    });

    var docInfoErrors = docInfos.filter(function (docInfo) {
      return docInfo.error;
    });
    if (docInfoErrors.length) {
      return callback(docInfoErrors[0]);
    }

    var tx;
    var results = [];
    var fetchedDocs = {};

    function sortByBulkSeq(a, b) {
      return a._bulk_seq - b._bulk_seq;
    }

    function complete(event) {
      var aresults = [];
      results.sort(sortByBulkSeq);
      results.forEach(function (result) {
        delete result._bulk_seq;
        if (result.error) {
          aresults.push(result);
          return;
        }
        var metadata = result.metadata;
        var rev = merge.winningRev(metadata);

        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev
        });

        if (utils.isLocalId(metadata.id)) {
          return;
        }

        docsWritten++;

      });
      WebSqlPouch.Changes.notify(name);

      var updateseq = 'SELECT update_seq FROM ' + META_STORE;
      tx.executeSql(updateseq, [], function (tx, result) {
        var update_seq = result.rows.item(0).update_seq + docsWritten;
        var sql = 'UPDATE ' + META_STORE + ' SET update_seq=?';
        tx.executeSql(sql, [update_seq], function () {
          callback(null, aresults);
        });
      });
    }

    function preprocessAttachment(att, finish) {
      if (att.stub) {
        return finish();
      }
      if (typeof att.data === 'string') {
        try {
          att.data = atob(att.data);
        } catch (e) {
          var err = errors.error(errors.BAD_ARG,
                                "Attachments need to be base64 encoded");
          return callback(err);
        }
        var data = utils.fixBinary(att.data);
        att.data = utils.createBlob([data], {type: att.content_type});
      }
      var reader = new FileReader();
      reader.onloadend = function (e) {
        var binary = utils.arrayBufferToBinaryString(this.result);
        att.data = binary;
        att.digest = 'md5-' + utils.MD5(binary);
        finish();
      };
      reader.readAsArrayBuffer(att.data);
    }

    function preprocessAttachments(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var docv = 0;

      docInfos.forEach(function (docInfo) {
        var attachments = docInfo.data && docInfo.data._attachments ?
          Object.keys(docInfo.data._attachments) : [];
        var recv = 0;

        if (!attachments.length) {
          return done();
        }

        function processedAttachment() {
          recv++;
          if (recv === attachments.length) {
            done();
          }
        }

        for (var key in docInfo.data._attachments) {
          if (docInfo.data._attachments.hasOwnProperty(key)) {
            preprocessAttachment(docInfo.data._attachments[key],
                                 processedAttachment);
          }
        }
      });

      function done() {
        docv++;
        if (docInfos.length === docv) {
          callback();
        }
      }
    }

    function writeDoc(docInfo, winningRev, deleted, callback, isUpdate) {

      function finish() {
        var data = docInfo.data;
        var doc_id_rev = data._id + "::" + data._rev;
        var deletedInt = deleted ? 1 : 0;
        var fetchSql = select('seq', BY_SEQ_STORE, null, 'doc_id_rev=?');

        tx.executeSql(fetchSql, [doc_id_rev], function (err, res) {
          var sql, sqlArgs;
          if (res.rows.length) {
            sql = 'UPDATE ' + BY_SEQ_STORE +
              ' SET json=?, deleted=? WHERE doc_id_rev=?;';
            sqlArgs = [JSON.stringify(data), deletedInt, doc_id_rev];
            tx.executeSql(sql, sqlArgs, function (tx) {
              dataWritten(tx, res.rows.item(0).seq);
            });
          } else {
            sql = 'INSERT INTO ' + BY_SEQ_STORE +
              ' (doc_id_rev, json, deleted) VALUES (?, ?, ?);';
            sqlArgs = [doc_id_rev, JSON.stringify(data), deletedInt];
            tx.executeSql(sql, sqlArgs, function (tx, result) {
              dataWritten(tx, result.insertId);
            });
          }
        });
      }

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            callback(err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      var err = null;
      var recv = 0;

      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      if (deleted) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      function attachmentSaved(err) {
        recv++;
        collectResults(err);
      }

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          delete docInfo.data._attachments[key].data;
          var digest = docInfo.data._attachments[key].digest;
          saveAttachment(docInfo, digest, data, attachmentSaved);
        } else {
          recv++;
          collectResults();
        }
      }

      if (!attachments.length) {
        finish();
      }

      function dataWritten(tx, seq) {
        docInfo.metadata.seq = seq;
        delete docInfo.metadata.rev;

        var sql = isUpdate ?
          'UPDATE ' + DOC_STORE +
          ' SET json=?, winningseq=(SELECT seq FROM ' + BY_SEQ_STORE +
          ' WHERE doc_id_rev=?) WHERE id=?'
          : 'INSERT INTO ' + DOC_STORE +
          ' (id, winningseq, json, local) VALUES (?, ?, ?, ?);';
        var metadataStr = JSON.stringify(docInfo.metadata);
        var key = docInfo.metadata.id + "::" + winningRev;
        var local = utils.isLocalId(docInfo.metadata.id) ? 1 : 0;
        var params = isUpdate ?
          [metadataStr, key, docInfo.metadata.id] :
          [docInfo.metadata.id, seq, metadataStr, local];
        tx.executeSql(sql, params, function () {
          results.push(docInfo);
          fetchedDocs[docInfo.metadata.id] = docInfo.metadata;
          callback();
        });
      }
    }

    function updateDoc(oldDoc, docInfo) {
      var merged =
        merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);
      var deleted = utils.isDeleted(docInfo.metadata);
      var oldDocDeleted = utils.isDeleted(oldDoc);
      var inConflict = (oldDocDeleted && deleted && newEdits) ||
        (!oldDocDeleted && newEdits && merged.conflicts !== 'new_leaf');
      if (inConflict) {
        results.push(makeErr(errors.REV_CONFLICT, docInfo._bulk_seq));
        return processDocs();
      }

      docInfo.metadata.rev_tree = merged.tree;

      // recalculate
      var winningRev = merge.winningRev(docInfo.metadata);
      deleted = utils.isDeleted(docInfo.metadata, winningRev);

      writeDoc(docInfo, winningRev, deleted, processDocs, true);
    }

    function insertDoc(docInfo) {
      // Cant insert new deleted documents
      var winningRev = merge.winningRev(docInfo.metadata);
      var deleted = utils.isDeleted(docInfo.metadata, winningRev);
      if ('was_delete' in opts && deleted) {
        results.push(errors.MISSING_DOC);
        return processDocs();
      }
      writeDoc(docInfo, winningRev, deleted, processDocs, false);
    }

    function processDocs() {
      if (!docInfos.length) {
        return complete();
      }
      var currentDoc = docInfos.shift();
      var id = currentDoc.metadata.id;

      if (id in fetchedDocs) {
        // if newEdits=false, can re-use the same id from this batch
        return updateDoc(fetchedDocs[id], currentDoc);
      }

      tx.executeSql('SELECT json FROM ' + DOC_STORE +
        ' WHERE id = ?', [id], function (tx, result) {

        if (result.rows.length) {
          var metadata = JSON.parse(result.rows.item(0).json);
          updateDoc(metadata, currentDoc);
        } else {
          insertDoc(currentDoc);
        }
      });
    }

    // Insert sequence number into the error so we can sort later
    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    function saveAttachment(docInfo, digest, data, callback) {
      var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
      var newAtt = {digest: digest};
      var sql = 'SELECT digest, json FROM ' + ATTACH_STORE + ' WHERE digest=?';
      tx.executeSql(sql, [digest], function (tx, result) {
        if (!result.rows.length) {
          newAtt.refs = {};
          newAtt.refs[ref] = true;
          sql = 'INSERT INTO ' + ATTACH_STORE +
                '(digest, json, body) VALUES (?, ?, ?)';
          tx.executeSql(sql, [digest, JSON.stringify(newAtt), data],
            function () {
            callback();
          });
        } else {
          newAtt.refs = JSON.parse(result.rows.item(0).json).refs;
          sql = 'UPDATE ' + ATTACH_STORE + ' SET json=?, body=? WHERE digest=?';
          tx.executeSql(sql, [JSON.stringify(newAtt), data, digest],
            function () {
            callback();
          });
        }
      });
    }

    preprocessAttachments(function () {
      db.transaction(function (txn) {
        tx = txn;
        processDocs();
      }, unknownError(callback), function () {
        docCount = -1;
      });
    });
  };

  api._get = function (id, opts, callback) {
    opts = utils.clone(opts);
    var doc;
    var metadata;
    var err;
    if (!opts.ctx) {
      db.readTransaction(function (txn) {
        opts.ctx = txn;
        api._get(id, opts, callback);
      });
      return;
    }
    var tx = opts.ctx;

    function finish() {
      callback(err, {doc: doc, metadata: metadata, ctx: tx});
    }

    var sql;
    var sqlArgs;
    if (opts.rev) {
      sql = select(
        SELECT_DOCS,
        [DOC_STORE, BY_SEQ_STORE],
        null,
        [BY_SEQ_STORE + '.doc_id_rev=?', DOC_STORE + '.id=?']);
      sqlArgs = [id + '::' + opts.rev, id];
    } else {
      sql = select(
        SELECT_DOCS,
        [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE_AND_BY_SEQ_JOINER,
        DOC_STORE + '.id=?');
      sqlArgs = [id];
    }
    tx.executeSql(sql, sqlArgs, function (a, results) {
      if (!results.rows.length) {
        err = errors.MISSING_DOC;
        return finish();
      }
      var item = results.rows.item(0);
      metadata = JSON.parse(item.metadata);
      if (item.deleted && !opts.rev) {
        err = errors.error(errors.MISSING_DOC, 'deleted');
        return finish();
      }
      doc = JSON.parse(item.data);
      finish();
    });
  };

  function countDocs(tx, callback) {

    if (docCount !== -1) {
      return callback(docCount);
    }

    // count the total rows
    var sql = select(
      'COUNT(' + DOC_STORE + '.id) AS \'num\'',
      [DOC_STORE, BY_SEQ_STORE],
      DOC_STORE_AND_BY_SEQ_JOINER,
      [BY_SEQ_STORE + '.deleted=0', DOC_STORE + '.local=0']);

    tx.executeSql(sql, [], function (tx, result) {
      docCount = result.rows.item(0).num;
      callback(docCount);
    });
  }

  api._allDocs = function (opts, callback) {
    var results = [];
    var totalRows;

    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;
    var key = 'key' in opts ? opts.key : false;
    var descending = 'descending' in opts ? opts.descending : false;
    var limit = 'limit' in opts ? opts.limit : -1;
    var offset = 'skip' in opts ? opts.skip : 0;
    var inclusiveEnd = opts.inclusive_end !== false;

    var sqlArgs = [];
    var criteria = [DOC_STORE + '.local = 0'];

    if (key !== false) {
      criteria.push(DOC_STORE + '.id = ?');
      sqlArgs.push(key);
    } else if (start !== false || end !== false) {
      if (start !== false) {
        criteria.push(DOC_STORE + '.id ' + (descending ? '<=' : '>=') + ' ?');
        sqlArgs.push(start);
      }
      if (end !== false) {
        var comparator = descending ? '>' : '<';
        if (inclusiveEnd) {
          comparator += '=';
        }
        criteria.push(DOC_STORE + '.id ' + comparator + ' ?');
        sqlArgs.push(end);
      }
      if (key !== false) {
        criteria.push(DOC_STORE + '.id = ?');
        sqlArgs.push(key);
      }
    }

    if (opts.deleted !== 'ok') {
      // report deleted if keys are specified
      criteria.push(BY_SEQ_STORE + '.deleted = 0');
    }

    db.readTransaction(function (tx) {

      // first count up the total rows
      countDocs(tx, function (count) {
        totalRows = count;

        if (limit === 0) {
          return;
        }

        // then actually fetch the documents
        var sql = select(
          SELECT_DOCS,
          [DOC_STORE, BY_SEQ_STORE],
          DOC_STORE_AND_BY_SEQ_JOINER,
          criteria,
          DOC_STORE + '.id ' + (descending ? 'DESC' : 'ASC')
          );
        sql += ' LIMIT ' + limit + ' OFFSET ' + offset;

        tx.executeSql(sql, sqlArgs, function (tx, result) {
          for (var i = 0, l = result.rows.length; i < l; i++) {
            var item = result.rows.item(i);
            var metadata = JSON.parse(item.metadata);
            var data = JSON.parse(item.data);
            var winningRev = data._rev;
            var doc = {
              id: metadata.id,
              key: metadata.id,
              value: {rev: winningRev}
            };
            if (opts.include_docs) {
              doc.doc = data;
              doc.doc._rev = winningRev;
              if (opts.conflicts) {
                doc.doc._conflicts = merge.collectConflicts(metadata);
              }
              for (var att in doc.doc._attachments) {
                if (doc.doc._attachments.hasOwnProperty(att)) {
                  doc.doc._attachments[att].stub = true;
                }
              }
            }
            if (item.deleted) {
              if (opts.deleted === 'ok') {
                doc.value.deleted = true;
                doc.doc = null;
              } else {
                continue;
              }
            }
            results.push(doc);
          }
        });
      });
    }, unknownError(callback), function () {
      callback(null, {
        total_rows: totalRows,
        offset: opts.skip,
        rows: results
      });
    });
  };

  api._changes = function (opts) {
    opts = utils.clone(opts);

    if (opts.continuous) {
      var id = name + ':' + utils.uuid();
      WebSqlPouch.Changes.addListener(name, id, api, opts);
      WebSqlPouch.Changes.notify(name);
      return {
        cancel: function () {
          WebSqlPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var limit = 'limit' in opts ? opts.limit : -1;
    if (limit === 0) {
      limit = 1; // per CouchDB _changes spec
    }

    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }
    var results = [];
    var numResults = 0;
    function fetchChanges() {

      var criteria = [
        DOC_STORE + '.winningseq > ' + opts.since,
        DOC_STORE + '.local = 0'
      ];
      var sqlArgs = [];
      if (opts.doc_ids) {
        criteria.push(DOC_STORE + '.id IN (' + opts.doc_ids.map(function () {
          return '?';
        }).join(',') + ')');
        sqlArgs = opts.doc_ids;
      }

      var sql = select(SELECT_DOCS, [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE_AND_BY_SEQ_JOINER, criteria,
        DOC_STORE + '.winningseq ' + (descending ? 'DESC' : 'ASC'));

      var filter = utils.filterChange(opts);
      if (!opts.view && !opts.filter) {
        // we can just limit in the query
        sql += ' LIMIT ' + limit;
      }

      db.readTransaction(function (tx) {
        tx.executeSql(sql, sqlArgs, function (tx, result) {
          var lastSeq = 0;
          for (var i = 0, l = result.rows.length; i < l; i++) {
            var res = result.rows.item(i);
            var metadata = JSON.parse(res.metadata);
            if (lastSeq < res.seq) {
              lastSeq = res.seq;
            }
            var doc = JSON.parse(res.data);
            var change = opts.processChange(doc, metadata, opts);
            change.seq = res.seq;
            if (filter(change)) {
              numResults++;
              if (returnDocs) {
                results.push(change);
              }
              opts.onChange(change);
            }
            if (numResults === limit) {
              break;
            }
          }
          if (!opts.continuous) {
            opts.complete(null, {
              results: results,
              last_seq: lastSeq
            });
          }
        });
      });
    }

    fetchChanges();
  };

  api._close = function (callback) {
    //WebSQL databases do not need to be closed
    callback();
  };

  api._getAttachment = function (attachment, opts, callback) {
    var res;
    var tx = opts.ctx;
    var digest = attachment.digest;
    var type = attachment.content_type;
    var sql = 'SELECT hex(body) as body FROM ' + ATTACH_STORE +
              ' WHERE digest=?';
    tx.executeSql(sql, [digest], function (tx, result) {
      // sqlite normally stores data as utf8, so even the hex() function
      // "encodes" the binary data in utf8/16 before returning it. yet hex()
      // is the only way to get the full data, so we do this.
      var data = parseHexString(result.rows.item(0).body, encoding);
      if (opts.encode) {
        res = btoa(data);
      } else {
        data = utils.fixBinary(data);
        res = utils.createBlob([data], {type: type});
      }
      callback(null, res);
    });
  };

  api._getRevisionTree = function (docId, callback) {
    db.readTransaction(function (tx) {
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function (tx, result) {
        if (!result.rows.length) {
          callback(errors.MISSING_DOC);
        } else {
          var data = JSON.parse(result.rows.item(0).metadata);
          callback(null, data.rev_tree);
        }
      });
    });
  };

  api._doCompaction = function (docId, rev_tree, revs, callback) {
    if (!revs.length) {
      return callback();
    }
    db.transaction(function (tx) {
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function (tx, result) {
        if (!result.rows.length) {
          return utils.call(callback);
        }
        var metadata = JSON.parse(result.rows.item(0).metadata);
        metadata.rev_tree = rev_tree;

        // websql never calls callback if we do WHERE doc_id_rev IN (...)
        var numDone = 0;
        revs.forEach(function (rev) {
          var docIdRev = docId + '::' + rev;
          var sql = 'DELETE FROM ' + BY_SEQ_STORE + ' WHERE doc_id_rev = ?';
          tx.executeSql(sql, [docIdRev], function (tx) {
            if (++numDone === revs.length) {
              var sql = 'UPDATE ' + DOC_STORE + ' SET json = ? WHERE id = ?';
              tx.executeSql(sql, [JSON.stringify(metadata), docId],
                function () {
                callback();
              });
            }
          });
        });
      });
    });
  };
}

WebSqlPouch.valid = function () {
  if (typeof global !== 'undefined') {
    if (global.navigator &&
        global.navigator.sqlitePlugin &&
        global.navigator.sqlitePlugin.openDatabase) {
      return true;
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return true;
    } else if (global.openDatabase) {
      return true;
    }
  }
  return false;
};

WebSqlPouch.destroy = utils.toPromise(function (name, opts, callback) {
  WebSqlPouch.Changes.removeAllListeners(name);
  var db = openDB(name, POUCH_VERSION, name, POUCH_SIZE);
  db.transaction(function (tx) {
    var stores = [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, META_STORE];
    stores.forEach(function (store) {
      tx.executeSql('DROP TABLE IF EXISTS ' + store, []);
    });
  }, unknownError(callback), function () {
    if (utils.hasLocalStorage()) {
      delete global.localStorage['_pouch__websqldb_' + name];
      delete global.localStorage[name];
    }
    callback(null, {'ok': true});
  });
});

WebSqlPouch.Changes = new utils.Changes();

module.exports = WebSqlPouch;
