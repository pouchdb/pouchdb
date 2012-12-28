/*
 * A generic adapter module for PouchDB.
 */

var PouchAdapter = function(storage) {
  var update_seq = 0;
  var doc_count = 0;

  var api = {
    open: function(callback) {
      storage.init(function(err) {
        if (err) return call(callback, err);
        storage.getUpdateSeq(function(err, seq) {
          if (err) return call(callback, err);
          update_seq = seq;
          call(callback);
        });
      });
    },

    close: function(callback) {
      return storage.close(callback);
    },

    id: function() {
      return storage.id();
    },

    info: function(callback) {
      return call(callback, null, {
        name: storage.id(),
        doc_count: doc_count,
        update_seq: update_seq
      });
    },

    get: function(id, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      id = Pouch.utils.parseDocId(id);
      if (id.attachmentId !== '') {
        return api.getAttachment(id, {decode: true}, callback);
      }

      storage.getMetadata(id.docId, function(err, metadata) {
        if (err || !metadata || (isDeleted(metadata) && !opts.rev)) {
          return call(callback, Pouch.Errors.MISSING_DOC);
        }

        var seq = opts.rev
          ? metadata.rev_map[opts.rev]
          : metadata.seq;

        storage.getSequence(seq, function(err, doc) {
          doc._id = metadata.id;
          doc._rev = Pouch.utils.winningRev(metadata);

          if (opts.revs) {
            var path = Pouch.utils.arrayFirst(
              Pouch.utils.rootToLeaf(metadata.rev_tree),
              function(arr) {
                return arr.ids.indexOf(doc._rev.split('-')[1]) !== -1
              }
            );
            path.ids.reverse();
            doc._revisions = {
              start: (path.pos + path.ids.length) - 1,
              ids: path.ids
            };
          }

          if (opts.revs_info) {
            doc._revs_info = metadata.rev_tree.reduce(function(prev, current) {
              return prev.concat(Pouch.utils.collectRevs(current));
            }, []);
          }

          if (opts.conflicts) {
            var conflicts = Pouch.utils.collectConflicts(metadata.rev_tree);
            if (conflicts.length) {
              doc._conflicts = conflicts;
            }
          }
          if (opts.attachments && doc._attachments) {
            var attachments = Object.keys(doc._attachments);
            var recv = 0;

            attachments.forEach(function(key) {
              api.getAttachment(doc._id + '/' + key, function(err, data) {
                doc._attachments[key].data = data;

                if (++recv === attachments.length) {
                  callback(null, doc);
                }
              });
            });
          }
          else {
            if (doc._attachments){
              for (var key in doc._attachments) {
                doc._attachments[key].stub = true;
              }
            }
            callback(null, doc);
          }
        });
      });
    },

    getAttachment: function(id, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      id = id.docId ? id : Pouch.utils.parseDocId(id);
      if (id.attachmentId === '') {
        return api.get(id, opts, callback);
      }

      storage.readMetadata(id.docId, function(err, metadata) {
        if (err) {
          return call(callback, err);
        }
        storage.readSequence(metadata.seq, function(err, doc) {
          if (err) {
            return call(callback, err);
          }
          var digest = doc._attachments[id.attachmendId].digest
            , type = doc._attachments[id.attachmentId].content_type

          storage.readAttachment(digest, function(err, attachment) {
            if (err) {
              return call(callback, err);
            }

            var data = opts.decode
              ? Pouch.utils.atob(attach.body.toString())
              : attach.body.toString();

            call(callback, null, data);
          });
        });
      });
    },

    put: function(doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }

      if (!doc || !('_id' in doc)) {
        return call(callback, Pouch.Errors.MISSING_ID);
      }
      return api.bulkDocs({docs: [doc]}, opts, yankError(callback));
    },

    post: function(doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      return api.bulkDocs({docs: [doc]}, opts, yankError(callback));
    },

    putAttachment: function(id, rev, data, type, callback) {
      id = parseDocId(id);
      api.get(id.docId, {attachments: true}, function(err, obj) {
        obj._attachments || (obj._attachments = {});
        obj._attachments[id.attachmentId] = {
          content_type: type,
          data: btoa(doc)
        }
        api.put(obj, callback);
      });
    },

    remove: function(doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      opts.was_delete = true;
      var newDoc = JSON.parse(JSON.stringify(doc));
      newDoc._deleted = true;
      return api.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
    },

    removeAttachment: function(id, rev, callback) {
      id = parseDocId(id);
      api.get(id.docId, function(err, obj) {
        if (err) {
          call(callback, err);
          return;
        }

        if (obj._rev != rev) {
          call(callback, Pouch.Errors.REV_CONFLICT);
          return;
        }

        obj._attachments || (obj._attachments = {});
        delete obj._attachments[id.attachmentId];
        api.put(obj, callback);
      });
    },

    allDocs: function(opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      storage.getBulkMetadata(opts, function(err, metadatas) {
        if (err) return call(callback, err);
        var processed = 0;
        var results = {total_rows:0, rows: []};
        if (metadatas.length == 0) {
          return call(callback, null, results);
        }
        function addResult(result) {
          processed++;
          results.rows.push(result);
          if (processed === metadatas.length) {
            results.total_rows = results.rows.length;
            return call(callback, null, results);
          }
        }

        metadatas.forEach(function(metadata) {
          if (/^_local/.test(metadata.id)) {
            processed++;
            return;
          }
          if (isDeleted(metadata)) {
            processed++;
          } else {
            var result = {
              id: metadata.id,
              key: metadata.id,
              value: {
                rev: Pouch.utils.winningRev(metadata)
              }
            }
            if (opts.include_docs) {
              storage.getSequence(metadata.seq, function(err, doc) {
                result.doc = doc;
                result.doc._rev = result.value.rev;
                if (opts.conflicts) {
                  result.doc._conflicts = Pouch.utils.collectConflicts(metadata.rev_tree);
                }
                addResult(result);
              });
            }
            else {
              addResult(result);
            }
          }
        });
      });
    },

    bulkDocs: function(bulk, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      if (!opts) {
        opts = {};
      }

      if (!bulk || !bulk.docs || bulk.docs.length < 1) {
        return call(callback, Pouch.Errors.MISSING_BULK_DOCS);
      }
      if (!Array.isArray(bulk.docs)) {
        return error(callback, new Error("docs should be an array of documents"));
      }

      var newEdits = opts.new_edits !== undefined ? opts.new_edits : true
        , info = []
        , docs = []
        , results = []

      // parse the docs and give each a sequence number
      var userDocs = JSON.parse(JSON.stringify(bulk.docs));
      info = userDocs.map(function(doc, i) {
        var newDoc = Pouch.utils.parseDoc(doc, newEdits);
        newDoc._bulk_seq = i;
        if (newDoc.metadata && !newDoc.metadata.rev_map) {
          newDoc.metadata.rev_map = {};
        }
        if (doc._deleted) {
          if (!newDoc.metadata.deletions) {
            newDoc.metadata.deletions = {};
          }
          newDoc.metadata.deletions[doc._rev.split('-')[1]] = true;
        }

        return newDoc;
      });

      // group multiple edits to the same document
      info.forEach(function(info) {
        if (info.error) {
          return results.push(info);
        }
        if (!docs.length || info.metadata.id !== docs[docs.length-1].metadata.id) {
          return docs.push(info);
        }
        results.push(makeErr(Pouch.Errors.REV_CONFLICT, info._bulk_seq));
      });

      processDocs();

      function processDocs() {
        if (docs.length === 0) {
          return complete();
        }
        var currentDoc = docs.pop();
        storage.getMetadata(currentDoc.metadata.id, function(err, oldDoc) {
          if (err) { // && err.name == 'NotFoundError') {
            insertDoc(currentDoc, processDocs);
          }
          else {
            updateDoc(oldDoc, currentDoc, processDocs);
          }
        });
      }

      function insertDoc(doc, callback) {
        // Can't insert new deleted documents
        if ('was_delete' in opts && isDeleted(doc.metadata)) {
          results.push(makeErr(Pouch.Errors.MISSING_DOC, doc._bulk_seq));
          return callback();
        }
        doc_count++;
        writeDoc(doc, callback);
      }

      function updateDoc(oldDoc, docInfo, callback) {
        var merged = Pouch.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

        var conflict = (isDeleted(oldDoc) && isDeleted(docInfo.metadata)) ||
          (!isDeleted(oldDoc) && newEdits && merged.conflicts !== 'new_leaf');

        if (conflict) {
          results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
          return call(callback);
        }

        docInfo.metadata.rev_tree = merged.tree;
        docInfo.metadata.rev_map = oldDoc.rev_map;
        writeDoc(docInfo, callback);
      }

      function writeDoc(doc, callback) {
        var err = null;
        var recv = 0;

        doc.data._id = doc.metadata.id;

        if (isDeleted(doc.metadata)) {
          doc.data._deleted = true;
        }

        var attachments = doc.data._attachments
          ? Object.keys(doc.data._attachments)
          : [];
        for (var i=0; i<attachments.length; i++) {
          var key = attachments[i];
          if (!doc.data._attachments[key].stub) {
            var data = doc.data._attachments[key].data
            // if data is an object, it's likely to actually be a Buffer that got JSON.stringified
            if (typeof data === 'object') data = new Buffer(data);
            var digest = 'md5-' + crypto.createHash('md5')
                  .update(data || '')
                  .digest('hex');
            delete doc.data._attachments[key].data;
            doc.data._attachments[key].digest = digest;
            saveAttachment(doc, digest, data, function (err) {
              recv++;
              collectResults(err);
            });
          } else {
            recv++;
            collectResults();
          }
        }

        if(!attachments.length) {
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

        function finish() {
          update_seq++;
          doc.metadata.seq = update_seq;
          doc.metadata.rev_map[doc.metadata.rev] = doc.metadata.seq;

          storage.writeSequence(doc.metadata.seq, doc.data, function(err) {
            if (err) {
              return console.error(err);
            }

            storage.writeMetadata(doc.metadata.id, doc.metadata, function(err) {
              results.push(doc);
              return call(callback, null);
            });
          });
        }
      }

      function saveAttachment(docInfo, digest, data, callback) {
        storage.getAttachment(digest, function(err, oldAtt) {
          if (err && err.name !== 'NotFoundError') {
            callback(err);
            return console.error(err);
          }

          var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
          var newAtt = {body: data};

          if (oldAtt) {
            if (oldAtt.refs) {
              // only update references if this attachment already has them
              // since we cannot migrate old style attachments here without
              // doing a full db scan for references
              newAtt.refs = oldAtt.refs;
              newAtt.refs[ref] = true;
            }
          } else {
            newAtt.refs = {}
            newAtt.refs[ref] = true;
          }

          storage.writeAttachment(digest, newAtt, function(err) {
            return call(callback, err);
          });
        });
      }
      function complete() {
        var aresults = [];
        results.sort(function(a, b) { return a._bulk_seq - b._bulk_seq });

        results.forEach(function(result) {
          delete result._bulk_seq;
          if (result.error) {
            return aresults.push(result);
          }
          var metadata = result.metadata
            , rev = Pouch.utils.winningRev(metadata);

          aresults.push({
            ok: true,
            id: metadata.id,
            rev: rev,
          });

          if (/_local/.test(metadata.id)) {
            return;
          }

          var change = {
            id: metadata.id,
            seq: metadata.seq,
            changes: Pouch.utils.collectLeaves(metadata.rev_tree),
            doc: result.data
          }
          change.doc._rev = rev;

          Pouch.changes.emitChange(api.id(), change);
        });

        return call(callback, null, aresults);
      }

      function makeErr(err, seq) {
        err._bulk_seq = seq;
        return err;
      }

    },

    revsDiff: function(req, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      var ids = Object.keys(req)
        , count = 0
        , missing = {};

      ids.map(function(id) {
        api.get(id, {revs_info: true}, function(err, doc) {
          readDoc(err, doc, id);
        });
      });

      function readDoc(err, doc, id) {
        req[id].map(function(revId) {
          var matches = function(x) { return x.rev !== revId };
          if (!doc || doc._revs_info.every(matches)) {
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
    },

    changes: function(opts, callback) {
      if (opts instanceof Function && callback === undefined) {
        callback = opts;
        opts = {};
      }
      if (callback) {
        opts.complete = callback;
      }
      if (!opts.seq) {
        opts.seq = 1;
      }
      if (opts.since) {
        opts.seq = opts.since;
      }

      var descending = 'descending' in opts ? opts.descending : false
        , results = []
        , listenerId = Math.uuid();

      if (opts.filter && typeof opts.filter === 'string') {
        var filter = opts.filter.split('/')
          , ddoc = filter[0]
          , filtername = filter[1]
        if (typeof filtername !== 'string' || filtername === '') {
          return call(opts.complete, new Error('Invalid filtername:'+opts.filter));
        }
        api.get('_design/'+ddoc, function(err, design) {
          if (err) {
            return call(opts.complete, err);
          }
          var filter = eval('(function() { return ' +
                            design.filters[filtername] + '})()');
          opts.filter = filter;
          fetchChanges();
        });
      }
      else {
        fetchChanges();
      }

      function fetchChanges() {
        var seq_opts = {
          descending: descending,
          since: opts.seq
        }

        if (opts.continuous && !opts.cancelled) {
          Pouch.changes.addListener(api.id(), listenerId, opts);
        }

        storage.getBulkSequence(seq_opts, function(err, seqs) {
          var processed = 0
            , results = []
            , resultIndices = {}

          function addChange(change) {
            processed++;

            if (opts.filter && !opts.filter(change.doc)) {
              return;
            }
            if (!opts.include_docs) {
              delete change.doc;
            }
            call(opts.onChange, change);

            var changeIndex = resultIndices[change.id]
            if (changeIndex !== undefined) {
              console.log(results[changeIndex], change);
              results[changeIndex] = null;
            }
            results.push(change);
            resultIndices[change.id] = results.length - 1;

            // finished!
            if (processed === seqs.length) {
              // remove nulls resulting from the de-duping process
              results = results.filter(function(doc) {
                return doc !== null;
              });
              call(opts.complete, null, {results: results});
            }
          }

          seqs.forEach(function(doc) {
            storage.getMetadata(doc._id, function(err, metadata) {
              if (/^_local/.test(metadata.id)) {
                processed++;
                return;
              }

              var change = {
                id: metadata.id,
                seq: metadata.seq,
                changes: Pouch.utils.collectLeaves(metadata.rev_tree),
                doc: doc
              }
              change.doc._rev = Pouch.utils.winningRev(metadata);

              if (isDeleted(metadata)) {
                change.deleted = true;
              }
              if (opts.conflicts) {
                change.doc._conflicts = Pouch.utils.collectConflicts(metadata.rev_tree);
              }

              addChange(change);
            });
          });
        });
      }
      if (opts.continuous) {
        return {
          cancel: function() {
            opts.cancelled = true;
            Pouch.changes.removeListener(api.id(), listenerId);
          }
        }
      }
    },

    query: function(fun, opts, callback) {
    },

    replicate : {
      from: function(dbname, opts, callback) {
        if (opts instanceof Function) {
          callback = opts;
          opts = {};
        }
        return Pouch.replicate(dbname, api, opts, callback);
      },
      to: function(dbname, opts, callback) {
        if (opts instanceof Function) {
          callback = opts;
          opts = {};
        }
        return Pouch.replicate(api, dbname, opts, callback);
      }
    }
  }

  return api;
}

module.exports = PouchAdapter;

