// Basic wrapper for localStorage
var localJSON = (function(){
  if (!localStorage) {
    return false;
  }
  return {
    set: function(prop, val) {
      localStorage.setItem(prop, JSON.stringify(val));
    },
    get: function(prop, def) {
      try {
        if (localStorage.getItem(prop) === null) {
          return def;
        }
        return JSON.parse((localStorage.getItem(prop) || 'false'));
      } catch(err) {
        return def;
      }
    },
    remove: function(prop) {
      localStorage.removeItem(prop);
    }
  };
})();

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri (str) {
  var o = parseUri.options;
  var m = o.parser[o.strictMode ? "strict" : "loose"].exec(str);
  var uri = {};
  var i = 14;

  while (i--) uri[o.key[i]] = m[i] || "";

  uri[o.q.name] = {};
  uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    if ($1) uri[o.q.name][$1] = $2;
  });

  return uri;
};

parseUri.options = {
  strictMode: false,
  key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
  q:   {
    name:   "queryKey",
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};

(function() {

  // While most of the IDB behaviors match between implementations a
  // lot of the names still differ. This section tries to normalize the
  // different objects & methods.
  window.indexedDB = window.indexedDB ||
    window.mozIndexedDB ||
    window.webkitIndexedDB;

  window.IDBCursor = window.IDBCursor ||
    window.webkitIDBCursor;

  window.IDBKeyRange = window.IDBKeyRange ||
    window.webkitIDBKeyRange;

  window.IDBTransaction = window.IDBTransaction ||
    window.webkitIDBTransaction;

  window.IDBDatabaseException = window.IDBDatabaseException ||
    window.webkitIDBDatabaseException;

  var root = this;
  var pouch = {};

  if (typeof exports !== 'undefined') {
    exports.pouch = pouch;
  } else {
    root.pouch = pouch;
  }

  // IndexedDB requires a versioned database structure, this is going to make
  // it hard to dynamically create object stores if we needed to for things
  // like views
  var POUCH_VERSION = 1;

  // Cache for open databases
  var pouchCache = {};

  // The object stores created for each database
  // DOC_STORE stores the document meta data, its revision history and state
  var DOC_STORE = 'document-store';
  // BY_SEQ_STORE stores a particular version of a document, keyed by its
  // sequence id
  var BY_SEQ_STORE = 'by-sequence';

  // Where we store attachments
  var ATTACH_STORE = 'attach-store';

  // Enumerate errors, add the status code so we can reflect the HTTP api
  // in future
  var Errors = {
    MISSING_BULK_DOCS: {
      status: 400,
      error: 'bad_request',
      reason: "Missing JSON list of 'docs'"
    },
    MISSING_DOC: {
      status: 404,
      error: 'not_found',
      reason: 'missing'
    },
    REV_CONFLICT: {
      status: 409,
      error: 'conflict',
      reason: 'Document update conflict'
    }
  };

  var ajax = function (options, callback) {
    var defaults = {
      success: function (obj, _, xhr) {
        callback(null, obj, xhr);
      },
      error: function (err) {
        if (err) callback(err);
        else callback(true);
      },
      dataType: 'json',
      contentType: 'application/json'
    };
    options = $.extend({}, defaults, options);

    if (options.data && typeof options.data !== 'string') {
      options.data = JSON.stringify(options.data);
    }
    if (options.auth) {
      options.beforeSend = function(xhr) {
        var token = btoa(options.auth.username + ":" + options.auth.password);
        xhr.setRequestHeader("Authorization", "Basic " + token);
      }
    }
    $.ajax(options);
  };

  // Pretty dumb name for a function, just wraps callback calls so we dont
  // to if (callback) callback() everywhere
  var call = function() {
    var fun = arguments[0];
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    if (typeof fun === typeof Function) {
      fun.apply(this, args);
    }
  };

  // Preprocess documents, parse their revisions, assign an id and a
  // revision for new writes that are missing them, etc
  var parseDoc = function(doc, newEdits) {
    if (newEdits) {
      if (!doc._id) {
        doc._id = Math.uuid();
      }
      var newRevId = Math.uuid(32, 16);
      var nRevNum;
      if (doc._rev) {
        var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
        if (!revInfo) {
          throw "invalid value for property '_rev'";
        }
        doc._revisions = [{
          pos: parseInt(revInfo[1], 10),
          ids: [revInfo[2], [[newRevId, []]]]
        }];
        nRevNum = parseInt(revInfo[1], 10) + 1;
      } else {
        doc._revisions = [{
          pos: 1,
          ids : [newRevId, []]
        }];
        nRevNum = 1;
      }
    } else {
      if (!doc._revisions) {
        var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
        nRevNum = parseInt(revInfo[1], 10);
        newRevId = revInfo[2];
        doc._revisions = [{
          pos: parseInt(revInfo[1], 10),
          ids: [revInfo[2], []]
        }];
      }
    }
    doc._id = decodeURIComponent(doc._id);
    doc._rev = [nRevNum, newRevId].join('-');
    return Object.keys(doc).reduce(function(acc, key) {
      if (/^_/.test(key) && key !== '_attachments') {
        acc.metadata[key.slice(1)] = doc[key];
      } else {
        acc.data[key] = doc[key];
      }
      return acc;
    }, {metadata : {}, data : {}});
  };


  var compareRevs = function(a, b) {
    // Sort by id
    if (a.id !== b.id) {
      return (a.id < b.id ? -1 : 1);
    }
    // Then by deleted
    if (a.deleted ^ b.deleted) {
      return (a.deleted ? -1 : 1);
    }
    // Then by rev id
    if (a.revisions[0].pos === b.revisions[0].pos) {
      return (a.revisions[0].ids < b.revisions[0].ids ? -1 : 1);
    }
    // Then by depth of edits
    return (a.revisions[0].start < b.revisions[0].start ? -1 : 1);
  };

  var parseUrl = function(url) {
    var a = document.createElement('a');
    a.href = url;
    return a;
  }

  var getHost = function(name) {
    if (/http:/.test(name)) {
      var uri = parseUri(name);
      uri.remote = true;
      uri.auth = {username: uri.user, password: uri.password};
      var parts = uri.path.replace(/(^\/|\/$)/g, '').split('/');
      uri.db = parts.pop();
      uri.path = parts.join('/');
      return uri;
    }
    return {host: '', path: '/', db: name, auth: false};
  }

  var fetchCheckpoint = function(src, target, callback) {
    var id = Crypto.MD5(src.id() + target.id());
    src.get('_local/' + id, function(err, doc) {
      if (err && err.status === 404) {
        callback(0);
      } else {
        callback(doc.last_seq);
      }
    });
  };

  var writeCheckpoint = function(src, target, checkpoint, callback) {
    var check = {
      _id: '_local/' + Crypto.MD5(src.id() + target.id()),
      last_seq: checkpoint
    };
    src.get(check._id, function(err, doc) {
      if (doc && doc._rev) {
        check._rev = doc._rev;
      }
      src.put(check, function(err, doc) {
        callback();
      });
    });
  };

  var replicate = function(src, target, callback) {
    fetchCheckpoint(src, target, function(checkpoint) {
      var results = [];
      var completed = false;
      var pending = 0;
      var last_seq = 0;
      var result = {
        ok: true,
        start_time: new Date(),
        docs_read: 0,
        docs_written: 0
      };

      function isCompleted() {
        if (completed && pending === 0) {
          result.end_time = new Date();
          writeCheckpoint(src, target, last_seq, function() {
            call(callback, null, result);
          });
        }
      }

      src.changes({
        since: checkpoint,
        onChange: function(change) {
          results.push(change);
          result.docs_read++;
          pending++;
          var diff = {};
          diff[change.id] = change.changes.map(function(x) { return x.rev; });
          target.revsDiff(diff, function(err, diffs) {
            for (var id in diffs) {
              diffs[id].missing.map(function(rev) {
                src.get(id, {revs: true, rev: rev}, function(err, doc) {
                  target.bulkDocs({docs: [doc]}, {newEdits: false}, function() {
                    result.docs_written++;
                    pending--;
                    isCompleted();
                  });
                });
              });
            }
          });
        },
        complete: function(err, res) {
          last_seq = res.last_seq;
          completed = true;
          isCompleted();
        }
      });
    });
  };

  function genUrl(opts, path) {
    if (opts.remote) {
      var pathDel = !opts.path ? '' : '/';
      return opts.protocol + '://' + opts.host + ':' + opts.port + '/' + opts.path
        + pathDel + opts.db + '/' + path;
    }
    return '/' + opts.db + '/' + path;
  };

  // This code is all ugly as hell, just making it work for what we need it
  // for right now then will fix it up
  var makeCouch = function(name, opts, callback) {

    var host = getHost(name);
    var db = {};

    db.id = function() {
      return genUrl(host, '');
    };

    db.info = function(callback) {
    };

    db.get = function(id, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      var params = [];
      if (opts.revs) {
        params.push('revs=true');
      }
      if (opts.rev) {
        params.push('rev=' + opts.rev);
      }
      if (opts.conflicts) {
        params.push('conflicts=' + opts.conflicts);
      }
      params = params.join('&');
      params = params === '' ? '' : '?' + params;

      var options = {
        auth: host.auth,
        type: 'GET',
        url: genUrl(host, id + params)
      };

      if (/\//.test(id) && !/^_local/.test(id)) {
        options.dataType = false;
      }

      ajax(options, function(err, doc, xhr) {
        if (err) {
          return call(callback, Errors.MISSING_DOC);
        }
        call(callback, null, doc, xhr);
      });
    };
    db.remove = function(doc, opts, callback) {
    };
    db.putAttachment = function(id, rev, doc, type, callback) {
      ajax({
        auth: host.auth,
        type:'PUT',
        url: genUrl(host, id) + '?rev=' + rev,
        headers: {'Content-Type': type},
        data: doc
      }, callback);
    };
    db.put = db.post = function(doc, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      ajax({
        auth: host.auth,
        type:'PUT',
        url: genUrl(host, doc._id),
        data: doc
      }, callback);
    };
    db.bulkDocs = function(req, opts, callback) {
      if (typeof opts.newEdits !== 'undefined') {
        req.new_edits = opts.newEdits;
      }
      ajax({auth: host.auth, type:'POST', url: genUrl(host, '_bulk_docs'), data: req}, callback);
    };
    db.allDocs = function(opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      ajax({auth: host.auth, type:'GET', url: genUrl(host, '_all_docs')}, callback);
    };

    db.changes = function(opts, callback) {
      if (opts instanceof Function) {
        opts = {complete: opts};
      }
      if (callback) {
        opts.complete = callback;
      }

      var params = '?style=all_docs'
      if (opts.include_docs) {
        params += '&include_docs=true'
      }
      if (opts.since) {
        params += '&since=' + opts.since;
      }
      ajax({auth: host.auth, type:'GET', url: genUrl(host, '_changes' + params)}, function(err, res) {
        res.results.forEach(function(c) {
          call(opts.onChange, c);
        });
        call(opts.complete, null, res);
      });
    };

    db.revsDiff = function(req, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      ajax({auth: host.auth, type:'POST', url: genUrl(host, '_revs_diff'), data: req}, function(err, res) {
        call(callback, null, res);
      });
    };


    ajax({auth: host.auth, type: 'PUT', url: genUrl(host, '')}, function(err, ret) {
      if (!err || err.status === 412) {
        call(callback, null, db);
      }
    });
  }

  // This opens a database, creating it if needed and returns the api
  // used to access the database
  var makePouch = function(idb, name) {

    // Firefox requires a unique key for every idb object we store, the
    // BY_SEQ_STORE doesnt have a natural key (the autoIncrement is supposed
    // to be its key) so we just give it the current time + an incrementing
    // number
    var junkSeed = 0;

    // Now we create the PouchDB interface
    var db = {update_seq: 0};

    // Wrapper for functions that call the bulkdocs api with a single doc,
    // if the first result is an error, return an error
    var singularErr = function(callback) {
      return function(err, results) {
        if (err || results[0].error) {
          call(callback, err || results[0]);
        } else {
          call(callback, null, results[0]);
        }
      };
    };

    // Pretty much all below can be combined into a higher order function to
    // traverse revisions
    // Turn a tree into a list of rootToLeaf paths
    var expandTree = function(all, i, tree) {
      all.push({rev: i + '-' + tree[0], status: 'available'});
      tree[1].forEach(function(child) {
        expandTree(all, i + 1, child);
      });
    }

    var collectRevs = function(path) {
      var revs = [];
      expandTree(revs, path.pos, path.ids);
      return revs;
    }

    var collectLeavesInner = function(all, pos, tree) {
      if (!tree[1].length) {
        all.push({rev: pos + '-' + tree[0]});
      }
      tree[1].forEach(function(child) {
        collectLeavesInner(all, pos+1, child);
      });
    }

    var collectLeaves = function(revs) {
      var leaves = [];
      revs.forEach(function(tree) {
        collectLeavesInner(leaves, tree.pos, tree.ids);
      });
      return leaves;
    }

    var collectConflicts = function(revs) {
      var leaves = collectLeaves(revs);
      // First is current rev
      leaves.shift();
      return leaves.map(function(x) { return x.rev; });
    }

    // Each database needs a unique id so that we can store the sequence
    // checkpoint without having other databases confuse itself, since
    // localstorage is per host this shouldnt conflict, if localstorage
    // gets wiped it isnt fatal, replications will just start from scratch
    db.id = function() {
      var id = localJSON.get(name + '_id', null);
      if (id === null) {
        id = Math.uuid();
        localJSON.set(name + '_id', id);
      }
      return id;
    };

    // Looping through all the documents in the database is a terrible idea
    // easiest to implement though, should probably keep a counter
    db.info = function(callback) {
      var count = 0;
      idb.transaction([DOC_STORE], IDBTransaction.READ)
        .objectStore(DOC_STORE).openCursor().onsuccess = function(e) {
          var cursor = e.target.result;
          if (!cursor) {
            return callback(null, {
              db_name: name.replace(/^pouch:/, ''),
              doc_count: count,
              update_seq: db.update_seq
            });
          }
          if (cursor.value.deleted !== true) {
            count++;
          }
          cursor['continue']();
        };
    };

    // First we look up the metadata in the ids database, then we fetch the
    // current revision(s) from the by sequence store
    db.get = function(id, opts, callback) {

      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      if (/\//.test(id) && !/^_local/.test(id)) {
        var docId = id.split('/')[0];
        var attachId = id.split('/')[1];
        var req = idb.transaction([DOC_STORE], IDBTransaction.READ)
          .objectStore(DOC_STORE).get(docId)
          .onsuccess = function(e) {
            var metadata = e.target.result;
            var nreq = idb.transaction([BY_SEQ_STORE], IDBTransaction.READ)
              .objectStore(BY_SEQ_STORE).get(metadata.seq)
              .onsuccess = function(e) {
                var digest = e.target.result._attachments[attachId].digest;
                var req = idb.transaction([ATTACH_STORE], IDBTransaction.READ)
                  .objectStore(ATTACH_STORE).get(digest)
                  .onsuccess = function(e) {
                    call(callback, null, atob(e.target.result.body));
                  };
              };
          }
        return;
      }

      var req = idb.transaction([DOC_STORE], IDBTransaction.READ)
        .objectStore(DOC_STORE).get(id);

      req.onsuccess = function(e) {
        var metadata = e.target.result;
        if (!e.target.result || metadata.deleted) {
          return call(callback, Errors.MISSING_DOC);
        }

        var nreq = idb.transaction([BY_SEQ_STORE], IDBTransaction.READ)
          .objectStore(BY_SEQ_STORE).get(metadata.seq);
        nreq.onsuccess = function(e) {
          var doc = e.target.result;
          delete doc._junk;
          doc._id = metadata.id;
          doc._rev = metadata.rev;
          if (opts.revs_info) {
            doc._revs_info = metadata.revisions.reduce(function(prev, current) {
              return prev.concat(collectRevs(current));
            }, []);
          }
          callback(null, doc);
        };
      };
    };

    db.remove = function(doc, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      var newDoc = JSON.parse(JSON.stringify(doc));
      newDoc._deleted = true;
      return db.bulkDocs({docs: [newDoc]}, opts, singularErr(callback));
    };

    db.putAttachment = function(id, rev, doc, type, callback) {
      var docId = id.split('/')[0];
      var attachId = id.split('/')[1];
      db.get(docId, function(err, obj) {
        obj._attachments[attachId] = {
          content_type: type,
          data: btoa(doc)
        }
        db.put(obj, callback);
      });
      //console.log(id);
      //call(callback);
    };

    db.put = db.post = function(doc, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      return db.bulkDocs({docs: [doc]}, opts, singularErr(callback));
    };

    db.revsDiff = function(req, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      var ids = Object.keys(req);
      var count = 0;
      var missing = {};

      function readDoc(err, doc, id) {
        req[id].map(function(revId) {
          if (!doc || doc._revs_info.every(function(x) { return x.rev !== revId; })) {
            if (!missing[id]) {
              missing[id] = {missing: []};
            }
            missing[id].missing.push(revId);
          }
        });

        if (++count === ids.length) {
          return call(callback, null, missing);
        }
      }

      ids.map(function(id) {
        db.get(id, {revs_info: true}, function(err, doc) {
          readDoc(err, doc, id);
        });
      });
    };

    db.bulkDocs = function(req, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      if (!req.docs) {
        return call(callback, Errors.MISSING_BULK_DOCS);
      }

      var newEdits = 'new_edits' in opts ? opts.new_edits : true;
      // We dont want to modify the users variables in place, JSON is kinda
      // nasty for a deep clone though

      var docs = JSON.parse(JSON.stringify(req.docs));

      // Parse and sort the docs
      var docInfos = docs.map(function(doc, i) {
        var newDoc = parseDoc(doc, newEdits);
        // We want to ensure the order of the processing and return of the docs,
        // so we give them a sequence number
        newDoc._bulk_seq = i;
        return newDoc;
      });

      docInfos.sort(function(a, b) {
        return compareRevs(a.metadata, b.metadata);
      });

      var keyRange = IDBKeyRange.bound(
        docInfos[0].metadata.id, docInfos[docInfos.length-1].metadata.id,
        false, false);

      // This groups edits to the same document together
      var buckets = docInfos.reduce(function(acc, docInfo) {
        if (docInfo.metadata.id === acc[0][0].metadata.id) {
          acc[0].push(docInfo);
        } else {
          acc.unshift([docInfo]);
        }
        return acc;
      }, [[docInfos.shift()]]);

      //The reduce screws up the array ordering
      buckets.reverse();
      buckets.forEach(function(bucket) {
        bucket.sort(function(a, b) { return a._bulk_seq - b._bulk_seq; });
      });

      var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE],
                               IDBTransaction.READ_WRITE);
      var results = [];

      txn.oncomplete = function(event) {
        results.sort(function(a, b) {
          return a._bulk_seq - b._bulk_seq;
        });

        results.forEach(function(result) {
          delete result._bulk_seq;
          db.changes.emit(result);
        });
        call(callback, null, results);
      };

      txn.onerror = function(event) {
        if (callback) {
          var code = event.target.errorCode;
          var message = Object.keys(IDBDatabaseException)[code-1].toLowerCase();
          callback({
            error : event.type,
            reason : message
          });
        }
      };

      txn.ontimeout = function(event) {
        if (callback) {
          var code = event.target.errorCode;
          var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
          callback({
            error : event.type,
            reason : message
          });
        }
      };

      // right now fire and forget, needs cleaned
      function saveAttachment(digest, data) {
        txn.objectStore(ATTACH_STORE).put({digest: digest, body: data});
      }

      function winningRev(pos, tree) {
        if (!tree[1].length) {
          return pos + '-' + tree[0];
        }
        return winningRev(pos + 1, tree[1][0]);
      }

      var writeDoc = function(docInfo, callback) {

        for (var key in docInfo.data._attachments) {
          if (!docInfo.data._attachments[key].stub) {
            docInfo.data._attachments[key].stub = true;
            var data = docInfo.data._attachments[key].data;
            var digest = 'md5-' + Crypto.MD5(data);
            delete docInfo.data._attachments[key].data;
            docInfo.data._attachments[key].digest = digest;
            saveAttachment(digest, data);
          }
        }
        //console.log(docInfo);
        // The doc will need to refer back to its meta data document
        docInfo.data._id = docInfo.metadata.id;
        if (docInfo.metadata.deleted) {
          docInfo.data._deleted = true;
        }
        docInfo.data._junk = new Date().getTime() + (++junkSeed);
        var dataReq = txn.objectStore(BY_SEQ_STORE).put(docInfo.data);
        dataReq.onsuccess = function(e) {
          docInfo.metadata.seq = e.target.result;
          // We probably shouldnt even store the winning rev, just figure it
          // out on read
          docInfo.metadata.rev = winningRev(docInfo.metadata.revisions[0].pos,
                                            docInfo.metadata.revisions[0].ids);
          var metaDataReq = txn.objectStore(DOC_STORE).put(docInfo.metadata);
          metaDataReq.onsuccess = function() {
            results.push({
              ok: true,
              id: docInfo.metadata.id,
              rev: docInfo.metadata.rev,
              _bulk_seq: docInfo._bulk_seq
            });
            call(callback);
          };
        };
      };

      var makeErr = function(err, seq) {
        err._bulk_seq = seq;
        return err;
      };

      var cursReq = txn.objectStore(DOC_STORE)
        .openCursor(keyRange, IDBCursor.NEXT);

      var update = function(cursor, oldDoc, docInfo, callback) {
        var mergedRevisions = pouch.merge(oldDoc.revisions,
                                          docInfo.metadata.revisions[0], 1000);
        var inConflict = (oldDoc.deleted && docInfo.metadata.deleted) ||
          (!oldDoc.deleted && newEdits && mergedRevisions.conflicts !== 'new_leaf');
        if (inConflict) {
          results.push(makeErr(Errors.REV_CONFLICT, docInfo._bulk_seq));
          call(callback);
          return cursor['continue']();
        }

        docInfo.metadata.revisions = mergedRevisions.tree;

        writeDoc(docInfo, function() {
          cursor['continue']();
          call(callback);
        });
      };

      var insert = function(docInfo, callback) {
        if (docInfo.metadata.deleted) {
          results.push(Errors.MISSING_DOC);
          return;
        }
        writeDoc(docInfo, function() {
          call(callback);
        });
      };

      // If we receive multiple items in bulkdocs with the same id, we process the
      // first but mark rest as conflicts until can think of a sensible reason
      // to not do so
      var markConflicts = function(docs) {
        for (var i = 1; i < docs.length; i++) {
          results.push(makeErr(Errors.REV_CONFLICT, docs[i]._bulk_seq));
        }
      };

      cursReq.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
          var bucket = buckets.shift();
          update(cursor, cursor.value, bucket[0], function() {
            markConflicts(bucket);
          });
        } else {
          // Cursor has exceeded the key range so the rest are inserts
          buckets.forEach(function(bucket) {
            insert(bucket[0], function() {
              markConflicts(bucket);
            });
          });
        }
      };
    };

    db.allDocs = function(opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      var start = 'startkey' in opts ? opts.startkey : false;
      var end = 'endkey' in opts ? opts.endkey : false;

      var descending = 'descending' in opts ? opts.descending : false;
      descending = descending ? IDBCursor.PREV : null;

      var keyRange = start && end ? IDBKeyRange.bound(start, end, false, false)
        : start ? IDBKeyRange.lowerBound(start, true)
        : end ? IDBKeyRange.upperBound(end) : false;
      var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE], IDBTransaction.READ);
      var oStore = transaction.objectStore(DOC_STORE);
      var oCursor = keyRange ? oStore.openCursor(keyRange, descending)
        : oStore.openCursor(null, descending);
      var results = [];
      oCursor.onsuccess = function(e) {
        if (!e.target.result) {
          return callback(null, {
            total_rows: results.length,
            rows: results
          });
        }
        var cursor = e.target.result;
        function allDocsInner(metadata, data) {
          if (metadata.deleted !== true) {
            var doc = {
              id: metadata.id,
              key: metadata.id,
              value: {rev: metadata.rev}
            };
            if (opts.include_docs) {
              doc.doc = data;
              doc.doc._rev = metadata.rev;
              delete doc.doc._junk;
              if (opts.conflicts) {
                doc.doc._conflicts = collectConflicts(metadata.revisions);
              }
            }
            results.push(doc);
          }
          cursor['continue']();
        }

        if (!opts.include_docs) {
          allDocsInner(cursor.value);
        } else {
          var index = transaction.objectStore(BY_SEQ_STORE);
          index.get(cursor.value.seq).onsuccess = function(event) {
            allDocsInner(cursor.value, event.target.result);
          };
        }
      }
    };

    db.changes = function(opts, callback) {
      if (opts instanceof Function) {
        opts = {complete: opts};
      }
      if (callback) {
        opts.complete = callback;
      }
      if (!opts.seq) {
        opts.seq = 0;
      }
      var descending = 'descending' in opts ? opts.descending : false;
      descending = descending ? IDBCursor.PREV : null;

      var results = [];
      var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE]);
      var request = transaction.objectStore(BY_SEQ_STORE)
        .openCursor(IDBKeyRange.lowerBound(opts.seq), descending);
      request.onsuccess = function(event) {
        if (!event.target.result) {
          if (opts.continuous) {
            db.changes.addListener(opts.onChange);
          }
          return call(opts.complete, null, {results: results});
        }
        var cursor = event.target.result;
        var index = transaction.objectStore(DOC_STORE);
        index.get(cursor.value._id).onsuccess = function(event) {
          var doc = event.target.result;
          var c = {
            id: doc.id,
            seq: cursor.key,
            changes: collectLeaves(doc.revisions)
          };
          if (doc.deleted) {
            c.deleted = true;
          }
          if (opts.include_docs) {
            c.doc = cursor.value;
            c.doc._rev = c.changes[0].rev;
            if (opts.conflicts) {
              c.doc._conflicts = collectConflicts(doc.revisions);
            }
          }
          // Dedupe the changes feed
          results = results.filter(function(doc) {
            return doc.id !== c.id;
          });
          results.push(c);
          call(opts.onChange, c);
          cursor['continue']();
        };
      };
      request.onerror = function(error) {
        // Cursor is out of range
        // NOTE: What should we do with a sequence that is too high?
        if (opts.continuous) {
          db.changes.addListener(opts.onChange);
        }
        call(opts.complete);
      };
    };

    db.changes.listeners = [];

    db.changes.emit = function() {
      var a = arguments;
      db.changes.listeners.forEach(function(l) {
        l.apply(l, a);
      });
    };
    db.changes.addListener = function(l) {
      db.changes.listeners.push(l);
    };

    db.replicate = {};

    db.replicate.from = function (url, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      pouch.open(url, function(err, remote) {
        if (err) {
          return call(callback, {error: 'borked'});
        }
        replicate(remote, db, callback);
      });
    };

    db.replicate.to = function(dbName, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      pouch.open(dbName, function(err, remote) {
        if (err) {
          return call(callback, {error: 'borked'});
        }
        replicate(db, remote, callback);
      });
    };

    return db;
  };

  pouch.open = function(name, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    if (opts.http || /^http:/.test(name)) {
      return makeCouch(name, opts, callback);
    }

    name = 'pouch:' + name;

    if (name in pouchCache) {
      return call(callback, null, pouchCache[name]);
    }

    var req = indexedDB.open(name, POUCH_VERSION);

    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      db.createObjectStore(DOC_STORE, {keyPath : 'id'})
        .createIndex('seq', 'seq', {unique : true});
      // We are giving a _junk key because firefox really doesnt like
      // writing without a key
      db.createObjectStore(BY_SEQ_STORE, {keyPath: '_junk', autoIncrement : true});
      db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
    };

    req.onsuccess = function(e) {

      var db = e.target.result;

      db.onversionchange = function() {
        db.close();
        delete pouchCache[name];
      };

      // polyfill the new onupgradeneeded api for chrome
      if (db.setVersion && Number(db.version) !== POUCH_VERSION) {
        var versionReq = db.setVersion(POUCH_VERSION);
        versionReq.onsuccess = function() {
          req.onupgradeneeded(e);
          req.onsuccess(e);
        };
        return;
      }

      pouchCache[name] = makePouch(db, name);
      call(callback, null, pouchCache[name]);
    };

    req.onerror = function(e) {
      call(callback, {error: 'open', reason: e.toString()});
    };
  };


  pouch.deleteDatabase = function(name, opts, callback) {

    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    if (opts.http || /^http:/.test(name)) {
      var host = getHost(name);
      ajax({auth: host.auth, type: 'DELETE', url: genUrl(host, '')}, callback);
    } else {
      var req = indexedDB.deleteDatabase('pouch:' + name);

      req.onsuccess = function() {
        call(callback, null);
      };

      req.onerror = function(e) {
        call(callback, {error: 'delete', reason: e.toString()});
      };
    }
  };

}).call(this);
