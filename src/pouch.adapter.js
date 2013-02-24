/*globals yankError: false, extend: false, call: false, parseDocId: false */

"use strict";

/*
 * A generic pouch adapter
 */
var PouchAdapter = function(opts, callback) {
  var api = Pouch.adapters[opts.adapter](opts, callback);

  api.replicate = {};

  if (!api.hasOwnProperty('post')) {
    api.post = function (doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      return api.bulkDocs({docs: [doc]}, opts, yankError(callback));
    };
  }

  if (!api.hasOwnProperty('put')) {

    api.put = function(doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }

      if (!doc || !('_id' in doc)) {
        return call(callback, Pouch.Errors.MISSING_ID);
      }
      return api.bulkDocs({docs: [doc]}, opts, yankError(callback));
    };

  }

  if (!api.hasOwnProperty('putAttachment')) {
    api.putAttachment = api.putAttachment = function (id, rev, doc, type, callback) {
      id = parseDocId(id);
      api.get(id.docId, {attachments: true}, function(err, obj) {
        obj._attachments = obj._attachments || {};
        obj._attachments[id.attachmentId] = {
          content_type: type,
          data: btoa(doc)
        };
        api.put(obj, callback);
      });
    };
  }

  if (!api.hasOwnProperty('removeAttachment')) {
     api.removeAttachment = function (id, rev, callback) {
      id = parseDocId(id);
      api.get(id.docId, function(err, obj) {
        if (err) {
          call(callback, err);
          return;
        }

        if (obj._rev !== rev) {
          call(callback, Pouch.Errors.REV_CONFLICT);
          return;
        }

        obj._attachments = obj._attachments || {};
        delete obj._attachments[id.attachmentId];
        api.put(obj, callback);
      });
    };
  }

  if (!api.hasOwnProperty('remove')) {
    api.remove = function (doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      if (opts === undefined) {
        opts = {};
      }
      opts.was_delete = true;
      var newDoc = extend(true, {}, doc);
      newDoc._deleted = true;
      return api.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
    };

  }

  if (!api.hasOwnProperty('revsDiff')) {
    api.revsDiff = function (req, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      var ids = Object.keys(req);
      var count = 0;
      var missing = {};

      function readDoc(err, doc, id) {
        req[id].map(function(revId) {
          var matches = function(x) { return x.rev !== revId; };
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

      ids.map(function(id) {
        api.get(id, {revs_info: true}, function(err, doc) {
          readDoc(err, doc, id);
        });
      });
    };

  }

  api.replicate.from = function (url, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, api, opts, callback);
  };

  api.replicate.to = function (dbName, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(api, dbName, opts, callback);
  };

  return api;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PouchAdapter;
}
