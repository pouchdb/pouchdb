/*jshint strict: false */
/*global chrome */

var merge = require('./merge');
exports.extend = require('./deps/extend');
exports.ajax = require('./deps/ajax');
exports.createBlob = require('./deps/blob');
var uuid = require('./deps/uuid');
exports.Crypto = require('./deps/md5.js');
var buffer = require('./deps/buffer');
var errors = require('./deps/errors');

exports.error = function (error, reason) {
  return exports.extend({}, error, {reason: reason});
};
// List of top level reserved words for doc
var reservedWords = [
  '_id',
  '_rev',
  '_attachments',
  '_deleted',
  '_revisions',
  '_revs_info',
  '_conflicts',
  '_deleted_conflicts',
  '_local_seq',
  '_rev_tree'
];
exports.uuids = function (count, options) {

  if (typeof(options) !== 'object') {
    options = {};
  }

  var length = options.length;
  var radix = options.radix;
  var uuids = [];

  while (uuids.push(uuid(length, radix)) < count) { }

  return uuids;
};

// Give back one UUID
exports.uuid = function (options) {
  return exports.uuids(1, options)[0];
};
// Determine id an ID is valid
//   - invalid IDs begin with an underescore that does not begin '_design' or '_local'
//   - any other string value is a valid id
function isValidId(id) {
  if (/^_/.test(id)) {
    return (/^_(design|local)/).test(id);
  }
  return true;
}

function isChromeApp() {
  return (typeof chrome !== "undefined" &&
          typeof chrome.storage !== "undefined" &&
          typeof chrome.storage.local !== "undefined");
}

// Pretty dumb name for a function, just wraps callback calls so we dont
// to if (callback) callback() everywhere
exports.call = function (fun) {
  if (typeof fun === typeof Function) {
    var args = Array.prototype.slice.call(arguments, 1);
    fun.apply(this, args);
  }
};

exports.isLocalId = function (id) {
  return (/^_local/).test(id);
};

// check if a specific revision of a doc has been deleted
//  - metadata: the metadata object from the doc store
//  - rev: (optional) the revision to check. defaults to winning revision
exports.isDeleted = function (metadata, rev) {
  if (!rev) {
    rev = merge.winningRev(metadata);
  }
  if (rev.indexOf('-') >= 0) {
    rev = rev.split('-')[1];
  }
  var deleted = false;
  merge.traverseRevTree(metadata.rev_tree, function (isLeaf, pos, id, acc, opts) {
    if (id === rev) {
      deleted = !!opts.deleted;
    }
  });

  return deleted;
};

exports.filterChange = function (opts) {
  return function (change) {
    var req = {};
    var hasFilter = opts.filter && typeof opts.filter === 'function';

    req.query = opts.query_params;
    if (opts.filter && hasFilter && !opts.filter.call(this, change.doc, req)) {
      return false;
    }
    if (opts.doc_ids && opts.doc_ids.indexOf(change.id) === -1) {
      return false;
    }
    if (!opts.include_docs) {
      delete change.doc;
    } else {
      for (var att in change.doc._attachments) {
        change.doc._attachments[att].stub = true;
      }
    }
    return true;
  };
};

exports.processChanges = function (opts, changes, last_seq) {
  // TODO: we should try to filter and limit as soon as possible
  changes = changes.filter(exports.filterChange(opts));
  if (opts.limit) {
    if (opts.limit < changes.length) {
      changes.length = opts.limit;
    }
  }
  changes.forEach(function (change) {
    exports.call(opts.onChange, change);
  });
  exports.call(opts.complete, null, {results: changes, last_seq: last_seq});
};

