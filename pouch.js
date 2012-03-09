// Begin request *requires jQuery*

var ajax = function (options, callback) {
  options.success = function (obj) {
    callback(null, obj);
  };
  options.error = function (err) {
    if (err) callback(err);
    else callback(true);
  };
  options.dataType = 'json';
  options.contentType = 'application/json';
  $.ajax(options);
};

// End request

// The spec is still in flux.
// While most of the IDB behaviors match between implementations a lot of the names still differ.
// This section tries to normalize the different objects & methods.
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB;
window.IDBCursor = window.IDBCursor || window.webkitIDBCursor;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
window.IDBDatabaseException = window.IDBDatabaseException || window.webkitIDBDatabaseException;

var parseDoc = function (doc, newEdits) {
  if (newEdits) {
    if (!doc._id) {
      doc._id = Math.uuid();
    }
    var newRevId = Math.uuid(32, 16);
    if (doc._rev) {
      var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      if (!revInfo) throw "invalid value for property '_rev'";
      doc._revisions = {
        start: parseInt(revInfo[1], 10) + 1,
        ids: [newRevId, revInfo[2]]
      };
    } else {
      doc._revisions = {
        start : 1,
        ids : [newRevId]
      };
    }
  } else {
    if (!doc._revisions) throw "missing property '_revisions'";
    if (!isFinite(doc._revisions.start))
      throw "property '_revisions.start' must be a number";
    if (Array.isArray(doc._revisions) && doc._revisions.length > 0)
      throw "property '_revisions.id' must be a non-empty array";
  }
  doc._id = decodeURIComponent(doc._id);
  doc._rev = [doc._revisions.start, doc._revisions.ids[0]].join('-');
  return Object.keys(doc).reduce(function (acc, key) {
    if (/^_/.test(key))
      acc.metadata[key.slice(1)] = doc[key];
    else
      acc.data[key] = doc[key];
    return acc;
  }, {metadata : {}, data : {}});
};

var compareRevs = function (a, b) {
  if (a.id == b.id) { // Sort by id
    if (a.deleted ^ b.deleted) {
      return (a.deleted ? -1 : 1); // Then by deleted
    } else {
      if (a.revisions.start == b.revisions.start) // Then by depth of edits
        return (a.revisions.ids < b.revisions.ids ? -1 : 1); // Then by rev id
      else
        return (a.revisions.start < b.revisions.start ? -1 : 1);
    }
  } else {
    return (a.id < b.id ? -1 : 1);
  }
};

var mergeRevTrees = function () {
  function sortTrees(trees) {
    trees.sort(function (a, b) { return (a.pos > b.pos) - (a.pos < b.pos); });
  }

  function reduceRevTrees(result, tree) {
    if (!result.trees.length) {
      result.trees.concat(tree);
      result.leaves.concat(getLeafNodes(tree.pos, [], tree));
    } else {
      for (var base in result.trees) {
        var mergeResult = mergeTrees(tree.ids, tree.pos, base.ids, base.pos);
        if (mergeResult.trees.length == 1) {
          // TODO :
        }
      }
    }
  }

  function mergeTrees(tree, depth, base, pos, prefix) {
    if (!base.length) {
      return [{
        tree : tree,
        leaves : getLeafNodes(depth, prefix || [], tree)
      }];
    } else {
      var branches = branches(base).filter(function (branch) {
        return (pos < depth) ? true : branch[0] == tree[0];
      });
      if (pos < depth) {
        branches = branches(base);
        for (var b in branches) {
          var merged = mergeTrees(tree, depth,
                                  b.slice(1), pos + 1,
                                  prefix.concat(b[0]));
          if (merged.length == 1) {
            return branches.reduce(function (results, branch) {
              if (branch === b) {
                return results.concat(merged);
              } else {
                return results.concat({tree : tree});
              }
            });
          }
          branches(base).reduce(function (results, branch, i, siblings) {
            if (results.length < i) {
              // Already found a successful merge or have no base branch yet
              results.concat({
                tree : branch,
                leaves : getLeafNodes(branch.slice(1), pos + 1,
                                      prefix.concat(branch[0]))
              });
            } else {
              if (trees.length == 1) {
                return results.concat(trees);
              } else {
                if (i == siblings.length) {
                  result = results.concat({
                    tree : tree,
                    leaves : getLeafNodes
                    // TODO : return unmerged as a new tree
                  });
                }
              }
            }
          });
          if (Array.isArray(base[0])) {
            for (var branch in base[0]) {
              var mergeResult = mergeTree(tree);
            }
          } else {
            return mergeTree(tree, depth,
                             base.slice(1), pos + 1,
                             prefix.concat(base[0]));
          }
          //  if (Array.isArray(base[0])) {
          // }
        }
      }

      while (pos < depth) {
        if (Array.isArray(base[0])) {
        } else {

        }
      }
      if (pos == depth) {
        if (base.length === 0) {
          return {
            trees : [],
            conflicts : []
          };
        }
      }
      if (pos < depth) {
        return branches(base);
      }
    }
  }

  function getLeafNodes(depth, prefix, tree) {
    if (!tree.length) {
      return [{
        start : depth,
        ids : prefix.slice().reverse()
      }];
    } else if (Array.isArray(tree[0])) {
      return tree[0].reduce(function (leaves, branch) {
        return leaves.concat(getLeafNodes(depth, prefix, branch));
      });
    } else{
      return getLeafNodes(depth+1, prefix.concat(tree[0]), tree.slice(1));
    }
  }

  function branches(tree) {
    return Array.isArray(tree[0]) ? tree[0] : [tree];
  }

  var trees = Array.prototype.slice.call(arguments);
  var result = {
    trees: [],
    leaves: []
  };

  return trees.sort(sortTrees).reduce(reduceRevTrees, result);
};

