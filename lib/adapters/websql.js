'use strict';

var utils = require('../utils');
var merge = require('../merge');
var errors = require('../deps/errors');
function quote(str) {
  return "'" + str + "'";
}

function openDB() {
  if (typeof global !== 'undefined') {
    if (global.navigator && global.navigator.sqlitePlugin && global.navigator.sqlitePlugin.openDatabase) {
      return navigator.sqlitePlugin.openDatabase.apply(navigator.sqlitePlugin, arguments);
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return global.sqlitePlugin.openDatabase.apply(global.sqlitePlugin, arguments);
    } else {
      return global.openDatabase.apply(global, arguments);
    }
  }
}

var POUCH_VERSION = 1;
var POUCH_SIZE = 5 * 1024 * 1024;

// The object stores created for each database
// DOC_STORE stores the document meta data, its revision history and state
var DOC_STORE = quote('document-store');
// BY_SEQ_STORE stores a particular version of a document, keyed by its
// sequence id
var BY_SEQ_STORE = quote('by-sequence');
// Where we store attachments
var ATTACH_STORE = quote('attach-store');
var META_STORE = quote('metadata-store');

function unknownError(callback) {
  return function (event) {

    // event may actually be a SQLError object, so report is as such
    var errorNameMatch = event && event.constructor.toString().match(/function ([^\(]+)/);
    var errorName = (errorNameMatch && errorNameMatch[1]) || event.type;
    var errorReason = event.target || event.message;
    utils.call(callback, errors.error(errors.WSQ_ERROR, errorReason, errorName));
  };
}

function parseHexString(str) {
  var result = '';
  for (var i = 0, len = str.length; i < len; i += 2) {
    result += String.fromCharCode(parseInt(str.substring(i, i + 2), 16));
  }
  return result;
}

// Safari is weird, it encodes everything with bonus \u0000 characters after every character
// Rather than user agent sniff, we test every odd character for \u0000
function isMangledUnicode(str) {
  for (var i = 1, len = str.length; i < len; i += 2) {
    if (str.charAt(i) !== '\u0000') {
      return false;
    }
  }
  return true;
}

// unmangle the aforementioned Safari atrocity
function unmangleUnicode(str) {
  var result = '';
  for (var i = 0, len = str.length; i < len; i += 2) {
    result += str.charAt(i);
  }
  return result;
}

// used to deal with utf8 encoding that occurs in most sqlite implementations
// partially taken from http://ecmanaut.blogspot.ca/2006/07/encoding-decoding-utf8-in-javascript.html
function decodeUtf8(str) {
  var result;
  try {
    result = decodeURIComponent(window.escape(str));
  } catch (err) { // URI error in safari, string is already escaped but still possibly mangled
    result = str;
  }
  return isMangledUnicode(result) ? unmangleUnicode(result) : result;
}

function webSqlPouch(opts, callback) {

  var api = {};
  var instanceId = null;
  var idRequests = [];
  var name = opts.name;

  var db = openDB(name, POUCH_VERSION, name, POUCH_SIZE);
  if (!db) {
    return utils.call(callback, errors.UNKNOWN_ERROR);
  }

  function dbCreated() {
    callback(null, api);
  }

  function setup() {
    db.transaction(function (tx) {
      var meta = 'CREATE TABLE IF NOT EXISTS ' + META_STORE +
        ' (update_seq, dbid)';
      var attach = 'CREATE TABLE IF NOT EXISTS ' + ATTACH_STORE +
        ' (digest, json, body BLOB)';
      var doc = 'CREATE TABLE IF NOT EXISTS ' + DOC_STORE +
        ' (id unique, seq, json, winningseq)';
      var seq = 'CREATE TABLE IF NOT EXISTS ' + BY_SEQ_STORE +
        ' (seq INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, doc_id_rev UNIQUE, json)';

      tx.executeSql(attach);
      tx.executeSql(doc);
      tx.executeSql(seq);
      tx.executeSql(meta);

      var updateseq = 'SELECT update_seq FROM ' + META_STORE;
      tx.executeSql(updateseq, [], function (tx, result) {
        if (!result.rows.length) {
          var initSeq = 'INSERT INTO ' + META_STORE + ' (update_seq) VALUES (?)';
          tx.executeSql(initSeq, [0]);
          return;
        }
      });

      var dbid = 'SELECT dbid FROM ' + META_STORE + ' WHERE dbid IS NOT NULL';
      tx.executeSql(dbid, [], function (tx, result) {
        if (!result.rows.length) {
          var initDb = 'UPDATE ' + META_STORE + ' SET dbid=?';
          instanceId = utils.uuid();
          tx.executeSql(initDb, [instanceId]);
        } else {
          instanceId = result.rows.item(0).dbid;
        }
        while (idRequests.length > 0) {
          var idCallback = idRequests.pop();
          idCallback(instanceId);
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

  api.id = function (callback) {
    if (!instanceId) {
      idRequests.push(callback);
    } else {
      callback(instanceId);
    }
  };

  api._info = function (callback) {
    db.transaction(function (tx) {
      var sql = 'SELECT COUNT(id) AS count FROM ' + DOC_STORE;
      tx.executeSql(sql, [], function (tx, result) {
        var doc_count = result.rows.item(0).count;
        var updateseq = 'SELECT update_seq FROM ' + META_STORE;
        tx.executeSql(updateseq, [], function (tx, result) {
          var update_seq = result.rows.item(0).update_seq;
          callback(null, {
            db_name: name,
            doc_count: doc_count,
            update_seq: update_seq
          });
        });
      });
    });
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
      return utils.call(callback, docInfoErrors[0]);
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

        webSqlPouch.Changes.notify(name);
        webSqlPouch.Changes.notifyLocalWindows(name);
      });

      var updateseq = 'SELECT update_seq FROM ' + META_STORE;
      tx.executeSql(updateseq, [], function (tx, result) {
        var update_seq = result.rows.item(0).update_seq + docsWritten;
        var sql = 'UPDATE ' + META_STORE + ' SET update_seq=?';
        tx.executeSql(sql, [update_seq], function () {
          utils.call(callback, null, aresults);
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
          return utils.call(callback, err);
        }
        var data = utils.fixBinary(att.data);
        att.data = utils.createBlob([data], {type: att.content_type});
      }
      var reader = new FileReader();
      reader.onloadend = function (e) {
        att.data = this.result;
        att.digest = 'md5-' + utils.Crypto.MD5(this.result);
        finish();
      };
      reader.readAsBinaryString(att.data);
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
            preprocessAttachment(docInfo.data._attachments[key], processedAttachment);
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

    function writeDoc(docInfo, callback, isUpdate) {

      function finish() {
        var data = docInfo.data;
        var sql = 'INSERT INTO ' + BY_SEQ_STORE + ' (doc_id_rev, json) VALUES (?, ?);';
        tx.executeSql(sql, [data._id + "::" + data._rev,
                            JSON.stringify(data)], dataWritten);
      }

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            utils.call(callback, err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      var err = null;
      var recv = 0;

      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      if (utils.isDeleted(docInfo.metadata, docInfo.metadata.rev)) {
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

      function dataWritten(tx, result) {
        var seq = docInfo.metadata.seq = result.insertId;
        delete docInfo.metadata.rev;

        var mainRev = merge.winningRev(docInfo.metadata);

        var sql = isUpdate ?
          'UPDATE ' + DOC_STORE + ' SET seq=?, json=?, winningseq=(SELECT seq FROM ' +
          BY_SEQ_STORE + ' WHERE doc_id_rev=?) WHERE id=?' :
          'INSERT INTO ' + DOC_STORE + ' (id, seq, winningseq, json) VALUES (?, ?, ?, ?);';
        var metadataStr = JSON.stringify(docInfo.metadata);
        var key = docInfo.metadata.id + "::" + mainRev;
        var params = isUpdate ?
          [seq, metadataStr, key, docInfo.metadata.id] :
          [docInfo.metadata.id, seq, seq, metadataStr];
        tx.executeSql(sql, params, function (tx, result) {
          results.push(docInfo);
          utils.call(callback, null);
        });
      }
    }

    function updateDoc(oldDoc, docInfo) {
      var merged = merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);
      var inConflict = (utils.isDeleted(oldDoc) &&
                        utils.isDeleted(docInfo.metadata)) ||
        (!utils.isDeleted(oldDoc) &&
         newEdits && merged.conflicts !== 'new_leaf');

      if (inConflict) {
        results.push(makeErr(errors.REV_CONFLICT, docInfo._bulk_seq));
        return processDocs();
      }

      docInfo.metadata.rev_tree = merged.tree;
      writeDoc(docInfo, processDocs, true);
    }

    function insertDoc(docInfo) {
      // Cant insert new deleted documents
      if ('was_delete' in opts && utils.isDeleted(docInfo.metadata)) {
        results.push(errors.MISSING_DOC);
        return processDocs();
      }
      writeDoc(docInfo, processDocs, false);
    }

    function processDocs() {
      if (!docInfos.length) {
        return complete();
      }
      var currentDoc = docInfos.shift();
      var id = currentDoc.metadata.id;
      if (id in fetchedDocs) {
        updateDoc(fetchedDocs[id], currentDoc);
      } else {
        // if we have newEdits=false then we can update the same
        // document twice in a single bulk docs call
        fetchedDocs[id] = currentDoc.metadata;
        insertDoc(currentDoc);
      }
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
          sql = 'INSERT INTO ' + ATTACH_STORE + '(digest, json, body) VALUES (?, ?, ?)';
          tx.executeSql(sql, [digest, JSON.stringify(newAtt), data], function () {
            utils.call(callback, null);
          });
        } else {
          newAtt.refs = JSON.parse(result.rows.item(0).json).refs;
          sql = 'UPDATE ' + ATTACH_STORE + ' SET json=?, body=? WHERE digest=?';
          tx.executeSql(sql, [JSON.stringify(newAtt), data, digest], function () {
            utils.call(callback, null);
          });
        }
      });
    }

    function metadataFetched(tx, results) {
      for (var j = 0; j < results.rows.length; j++) {
        var row = results.rows.item(j);
        fetchedDocs[row.id] = JSON.parse(row.json);
      }
      processDocs();
    }

    preprocessAttachments(function () {
      db.transaction(function (txn) {
        tx = txn;
        var sql = 'SELECT * FROM ' + DOC_STORE + ' WHERE id IN ' +
          '(' + docInfos.map(function () {return '?'; }).join(',') + ')';
        var queryArgs = docInfos.map(function (d) { return d.metadata.id; });
        tx.executeSql(sql, queryArgs, metadataFetched);
      }, unknownError(callback));
    });
  };

  api._get = function (id, opts, callback) {
    opts = utils.extend(true, {}, opts);
    var doc;
    var metadata;
    var err;
    if (!opts.ctx) {
      db.transaction(function (txn) {
        opts.ctx = txn;
        api._get(id, opts, callback);
      });
      return;
    }
    var tx = opts.ctx;

    function finish() {
      utils.call(callback, err, {doc: doc, metadata: metadata, ctx: tx});
    }

    var sql = 'SELECT * FROM ' + DOC_STORE + ' WHERE id=?';
    tx.executeSql(sql, [id], function (a, results) {
      if (!results.rows.length) {
        err = errors.MISSING_DOC;
        return finish();
      }
      metadata = JSON.parse(results.rows.item(0).json);
      if (utils.isDeleted(metadata) && !opts.rev) {
        err = errors.error(errors.MISSING_DOC, "deleted");
        return finish();
      }

      var rev = merge.winningRev(metadata);
      var key = opts.rev ? opts.rev : rev;
      key = metadata.id + '::' + key;
      var sql = 'SELECT * FROM ' + BY_SEQ_STORE + ' WHERE doc_id_rev=?';
      tx.executeSql(sql, [key], function (tx, results) {
        if (!results.rows.length) {
          err = errors.MISSING_DOC;
          return finish();
        }
        doc = JSON.parse(results.rows.item(0).json);

        finish();
      });
    });
  };

  api._allDocs = function (opts, callback) {
    var results = [];
    var resultsMap = {};
    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;
    var key = 'key' in opts ? opts.key : false;
    var descending = 'descending' in opts ? opts.descending : false;
    var sql = 'SELECT ' + DOC_STORE + '.id, ' + BY_SEQ_STORE + '.seq, ' +
      BY_SEQ_STORE + '.json AS data, ' + DOC_STORE + '.json AS metadata FROM ' +
      BY_SEQ_STORE + ' JOIN ' + DOC_STORE + ' ON ' + BY_SEQ_STORE + '.seq = ' +
      DOC_STORE + '.winningseq';

    var sqlArgs = [];
    if ('keys' in opts) {
      sql += ' WHERE ' + DOC_STORE + '.id IN (' + opts.keys.map(function () {
        return '?';
      }).join(',') + ')';
      sqlArgs = sqlArgs.concat(opts.keys);
    } else {
      if (start) {
        sql += ' WHERE ' + DOC_STORE + '.id >= ?';
        sqlArgs.push(start);
      }
      if (end) {
        sql += (start ? ' AND ' : ' WHERE ') + DOC_STORE + '.id <= ?';
        sqlArgs.push(end);
      }
      if (key) {
        sql += ((start || end) ? ' AND ' : ' WHERE ') + DOC_STORE + '.id = ?';
        sqlArgs.push(key);
      }
      sql += ' ORDER BY ' + DOC_STORE + '.id ' + (descending ? 'DESC' : 'ASC');
    }

    db.transaction(function (tx) {
      tx.executeSql(sql, sqlArgs, function (tx, result) {
        for (var i = 0, l = result.rows.length; i < l; i++) {
          var doc = result.rows.item(i);
          var metadata = JSON.parse(doc.metadata);
          var data = JSON.parse(doc.data);
          if (!(utils.isLocalId(metadata.id))) {
            doc = {
              id: metadata.id,
              key: metadata.id,
              value: {rev: merge.winningRev(metadata)}
            };
            if (opts.include_docs) {
              doc.doc = data;
              doc.doc._rev = merge.winningRev(metadata);
              if (opts.conflicts) {
                doc.doc._conflicts = merge.collectConflicts(metadata);
              }
              for (var att in doc.doc._attachments) {
                if (doc.doc._attachments.hasOwnProperty(att)) {
                  doc.doc._attachments[att].stub = true;
                }
              }
            }
            if ('keys' in opts) {
              if (opts.keys.indexOf(metadata.id) > -1) {
                if (utils.isDeleted(metadata)) {
                  doc.value.deleted = true;
                  doc.doc = null;
                }
                resultsMap[doc.id] = doc;
              }
            } else {
              if (!utils.isDeleted(metadata)) {
                results.push(doc);
              }
            }
          }
        }
      });
    }, unknownError(callback), function () {
      if ('keys' in opts) {
        opts.keys.forEach(function (key) {
          if (key in resultsMap) {
            results.push(resultsMap[key]);
          } else {
            results.push({"key": key, "error": "not_found"});
          }
        });
        if (opts.descending) {
          results.reverse();
        }
      }
      utils.call(callback, null, {
        total_rows: results.length,
        offset: opts.skip,
        rows: ('limit' in opts) ? results.slice(opts.skip, opts.limit + opts.skip) :
          (opts.skip > 0) ? results.slice(opts.skip) : results
      });
    });
  };

  api._changes = function idb_changes(opts) {
    opts = utils.extend(true, {}, opts);


    //console.log(name + ': Start Changes Feed: continuous=' + opts.continuous);


    if (opts.continuous) {
      var id = name + ':' + utils.uuid();
      opts.cancelled = false;
      webSqlPouch.Changes.addListener(name, id, api, opts);
      webSqlPouch.Changes.notify(name);
      return {
        cancel: function () {
          //console.log(name + ': Cancel Changes Feed');
          opts.cancelled = true;
          webSqlPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var results = [];

    function fetchChanges() {
      var sql = 'SELECT ' + DOC_STORE + '.id, ' + BY_SEQ_STORE + '.seq, ' +
        BY_SEQ_STORE + '.json AS data, ' + DOC_STORE + '.json AS metadata FROM ' +
        BY_SEQ_STORE + ' JOIN ' + DOC_STORE + ' ON ' + BY_SEQ_STORE + '.seq = ' +
        DOC_STORE + '.winningseq WHERE ' + DOC_STORE + '.seq > ' + opts.since +
        ' ORDER BY ' + DOC_STORE + '.seq ' + (descending ? 'DESC' : 'ASC');

      db.transaction(function (tx) {
        tx.executeSql(sql, [], function (tx, result) {
          var last_seq = 0;
          for (var i = 0, l = result.rows.length; i < l; i++) {
            var res = result.rows.item(i);
            var metadata = JSON.parse(res.metadata);
            if (!utils.isLocalId(metadata.id)) {
              if (last_seq < res.seq) {
                last_seq = res.seq;
              }
              var doc = JSON.parse(res.data);
              var change = opts.processChange(doc, metadata, opts);
              change.seq = res.seq;

              results.push(change);
            }
          }
          utils.processChanges(opts, results, last_seq);
        });
      });
    }

    fetchChanges();
  };

  api._close = function (callback) {
    //WebSQL databases do not need to be closed
    utils.call(callback, null);
  };

  api._getAttachment = function (attachment, opts, callback) {
    var res;
    var tx = opts.ctx;
    var digest = attachment.digest;
    var type = attachment.content_type;
    var sql = 'SELECT hex(body) as body FROM ' + ATTACH_STORE + ' WHERE digest=?';
    tx.executeSql(sql, [digest], function (tx, result) {
      // TODO: sqlite normally stores data as utf8, so even the hex() function "encodes" the binary
      // data in utf8 before returning it, and yet hex() is the only way to get the full data. so we do this.
      var data = decodeUtf8(parseHexString(result.rows.item(0).body));
      if (opts.encode) {
        res = btoa(data);
      } else {
        data = utils.fixBinary(data);
        res = utils.createBlob([data], {type: type});
      }
      utils.call(callback, null, res);
    });
  };

  api._getRevisionTree = function (docId, callback) {
    db.transaction(function (tx) {
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function (tx, result) {
        if (!result.rows.length) {
          utils.call(callback, errors.MISSING_DOC);
        } else {
          var data = JSON.parse(result.rows.item(0).metadata);
          utils.call(callback, null, data.rev_tree);
        }
      });
    });
  };

  api._doCompaction = function (docId, rev_tree, revs, callback) {
    db.transaction(function (tx) {
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function (tx, result) {
        if (!result.rows.length) {
          return utils.call(callback);
        }
        var metadata = JSON.parse(result.rows.item(0).metadata);
        metadata.rev_tree = rev_tree;

        var sql = 'DELETE FROM ' + BY_SEQ_STORE + ' WHERE doc_id_rev IN (' +
          revs.map(function (rev) {return quote(docId + '::' + rev); }).join(',') + ')';

        tx.executeSql(sql, [], function (tx, result) {
          var sql = 'UPDATE ' + DOC_STORE + ' SET json = ? WHERE id = ?';

          tx.executeSql(sql, [JSON.stringify(metadata), docId], function (tx, result) {
            callback();
          });
        });
      });
    });
  };

  return api;
}

webSqlPouch.valid = function () {
  if (typeof global !== 'undefined') {
    if (global.navigator && global.navigator.sqlitePlugin && global.navigator.sqlitePlugin.openDatabase) {
      return true;
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return true;
    } else if (global.openDatabase) {
      return true;
    }
  }
  return false;
};

webSqlPouch.destroy = utils.toPromise(function (name, opts, callback) {
  var db = openDB(name, POUCH_VERSION, name, POUCH_SIZE);
  db.transaction(function (tx) {
    tx.executeSql('DROP TABLE IF EXISTS ' + DOC_STORE, []);
    tx.executeSql('DROP TABLE IF EXISTS ' + BY_SEQ_STORE, []);
    tx.executeSql('DROP TABLE IF EXISTS ' + ATTACH_STORE, []);
    tx.executeSql('DROP TABLE IF EXISTS ' + META_STORE, []);
  }, unknownError(callback), function () {
    utils.call(callback, null);
  });
});

webSqlPouch.Changes = new utils.Changes();

module.exports = webSqlPouch;
