/*jshint strict: false */
/*global request: true, Buffer: true, escape: true, $:true */
/*global extend: true, Crypto: true */

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
//  - rev: (optional) the revision to check. defaults to metadata.rev
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

var collectConflicts = function(revs, deletions) {
  // Remove all deleted leaves
  var leaves = collectLeaves(revs);
  for(var i = 0; i < leaves.length; i++){
    var leaf = leaves.shift();
    var rev = leaf.rev.split("-")[1]; 
    if(deletions && !deletions[rev]){
      leaves.push(leaf);
    } 
  }

  // First is current rev
  leaves.shift();
  return leaves.map(function(x) { return x.rev; });
};

var fetchCheckpoint = function(src, target, opts, callback) {
  var filter_func = '';
  if (typeof opts.filter !== "undefined") {
    filter_func = opts.filter.toString();
  }

  var id = Crypto.MD5(src.id() + target.id() + filter_func);
  src.get('_local/' + id, function(err, doc) {
    if (err && err.status === 404) {
      callback(0);
    } else {
      callback(doc.last_seq);
    }
  });
};

var writeCheckpoint = function(src, target, opts, checkpoint, callback) {
  var filter_func = '';
  if (typeof opts.filter !== "undefined") {
    filter_func = opts.filter.toString();
  }

  var check = {
    _id: '_local/' + Crypto.MD5(src.id() + target.id() + filter_func),
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

var ajax = function ajax(options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  var defaultOptions = {
    method : "GET",
    headers: {},
    json: true,
    timeout: 10000
  };
  options = extend(true, defaultOptions, options);
  if (options.auth) {
      var token = btoa(options.auth.username + ':' + options.auth.password);
      options.headers.Authorization = 'Basic ' + token;
  }
  var onSuccess = function(obj, resp, cb){
    if (!options.json && typeof obj !== 'string') {
          obj = JSON.stringify(obj);
    } else if (options.json && typeof obj === 'string') {
          obj = JSON.parse(obj);
    }
    call(cb, null, obj, resp);
  };
  var onError = function(err, cb){
    var errParsed;
    var errObj = err.responseText ? {status: err.status} : err; //this seems too clever
         try{
          errParsed = JSON.parse(err.responseText); //would prefer not to have a try/catch clause
          errObj = extend(true, {}, errObj, errParsed);
         } catch(e){}
         call(cb, errObj);
  };
  if (typeof window !== 'undefined' && window.XMLHttpRequest) {
    var timer,timedout  = false;
    var xhr = new XMLHttpRequest();
    xhr.open(options.method, options.url);
    if (options.json) {
      options.headers.Accept = 'application/json';
      options.headers['Content-Type'] = 'application/json';
      if (options.body && typeof options.body !== "string") {
        options.body = JSON.stringify(options.body);
      }
    }
    for (var key in options.headers){
      xhr.setRequestHeader(key, options.headers[key]);
    }
    if (!("body" in options)) {
      options.body = null;
    }

    var abortReq = function() {
        timedout=true;
        xhr.abort();
        call(onError, xhr, callback);
    };
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4 || timedout) {
        return;
      }
      clearTimeout(timer);
      if (xhr.status >= 200 && xhr.status < 300){
        call(onSuccess, xhr.responseText, xhr, callback);
      } else {
         call(onError, xhr, callback);
      }
    };
    if (options.timeout > 0) {
      timer = setTimeout(abortReq, options.timeout);
    }
    xhr.send(options.body);
    return {abort:abortReq};
  } else {
    if (options.json) {
      options.headers.Accept = 'application/json';
      options.headers['Content-Type'] = 'application/json';
    }
    return request(options, function(err, response, body) {
      if (err) {
        err.status = response ? response.statusCode : 400;
        return call(onError, err, callback);
      }

      var content_type = response.headers['content-type'];
      var data = (body || '');

      // CouchDB doesn't always return the right content-type for JSON data, so
      // we check for ^{ and }$ (ignoring leading/trailing whitespace)
      if (options.json && typeof data !== 'object' &&
          (/json/.test(content_type) ||
           (/^[\s]*\{/.test(data) && /\}[\s]*$/.test(data)))) {
        data = JSON.parse(data);
      }

      if (data.error) {
        data.status = response.statusCode;
        call(onError, data, callback);
      }
      else {
        call(onSuccess, data, response, callback);
      }
    });
  }
};

// Extends method
// (taken from http://code.jquery.com/jquery-1.9.0.js)
// Populate the class2type map
var class2type = {};

