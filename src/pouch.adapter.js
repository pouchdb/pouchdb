/*
 * A generic adapter module for PouchDB.
 */

var PouchAdapter = function(storage) {
  var update_seq = 0;

  var api = {
    open: function(callback) {
      storage.init(callback);
    },

    close: function() {
    },

    id: function() {
    },

    info: function() {
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

      api.storage.getMetadata(id.docId, function(err, metadata) {
        if (err || !metadata || (isDeleted(metadata) && !opts.rev)) {
          return call(callback, Pouch.Errors.MISSING_DOC);
        }

        var seq = opts.rev
          ? metadata.rev_map[opts.rev]
          : metadata.seq;

        api.storage.getSequence(seq, function(err, doc) {
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
    },

    bulkDocs: function(docs, opts, callback) {
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

