// Pretty dumb name for a function, just wraps callback calls so we dont
// to if (callback) callback() everywhere
var call = function(fun) {
  var args = Array.prototype.slice.call(arguments, 1);
  if (typeof fun === typeof Function) {
    fun.apply(this, args);
  }
}

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

var isAttachmentId = function(id) {
  return (/\//.test(id)
      && !/^_local/.test(id)
      && !/^_design/.test(id));
}

// Parse document ids: docid[/attachid]
//   - /attachid is optional, and can have slashes in it too
//   - int ids and strings beginning with _design or _local are not split
// returns an object: { docId: docid, attachmentId: attachid }
var parseDocId = function(id) {
  var ids = (typeof id === 'string') && !(/^_(design|local)\//.test(id))
    ? id.split('/')
    : [id]
  return {
    docId: ids[0],
    attachmentId: ids.splice(1).join('/').replace(/^\/+/, '')
  }
}

// check if a specific revision of a doc has been deleted
//  - metadata: the metadata object from the doc store
//  - rev: (optional) the revision to check. defaults to metadata.rev
var isDeleted = function(metadata, rev) {
  if (!metadata || !metadata.deletions) return false;
  if (!rev) {
    rev = winningRev(metadata);
  }
  if (rev.indexOf('-') >= 0) {
    rev = rev.split('-')[1];
  }

  return metadata.deletions[rev] === true;
}

// Determine id an ID is valid
//   - invalid IDs begin with an underescore that does not begin '_design' or '_local'
//   - any other string value is a valid id
var isValidId = function(id) {
  if (/^_/.test(id)) {
    return /^_(design|local)/.test(id);
  }
  return true;
}

// Preprocess documents, parse their revisions, assign an id and a
// revision for new writes that are missing them, etc
var parseDoc = function(doc, newEdits) {
  var error = null;

  // check for an attachment id and add attachments as needed
  if (doc._id) {
    var id = parseDocId(doc._id);
    if (id.attachmentId !== '') {
      var attachment = btoa(JSON.stringify(doc));
      doc = {
        _id: id.docId,
      }
      if (!doc._attachments) {
        doc._attachments = {};
      }
      doc._attachments[id.attachmentId] = {
        content_type: 'application/json',
        data: attachment
      }
    }
  }

  if (newEdits) {
    if (!doc._id) {
      doc._id = Math.uuid();
    }
    var newRevId = Math.uuid(32, 16).toLowerCase();
    var nRevNum;
    if (doc._rev) {
      var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
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
      newRevId = doc._revisions.ids[doc._revisions.ids.length-1];
    }
    if (!doc._rev_tree) {
      var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
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

// Turn a tree into a list of rootToLeaf paths
function expandTree2(all, current, pos, arr) {
  current = current.slice(0);
  current.push(arr[0]);
  if (!arr[1].length) {
    all.push({pos: pos, ids: current});
  }
  arr[1].forEach(function(child) {
    expandTree2(all, current, pos, child);
  });
}

// We fetch all leafs of the revision tree, and sort them based on tree length
// and whether they were deleted, undeleted documents with the longest revision
// tree (most edits) win
var winningRev = function(metadata) {
  var deletions = metadata.deletions || {};
  var leafs = metadata.rev_tree.map(function(tree) {
    var leaf = treeLeaf(tree.pos, tree.ids);
    leaf.deleted = leaf.id in deletions;
    return leaf;
  });

  leafs.sort(function(a, b) {
    if (a.deleted !== b.deleted) {
      return a.deleted > b.deleted;
    }
    return a.pos > b.pos;
  });
  return leafs[0].pos + '-' + leafs[0].id;
}

var treeLeaf = function(pos, tree) {
  if (!tree[1].length) {
    return {pos: pos, id: tree[0]};
  }
  return treeLeaf(pos + 1, tree[1][0]);
}

var rootToLeaf = function(tree) {
  var all = [];
  tree.forEach(function(path) {
    expandTree2(all, [], path.pos, path.ids);
  });
  return all;
}

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
  }
}

var ajax = function ajax(options, callback) {
  if (options.success && callback === undefined) {
    callback = options.success;
  }

  var success = function sucess(obj, _, xhr) {
    // Chrome will parse some attachments that are JSON. We don't want that.
    if (options.dataType === false && typeof obj !== 'string') {
      obj = JSON.stringify(obj);
    }
    call(callback, null, obj, xhr);
  };
  var error = function error(err) {
    if (err) {
      var errObj = err.responseText
        ? {status: err.status}
        : err
      try {
        errObj = $.extend({}, errObj, JSON.parse(err.responseText));
      } catch (e) {}
      call(callback, errObj);
    } else {
      call(callback, true);
    }
  };

  var defaults = {
    success: success,
    error: error,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    dataType: 'json',
    timeout: 10000
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

  if ($.ajax) {
    return $.ajax(options);
  }
  else {
    // convert options from xhr api to request api
    if (options.data) {
      options.body = options.data;
      delete options.data;
    }
    if (options.type) {
      options.method = options.type;
      delete options.type;
    }
    if (options.auth) {
      var token = btoa(options.auth.username + ':' + options.auth.password);
      options.headers['Authorization'] = 'Basic ' + token;
    }

    return request(options, function(err, response, body) {
      if (err) {
        err.status = response ? response.statusCode : 400;
        return call(options.error, err);
      }

      var content_type = response.headers['content-type']
        , data = (body || '');

      // CouchDB doesn't always return the right content-type for JSON data, so
      // we check for ^{ and }$ (ignoring leading/trailing whitespace)
      if (options.dataType && (/json/.test(content_type)
          || (/^[\s]*{/.test(data) && /}[\s]*$/.test(data)))) {
        data = JSON.parse(data);
      }

      if (data.error) {
        data.status = response.statusCode;
        call(options.error, data);
      }
      else {
        call(options.success, data, 'OK', response);
      }
    });
  }
};

// Basic wrapper for localStorage
var win = this;
var localJSON = (function(){
  if (!win.localStorage) {
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

// btoa and atob don't exist in node. see https://developer.mozilla.org/en-US/docs/DOM/window.btoa
if (typeof btoa === 'undefined') {
  btoa = function(str) {
    return new Buffer(unescape(encodeURIComponent(str)), 'binary').toString('base64');
  }
}
if (typeof atob === 'undefined') {
  atob = function(str) {
    return decodeURIComponent(escape(new Buffer(str, 'base64').toString('binary')));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  // use node.js's crypto library instead of the Crypto object created by deps/uuid.js
  var crypto = require('crypto');
  var Crypto = {
    MD5: function(str) {
      return crypto.createHash('md5').update(str).digest('hex');
    }
  }
  request = require('request');
  _ = require('underscore');
  $ = _;

  module.exports = {
    Crypto: Crypto,
    call: call,
    yankError: yankError,
    isAttachmentId: isAttachmentId,
    parseDocId: parseDocId,
    parseDoc: parseDoc,
    isDeleted: isDeleted,
    compareRevs: compareRevs,
    expandTree: expandTree,
    collectRevs: collectRevs,
    collectLeavesInner: collectLeavesInner,
    collectLeaves: collectLeaves,
    collectConflicts: collectConflicts,
    fetchCheckpoint: fetchCheckpoint,
    writeCheckpoint: writeCheckpoint,
    winningRev: winningRev,
    rootToLeaf: rootToLeaf,
    arrayFirst: arrayFirst,
    filterChange: filterChange,
    ajax: ajax,
    atob: atob,
    btoa: btoa,
  }
}