// Preprocess documents, parse their revisions, assign an id and a
// revision for new writes that are missing them, etc
exports.parseDoc = function (doc, newEdits) {
  var error = null;
  var nRevNum;
  var newRevId;
  var revInfo;
  var opts = {status: 'available'};
  if (doc._deleted) {
    opts.deleted = true;
  }

  if (newEdits) {
    if (!doc._id) {
      doc._id = exports.uuid();
    }
    newRevId = exports.uuid({length: 32, radix: 16}).toLowerCase();
    if (doc._rev) {
      revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      if (!revInfo) {
        throw "invalid value for property '_rev'";
      }
      doc._rev_tree = [{
        pos: parseInt(revInfo[1], 10),
        ids: [revInfo[2], {status: 'missing'}, [[newRevId, opts, []]]]
      }];
      nRevNum = parseInt(revInfo[1], 10) + 1;
    } else {
      doc._rev_tree = [{
        pos: 1,
        ids : [newRevId, opts, []]
      }];
      nRevNum = 1;
    }
  } else {
    if (doc._revisions) {
      doc._rev_tree = [{
        pos: doc._revisions.start - doc._revisions.ids.length + 1,
        ids: doc._revisions.ids.reduce(function (acc, x) {
          if (acc === null) {
            return [x, opts, []];
          } else {
            return [x, {status: 'missing'}, [acc]];
          }
        }, null)
      }];
      nRevNum = doc._revisions.start;
      newRevId = doc._revisions.ids[0];
    }
    if (!doc._rev_tree) {
      revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      if (!revInfo) {
        return errors.BAD_ARG;
      }
      nRevNum = parseInt(revInfo[1], 10);
      newRevId = revInfo[2];
      doc._rev_tree = [{
        pos: parseInt(revInfo[1], 10),
        ids: [revInfo[2], opts, []]
      }];
    }
  }

  if (typeof doc._id !== 'string') {
    error = errors.INVALID_ID;
  }
  else if (!isValidId(doc._id)) {
    error = errors.RESERVED_ID;
  }

  for (var key in doc) {
    if (doc.hasOwnProperty(key) && key[0] === '_' && reservedWords.indexOf(key) === -1) {
      error = exports.extend({}, errors.DOC_VALIDATION);
      error.reason += ': ' + key;
    }
  }

  doc._id = decodeURIComponent(doc._id);
  doc._rev = [nRevNum, newRevId].join('-');

  if (error) {
    return error;
  }

  return Object.keys(doc).reduce(function (acc, key) {
    if (/^_/.test(key) && key !== '_attachments') {
      acc.metadata[key.slice(1)] = doc[key];
    } else {
      acc.data[key] = doc[key];
    }
    return acc;
  }, {metadata : {}, data : {}});
};

exports.isCordova = function () {
  return (typeof cordova !== "undefined" ||
          typeof PhoneGap !== "undefined" ||
          typeof phonegap !== "undefined");
};

exports.Changes = function () {

  var api = {};
  var listeners = {};

  if (isChromeApp()) {
    chrome.storage.onChanged.addListener(function (e) {
      // make sure it's event addressed to us
      if (e.db_name != null) {
        api.notify(e.db_name.newValue);//object only has oldValue, newValue members
      }
    });
  } else if (typeof window !== 'undefined') {
    window.addEventListener("storage", function (e) {
      api.notify(e.key);
    });
  }

  api.addListener = function (db_name, id, db, opts) {
    if (!listeners[db_name]) {
      listeners[db_name] = {};
    }
    listeners[db_name][id] = {
      db: db,
      opts: opts
    };
  };

  api.removeListener = function (db_name, id) {
    if (listeners[db_name]) {
      delete listeners[db_name][id];
    }
  };

  api.clearListeners = function (db_name) {
    delete listeners[db_name];
  };

  api.notifyLocalWindows = function (db_name) {
    //do a useless change on a storage thing
    //in order to get other windows's listeners to activate
    if (!isChromeApp()) {
      localStorage[db_name] = (localStorage[db_name] === "a") ? "b" : "a";
    } else {
      chrome.storage.local.set({db_name: db_name});
    }
  };

  api.notify = function (db_name) {
    if (!listeners[db_name]) { return; }

    Object.keys(listeners[db_name]).forEach(function (i) {
      var opts = listeners[db_name][i].opts;
      listeners[db_name][i].db.changes({
        include_docs: opts.include_docs,
        conflicts: opts.conflicts,
        continuous: false,
        descending: false,
        filter: opts.filter,
        view: opts.view,
        since: opts.since,
        query_params: opts.query_params,
        onChange: function (c) {
          if (c.seq > opts.since && !opts.cancelled) {
            opts.since = c.seq;
            exports.call(opts.onChange, c);
          }
        }
      });
    });
  };

  return api;
};

if (typeof window === 'undefined' || !('atob' in window)) {
  exports.atob = function (str) {
    var base64 = new buffer(str, 'base64');
    // Node.js will just skip the characters it can't encode instead of
    // throwing and exception
    if (base64.toString('base64') !== str) {
      throw ("Cannot base64 encode full string");
    }
    return base64.toString('binary');
  };
} else {
  exports.atob = function (str) {
    return atob(str);
  };
}

if (typeof window === 'undefined' || !('btoa' in window)) {
  exports.btoa = function (str) {
    return new buffer(str, 'binary').toString('base64');
  };
} else {
  exports.btoa = function (str) {
    return btoa(str);
  };
}


module.exports = exports;