var viewQuery = function (objectStore, options) {
  var range;
  var request;
  if (options.startKey && options.endKey) {
    range = IDBKeyRange.bound(options.startKey, options.endKey);
  } else if (options.startKey) {
    if (options.descending) { range = IDBKeyRange.upperBound(options.startKey); }
    else { range = IDBKeyRange.lowerBound(options.startKey); }
  } else if (options.endKey) {
    if (options.descending) { range = IDBKeyRange.lowerBound(options.endKey); }
    else { range = range = IDBKeyRange.upperBound(options.endKey); }
  }
  if (options.descending) {
    request = objectStore.openCursor(range, "left");
  } else {
    request = objectStore.openCursor(range);
  }
  var results = [];
  request.onsuccess = function (cursor) {
    if (!cursor) {
      if (options.success) options.success(results);
    } else {
      if (options.row) options.row(cursor.target.result.value);
      if (options.success) results.push(cursor.target.results.value);
    }
  };
  request.onerror = function (error) {
    if (options.error) options.error(error);
  };
};


var makePouch = function (db) {

  // Now we create the PouchDB interface
  var pouch = {update_seq: 0};

  pouch.get = function (id, options, callback) {
    options.error('not implemented');
  };

  pouch.remove = function (id, options) {
    doc._deleted = true;
    return pouch.bulkDocs(doc, options);
  };

  pouch.put = pouch.post = function (doc, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    options = options || {};
    pouch.bulkDocs({docs : [doc]}, options, function (err, results) {
      if (err) {
        if (callback) callback(err);
      } else {
        if (callback) callback(null, results[0]);
      }
    });
  };

  pouch.bulkDocs = function (req, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    options = options || {};

    var docs = req.docs;
    if (!docs) {
      if (callback) callback(null, []);
      return;
    }

    var newEdits = 'new_edits' in options ? options._new_edits : true;

    // Parse and sort the docs
    var docInfos = docs.map(function (doc) {
      return parseDoc(doc, newEdits);
    });

    docInfos.sort(function (a, b) {
      return compareRevs(a.metadata, b.metadata);
    });

    var keyRange = IDBKeyRange.bound(
      docInfos[0].metadata.id, docInfos[docInfos.length-1].metadata.id,
      false, false);

    // This groups edits to the same document together
    var buckets = docInfos.reduce(function (acc, docInfo) {
      if (docInfo.metadata.id === acc[0][0].metadata.id) {
        acc[0].push(docInfo);
      } else {
        acc.unshift([docInfo]);
      }
      return acc;
    }, [[docInfos.shift()]]);

    var txn = db.transaction(['ids', 'revs'], IDBTransaction.READ_WRITE);
    var results = [];

    txn.oncomplete = function (event) {
      if (callback) {
        callback(null, results);
      }
    };

    txn.onerror = function (event) {
      if (callback) {
        var code = event.target.errorCode;
        var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
        callback({
          error : event.type,
          reason : message
        });
      }
    };

    txn.ontimeout = function (event) {
      if (callback) {
        var code = event.target.errorCode;
        var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
        callback({
          error : event.type,
          reason : message
        });
      }
    };

    var cursReq = txn.objectStore('ids').openCursor(keyRange, IDBCursor.NEXT);

    cursReq.onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        // I am guessing keyRange should be sorted in the same way buckets
        // are, so we can just take the first from buckets
        var doc = buckets.shift();
        // Documents are grouped by id in buckets, which means each document
        // has an array of edits, this currently only works for single edits
        // they should probably be getting merged
        var docInfo = doc[0];
        var dataRequest = txn.objectStore('revs').put(docInfo.data);
        dataRequest.onsuccess = function (event) {
          docInfo.metadata.seq = event.target.result;
          var metaDataRequest = txn.objectStore('ids').put(docInfo.metadata);
          metaDataRequest.onsuccess = function (event) {
            results.push({
              id : docInfo.metadata.id,
              rev : docInfo.metadata.rev
            });
            cursor.continue();
          };
        };
      } else {
        // Cursor has exceeded the key range so the rest are inserts
        buckets.forEach(function (bucket) {
          // TODO: merge the bucket revs into a rev tree
          var docInfo = bucket[0];
          var dataRequest = txn.objectStore('revs').add(docInfo.data);
          dataRequest.onsuccess = function (event) {
            docInfo.metadata.seq = event.target.result;
            var metaDataRequest = txn.objectStore('ids').add(docInfo.metadata);
            metaDataRequest.onsuccess = function (event) {
              results.push({
                id : docInfo.metadata.id,
                rev : docInfo.metadata.rev
              });
            };
          };
        });
      }
    };
  };


  pouch.changes = function (options) {
    if (!options.seq) options.seq = 0;
    var transaction = db.transaction(["document-store", "sequence-index"]);
    var request = transaction.objectStore('sequence-index')
      .openCursor(IDBKeyRange.lowerBound(options.seq));
    request.onsuccess = function (event) {
      var cursor = event.target.result;
      if (!cursor) {
        if (options.continuous) {
          pouch.changes.addListener(options.onChange);
        }
        if (options.complete) {
          options.complete();
        }
      } else {
        var change_ = cursor.value;
        transaction.objectStore('document-store')
          .openCursor(IDBKeyRange.only(change_.id))
          .onsuccess = function (event) {
            var c = {id:change_.id, seq:change_.seq, changes:change_.changes, doc:event.value};
            options.onChange(c);
            cursor.continue();
          };
      }
    };
    request.onerror = function (error) {
      // Cursor is out of range
      // NOTE: What should we do with a sequence that is too high?
      if (options.continuous) {
        pouch.changes.addListener(options.onChange);
      }
      if (options.complete) {
        options.complete();
      }
    };
  };

  pouch.changes.listeners = [];
  pouch.changes.emit = function () {
    var a = arguments;
    pouch.changes.listeners.forEach(function (l) {
      l.apply(l, a);
    });
  };
  pouch.changes.addListener = function (l) {
    pouch.changes.listeners.push(l);
  };

  pouch.replicate = {};

  pouch.replicate.from = function (options) {
    var c = []; // Change list
    if (options.url[options.url.length - 1] !== '/') options.url += '/';
    ajax({
      url: options.url+'_changes?style=all_docs&include_docs=true'
    }, function (e, resp) {
      if (e) {
        if (options.error) options.error(e);
      }
      var transaction = db.transaction(["document-store", "sequence-index"],
                                       IDBTransaction.READ_WRITE);
      var pending = resp.results.length;
      resp.results.forEach(function (r) {

        var writeDoc = function (r) {
          pouch.post(r.doc, {
            newEdits:false,
            success: function (changeset) {
              pending--;
              c.changeset = changeset;
              c.push(r);
              if (pending === 0) options.success(c);
            },
            error: function (e) {
              pending--;
              r.error = e;
              c.push(r);
              if (pending === 0) {
                options.success(c);
              }
            }
          }, transaction);
        };
        pouch.get(r.id, {
          success: function (doc) {
            // The document exists
            if (doc._rev === r.changes[0].rev) {
              return; // Do nothing if we already have the change
            } else {
              var oldseq = parseInt(doc._rev.split('-')[0], 10);
              var newseq = parseInt(r.changes[0].rev.split('-')[0], 10);
              if (oldseq > newseq) {
                return; // Should we do something nicer here?
              } else {
                writeDoc(r);
              }
            }
          },
          error : function (e) {
            // doc does not exist, write it
            writeDoc(r);
          }
        }, transaction);
      });
    });
  };
  return pouch;
};


