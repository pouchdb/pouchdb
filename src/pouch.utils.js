/*jshint strict: false */
/*global request: true, Buffer: true, escape: true, $:true */
/*global extend: true, Crypto: true */
/*global chrome*/

// Pretty dumb name for a function, just wraps callback calls so we dont
// to if (callback) callback() everywhere
var call = function(fun) {
  if (typeof fun === typeof Function) {
    var args = Array.prototype.slice.call(arguments, 1);
    fun.apply(this, args);
  }
};

// Wrapper for functions that call the bulkdocs api with a single doc,
// if the first result is an error, return an error
var yankError = function(callback) {
  return function(err, results) {
    if (err || results[0].error) {
      call(callback, err || results[0]);
    } else {
      call(callback, null, results[0]);
    }
  };
};

var isLocalId = function(id) {
  return (/^_local/).test(id);
};

var isAttachmentId = function(id) {
  return (/\//.test(id) && !isLocalId(id) && !/^_design/.test(id));
};

// Determine id an ID is valid
//   - invalid IDs begin with an underescore that does not begin '_design' or '_local'
//   - any other string value is a valid id
var isValidId = function(id) {
  if (/^_/.test(id)) {
    return (/^_(design|local)/).test(id);
  }
  return true;
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

// Preprocess documents, parse their revisions, assign an id and a
// revision for new writes that are missing them, etc
var parseDoc = function(doc, newEdits) {
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
      doc._id = Pouch.uuid();
    }
    newRevId = Pouch.uuid({length: 32, radix: 16}).toLowerCase();
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
        ids: doc._revisions.ids.reduce(function(acc, x) {
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
        return Pouch.Errors.BAD_ARG;
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
    error = Pouch.Errors.INVALID_ID;
  }
  else if (!isValidId(doc._id)) {
    error = Pouch.Errors.RESERVED_ID;
  }

  for (var key in doc) {
    if (doc.hasOwnProperty(key) && key[0] === '_' && reservedWords.indexOf(key) === -1) {
      error = extend({}, Pouch.Errors.DOC_VALIDATION);
      error.reason += ': ' + key;
    }
  }

  doc._id = decodeURIComponent(doc._id);
  doc._rev = [nRevNum, newRevId].join('-');

  if (error) {
    return error;
  }

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
  if (a.rev_tree[0].pos === b.rev_tree[0].pos) {
    return (a.rev_tree[0].ids < b.rev_tree[0].ids ? -1 : 1);
  }
  // Then by depth of edits
  return (a.rev_tree[0].start < b.rev_tree[0].start ? -1 : 1);
};


// for every node in a revision tree computes its distance from the closest
// leaf
var computeHeight = function(revs) {
  var height = {};
  var edges = [];
  Pouch.merge.traverseRevTree(revs, function(isLeaf, pos, id, prnt) {
    var rev = pos + "-" + id;
    if (isLeaf) {
      height[rev] = 0;
    }
    if (prnt !== undefined) {
      edges.push({from: prnt, to: rev});
    }
    return rev;
  });

  edges.reverse();
  edges.forEach(function(edge) {
    if (height[edge.from] === undefined) {
      height[edge.from] = 1 + height[edge.to];
    } else {
      height[edge.from] = Math.min(height[edge.from], 1 + height[edge.to]);
    }
  });
  return height;
};

// returns first element of arr satisfying callback predicate
var arrayFirst = function(arr, callback) {
  for (var i = 0; i < arr.length; i++) {
    if (callback(arr[i], i) === true) {
      return arr[i];
    }
  }
  return false;
};

var filterChange = function(opts) {
  return function(change) {
    var req = {};
    req.query = opts.query_params;
    if (opts.filter && !opts.filter.call(this, change.doc, req)) {
      return false;
    }
    if (opts.doc_ids && opts.doc_ids.indexOf(change.id) !== -1) {
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

var processChanges = function(opts, changes, last_seq) {
  // TODO: we should try to filter and limit as soon as possible
  changes = changes.filter(filterChange(opts));
  if (opts.limit) {
    if (opts.limit < changes.length) {
      changes.length = opts.limit;
    }
  }
  changes.forEach(function(change){
    call(opts.onChange, change);
  });
  call(opts.complete, null, {results: changes, last_seq: last_seq});
};

var rootToLeaf = function(tree) {
  var paths = [];
  Pouch.merge.traverseRevTree(tree, function(isLeaf, pos, id, history, opts) {
    history = history ? history.slice(0) : [];
    history.push({id: id, opts: opts});
    if (isLeaf) {
      var rootPos = pos + 1 - history.length;
      paths.unshift({pos: rootPos, ids: history});
    }
    return history;
  });
  return paths;
};

// check if a specific revision of a doc has been deleted
//  - metadata: the metadata object from the doc store
//  - rev: (optional) the revision to check. defaults to winning revision
var isDeleted = function(metadata, rev) {
  if (!rev) {
    rev = Pouch.merge.winningRev(metadata);
  }
  if (rev.indexOf('-') >= 0) {
    rev = rev.split('-')[1];
  }
  var deleted = false;
  Pouch.merge.traverseRevTree(metadata.rev_tree, function(isLeaf, pos, id, acc, opts) {
    if (id === rev) {
      deleted = !!opts.deleted;
    }
  });

  return deleted;
};

var isChromeApp = function(){
  return (typeof chrome !== "undefined" && typeof chrome.storage !== "undefined" && typeof chrome.storage.local !== "undefined");
};

var isCordova = function(){
  return (typeof cordova !== "undefined" || typeof PhoneGap !== "undefined" || typeof phonegap !== "undefined");
};

if (typeof module !== 'undefined' && module.exports) {
  // use node.js's crypto library instead of the Crypto object created by deps/uuid.js
  var crypto = require('crypto');
  var Crypto = {
    MD5: function(str) {
      return crypto.createHash('md5').update(str).digest('hex');
    }
  };
  var extend = require('./deps/extend');
  var ajax = require('./deps/ajax');

  request = require('request');
  _ = require('underscore');
  $ = _;

  module.exports = {
    Crypto: Crypto,
    call: call,
    yankError: yankError,
    isLocalId: isLocalId,
    isAttachmentId: isAttachmentId,
    parseDoc: parseDoc,
    isDeleted: isDeleted,
    compareRevs: compareRevs,
    computeHeight: computeHeight,
    arrayFirst: arrayFirst,
    filterChange: filterChange,
    processChanges: processChanges,
    atob: function(str) {
      var base64 = new Buffer(str, 'base64');
      // Node.js will just skip the characters it can't encode instead of
      // throwing and exception
      if (base64.toString('base64') !== str) {
        throw("Cannot base64 encode full string");
      }
      return base64.toString('binary');
    },
    btoa: function(str) {
      return new Buffer(str, 'binary').toString('base64');
    },
    extend: extend,
    ajax: ajax,
    rootToLeaf: rootToLeaf,
    isChromeApp: isChromeApp,
    isCordova: isCordova
  };
}

var Changes = function() {

  var api = {};
  var listeners = {};

  if (isChromeApp()){
    chrome.storage.onChanged.addListener(function(e){
      api.notify(e.db_name.newValue);//object only has oldValue, newValue members
    });
  }
  else {
    window.addEventListener("storage", function(e) {
      api.notify(e.key);
    });
  }

  api.addListener = function(db_name, id, db, opts) {
    if (!listeners[db_name]) {
      listeners[db_name] = {};
    }
    listeners[db_name][id] = {
      db: db,
      opts: opts
    };
  };

  api.removeListener = function(db_name, id) {
    delete listeners[db_name][id];
  };

  api.clearListeners = function(db_name) {
    delete listeners[db_name];
  };

  api.notifyLocalWindows = function(db_name){
    //do a useless change on a storage thing
    //in order to get other windows's listeners to activate
    if (!isChromeApp()){
      localStorage[db_name] = (localStorage[db_name] === "a") ? "b" : "a";
    } else {
      chrome.storage.local.set({db_name: db_name});
    }
  };

  api.notify = function(db_name) {
    if (!listeners[db_name]) { return; }

    Object.keys(listeners[db_name]).forEach(function (i) {
      var opts = listeners[db_name][i].opts;
      listeners[db_name][i].db.changes({
        include_docs: opts.include_docs,
        conflicts: opts.conflicts,
        continuous: false,
        descending: false,
        filter: opts.filter,
        since: opts.since,
        query_params: opts.query_params,
        onChange: function(c) {
          if (c.seq > opts.since && !opts.cancelled) {
            opts.since = c.seq;
            call(opts.onChange, c);
          }
        }
      });
    });
  };

  return api;
};
