"use strict";

function quote(str) {
  return "'" + str + "'";
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

var unknownError = function(callback) {
  return function(event) {
    call(callback, {
      status: 500,
      error: event.type,
      reason: event.target
    });
  };
};

var webSqlPouch = function(opts, callback) {

  var api = {};
  var update_seq = 0;
  var name = opts.name;

  var db = openDatabase(name, POUCH_VERSION, name, POUCH_SIZE);
  if (!db) {
    return call(callback, Pouch.Errors.UNKNOWN_ERROR);
  }

  function dbCreated() {
    callback(null, api);
  }

  db.transaction(function (tx) {
    var meta = 'CREATE TABLE IF NOT EXISTS ' + META_STORE +
      ' (update_seq)';
    var attach = 'CREATE TABLE IF NOT EXISTS ' + ATTACH_STORE +
      ' (digest, json, body BLOB)';
    var doc = 'CREATE TABLE IF NOT EXISTS ' + DOC_STORE +
      ' (id unique, seq, json, winningseq)';
    var seq = 'CREATE TABLE IF NOT EXISTS ' + BY_SEQ_STORE +
      ' (seq INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, rev UNIQUE, json)';

    tx.executeSql(attach);
    tx.executeSql(doc);
    tx.executeSql(seq);
    tx.executeSql(meta);

    var sql = 'SELECT update_seq FROM ' + META_STORE;
    tx.executeSql(sql, [], function(tx, result) {
      if (!result.rows.length) {
        var initSeq = 'INSERT INTO ' + META_STORE + ' (update_seq) VALUES (?)';
        tx.executeSql(initSeq, [0]);
        return;
      }
      update_seq = result.rows.item(0).update_seq;
    });
  }, unknownError(callback), dbCreated);

  api.type = function() {
    return 'websql';
  };

  api.id = function() {
    var id = localJSON.get(name + '_id', null);
    if (id === null) {
      id = Math.uuid();
      localJSON.set(name + '_id', id);
    }
    return id;
  };

  api._info = function(callback) {
    db.transaction(function(tx) {
      var sql = 'SELECT COUNT(id) AS count FROM ' + DOC_STORE;
      tx.executeSql(sql, [], function(tx, result) {
        callback(null, {
          db_name: name,
          doc_count: result.rows.item(0).count,
          update_seq: update_seq
        });
      });
    });
  };

  api._bulkDocs = function idb_bulkDocs(req, opts, callback) {

    var newEdits = opts.new_edits;
    var userDocs = extend(true, [], req.docs);

    // Parse the docs, give them a sequence number for the result
    var docInfos = userDocs.map(function(doc, i) {
      var newDoc = parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      if (doc._deleted) {
        if (!newDoc.metadata.deletions) {
          newDoc.metadata.deletions = {};
        }
        newDoc.metadata.deletions[doc._rev.split('-')[1]] = true;
      }
      return newDoc;
    });

    var docInfoErrors = docInfos.filter(function(docInfo) {
      return docInfo.error;
    });
    if (docInfoErrors.length) {
      return call(callback, docInfoErrors[0]);
    }

    var tx;
    var results = [];
    var docs = [];
    var fetchedDocs = {};

    // Group multiple edits to the same document
    docInfos.forEach(function(docInfo) {
      if (docInfo.error) {
        return results.push(docInfo);
      }
      if (!docs.length || !newEdits || docInfo.metadata.id !== docs[0].metadata.id) {
        return docs.unshift(docInfo);
      }
      // We mark subsequent bulk docs with a duplicate id as conflicts
      results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
    });

    function sortByBulkSeq(a, b) {
      return a._bulk_seq - b._bulk_seq;
    }

    function complete(event) {
      var aresults = [];
      results.sort(sortByBulkSeq);
      results.forEach(function(result) {
        delete result._bulk_seq;
        if (result.error) {
          aresults.push(result);
          return;
        }
        var metadata = result.metadata;
        var rev = Pouch.merge.winningRev(metadata);

        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev
        });

        if (isLocalId(metadata.id)) {
          return;
        }

        update_seq++;
        var sql = 'UPDATE ' + META_STORE + ' SET update_seq=?';
        tx.executeSql(sql, [update_seq], function() {
          webSqlPouch.Changes.notify(name);
          localStorage[name] = (localStorage[name] === "a") ? "b" : "a";
        });
      });
      call(callback, null, aresults);
    }

    function preprocessAttachment(att, callback) {
      if (att.stub) {
        return callback();
      }
      if (typeof att.data === 'string') {
        att.data = atob(att.data);
        att.digest = 'md5-' + Crypto.MD5(att.data);
        return callback();
      }
      var reader = new FileReader();
      reader.onloadend = function(e) {
        att.data = this.result;
        att.digest = 'md5-' + Crypto.MD5(this.result);
        callback();
      };
      reader.readAsBinaryString(att.data);
    }

    function preprocessAttachments(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var docv = 0;
      docInfos.forEach(function(docInfo) {
        var attachments = docInfo.data && docInfo.data._attachments ?
          Object.keys(docInfo.data._attachments) : [];

        if (!attachments.length) {
          return done();
        }

        var recv = 0;
        for (var key in docInfo.data._attachments) {
          preprocessAttachment(docInfo.data._attachments[key], function() {
            recv++;
            if (recv == attachments.length) {
              done();
            }
          });
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
      var err = null;
      var recv = 0;

      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      if (isDeleted(docInfo.metadata, docInfo.metadata.rev)) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          delete docInfo.data._attachments[key].data;
          var digest = docInfo.data._attachments[key].digest;
          saveAttachment(docInfo, digest, data, function(err) {
            recv++;
            collectResults(err);
          });
        } else {
          recv++;
          collectResults();
        }
      }

      if (!attachments.length) {
        finish();
      }

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            call(callback, err);
          } else if (recv == attachments.length) {
            finish();
          }
        }
      }

      function dataWritten(tx, result) {
        var seq = docInfo.metadata.seq = result.insertId;
        delete docInfo.metadata.rev;

        var mainRev = Pouch.merge.winningRev(docInfo.metadata);

        var sql = isUpdate ?
          'UPDATE ' + DOC_STORE + ' SET seq=?, json=?, winningseq=(SELECT seq FROM ' + BY_SEQ_STORE + ' WHERE rev=?) WHERE id=?' :
          'INSERT INTO ' + DOC_STORE + ' (id, seq, winningseq, json) VALUES (?, ?, ?, ?);';
        var params = isUpdate ?
          [seq, JSON.stringify(docInfo.metadata), mainRev, docInfo.metadata.id] :
          [docInfo.metadata.id, seq, seq, JSON.stringify(docInfo.metadata)];
        tx.executeSql(sql, params, function(tx, result) {
          results.push(docInfo);
          call(callback, null);
        });
      }

      function finish() {
        var data = docInfo.data;
        var sql = 'INSERT INTO ' + BY_SEQ_STORE + ' (rev, json) VALUES (?, ?);';
        tx.executeSql(sql, [data._rev, JSON.stringify(data)], dataWritten);
      }
    }

    function updateDoc(oldDoc, docInfo) {
      docInfo.metadata.deletions = extend(docInfo.metadata.deletions, oldDoc.deletions);

      var merged = Pouch.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);
      var inConflict = (isDeleted(oldDoc) && isDeleted(docInfo.metadata)) ||
        (!isDeleted(oldDoc) && newEdits && merged.conflicts !== 'new_leaf');

      if (inConflict) {
        results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
        return processDocs();
      }

      docInfo.metadata.rev_tree = merged.tree;
      writeDoc(docInfo, processDocs, true);
    }

    function insertDoc(docInfo) {
      // Cant insert new deleted documents
      if ('was_delete' in opts && isDeleted(docInfo.metadata)) {
        results.push(Pouch.Errors.MISSING_DOC);
        return processDocs();
      }
      writeDoc(docInfo, processDocs, false);
    }

    function processDocs() {
      if (!docs.length) {
        return complete();
      }
      var currentDoc = docs.shift();
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
      tx.executeSql(sql, [digest], function(tx, result) {
        if (!result.rows.length) {
          newAtt.refs = {};
          newAtt.refs[ref] = true;
          sql = 'INSERT INTO ' + ATTACH_STORE + '(digest, json, body) VALUES (?, ?, ?)';
          tx.executeSql(sql, [digest, JSON.stringify(newAtt), data], function() {
            call(callback, null);
          });
        } else {
          newAtt.refs = JSON.parse(result.rows.item(0).json).refs;
          sql = 'UPDATE ' + ATTACH_STORE + ' SET json=?, body=? WHERE digest=?';
          tx.executeSql(sql, [JSON.stringify(newAtt), data, digest], function() {
            call(callback, null);
          });
        }
      });
    }

    function metadataFetched(tx, results) {
      for (var j=0; j<results.rows.length; j++) {
        var row = results.rows.item(j);
        fetchedDocs[row.id] = JSON.parse(row.json);
      }
      processDocs();
    }

    preprocessAttachments(function() {
      db.transaction(function(txn) {
        tx = txn;
        var ids = '(' + docs.map(function(d) {
          return quote(d.metadata.id);
        }).join(',') + ')';
        var sql = 'SELECT * FROM ' + DOC_STORE + ' WHERE id IN ' + ids;
        tx.executeSql(sql, [], metadataFetched);
      }, unknownError(callback));
    });
  };

  api._get = function(id, opts, callback) {
    var result;
    var metadata;
    db.transaction(function(tx) {
      var sql = 'SELECT * FROM ' + DOC_STORE + ' WHERE id=?';
      tx.executeSql(sql, [id.docId], function(tx, results) {
        if (!results.rows.length) {
          result = Pouch.Errors.MISSING_DOC;
          return;
        }
        metadata = JSON.parse(results.rows.item(0).json);
        if (isDeleted(metadata) && !opts.rev) {
          result = extend({}, Pouch.Errors.MISSING_DOC, {reason:"deleted"});
          return;
        }

        var rev = Pouch.merge.winningRev(metadata);
        var key = opts.rev ? opts.rev : rev;
        var sql = 'SELECT * FROM ' + BY_SEQ_STORE + ' WHERE rev=?';
        tx.executeSql(sql, [key], function(tx, results) {
          if (!results.rows.length) {
            result = Pouch.Errors.MISSING_DOC;
            return;
          }
          var doc = JSON.parse(results.rows.item(0).json);

          if (opts.attachments && doc._attachments) {
            var attachments = Object.keys(doc._attachments);
            var recv = 0;
            attachments.forEach(function(key) {
              api.getAttachment(doc._id + '/' + key, {encode: true, txn: tx}, function(err, data) {
                doc._attachments[key].data = data;
                if (++recv === attachments.length) {
                  result = doc;
                }
              });
            });
          } else {
            if (doc._attachments){
              for (var key in doc._attachments) {
                doc._attachments[key].stub = true;
              }
            }
            result = doc;
          }
        });
      });
    }, unknownError(callback), function () {
      call(callback, result, metadata);
    });
  };

  api._allDocs = function(opts, callback) {
    var results = [];
    var resultsMap = {};
    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;
    var descending = 'descending' in opts ? opts.descending : false;
    var sql = 'SELECT ' + DOC_STORE + '.id, ' + BY_SEQ_STORE + '.seq, ' +
      BY_SEQ_STORE + '.json AS data, ' + DOC_STORE + '.json AS metadata FROM ' +
      BY_SEQ_STORE + ' JOIN ' + DOC_STORE + ' ON ' + BY_SEQ_STORE + '.seq = ' +
      DOC_STORE + '.winningseq';

    if ('keys' in opts) {
      sql += ' WHERE ' + DOC_STORE + '.id IN (' + opts.keys.map(function(key){
        return quote(key);
      }).join(',') + ')';
    } else {
      if (start) {
        sql += ' WHERE ' + DOC_STORE + '.id >= "' + start + '"';
      }
      if (end) {
        sql += (start ? ' AND ' : ' WHERE ') + DOC_STORE + '.id <= "' + end + '"';
      }
      sql += ' ORDER BY ' + DOC_STORE + '.id ' + (descending ? 'DESC' : 'ASC');
    }

    db.transaction(function(tx) {
      tx.executeSql(sql, [], function(tx, result) {
        for (var i = 0, l = result.rows.length; i < l; i++ ) {
          var doc = result.rows.item(i);
          var metadata = JSON.parse(doc.metadata);
          var data = JSON.parse(doc.data);
          if (!(isLocalId(metadata.id))) {
            var doc = {
              id: metadata.id,
              key: metadata.id,
              value: {rev: Pouch.merge.winningRev(metadata)}
            };
            if (opts.include_docs) {
              doc.doc = data;
              doc.doc._rev = Pouch.merge.winningRev(metadata);
              if (opts.conflicts) {
                doc.doc._conflicts = collectConflicts(metadata);
              }
            }
            if ('keys' in opts) {
              if (opts.keys.indexOf(metadata.id) > -1) {
                if (isDeleted(metadata)) {
                  doc.value.deleted = true;
                  doc.doc = null;
                }
                resultsMap[doc.id] = doc;
              }
            } else {
              if(!isDeleted(metadata)) {
                results.push(doc);
              }
            }
          }
        }
      });
    }, unknownError(callback), function() {
      if ('keys' in opts) {
        opts.keys.forEach(function(key) {
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
      call(callback, null, {
        total_rows: results.length,
        rows: results
      });
    });
  }

  api._changes = function idb_changes(opts) {

    if (Pouch.DEBUG)
      console.log(name + ': Start Changes Feed: continuous=' + opts.continuous);

    opts = extend(true, {}, opts);

    if (!opts.since) opts.since = 0;

    if (opts.continuous) {
      var id = name + ':' + Math.uuid();
      opts.cancelled = false;
      webSqlPouch.Changes.addListener(name, id, api, opts);
      webSqlPouch.Changes.notify(name);
      return {
        cancel: function() {
          if (Pouch.DEBUG) console.log(name + ': Cancel Changes Feed');
          opts.cancelled = true;
          webSqlPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = 'descending' in opts ? opts.descending : false;
    descending = descending ? 'prev' : null;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var results = [], resultIndices = {}, dedupResults = [];
    var txn;

    if (opts.filter && typeof opts.filter === 'string') {
      var filterName = opts.filter.split('/');
      api.get('_design/' + filterName[0], function(err, ddoc) {
        var filter = eval('(function() { return ' +
                          ddoc.filters[filterName[1]] + ' })()');
        opts.filter = filter;
        fetchChanges();
      });
    } else {
      fetchChanges();
    }

    function fetchChanges() {
      var sql = 'SELECT ' + DOC_STORE + '.id, ' + BY_SEQ_STORE + '.seq, ' +
        BY_SEQ_STORE + '.json AS data, ' + DOC_STORE + '.json AS metadata FROM ' +
        BY_SEQ_STORE + ' JOIN ' + DOC_STORE + ' ON ' + BY_SEQ_STORE + '.seq = ' +
        DOC_STORE + '.winningseq WHERE ' + DOC_STORE + '.seq > ' + opts.since +
        ' ORDER BY ' + DOC_STORE + '.seq ' + (descending ? 'DESC' : 'ASC');

      db.transaction(function(tx) {
        tx.executeSql(sql, [], function(tx, result) {
          for (var i = 0, l = result.rows.length; i < l; i++ ) {
            var doc = result.rows.item(i);
            var metadata = JSON.parse(doc.metadata);
            if (!isLocalId(metadata.id)) {
              var change = {
                id: metadata.id,
                seq: doc.seq,
                changes: collectLeaves(metadata.rev_tree),
                doc: JSON.parse(doc.data),
              };
              change.doc._rev = Pouch.merge.winningRev(metadata);
              if (isDeleted(metadata, change.doc._rev)) {
                change.deleted = true;
              }
              if (opts.conflicts) {
                change.doc._conflicts = collectConflicts(metadata);
              }
              results.push(change);
            }
          }
          for (var i = 0, l = results.length; i < l; i++ ) {
            var result = results[i];
            if (result) dedupResults.push(result);
          }
          dedupResults.map(function(c) {
            if (opts.filter && !opts.filter.apply(this, [c.doc])) {
              return;
            }
            if (!opts.include_docs) {
              delete c.doc;
            }
            call(opts.onChange, c);
          });

          call(opts.complete, null, {results: dedupResults});
        });
      });
    }
  };

  api._getAttachment = function(id, opts, callback) {
    var res;
    // This can be called while we are in a current transaction, pass the context
    // along and dont wait for the transaction to complete here.
    if ('txn' in opts) {
      fetchAttachment(opts.txn);
    } else {
      db.transaction(fetchAttachment, unknownError(callback), function() {
        call(callback, null, res);
      });
    }

    function fetchAttachment(tx) {
      var sql = 'SELECT ' + BY_SEQ_STORE + '.json AS data FROM ' + DOC_STORE +
        ' JOIN ' + BY_SEQ_STORE + ' ON ' + BY_SEQ_STORE + '.seq = ' + DOC_STORE +
        '.seq WHERE ' + DOC_STORE + '.id = "' + id.docId + '"' ;
      tx.executeSql(sql, [], function(tx, result) {
        var doc = JSON.parse(result.rows.item(0).data);
        var attachment = doc._attachments[id.attachmentId];
        var digest = attachment.digest;
        var type = attachment.content_type;
        var sql = 'SELECT body FROM ' + ATTACH_STORE + ' WHERE digest=?';
        tx.executeSql(sql, [digest], function(tx, result) {
          var data = result.rows.item(0).body;
          if (opts.encode) {
            res = btoa(data);
          } else {
            res = new Blob([data], {type: type});
          }
          if ('txn' in opts) {
            call(callback, null, res);
          }
        });
      });
    }
  }
  // comapction internal functions
  api._getRevisionTree = function(docId, callback) {
    db.transaction(function (tx) {
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function(tx, result) {
        var data = JSON.parse(result.rows.item(0).metadata);
        callback(data.rev_tree);
      });
    });
  };
  api._removeDocRevisions = function(docId, revs, callback) {
    db.transaction(function (tx) {
      var sql = 'DELETE FROM ' + BY_SEQ_STORE + ' WHERE rev IN (' +
        revs.map(function(rev){return quote(rev);}).join(',') + ')';
      tx.executeSql(sql, [], function(tx, result) {
        callback();
      });
    });
  };
  // end of compaction internal functions

  return api;
}

webSqlPouch.valid = function() {
  return !!window.openDatabase;
};

webSqlPouch.destroy = function(name, callback) {
  var db = openDatabase(name, POUCH_VERSION, name, POUCH_SIZE);
  localJSON.set(name + '_id', null);
  db.transaction(function (tx) {
    tx.executeSql('DROP TABLE IF EXISTS ' + DOC_STORE, []);
    tx.executeSql('DROP TABLE IF EXISTS ' + BY_SEQ_STORE, []);
    tx.executeSql('DROP TABLE IF EXISTS ' + ATTACH_STORE, []);
    tx.executeSql('DROP TABLE IF EXISTS ' + META_STORE, []);
  }, unknownError(callback), function() {
    call(callback, null);
  });
};

webSqlPouch.Changes = Changes();

Pouch.adapter('websql', webSqlPouch);