var POUCH_VERSION = 1;
var pouchCache = {};

pouch = {};
pouch.open = function (name, options, callback) {
  if (options instanceof Function) {
    callback = options;
    options = {};
  }
  options = options || {};

  name = 'pouch:' + name;
  if (name in pouchCache) {
    if (callback) {
      callback(null, pouchCache[name]);
    }
    return;
  }

  var request = indexedDB.open(name);

  request.onsuccess = function(event) {
    var db = event.target.result;
    pouchCache[name] = makePouch(db);

    db.onversionchange = function(event) {
      console.log("Closing!");
      db.close();
      delete pouchCache[name];
    };

    if (!db.version) {
      var versionRequest = db.setVersion('1');
      versionRequest.onsuccess = function (event) {
        db.createObjectStore('ids', {keyPath : 'id'})
          .createIndex('seq', 'seq', {unique : true});
        db.createObjectStore('revs', {autoIncrement : true});
        if (callback)
          callback(null, pouchCache[name]);
      };
      versionRequest.onblocked = function (event) {
        if (callback) {
          callback({
            error : 'open',
            reason : 'upgrade needed but blocked by another process'
          });
        }
      };
    } else {
      if (callback)
        callback(null, pouchCache[name]);
    }
  };

  request.onerror = function(event) {
    if (callback) {
      callback({
        error : 'open',
        reason : error.toString()
      });
    }
  };
};

pouch.deleteDatabase = function (name) {
  name = 'pouch:' + name;
  var request = indexedDB.deleteDatabase(name);

  request.onsuccess = function (event) {
    options.success({ok : true});
  };

  request.onerror = function (event) {
    options.error({error : 'delete', reason : event.toString});
  };
};