var types = ["Boolean", "Number", "String", "Function", "Array", "Date", "RegExp", "Object", "Error"];
for (var i = 0; i < types.length; i++) {
  var typename = types[i];
  class2type[ "[object " + typename + "]" ] = typename.toLowerCase();
}

var core_toString = class2type.toString;
var core_hasOwn = class2type.hasOwnProperty;

var type = function(obj) {
  if (obj === null) {
    return String( obj );
  }
  return typeof obj === "object" || typeof obj === "function" ?
    class2type[core_toString.call(obj)] || "object" :
    typeof obj;
};

var isWindow = function(obj) {
  return obj !== null && obj === obj.window;
};

var isPlainObject = function( obj ) {
  // Must be an Object.
  // Because of IE, we also have to check the presence of the constructor property.
  // Make sure that DOM nodes and window objects don't pass through, as well
  if ( !obj || type(obj) !== "object" || obj.nodeType || isWindow( obj ) ) {
    return false;
  }

  try {
    // Not own constructor property must be Object
    if ( obj.constructor &&
      !core_hasOwn.call(obj, "constructor") &&
      !core_hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
      return false;
    }
  } catch ( e ) {
    // IE8,9 Will throw exceptions on certain host objects #9897
    return false;
  }

  // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.

  var key;
  for ( key in obj ) {}

  return key === undefined || core_hasOwn.call( obj, key );
};

var isFunction = function(obj) {
  return type(obj) === "function";
};

var isArray = Array.isArray || function(obj) {
  return type(obj) === "array";
};

var extend = function() {
  var options, name, src, copy, copyIsArray, clone,
    target = arguments[0] || {},
    i = 1,
    length = arguments.length,
    deep = false;

  // Handle a deep copy situation
  if ( typeof target === "boolean" ) {
    deep = target;
    target = arguments[1] || {};
    // skip the boolean and the target
    i = 2;
  }

  // Handle case when target is a string or something (possible in deep copy)
  if ( typeof target !== "object" && !isFunction(target) ) {
    target = {};
  }

  // extend jQuery itself if only one argument is passed
  if ( length === i ) {
    target = this;
    --i;
  }

  for ( ; i < length; i++ ) {
    // Only deal with non-null/undefined values
    if ((options = arguments[ i ]) != null) {
      // Extend the base object
      for ( name in options ) {
        src = target[ name ];
        copy = options[ name ];

        // Prevent never-ending loop
        if ( target === copy ) {
          continue;
        }

        // Recurse if we're merging plain objects or arrays
        if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = isArray(copy)) ) ) {
          if ( copyIsArray ) {
            copyIsArray = false;
            clone = src && isArray(src) ? src : [];

          } else {
            clone = src && isPlainObject(src) ? src : {};
          }

          // Never move original objects, clone them
          target[ name ] = extend( deep, clone, copy );

        // Don't bring in undefined values
        } else if ( copy !== undefined ) {
          target[ name ] = copy;
        }
      }
    }
  }

  // Return the modified object
  return target;
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

if (typeof module !== 'undefined' && module.exports) {
  // use node.js's crypto library instead of the Crypto object created by deps/uuid.js
  var crypto = require('crypto');
  var Crypto = {
    MD5: function(str) {
      return crypto.createHash('md5').update(str).digest('hex');
    }
  };
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
    fetchCheckpoint: fetchCheckpoint,
    writeCheckpoint: writeCheckpoint,
    arrayFirst: arrayFirst,
    filterChange: filterChange,
    ajax: ajax,
    atob: function(str) {
      return decodeURIComponent(escape(new Buffer(str, 'base64').toString('binary')));
    },
    btoa: function(str) {
      return new Buffer(unescape(encodeURIComponent(str)), 'binary').toString('base64');
    },
    extend: extend,
    traverseRevTree: traverseRevTree,
    rootToLeaf: rootToLeaf,
    isPlainObject: isPlainObject,
    isArray: isArray
  };
}

var Changes = function() {

  var api = {};
  var listeners = {};

  window.addEventListener("storage", function(e) {
    api.notify(e.key);
  });

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

  api.notify = function(db_name) {
    if (!listeners[db_name]) { return; }
    for (var i in listeners[db_name]) {
      /*jshint loopfunc: true */
      var opts = listeners[db_name][i].opts;
      listeners[db_name][i].db.changes({
        include_docs: opts.include_docs,
        conflicts: opts.conflicts,
        continuous: false,
        filter: opts.filter,
        since: opts.since,
        onChange: function(c) {
          if (c.seq > opts.since) {
            opts.since = c.seq;
            call(opts.onChange, c);
          }
        }
      });
    }
  };

  return api;
};

