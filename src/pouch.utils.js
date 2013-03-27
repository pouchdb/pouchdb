/*jshint strict: false */
/*global request: true, Buffer: true, escape: true, $:true */
/*global extend: true, Crypto: true */
/*global chrome*/

// Pretty dumb name for a function, just wraps callback calls so we dont
// to if (callback) callback() everywhere
var call = function(fun) {
  var args = Array.prototype.slice.call(arguments, 1);
  if (typeof fun === typeof Function) {
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

// Parse document ids: docid[/attachid]
//   - /attachid is optional, and can have slashes in it too
//   - int ids and strings beginning with _design or _local are not split
// returns an object: { docId: docid, attachmentId: attachid }
var parseDocId = function(id) {
  var ids = (typeof id === 'string') && !(/^_(design|local)\//.test(id)) ?
    id.split('/') : [id];
  return {
    docId: ids[0],
    attachmentId: ids.splice(1).join('/').replace(/^\/+/, '')
  };
};

// check if a specific revision of a doc has been deleted
//  - metadata: the metadata object from the doc store
//  - rev: (optional) the revision to check. defaults to winning revision
var isDeleted = function(metadata, rev) {
  if (!metadata || !metadata.deletions) {
    return false;
  }
  if (!rev) {
    rev = Pouch.merge.winningRev(metadata);
  }
  if (rev.indexOf('-') >= 0) {
    rev = rev.split('-')[1];
  }

  return metadata.deletions[rev] === true;
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

// Preprocess documents, parse their revisions, assign an id and a
// revision for new writes that are missing them, etc
var parseDoc = function(doc, newEdits) {
  var error = null;

  // check for an attachment id and add attachments as needed
  if (doc._id) {
    var id = parseDocId(doc._id);
    if (id.attachmentId !== '') {
      var attachment = btoa(JSON.stringify(doc));
      doc = {_id: id.docId};
      if (!doc._attachments) {
        doc._attachments = {};
      }
      doc._attachments[id.attachmentId] = {
        content_type: 'application/json',
        data: attachment
      };
    }
  }

  var nRevNum;
  var newRevId;
  var revInfo;

  if (newEdits) {
    if (!doc._id) {
      doc._id = Math.uuid();
    }
    newRevId = Math.uuid(32, 16).toLowerCase();
    if (doc._rev) {
      revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      if (!revInfo) {
        throw "invalid value for property '_rev'";
      }
      doc._rev_tree = [{
        pos: parseInt(revInfo[1], 10),
        ids: [revInfo[2], [[newRevId, []]]]
      }];
      nRevNum = parseInt(revInfo[1], 10) + 1;
    } else {
      doc._rev_tree = [{
        pos: 1,
        ids : [newRevId, []]
      }];
      nRevNum = 1;
    }
  } else {
    if (doc._revisions) {
      doc._rev_tree = [{
        pos: doc._revisions.start - doc._revisions.ids.length + 1,
        ids: doc._revisions.ids.reduce(function(acc, x) {
          if (acc === null) {
            return [x, []];
          } else {
            return [x, [acc]];
          }
        }, null)
      }];
      nRevNum = doc._revisions.start;
      newRevId = doc._revisions.ids[0];
    }
    if (!doc._rev_tree) {
      revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      nRevNum = parseInt(revInfo[1], 10);
      newRevId = revInfo[2];
      doc._rev_tree = [{
        pos: parseInt(revInfo[1], 10),
        ids: [revInfo[2], []]
      }];
    }
  }

  if (typeof doc._id !== 'string') {
    error = Pouch.Errors.INVALID_ID;
  }
  else if (!isValidId(doc._id)) {
    error = Pouch.Errors.RESERVED_ID;
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

// Pretty much all below can be combined into a higher order function to
// traverse revisions
// Callback has signature function(isLeaf, pos, id, [context])
// The return value from the callback will be passed as context to all children of that node
var traverseRevTree = function(revs, callback) {
  var toVisit = [];

  revs.forEach(function(tree) {
    toVisit.push({pos: tree.pos, ids: tree.ids});
  });

  while (toVisit.length > 0) {
    var node = toVisit.pop();
    var pos = node.pos;
    var tree = node.ids;
    var newCtx = callback(tree[1].length === 0, pos, tree[0], node.ctx);
    /*jshint loopfunc: true */
    tree[1].forEach(function(branch) {
      toVisit.push({pos: pos+1, ids: branch, ctx: newCtx});
    });
  }
};

var collectRevs = function(path) {
  var revs = [];

  traverseRevTree([path], function(isLeaf, pos, id) {
    revs.push({rev: pos + "-" + id, status: 'available'});
  });

  return revs;
};

var collectLeaves = function(revs) {
  var leaves = [];
  traverseRevTree(revs, function(isLeaf, pos, id) {
    if (isLeaf) {
      leaves.unshift({rev: pos + "-" + id, pos: pos});
    }
  });
  leaves.sort(function(a, b) {
    return b.pos - a.pos;
  });
  leaves.map(function(leaf) { delete leaf.pos; });
  return leaves;
};

// returns all conflicts that is leaves such that
// 1. are not deleted and
// 2. are different than winning revision
var collectConflicts = function(metadata) {
  var win = Pouch.merge.winningRev(metadata);
  var leaves = collectLeaves(metadata.rev_tree);
  var conflicts = [];
  leaves.forEach(function(leaf) {
    var rev = leaf.rev.split("-")[1]; 
    if ((!metadata.deletions || !metadata.deletions[rev]) && leaf.rev !== win) {
      conflicts.push(leaf.rev);
    } 
  });
  return conflicts;
};


// for every node in a revision tree computes its distance from the closest
// leaf
var computeHeight = function(revs) {
  var height = {};
  var edges = [];
  traverseRevTree(revs, function(isLeaf, pos, id, prnt) {
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
    if (opts.filter && !opts.filter.call(this, change.doc)) {
      return;
    }
    if (!opts.include_docs) {
      delete change.doc;
    }
    call(opts.onChange, change);
  };
};

// returns array of all branches from root to leaf in the ids form:
// [[id, ...], ...]
var rootToLeaf = function(tree) {
  var paths = [];
  traverseRevTree(tree, function(isLeaf, pos, id, history) {
    history = history ? history.slice(0) : [];
    history.push(id);
    if (isLeaf) {
      var rootPos = pos + 1 - history.length;
      paths.unshift({pos: rootPos, ids: history});
    }
    return history;
  });
  return paths;
};

var isChromeApp = function(){
  return (typeof chrome !== "undefined" && typeof chrome.storage !== "undefined" && typeof chrome.storage.local !== "undefined");
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
    parseDocId: parseDocId,
    parseDoc: parseDoc,
    isDeleted: isDeleted,
    compareRevs: compareRevs,
    collectRevs: collectRevs,
    collectLeaves: collectLeaves,
    collectConflicts: collectConflicts,
    computeHeight: computeHeight,
    arrayFirst: arrayFirst,
    filterChange: filterChange,
    atob: function(str) {
      return decodeURIComponent(escape(new Buffer(str, 'base64').toString('binary')));
    },
    btoa: function(str) {
      return new Buffer(unescape(encodeURIComponent(str)), 'binary').toString('base64');
    },
    extend: extend,
    ajax: ajax,
    traverseRevTree: traverseRevTree,
    rootToLeaf: rootToLeaf,
    isChromeApp: isChromeApp
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

