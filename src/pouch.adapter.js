/*globals yankError: false, extend: false, call: false, parseDocId: false */

"use strict";

/*
 * A generic pouch adapter
 */
var PouchAdapter = function(opts, callback) {


  var api = {};
  var customApi = Pouch.adapters[opts.adapter](opts, function(err, db) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return;
    }

    for (var j in api) {
      if (!db.hasOwnProperty(j)) {
        db[j] = api[j];
      }
    }
    callback(err, db);
  });


  api.post = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return customApi.bulkDocs({docs: [doc]}, opts, yankError(callback));
  };

  api.put = function(doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (!doc || !('_id' in doc)) {
      return call(callback, Pouch.Errors.MISSING_ID);
    }
    return customApi.bulkDocs({docs: [doc]}, opts, yankError(callback));
  };


  api.putAttachment = api.putAttachment = function (id, rev, doc, type, callback) {
    if (typeof type === 'function') {
      callback = type;
      type = undefined;
    }
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
      obj._attachments[id.attachmentId] = {
        content_type: type || doc.type,
        data: doc
      };
      api.put(obj, callback);
    });
  };

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
    return customApi.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
  };


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


  /* Begin api wrappers. Specific funtionality to storage belongs in the _[method] */
  api.get = function (id, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    id = parseDocId(id);
    if (id.attachmentId !== '') {
      return customApi.getAttachment(id, callback);
    }
    return customApi._get(id, opts, callback);

  };

  api.getAttachment = function(id, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (typeof id === 'string') {
      id = parseDocId(id);
    }

    return customApi._getAttachment(id, opts, callback);
  };

  api.allDocs = function(opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if ('keys' in opts) {
      if ('startkey' in opts) {
        call(callback, extend({
          reason: 'Query parameter `start_key` is not compatible with multi-get'
        }, Pouch.Errors.QUERY_PARSE_ERROR));
        return;
      }
      if ('endkey' in opts) {
        call(callback, extend({
          reason: 'Query parameter `end_key` is not compatible with multi-get'
        }, Pouch.Errors.QUERY_PARSE_ERROR));
        return;
      }
    }

    return customApi._allDocs(opts, callback);
  };

  api.changes = function(opts) {
    return customApi._changes(opts);
  };

  api.close = function(callback) {
    return customApi._close(callback);
  };

  api.info = function(callback) {
    return customApi._info(callback);
  };
  
  api.id = function() {
    return customApi._id();
  };
  
  api.type = function() {
    return (typeof customApi._type === 'function') ? customApi._type() : opts.adapter;
  };

  api.bulkDocs = function(req, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (!opts) {
      opts = {};
    }

    if (!req || !req.docs || req.docs.length < 1) {
      return call(callback, Pouch.Errors.MISSING_BULK_DOCS);
    }

    if (!Array.isArray(req.docs)) {
      return call(callback, Pouch.Errors.QUERY_PARSE_ERROR);
    }

    return customApi._bulkDocs(req, opts, callback);
  };

  /* End Wrappers */

  api.replicate = {};

  api.replicate.from = function (url, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, customApi, opts, callback);
  };

  api.replicate.to = function (dbName, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(customApi, dbName, opts, callback);
  };

  for (var j in api) {
    if (!customApi.hasOwnProperty(j)) {
      customApi[j] = api[j];
    }
  }
  return customApi;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PouchAdapter;
}
