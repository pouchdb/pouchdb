!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.PouchDBVersion220=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
module.exports = "2.2.0";

},{}],2:[function(_dereq_,module,exports){
"use strict";

var utils = _dereq_('./utils');
var merge = _dereq_('./merge');
var errors = _dereq_('./deps/errors');
var EventEmitter = _dereq_('events').EventEmitter;
var upsert = _dereq_('./deps/upsert');
var Changes = _dereq_('./changes');
var Promise = utils.Promise;

/*
 * A generic pouch adapter
 */

// returns first element of arr satisfying callback predicate
function arrayFirst(arr, callback) {
  for (var i = 0; i < arr.length; i++) {
    if (callback(arr[i], i) === true) {
      return arr[i];
    }
  }
  return false;
}

// Wrapper for functions that call the bulkdocs api with a single doc,
// if the first result is an error, return an error
function yankError(callback) {
  return function (err, results) {
    if (err || results[0].error) {
      callback(err || results[0]);
    } else {
      callback(null, results[0]);
    }
  };
}

// for every node in a revision tree computes its distance from the closest
// leaf
function computeHeight(revs) {
  var height = {};
  var edges = [];
  merge.traverseRevTree(revs, function (isLeaf, pos, id, prnt) {
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
  edges.forEach(function (edge) {
    if (height[edge.from] === undefined) {
      height[edge.from] = 1 + height[edge.to];
    } else {
      height[edge.from] = Math.min(height[edge.from], 1 + height[edge.to]);
    }
  });
  return height;
}

function allDocsKeysQuery(api, opts, callback) {
  var keys =  ('limit' in opts) ?
      opts.keys.slice(opts.skip, opts.limit + opts.skip) :
      (opts.skip > 0) ? opts.keys.slice(opts.skip) : opts.keys;
  if (opts.descending) {
    keys.reverse();
  }
  if (!keys.length) {
    return api._allDocs({limit: 0}, callback);
  }
  var finalResults = {
    offset: opts.skip
  };
  return Promise.all(keys.map(function (key, i) {
    var subOpts = utils.extend(true, {key: key, deleted: 'ok'}, opts);
    ['limit', 'skip', 'keys'].forEach(function (optKey) {
      delete subOpts[optKey];
    });
    return new Promise(function (resolve, reject) {
      api._allDocs(subOpts, function (err, res) {
        if (err) {
          return reject(err);
        }
        finalResults.total_rows = res.total_rows;
        resolve(res.rows[0] || {key: key, error: 'not_found'});
      });
    });
  })).then(function (results) {
    finalResults.rows = results;
    return finalResults;
  });
}

utils.inherits(AbstractPouchDBVersion220, EventEmitter);
module.exports = AbstractPouchDBVersion220;

function AbstractPouchDBVersion220() {
  var self = this;
  EventEmitter.call(this);
  self.autoCompact = function (callback) {
    if (!self.auto_compaction) {
      return callback;
    }
    return function (err, res) {
      if (err) {
        callback(err);
      } else {
        var count = res.length;
        var decCount = function () {
          count--;
          if (!count) {
            callback(null, res);
          }
        };
        res.forEach(function (doc) {
          if (doc.ok) {
            // TODO: we need better error handling
            self.compactDocument(doc.id, 1, decCount);
          } else {
            decCount();
          }
        });
      }
    };
  };

  var listeners = 0, changes;
  var eventNames = ['change', 'delete', 'create', 'update'];
  this.on('newListener', function (eventName) {
    if (~eventNames.indexOf(eventName)) {
      if (listeners) {
        listeners++;
        return;
      } else {
        listeners++;
      }
    } else {
      return;
    }
    var lastChange = 0;
    changes = this.changes({
      conflicts: true,
      include_docs: true,
      continuous: true,
      since: 'latest',
      onChange: function (change) {
        if (change.seq <= lastChange) {
          return;
        }
        lastChange = change.seq;
        self.emit('change', change);
        if (change.doc._deleted) {
          self.emit('delete', change);
        } else if (change.doc._rev.split('-')[0] === '1') {
          self.emit('create', change);
        } else {
          self.emit('update', change);
        }
      }
    });
  });
  this.on('removeListener', function (eventName) {
    if (~eventNames.indexOf(eventName)) {
      listeners--;
      if (listeners) {
        return;
      }
    } else {
      return;
    }
    changes.cancel();
  });
}

AbstractPouchDBVersion220.prototype.post =
  utils.adapterFun('post', function (doc, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    return callback(errors.NOT_AN_OBJECT);
  }
  this.bulkDocs({docs: [doc]}, opts,
      this.autoCompact(yankError(callback)));
});

AbstractPouchDBVersion220.prototype.put =
  utils.adapterFun('put', utils.getArguments(function (args) {
  var temp, temptype, opts, callback;
  var doc = args.shift();
  var id = '_id' in doc;
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    callback = args.pop();
    return callback(errors.NOT_AN_OBJECT);
  }
  doc = utils.clone(doc);
  while (true) {
    temp = args.shift();
    temptype = typeof temp;
    if (temptype === "string" && !id) {
      doc._id = temp;
      id = true;
    } else if (temptype === "string" && id && !('_rev' in doc)) {
      doc._rev = temp;
    } else if (temptype === "object") {
      opts = temp;
    } else if (temptype === "function") {
      callback = temp;
    }
    if (!args.length) {
      break;
    }
  }
  opts = opts || {};
  var error = utils.invalidIdError(doc._id);
  if (error) {
    return callback(error);
  }
  this.bulkDocs({docs: [doc]}, opts,
      this.autoCompact(yankError(callback)));
}));

AbstractPouchDBVersion220.prototype.putAttachment =
  utils.adapterFun('putAttachment', function (docId, attachmentId, rev,
                                              blob, type, callback) {
  var api = this;
  if (typeof type === 'function') {
    callback = type;
    type = blob;
    blob = rev;
    rev = null;
  }
  if (typeof type === 'undefined') {
    type = blob;
    blob = rev;
    rev = null;
  }

  function createAttachment(doc) {
    doc._attachments = doc._attachments || {};
    doc._attachments[attachmentId] = {
      content_type: type,
      data: blob
    };
    return api.put(doc);
  }

  return api.get(docId).then(function (doc) {
    if (doc._rev !== rev) {
      throw errors.REV_CONFLICT;
    }

    return createAttachment(doc);
  }, function (err) {
     // create new doc
    if (err.error === errors.MISSING_DOC.error) {
      return createAttachment({_id: docId});
    } else {
      throw err;
    }
  });
});

AbstractPouchDBVersion220.prototype.removeAttachment =
  utils.adapterFun('removeAttachment', function (docId, attachmentId, rev,
                                                 callback) {
  var self = this;
  self.get(docId, function (err, obj) {
    if (err) {
      callback(err);
      return;
    }
    if (obj._rev !== rev) {
      callback(errors.REV_CONFLICT);
      return;
    }
    if (!obj._attachments) {
      return callback();
    }
    delete obj._attachments[attachmentId];
    if (Object.keys(obj._attachments).length === 0) {
      delete obj._attachments;
    }
    self.put(obj, callback);
  });
});

AbstractPouchDBVersion220.prototype.remove =
  utils.adapterFun('remove', function (doc, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  } else if (typeof opts === 'string') {
    doc = {
      _id: doc,
      _rev: opts
    };
  } else if (opts === undefined) {
    opts = {};
  }
  opts = utils.clone(opts);
  opts.was_delete = true;
  var newDoc = {_id: doc._id, _rev: doc._rev};
  newDoc._deleted = true;
  this.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
});

AbstractPouchDBVersion220.prototype.revsDiff =
  utils.adapterFun('revsDiff', function (req, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts = utils.clone(opts);
  var ids = Object.keys(req);
  var count = 0;
  var missing = {};

  function addToMissing(id, revId) {
    if (!missing[id]) {
      missing[id] = {missing: []};
    }
    missing[id].missing.push(revId);
  }

  function processDoc(id, rev_tree) {
    // Is this fast enough? Maybe we should switch to a set simulated by a map
    var missingForId = req[id].slice(0);
    merge.traverseRevTree(rev_tree, function (isLeaf, pos, revHash, ctx,
      opts) {
        var rev = pos + '-' + revHash;
        var idx = missingForId.indexOf(rev);
        if (idx === -1) {
          return;
        }

        missingForId.splice(idx, 1);
        if (opts.status !== 'available') {
          addToMissing(id, rev);
        }
      });

    // Traversing the tree is synchronous, so now `missingForId` contains
    // revisions that were not found in the tree
    missingForId.forEach(function (rev) {
      addToMissing(id, rev);
    });
  }

  ids.map(function (id) {
    this._getRevisionTree(id, function (err, rev_tree) {
      if (err && err.name === 'not_found' && err.message === 'missing') {
        missing[id] = {missing: req[id]};
      } else if (err) {
        return callback(err);
      } else {
        processDoc(id, rev_tree);
      }

      if (++count === ids.length) {
        return callback(null, missing);
      }
    });
  }, this);
});

// compact one document and fire callback
// by compacting we mean removing all revisions which
// are further from the leaf in revision tree than max_height
AbstractPouchDBVersion220.prototype.compactDocument =
  function (docId, max_height, callback) {
  var self = this;
  this._getRevisionTree(docId, function (err, rev_tree) {
    if (err) {
      return callback(err);
    }
    var height = computeHeight(rev_tree);
    var candidates = [];
    var revs = [];
    Object.keys(height).forEach(function (rev) {
      if (height[rev] > max_height) {
        candidates.push(rev);
      }
    });

    merge.traverseRevTree(rev_tree, function (isLeaf, pos, revHash, ctx, opts) {
      var rev = pos + '-' + revHash;
      if (opts.status === 'available' && candidates.indexOf(rev) !== -1) {
        opts.status = 'missing';
        revs.push(rev);
      }
    });
    self._doCompaction(docId, rev_tree, revs, callback);
  });
};

// compact the whole database using single document
// compaction
AbstractPouchDBVersion220.prototype.compact =
  utils.adapterFun('compact', function (opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  var self = this;
  this.changes({complete: function (err, res) {
    if (err) {
      callback(); // TODO: silently fail
      return;
    }
    var count = res.results.length;
    if (!count) {
      callback();
      return;
    }
    res.results.forEach(function (row) {
      self.compactDocument(row.id, 0, function () {
        count--;
        if (!count) {
          callback();
        }
      });
    });
  }});
});

/* Begin api wrappers. Specific functionality to storage belongs in the 
   _[method] */
AbstractPouchDBVersion220.prototype.get =
  utils.adapterFun('get', function (id, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof id !== 'string') {
    return callback(errors.INVALID_ID);
  }
  var leaves = [], self = this;
  function finishOpenRevs() {
    var result = [];
    var count = leaves.length;
    if (!count) {
      return callback(null, result);
    }
    // order with open_revs is unspecified
    leaves.forEach(function (leaf) {
      self.get(id,
               {rev: leaf, revs: opts.revs, attachments: opts.attachments},
               function (err, doc) {
        if (!err) {
          result.push({ok: doc});
        } else {
          result.push({missing: leaf});
        }
        count--;
        if (!count) {
          callback(null, result);
        }
      });
    });
  }

  if (opts.open_revs) {
    if (opts.open_revs === "all") {
      this._getRevisionTree(id, function (err, rev_tree) {
        if (err) {
          // if there's no such document we should treat this
          // situation the same way as if revision tree was empty
          rev_tree = [];
        }
        leaves = merge.collectLeaves(rev_tree).map(function (leaf) {
          return leaf.rev;
        });
        finishOpenRevs();
      });
    } else {
      if (Array.isArray(opts.open_revs)) {
        leaves = opts.open_revs;
        for (var i = 0; i < leaves.length; i++) {
          var l = leaves[i];
          // looks like it's the only thing couchdb checks
          if (!(typeof(l) === "string" && /^\d+-/.test(l))) {
            return callback(errors.error(errors.BAD_REQUEST,
              "Invalid rev format"));
          }
        }
        finishOpenRevs();
      } else {
        return callback(errors.error(errors.UNKNOWN_ERROR,
          'function_clause'));
      }
    }
    return; // open_revs does not like other options
  }

  return this._get(id, opts, function (err, result) {
    opts = utils.clone(opts);
    if (err) {
      return callback(err);
    }

    var doc = result.doc;
    if (!doc) {
      // a smoke test for something being very wrong
      return callback(new Error('no doc!'));
    }
    var metadata = result.metadata;
    var ctx = result.ctx;

    if (opts.conflicts) {
      var conflicts = merge.collectConflicts(metadata);
      if (conflicts.length) {
        doc._conflicts = conflicts;
      }
    }

    if (opts.revs || opts.revs_info) {
      var paths = merge.rootToLeaf(metadata.rev_tree);
      var path = arrayFirst(paths, function (arr) {
        return arr.ids.map(function (x) { return x.id; })
          .indexOf(doc._rev.split('-')[1]) !== -1;
      });

      path.ids.splice(path.ids.map(function (x) {return x.id; })
                      .indexOf(doc._rev.split('-')[1]) + 1);
      path.ids.reverse();

      if (opts.revs) {
        doc._revisions = {
          start: (path.pos + path.ids.length) - 1,
          ids: path.ids.map(function (rev) {
            return rev.id;
          })
        };
      }
      if (opts.revs_info) {
        var pos =  path.pos + path.ids.length;
        doc._revs_info = path.ids.map(function (rev) {
          pos--;
          return {
            rev: pos + '-' + rev.id,
            status: rev.opts.status
          };
        });
      }
    }

    if (opts.local_seq) {
      doc._local_seq = result.metadata.seq;
    }

    if (opts.attachments && doc._attachments) {
      var attachments = doc._attachments;
      var count = Object.keys(attachments).length;
      if (count === 0) {
        return callback(null, doc);
      }
      Object.keys(attachments).forEach(function (key) {
        this._getAttachment(attachments[key],
                            {encode: true, ctx: ctx}, function (err, data) {
          doc._attachments[key].data = data;
          if (!--count) {
            callback(null, doc);
          }
        });
      }, self);
    } else {
      if (doc._attachments) {
        for (var key in doc._attachments) {
          if (doc._attachments.hasOwnProperty(key)) {
            doc._attachments[key].stub = true;
          }
        }
      }
      callback(null, doc);
    }
  });
});

AbstractPouchDBVersion220.prototype.getAttachment =
  utils.adapterFun('getAttachment', function (docId, attachmentId, opts,
                                              callback) {
  var self = this;
  if (opts instanceof Function) {
    callback = opts;
    opts = {};
  }
  opts = utils.clone(opts);
  this._get(docId, opts, function (err, res) {
    if (err) {
      return callback(err);
    }
    if (res.doc._attachments && res.doc._attachments[attachmentId]) {
      opts.ctx = res.ctx;
      self._getAttachment(res.doc._attachments[attachmentId], opts, callback);
    } else {
      return callback(errors.MISSING_DOC);
    }
  });
});

AbstractPouchDBVersion220.prototype.allDocs =
  utils.adapterFun('allDocs', function (opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts = utils.clone(opts);
  opts.skip = typeof opts.skip !== 'undefined' ? opts.skip : 0;
  if ('keys' in opts) {
    if (!Array.isArray(opts.keys)) {
      return callback(new TypeError('options.keys must be an array'));
    }
    var incompatibleOpt =
      ['startkey', 'endkey', 'key'].filter(function (incompatibleOpt) {
      return incompatibleOpt in opts;
    })[0];
    if (incompatibleOpt) {
      callback(errors.error(errors.QUERY_PARSE_ERROR,
        'Query parameter `' + incompatibleOpt +
        '` is not compatible with multi-get'
      ));
      return;
    }
    if (this.type() !== 'http') {
      return allDocsKeysQuery(this, opts, callback);
    }
  }

  return this._allDocs(opts, callback);
});

AbstractPouchDBVersion220.prototype.changes = function (opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return new Changes(this, opts, callback);
};

AbstractPouchDBVersion220.prototype.close =
  utils.adapterFun('close', function (callback) {
  return this._close(callback);
});

AbstractPouchDBVersion220.prototype.info = utils.adapterFun('info', function (callback) {
  var self = this;
  this._info(function (err, info) {
    if (err) {
      return callback(err);
    }
    var len = self.prefix.length;
    if (info.db_name.length > len &&
        info.db_name.slice(0, len) === self.prefix) {
      info.db_name = info.db_name.slice(len);
    }
    callback(null, info);
  });
});

AbstractPouchDBVersion220.prototype.id = utils.adapterFun('id', function (callback) {
  return this._id(callback);
});

AbstractPouchDBVersion220.prototype.type = function () {
  return (typeof this._type === 'function') ? this._type() : this.adapter;
};

AbstractPouchDBVersion220.prototype.bulkDocs =
  utils.adapterFun('bulkDocs', function (req, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  opts = utils.clone(opts);

  if (Array.isArray(req)) {
    req = {
      docs: req
    };
  }

  if (!req || !req.docs || !Array.isArray(req.docs)) {
    return callback(errors.MISSING_BULK_DOCS);
  }

  for (var i = 0; i < req.docs.length; ++i) {
    if (typeof req.docs[i] !== 'object' || Array.isArray(req.docs[i])) {
      return callback(errors.NOT_AN_OBJECT);
    }
  }

  req = utils.clone(req);
  if (!('new_edits' in opts)) {
    if ('new_edits' in req) {
      opts.new_edits = req.new_edits;
    } else {
      opts.new_edits = true;
    }
  }

  return this._bulkDocs(req, opts, this.autoCompact(callback));
});

AbstractPouchDBVersion220.prototype.registerDependentDatabase =
  utils.adapterFun('registerDependentDatabase', function (dependentDb,
                                                          callback) {
  var depDB = new this.constructor(dependentDb, {adapter: this._adapter});
  function diffFun(doc) {
    doc.dependentDbs = doc.dependentDbs || {};
    if (doc.dependentDbs[dependentDb]) {
      return false; // no update required
    }
    doc.dependentDbs[dependentDb] = true;
    return doc;
  }
  upsert(this, '_local/_pouch_dependentDbs', diffFun, function (err) {
    if (err) {
      return callback(err);
    }
    return callback(null, {db: depDB});
  });
});

},{"./changes":6,"./deps/errors":10,"./deps/upsert":11,"./merge":16,"./utils":21,"events":24}],3:[function(_dereq_,module,exports){
"use strict";

var utils = _dereq_('../utils');
var errors = _dereq_('../deps/errors');
// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri(str) {
  var o = parseUri.options;
  var m = o.parser[o.strictMode ? "strict" : "loose"].exec(str);
  var uri = {};
  var i = 14;

  while (i--) {
    uri[o.key[i]] = m[i] || "";
  }

  uri[o.q.name] = {};
  uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    if ($1) {
      uri[o.q.name][$1] = $2;
    }
  });

  return uri;
}

function encodeDocId(id) {
  if (/^_(design|local)/.test(id)) {
    return id;
  }
  return encodeURIComponent(id);
}

parseUri.options = {
  strictMode: false,
  key: ["source", "protocol", "authority", "userInfo", "user", "password",
        "host", "port", "relative", "path", "directory", "file", "query",
        "anchor"],
  q:   {
    name:   "queryKey",
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    /* jshint maxlen: false */
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};

// Get all the information you possibly can about the URI given by name and
// return it as a suitable object.
function getHost(name, opts) {
  // If the given name contains "http:"
  if (/http(s?):/.test(name)) {
    // Prase the URI into all its little bits
    var uri = parseUri(name);

    // Store the fact that it is a remote URI
    uri.remote = true;

    // Store the user and password as a separate auth object
    if (uri.user || uri.password) {
      uri.auth = {username: uri.user, password: uri.password};
    }

    // Split the path part of the URI into parts using '/' as the delimiter
    // after removing any leading '/' and any trailing '/'
    var parts = uri.path.replace(/(^\/|\/$)/g, '').split('/');

    // Store the first part as the database name and remove it from the parts
    // array
    uri.db = parts.pop();

    // Restore the path by joining all the remaining parts (all the parts
    // except for the database name) with '/'s
    uri.path = parts.join('/');
    opts = opts || {};
    opts = utils.clone(opts);
    uri.headers = opts.headers || {};

    if (opts.auth || uri.auth) {
      var nAuth = opts.auth || uri.auth;
      var token = utils.btoa(nAuth.username + ':' + nAuth.password);
      uri.headers.Authorization = 'Basic ' + token;
    }

    if (opts.headers) {
      uri.headers = opts.headers;
    }

    return uri;
  }

  // If the given name does not contain 'http:' then return a very basic object
  // with no host, the current path, the given name as the database name and no
  // username/password
  return {host: '', path: '/', db: name, auth: false};
}

// Generate a URL with the host data given by opts and the given path
function genDBUrl(opts, path) {
  return genUrl(opts, opts.db + '/' + path);
}

// Generate a URL with the host data given by opts and the given path
function genUrl(opts, path) {
  if (opts.remote) {
    // If the host already has a path, then we need to have a path delimiter
    // Otherwise, the path delimiter is the empty string
    var pathDel = !opts.path ? '' : '/';

    // If the host already has a path, then we need to have a path delimiter
    // Otherwise, the path delimiter is the empty string
    return opts.protocol + '://' + opts.host + ':' + opts.port + '/' +
           opts.path + pathDel + path;
  }

  return '/' + path;
}
// Implements the PouchDBVersion220 API for dealing with CouchDB instances over HTTP
function HttpPouch(opts, callback) {
  // The functions that will be publicly available for HttpPouch
  var api = this;
  api.getHost = opts.getHost ? opts.getHost : getHost;

  // Parse the URI given by opts.name into an easy-to-use object
  var host = api.getHost(opts.name, opts);

  // Generate the database URL based on the host
  var dbUrl = genDBUrl(host, '');

  api.getUrl = function () {return dbUrl; };

  var ajaxOpts = opts.ajax || {};
  opts = utils.clone(opts);
  function ajax(options, callback) {
    return utils.ajax(utils.extend({}, ajaxOpts, options), callback);
  }
  var uuids = {
    list: [],
    get: function (opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {count: 10};
      }
      var cb = function (err, body) {
        if (err || !('uuids' in body)) {
          callback(err || errors.UNKNOWN_ERROR);
        } else {
          uuids.list = uuids.list.concat(body.uuids);
          callback(null, "OK");
        }
      };
      var params = '?count=' + opts.count;
      ajax({
        headers: host.headers,
        method: 'GET',
        url: genUrl(host, '_uuids') + params
      }, cb);
    }
  };

  // Create a new CouchDB database based on the given opts
  var createDB = function () {
    ajax({headers: host.headers, method: 'PUT', url: dbUrl},
         function (err, ret) {
      // If we get an "Unauthorized" error
      if (err && err.status === 401) {
        // Test if the database already exists
        ajax({headers: host.headers, method: 'HEAD', url: dbUrl},
             function (err, ret) {
          // If there is still an error
          if (err) {
            // Give the error to the callback to deal with
            callback(err);
          } else {
            // Continue as if there had been no errors
            callback(null, api);
          }
        });
        // If there were no errros or if the only error is "Precondition Failed"
        // (note: "Precondition Failed" occurs when we try to create a database
        // that already exists)
      } else if (!err || err.status === 412) {
        // Continue as if there had been no errors
        callback(null, api);
      } else {
        callback(err);
      }
    });
  };
  if (!opts.skipSetup) {
    ajax({headers: host.headers, method: 'GET', url: dbUrl},
         function (err, ret) {
      //check if the db exists
      if (err) {
        if (err.status === 404) {
          //if it doesn't, create it
          createDB();
        } else {
          callback(err);
        }
      } else {
        //go do stuff with the db
        callback(null, api);
      }
    });
  }

  api.type = function () {
    return 'http';
  };

  api.id = utils.adapterFun('id', function (callback) {
    ajax({
      headers: host.headers,
      method: 'GET',
      url: genUrl(host, '')
    }, function (err, result) {
      var uuid = (result && result.uuid) ?
        result.uuid + host.db : genDBUrl(host, '');
      callback(null, uuid);
    });
  });

  api.request = utils.adapterFun('request', function (options, callback) {
    options.headers = host.headers;
    options.url = genDBUrl(host, options.url);
    ajax(options, callback);
  });

  // Sends a POST request to the host calling the couchdb _compact function
  //    version: The version of CouchDB it is running
  api.compact = utils.adapterFun('compact', function (opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    ajax({
      headers: host.headers,
      url: genDBUrl(host, '_compact'),
      method: 'POST'
    }, function () {
      function ping() {
        api.info(function (err, res) {
          if (!res.compact_running) {
            callback();
          } else {
            setTimeout(ping, opts.interval || 200);
          }
        });
      }
      // Ping the http if it's finished compaction
      if (typeof callback === "function") {
        ping();
      }
    });
  });

  // Calls GET on the host, which gets back a JSON string containing
  //    couchdb: A welcome string
  //    version: The version of CouchDB it is running
  api._info = function (callback) {
    ajax({
      headers: host.headers,
      method: 'GET',
      url: genDBUrl(host, '')
    }, function (err, res) {
      if (err) {
        callback(err);
      } else {
        res.host = genDBUrl(host, '');
        callback(null, res);
      }
    });
  };

  // Get the document with the given id from the database given by host.
  // The id could be solely the _id in the database, or it may be a
  // _design/ID or _local/ID path
  api.get = utils.adapterFun('get', function (id, opts, callback) {
    // If no options were given, set the callback to the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    if (opts.auto_encode === undefined) {
      opts.auto_encode = true;
    }

    // List of parameters to add to the GET request
    var params = [];

    // If it exists, add the opts.revs value to the list of parameters.
    // If revs=true then the resulting JSON will include a field
    // _revisions containing an array of the revision IDs.
    if (opts.revs) {
      params.push('revs=true');
    }

    // If it exists, add the opts.revs_info value to the list of parameters.
    // If revs_info=true then the resulting JSON will include the field
    // _revs_info containing an array of objects in which each object
    // representing an available revision.
    if (opts.revs_info) {
      params.push('revs_info=true');
    }

    if (opts.local_seq) {
      params.push('local_seq=true');
    }
    // If it exists, add the opts.open_revs value to the list of parameters.
    // If open_revs=all then the resulting JSON will include all the leaf
    // revisions. If open_revs=["rev1", "rev2",...] then the resulting JSON
    // will contain an array of objects containing data of all revisions
    if (opts.open_revs) {
      if (opts.open_revs !== "all") {
        opts.open_revs = JSON.stringify(opts.open_revs);
      }
      params.push('open_revs=' + opts.open_revs);
    }

    // If it exists, add the opts.attachments value to the list of parameters.
    // If attachments=true the resulting JSON will include the base64-encoded
    // contents in the "data" property of each attachment.
    if (opts.attachments) {
      params.push('attachments=true');
    }

    // If it exists, add the opts.rev value to the list of parameters.
    // If rev is given a revision number then get the specified revision.
    if (opts.rev) {
      params.push('rev=' + opts.rev);
    }

    // If it exists, add the opts.conflicts value to the list of parameters.
    // If conflicts=true then the resulting JSON will include the field
    // _conflicts containing all the conflicting revisions.
    if (opts.conflicts) {
      params.push('conflicts=' + opts.conflicts);
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    if (opts.auto_encode) {
      id = encodeDocId(id);
    }

    // Set the options for the ajax call
    var options = {
      headers: host.headers,
      method: 'GET',
      url: genDBUrl(host, id + params)
    };

    // If the given id contains at least one '/' and the part before the '/'
    // is NOT "_design" and is NOT "_local"
    // OR
    // If the given id contains at least two '/' and the part before the first
    // '/' is "_design".
    // TODO This second condition seems strange since if parts[0] === '_design'
    // then we already know that parts[0] !== '_local'.
    var parts = id.split('/');
    if ((parts.length > 1 && parts[0] !== '_design' && parts[0] !== '_local') ||
        (parts.length > 2 && parts[0] === '_design' && parts[0] !== '_local')) {
      // Binary is expected back from the server
      options.binary = true;
    }

    // Get the document
    ajax(options, function (err, doc, xhr) {
      // If the document does not exist, send an error to the callback
      if (err) {
        return callback(err);
      }

      // Send the document to the callback
      callback(null, doc, xhr);
    });
  });

  // Delete the document given by doc from the database given by host.
  api.remove = utils.adapterFun('remove', function (doc, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }  else if (typeof opts === 'string') {
      doc = {
        _id: doc,
        _rev: opts
      };
    } else if (opts === undefined) {
      opts = {};
    }
    // Delete the document
    ajax({
      headers: host.headers,
      method: 'DELETE',
      url: genDBUrl(host, encodeDocId(doc._id)) + '?rev=' + doc._rev
    }, callback);
  });

  // Get the attachment
  api.getAttachment =
    utils.adapterFun('getAttachment', function (docId, attachmentId, opts,
                                                callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    if (opts.auto_encode === undefined) {
      opts.auto_encode = true;
    }
    if (opts.auto_encode) {
      docId = encodeDocId(docId);
    }
    opts.auto_encode = false;
    api.get(docId + '/' + attachmentId, opts, callback);
  });

  // Remove the attachment given by the id and rev
  api.removeAttachment =
    utils.adapterFun('removeAttachment', function (docId, attachmentId, rev,
                                                   callback) {
    ajax({
      headers: host.headers,
      method: 'DELETE',
      url: genDBUrl(host, encodeDocId(docId) + '/' + attachmentId) + '?rev=' +
           rev
    }, callback);
  });

  // Add the attachment given by blob and its contentType property
  // to the document with the given id, the revision given by rev, and
  // add it to the database given by host.
  api.putAttachment =
    utils.adapterFun('putAttachment', function (docId, attachmentId, rev, blob,
                                                type, callback) {
    if (typeof type === 'function') {
      callback = type;
      type = blob;
      blob = rev;
      rev = null;
    }
    if (typeof type === 'undefined') {
      type = blob;
      blob = rev;
      rev = null;
    }
    var id = encodeDocId(docId) + '/' + attachmentId;
    var url = genDBUrl(host, id);
    if (rev) {
      url += '?rev=' + rev;
    }

    var opts = {
      headers: host.headers,
      method: 'PUT',
      url: url,
      processData: false,
      body: blob,
      timeout: 60000
    };
    opts.headers['Content-Type'] = type;
    // Add the attachment
    ajax(opts, callback);
  });

  // Add the document given by doc (in JSON string format) to the database
  // given by host. This fails if the doc has no _id field.
  api.put = utils.adapterFun('put', utils.getArguments(function (args) {
    var temp, temptype, opts, callback;
    var doc = args.shift();
    var id = '_id' in doc;
    if (typeof doc !== 'object' || Array.isArray(doc)) {
      callback = args.pop();
      return callback(errors.NOT_AN_OBJECT);
    }
    doc = utils.clone(doc);
    while (true) {
      temp = args.shift();
      temptype = typeof temp;
      if (temptype === "string" && !id) {
        doc._id = temp;
        id = true;
      } else if (temptype === "string" && id && !('_rev' in doc)) {
        doc._rev = temp;
      } else if (temptype === "object") {
        opts = utils.clone(temp);
      } else if (temptype === "function") {
        callback = temp;
      }
      if (!args.length) {
        break;
      }
    }
    opts = opts || {};
    var error = utils.invalidIdError(doc._id);
    if (error) {
      return callback(error);
    }

    // List of parameter to add to the PUT request
    var params = [];

    // If it exists, add the opts.new_edits value to the list of parameters.
    // If new_edits = false then the database will NOT assign this document a
    // new revision number
    if (opts && typeof opts.new_edits !== 'undefined') {
      params.push('new_edits=' + opts.new_edits);
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    if (params !== '') {
      params = '?' + params;
    }

    // Add the document
    ajax({
      headers: host.headers,
      method: 'PUT',
      url: genDBUrl(host, encodeDocId(doc._id)) + params,
      body: doc
    }, callback);
  }));

  // Add the document given by doc (in JSON string format) to the database
  // given by host. This does not assume that doc is a new document 
  // (i.e. does not have a _id or a _rev field.)
  api.post = utils.adapterFun('post', function (doc, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    if (typeof doc !== 'object') {
      return callback(errors.NOT_AN_OBJECT);
    }
    if (! ("_id" in doc)) {
      if (uuids.list.length > 0) {
        doc._id = uuids.list.pop();
        api.put(doc, opts, callback);
      } else {
        uuids.get(function (err, resp) {
          if (err) {
            return callback(errors.UNKNOWN_ERROR);
          }
          doc._id = uuids.list.pop();
          api.put(doc, opts, callback);
        });
      }
    } else {
      api.put(doc, opts, callback);
    }
  });

  // Update/create multiple documents given by req in the database
  // given by host.
  api._bulkDocs = function (req, opts, callback) {
    // If opts.new_edits exists add it to the document data to be
    // send to the database.
    // If new_edits=false then it prevents the database from creating
    // new revision numbers for the documents. Instead it just uses
    // the old ones. This is used in database replication.
    if (typeof opts.new_edits !== 'undefined') {
      req.new_edits = opts.new_edits;
    }

    // Update/create the documents
    ajax({
      headers: host.headers,
      method: 'POST',
      url: genDBUrl(host, '_bulk_docs'),
      body: req
    }, callback);
  };

  // Get a listing of the documents in the database given
  // by host and ordered by increasing id.
  api.allDocs = utils.adapterFun('allDocs', function (opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    // List of parameters to add to the GET request
    var params = [];
    var body;
    var method = 'GET';

    // TODO I don't see conflicts as a valid parameter for a
    // _all_docs request 
    // (see http://wiki.apache.org/couchdb/HTTP_Document_API#all_docs)
    if (opts.conflicts) {
      params.push('conflicts=true');
    }

    // If opts.descending is truthy add it to params
    if (opts.descending) {
      params.push('descending=true');
    }

    // If opts.include_docs exists, add the include_docs value to the
    // list of parameters.
    // If include_docs=true then include the associated document with each
    // result.
    if (opts.include_docs) {
      params.push('include_docs=true');
    }

    if (opts.key) {
      params.push('key=' + encodeURIComponent(JSON.stringify(opts.key)));
    }

    // If opts.startkey exists, add the startkey value to the list of
    // parameters.
    // If startkey is given then the returned list of documents will
    // start with the document whose id is startkey.
    if (opts.startkey) {
      params.push('startkey=' +
        encodeURIComponent(JSON.stringify(opts.startkey)));
    }

    // If opts.endkey exists, add the endkey value to the list of parameters.
    // If endkey is given then the returned list of docuemnts will
    // end with the document whose id is endkey.
    if (opts.endkey) {
      params.push('endkey=' + encodeURIComponent(JSON.stringify(opts.endkey)));
    }

    if (typeof opts.inclusive_end !== 'undefined') {
      params.push('inclusive_end=' + !!opts.inclusive_end);
    }

    // If opts.limit exists, add the limit value to the parameter list.
    if (typeof opts.limit !== 'undefined') {
      params.push('limit=' + opts.limit);
    }

    if (typeof opts.skip !== 'undefined') {
      params.push('skip=' + opts.skip);
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    if (params !== '') {
      params = '?' + params;
    }

    if (typeof opts.keys !== 'undefined') {

      var MAX_URL_LENGTH = 2000;
      // according to http://stackoverflow.com/a/417184/680742,
      // the de factor URL length limit is 2000 characters

      var keysAsString =
        'keys=' + encodeURIComponent(JSON.stringify(opts.keys));
      if (keysAsString.length + params.length + 1 <= MAX_URL_LENGTH) {
        // If the keys are short enough, do a GET. we do this to work around
        // Safari not understanding 304s on POSTs (see issue #1239)
        params += (params.indexOf('?') !== -1 ? '&' : '?') + keysAsString;
      } else {
        // If keys are too long, issue a POST request to circumvent GET
        // query string limits
        // see http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
        method = 'POST';
        body = JSON.stringify({keys: opts.keys});
      }
    }

    // Get the document listing
    ajax({
      headers: host.headers,
      method: method,
      url: genDBUrl(host, '_all_docs' + params),
      body: body
    }, callback);
  });

  // Get a list of changes made to documents in the database given by host.
  // TODO According to the README, there should be two other methods here,
  // api.changes.addListener and api.changes.removeListener.
  api._changes = function (opts) {
    // We internally page the results of a changes request, this means
    // if there is a large set of changes to be returned we can start
    // processing them quicker instead of waiting on the entire
    // set of changes to return and attempting to process them at once
    var CHANGES_LIMIT = 25;

    opts = utils.clone(opts);
    opts.timeout = opts.timeout || 0;

    // set timeout to 20s to prevent aborting via Ajax timeout
    var params = { timeout: 20 * 1000 };
    var limit = (typeof opts.limit !== 'undefined') ? opts.limit : false;
    if (limit === 0) {
      limit = 1;
    }
    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }
    //
    var leftToFetch = limit;

    if (opts.style) {
      params.style = opts.style;
    }

    if (opts.include_docs || opts.filter && typeof opts.filter === 'function') {
      params.include_docs = true;
    }

    if (opts.continuous) {
      params.feed = 'longpoll';
    }

    if (opts.conflicts) {
      params.conflicts = true;
    }

    if (opts.descending) {
      params.descending = true;
    }

    if (opts.filter && typeof opts.filter === 'string') {
      params.filter = opts.filter;
      if (opts.filter === '_view' &&
          opts.view &&
          typeof opts.view === 'string') {
        params.view = opts.view;
      }
    }

    // If opts.query_params exists, pass it through to the changes request.
    // These parameters may be used by the filter on the source database.
    if (opts.query_params && typeof opts.query_params === 'object') {
      for (var param_name in opts.query_params) {
        if (opts.query_params.hasOwnProperty(param_name)) {
          params[param_name] = opts.query_params[param_name];
        }
      }
    }

    var xhr;
    var lastFetchedSeq;

    // Get all the changes starting wtih the one immediately after the
    // sequence number given by since.
    var fetch = function (since, callback) {
      if (opts.aborted) {
        return;
      }
      params.since = since;
      if (opts.descending) {
        if (limit) {
          params.limit = leftToFetch;
        }
      } else {
        params.limit = (!limit || leftToFetch > CHANGES_LIMIT) ?
          CHANGES_LIMIT : leftToFetch;
      }

      var paramStr = '?' + Object.keys(params).map(function (k) {
        return k + '=' + params[k];
      }).join('&');

      // Set the options for the ajax call
      var xhrOpts = {
        headers: host.headers,
        method: 'GET',
        url: genDBUrl(host, '_changes' + paramStr),
        // _changes can take a long time to generate, especially when filtered
        timeout: opts.timeout
      };
      lastFetchedSeq = since;

      if (opts.aborted) {
        return;
      }

      // Get the changes
      xhr = ajax(xhrOpts, callback);
    };

    // If opts.since exists, get all the changes from the sequence
    // number given by opts.since. Otherwise, get all the changes
    // from the sequence number 0.
    var fetchTimeout = 10;
    var fetchRetryCount = 0;

    var results = {results: []};

    var fetched = function (err, res) {
      if (opts.aborted) {
        return;
      }
      var raw_results_length = 0;
      // If the result of the ajax call (res) contains changes (res.results)
      if (res && res.results) {
        raw_results_length = res.results.length;
        results.last_seq = res.last_seq;
        // For each change
        var req = {};
        req.query = opts.query_params;
        res.results = res.results.filter(function (c) {
          leftToFetch--;
          var ret = utils.filterChange(opts)(c);
          if (ret) {
            if (returnDocs) {
              results.results.push(c);
            }
            utils.call(opts.onChange, c);
          }
          return ret;
        });
      } else if (err) {
        // In case of an error, stop listening for changes and call
        // opts.complete
        opts.aborted = true;
        utils.call(opts.complete, err);
        return;
      }

      // The changes feed may have timed out with no results
      // if so reuse last update sequence
      if (res && res.last_seq) {
        lastFetchedSeq = res.last_seq;
      }

      var finished = (limit && leftToFetch <= 0) ||
        (res && raw_results_length < CHANGES_LIMIT) ||
        (opts.descending);

      if ((opts.continuous && !(limit && leftToFetch <= 0)) || !finished) {
        // Increase retry delay exponentially as long as errors persist
        if (err) {
          fetchRetryCount += 1;
        } else {
          fetchRetryCount = 0;
        }
        var timeoutMultiplier = 1 << fetchRetryCount;
        var retryWait = fetchTimeout * timeoutMultiplier;
        var maximumWait = opts.maximumWait || 30000;

        if (retryWait > maximumWait) {
          utils.call(opts.complete, err || errors.UNKNOWN_ERROR);
          return;
        }

        // Queue a call to fetch again with the newest sequence number
        setTimeout(function () { fetch(lastFetchedSeq, fetched); }, retryWait);
      } else {
        // We're done, call the callback
        utils.call(opts.complete, null, results);
      }
    };

    fetch(opts.since || 0, fetched);

    // Return a method to cancel this method from processing any more
    return {
      cancel: function () {
        opts.aborted = true;
        if (xhr) {
          xhr.abort();
        }
      }
    };
  };

  // Given a set of document/revision IDs (given by req), tets the subset of
  // those that do NOT correspond to revisions stored in the database.
  // See http://wiki.apache.org/couchdb/HttpPostRevsDiff
  api.revsDiff = utils.adapterFun('revsDif', function (req, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    // Get the missing document/revision IDs
    ajax({
      headers: host.headers,
      method: 'POST',
      url: genDBUrl(host, '_revs_diff'),
      body: req
    }, function (err, res) {
      callback(err, res);
    });
  });

  api.close = utils.adapterFun('close', function (callback) {
    callback();
  });

  function replicateOnServer(target, opts, promise, targetHostUrl) {
    opts = utils.clone(opts);
    var targetHost = api.getHost(targetHostUrl);
    var params = {
      source: host.db,
      target: targetHost.protocol === host.protocol &&
        targetHost.authority ===
          host.authority ? targetHost.db : targetHost.source
    };

    if (opts.continuous) {
      params.continuous = true;
    }

    if (opts.create_target) {
      params.create_target = true;
    }

    if (opts.doc_ids) {
      params.doc_ids = opts.doc_ids;
    }

    if (opts.filter && typeof opts.filter === 'string') {
      params.filter = opts.filter;
    }

    if (opts.query_params) {
      params.query_params = opts.query_params;
    }

    var result = {};
    var repOpts = {
      headers: host.headers,
      method: 'POST',
      url: genUrl(host, '_replicate'),
      body: params
    };

    var xhr;
    promise.cancel = function () {
      this.cancelled = true;
      if (xhr && !result.ok) {
        xhr.abort();
      }
      if (result._local_id) {
        repOpts.body = {
          replication_id: result._local_id
        };
      }
      repOpts.body.cancel = true;
      ajax(repOpts, function (err, resp, xhr) {
        // If the replication cancel request fails, send an error to the
        // callback
        if (err) {
          return callback(err);
        }
        // Send the replication cancel result to the complete callback
        utils.call(opts.complete, null, result, xhr);
      });
    };

    if (promise.cancelled) {
      return;
    }

    xhr = ajax(repOpts, function (err, resp, xhr) {
      // If the replication fails, send an error to the callback
      if (err) {
        return callback(err);
      }

      result.ok = true;

      // Provided by CouchDB from 1.2.0 onward to cancel replication
      if (resp._local_id) {
        result._local_id = resp._local_id;
      }

      // Send the replication result to the complete callback
      utils.call(opts.complete, null, resp, xhr);
    });
  }

  api.replicateOnServer = function (target, opts, promise) {
    if (!api.taskqueue.isReady) {
      api.taskqueue.addTask('replicateOnServer', [target, opts, promise]);
      return promise;
    }
    target.info(function (err, info) {
      replicateOnServer(target, opts, promise, info.host);
    });
  };
  api.destroy = utils.adapterFun('destroy', function (callback) {
    ajax({
      url: genDBUrl(host, ''),
      method: 'DELETE',
      headers: host.headers
    }, function (err, resp) {
      if (err) {
        api.emit('error', err);
        callback(err);
      } else {
        api.emit('destroyed');
        callback(null, resp);
      }
    });
  });
}

// Delete the HttpPouch specified by the given name.
HttpPouch.destroy = utils.toPromise(function (name, opts, callback) {
  var host = getHost(name, opts);
  opts = opts || {};
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts = utils.clone(opts);
  opts.headers = host.headers;
  opts.method = 'DELETE';
  opts.url = genDBUrl(host, '');
  var ajaxOpts = opts.ajax || {};
  opts = utils.extend({}, opts, ajaxOpts);
  utils.ajax(opts, callback);
});

// HttpPouch is a valid adapter.
HttpPouch.valid = function () {
  return true;
};

module.exports = HttpPouch;

},{"../deps/errors":10,"../utils":21}],4:[function(_dereq_,module,exports){
(function (global){
'use strict';

var utils = _dereq_('../utils');
var merge = _dereq_('../merge');
var errors = _dereq_('../deps/errors');

function idbError(callback) {
  return function (event) {
    callback(errors.error(errors.IDB_ERROR, event.target, event.type));
  };
}

function isModernIdb() {
  // check for outdated implementations of IDB
  // that rely on the setVersion method instead of onupgradeneeded (issue #1207)

  // cache based on appVersion, in case the browser is updated
  var cacheKey = "_pouch__checkModernIdb_" +
    (global.navigator && global.navigator.appVersion);
  var cached = utils.hasLocalStorage() && global.localStorage[cacheKey];
  if (cached) {
    return JSON.parse(cached);
  }

  var dbName = '_pouch__checkModernIdb';
  var result = global.indexedDB.open(dbName, 1).onupgradeneeded === null;

  if (global.indexedDB.deleteDatabase) {
    global.indexedDB.deleteDatabase(dbName); // db no longer needed
  }
  if (utils.hasLocalStorage()) {
    global.localStorage[cacheKey] = JSON.stringify(result); // cache
  }
  return result;
}

function IdbPouch(opts, callback) {

  // IndexedDB requires a versioned database structure, so we use the
  // version here to manage migrations.
  var ADAPTER_VERSION = 2;

  // The object stores created for each database
  // DOC_STORE stores the document meta data, its revision history and state
  var DOC_STORE = 'document-store';
  // BY_SEQ_STORE stores a particular version of a document, keyed by its
  // sequence id
  var BY_SEQ_STORE = 'by-sequence';
  // Where we store attachments
  var ATTACH_STORE = 'attach-store';
  // Where we store meta data
  var META_STORE = 'meta-store';
  // Where we detect blob support
  var DETECT_BLOB_SUPPORT_STORE = 'detect-blob-support';

  var name = opts.name;
  var req = global.indexedDB.open(name, ADAPTER_VERSION);
  var docCount = -1;

  if (!('openReqList' in IdbPouch)) {
    IdbPouch.openReqList = {};
  }
  IdbPouch.openReqList[name] = req;

  var blobSupport = null;
  var instanceId = null;
  var api = this;
  var idb = null;

  req.onupgradeneeded = function (e) {
    var db = e.target.result;
    if (e.oldVersion < 1) {
      // initial schema
      createSchema(db);
    }
    if (e.oldVersion < 2) {
      // version 2 adds the deletedOrLocal index
      addDeletedOrLocalIndex(e);
    }
  };

  function createSchema(db) {
    db.createObjectStore(DOC_STORE, {keyPath : 'id'})
      .createIndex('seq', 'seq', {unique: true});
    db.createObjectStore(BY_SEQ_STORE, {autoIncrement: true})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
    db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
    db.createObjectStore(META_STORE, {keyPath: 'id', autoIncrement: false});
    db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
  }

  function addDeletedOrLocalIndex(e) {
    var docStore = e.currentTarget.transaction.objectStore(DOC_STORE);

    docStore.openCursor().onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        var metadata = cursor.value;
        var deleted = utils.isDeleted(metadata);
        var local = utils.isLocalId(metadata.id);
        metadata.deletedOrLocal = (deleted || local) ? "1" : "0";
        docStore.put(metadata);
        cursor["continue"]();
      } else {
        docStore.createIndex('deletedOrLocal',
                             'deletedOrLocal', {unique : false});
      }
    };
  }

  req.onsuccess = function (e) {

    idb = e.target.result;

    idb.onversionchange = function () {
      idb.close();
    };

    var txn = idb.transaction([META_STORE, DETECT_BLOB_SUPPORT_STORE],
                              'readwrite');

    var req = txn.objectStore(META_STORE).get(META_STORE);

    req.onsuccess = function (e) {

      var idStored = false;
      var checkSetupComplete = function () {
        if (blobSupport === null || !idStored) {
          return;
        } else {
          callback(null, api);
        }
      };

      var meta = e.target.result || {id: META_STORE};
      if (name  + '_id' in meta) {
        instanceId = meta[name + '_id'];
        idStored = true;
        checkSetupComplete();
      } else {
        instanceId = utils.uuid();
        meta[name + '_id'] = instanceId;
        txn.objectStore(META_STORE).put(meta).onsuccess = function () {
          idStored = true;
          checkSetupComplete();
        };
      }

      // detect blob support
      try {
        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(utils.createBlob(),
                                                       "key");
        blobSupport = true;
      } catch (err) {
        blobSupport = false;
      } finally {
        checkSetupComplete();
      }
    };
  };

  req.onerror = idbError(callback);

  api.type = function () {
    return 'idb';
  };

  api._id = utils.toPromise(function (callback) {
    callback(null, instanceId);
  });

  api._bulkDocs = function idb_bulkDocs(req, opts, callback) {
    var newEdits = opts.new_edits;
    var userDocs = req.docs;
    // Parse the docs, give them a sequence number for the result
    var docInfos = userDocs.map(function (doc, i) {
      var newDoc = utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      return newDoc;
    });

    var docInfoErrors = docInfos.filter(function (docInfo) {
      return docInfo.error;
    });
    if (docInfoErrors.length) {
      return callback(docInfoErrors[0]);
    }

    var results = [];
    var docsWritten = 0;

    function writeMetaData(e) {
      var meta = e.target.result;
      meta.updateSeq = (meta.updateSeq || 0) + docsWritten;
      txn.objectStore(META_STORE).put(meta);
    }

    function processDocs() {
      if (!docInfos.length) {
        txn.objectStore(META_STORE).get(META_STORE).onsuccess = writeMetaData;
        return;
      }
      var currentDoc = docInfos.shift();
      var req = txn.objectStore(DOC_STORE).get(currentDoc.metadata.id);
      req.onsuccess = function process_docRead(event) {
        var oldDoc = event.target.result;
        if (!oldDoc) {
          insertDoc(currentDoc);
        } else {
          updateDoc(oldDoc, currentDoc);
        }
      };
    }

    function complete(event) {
      var aresults = [];
      results.sort(sortByBulkSeq);
      results.forEach(function (result) {
        delete result._bulk_seq;
        if (result.error) {
          aresults.push(result);
          return;
        }
        var metadata = result.metadata;
        var rev = merge.winningRev(metadata);

        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev
        });

        if (utils.isLocalId(metadata.id)) {
          return;
        }

        IdbPouch.Changes.notify(name);
        IdbPouch.Changes.notifyLocalWindows(name);
      });
      docCount = -1; // invalidate
      callback(null, aresults);
    }

    function preprocessAttachment(att, finish) {
      if (att.stub) {
        return finish();
      }
      if (typeof att.data === 'string') {
        var data;
        try {
          data = atob(att.data);
        } catch (e) {
          var err = errors.error(errors.BAD_ARG,
                                "Attachments need to be base64 encoded");
          return callback(err);
        }
        att.digest = 'md5-' + utils.MD5(data);
        if (blobSupport) {
          var type = att.content_type;
          data = utils.fixBinary(data);
          att.data = utils.createBlob([data], {type: type});
        }
        return finish();
      }
      var reader = new FileReader();
      reader.onloadend = function (e) {
        var binary = utils.arrayBufferToBinaryString(this.result);
        att.digest = 'md5-' + utils.MD5(binary);
        if (!blobSupport) {
          att.data = btoa(binary);
        }
        finish();
      };
      reader.readAsArrayBuffer(att.data);
    }

    function preprocessAttachments(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var docv = 0;
      docInfos.forEach(function (docInfo) {
        var attachments = docInfo.data && docInfo.data._attachments ?
          Object.keys(docInfo.data._attachments) : [];

        if (!attachments.length) {
          return done();
        }

        var recv = 0;
        function attachmentProcessed() {
          recv++;
          if (recv === attachments.length) {
            done();
          }
        }

        for (var key in docInfo.data._attachments) {
          if (docInfo.data._attachments.hasOwnProperty(key)) {
            preprocessAttachment(docInfo.data._attachments[key],
                                 attachmentProcessed);
          }
        }
      });

      function done() {
        docv++;
        if (docInfos.length === docv) {
          callback();
        }
      }
    }

    function writeDoc(docInfo, winningRev, deleted, callback) {
      var err = null;
      var recv = 0;
      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      docsWritten++;

      if (deleted) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            callback(err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      function attachmentSaved(err) {
        recv++;
        collectResults(err);
      }

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          delete docInfo.data._attachments[key].data;
          var digest = docInfo.data._attachments[key].digest;
          saveAttachment(docInfo, digest, data, attachmentSaved);
        } else {
          recv++;
          collectResults();
        }
      }

      function finish() {

        docInfo.data._doc_id_rev = docInfo.data._id + "::" + docInfo.data._rev;
        var index = txn.objectStore(BY_SEQ_STORE).index('_doc_id_rev');

        index.getKey(docInfo.data._doc_id_rev).onsuccess = function (e) {

          var dataReq = e.target.result ?
            txn.objectStore(BY_SEQ_STORE).put(docInfo.data, e.target.result) :
            txn.objectStore(BY_SEQ_STORE).put(docInfo.data);

          dataReq.onsuccess = function (e) {
            var metadata = docInfo.metadata;
            metadata.seq = e.target.result;
            // Current _rev is calculated from _rev_tree on read
            delete metadata.rev;
            var local = utils.isLocalId(metadata.id);
            metadata.deletedOrLocal = (deleted || local) ? "1" : "0";
            metadata.winningRev = merge.winningRev(metadata);
            var metaDataReq = txn.objectStore(DOC_STORE).put(metadata);
            metaDataReq.onsuccess = function () {
              delete metadata.deletedOrLocal;
              delete metadata.winningRev;
              results.push(docInfo);
              utils.call(callback);
            };
          };
        };
      }

      if (!attachments.length) {
        finish();
      }
    }

    function updateDoc(oldDoc, docInfo) {
      var winningRev = merge.winningRev(docInfo.metadata);
      var deleted = utils.isDeleted(docInfo.metadata, winningRev);

      var merged =
        merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);
      var wasPreviouslyDeleted = utils.isDeleted(oldDoc);
      var inConflict = (wasPreviouslyDeleted && deleted && newEdits) ||
        (!wasPreviouslyDeleted && newEdits && merged.conflicts !== 'new_leaf');

      if (inConflict) {
        results.push(makeErr(errors.REV_CONFLICT, docInfo._bulk_seq));
        return processDocs();
      }

      docInfo.metadata.rev_tree = merged.tree;

      writeDoc(docInfo, winningRev, deleted, processDocs);
    }

    function insertDoc(docInfo) {
      var winningRev = merge.winningRev(docInfo.metadata);
      var deleted = utils.isDeleted(docInfo.metadata, winningRev);
      // Cant insert new deleted documents
      if ('was_delete' in opts && deleted) {
        results.push(errors.MISSING_DOC);
        return processDocs();
      }

      writeDoc(docInfo, winningRev, deleted, processDocs);
    }

    // Insert sequence number into the error so we can sort later
    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    function saveAttachment(docInfo, digest, data, callback) {
      var objectStore = txn.objectStore(ATTACH_STORE);
      objectStore.get(digest).onsuccess = function (e) {
        var originalRefs = e.target.result && e.target.result.refs || {};
        var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
        var newAtt = {
          digest: digest,
          body: data,
          refs: originalRefs
        };
        newAtt.refs[ref] = true;
        objectStore.put(newAtt).onsuccess = function (e) {
          utils.call(callback);
        };
      };
    }

    var txn;
    preprocessAttachments(function () {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, META_STORE],
                            'readwrite');
      txn.onerror = idbError(callback);
      txn.ontimeout = idbError(callback);
      txn.oncomplete = complete;

      processDocs();
    });
  };

  function sortByBulkSeq(a, b) {
    return a._bulk_seq - b._bulk_seq;
  }

  // First we look up the metadata in the ids database, then we fetch the
  // current revision(s) from the by sequence store
  api._get = function idb_get(id, opts, callback) {
    var doc;
    var metadata;
    var err;
    var txn;
    opts = utils.clone(opts);
    if (opts.ctx) {
      txn = opts.ctx;
    } else {
      txn =
        idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
    }

    function finish() {
      callback(err, {doc: doc, metadata: metadata, ctx: txn});
    }

    txn.objectStore(DOC_STORE).get(id).onsuccess = function (e) {
      metadata = e.target.result;
      // we can determine the result here if:
      // 1. there is no such document
      // 2. the document is deleted and we don't ask about specific rev
      // When we ask with opts.rev we expect the answer to be either
      // doc (possibly with _deleted=true) or missing error
      if (!metadata) {
        err = errors.MISSING_DOC;
        return finish();
      }
      if (utils.isDeleted(metadata) && !opts.rev) {
        err = errors.error(errors.MISSING_DOC, "deleted");
        return finish();
      }
      var objectStore = txn.objectStore(BY_SEQ_STORE);

      // metadata.winningRev was added later, so older DBs might not have it
      var rev = opts.rev || metadata.winningRev || merge.winningRev(metadata);
      var key = metadata.id + '::' + rev;

      objectStore.index('_doc_id_rev').get(key).onsuccess = function (e) {
        doc = e.target.result;
        if (doc && doc._doc_id_rev) {
          delete(doc._doc_id_rev);
        }
        if (!doc) {
          err = errors.MISSING_DOC;
          return finish();
        }
        finish();
      };
    };
  };

  api._getAttachment = function (attachment, opts, callback) {
    var result;
    var txn;
    opts = utils.clone(opts);
    if (opts.ctx) {
      txn = opts.ctx;
    } else {
      txn =
        idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
    }
    var digest = attachment.digest;
    var type = attachment.content_type;

    txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function (e) {
      var data = e.target.result.body;
      if (opts.encode) {
        if (blobSupport) {
          var reader = new FileReader();
          reader.onloadend = function (e) {
            var binary = utils.arrayBufferToBinaryString(this.result);
            result = btoa(binary);
            callback(null, result);
          };
          reader.readAsArrayBuffer(data);
        } else {
          result = data;
          callback(null, result);
        }
      } else {
        if (blobSupport) {
          result = data;
        } else {
          data = utils.fixBinary(atob(data));
          result = utils.createBlob([data], {type: type});
        }
        callback(null, result);
      }
    };
  };

  function allDocsQuery(totalRows, opts, callback) {
    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;
    var key = 'key' in opts ? opts.key : false;
    var skip = opts.skip || 0;
    var limit = typeof opts.limit === 'number' ? opts.limit : -1;
    var inclusiveEnd = opts.inclusive_end !== false;
    var descending = 'descending' in opts && opts.descending ? 'prev' : null;

    var manualDescEnd = false;
    if (descending && start && end) {
      // unfortunately IDB has a quirk where IDBKeyRange.bound is invalid if the
      // start is less than the end, even in descending mode.  Best bet
      // is just to handle it manually in that case.
      manualDescEnd = end;
      end = false;
    }

    var keyRange;
    try {
      keyRange = start && end ? global.IDBKeyRange.bound(start, end, false,
          !inclusiveEnd)
        : start ? (descending ? global.IDBKeyRange.upperBound(start)
                  : global.IDBKeyRange.lowerBound(start))
        : end ? (descending ? global.IDBKeyRange.lowerBound(end, !inclusiveEnd)
                : global.IDBKeyRange.upperBound(end, !inclusiveEnd))
        : key ? global.IDBKeyRange.only(key) : null;
    } catch (e) {
      if (e.name === "DataError" && e.code === 0) {
        // data error, start is less than end
        return callback(null, {
          total_rows : totalRows,
          offset : opts.skip,
          rows : []
        });
      } else {
        return callback(errors.error(errors.IDB_ERROR, e.name, e.message));
      }
    }

    var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readonly');
    transaction.oncomplete = function () {
      callback(null, {
        total_rows: totalRows,
        offset: opts.skip,
        rows: results
      });
    };

    var oStore = transaction.objectStore(DOC_STORE);
    var oCursor = descending ? oStore.openCursor(keyRange, descending)
      : oStore.openCursor(keyRange);
    var results = [];
    oCursor.onsuccess = function (e) {
      if (!e.target.result) {
        return;
      }
      var cursor = e.target.result;
      var metadata = cursor.value;
      // metadata.winningRev added later, some dbs might be missing it
      var winningRev = metadata.winningRev || merge.winningRev(metadata);

      function allDocsInner(metadata, data) {
        if (utils.isLocalId(metadata.id)) {
          return cursor["continue"]();
        }
        var doc = {
          id: metadata.id,
          key: metadata.id,
          value: {
            rev: winningRev
          }
        };
        if (opts.include_docs) {
          doc.doc = data;
          doc.doc._rev = winningRev;
          if (doc.doc._doc_id_rev) {
            delete(doc.doc._doc_id_rev);
          }
          if (opts.conflicts) {
            doc.doc._conflicts = merge.collectConflicts(metadata);
          }
          for (var att in doc.doc._attachments) {
            if (doc.doc._attachments.hasOwnProperty(att)) {
              doc.doc._attachments[att].stub = true;
            }
          }
        }
        var deleted = utils.isDeleted(metadata, winningRev);
        if (opts.deleted === 'ok') {
          // deleted docs are okay with keys_requests
          if (deleted) {
            doc.value.deleted = true;
            doc.doc = null;
          }
          results.push(doc);
        } else if (!deleted && skip-- <= 0) {
          if (manualDescEnd && doc.key < manualDescEnd) {
            return;
          }
          results.push(doc);
          if (--limit === 0) {
            return;
          }
        }
        cursor["continue"]();
      }

      if (!opts.include_docs) {
        allDocsInner(metadata);
      } else {
        var index = transaction.objectStore(BY_SEQ_STORE).index('_doc_id_rev');
        var key = metadata.id + "::" + winningRev;
        index.get(key).onsuccess = function (event) {
          allDocsInner(cursor.value, event.target.result);
        };
      }
    };
  }

  function countDocs(callback) {
    if (docCount !== -1) {
      return callback(null, docCount);
    }

    var count;
    var txn = idb.transaction([DOC_STORE], 'readonly');
    var index = txn.objectStore(DOC_STORE).index('deletedOrLocal');
    index.count(global.IDBKeyRange.only("0")).onsuccess = function (e) {
      count = e.target.result;
    };
    txn.onerror = idbError(callback);
    txn.oncomplete = function () {
      docCount = count;
      callback(null, docCount);
    };
  }

  api._allDocs = function idb_allDocs(opts, callback) {

    // first count the total_rows
    countDocs(function (err, totalRows) {
      if (err) {
        return callback(err);
      }
      if (opts.limit === 0) {
        return callback(null, {
          total_rows : totalRows,
          offset : opts.skip,
          rows : []
        });
      }
      allDocsQuery(totalRows, opts, callback);
    });
  };

  api._info = function idb_info(callback) {

    countDocs(function (err, count) {
      if (err) {
        return callback(err);
      }
      if (idb === null) {
        var error = new Error('db isn\'t open');
        error.id = 'idbNull';
        return callback(error);
      }
      var updateSeq = 0;
      var txn = idb.transaction([META_STORE], 'readonly');

      txn.objectStore(META_STORE).get(META_STORE).onsuccess = function (e) {
        updateSeq = e.target.result && e.target.result.updateSeq || 0;
      };

      txn.oncomplete = function () {
        callback(null, {
          db_name: name,
          doc_count: count,
          update_seq: updateSeq
        });
      };
    });
  };

  api._changes = function (opts) {
    opts = utils.clone(opts);

    if (opts.continuous) {
      var id = name + ':' + utils.uuid();
      IdbPouch.Changes.addListener(name, id, api, opts);
      IdbPouch.Changes.notify(name);
      return {
        cancel: function () {
          IdbPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending ? 'prev' : null;
    var lastSeq = 0;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var limit = 'limit' in opts ? opts.limit : -1;
    if (limit === 0) {
      limit = 1; // per CouchDB _changes spec
    }
    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }

    var results = [];
    var numResults = 0;
    var filter = utils.filterChange(opts);

    var txn;

    function fetchChanges() {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE]);
      txn.oncomplete = onTxnComplete;

      var req;

      if (descending) {
        req = txn.objectStore(BY_SEQ_STORE)
            .openCursor(global.IDBKeyRange.lowerBound(opts.since, true),
                        descending);
      } else {
        req = txn.objectStore(BY_SEQ_STORE)
            .openCursor(global.IDBKeyRange.lowerBound(opts.since, true));
      }

      req.onsuccess = onsuccess;
      req.onerror = onerror;
    }

    fetchChanges();

    function onsuccess(event) {
      var cursor = event.target.result;

      if (!cursor) {
        return;
      }

      var doc = cursor.value;

      if (utils.isLocalId(doc._id) ||
          (opts.doc_ids && opts.doc_ids.indexOf(doc._id) === -1)) {
        return cursor["continue"]();
      }

      var index = txn.objectStore(DOC_STORE);
      index.get(doc._id).onsuccess = function (event) {
        var metadata = event.target.result;

        if (lastSeq < metadata.seq) {
          lastSeq = metadata.seq;
        }
        // metadata.winningRev was only added later
        var winningRev = metadata.winningRev || merge.winningRev(metadata);
        if (doc._rev !== winningRev) {
          return cursor["continue"]();
        }

        delete doc['_doc_id_rev'];

        var change = opts.processChange(doc, metadata, opts);
        change.seq = cursor.key;
        if (filter(change)) {
          numResults++;
          if (returnDocs) {
            results.push(change);
          }
          opts.onChange(change);
        }
        if (numResults !== limit) {
          cursor["continue"]();
        }
      };
    }

    function onTxnComplete() {
      if (!opts.continuous) {
        opts.complete(null, {
          results: results,
          last_seq: lastSeq
        });
      }
    }
  };

  api._close = function (callback) {
    if (idb === null) {
      return callback(errors.NOT_OPEN);
    }

    // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase#close
    // "Returns immediately and closes the connection in a separate thread..."
    idb.close();
    idb = null;
    callback();
  };

  api._getRevisionTree = function (docId, callback) {
    var txn = idb.transaction([DOC_STORE], 'readonly');
    var req = txn.objectStore(DOC_STORE).get(docId);
    req.onsuccess = function (event) {
      var doc = event.target.result;
      if (!doc) {
        callback(errors.MISSING_DOC);
      } else {
        callback(null, doc.rev_tree);
      }
    };
  };

  // This function removes revisions of document docId
  // which are listed in revs and sets this document
  // revision to to rev_tree
  api._doCompaction = function (docId, rev_tree, revs, callback) {
    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readwrite');

    var index = txn.objectStore(DOC_STORE);
    index.get(docId).onsuccess = function (event) {
      var metadata = event.target.result;
      metadata.rev_tree = rev_tree;

      var count = revs.length;
      revs.forEach(function (rev) {
        var index = txn.objectStore(BY_SEQ_STORE).index('_doc_id_rev');
        var key = docId + "::" + rev;
        index.getKey(key).onsuccess = function (e) {
          var seq = e.target.result;
          if (!seq) {
            return;
          }
          txn.objectStore(BY_SEQ_STORE)['delete'](seq);

          count--;
          if (!count) {
            txn.objectStore(DOC_STORE).put(metadata);
          }
        };
      });
    };
    txn.oncomplete = function () {
      utils.call(callback);
    };
  };

}

IdbPouch.valid = function () {
  return global.indexedDB && isModernIdb();
};

IdbPouch.destroy = utils.toPromise(function (name, opts, callback) {
  if (!('openReqList' in IdbPouch)) {
    IdbPouch.openReqList = {};
  }
  IdbPouch.Changes.clearListeners(name);

  //Close open request for "name" database to fix ie delay.
  if (IdbPouch.openReqList[name] && IdbPouch.openReqList[name].result) {
    IdbPouch.openReqList[name].result.close();
  }
  var req = global.indexedDB.deleteDatabase(name);

  req.onsuccess = function () {
    //Remove open request from the list.
    if (IdbPouch.openReqList[name]) {
      IdbPouch.openReqList[name] = null;
    }
    if (utils.hasLocalStorage()) {
      delete global.localStorage[name];
    }

    callback(null, { 'ok': true });
  };

  req.onerror = idbError(callback);
});

IdbPouch.Changes = new utils.Changes();

module.exports = IdbPouch;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../deps/errors":10,"../merge":16,"../utils":21}],5:[function(_dereq_,module,exports){
(function (global){
'use strict';

var utils = _dereq_('../utils');
var merge = _dereq_('../merge');
var errors = _dereq_('../deps/errors');
function quote(str) {
  return "'" + str + "'";
}

var cachedDatabases = {};

var openDB = utils.getArguments(function (args) {
  if (typeof global !== 'undefined') {
    if (global.navigator && global.navigator.sqlitePlugin &&
        global.navigator.sqlitePlugin.openDatabase) {
      return navigator.sqlitePlugin.openDatabase
        .apply(navigator.sqlitePlugin, args);
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return global.sqlitePlugin.openDatabase
        .apply(global.sqlitePlugin, args);
    } else {
      var db = cachedDatabases[args[0]];
      if (!db) {
        db = cachedDatabases[args[0]] =
          global.openDatabase.apply(global, args);
      }
      return db;
    }
  }
});

var POUCH_VERSION = 1;
var POUCH_SIZE =  3000000;
var ADAPTER_VERSION = 2; // used to manage migrations

// The object stores created for each database
// DOC_STORE stores the document meta data, its revision history and state
var DOC_STORE = quote('document-store');
// BY_SEQ_STORE stores a particular version of a document, keyed by its
// sequence id
var BY_SEQ_STORE = quote('by-sequence');
// Where we store attachments
var ATTACH_STORE = quote('attach-store');
var META_STORE = quote('metadata-store');

// these indexes cover the ground for most allDocs queries
var BY_SEQ_STORE_DELETED_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'by-seq-deleted-idx\' ON ' +
  BY_SEQ_STORE + ' (seq, deleted)';
var DOC_STORE_LOCAL_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'doc-store-local-idx\' ON ' +
  DOC_STORE + ' (local, id)';
var DOC_STORE_WINNINGSEQ_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'doc-winningseq-idx\' ON ' +
  DOC_STORE + ' (winningseq)';

var DOC_STORE_AND_BY_SEQ_JOINER = BY_SEQ_STORE +
  '.seq = ' + DOC_STORE + '.winningseq';

var SELECT_DOCS = BY_SEQ_STORE + '.seq AS seq, ' +
  BY_SEQ_STORE + '.deleted AS deleted, ' +
  BY_SEQ_STORE + '.json AS data, ' +
  DOC_STORE + '.json AS metadata';

function select(selector, table, joiner, where, orderBy) {
  return 'SELECT ' + selector + ' FROM ' +
    (typeof table === 'string' ? table : table.join(' JOIN ')) +
    (joiner ? (' ON ' + joiner) : '') +
    (where ? (' WHERE ' +
      (typeof where === 'string' ? where : where.join(' AND '))) : '') +
    (orderBy ? (' ORDER BY ' + orderBy) : '');
}

function unknownError(callback) {
  return function (event) {
    // event may actually be a SQLError object, so report is as such
    var errorNameMatch = event && event.constructor.toString()
      .match(/function ([^\(]+)/);
    var errorName = (errorNameMatch && errorNameMatch[1]) || event.type;
    var errorReason = event.target || event.message;
    callback(errors.error(errors.WSQ_ERROR, errorReason, errorName));
  };
}
function decodeUtf8(str) {
  return decodeURIComponent(window.escape(str));
}
function parseHexString(str, encoding) {
  var result = '';
  var charWidth = encoding === 'UTF-8' ? 2 : 4;
  for (var i = 0, len = str.length; i < len; i += charWidth) {
    var substring = str.substring(i, i + charWidth);
    if (charWidth === 4) { // UTF-16, twiddle the bits
      substring = substring.substring(2, 4) + substring.substring(0, 2);
    }
    result += String.fromCharCode(parseInt(substring, 16));
  }
  result = encoding === 'UTF-8' ? decodeUtf8(result) : result;
  return result;
}

function WebSqlPouch(opts, callback) {
  var api = this;
  var instanceId = null;
  var name = opts.name;
  var idRequests = [];
  var docCount = -1; // cache sqlite count(*) for performance
  var encoding;

  var db = openDB(name, POUCH_VERSION, name, POUCH_SIZE);
  if (!db) {
    return callback(errors.UNKNOWN_ERROR);
  } else if (typeof db.readTransaction !== 'function') {
    // doesn't exist in sqlite plugin
    db.readTransaction = db.transaction;
  }

  function dbCreated() {
    // note the db name in case the browser upgrades to idb
    if (utils.hasLocalStorage()) {
      global.localStorage['_pouch__websqldb_' + name] = true;
    }
    callback(null, api);
  }

  // In this migration, we added the 'deleted' and 'local' columns to the
  // by-seq and doc store tables.
  // To preserve existing user data, we re-process all the existing JSON
  // and add these values.
  // Called migration2 because it corresponds to adapter version (db_version) #2
  function runMigration2(tx) {
    // index used for the join in the allDocs query
    tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);

    tx.executeSql('ALTER TABLE ' + BY_SEQ_STORE +
      ' ADD COLUMN deleted TINYINT(1) DEFAULT 0', [], function () {
      tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
      tx.executeSql('ALTER TABLE ' + DOC_STORE +
        ' ADD COLUMN local TINYINT(1) DEFAULT 0', [], function () {
        tx.executeSql(DOC_STORE_LOCAL_INDEX_SQL);

        var sql = 'SELECT ' + DOC_STORE + '.winningseq AS seq, ' + DOC_STORE +
          '.json AS metadata FROM ' + BY_SEQ_STORE + ' JOIN ' + DOC_STORE +
          ' ON ' + BY_SEQ_STORE + '.seq = ' + DOC_STORE + '.winningseq';

        tx.executeSql(sql, [], function (tx, result) {

          var deleted = [];
          var local = [];

          for (var i = 0; i < result.rows.length; i++) {
            var item = result.rows.item(i);
            var seq = item.seq;
            var metadata = JSON.parse(item.metadata);
            if (utils.isDeleted(metadata)) {
              deleted.push(seq);
            }
            if (utils.isLocalId(metadata.id)) {
              local.push(metadata.id);
            }
          }

          tx.executeSql('UPDATE ' + DOC_STORE + 'SET local = 1 WHERE id IN (' +
            local.map(function () {
            return '?';
          }).join(',') + ')', local);
          tx.executeSql('UPDATE ' + BY_SEQ_STORE +
            ' SET deleted = 1 WHERE seq IN (' + deleted.map(function () {
            return '?';
          }).join(',') + ')', deleted);
        });
      });
    });
  }

  function onGetInstanceId(tx) {
    while (idRequests.length > 0) {
      var idCallback = idRequests.pop();
      idCallback(null, instanceId);
    }
    checkDbEncoding(tx);
  }

  function checkDbEncoding(tx) {
    // check db encoding - utf-8 (chrome, opera) or utf-16 (safari)?
    tx.executeSql('SELECT dbid, hex(dbid) AS hexId FROM ' + META_STORE, [],
      function (err, result) {
        var id = result.rows.item(0).dbid;
        var hexId = result.rows.item(0).hexId;
        encoding = (hexId.length === id.length * 2) ? 'UTF-8' : 'UTF-16';
      }
    );
  }

  function onGetVersion(tx, dbVersion) {
    if (dbVersion === 0) {
      // initial schema

      var meta = 'CREATE TABLE IF NOT EXISTS ' + META_STORE +
        ' (update_seq, dbid, db_version INTEGER)';
      var attach = 'CREATE TABLE IF NOT EXISTS ' + ATTACH_STORE +
        ' (digest, json, body BLOB)';
      var doc = 'CREATE TABLE IF NOT EXISTS ' + DOC_STORE +
        ' (id unique, json, winningseq, local TINYINT(1))';
      var seq = 'CREATE TABLE IF NOT EXISTS ' + BY_SEQ_STORE +
        ' (seq INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, ' +
        'doc_id_rev UNIQUE, json, deleted TINYINT(1))';

      // creates
      tx.executeSql(attach);
      tx.executeSql(doc, [], function () {
        tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);
        tx.executeSql(DOC_STORE_LOCAL_INDEX_SQL);
      });
      tx.executeSql(seq, [], function () {
        tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
      });
      tx.executeSql(meta, [], function () {
        // mark the update_seq, db version, and new dbid
        var initSeq = 'INSERT INTO ' + META_STORE +
          ' (update_seq, db_version, dbid) VALUES (?, ?, ?)';
        instanceId = utils.uuid();
        tx.executeSql(initSeq, [0, ADAPTER_VERSION, instanceId]);
        onGetInstanceId(tx);
      });
    } else { // version > 0

      if (dbVersion === 1) {
        runMigration2(tx);
        // mark the db version within this transaction
        tx.executeSql('UPDATE ' + META_STORE + ' SET db_version = ' +
                      ADAPTER_VERSION);
      } // in the future, add more migrations here

      // notify db.id() callers
      tx.executeSql('SELECT dbid FROM ' + META_STORE, [],
                    function (tx, result) {
        instanceId = result.rows.item(0).dbid;
        onGetInstanceId(tx);
      });
    }
  }

  function setup() {

    db.transaction(function (tx) {
      // first get the version
      tx.executeSql('SELECT sql FROM sqlite_master WHERE tbl_name = ' +
                    META_STORE, [], function (tx, result) {
        if (!result.rows.length) {
          // database hasn't even been created yet (version 0)
          onGetVersion(tx, 0);
        } else if (!/db_version/.test(result.rows.item(0).sql)) {
          // table was created, but without the new db_version column,
          // so add it.
          tx.executeSql('ALTER TABLE ' + META_STORE +
            ' ADD COLUMN db_version INTEGER', [], function () {
            // before version 2, this column didn't even exist
            onGetVersion(tx, 1);
          });
        } else { // column exists, we can safely get it
          tx.executeSql('SELECT db_version FROM ' + META_STORE, [],
            function (tx, result) {
            var dbVersion = result.rows.item(0).db_version;
            onGetVersion(tx, dbVersion);
          });
        }
      });
    }, unknownError(callback), dbCreated);
  }

  if (utils.isCordova() && typeof global !== 'undefined') {
    //to wait until custom api is made in pouch.adapters before doing setup
    global.addEventListener(name + '_pouch', function cordova_init() {
      global.removeEventListener(name + '_pouch', cordova_init, false);
      setup();
    }, false);
  } else {
    setup();
  }

  api.type = function () {
    return 'websql';
  };

  api._id = utils.toPromise(function (callback) {
    callback(null, instanceId);
  });

  api._info = function (callback) {
    db.readTransaction(function (tx) {
      countDocs(tx, function (docCount) {
        var sql = 'SELECT update_seq FROM ' + META_STORE;
        tx.executeSql(sql, [], function (tx, result) {
          var updateSeq = result.rows.item(0).update_seq;
          callback(null, {
            db_name: name,
            doc_count: docCount,
            update_seq: updateSeq
          });
        });
      });
    }, unknownError(callback));
  };

  api._bulkDocs = function (req, opts, callback) {

    var newEdits = opts.new_edits;
    var userDocs = req.docs;
    var docsWritten = 0;

    // Parse the docs, give them a sequence number for the result
    var docInfos = userDocs.map(function (doc, i) {
      var newDoc = utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      return newDoc;
    });

    var docInfoErrors = docInfos.filter(function (docInfo) {
      return docInfo.error;
    });
    if (docInfoErrors.length) {
      return callback(docInfoErrors[0]);
    }

    var tx;
    var results = [];
    var fetchedDocs = {};

    function sortByBulkSeq(a, b) {
      return a._bulk_seq - b._bulk_seq;
    }

    function complete(event) {
      var aresults = [];
      results.sort(sortByBulkSeq);
      results.forEach(function (result) {
        delete result._bulk_seq;
        if (result.error) {
          aresults.push(result);
          return;
        }
        var metadata = result.metadata;
        var rev = merge.winningRev(metadata);

        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev
        });

        if (utils.isLocalId(metadata.id)) {
          return;
        }

        docsWritten++;

        WebSqlPouch.Changes.notify(name);
        WebSqlPouch.Changes.notifyLocalWindows(name);
      });

      var updateseq = 'SELECT update_seq FROM ' + META_STORE;
      tx.executeSql(updateseq, [], function (tx, result) {
        var update_seq = result.rows.item(0).update_seq + docsWritten;
        var sql = 'UPDATE ' + META_STORE + ' SET update_seq=?';
        tx.executeSql(sql, [update_seq], function () {
          callback(null, aresults);
        });
      });
    }

    function preprocessAttachment(att, finish) {
      if (att.stub) {
        return finish();
      }
      if (typeof att.data === 'string') {
        try {
          att.data = atob(att.data);
        } catch (e) {
          var err = errors.error(errors.BAD_ARG,
                                "Attachments need to be base64 encoded");
          return callback(err);
        }
        var data = utils.fixBinary(att.data);
        att.data = utils.createBlob([data], {type: att.content_type});
      }
      var reader = new FileReader();
      reader.onloadend = function (e) {
        var binary = utils.arrayBufferToBinaryString(this.result);
        att.data = binary;
        att.digest = 'md5-' + utils.MD5(binary);
        finish();
      };
      reader.readAsArrayBuffer(att.data);
    }

    function preprocessAttachments(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var docv = 0;

      docInfos.forEach(function (docInfo) {
        var attachments = docInfo.data && docInfo.data._attachments ?
          Object.keys(docInfo.data._attachments) : [];
        var recv = 0;

        if (!attachments.length) {
          return done();
        }

        function processedAttachment() {
          recv++;
          if (recv === attachments.length) {
            done();
          }
        }

        for (var key in docInfo.data._attachments) {
          if (docInfo.data._attachments.hasOwnProperty(key)) {
            preprocessAttachment(docInfo.data._attachments[key],
                                 processedAttachment);
          }
        }
      });

      function done() {
        docv++;
        if (docInfos.length === docv) {
          callback();
        }
      }
    }

    function writeDoc(docInfo, deleted, callback, isUpdate) {

      function finish() {
        var data = docInfo.data;
        var doc_id_rev = data._id + "::" + data._rev;
        var deletedInt = deleted ? 1 : 0;
        var fetchSql = select('seq', BY_SEQ_STORE, null, 'doc_id_rev=?');

        tx.executeSql(fetchSql, [doc_id_rev], function (err, res) {
          var sql, sqlArgs;
          if (res.rows.length) {
            sql = 'UPDATE ' + BY_SEQ_STORE +
              ' SET json=?, deleted=? WHERE doc_id_rev=?;';
            sqlArgs = [JSON.stringify(data), deletedInt, doc_id_rev];
            tx.executeSql(sql, sqlArgs, function (tx) {
              dataWritten(tx, res.rows.item(0).seq);
            });
          } else {
            sql = 'INSERT INTO ' + BY_SEQ_STORE +
              ' (doc_id_rev, json, deleted) VALUES (?, ?, ?);';
            sqlArgs = [doc_id_rev, JSON.stringify(data), deletedInt];
            tx.executeSql(sql, sqlArgs, function (tx, result) {
              dataWritten(tx, result.insertId);
            });
          }
        });
      }

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            callback(err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      var err = null;
      var recv = 0;

      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      if (deleted) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      function attachmentSaved(err) {
        recv++;
        collectResults(err);
      }

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          delete docInfo.data._attachments[key].data;
          var digest = docInfo.data._attachments[key].digest;
          saveAttachment(docInfo, digest, data, attachmentSaved);
        } else {
          recv++;
          collectResults();
        }
      }

      if (!attachments.length) {
        finish();
      }

      function dataWritten(tx, seq) {
        docInfo.metadata.seq = seq;
        delete docInfo.metadata.rev;

        var mainRev = merge.winningRev(docInfo.metadata);

        var sql = isUpdate ?
          'UPDATE ' + DOC_STORE +
          ' SET json=?, winningseq=(SELECT seq FROM ' + BY_SEQ_STORE +
          ' WHERE doc_id_rev=?) WHERE id=?'
          : 'INSERT INTO ' + DOC_STORE +
          ' (id, winningseq, json, local) VALUES (?, ?, ?, ?);';
        var metadataStr = JSON.stringify(docInfo.metadata);
        var key = docInfo.metadata.id + "::" + mainRev;
        var local = utils.isLocalId(docInfo.metadata.id) ? 1 : 0;
        var params = isUpdate ?
          [metadataStr, key, docInfo.metadata.id] :
          [docInfo.metadata.id, seq, metadataStr, local];
        tx.executeSql(sql, params, function () {
          results.push(docInfo);
          callback();
        });
      }
    }

    function updateDoc(oldDoc, docInfo) {
      var merged =
        merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);
      var deleted = utils.isDeleted(docInfo.metadata);
      var oldDocDeleted = utils.isDeleted(oldDoc);
      var inConflict = (oldDocDeleted && deleted && newEdits) ||
        (!oldDocDeleted && newEdits && merged.conflicts !== 'new_leaf');
      if (inConflict) {
        results.push(makeErr(errors.REV_CONFLICT, docInfo._bulk_seq));
        return processDocs();
      }

      docInfo.metadata.rev_tree = merged.tree;
      writeDoc(docInfo, deleted, processDocs, true);
    }

    function insertDoc(docInfo) {
      // Cant insert new deleted documents
      var deleted = utils.isDeleted(docInfo.metadata);
      if ('was_delete' in opts && deleted) {
        results.push(errors.MISSING_DOC);
        return processDocs();
      }
      writeDoc(docInfo, deleted, processDocs, false);
    }

    function processDocs() {
      if (!docInfos.length) {
        return complete();
      }
      var currentDoc = docInfos.shift();
      var id = currentDoc.metadata.id;
      if (id in fetchedDocs) {
        updateDoc(fetchedDocs[id], currentDoc);
      } else {
        // if we have newEdits=false then we can update the same
        // document twice in a single bulk docs call
        fetchedDocs[id] = currentDoc.metadata;
        insertDoc(currentDoc);
      }
    }

    // Insert sequence number into the error so we can sort later
    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    function saveAttachment(docInfo, digest, data, callback) {
      var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
      var newAtt = {digest: digest};
      var sql = 'SELECT digest, json FROM ' + ATTACH_STORE + ' WHERE digest=?';
      tx.executeSql(sql, [digest], function (tx, result) {
        if (!result.rows.length) {
          newAtt.refs = {};
          newAtt.refs[ref] = true;
          sql = 'INSERT INTO ' + ATTACH_STORE +
                '(digest, json, body) VALUES (?, ?, ?)';
          tx.executeSql(sql, [digest, JSON.stringify(newAtt), data],
            function () {
            callback();
          });
        } else {
          newAtt.refs = JSON.parse(result.rows.item(0).json).refs;
          sql = 'UPDATE ' + ATTACH_STORE + ' SET json=?, body=? WHERE digest=?';
          tx.executeSql(sql, [JSON.stringify(newAtt), data, digest],
            function () {
            callback();
          });
        }
      });
    }

    function metadataFetched(tx, results) {
      for (var j = 0; j < results.rows.length; j++) {
        var row = results.rows.item(j);
        var id = parseHexString(row.hexId, encoding);
        fetchedDocs[id] = JSON.parse(row.json);
      }
      processDocs();
    }

    preprocessAttachments(function () {
      db.transaction(function (txn) {
        tx = txn;
        var sql = 'SELECT hex(id) AS hexId, json FROM ' + DOC_STORE +
          ' WHERE id IN ' + '(' +
          docInfos.map(function () {return '?'; }).join(',') + ')';
        var queryArgs = docInfos.map(function (d) { return d.metadata.id; });
        tx.executeSql(sql, queryArgs, metadataFetched);
      }, unknownError(callback), function () {
        docCount = -1;
      });
    });
  };

  api._get = function (id, opts, callback) {
    opts = utils.clone(opts);
    var doc;
    var metadata;
    var err;
    if (!opts.ctx) {
      db.readTransaction(function (txn) {
        opts.ctx = txn;
        api._get(id, opts, callback);
      });
      return;
    }
    var tx = opts.ctx;

    function finish() {
      callback(err, {doc: doc, metadata: metadata, ctx: tx});
    }

    var sql;
    var sqlArgs;
    if (opts.rev) {
      sql = select(
        SELECT_DOCS,
        [DOC_STORE, BY_SEQ_STORE],
        null,
        [BY_SEQ_STORE + '.doc_id_rev=?', DOC_STORE + '.id=?']);
      sqlArgs = [id + '::' + opts.rev, id];
    } else {
      sql = select(
        SELECT_DOCS,
        [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE_AND_BY_SEQ_JOINER,
        DOC_STORE + '.id=?');
      sqlArgs = [id];
    }
    tx.executeSql(sql, sqlArgs, function (a, results) {
      if (!results.rows.length) {
        err = errors.MISSING_DOC;
        return finish();
      }
      var item = results.rows.item(0);
      metadata = JSON.parse(item.metadata);
      if (item.deleted && !opts.rev) {
        err = errors.error(errors.MISSING_DOC, 'deleted');
        return finish();
      }
      doc = JSON.parse(item.data);
      finish();
    });
  };

  function countDocs(tx, callback) {

    if (docCount !== -1) {
      return callback(docCount);
    }

    // count the total rows
    var sql = select(
      'COUNT(' + DOC_STORE + '.id) AS \'num\'',
      [DOC_STORE, BY_SEQ_STORE],
      DOC_STORE_AND_BY_SEQ_JOINER,
      [BY_SEQ_STORE + '.deleted=0', DOC_STORE + '.local=0']);

    tx.executeSql(sql, [], function (tx, result) {
      docCount = result.rows.item(0).num;
      callback(docCount);
    });
  }

  api._allDocs = function (opts, callback) {
    var results = [];
    var totalRows;

    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;
    var key = 'key' in opts ? opts.key : false;
    var descending = 'descending' in opts ? opts.descending : false;
    var limit = 'limit' in opts ? opts.limit : -1;
    var offset = 'skip' in opts ? opts.skip : 0;
    var inclusiveEnd = opts.inclusive_end !== false;

    var sqlArgs = [];
    var criteria = [DOC_STORE + '.local = 0'];

    if (key !== false) {
      criteria.push(DOC_STORE + '.id = ?');
      sqlArgs.push(key);
    } else if (start !== false || end !== false) {
      if (start !== false) {
        criteria.push(DOC_STORE + '.id ' + (descending ? '<=' : '>=') + ' ?');
        sqlArgs.push(start);
      }
      if (end !== false) {
        var comparator = descending ? '>' : '<';
        if (inclusiveEnd) {
          comparator += '=';
        }
        criteria.push(DOC_STORE + '.id ' + comparator + ' ?');
        sqlArgs.push(end);
      }
      if (key !== false) {
        criteria.push(DOC_STORE + '.id = ?');
        sqlArgs.push(key);
      }
    }

    if (opts.deleted !== 'ok') {
      // report deleted if keys are specified
      criteria.push(BY_SEQ_STORE + '.deleted = 0');
    }

    db.readTransaction(function (tx) {

      // first count up the total rows
      countDocs(tx, function (count) {
        totalRows = count;

        if (limit === 0) {
          return;
        }

        // then actually fetch the documents
        var sql = select(
          SELECT_DOCS,
          [DOC_STORE, BY_SEQ_STORE],
          DOC_STORE_AND_BY_SEQ_JOINER,
          criteria,
          DOC_STORE + '.id ' + (descending ? 'DESC' : 'ASC')
          );
        sql += ' LIMIT ' + limit + ' OFFSET ' + offset;

        tx.executeSql(sql, sqlArgs, function (tx, result) {
          for (var i = 0, l = result.rows.length; i < l; i++) {
            var item = result.rows.item(i);
            var metadata = JSON.parse(item.metadata);
            var data = JSON.parse(item.data);
            var winningRev = data._rev;
            var doc = {
              id: metadata.id,
              key: metadata.id,
              value: {rev: winningRev}
            };
            if (opts.include_docs) {
              doc.doc = data;
              doc.doc._rev = winningRev;
              if (opts.conflicts) {
                doc.doc._conflicts = merge.collectConflicts(metadata);
              }
              for (var att in doc.doc._attachments) {
                if (doc.doc._attachments.hasOwnProperty(att)) {
                  doc.doc._attachments[att].stub = true;
                }
              }
            }
            if (item.deleted) {
              if (opts.deleted === 'ok') {
                doc.value.deleted = true;
                doc.doc = null;
              } else {
                continue;
              }
            }
            results.push(doc);
          }
        });
      });
    }, unknownError(callback), function () {
      callback(null, {
        total_rows: totalRows,
        offset: opts.skip,
        rows: results
      });
    });
  };

  api._changes = function (opts) {
    opts = utils.clone(opts);

    if (opts.continuous) {
      var id = name + ':' + utils.uuid();
      WebSqlPouch.Changes.addListener(name, id, api, opts);
      WebSqlPouch.Changes.notify(name);
      return {
        cancel: function () {
          WebSqlPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var limit = 'limit' in opts ? opts.limit : -1;
    if (limit === 0) {
      limit = 1; // per CouchDB _changes spec
    }

    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }
    var results = [];
    var numResults = 0;
    function fetchChanges() {

      var criteria = [
        DOC_STORE + '.winningseq > ' + opts.since,
        DOC_STORE + '.local = 0'
      ];
      var sqlArgs = [];
      if (opts.doc_ids) {
        criteria.push(DOC_STORE + '.id IN (' + opts.doc_ids.map(function () {
          return '?';
        }).join(',') + ')');
        sqlArgs = opts.doc_ids;
      }

      var sql = select(SELECT_DOCS, [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE_AND_BY_SEQ_JOINER, criteria,
        DOC_STORE + '.winningseq ' + (descending ? 'DESC' : 'ASC'));

      var filter = utils.filterChange(opts);
      if (!opts.view && !opts.filter) {
        // we can just limit in the query
        sql += ' LIMIT ' + limit;
      }

      db.readTransaction(function (tx) {
        tx.executeSql(sql, sqlArgs, function (tx, result) {
          var lastSeq = 0;
          for (var i = 0, l = result.rows.length; i < l; i++) {
            var res = result.rows.item(i);
            var metadata = JSON.parse(res.metadata);
            if (lastSeq < res.seq) {
              lastSeq = res.seq;
            }
            var doc = JSON.parse(res.data);
            var change = opts.processChange(doc, metadata, opts);
            change.seq = res.seq;
            if (filter(change)) {
              numResults++;
              if (returnDocs) {
                results.push(change);
              }
              opts.onChange(change);
            }
            if (numResults === limit) {
              break;
            }
          }
          if (!opts.continuous) {
            opts.complete(null, {
              results: results,
              last_seq: lastSeq
            });
          }
        });
      });
    }

    fetchChanges();
  };

  api._close = function (callback) {
    //WebSQL databases do not need to be closed
    callback();
  };

  api._getAttachment = function (attachment, opts, callback) {
    var res;
    var tx = opts.ctx;
    var digest = attachment.digest;
    var type = attachment.content_type;
    var sql = 'SELECT hex(body) as body FROM ' + ATTACH_STORE +
              ' WHERE digest=?';
    tx.executeSql(sql, [digest], function (tx, result) {
      // sqlite normally stores data as utf8, so even the hex() function
      // "encodes" the binary data in utf8/16 before returning it. yet hex()
      // is the only way to get the full data, so we do this.
      var data = parseHexString(result.rows.item(0).body, encoding);
      if (opts.encode) {
        res = btoa(data);
      } else {
        data = utils.fixBinary(data);
        res = utils.createBlob([data], {type: type});
      }
      callback(null, res);
    });
  };

  api._getRevisionTree = function (docId, callback) {
    db.readTransaction(function (tx) {
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function (tx, result) {
        if (!result.rows.length) {
          callback(errors.MISSING_DOC);
        } else {
          var data = JSON.parse(result.rows.item(0).metadata);
          callback(null, data.rev_tree);
        }
      });
    });
  };

  api._doCompaction = function (docId, rev_tree, revs, callback) {
    if (!revs.length) {
      return callback();
    }
    db.transaction(function (tx) {
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function (tx, result) {
        if (!result.rows.length) {
          return utils.call(callback);
        }
        var metadata = JSON.parse(result.rows.item(0).metadata);
        metadata.rev_tree = rev_tree;

        // websql never calls callback if we do WHERE doc_id_rev IN (...)
        var numDone = 0;
        revs.forEach(function (rev) {
          var docIdRev = docId + '::' + rev;
          var sql = 'DELETE FROM ' + BY_SEQ_STORE + ' WHERE doc_id_rev = ?';
          tx.executeSql(sql, [docIdRev], function (tx) {
            if (++numDone === revs.length) {
              var sql = 'UPDATE ' + DOC_STORE + ' SET json = ? WHERE id = ?';
              tx.executeSql(sql, [JSON.stringify(metadata), docId],
                function () {
                callback();
              });
            }
          });
        });
      });
    });
  };
}

WebSqlPouch.valid = function () {
  if (typeof global !== 'undefined') {
    if (global.navigator &&
        global.navigator.sqlitePlugin &&
        global.navigator.sqlitePlugin.openDatabase) {
      return true;
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return true;
    } else if (global.openDatabase) {
      return true;
    }
  }
  return false;
};

WebSqlPouch.destroy = utils.toPromise(function (name, opts, callback) {
  var db = openDB(name, POUCH_VERSION, name, POUCH_SIZE);
  db.transaction(function (tx) {
    var stores = [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, META_STORE];
    stores.forEach(function (store) {
      tx.executeSql('DROP TABLE IF EXISTS ' + store, []);
    });
  }, unknownError(callback), function () {
    if (utils.hasLocalStorage()) {
      delete global.localStorage['_pouch__websqldb_' + name];
      delete global.localStorage[name];
    }
    callback(null, {'ok': true});
  });
});

WebSqlPouch.Changes = new utils.Changes();

module.exports = WebSqlPouch;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../deps/errors":10,"../merge":16,"../utils":21}],6:[function(_dereq_,module,exports){
'use strict';
var utils = _dereq_('./utils');
var merge = _dereq_('./merge');
var errors = _dereq_('./deps/errors');
var EE = _dereq_('events').EventEmitter;
var evalFilter = _dereq_('./evalFilter');
var evalView = _dereq_('./evalView');
module.exports = Changes;
utils.inherits(Changes, EE);

function Changes(db, opts, callback) {
  EE.call(this);
  var self = this;
  this.db = db;
  opts = opts ? utils.clone(opts) : {};
  var oldComplete = callback || opts.complete || function () {};
  var complete = opts.complete = utils.once(function (err, resp) {
    if (err) {
      self.emit('error', err);
    } else {
      self.emit('complete', resp);
    }
    self.removeAllListeners();
    db.removeListener('destroyed', onDestroy);
  });
  if (oldComplete) {
    self.on('complete', function (resp) {
      oldComplete(null, resp);
    });
    self.on('error', function (err) {
      oldComplete(err);
    });
  }
  var oldOnChange = opts.onChange;
  if (oldOnChange) {
    self.on('change', oldOnChange);
  }
  function onDestroy() {
    self.cancel();
  }
  db.once('destroyed', onDestroy);

  opts.onChange = function (change) {
    if (opts.isCancelled) {
      return;
    }
    self.emit('change', change);
    if (self.startSeq && self.startSeq <= change.seq) {
      self.emit('uptodate');
      self.startSeq = false;
    }
    if (change.deleted) {
      self.emit('delete', change);
    } else if (change.changes.length === 1 &&
      change.changes[0].rev.slice(0, 2) === '1-') {
      self.emit('create', change);
    } else {
      self.emit('update', change);
    }
  };

  var promise = new utils.Promise(function (fulfill, reject) {
    opts.complete = function (err, res) {
      if (err) {
        reject(err);
      } else {
        fulfill(res);
      }
    };
  });
  self.once('cancel', function () {
    if (oldOnChange) {
      self.removeListener('change', oldOnChange);
    }
    opts.complete(null, {status: 'cancelled'});
  });
  this.then = promise.then.bind(promise);
  this['catch'] = promise['catch'].bind(promise);
  this.then(function (result) {
    complete(null, result);
  }, complete);



  if (!db.taskqueue.isReady) {
    db.taskqueue.addTask(function () {
      if (self.isCancelled) {
        self.emit('cancel');
      } else {
        self.doChanges(opts);
      }
    });
  } else {
    self.doChanges(opts);
  }
}
Changes.prototype.cancel = function () {
  this.isCancelled = true;
  if (this.db.taskqueue.isReady) {
    this.emit('cancel');
  }
};
function processChange(doc, metadata, opts) {
  var changeList = [{rev: doc._rev}];
  if (opts.style === 'all_docs') {
    changeList = merge.collectLeaves(metadata.rev_tree)
    .map(function (x) { return {rev: x.rev}; });
  }
  var change = {
    id: metadata.id,
    changes: changeList,
    doc: doc
  };

  if (utils.isDeleted(metadata, doc._rev)) {
    change.deleted = true;
  }
  if (opts.conflicts) {
    change.doc._conflicts = merge.collectConflicts(metadata);
    if (!change.doc._conflicts.length) {
      delete change.doc._conflicts;
    }
  }
  return change;
}

Changes.prototype.doChanges = function (opts) {
  var self = this;
  var callback = opts.complete;

  opts = utils.clone(opts);
  if ('live' in opts && !('continuous' in opts)) {
    opts.continuous = opts.live;
  }
  opts.processChange = processChange;

  if (!opts.since) {
    opts.since = 0;
  }
  if (opts.since === 'latest') {
    this.db.info().then(function (info) {
      if (self.isCancelled) {
        callback(null, {status: 'cancelled'});
        return;
      }
      opts.since = info.update_seq  - 1;
      self.doChanges(opts);
    }, callback);
    return;
  }

  if (opts.continuous && opts.since !== 'latest') {
    this.db.info().then(function (info) {
      self.startSeq = info.update_seq - 1;
    }, function (err) {
      if (err.id === 'idbNull') {
        //db closed before this returned
        //thats ok
        return;
      }
      throw err;
    });
  }

  if (this.db.type() !== 'http' &&
    opts.filter && typeof opts.filter === 'string') {
    return this.filterChanges(opts);
  }

  if (!('descending' in opts)) {
    opts.descending = false;
  }

  // 0 and 1 should return 1 document
  opts.limit = opts.limit === 0 ? 1 : opts.limit;
  opts.complete = callback;
  var newPromise = this.db._changes(opts);
  if (newPromise && typeof newPromise.cancel === 'function') {
    var cancel = self.cancel;
    self.cancel = utils.getArguments(function (args) {
      newPromise.cancel();
      cancel.apply(this, args);
    });
  }
};

Changes.prototype.filterChanges = function (opts) {
  var self = this;
  var callback = opts.complete;
  if (opts.filter === '_view') {
    if (!opts.view || typeof opts.view !== 'string') {
      var err = new  Error('`view` filter parameter is not provided.');
      err.status = errors.BAD_REQUEST.status;
      err.name = errors.BAD_REQUEST.name;
      err.error = true;
      callback(err);
      return;
    }
    // fetch a view from a design doc, make it behave like a filter
    var viewName = opts.view.split('/');
    this.db.get('_design/' + viewName[0], function (err, ddoc) {
      if (self.isCancelled) {
        callback(null, {status: 'cancelled'});
        return;
      }
      if (err) {
        callback(err);
        return;
      }
      if (ddoc && ddoc.views && ddoc.views[viewName[1]]) {
        
        var filter = evalView(ddoc.views[viewName[1]].map);
        opts.filter = filter;
        self.doChanges(opts);
        return;
      }
      var msg = ddoc.views ? 'missing json key: ' + viewName[1] :
        'missing json key: views';
      if (!err) {
        err = new  Error(msg);
        err.status = errors.MISSING_DOC.status;
        err.name = errors.MISSING_DOC.name;
        err.error = true;
      }
      callback(err);
      return;
    });
  } else {
    // fetch a filter from a design doc
    var filterName = opts.filter.split('/');
    this.db.get('_design/' + filterName[0], function (err, ddoc) {
      if (self.isCancelled) {
        callback(null, {status: 'cancelled'});
        return;
      }
      if (err) {
        callback(err);
        return;
      }
      if (ddoc && ddoc.filters && ddoc.filters[filterName[1]]) {
        var filter = evalFilter(ddoc.filters[filterName[1]]);
        opts.filter = filter;
        self.doChanges(opts);
        return;
      } else {
        var msg = (ddoc && ddoc.filters) ? 'missing json key: ' + filterName[1]
          : 'missing json key: filters';
        if (!err) {
          err = new  Error(msg);
          err.status = errors.MISSING_DOC.status;
          err.name = errors.MISSING_DOC.name;
          err.error = true;
        }
        callback(err);
        return;
      }
    });
  }
};
},{"./deps/errors":10,"./evalFilter":13,"./evalView":14,"./merge":16,"./utils":21,"events":24}],7:[function(_dereq_,module,exports){
(function (global){
/*globals cordova */
"use strict";

var Adapter = _dereq_('./adapter');
var utils = _dereq_('./utils');
var TaskQueue = _dereq_('./taskqueue');
var Promise = utils.Promise;

function defaultCallback(err) {
  if (err && global.debug) {
    console.error(err);
  }
}

utils.inherits(PouchDBVersion220, Adapter);
function PouchDBVersion220(name, opts, callback) {

  if (!(this instanceof PouchDBVersion220)) {
    return new PouchDBVersion220(name, opts, callback);
  }
  var self = this;
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (typeof name === 'object') {
    opts = name;
    name = undefined;
  }
  if (typeof callback === 'undefined') {
    callback = defaultCallback;
  }
  opts = opts || {};
  var oldCB = callback;
  self.auto_compaction = opts.auto_compaction;
  self.prefix = PouchDBVersion220.prefix;
  Adapter.call(self);
  self.taskqueue = new TaskQueue();
  var promise = new Promise(function (fulfill, reject) {
    callback = function (err, resp) {
      if (err) {
        return reject(err);
      }
      delete resp.then;
      fulfill(resp);
    };
  
    opts = utils.clone(opts);
    var originalName = opts.name || name;
    var backend, error;
    (function () {
      try {

        if (typeof originalName !== 'string') {
          error = new Error('Missing/invalid DB name');
          error.code = 400;
          throw error;
        }

        backend = PouchDBVersion220.parseAdapter(originalName, opts);
        
        opts.originalName = originalName;
        opts.name = backend.name;
        opts.adapter = opts.adapter || backend.adapter;
        self._adapter = opts.adapter;
        if (!PouchDBVersion220.adapters[opts.adapter]) {
          error = new Error('Adapter is missing');
          error.code = 404;
          throw error;
        }

        if (!PouchDBVersion220.adapters[opts.adapter].valid()) {
          error = new Error('Invalid Adapter');
          error.code = 404;
          throw error;
        }
      } catch (err) {
        self.taskqueue.fail(err);
        self.changes = utils.toPromise(function (opts) {
          if (opts.complete) {
            opts.complete(err);
          }
        });
      }
    }());
    if (error) {
      return reject(error); // constructor error, see above
    }
    self.adapter = opts.adapter;

    // needs access to PouchDBVersion220;
    self.replicate = {};

    self.replicate.from = function (url, opts, callback) {
      return PouchDBVersion220.replicate(url, self, opts, callback);
    };

    self.replicate.to = function (url, opts, callback) {
      return PouchDBVersion220.replicate(self, url, opts, callback);
    };

    self.sync = function (dbName, opts, callback) {
      return PouchDBVersion220.sync(self, dbName, opts, callback);
    };

    self.replicate.sync = self.sync;

    self.destroy = utils.adapterFun('destroy', function (callback) {
      var self = this;
      self.info(function (err, info) {
        if (err) {
          return callback(err);
        }
        PouchDBVersion220.destroy(info.db_name, callback);
      });
    });

    PouchDBVersion220.adapters[opts.adapter].call(self, opts, function (err, db) {
      if (err) {
        if (callback) {
          self.taskqueue.fail(err);
          callback(err);
        }
        return;
      }
      function destructionListener(event) {
        if (event === 'destroyed') {
          self.emit('destroyed');
          PouchDBVersion220.removeListener(opts.name, destructionListener);
        }
      }
      PouchDBVersion220.on(opts.name, destructionListener);
      self.emit('created', self);
      PouchDBVersion220.emit('created', opts.originalName);
      self.taskqueue.ready(self);
      callback(null, self);
      
    });
    if (opts.skipSetup) {
      self.taskqueue.ready(self);
    }

    if (utils.isCordova()) {
      //to inform websql adapter that we can use api
      cordova.fireWindowEvent(opts.name + "_pouch", {});
    }
  });
  promise.then(function (resp) {
    oldCB(null, resp);
  }, oldCB);
  self.then = promise.then.bind(promise);
  self["catch"] = promise["catch"].bind(promise);

}

module.exports = PouchDBVersion220;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./adapter":2,"./taskqueue":20,"./utils":21}],8:[function(_dereq_,module,exports){
"use strict";

var createBlob = _dereq_('./blob.js');
var errors = _dereq_('./errors');
var utils = _dereq_("../utils");

function ajax(options, adapterCallback) {

  var requestCompleted = false;
  var callback = utils.getArguments(function (args) {
    if (requestCompleted) {
      return;
    }
    adapterCallback.apply(this, args);
    requestCompleted = true;
  });

  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  options = utils.clone(options);

  var defaultOptions = {
    method : "GET",
    headers: {},
    json: true,
    processData: true,
    timeout: 10000,
    cache: false
  };

  options = utils.extend(true, defaultOptions, options);

  // cache-buster, specifically designed to work around IE's aggressive caching
  // see http://www.dashbay.com/2011/05/internet-explorer-caches-ajax/
  if (options.method === 'GET' && !options.cache) {
    var hasArgs = options.url.indexOf('?') !== -1;
    options.url += (hasArgs ? '&' : '?') + '_nonce=' + utils.uuid(16);
  }

  function onSuccess(obj, resp, cb) {
    if (!options.binary && !options.json && options.processData &&
      typeof obj !== 'string') {
      obj = JSON.stringify(obj);
    } else if (!options.binary && options.json && typeof obj === 'string') {
      try {
        obj = JSON.parse(obj);
      } catch (e) {
        // Probably a malformed JSON from server
        return cb(e);
      }
    }
    if (Array.isArray(obj)) {
      obj = obj.map(function (v) {
        var obj;
        if (v.ok) {
          return v;
        } else if (v.error && v.error === 'conflict') {
          obj = errors.REV_CONFLICT;
          obj.id = v.id;
          return obj;
        } else if (v.error && v.error === 'forbidden') {
          obj = errors.FORBIDDEN;
          obj.id = v.id;
          obj.reason = v.reason;
          return obj;
        } else if (v.missing) {
          obj = errors.MISSING_DOC;
          obj.missing = v.missing;
          return obj;
        } else {
          return v;
        }
      });
    }
    cb(null, obj, resp);
  }

  function onError(err, cb) {
    var errParsed, errObj, errType, key;
    try {
      errParsed = JSON.parse(err.responseText);
      //would prefer not to have a try/catch clause
      for (key in errors) {
        if (errors.hasOwnProperty(key) &&
            errors[key].name === errParsed.error) {
          errType = errors[key];
          break;
        }
      }
      if (!errType) {
        errType = errors.UNKNOWN_ERROR;
        if (err.status) {
          errType.status = err.status;
        }
        if (err.statusText) {
          err.name = err.statusText;
        }
      }
      errObj = errors.error(errType, errParsed.reason);
    } catch (e) {
      for (var key in errors) {
        if (errors.hasOwnProperty(key) && errors[key].status === err.status) {
          errType = errors[key];
          break;
        }
      }
      if (!errType) {
        errType = errors.UNKNOWN_ERROR;
        if (err.status) {
          errType.status = err.status;
        }
        if (err.statusText) {
          err.name = err.statusText;
        }
      }
      errObj = errors.error(errType);
    }
    cb(errObj);
  }

  var timer;
  var xhr;
  if (options.xhr) {
    xhr = new options.xhr();
  } else {
    xhr = new XMLHttpRequest();
  }
  xhr.open(options.method, options.url);
  xhr.withCredentials = true;

  if (options.json) {
    options.headers.Accept = 'application/json';
    options.headers['Content-Type'] = options.headers['Content-Type'] ||
      'application/json';
    if (options.body &&
        options.processData &&
        typeof options.body !== "string") {
      options.body = JSON.stringify(options.body);
    }
  }

  if (options.binary) {
    xhr.responseType = 'arraybuffer';
  }

  var createCookie = function (name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toGMTString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
  };

  for (var key in options.headers) {
    if (key === 'Cookie') {
      var cookie = options.headers[key].split('=');
      createCookie(cookie[0], cookie[1], 10);
    } else {
      xhr.setRequestHeader(key, options.headers[key]);
    }
  }

  if (!("body" in options)) {
    options.body = null;
  }

  var abortReq = function () {
    if (requestCompleted) {
      return;
    }
    xhr.abort();
    onError(xhr, callback);
  };

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4 || requestCompleted) {
      return;
    }
    clearTimeout(timer);
    if (xhr.status >= 200 && xhr.status < 300) {
      var data;
      if (options.binary) {
        data = createBlob([xhr.response || ''], {
          type: xhr.getResponseHeader('Content-Type')
        });
      } else {
        data = xhr.responseText;
      }
      onSuccess(data, xhr, callback);
    } else {
      onError(xhr, callback);
    }
  };

  if (options.timeout > 0) {
    timer = setTimeout(abortReq, options.timeout);
    xhr.onprogress = function () {
      clearTimeout(timer);
      timer = setTimeout(abortReq, options.timeout);
    };
    if (xhr.upload) { // does not exist in ie9
      xhr.upload.onprogress = xhr.onprogress;
    }
  }
  xhr.send(options.body);
  return {abort: abortReq};

}

module.exports = ajax;

},{"../utils":21,"./blob.js":9,"./errors":10}],9:[function(_dereq_,module,exports){
(function (global){
"use strict";

//Abstracts constructing a Blob object, so it also works in older
//browsers that don't support the native Blob constructor. (i.e.
//old QtWebKit versions, at least).
function createBlob(parts, properties) {
  parts = parts || [];
  properties = properties || {};
  try {
    return new Blob(parts, properties);
  } catch (e) {
    if (e.name !== "TypeError") {
      throw e;
    }
    var BlobBuilder = global.BlobBuilder ||
                      global.MSBlobBuilder ||
                      global.MozBlobBuilder ||
                      global.WebKitBlobBuilder;
    var builder = new BlobBuilder();
    for (var i = 0; i < parts.length; i += 1) {
      builder.append(parts[i]);
    }
    return builder.getBlob(properties.type);
  }
}

module.exports = createBlob;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(_dereq_,module,exports){
"use strict";

function PouchError(opts) {
  this.status = opts.status;
  this.name = opts.error;
  this.message = opts.reason;
  this.error = true;
}

PouchError.prototype__proto__ = Error.prototype;

PouchError.prototype.toString = function () {
  return JSON.stringify({
    status: this.status,
    name: this.name,
    message: this.message
  });
};

exports.UNAUTHORIZED = new PouchError({
  status: 401,
  error: 'unauthorized',
  reason: "Name or password is incorrect."
});
exports.MISSING_BULK_DOCS = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: "Missing JSON list of 'docs'"
});
exports.MISSING_DOC = new PouchError({
  status: 404,
  error: 'not_found',
  reason: 'missing'
});
exports.REV_CONFLICT = new PouchError({
  status: 409,
  error: 'conflict',
  reason: 'Document update conflict'
});
exports.INVALID_ID = new PouchError({
  status: 400,
  error: 'invalid_id',
  reason: '_id field must contain a string'
});
exports.MISSING_ID = new PouchError({
  status: 412,
  error: 'missing_id',
  reason: '_id is required for puts'
});
exports.RESERVED_ID = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Only reserved document ids may start with underscore.'
});
exports.NOT_OPEN = new PouchError({
  status: 412,
  error: 'precondition_failed',
  reason: 'Database not open so cannot close'
});
exports.UNKNOWN_ERROR = new PouchError({
  status: 500,
  error: 'unknown_error',
  reason: 'Database encountered an unknown error'
});
exports.BAD_ARG = new PouchError({
  status: 500,
  error: 'badarg',
  reason: 'Some query argument is invalid'
});
exports.INVALID_REQUEST = new PouchError({
  status: 400,
  error: 'invalid_request',
  reason: 'Request was invalid'
});
exports.QUERY_PARSE_ERROR = new PouchError({
  status: 400,
  error: 'query_parse_error',
  reason: 'Some query parameter is invalid'
});
exports.DOC_VALIDATION = new PouchError({
  status: 500,
  error: 'doc_validation',
  reason: 'Bad special document member'
});
exports.BAD_REQUEST = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Something wrong with the request'
});
exports.NOT_AN_OBJECT = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Document must be a JSON object'
});
exports.DB_MISSING = new PouchError({
  status: 404,
  error: 'not_found',
  reason: 'Database not found'
});
exports.IDB_ERROR = new PouchError({
  status: 500,
  error: 'indexed_db_went_bad',
  reason: 'unknown'
});
exports.WSQ_ERROR = new PouchError({
  status: 500,
  error: 'web_sql_went_bad',
  reason: 'unknown'
});
exports.LDB_ERROR = new PouchError({
  status: 500,
  error: 'levelDB_went_went_bad',
  reason: 'unknown'
});
exports.FORBIDDEN = new PouchError({
  status: 403,
  error: 'forbidden',
  reason: 'Forbidden by design doc validate_doc_update function'
});
exports.error = function (error, reason, name) {
  function CustomPouchError(msg) {
    this.message = reason;
    if (name) {
      this.name = name;
    }
  }
  CustomPouchError.prototype = error;
  return new CustomPouchError(reason);
};

},{}],11:[function(_dereq_,module,exports){
'use strict';
var Promise = _dereq_('../utils').Promise;

// this is essentially the "update sugar" function from daleharvey/pouchdb#1388
// the diffFun tells us what delta to apply to the doc.  it either returns
// the doc, or false if it doesn't need to do an update after all
function upsert(db, docId, diffFun) {
  return new Promise(function (fulfill, reject) {
    if (docId && typeof docId === 'object') {
      docId = docId._id;
    }
    if (typeof docId !== 'string') {
      return reject(new Error('doc id is required'));
    }

    db.get(docId, function (err, doc) {
      if (err) {
        if (err.name !== 'not_found') {
          return reject(err);
        }
        return fulfill(tryAndPut(db, diffFun({_id : docId}), diffFun));
      }
      var newDoc = diffFun(doc);
      if (!newDoc) {
        return fulfill(doc);
      }
      fulfill(tryAndPut(db, newDoc, diffFun));
    });
  });
}

function tryAndPut(db, doc, diffFun) {
  return db.put(doc)["catch"](function (err) {
    if (err.name !== 'conflict') {
      throw err;
    }
    return upsert(db, doc, diffFun);
  });
}

module.exports = function (db, docId, diffFun, cb) {
  if (typeof cb === 'function') {
    upsert(db, docId, diffFun).then(function (resp) {
      cb(null, resp);
    }, cb);
  } else {
    return upsert(db, docId, diffFun);
  }
};

},{"../utils":21}],12:[function(_dereq_,module,exports){
"use strict";

// BEGIN Math.uuid.js

/*!
Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. 
 *   // (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
var chars = (
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz'
).split('');
function getValue(radix) {
  return 0 | Math.random() * radix;
}
function uuid(len, radix) {
  radix = radix || chars.length;
  var out = '';
  var i = -1;

  if (len) {
    // Compact form
    while (++i < len) {
      out += chars[getValue(radix)];
    }
    return out;
  }
    // rfc4122, version 4 form
    // Fill in random data.  At i==19 set the high bits of clock sequence as
    // per rfc4122, sec. 4.1.5
  while (++i < 36) {
    switch (i) {
      case 8:
      case 13:
      case 18:
      case 23:
        out += '-';
        break;
      case 19:
        out += chars[(getValue(16) & 0x3) | 0x8];
        break;
      default:
        out += chars[getValue(16)];
    }
  }

  return out;
}



module.exports = uuid;


},{}],13:[function(_dereq_,module,exports){
'use strict';

module.exports = evalFilter;
function evalFilter(input) {
  /*jshint evil: true */
  return eval([
    '(function () { return ',
    input,
    ' })()'
  ].join(''));
}
},{}],14:[function(_dereq_,module,exports){
'use strict';

module.exports = evalView;
function evalView(input) {
  /*jshint evil: true */
  return eval([
    '(function () {',
    '  return function (doc) {',
    '    var emitted = false;',
    '    var emit = function (a, b) {',
    '      emitted = true;',
    '    };',
    '    var view = ' + input + ';',
    '    view(doc);',
    '    if (emitted) {',
    '      return true;',
    '    }',
    '  }',
    '})()'
  ].join('\n'));
}
},{}],15:[function(_dereq_,module,exports){
(function (process){
"use strict";

var PouchDBVersion220 = _dereq_('./setup');

module.exports = PouchDBVersion220;

PouchDBVersion220.ajax = _dereq_('./deps/ajax');
PouchDBVersion220.extend = _dereq_('extend');
PouchDBVersion220.utils = _dereq_('./utils');
PouchDBVersion220.Errors = _dereq_('./deps/errors');
PouchDBVersion220.replicate = _dereq_('./replicate').replicate;
PouchDBVersion220.sync = _dereq_('./sync');
PouchDBVersion220.version = _dereq_('./version');
var httpAdapter = _dereq_('./adapters/http');
PouchDBVersion220.adapter('http', httpAdapter);
PouchDBVersion220.adapter('https', httpAdapter);

PouchDBVersion220.adapter('idb', _dereq_('./adapters/idb'));
PouchDBVersion220.adapter('websql', _dereq_('./adapters/websql'));
PouchDBVersion220.plugin(_dereq_('pouchdb-mapreduce'));

if (!process.browser) {
  var ldbAdapter = _dereq_('./adapters/leveldb');
  PouchDBVersion220.adapter('ldb', ldbAdapter);
  PouchDBVersion220.adapter('leveldb', ldbAdapter);
}

}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"./adapters/http":3,"./adapters/idb":4,"./adapters/leveldb":23,"./adapters/websql":5,"./deps/ajax":8,"./deps/errors":10,"./replicate":17,"./setup":18,"./sync":19,"./utils":21,"./version":1,"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":25,"extend":26,"pouchdb-mapreduce":48}],16:[function(_dereq_,module,exports){
'use strict';
var utils = _dereq_('./utils');


// for a better overview of what this is doing, read:
// https://github.com/apache/couchdb/blob/master/src/couchdb/couch_key_tree.erl
//
// But for a quick intro, CouchDB uses a revision tree to store a documents
// history, A -> B -> C, when a document has conflicts, that is a branch in the
// tree, A -> (B1 | B2 -> C), We store these as a nested array in the format
//
// KeyTree = [Path ... ]
// Path = {pos: position_from_root, ids: Tree}
// Tree = [Key, Opts, [Tree, ...]], in particular single node: [Key, []]

// Turn a path as a flat array into a tree with a single branch
function pathToTree(path) {
  var doc = path.shift();
  var root = [doc.id, doc.opts, []];
  var leaf = root;
  var nleaf;

  while (path.length) {
    doc = path.shift();
    nleaf = [doc.id, doc.opts, []];
    leaf[2].push(nleaf);
    leaf = nleaf;
  }
  return root;
}

// Merge two trees together
// The roots of tree1 and tree2 must be the same revision
function mergeTree(in_tree1, in_tree2) {
  var queue = [{tree1: in_tree1, tree2: in_tree2}];
  var conflicts = false;
  while (queue.length > 0) {
    var item = queue.pop();
    var tree1 = item.tree1;
    var tree2 = item.tree2;

    if (tree1[1].status || tree2[1].status) {
      tree1[1].status =
        (tree1[1].status ===  'available' ||
         tree2[1].status === 'available') ? 'available' : 'missing';
    }

    for (var i = 0; i < tree2[2].length; i++) {
      if (!tree1[2][0]) {
        conflicts = 'new_leaf';
        tree1[2][0] = tree2[2][i];
        continue;
      }

      var merged = false;
      for (var j = 0; j < tree1[2].length; j++) {
        if (tree1[2][j][0] === tree2[2][i][0]) {
          queue.push({tree1: tree1[2][j], tree2: tree2[2][i]});
          merged = true;
        }
      }
      if (!merged) {
        conflicts = 'new_branch';
        tree1[2].push(tree2[2][i]);
        tree1[2].sort();
      }
    }
  }
  return {conflicts: conflicts, tree: in_tree1};
}

function doMerge(tree, path, dontExpand) {
  var restree = [];
  var conflicts = false;
  var merged = false;
  var res;

  if (!tree.length) {
    return {tree: [path], conflicts: 'new_leaf'};
  }

  tree.forEach(function (branch) {
    if (branch.pos === path.pos && branch.ids[0] === path.ids[0]) {
      // Paths start at the same position and have the same root, so they need
      // merged
      res = mergeTree(branch.ids, path.ids);
      restree.push({pos: branch.pos, ids: res.tree});
      conflicts = conflicts || res.conflicts;
      merged = true;
    } else if (dontExpand !== true) {
      // The paths start at a different position, take the earliest path and
      // traverse up until it as at the same point from root as the path we
      // want to merge.  If the keys match we return the longer path with the
      // other merged After stemming we dont want to expand the trees

      var t1 = branch.pos < path.pos ? branch : path;
      var t2 = branch.pos < path.pos ? path : branch;
      var diff = t2.pos - t1.pos;

      var candidateParents = [];

      var trees = [];
      trees.push({ids: t1.ids, diff: diff, parent: null, parentIdx: null});
      while (trees.length > 0) {
        var item = trees.pop();
        if (item.diff === 0) {
          if (item.ids[0] === t2.ids[0]) {
            candidateParents.push(item);
          }
          continue;
        }
        if (!item.ids) {
          continue;
        }
        /*jshint loopfunc:true */
        item.ids[2].forEach(function (el, idx) {
          trees.push(
            {ids: el, diff: item.diff - 1, parent: item.ids, parentIdx: idx});
        });
      }

      var el = candidateParents[0];

      if (!el) {
        restree.push(branch);
      } else {
        res = mergeTree(el.ids, t2.ids);
        el.parent[2][el.parentIdx] = res.tree;
        restree.push({pos: t1.pos, ids: t1.ids});
        conflicts = conflicts || res.conflicts;
        merged = true;
      }
    } else {
      restree.push(branch);
    }
  });

  // We didnt find
  if (!merged) {
    restree.push(path);
  }

  restree.sort(function (a, b) {
    return a.pos - b.pos;
  });

  return {
    tree: restree,
    conflicts: conflicts || 'internal_node'
  };
}

// To ensure we dont grow the revision tree infinitely, we stem old revisions
function stem(tree, depth) {
  // First we break out the tree into a complete list of root to leaf paths,
  // we cut off the start of the path and generate a new set of flat trees
  var stemmedPaths = PouchMerge.rootToLeaf(tree).map(function (path) {
    var stemmed = path.ids.slice(-depth);
    return {
      pos: path.pos + (path.ids.length - stemmed.length),
      ids: pathToTree(stemmed)
    };
  });
  // Then we remerge all those flat trees together, ensuring that we dont
  // connect trees that would go beyond the depth limit
  return stemmedPaths.reduce(function (prev, current, i, arr) {
    return doMerge(prev, current, true).tree;
  }, [stemmedPaths.shift()]);
}

var PouchMerge = {};

PouchMerge.merge = function (tree, path, depth) {
  // Ugh, nicer way to not modify arguments in place?
  tree = utils.extend(true, [], tree);
  path = utils.clone(path);
  var newTree = doMerge(tree, path);
  return {
    tree: stem(newTree.tree, depth),
    conflicts: newTree.conflicts
  };
};

// We fetch all leafs of the revision tree, and sort them based on tree length
// and whether they were deleted, undeleted documents with the longest revision
// tree (most edits) win
// The final sort algorithm is slightly documented in a sidebar here:
// http://guide.couchdb.org/draft/conflicts.html
PouchMerge.winningRev = function (metadata) {
  var leafs = [];
  PouchMerge.traverseRevTree(metadata.rev_tree,
                              function (isLeaf, pos, id, something, opts) {
    if (isLeaf) {
      leafs.push({pos: pos, id: id, deleted: !!opts.deleted});
    }
  });
  leafs.sort(function (a, b) {
    if (a.deleted !== b.deleted) {
      return a.deleted > b.deleted ? 1 : -1;
    }
    if (a.pos !== b.pos) {
      return b.pos - a.pos;
    }
    return a.id < b.id ? 1 : -1;
  });

  return leafs[0].pos + '-' + leafs[0].id;
};

// Pretty much all below can be combined into a higher order function to
// traverse revisions
// The return value from the callback will be passed as context to all
// children of that node
PouchMerge.traverseRevTree = function (revs, callback) {
  var toVisit = revs.slice();

  var node;
  while ((node = toVisit.pop())) {
    var pos = node.pos;
    var tree = node.ids;
    var branches = tree[2];
    var newCtx =
      callback(branches.length === 0, pos, tree[0], node.ctx, tree[1]);
    for (var i = 0, len = branches.length; i < len; i++) {
      toVisit.push({pos: pos + 1, ids: branches[i], ctx: newCtx});
    }
  }
};

PouchMerge.collectLeaves = function (revs) {
  var leaves = [];
  PouchMerge.traverseRevTree(revs, function (isLeaf, pos, id, acc, opts) {
    if (isLeaf) {
      leaves.unshift({rev: pos + "-" + id, pos: pos, opts: opts});
    }
  });
  leaves.sort(function (a, b) {
    return b.pos - a.pos;
  });
  leaves.map(function (leaf) { delete leaf.pos; });
  return leaves;
};

// returns revs of all conflicts that is leaves such that
// 1. are not deleted and
// 2. are different than winning revision
PouchMerge.collectConflicts = function (metadata) {
  var win = PouchMerge.winningRev(metadata);
  var leaves = PouchMerge.collectLeaves(metadata.rev_tree);
  var conflicts = [];
  leaves.forEach(function (leaf) {
    if (leaf.rev !== win && !leaf.opts.deleted) {
      conflicts.push(leaf.rev);
    }
  });
  return conflicts;
};

PouchMerge.rootToLeaf = function (tree) {
  var paths = [];
  PouchMerge.traverseRevTree(tree, function (isLeaf, pos, id, history, opts) {
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


module.exports = PouchMerge;

},{"./utils":21}],17:[function(_dereq_,module,exports){
'use strict';

var utils = _dereq_('./utils');
var Pouch = _dereq_('./index');
var EE = _dereq_('events').EventEmitter;

// We create a basic promise so the caller can cancel the replication possibly
// before we have actually started listening to changes etc
utils.inherits(Replication, EE);
function Replication(opts) {
  EE.call(this);
  this.cancelled = false;
  var self = this;
  var promise = new utils.Promise(function (fulfill, reject) {
    self.once('complete', fulfill);
    self.once('error', reject);
  });
  self.then = function (resolve, reject) {
    return promise.then(resolve, reject);
  };
  self["catch"] = function (reject) {
    return promise["catch"](reject);
  };
}

Replication.prototype.cancel = function () {
  this.cancelled = true;
  this.emit('cancel');
};

Replication.prototype.ready = function (src, target) {
  var self = this;
  function onDestroy() {
    self.cancel();
  }
  src.once('destroyed', onDestroy);
  target.once('destroyed', onDestroy);
  function cleanup() {
    self.removeAllListeners();
    src.removeListener('destroyed', onDestroy);
    target.removeListener('destroyed', onDestroy);
  }
  this.then(cleanup, cleanup);
};


// TODO: check CouchDB's replication id generation
// Generate a unique id particular to this replication
function genReplicationId(src, target, opts) {
  var filterFun = opts.filter ? opts.filter.toString() : '';
  return src.id().then(function (src_id) {
    return target.id().then(function (target_id) {
      var queryData = src_id + target_id + filterFun +
        JSON.stringify(opts.query_params) + opts.doc_ids;
      return '_local/' + utils.MD5(queryData);
    });
  });
}


function updateCheckpoint(db, id, checkpoint) {
    return db.get(id)["catch"](function (err) {
      if (err.status === 404) {
        return {_id: id};
      }
      throw err;
    }).then(function (doc) {
      doc.last_seq = checkpoint;
      return db.put(doc);
    });
  }

function Checkpointer(src, target, id) {
  this.src = src;
  this.target = target;
  this.id = id;
}

Checkpointer.prototype.writeCheckpoint = function (checkpoint) {
  var self = this;
  return this.updateTarget(checkpoint).then(function () {
    return self.updateSource(checkpoint);
  });
};
Checkpointer.prototype.updateTarget = function (checkpoint) {
  return updateCheckpoint(this.target, this.id, checkpoint);
};
Checkpointer.prototype.updateSource = function (checkpoint) {
  var self = this;
  if (this.readOnlySource) {
    return utils.Promise.resolve(true);
  }
  return updateCheckpoint(this.src, this.id, checkpoint)["catch"](function (err) {
    if (err.status === 401) {
      self.readOnlySource = true;
      return true;
    }
    throw err;
  });
};
Checkpointer.prototype.getCheckpoint = function () {
  var self = this;
  return self.target.get(self.id).then(function (targetDoc) {
    return self.src.get(self.id).then(function (sourceDoc) {
      if (targetDoc.last_seq === sourceDoc.last_seq) {
        return sourceDoc.last_seq;
      }
      return 0;
    }, function (err) {
      if (err.status === 404 && targetDoc.last_seq) {
        return self.src.put({
          _id: self.id,
          last_seq: 0
        }).then(function () {
          return 0;
        }, function (err) {
          if (err.status === 401) {
            self.readOnlySource = true;
            return targetDoc.last_seq;
          }
          return 0;
        });
      }
      throw err;
    });
  })["catch"](function (err) {
    if (err.status !== 404) {
      throw err;
    }
    return 0;
  });
};
function replicate(repId, src, target, opts, returnValue) {
  var batches = [];               // list of batches to be processed
  var currentBatch;               // the batch currently being processed
  var pendingBatch = {
    seq: 0,
    changes: [],
    docs: []
  }; // next batch, not yet ready to be processed
  var writingCheckpoint = false;  // true while checkpoint is being written
  var changesCompleted = false;   // true when all changes received
  var replicationCompleted = false; // true when replication has completed
  var last_seq = 0;
  var continuous = opts.continuous || opts.live || false;
  var batch_size = opts.batch_size || 100;
  var batches_limit = opts.batches_limit || 10;
  var changesPending = false;     // true while src.changes is running
  var changesCount = 0; // number of changes received since calling src.changes
  var doc_ids = opts.doc_ids;
  var checkpointer = new Checkpointer(src, target, repId);
  var result = {
    ok: true,
    start_time: new Date(),
    docs_read: 0,
    docs_written: 0,
    doc_write_failures: 0,
    errors: []
  };
  var changesOpts = {};
  returnValue.ready(src, target);


  function writeDocs() {
    if (currentBatch.docs.length === 0) {
      return;
    }
    var docs = currentBatch.docs;
    return target.bulkDocs({
      docs: docs
    }, {
      new_edits: false
    }).then(function (res) {
      if (returnValue.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }
      var errors = [];
      res.forEach(function (res) {
        if (!res.ok) {
          result.doc_write_failures++;
          errors.push(new Error(res.reason || res.message || 'Unknown reason'));
        }
      });
      if (errors.length > 0) {
        var error = new Error('bulkDocs error');
        error.other_errors = errors;
        abortReplication('target.bulkDocs failed to write docs', error);
        throw new Error('bulkWrite partial failure');
      }
    }, function (err) {
      result.doc_write_failures += docs.length;
      throw err;
    });
  }


  function getNextDoc() {
    var diffs = currentBatch.diffs;
    var id = Object.keys(diffs)[0];
    var revs = diffs[id].missing;
    return src.get(id, {revs: true, open_revs: revs, attachments: true})
    .then(function (docs) {
      docs.forEach(function (doc) {
        if (returnValue.cancelled) {
          return completeReplication();
        }
        if (doc.ok) {
          result.docs_read++;
          currentBatch.pendingRevs++;
          currentBatch.docs.push(doc.ok);
          delete diffs[doc.ok._id];
        }
      });
    });
  }


  function getAllDocs() {
    if (Object.keys(currentBatch.diffs).length > 0) {
      return getNextDoc().then(getAllDocs);
    } else {
      return utils.Promise.resolve();
    }
  }


  function getRevisionOneDocs() {
    // filter out the generation 1 docs and get them
    // leaving the non-generation one docs to be got otherwise
    var ids = Object.keys(currentBatch.diffs).filter(function (id) {
      var missing = currentBatch.diffs[id].missing;
      return missing.length === 1 && missing[0].slice(0, 2) === '1-';
    });
    return src.allDocs({
      keys: ids,
      include_docs: true
    }).then(function (res) {
      if (returnValue.cancelled) {
        completeReplication();
        throw (new Error('cancelled'));
      }
      res.rows.forEach(function (row, i) {
        if (row.doc && !row.deleted &&
          row.value.rev.slice(0, 2) === '1-' && (
            !row.doc._attachments ||
            Object.keys(row.doc._attachments).length === 0
          )
        ) {
          result.docs_read++;
          currentBatch.pendingRevs++;
          currentBatch.docs.push(row.doc);
          delete currentBatch.diffs[row.id];
        }
      });
    });
  }


  function getDocs() {
    if (src.type() === 'http') {
      return getRevisionOneDocs().then(getAllDocs);
    } else {
      return getAllDocs();
    }
  }


  function finishBatch() {
    writingCheckpoint = true;
    return checkpointer.writeCheckpoint(
      currentBatch.seq
    ).then(function (res) {
      writingCheckpoint = false;
      if (returnValue.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }
      result.last_seq = last_seq = currentBatch.seq;
      result.docs_written += currentBatch.docs.length;
      returnValue.emit('change', utils.clone(result));
      currentBatch = undefined;
      getChanges();
    })["catch"](function (err) {
      writingCheckpoint = false;
      abortReplication('writeCheckpoint completed with error', err);
      throw err;
    });
  }


  function getDiffs() {
    var diff = {};
    currentBatch.changes.forEach(function (change) {
      diff[change.id] = change.changes.map(function (x) {
        return x.rev;
      });
    });
    return target.revsDiff(diff).then(function (diffs) {
      if (returnValue.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }
      // currentBatch.diffs elements are deleted as the documents are written
      currentBatch.diffs = diffs;
      currentBatch.pendingRevs = 0;
    });
  }


  function startNextBatch() {
    if (returnValue.cancelled || currentBatch) {
      return;
    }
    if (batches.length === 0) {
      processPendingBatch(true);
      return;
    }
    currentBatch = batches.shift();
    getDiffs()
    .then(getDocs)
    .then(writeDocs)
    .then(finishBatch)
    .then(startNextBatch)[
    "catch"](function (err) {
      abortReplication('batch processing terminated with error', err);
    });
  }


  function processPendingBatch(immediate) {
    if (pendingBatch.changes.length === 0) {
      if (batches.length === 0 && !currentBatch) {
        if ((continuous && changesOpts.live) || changesCompleted) {
          returnValue.emit('uptodate', utils.clone(result));
        }
        if (changesCompleted) {
          completeReplication();
        }
      }
      return;
    }
    if (
      immediate ||
      changesCompleted ||
      pendingBatch.changes.length >= batch_size
    ) {
      batches.push(pendingBatch);
      pendingBatch = {
        seq: 0,
        changes: [],
        docs: []
      };
      startNextBatch();
    }
  }


  function abortReplication(reason, err) {
    if (replicationCompleted) {
      return;
    }
    result.ok = false;
    result.status = 'aborted';
    err.message = reason;
    result.errors.push(err);
    batches = [];
    pendingBatch = {
      seq: 0,
      changes: [],
      docs: []
    };
    completeReplication();
  }


  function completeReplication() {
    if (replicationCompleted) {
      return;
    }
    if (returnValue.cancelled) {
      result.status = 'cancelled';
      if (writingCheckpoint) {
        return;
      }
    }
    result.status = result.status || 'complete';
    result.end_time = new Date();
    result.last_seq = last_seq;
    replicationCompleted = returnValue.cancelled = true;
    if (result.errors.length > 0) {
      var error = result.errors.pop();
      if (result.errors.length > 0) {
        error.other_errors = result.errors;
      }
      error.result = result;
      returnValue.emit('error', error);
    } else {
      returnValue.emit('complete', result);
    }
  }


  function onChange(change) {
    if (returnValue.cancelled) {
      return completeReplication();
    }
    changesCount++;
    if (
      pendingBatch.changes.length === 0 &&
      batches.length === 0 &&
      !currentBatch
    ) {
      returnValue.emit('outofdate', utils.clone(result));
    }
    pendingBatch.seq = change.seq;
    pendingBatch.changes.push(change);
    processPendingBatch(batches.length === 0);
  }


  function onChangesComplete(changes) {
    changesPending = false;
    if (returnValue.cancelled) {
      return completeReplication();
    }
    if (changesCount > 0) {
      changesOpts.since = changes.last_seq;
      getChanges();
    } else {
      if (continuous) {
        changesOpts.live = true;
        getChanges();
      } else {
        changesCompleted = true;
      }
    }
    processPendingBatch(true);
  }


  function onChangesError(err) {
    changesPending = false;
    if (returnValue.cancelled) {
      return completeReplication();
    }
    abortReplication('changes rejected', err);
  }


  function getChanges() {
    if (
      !changesPending &&
      !changesCompleted &&
      batches.length < batches_limit
    ) {
      changesPending = true;
      changesCount = 0;
      src.changes(changesOpts)
      .on('change', onChange)
      .then(onChangesComplete)[
      "catch"](onChangesError);
    }
  }


  function startChanges() {
    checkpointer.getCheckpoint().then(function (checkpoint) {
      last_seq = checkpoint;
      changesOpts = {
        since: last_seq,
        limit: batch_size,
        style: 'all_docs',
        doc_ids: doc_ids,
        returnDocs: false
      };
      if (opts.filter) {
        changesOpts.filter = opts.filter;
      }
      if (opts.query_params) {
        changesOpts.query_params = opts.query_params;
      }
      getChanges();
    })["catch"](function (err) {
      abortReplication('getCheckpoint rejected with ', err);
    });
  }


  returnValue.once('cancel', completeReplication);

  if (typeof opts.onChange === 'function') {
    returnValue.on('change', opts.onChange);
  }

  if (typeof opts.complete === 'function') {
    returnValue.once('error', opts.complete);
    returnValue.once('complete', function (result) {
      opts.complete(null, result);
    });
  }

  if (typeof opts.since === 'undefined') {
    startChanges();
  } else {
    writingCheckpoint = true;
    checkpointer.writeCheckpoint(opts.since).then(function (res) {
      writingCheckpoint = false;
      if (returnValue.cancelled) {
        completeReplication();
        return;
      }
      last_seq = opts.since;
      startChanges();
    })["catch"](function (err) {
      writingCheckpoint = false;
      abortReplication('writeCheckpoint completed with error', err);
      throw err;
    });
  }
}


function toPouch(db) {
  if (typeof db === 'string') {
    return new Pouch(db);
  } else if (db.then) {
    return db;
  } else {
    return utils.Promise.resolve(db);
  }
}


function replicateWrapper(src, target, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }
  if (!opts.complete) {
    opts.complete = callback || function () {};
  }
  opts = utils.clone(opts);
  opts.continuous = opts.continuous || opts.live;
  var replicateRet = new Replication(opts);
  toPouch(src).then(function (src) {
    return toPouch(target).then(function (target) {
      if (opts.server) {
        if (typeof src.replicateOnServer !== 'function') {
          throw new TypeError(
            'Server replication not supported for ' + src.type() + ' adapter'
          );
        }
        if (src.type() !== target.type()) {
          throw new TypeError('Server replication' +
              ' for different adapter types (' +
            src.type() + ' and ' + target.type() + ') is not supported'
          );
        }
        src.replicateOnServer(target, opts, replicateRet);
      } else {
        return genReplicationId(src, target, opts).then(function (repId) {
          replicate(repId, src, target, opts, replicateRet);
        });
      }
    });
  })["catch"](function (err) {
    opts.complete(err);
  });
  return replicateRet;
}

exports.replicate = replicateWrapper;

},{"./index":15,"./utils":21,"events":24}],18:[function(_dereq_,module,exports){
(function (global){
"use strict";

var PouchDBVersion220 = _dereq_("./constructor");
var utils = _dereq_('./utils');
var Promise = utils.Promise;
var EventEmitter = _dereq_('events').EventEmitter;
PouchDBVersion220.adapters = {};

PouchDBVersion220.prefix = '_pouch_';

var eventEmitter = new EventEmitter();

var eventEmitterMethods = [
  'on',
  'addListener',
  'emit',
  'listeners',
  'once',
  'removeAllListeners',
  'removeListener',
  'setMaxListeners'
];

var preferredAdapters = ['levelalt', 'idb', 'leveldb', 'websql'];

eventEmitterMethods.forEach(function (method) {
  PouchDBVersion220[method] = eventEmitter[method].bind(eventEmitter);
});
PouchDBVersion220.setMaxListeners(0);
PouchDBVersion220.parseAdapter = function (name, opts) {
  var match = name.match(/([a-z\-]*):\/\/(.*)/);
  var adapter, adapterName;
  if (match) {
    // the http adapter expects the fully qualified name
    name = /http(s?)/.test(match[1]) ? match[1] + '://' + match[2] : match[2];
    adapter = match[1];
    if (!PouchDBVersion220.adapters[adapter].valid()) {
      throw 'Invalid adapter';
    }
    return {name: name, adapter: match[1]};
  }

  // check for browsers that have been upgraded from websql-only to websql+idb
  var skipIdb = 'idb' in PouchDBVersion220.adapters && 'websql' in PouchDBVersion220.adapters &&
    utils.hasLocalStorage() &&
    global.localStorage['_pouch__websqldb_' + PouchDBVersion220.prefix + name];

  if (typeof opts !== 'undefined' && opts.db) {
    adapterName = 'leveldb';
  } else {
    for (var i = 0; i < preferredAdapters.length; ++i) {
      adapterName = preferredAdapters[i];
      if (adapterName in PouchDBVersion220.adapters) {
        if (skipIdb && adapterName === 'idb') {
          continue; // keep using websql to avoid user data loss
        }
        break;
      }
    }
  }

  if (adapterName) {
    adapter = PouchDBVersion220.adapters[adapterName];
    var use_prefix = 'use_prefix' in adapter ? adapter.use_prefix : true;

    return {
      name: use_prefix ? PouchDBVersion220.prefix + name : name,
      adapter: adapterName
    };
  }

  throw 'No valid adapter found';
};

PouchDBVersion220.destroy = utils.toPromise(function (name, opts, callback) {
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (typeof name === 'object') {
    opts = name;
    name = undefined;
  }

  var backend = PouchDBVersion220.parseAdapter(opts.name || name, opts);
  var dbName = backend.name;

  var adapter = PouchDBVersion220.adapters[backend.adapter];

  function destroyDb() {
    // call destroy method of the particular adaptor
    adapter.destroy(dbName, opts, function (err, resp) {
      if (err) {
        callback(err);
      } else {
        PouchDBVersion220.emit('destroyed', dbName);
        //so we don't have to sift through all dbnames
        PouchDBVersion220.emit(dbName, 'destroyed');
        callback(null, resp || { 'ok': true });
      }
    });
  }

  var usePrefix = 'use_prefix' in adapter ? adapter.use_prefix : true;

  var trueDbName = usePrefix ?
    dbName.replace(new RegExp('^' + PouchDBVersion220.prefix), '') : dbName;
  new PouchDBVersion220(trueDbName, {adapter : backend.adapter}, function (err, db) {
    if (err) {
      return callback(err);
    }
    db.get('_local/_pouch_dependentDbs', function (err, localDoc) {
      if (err) {
        if (err.name !== 'not_found') {
          return callback(err);
        } else { // no dependencies
          return destroyDb();
        }
      }
      var dependentDbs = localDoc.dependentDbs;
      var deletedMap = Object.keys(dependentDbs).map(function (name) {
        var trueName = usePrefix ?
          name.replace(new RegExp('^' + PouchDBVersion220.prefix), '') : name;
        return PouchDBVersion220.destroy(trueName, {adapter: backend.adapter});
      });
      Promise.all(deletedMap).then(destroyDb, function (error) {
        callback(error);
      });
    });
  });
});

PouchDBVersion220.allDbs = utils.toPromise(function (callback) {
  var err = new Error('allDbs method removed');
  err.stats = '400';
  callback(err);
});
PouchDBVersion220.adapter = function (id, obj) {
  if (obj.valid()) {
    PouchDBVersion220.adapters[id] = obj;
  }
};

PouchDBVersion220.plugin = function (obj) {
  Object.keys(obj).forEach(function (id) {
    PouchDBVersion220.prototype[id] = obj[id];
  });
};

module.exports = PouchDBVersion220;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./constructor":7,"./utils":21,"events":24}],19:[function(_dereq_,module,exports){
'use strict';
var utils = _dereq_('./utils');
var replicate = _dereq_('./replicate').replicate;
var EE = _dereq_('events').EventEmitter;

module.exports = Sync;
utils.inherits(Sync, EE);
function Sync(src, target, opts, callback) {
  if (!(this instanceof Sync)) {
    return new Sync(src, target, opts, callback);
  }
  var self = this;
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }
  this.canceled = false;
  opts = utils.clone(opts);
  var onChange, complete;
  if ('onChange' in opts) {
    onChange = opts.onChange;
    delete opts.onChange;
  }
  if (typeof callback === 'function' && !opts.complete) {
    complete = callback;
  } else if ('complete' in opts) {
    complete = opts.complete;
    delete opts.complete;
  }
  this.push = replicate(src, target, opts);

  this.pull = replicate(target, src, opts);
  var emittedCancel = false;
  function onCancel(data) {
    if (!emittedCancel) {
      emittedCancel = true;
      self.emit('cancel', data);
    }
  }

  function pullChange(change) {
    self.emit('change', {
      direction: 'pull',
      change: change
    });
  }
  function pushChange(change) {
    self.emit('change', {
      direction: 'push',
      change: change
    });
  }
  var listeners = {};

  function removal(event, func) {
    if (event === 'change' &&
      (func === pullChange ||
      func === pushChange)) {
      self.removeAllListeners('change');
    } else if (event === 'cancel' &&
      func === onCancel) {
      self.removeAllListeners('cancel');
    } else if (event in listeners && func === listeners[event]) {
      self.removeAllListeners(event);
    }
  }

  this.on('newListener', function (event) {
    if (event === 'change') {
      self.pull.on('change', pullChange);
      self.push.on('change', pushChange);
    } else if (event === 'cancel') {
      self.pull.on('cancel', onCancel);
      self.push.on('cancel', onCancel);
    } else if (event !== 'error' &&
      event !== 'complete' && !(event in listeners)) {
      listeners[event] = function (e) {
        self.emit(event, e);
      };
      self.pull.on(event, listeners[event]);
      self.push.on(event, listeners[event]);
    }
  });

  this.on('removeListener', function (event) {
    if (event === 'change') {
      self.pull.removeListener('change', pullChange);
      self.push.removeListener('change', pushChange);
    } else if (event === 'cancel') {
      self.pull.removeListener('cancel', onCancel);
      self.push.removeListener('cancel', onCancel);
    } else if (event in listeners) {
      if (typeof listeners[event] === 'function') {
        self.pull.removeListener(event, listeners[event]);
        self.push.removeListener(event, listeners[event]);
        delete listeners[event];
      }
    }
  });

  this.pull.on('removeListener', removal);
  this.push.on('removeListener', removal);

  var promise = utils.Promise.all([
    this.push,
    this.pull
  ]).then(function (resp) {
    var out = {
      push: resp[0],
      pull: resp[1]
    };
    self.emit('complete', out);
    if (complete) {
      complete(null, out);
    }
    self.removeAllListeners();
    return out;
  }, function (err) {
    self.cancel();
    self.emit('error', err);
    if (complete) {
      complete(err);
    }
    self.removeAllListeners();
    throw err;
  });

  this.then = function (success, err) {
    return promise.then(success, err);
  };

  this["catch"] = function (err) {
    return promise["catch"](err);
  };
}

Sync.prototype.cancel = function () {
  if (!this.canceled) {
    this.canceled = true;
    this.push.cancel();
    this.pull.cancel();
  }
};
},{"./replicate":17,"./utils":21,"events":24}],20:[function(_dereq_,module,exports){
'use strict';

module.exports = TaskQueue;

function TaskQueue() {
  this.isReady = false;
  this.failed = false;
  this.queue = [];
}

TaskQueue.prototype.execute = function () {
  var d, func;
  if (this.failed) {
    while ((d = this.queue.shift())) {
      if (typeof d === 'function') {
        d(this.failed);
        continue;
      }
      func = d.parameters[d.parameters.length - 1];
      if (typeof func === 'function') {
        func(this.failed);
      } else if (d.name === 'changes' && typeof func.complete === 'function') {
        func.complete(this.failed);
      }
    }
  } else if (this.isReady) {
    while ((d = this.queue.shift())) {

      if (typeof d === 'function') {
        d();
      } else {
        d.task = this.db[d.name].apply(this.db, d.parameters);
      }
    }
  }
};

TaskQueue.prototype.fail = function (err) {
  this.failed = err;
  this.execute();
};

TaskQueue.prototype.ready = function (db) {
  if (this.failed) {
    return false;
  } else if (arguments.length === 0) {
    return this.isReady;
  }
  this.isReady = db ? true: false;
  this.db = db;
  this.execute();
};

TaskQueue.prototype.addTask = function (name, parameters) {
  if (typeof name === 'function') {
    this.queue.push(name);
    if (this.failed) {
      this.execute();
    }
  } else {
    var task = { name: name, parameters: parameters };
    this.queue.push(task);
    if (this.failed) {
      this.execute();
    }
    return task;
  }
};

},{}],21:[function(_dereq_,module,exports){
(function (process,global){
/*jshint strict: false */
/*global chrome */
var crypto = _dereq_('crypto');
var md5 = _dereq_('md5-jkmyers');
var merge = _dereq_('./merge');
exports.extend = _dereq_('extend');
exports.ajax = _dereq_('./deps/ajax');
exports.createBlob = _dereq_('./deps/blob');
exports.uuid = _dereq_('./deps/uuid');
exports.getArguments = _dereq_('argsarray');
var buffer = _dereq_('./deps/buffer');
var errors = _dereq_('./deps/errors');
var EventEmitter = _dereq_('events').EventEmitter;

if (typeof global.Promise === 'function') {
  exports.Promise = global.Promise;
} else {
  exports.Promise = _dereq_('bluebird');
}
var Promise = exports.Promise;

function toObject(array) {
  var obj = {};
  array.forEach(function (item) { obj[item] = true; });
  return obj;
}
// List of top level reserved words for doc
var reservedWords = toObject([
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
]);
exports.clone = function (obj) {
  return exports.extend(true, {}, obj);
};
exports.inherits = _dereq_('inherits');
// Determine id an ID is valid
//   - invalid IDs begin with an underescore that does not begin '_design' or 
//     '_local'
//   - any other string value is a valid id
// Returns the specific error object for each case
exports.invalidIdError = function (id) {
  if (!id) {
    return errors.MISSING_ID;
  } else if (typeof id !== 'string') {
    return errors.INVALID_ID;
  } else if (/^_/.test(id) && !(/^_(design|local)/).test(id)) {
    return errors.RESERVED_ID;
  }
};

function isChromeApp() {
  return (typeof chrome !== "undefined" &&
          typeof chrome.storage !== "undefined" &&
          typeof chrome.storage.local !== "undefined");
}

// Pretty dumb name for a function, just wraps callback calls so we dont
// to if (callback) callback() everywhere
exports.call = exports.getArguments(function (args) {
  if (!args.length) {
    return;
  }
  var fun = args.shift();
  if (typeof fun === 'function') {
    fun.apply(this, args);
  }
});

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
  var dashIndex = rev.indexOf('-');
  if (dashIndex !== -1) {
    rev = rev.substring(dashIndex + 1);
  }
  var deleted = false;
  merge.traverseRevTree(metadata.rev_tree,
  function (isLeaf, pos, id, acc, opts) {
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
        if (change.doc._attachments.hasOwnProperty(att)) {
          change.doc._attachments[att].stub = true;
        }
      }
    }
    return true;
  };
};

// Preprocess documents, parse their revisions, assign an id and a
// revision for new writes that are missing them, etc
exports.parseDoc = function (doc, newEdits) {
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
    newRevId = exports.uuid(32, 16).toLowerCase();
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

  var error = exports.invalidIdError(doc._id);
  if (error) {
    return error;
  }

  doc._id = decodeURIComponent(doc._id);
  doc._rev = [nRevNum, newRevId].join('-');

  var result = {metadata : {}, data : {}};
  for (var key in doc) {
    if (doc.hasOwnProperty(key)) {
      var specialKey = key[0] === '_';
      if (specialKey && !reservedWords[key]) {
        error = errors.error(errors.DOC_VALIDATION);
        error.reason += ': ' + key;
        return error;
      } else if (specialKey && key !== '_attachments') {
        result.metadata[key.slice(1)] = doc[key];
      } else {
        result.data[key] = doc[key];
      }
    }
  }
  return result;
};

exports.isCordova = function () {
  return (typeof cordova !== "undefined" ||
          typeof PhoneGap !== "undefined" ||
          typeof phonegap !== "undefined");
};

exports.hasLocalStorage = function () {
  if (isChromeApp()) {
    return false;
  }
  try {
    return global.localStorage;
  } catch (e) {
    return false;
  }
};
exports.Changes = function () {

  var api = {};
  var eventEmitter = new EventEmitter();
  var isChrome = isChromeApp();
  var listeners = {};
  var hasLocal = false;
  if (!isChrome) {
    hasLocal = exports.hasLocalStorage();
  }
  if (isChrome) {
    chrome.storage.onChanged.addListener(function (e) {
      // make sure it's event addressed to us
      if (e.db_name != null) {
        //object only has oldValue, newValue members
        eventEmitter.emit(e.dbName.newValue);
      }
    });
  } else if (hasLocal) {
    if (global.addEventListener) {
      global.addEventListener("storage", function (e) {
        eventEmitter.emit(e.key);
      });
    } else {
      global.attachEvent("storage", function (e) {
        eventEmitter.emit(e.key);
      });
    }
  }

  api.addListener = function (dbName, id, db, opts) {
    if (listeners[id]) {
      return;
    }
    function eventFunction() {
      db.changes({
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
    }
    listeners[id] = eventFunction;
    eventEmitter.on(dbName, eventFunction);
  };

  api.removeListener = function (dbName, id) {
    if (!(id in listeners)) {
      return;
    }
    eventEmitter.removeListener(dbName, listeners[id]);
  };

  api.clearListeners = function (dbName) {
    eventEmitter.removeAllListeners(dbName);
  };

  api.notifyLocalWindows = function (dbName) {
    //do a useless change on a storage thing
    //in order to get other windows's listeners to activate
    if (isChrome) {
      chrome.storage.local.set({dbName: dbName});
    } else if (hasLocal) {
      localStorage[dbName] = (localStorage[dbName] === "a") ? "b" : "a";
    }
  };

  api.notify = function (dbName) {
    eventEmitter.emit(dbName);
  };

  return api;
};

if (!process.browser || !('atob' in global)) {
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

if (!process.browser || !('btoa' in global)) {
  exports.btoa = function (str) {
    return new buffer(str, 'binary').toString('base64');
  };
} else {
  exports.btoa = function (str) {
    return btoa(str);
  };
}

// From http://stackoverflow.com/questions/14967647/ (continues on next line)
// encode-decode-image-with-base64-breaks-image (2013-04-21)
exports.fixBinary = function (bin) {
  if (!process.browser) {
    // don't need to do this in Node
    return bin;
  }

  var length = bin.length;
  var buf = new ArrayBuffer(length);
  var arr = new Uint8Array(buf);
  for (var i = 0; i < length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return buf;
};

exports.once = function (fun) {
  var called = false;
  return exports.getArguments(function (args) {
    if (called) {
      console.trace();
      throw new Error('once called  more than once');
    } else {
      called = true;
      fun.apply(this, args);
    }
  });
};

exports.toPromise = function (func) {
  //create the function we will be returning
  return exports.getArguments(function (args) {
    var self = this;
    var tempCB =
      (typeof args[args.length - 1] === 'function') ? args.pop() : false;
    // if the last argument is a function, assume its a callback
    var usedCB;
    if (tempCB) {
      // if it was a callback, create a new callback which calls it,
      // but do so async so we don't trap any errors
      usedCB = function (err, resp) {
        process.nextTick(function () {
          tempCB(err, resp);
        });
      };
    }
    var promise = new Promise(function (fulfill, reject) {
      var resp;
      try {
        var callback = exports.once(function (err, mesg) {
          if (err) {
            reject(err);
          } else {
            fulfill(mesg);
          }
        });
        // create a callback for this invocation
        // apply the function in the orig context
        args.push(callback);
        resp = func.apply(self, args);
        if (resp && typeof resp.then === 'function') {
          fulfill(resp);
        }
      } catch (e) {
        reject(e);
      }
    });
    // if there is a callback, call it back
    if (usedCB) {
      promise.then(function (result) {
        usedCB(null, result);
      }, usedCB);
    }
    promise.cancel = function () {
      return this;
    };
    return promise;
  });
};

exports.adapterFun = function (name, callback) {
  return exports.toPromise(exports.getArguments(function (args) {
    var self = this;
    if (!this.taskqueue.isReady) {
      return new exports.Promise(function (fulfill, reject) {
        self.taskqueue.addTask(function (failed) {
          if (failed) {
            reject(failed);
          } else {
            fulfill(self[name].apply(self, args));
          }
        });
      });
    }
    return callback.apply(this, args);
  }));
};
//Can't find original post, but this is close
//http://stackoverflow.com/questions/6965107/ (continues on next line)
//converting-between-strings-and-arraybuffers
exports.arrayBufferToBinaryString = function (buffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var length = bytes.byteLength;
  for (var i = 0; i < length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
};

exports.cancellableFun = function (fun, self, opts) {

  opts = opts ? exports.clone(true, {}, opts) : {};

  var emitter = new EventEmitter();
  var oldComplete = opts.complete || function () { };
  var complete = opts.complete = exports.once(function (err, resp) {
    if (err) {
      oldComplete(err);
    } else {
      emitter.emit('end', resp);
      oldComplete(null, resp);
    }
    emitter.removeAllListeners();
  });
  var oldOnChange = opts.onChange || function () {};
  var lastChange = 0;
  self.on('destroyed', function () {
    emitter.removeAllListeners();
  });
  opts.onChange = function (change) {
    oldOnChange(change);
    if (change.seq <= lastChange) {
      return;
    }
    lastChange = change.seq;
    emitter.emit('change', change);
    if (change.deleted) {
      emitter.emit('delete', change);
    } else if (change.changes.length === 1 &&
      change.changes[0].rev.slice(0, 1) === '1-') {
      emitter.emit('create', change);
    } else {
      emitter.emit('update', change);
    }
  };
  var promise = new Promise(function (fulfill, reject) {
    opts.complete = function (err, res) {
      if (err) {
        reject(err);
      } else {
        fulfill(res);
      }
    };
  });

  promise.then(function (result) {
    complete(null, result);
  }, complete);

  // this needs to be overwridden by caller, dont fire complete until
  // the task is ready
  promise.cancel = function () {
    promise.isCancelled = true;
    if (self.taskqueue.isReady) {
      opts.complete(null, {status: 'cancelled'});
    }
  };

  if (!self.taskqueue.isReady) {
    self.taskqueue.addTask(function () {
      if (promise.isCancelled) {
        opts.complete(null, {status: 'cancelled'});
      } else {
        fun(self, opts, promise);
      }
    });
  } else {
    fun(self, opts, promise);
  }
  promise.on = emitter.on.bind(emitter);
  promise.once = emitter.once.bind(emitter);
  promise.addListener = emitter.addListener.bind(emitter);
  promise.removeListener = emitter.removeListener.bind(emitter);
  promise.removeAllListeners = emitter.removeAllListeners.bind(emitter);
  promise.setMaxListeners = emitter.setMaxListeners.bind(emitter);
  promise.listeners = emitter.listeners.bind(emitter);
  promise.emit = emitter.emit.bind(emitter);
  return promise;
};
exports.Crypto = {};
exports.MD5 = exports.Crypto.MD5 = function (string) {
  if (!process.browser) {
    return crypto.createHash('md5').update(string).digest('hex');
  } else {
    return md5(string);
  }
};

}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./deps/ajax":8,"./deps/blob":9,"./deps/buffer":23,"./deps/errors":10,"./deps/uuid":12,"./merge":16,"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":25,"argsarray":22,"bluebird":31,"crypto":23,"events":24,"extend":26,"inherits":27,"md5-jkmyers":45}],22:[function(_dereq_,module,exports){
'use strict';

module.exports = argsArray;

function argsArray(fun) {
  return function () {
    var len = arguments.length;
    if (len) {
      var args = [];
      var i = -1;
      while (++i < len) {
        args[i] = arguments[i];
      }
      return fun.call(this, args);
    } else {
      return fun.call(this, []);
    }
  };
}
},{}],23:[function(_dereq_,module,exports){

},{}],24:[function(_dereq_,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],25:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],26:[function(_dereq_,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;

function isPlainObject(obj) {
	if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval)
		return false;

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
		return false;

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for ( key in obj ) {}

	return key === undefined || hasOwn.call( obj, key );
};

module.exports = function extend() {
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
	if ( typeof target !== "object" && typeof target !== "function") {
		target = {};
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = Array.isArray(copy)) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];

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

},{}],27:[function(_dereq_,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],28:[function(_dereq_,module,exports){
'use strict';

module.exports = INTERNAL;

function INTERNAL() {}
},{}],29:[function(_dereq_,module,exports){
'use strict';
var INTERNAL = _dereq_('./INTERNAL');
var Promise = _dereq_('./promise');
var reject = _dereq_('./reject');
var resolve = _dereq_('./resolve');

module.exports = function all(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }
  var len = iterable.length;
  if (!len) {
    return resolve([]);
  }
  var values = [];
  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  function allResolver(value, i) {
    resolve(value).then(function (outValue) {
      values[i] = outValue;
      if (++resolved === len) {
        promise.resolve(values);
      }
    }, function (error) {
      promise.reject(error);
    });
  }
  
  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
};
},{"./INTERNAL":28,"./promise":33,"./reject":34,"./resolve":35}],30:[function(_dereq_,module,exports){
'use strict';

module.exports = getThen;

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && typeof obj === 'object' && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}
},{}],31:[function(_dereq_,module,exports){
module.exports = exports = _dereq_('./promise');

exports.resolve = _dereq_('./resolve');
exports.reject = _dereq_('./reject');
exports.all = _dereq_('./all');
},{"./all":29,"./promise":33,"./reject":34,"./resolve":35}],32:[function(_dereq_,module,exports){
'use strict';

module.exports = once;

/* Wrap an arbitrary number of functions and allow only one of them to be
   executed and only once */
function once() {
  var called = 0;
  return function wrapper(wrappedFunction) {
    return function () {
      if (called++) {
        return;
      }
      wrappedFunction.apply(this, arguments);
    };
  };
}
},{}],33:[function(_dereq_,module,exports){
'use strict';

var unwrap = _dereq_('./unwrap');
var INTERNAL = _dereq_('./INTERNAL');
var once = _dereq_('./once');
var tryCatch = _dereq_('./tryCatch');
var getThen = _dereq_('./getThen');

// Lazy man's symbols for states
var PENDING = ['PENDING'],
  FULFILLED = ['FULFILLED'],
  REJECTED = ['REJECTED'];
module.exports = Promise;
function Promise(resolver) {
  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }
  if (typeof resolver !== 'function') {
    throw new TypeError('reslover must be a function');
  }
  this.state = PENDING;
  this.queue = [];
  if (resolver !== INTERNAL) {
    safelyResolveThenable(this, resolver);
  }
}
Promise.prototype.resolve = function (value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return this.reject(result.value);
  }
  var thenable = result.value;

  if (thenable) {
    safelyResolveThenable(this, thenable);
  } else {
    this.state = FULFILLED;
    this.outcome = value;
    var i = -1;
    var len = this.queue.length;
    while (++i < len) {
      this.queue[i].callFulfilled(value);
    }
  }
  return this;
};
Promise.prototype.reject = function (error) {
  this.state = REJECTED;
  this.outcome = error;
  var i = -1;
  var len = this.queue.length;
  while (++i < len) {
    this.queue[i].callRejected(error);
  }
  return this;
};

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  var onFulfilledFunc = typeof onFulfilled === 'function';
  var onRejectedFunc = typeof onRejected === 'function';
  if (!onFulfilledFunc && this.state === FULFILLED || !onRejected && this.state === REJECTED) {
    return this;
  }
  var promise = new Promise(INTERNAL);

  var thenHandler =  {
    promise: promise,
  };
  if (this.state !== REJECTED) {
    if (onFulfilledFunc) {
      thenHandler.callFulfilled = function (value) {
        unwrap(promise, onFulfilled, value);
      };
    } else {
      thenHandler.callFulfilled = function (value) {
        promise.resolve(value);
      };
    }
  }
  if (this.state !== FULFILLED) {
    if (onRejectedFunc) {
      thenHandler.callRejected = function (value) {
        unwrap(promise, onRejected, value);
      };
    } else {
      thenHandler.callRejected = function (value) {
        promise.reject(value);
      };
    }
  }
  if (this.state === FULFILLED) {
    thenHandler.callFulfilled(this.outcome);
  } else if (this.state === REJECTED) {
    thenHandler.callRejected(this.outcome);
  } else {
    this.queue.push(thenHandler);
  }

  return promise;
};
function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var onceWrapper = once();
  var onError = onceWrapper(function (value) {
    return self.reject(value);
  });
  var result = tryCatch(function () {
    thenable(
      onceWrapper(function (value) {
        return self.resolve(value);
      }),
      onError
    );
  });
  if (result.status === 'error') {
    onError(result.value);
  }
}
},{"./INTERNAL":28,"./getThen":30,"./once":32,"./tryCatch":36,"./unwrap":37}],34:[function(_dereq_,module,exports){
'use strict';

var Promise = _dereq_('./promise');
var INTERNAL = _dereq_('./INTERNAL');

module.exports = reject;

function reject(reason) {
	var promise = new Promise(INTERNAL);
	return promise.reject(reason);
}
},{"./INTERNAL":28,"./promise":33}],35:[function(_dereq_,module,exports){
'use strict';

var Promise = _dereq_('./promise');
var INTERNAL = _dereq_('./INTERNAL');

module.exports = resolve;

var FALSE = new Promise(INTERNAL).resolve(false);
var NULL = new Promise(INTERNAL).resolve(null);
var UNDEFINED = new Promise(INTERNAL).resolve(void 0);
var ZERO = new Promise(INTERNAL).resolve(0);
var EMPTYSTRING = new Promise(INTERNAL).resolve('');

function resolve(value) {
  if (value) {
    return new Promise(INTERNAL).resolve(value);
  }
  var valueType = typeof value;
  switch (valueType) {
    case 'boolean':
      return FALSE;
    case 'undefined':
      return UNDEFINED;
    case 'object':
      return NULL;
    case 'number':
      return ZERO;
    case 'string':
      return EMPTYSTRING;
  }
}
},{"./INTERNAL":28,"./promise":33}],36:[function(_dereq_,module,exports){
'use strict';

module.exports = tryCatch;

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}
},{}],37:[function(_dereq_,module,exports){
'use strict';

var immediate = _dereq_('immediate');

module.exports = unwrap;

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return promise.reject(e);
    }
    if (returnValue === promise) {
      promise.reject(new TypeError('Cannot resolve promise with itself'));
    } else {
      promise.resolve(returnValue);
    }
  });
}
},{"immediate":39}],38:[function(_dereq_,module,exports){
'use strict';
exports.test = function () {
  return false;
};
},{}],39:[function(_dereq_,module,exports){
'use strict';
var types = [
  _dereq_('./nextTick'),
  _dereq_('./mutation'),
  _dereq_('./postMessage'),
  _dereq_('./messageChannel'),
  _dereq_('./stateChange'),
  _dereq_('./timeout')
];
var handlerQueue = [];
function drainQueue() {
  var i = 0,
  task,
  innerQueue = handlerQueue;
  handlerQueue = [];
  while ((task = innerQueue[i++])) {
    task();
  }
}
var nextTick;
var i = -1;
var len = types.length;
while (++ i < len) {
  if (types[i].test()) {
    nextTick = types[i].install(drainQueue);
    break;
  }
}
module.exports = function (task) {
  var len, i, args;
  var nTask = task;
  if (arguments.length > 1 && typeof task === 'function') {
    args = new Array(arguments.length - 1);
    i = 0;
    while (++i < arguments.length) {
      args[i - 1] = arguments[i];
    }
    nTask = function () {
      task.apply(undefined, args);
    };
  }
  if ((len = handlerQueue.push(nTask)) === 1) {
    nextTick(drainQueue);
  }
  return len;
};
module.exports.clear = function (n) {
  if (n <= handlerQueue.length) {
    handlerQueue[n - 1] = function () {};
  }
  return this;
};

},{"./messageChannel":40,"./mutation":41,"./nextTick":38,"./postMessage":42,"./stateChange":43,"./timeout":44}],40:[function(_dereq_,module,exports){
(function (global){
'use strict';

exports.test = function () {
  return typeof global.MessageChannel !== 'undefined';
};

exports.install = function (func) {
  var channel = new global.MessageChannel();
  channel.port1.onmessage = func;
  return function () {
    channel.port2.postMessage(0);
  };
};
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],41:[function(_dereq_,module,exports){
(function (global){
'use strict';
//based off rsvp https://github.com/tildeio/rsvp.js
//license https://github.com/tildeio/rsvp.js/blob/master/LICENSE
//https://github.com/tildeio/rsvp.js/blob/master/lib/rsvp/asap.js

var Mutation = global.MutationObserver || global.WebKitMutationObserver;

exports.test = function () {
  return Mutation;
};

exports.install = function (handle) {
  var called = 0;
  var observer = new Mutation(handle);
  var element = global.document.createTextNode('');
  observer.observe(element, {
    characterData: true
  });
  return function () {
    element.data = (called = ++called % 2);
  };
};
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],42:[function(_dereq_,module,exports){
(function (global){
'use strict';
// The test against `importScripts` prevents this implementation from being installed inside a web worker,
// where `global.postMessage` means something completely different and can't be used for this purpose.

exports.test = function () {
  if (!global.postMessage || global.importScripts) {
    return false;
  }

  var postMessageIsAsynchronous = true;
  var oldOnMessage = global.onmessage;
  global.onmessage = function () {
    postMessageIsAsynchronous = false;
  };
  global.postMessage('', '*');
  global.onmessage = oldOnMessage;

  return postMessageIsAsynchronous;
};

exports.install = function (func) {
  var codeWord = 'com.calvinmetcalf.setImmediate' + Math.random();
  function globalMessage(event) {
    if (event.source === global && event.data === codeWord) {
      func();
    }
  }
  if (global.addEventListener) {
    global.addEventListener('message', globalMessage, false);
  } else {
    global.attachEvent('onmessage', globalMessage);
  }
  return function () {
    global.postMessage(codeWord, '*');
  };
};
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],43:[function(_dereq_,module,exports){
(function (global){
'use strict';

exports.test = function () {
  return 'document' in global && 'onreadystatechange' in global.document.createElement('script');
};

exports.install = function (handle) {
  return function () {

    // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
    // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
    var scriptEl = global.document.createElement('script');
    scriptEl.onreadystatechange = function () {
      handle();

      scriptEl.onreadystatechange = null;
      scriptEl.parentNode.removeChild(scriptEl);
      scriptEl = null;
    };
    global.document.documentElement.appendChild(scriptEl);

    return handle;
  };
};
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],44:[function(_dereq_,module,exports){
'use strict';
exports.test = function () {
  return true;
};

exports.install = function (t) {
  return function () {
    setTimeout(t, 0);
  };
};
},{}],45:[function(_dereq_,module,exports){
!function(a,b){"function"==typeof define&&define.amd?define(b):"object"==typeof exports?module.exports=b():a.md5=b()}(this,function(){function a(a,b){var g=a[0],h=a[1],i=a[2],j=a[3];g=c(g,h,i,j,b[0],7,-680876936),j=c(j,g,h,i,b[1],12,-389564586),i=c(i,j,g,h,b[2],17,606105819),h=c(h,i,j,g,b[3],22,-1044525330),g=c(g,h,i,j,b[4],7,-176418897),j=c(j,g,h,i,b[5],12,1200080426),i=c(i,j,g,h,b[6],17,-1473231341),h=c(h,i,j,g,b[7],22,-45705983),g=c(g,h,i,j,b[8],7,1770035416),j=c(j,g,h,i,b[9],12,-1958414417),i=c(i,j,g,h,b[10],17,-42063),h=c(h,i,j,g,b[11],22,-1990404162),g=c(g,h,i,j,b[12],7,1804603682),j=c(j,g,h,i,b[13],12,-40341101),i=c(i,j,g,h,b[14],17,-1502002290),h=c(h,i,j,g,b[15],22,1236535329),g=d(g,h,i,j,b[1],5,-165796510),j=d(j,g,h,i,b[6],9,-1069501632),i=d(i,j,g,h,b[11],14,643717713),h=d(h,i,j,g,b[0],20,-373897302),g=d(g,h,i,j,b[5],5,-701558691),j=d(j,g,h,i,b[10],9,38016083),i=d(i,j,g,h,b[15],14,-660478335),h=d(h,i,j,g,b[4],20,-405537848),g=d(g,h,i,j,b[9],5,568446438),j=d(j,g,h,i,b[14],9,-1019803690),i=d(i,j,g,h,b[3],14,-187363961),h=d(h,i,j,g,b[8],20,1163531501),g=d(g,h,i,j,b[13],5,-1444681467),j=d(j,g,h,i,b[2],9,-51403784),i=d(i,j,g,h,b[7],14,1735328473),h=d(h,i,j,g,b[12],20,-1926607734),g=e(g,h,i,j,b[5],4,-378558),j=e(j,g,h,i,b[8],11,-2022574463),i=e(i,j,g,h,b[11],16,1839030562),h=e(h,i,j,g,b[14],23,-35309556),g=e(g,h,i,j,b[1],4,-1530992060),j=e(j,g,h,i,b[4],11,1272893353),i=e(i,j,g,h,b[7],16,-155497632),h=e(h,i,j,g,b[10],23,-1094730640),g=e(g,h,i,j,b[13],4,681279174),j=e(j,g,h,i,b[0],11,-358537222),i=e(i,j,g,h,b[3],16,-722521979),h=e(h,i,j,g,b[6],23,76029189),g=e(g,h,i,j,b[9],4,-640364487),j=e(j,g,h,i,b[12],11,-421815835),i=e(i,j,g,h,b[15],16,530742520),h=e(h,i,j,g,b[2],23,-995338651),g=f(g,h,i,j,b[0],6,-198630844),j=f(j,g,h,i,b[7],10,1126891415),i=f(i,j,g,h,b[14],15,-1416354905),h=f(h,i,j,g,b[5],21,-57434055),g=f(g,h,i,j,b[12],6,1700485571),j=f(j,g,h,i,b[3],10,-1894986606),i=f(i,j,g,h,b[10],15,-1051523),h=f(h,i,j,g,b[1],21,-2054922799),g=f(g,h,i,j,b[8],6,1873313359),j=f(j,g,h,i,b[15],10,-30611744),i=f(i,j,g,h,b[6],15,-1560198380),h=f(h,i,j,g,b[13],21,1309151649),g=f(g,h,i,j,b[4],6,-145523070),j=f(j,g,h,i,b[11],10,-1120210379),i=f(i,j,g,h,b[2],15,718787259),h=f(h,i,j,g,b[9],21,-343485551),a[0]=l(g,a[0]),a[1]=l(h,a[1]),a[2]=l(i,a[2]),a[3]=l(j,a[3])}function b(a,b,c,d,e,f){return b=l(l(b,a),l(d,f)),l(b<<e|b>>>32-e,c)}function c(a,c,d,e,f,g,h){return b(c&d|~c&e,a,c,f,g,h)}function d(a,c,d,e,f,g,h){return b(c&e|d&~e,a,c,f,g,h)}function e(a,c,d,e,f,g,h){return b(c^d^e,a,c,f,g,h)}function f(a,c,d,e,f,g,h){return b(d^(c|~e),a,c,f,g,h)}function g(b){txt="";var c,d=b.length,e=[1732584193,-271733879,-1732584194,271733878];for(c=64;c<=b.length;c+=64)a(e,h(b.substring(c-64,c)));b=b.substring(c-64);var f=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];for(c=0;c<b.length;c++)f[c>>2]|=b.charCodeAt(c)<<(c%4<<3);if(f[c>>2]|=128<<(c%4<<3),c>55)for(a(e,f),c=0;16>c;c++)f[c]=0;return f[14]=8*d,a(e,f),e}function h(a){var b,c=[];for(b=0;64>b;b+=4)c[b>>2]=a.charCodeAt(b)+(a.charCodeAt(b+1)<<8)+(a.charCodeAt(b+2)<<16)+(a.charCodeAt(b+3)<<24);return c}function i(a){for(var b="",c=0;4>c;c++)b+=m[a>>8*c+4&15]+m[a>>8*c&15];return b}function j(a){for(var b=0;b<a.length;b++)a[b]=i(a[b]);return a.join("")}function k(a){return j(g(a))}function l(a,b){return a+b&4294967295}function l(a,b){var c=(65535&a)+(65535&b),d=(a>>16)+(b>>16)+(c>>16);return d<<16|65535&c}var m="0123456789abcdef".split("");return"5d41402abc4b2a76b9719d911017c592"!=k("hello"),k});
},{}],46:[function(_dereq_,module,exports){
'use strict';

var upsert = _dereq_('./upsert');
var utils = _dereq_('./utils');
var Promise = utils.Promise;

module.exports = function (opts) {
  var sourceDB = opts.db;
  var viewName = opts.viewName;
  var mapFun = opts.map;
  var reduceFun = opts.reduce;
  var randomizer = opts.randomizer;

  var viewSignature = mapFun.toString() + (reduceFun && reduceFun.toString()) +
    (randomizer && randomizer.toString());

  if (sourceDB._cachedViews) {
    var cachedView = sourceDB._cachedViews[viewSignature];
    if (cachedView) {
      return Promise.resolve(cachedView);
    }
  }

  return sourceDB.info().then(function (info) {
    var depDbName = info.db_name + '-mrview-' + utils.MD5(viewSignature);

    // save the view name in the source PouchDBVersion220 so it can be cleaned up if necessary
    // (e.g. when the _design doc is deleted, remove all associated view data)
    function diffFunction(doc) {
      doc.views = doc.views || {};
      var depDbs = doc.views[viewName] = doc.views[viewName] || {};
      /* istanbul ignore if */
      if (depDbs[depDbName]) {
        return; // no update necessary
      }
      depDbs[depDbName] = true;
      return doc;
    }
    return upsert(sourceDB, '_local/mrviews', diffFunction).then(function () {
      return sourceDB.registerDependentDatabase(depDbName).then(function (res) {
        var db = res.db;
        db.auto_compaction = true;
        var view = {
          name: depDbName,
          db: db, 
          sourceDB: sourceDB,
          adapter: sourceDB.adapter,
          mapFun: mapFun,
          reduceFun: reduceFun
        };
        return view.db.get('_local/lastSeq').then(null, function (err) {
          /* istanbul ignore if */
          if (err.name !== 'not_found') {
            throw err;
          }
        }).then(function (lastSeqDoc) {
          view.seq = lastSeqDoc ? lastSeqDoc.seq : 0;
          if (!randomizer) {
            // randomizer implies the view is temporary, no need to cache it
            sourceDB._cachedViews = sourceDB._cachedViews || {};
            sourceDB._cachedViews[viewSignature] = view;
            view.db.on('destroyed', function () {
              delete sourceDB._cachedViews[viewSignature];
            });
          }
          return view;
        });
      });
    });
  });
};

},{"./upsert":52,"./utils":53}],47:[function(_dereq_,module,exports){
'use strict';

module.exports = function (func, emit, sum, log, isArray, toJSON) {
  /*jshint evil:true,unused:false */
  return eval("'use strict'; (" + func + ");");
};

},{}],48:[function(_dereq_,module,exports){
'use strict';

var pouchCollate = _dereq_('pouchdb-collate');
var TaskQueue = _dereq_('./taskqueue');
var collate = pouchCollate.collate;
var toIndexableString = pouchCollate.toIndexableString;
var normalizeKey = pouchCollate.normalizeKey;
var createView = _dereq_('./create-view');
var evalFunc = _dereq_('./evalfunc');
var log; 
/* istanbul ignore else */
if ((typeof console !== 'undefined') && (typeof console.log === 'function')) {
  log = Function.prototype.bind.call(console.log, console);
} else {
  log = function () {};
}
var utils = _dereq_('./utils');
var Promise = utils.Promise;
var mainQueue = new TaskQueue();
var CHANGES_BATCH_SIZE = 50;

function parseViewName(name) {
  // can be either 'ddocname/viewname' or just 'viewname'
  // (where the ddoc name is the same)
  return name.indexOf('/') === -1 ? [name, name] : name.split('/');
}

function tryCode(db, fun, args) {
  // emit an event if there was an error thrown by a map/reduce function.
  // putting try/catches in a single function also avoids deoptimizations.
  try {
    return {
      output : fun.apply(null, args)
    };
  } catch (e) {
    db.emit('error', e);
    return {error : e};
  }
}

function sortByKeyThenValue(x, y) {
  var keyCompare = collate(x.key, y.key);
  return keyCompare !== 0 ? keyCompare : collate(x.value, y.value);
}

function sliceResults(results, limit, skip) {
  skip = skip || 0;
  if (typeof limit === 'number') {
    return results.slice(skip, limit + skip);
  } else if (skip > 0) {
    return results.slice(skip);
  }
  return results;
}

function createBuiltInError(name) {
  var error = new Error('builtin ' + name +
    ' function requires map values to be numbers' +
    ' or number arrays');
  error.name = 'invalid_value';
  error.status = 500;
  return error;
}

function sum(values) {
  var result = 0;
  for (var i = 0, len = values.length; i < len; i++) {
    var num = values[i];
    if (typeof num !== 'number') {
      if (Array.isArray(num)) {
        // lists of numbers are also allowed, sum them separately
        result = typeof result === 'number' ? [result] : result;
        for (var j = 0, jLen = num.length; j < jLen; j++) {
          var jNum = num[j];
          if (typeof jNum !== 'number') {
            throw createBuiltInError('_sum');
          } else if (typeof result[j] === 'undefined') {
            result.push(jNum);
          } else {
            result[j] += jNum;
          }
        }
      } else { // not array/number
        throw createBuiltInError('_sum');
      }
    } else if (typeof result === 'number') {
      result += num;
    } else { // add number to array
      result[0] += num;
    }
  }
  return result;
}

var builtInReduce = {
  _sum: function (keys, values) {
    return sum(values);
  },

  _count: function (keys, values) {
    return values.length;
  },

  _stats: function (keys, values) {
    // no need to implement rereduce=true, because Pouch
    // will never call it
    function sumsqr(values) {
      var _sumsqr = 0;
      for (var i = 0, len = values.length; i < len; i++) {
        var num = values[i];
        _sumsqr += (num * num);
      }
      return _sumsqr;
    }
    return {
      sum     : sum(values),
      min     : Math.min.apply(null, values),
      max     : Math.max.apply(null, values),
      count   : values.length,
      sumsqr : sumsqr(values)
    };
  }
};

function addHttpParam(paramName, opts, params, asJson) {
  // add an http param from opts to params, optionally json-encoded
  var val = opts[paramName];
  if (typeof val !== 'undefined') {
    if (asJson) {
      val = encodeURIComponent(JSON.stringify(val));
    }
    params.push(paramName + '=' + val);
  }
}

function checkQueryParseError(options, fun) {
  var startkeyName = options.descending ? 'endkey' : 'startkey';
  var endkeyName = options.descending ? 'startkey' : 'endkey';

  if (typeof options[startkeyName] !== 'undefined' &&
    typeof options[endkeyName] !== 'undefined' &&
    collate(options[startkeyName], options[endkeyName]) > 0) {
    throw new QueryParseError('No rows can match your key range, reverse your ' +
        'start_key and end_key or set {descending : true}');
  } else if (fun.reduce && options.reduce !== false) {
    if (options.include_docs) {
      throw new QueryParseError('{include_docs:true} is invalid for reduce');
    } else if (options.keys && options.keys.length > 1 &&
        !options.group && !options.group_level) {
      throw new QueryParseError('Multi-key fetches for reduce views must use {group: true}');
    }
  }
  if (options.group_level) {
    if (typeof options.group_level !== 'number') {
      throw new QueryParseError('Invalid value for integer: "' + options.group_level + '"');
    }
    if (options.group_level < 0) {
      throw new QueryParseError('Invalid value for positive integer: ' +
        '"' + options.group_level + '"');
    }
  }
}

function httpQuery(db, fun, opts) {
  // List of parameters to add to the PUT request
  var params = [];
  var body;
  var method = 'GET';

  // If opts.reduce exists and is defined, then add it to the list
  // of parameters.
  // If reduce=false then the results are that of only the map function
  // not the final result of map and reduce.
  addHttpParam('reduce', opts, params);
  addHttpParam('include_docs', opts, params);
  addHttpParam('limit', opts, params);
  addHttpParam('descending', opts, params);
  addHttpParam('group', opts, params);
  addHttpParam('group_level', opts, params);
  addHttpParam('skip', opts, params);
  addHttpParam('startkey', opts, params, true);
  addHttpParam('endkey', opts, params, true);
  addHttpParam('inclusive_end', opts, params);
  addHttpParam('key', opts, params, true);

  // Format the list of parameters into a valid URI query string
  params = params.join('&');
  params = params === '' ? '' : '?' + params;

  // If keys are supplied, issue a POST request to circumvent GET query string limits
  // see http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
  if (typeof opts.keys !== 'undefined') {
    var MAX_URL_LENGTH = 2000;
    // according to http://stackoverflow.com/a/417184/680742,
    // the de facto URL length limit is 2000 characters

    var keysAsString =
      'keys=' + encodeURIComponent(JSON.stringify(opts.keys));
    if (keysAsString.length + params.length + 1 <= MAX_URL_LENGTH) {
      // If the keys are short enough, do a GET. we do this to work around
      // Safari not understanding 304s on POSTs (see pouchdb/pouchdb#1239)
      params += (params[0] === '?' ? '&' : '?') + keysAsString;
    } else {
      method = 'POST';
      if (typeof fun === 'string') {
        body = JSON.stringify({keys: opts.keys});
      } else { // fun is {map : mapfun}, so append to this
        fun.keys = opts.keys;
      }
    }
  }

  // We are referencing a query defined in the design doc
  if (typeof fun === 'string') {
    var parts = parseViewName(fun);
    return db.request({
      method: method,
      url: '_design/' + parts[0] + '/_view/' + parts[1] + params,
      body: body
    });
  }

  // We are using a temporary view, terrible for performance but good for testing
  body = body || {};
  Object.keys(fun).forEach(function (key) {
    if (Array.isArray(fun[key])) {
      body[key] = fun[key];
    } else {
      body[key] = fun[key].toString();
    }
  });
  return db.request({
    method: 'POST',
    url: '_temp_view' + params,
    body: body
  });
}

function defaultsTo(value) {
  return function (reason) {
    /* istanbul ignore else */
    if (reason.name === 'not_found') {
      return value;
    } else {
      throw reason;
    }
  };
}
function saveKeyValues(view, docIdsToEmits, seq) {
  return view.db.get('_local/lastSeq')
    .then(null, defaultsTo({_id: '_local/lastSeq', seq: 0}))
    .then(function (lastSeqDoc) {
      return Promise.all(Object.keys(docIdsToEmits).map(function (docId) {
        return view.db.get('_local/doc_' + docId)
          .then(null, defaultsTo({_id : '_local/doc_' + docId, keys : []}))
          .then(function (metaDoc) {
            return view.db.allDocs({keys : metaDoc.keys, include_docs : true}).then(function (res) {
              var kvDocs = res.rows.map(function (row) {
                return row.doc;
              }).filter(function (row) {
                return row;
              });

              var indexableKeysToKeyValues = docIdsToEmits[docId];
              var oldKeysMap = {};
              kvDocs.forEach(function (kvDoc) {
                oldKeysMap[kvDoc._id] = true;
                kvDoc._deleted = !indexableKeysToKeyValues[kvDoc._id];
                if (!kvDoc._deleted) {
                  kvDoc.value = indexableKeysToKeyValues[kvDoc._id];
                }
              });

              var newKeys = Object.keys(indexableKeysToKeyValues);
              newKeys.forEach(function (key) {
                if (!oldKeysMap[key]) {
                  // new doc
                  kvDocs.push({
                    _id : key,
                    value : indexableKeysToKeyValues[key]
                  });
                }
              });
              metaDoc.keys = utils.uniq(newKeys.concat(metaDoc.keys));
              kvDocs.push(metaDoc);

              return kvDocs;
            });
          });
      })).then(function (listOfDocsToPersist) {
        var docsToPersist = [];
        listOfDocsToPersist.forEach(function (docList) {
          docsToPersist = docsToPersist.concat(docList);
        });

        lastSeqDoc.seq = seq;
        docsToPersist.push(lastSeqDoc);

        return view.db.bulkDocs({docs : docsToPersist});
      });
    });
}

var updateView = utils.sequentialize(mainQueue, function (view) {
  // bind the emit function once
  var mapResults;
  var doc;

  function emit(key, value) {
    mapResults.push({
      id  : doc._id,
      key : normalizeKey(key),
      value : normalizeKey(value)
    });
  }

  var mapFun;
  // for temp_views one can use emit(doc, emit), see #38
  if (typeof view.mapFun === "function" && view.mapFun.length === 2) {
    var origMap = view.mapFun;
    mapFun = function (doc) {
      return origMap(doc, emit);
    };
  } else {
    mapFun = evalFunc(view.mapFun.toString(), emit, sum, log, Array.isArray, JSON.parse);
  }

  var currentSeq = view.seq || 0;

  function processChange(docIdsToEmits, seq) {
    return function () {
      return saveKeyValues(view, docIdsToEmits, seq);
    };
  }
  var queue = new TaskQueue();
  // TODO(neojski): https://github.com/daleharvey/pouchdb/issues/1521

  return new Promise(function (resolve, reject) {

    function complete() {
      queue.finish().then(function () {
        view.seq = currentSeq;
        resolve();
      });
    }

    function processNextBatch() {
      view.sourceDB.changes({
        conflicts: true,
        include_docs: true,
        since : currentSeq,
        limit : CHANGES_BATCH_SIZE
      }).on('complete', function (response) {
        var results = response.results;
        if (!results.length) {
          return complete();
        }
        var docIdsToEmits = {};
        for (var i = 0, l = results.length; i < l; i++) {
          var change = results[i];
          if (change.doc._id[0] !== '_') {
            mapResults = [];
            doc = change.doc;

            if (!doc._deleted) {
              tryCode(view.sourceDB, mapFun, [doc]);
            }
            mapResults.sort(sortByKeyThenValue);

            var indexableKeysToKeyValues = {};
            for (var j = 0, jl = mapResults.length; j < jl; j++) {
              var obj = mapResults[j];
              var indexableKey = toIndexableString([obj.key, obj.id, j]);
              indexableKeysToKeyValues[indexableKey] = obj;
            }
            docIdsToEmits[change.doc._id] = indexableKeysToKeyValues;
          }
          currentSeq = change.seq;
        }
        queue.add(processChange(docIdsToEmits, currentSeq));
        if (results.length < CHANGES_BATCH_SIZE) {
          return complete();
        }
        return processNextBatch();
      }).on('error', onError);
      /* istanbul ignore next */
      function onError(err) {
        reject(err);
      }
    }
    processNextBatch();
  });
});

function reduceView(view, results, options) {
  if (options.group_level === 0) {
    delete options.group_level;
  }

  var shouldGroup = options.group || options.group_level;

  var reduceFun;
  if (builtInReduce[view.reduceFun]) {
    reduceFun = builtInReduce[view.reduceFun];
  } else {
    reduceFun = evalFunc(
      view.reduceFun.toString(), null, sum, log, Array.isArray, JSON.parse);
  }

  var groups = [];
  var lvl = options.group_level;
  results.forEach(function (e) {
    var last = groups[groups.length - 1];
    var key = shouldGroup ? e.key : null;

    // only set group_level for array keys
    if (shouldGroup && Array.isArray(key) && typeof lvl === 'number') {
      key = key.length > lvl ? key.slice(0, lvl) : key;
    }

    if (last && collate(last.key[0][0], key) === 0) {
      last.key.push([key, e.id]);
      last.value.push(e.value);
      return;
    }
    groups.push({key: [
      [key, e.id]
    ], value: [e.value]});
  });
  for (var i = 0, len = groups.length; i < len; i++) {
    var e = groups[i];
    var reduceTry = tryCode(view.sourceDB, reduceFun, [e.key, e.value, false]);
    // CouchDB typically just sets the value to null if reduce errors out
    e.value = reduceTry.error ? null : reduceTry.output;
    e.key = e.key[0][0];
  }
  // no total_rows/offset when reducing
  return {rows: sliceResults(groups, options.limit, options.skip)};
}

var queryView = utils.sequentialize(mainQueue, function (view, opts) {
  var totalRows;
  var shouldReduce = view.reduceFun && opts.reduce !== false;
  var skip = opts.skip || 0;
  if (typeof opts.keys !== 'undefined' && !opts.keys.length) {
    // equivalent query
    opts.limit = 0;
    delete opts.keys;
  }

  function fetchFromView(viewOpts) {
    viewOpts.include_docs = true;
    return view.db.allDocs(viewOpts).then(function (res) {
      totalRows = res.total_rows;
      return res.rows.map(function (result) {
        return result.doc.value;
      });
    });
  }

  function onMapResultsReady(results) {
    var res;
    if (shouldReduce) {
      res = reduceView(view, results, opts);
    } else {
      res = {
        total_rows: totalRows,
        offset: skip,
        rows: results
      };
    }
    if (opts.include_docs) {
      var getDocsPromises = results.map(function (row) {
        var val = row.value;
        var docId = (val && typeof val === 'object' && val._id) || row.id;
        return view.sourceDB.get(docId).then(function (joinedDoc) {
          row.doc = joinedDoc;
        }, function () {
          // document error = don't join
        });
      });
      return Promise.all(getDocsPromises).then(function () {
        return res;
      });
    } else {
      return res;
    }
  }

  var flatten = function (array) {
    return array.reduce(function (prev, cur) {
      return prev.concat(cur);
    });
  };

  if (typeof opts.keys !== 'undefined') {
    var keys = opts.keys;
    var fetchPromises = keys.map(function (key) {
      var viewOpts = {
        startkey : toIndexableString([key]),
        endkey   : toIndexableString([key, {}])
      };
      return fetchFromView(viewOpts);
    });
    return Promise.all(fetchPromises).then(flatten).then(onMapResultsReady);
  } else { // normal query, no 'keys'
    var viewOpts = {
      descending : opts.descending
    };
    if (typeof opts.startkey !== 'undefined') {
      viewOpts.startkey = opts.descending ?
        toIndexableString([opts.startkey, {}]) :
        toIndexableString([opts.startkey]);
    }
    if (typeof opts.endkey !== 'undefined') {
      var inclusiveEnd = opts.inclusive_end !== false;
      if (opts.descending) {
        inclusiveEnd = !inclusiveEnd;
      }

      viewOpts.endkey = toIndexableString(inclusiveEnd ? [opts.endkey, {}] : [opts.endkey]);
    }
    if (typeof opts.key !== 'undefined') {
      var keyStart = toIndexableString([opts.key]);
      var keyEnd = toIndexableString([opts.key, {}]);
      if (viewOpts.descending) {
        viewOpts.endkey = keyStart;
        viewOpts.startkey = keyEnd;
      } else {
        viewOpts.startkey = keyStart;
        viewOpts.endkey = keyEnd;
      }
    }
    if (!shouldReduce) {
      if (typeof opts.limit === 'number') {
        viewOpts.limit = opts.limit;
      }
      viewOpts.skip = skip;
    }
    return fetchFromView(viewOpts).then(onMapResultsReady);
  }
});

function httpViewCleanup(db) {
  return db.request({
    method: 'POST',
    url: '_view_cleanup'
  });
}

var localViewCleanup = utils.sequentialize(mainQueue, function (db) {
  return db.get('_local/mrviews').then(function (metaDoc) {
    var docsToViews = {};
    Object.keys(metaDoc.views).forEach(function (fullViewName) {
      var parts = fullViewName.split('/');
      var designDocName = '_design/' + parts[0];
      var viewName = parts[1];
      docsToViews[designDocName] = docsToViews[designDocName] || {};
      docsToViews[designDocName][viewName] = true;
    });
    var opts = {
      keys : Object.keys(docsToViews),
      include_docs : true
    };
    return db.allDocs(opts).then(function (res) {
      var viewsToStatus = {};
      res.rows.forEach(function (row) {
        Object.keys(docsToViews[row.key]).forEach(function (viewName) {
          var viewDBNames = Object.keys(metaDoc.views[row.key.substring(8) + '/' + viewName]);
          // design doc deleted, or view function nonexistent
          var statusIsGood = row.doc && row.doc.views && row.doc.views[viewName];
          viewDBNames.forEach(function (viewDBName) {
            viewsToStatus[viewDBName] = viewsToStatus[viewDBName] || statusIsGood;
          });
        });
      });
      var dbsToDelete = Object.keys(viewsToStatus).filter(function (viewDBName) {
        return !viewsToStatus[viewDBName];
      });
      var destroyPromises = dbsToDelete.map(function (viewDBName) {
        return db.constructor.destroy(viewDBName, {adapter : db.adapter});
      });
      return Promise.all(destroyPromises).then(function () {
        return {ok: true};
      });
    });
  }, defaultsTo({ok: true}));
});

exports.viewCleanup = utils.callbackify(function () {
  var db = this;
  if (db.type() === 'http') {
    return httpViewCleanup(db);
  }
  return localViewCleanup(db);
});

function queryPromised(db, fun, opts) {
  if (db.type() === 'http') {
    return httpQuery(db, fun, opts);
  }

  if (typeof fun !== 'string') {
    // temp_view
    checkQueryParseError(opts, fun);

    var randomizer = Math.round(Math.random()  * 1000000) + 1;
    var createViewOpts = {
      db : db,
      viewName : 'temp_view/temp_view',
      map : fun.map,
      reduce : fun.reduce,
      randomizer : randomizer
    };
    return createView(createViewOpts).then(function (view) {
      function cleanup() {
        return view.db.destroy();
      }
      return utils.fin(updateView(view).then(function () {
        return queryView(view, opts);
      }), cleanup);
    });
  } else {
    // persistent view
    var fullViewName = fun;
    var parts = parseViewName(fullViewName);
    var designDocName = parts[0];
    var viewName = parts[1];
    return db.get('_design/' + designDocName).then(function (doc) {
      var fun = doc.views && doc.views[viewName];

      if (!fun || typeof fun.map !== 'string') {
        var error = new Error('ddoc ' + designDocName + ' has no view named ' +
          viewName);
        error.name = 'not_found';
        error.status = 400;
        throw error;
      }
      checkQueryParseError(opts, fun);

      var createViewOpts = {
        db : db,
        viewName : fullViewName,
        map : fun.map,
        reduce : fun.reduce
      };
      return createView(createViewOpts).then(function (view) {
        if (opts.stale === 'ok' || opts.stale === 'update_after') {
          if (opts.stale === 'update_after') {
            updateView(view);
          }
          return queryView(view, opts);
        } else { // stale not ok
          return updateView(view).then(function () {
            return queryView(view, opts);
          });
        }
      });
    });
  }
}

exports.query = function (fun, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts = utils.extend({}, opts);

  if (typeof fun === 'function') {
    fun = {map : fun};
  }

  var db = this;
  var promise = Promise.resolve().then(function () {
    return queryPromised(db, fun, opts);
  });
  utils.promisedCallback(promise, callback);
  return promise;
};

exports.putView = function (name, fun, rev, opts, callback) {
  if (typeof rev === 'object') {
    callback = opts;
    opts = rev;
    rev = null;
  } else if (typeof rev === 'function') {
    callback = rev;
    rev = opts = null;
  } else if (typeof opts === 'function') {
    callback = opts;
    opts = null;
  }
  opts = utils.extend({}, opts || {});

  if (typeof fun === 'function' || typeof fun === 'string') {
    fun = {map : fun};
  }

  var error;

  if (typeof name !== 'string') {
    error = new Error('you must supply a design doc/view name');
    error.name = 'putview_error';
    error.status = 400;
    return utils.promisedCallback(Promise.reject(error), callback);
  } else if (!fun || ['function', 'string'].indexOf(typeof fun.map) === -1) {
    error = new Error('you must supply a map function');
    error.name = 'putview_error';
    error.status = 400;
    return utils.promisedCallback(Promise.reject(error), callback);
  }

  if (typeof fun.map === 'function') {
    fun.map = fun.map.toString();
  }
  if (typeof fun.reduce === 'function') {
    fun.reduce = fun.reduce.toString();
  }

  var parts = name.split('/');
  var designDocName = '_design/' + parts[0];
  var viewName = parts[1];

  var doc = {
    _id : designDocName,
    views : {}
  };
  doc.views[viewName] = fun;
  if (rev) {
    doc._rev = rev;
  }

  return this.put(doc, callback);
};

function QueryParseError(message) {
  this.status = 400;
  this.name = 'query_parse_error';
  this.message = message;
  this.error = true;
  try {
    Error.captureStackTrace(this, QueryParseError);
  } catch (e) {}
}

utils.inherits(QueryParseError, Error);

},{"./create-view":46,"./evalfunc":47,"./taskqueue":51,"./utils":53,"pouchdb-collate":49}],49:[function(_dereq_,module,exports){
'use strict';

var MIN_MAGNITUDE = -324; // verified by -Number.MIN_VALUE
var MAGNITUDE_DIGITS = 3; // ditto
var SEP = ''; // set to '_' for easier debugging 

var utils = _dereq_('./utils');

exports.collate = function (a, b) {

  if (a === b) {
    return 0;
  }

  a = exports.normalizeKey(a);
  b = exports.normalizeKey(b);

  var ai = collationIndex(a);
  var bi = collationIndex(b);
  if ((ai - bi) !== 0) {
    return ai - bi;
  }
  if (a === null) {
    return 0;
  }
  switch (typeof a) {
    case 'number':
      return a - b;
    case 'boolean':
      return a === b ? 0 : (a < b ? -1 : 1);
    case 'string':
      return stringCollate(a, b);
  }
  return Array.isArray(a) ? arrayCollate(a, b) : objectCollate(a, b);
};

// couch considers null/NaN/Infinity/-Infinity === undefined,
// for the purposes of mapreduce indexes. also, dates get stringified.
exports.normalizeKey = function (key) {
  switch (typeof key) {
    case 'undefined':
      return null;
    case 'number':
      if (key === Infinity || key === -Infinity || isNaN(key)) {
        return null;
      }
      return key;
    case 'object':
      var origKey = key;
      if (Array.isArray(key)) {
        var len = key.length;
        key = new Array(len);
        for (var i = 0; i < len; i++) {
          key[i] = exports.normalizeKey(origKey[i]);
        }
      } else if (key instanceof Date) {
        return key.toJSON();
      } else if (key !== null) { // generic object
        key = {};
        for (var k in origKey) {
          if (origKey.hasOwnProperty(k)) {
            var val = origKey[k];
            if (typeof val !== 'undefined') {
              key[k] = exports.normalizeKey(val);
            }
          }
        }
      }
  }
  return key;
};

function indexify(key) {
  if (key !== null) {
    switch (typeof key) {
      case 'boolean':
        return key ? 1 : 0;
      case 'number':
        return numToIndexableString(key);
      case 'string':
        // We've to be sure that key does not contain \u0000
        // Do order-preserving replacements:
        // 0 -> 1, 1
        // 1 -> 1, 2
        // 2 -> 2, 2
        return key
          .replace(/\u0002/g, '\u0002\u0002')
          .replace(/\u0001/g, '\u0001\u0002')
          .replace(/\u0000/g, '\u0001\u0001');
      case 'object':
        var isArray = Array.isArray(key);
        var arr = isArray ? key : Object.keys(key);
        var i = -1;
        var len = arr.length;
        var result = '';
        if (isArray) {
          while (++i < len) {
            result += exports.toIndexableString(arr[i]);
          }
        } else {
          while (++i < len) {
            var objKey = arr[i];
            result += exports.toIndexableString(objKey) +
                exports.toIndexableString(key[objKey]);
          }
        }
        return result;
    }
  }
  return '';
}

// convert the given key to a string that would be appropriate
// for lexical sorting, e.g. within a database, where the
// sorting is the same given by the collate() function.
exports.toIndexableString = function (key) {
  var zero = '\u0000';
  key = exports.normalizeKey(key);
  return collationIndex(key) + SEP + indexify(key) + zero;
};

function arrayCollate(a, b) {
  var len = Math.min(a.length, b.length);
  for (var i = 0; i < len; i++) {
    var sort = exports.collate(a[i], b[i]);
    if (sort !== 0) {
      return sort;
    }
  }
  return (a.length === b.length) ? 0 :
    (a.length > b.length) ? 1 : -1;
}
function stringCollate(a, b) {
  // See: https://github.com/daleharvey/pouchdb/issues/40
  // This is incompatible with the CouchDB implementation, but its the
  // best we can do for now
  return (a === b) ? 0 : ((a > b) ? 1 : -1);
}
function objectCollate(a, b) {
  var ak = Object.keys(a), bk = Object.keys(b);
  var len = Math.min(ak.length, bk.length);
  for (var i = 0; i < len; i++) {
    // First sort the keys
    var sort = exports.collate(ak[i], bk[i]);
    if (sort !== 0) {
      return sort;
    }
    // if the keys are equal sort the values
    sort = exports.collate(a[ak[i]], b[bk[i]]);
    if (sort !== 0) {
      return sort;
    }

  }
  return (ak.length === bk.length) ? 0 :
    (ak.length > bk.length) ? 1 : -1;
}
// The collation is defined by erlangs ordered terms
// the atoms null, true, false come first, then numbers, strings,
// arrays, then objects
// null/undefined/NaN/Infinity/-Infinity are all considered null
function collationIndex(x) {
  var id = ['boolean', 'number', 'string', 'object'];
  var idx = id.indexOf(typeof x);
  //false if -1 otherwise true, but fast!!!!1
  if (~idx) {
    if (x === null) {
      return 1;
    }
    if (Array.isArray(x)) {
      return 5;
    }
    return idx < 3 ? (idx + 2) : (idx + 3);
  }
  if (Array.isArray(x)) {
    return 5;
  }
}

// conversion:
// x yyy zz...zz
// x = 0 for negative, 1 for 0, 2 for positive
// y = exponent (for negative numbers negated) moved so that it's >= 0
// z = mantisse
function numToIndexableString(num) {

  if (num === 0) {
    return '1';
  }

  // convert number to exponential format for easier and
  // more succinct string sorting
  var expFormat = num.toExponential().split(/e\+?/);
  var magnitude = parseInt(expFormat[1], 10);

  var neg = num < 0;

  var result = neg ? '0' : '2';

  // first sort by magnitude
  // it's easier if all magnitudes are positive
  var magForComparison = ((neg ? -magnitude : magnitude) - MIN_MAGNITUDE);
  var magString = utils.padLeft((magForComparison).toString(), '0', MAGNITUDE_DIGITS);

  result += SEP + magString;

  // then sort by the factor
  var factor = Math.abs(parseFloat(expFormat[0])); // [1..10)
  if (neg) { // for negative reverse ordering
    factor = 10 - factor;
  }

  var factorStr = factor.toFixed(20);

  // strip zeros from the end
  factorStr = factorStr.replace(/\.?0+$/, '');

  result += SEP + factorStr;

  return result;
}

},{"./utils":50}],50:[function(_dereq_,module,exports){
'use strict';

function pad(str, padWith, upToLength) {
  var padding = '';
  var targetLength = upToLength - str.length;
  while (padding.length < targetLength) {
    padding += padWith;
  }
  return padding;
}

exports.padLeft = function (str, padWith, upToLength) {
  var padding = pad(str, padWith, upToLength);
  return padding + str;
};

exports.padRight = function (str, padWith, upToLength) {
  var padding = pad(str, padWith, upToLength);
  return str + padding;
};

exports.stringLexCompare = function (a, b) {

  var aLen = a.length;
  var bLen = b.length;

  var i;
  for (i = 0; i < aLen; i++) {
    if (i === bLen) {
      // b is shorter substring of a
      return 1;
    }
    var aChar = a.charAt(i);
    var bChar = b.charAt(i);
    if (aChar !== bChar) {
      return aChar < bChar ? -1 : 1;
    }
  }

  if (aLen < bLen) {
    // a is shorter substring of b
    return -1;
  }

  return 0;
};

/*
 * returns the decimal form for the given integer, i.e. writes
 * out all the digits (in base-10) instead of using scientific notation
 */
exports.intToDecimalForm = function (int) {

  var isNeg = int < 0;
  var result = '';

  do {
    var remainder = isNeg ? -Math.ceil(int % 10) : Math.floor(int % 10);

    result = remainder + result;
    int = isNeg ? Math.ceil(int / 10) : Math.floor(int / 10);
  } while (int);


  if (isNeg && result !== '0') {
    result = '-' + result;
  }

  return result;
};
},{}],51:[function(_dereq_,module,exports){
'use strict';
/*
 * Simple task queue to sequentialize actions. Assumes callbacks will eventually fire (once).
 */

var Promise = _dereq_('./utils').Promise;

function TaskQueue() {
  this.promise = new Promise(function (fulfill) {fulfill(); });
}
TaskQueue.prototype.add = function (promiseFactory) {
  this.promise = this.promise.then(null, function () {
    // just recover
  }).then(function () {
    return promiseFactory();
  });
  return this.promise;
};
TaskQueue.prototype.finish = function () {
  return this.promise;
};

module.exports = TaskQueue;

},{"./utils":53}],52:[function(_dereq_,module,exports){
'use strict';
var Promise = _dereq_('./utils').Promise;

// this is essentially the "update sugar" function from daleharvey/pouchdb#1388
// the diffFun tells us what delta to apply to the doc.  it either returns
// the doc, or false if it doesn't need to do an update after all
function upsert(db, docId, diffFun) {
  return new Promise(function (fulfill, reject) {
    if (docId && typeof docId === 'object') {
      docId = docId._id;
    }
    if (typeof docId !== 'string') {
      return reject(new Error('doc id is required'));
    }

    db.get(docId, function (err, doc) {
      if (err) {
        if (err.name !== 'not_found') {
          return reject(err);
        }
        return fulfill(tryAndPut(db, diffFun({_id : docId}), diffFun));
      }
      var newDoc = diffFun(doc);
      if (!newDoc) {
        return fulfill(doc);
      }
      fulfill(tryAndPut(db, newDoc, diffFun));
    });
  });
}

function tryAndPut(db, doc, diffFun) {
  return db.put(doc).then(null, function (err) {
    if (err.name !== 'conflict') {
      throw err;
    }
    return upsert(db, doc, diffFun);
  });
}

module.exports = upsert;

},{"./utils":53}],53:[function(_dereq_,module,exports){
(function (process,global){
'use strict';
/* istanbul ignore if */
if (typeof global.Promise === 'function') {
  exports.Promise = global.Promise;
} else {
  exports.Promise = _dereq_('lie');
}
// uniquify a list, similar to underscore's _.uniq
exports.uniq = function (arr) {
  var map = {};
  arr.forEach(function (element) {
    map[element] = true;
  });
  return Object.keys(map);
};

exports.inherits = _dereq_('inherits');
exports.extend = _dereq_('extend');
var argsarray = _dereq_('argsarray');

exports.promisedCallback = function (promise, callback) {
  if (callback) {
    promise.then(function (res) {
      callback(null, res);
    }, function (reason) {
      callback(reason);
    });
  }
  return promise;
};

exports.callbackify = function (fun) {
  return argsarray(function (args) {
    var cb = args.pop();
    var promise = fun.apply(this, args);
    if (typeof cb === 'function') {
      exports.promisedCallback(promise, cb);
    }
    return promise;
  });
};

// Promise finally util similar to Q.finally
exports.fin = function (promise, cb) {
  return promise.then(function (res) {
    var promise2 = cb();
    if (typeof promise2.then === 'function') {
      return promise2.then(function () {
        return res;
      });
    }
    return res;
  }, function (reason) {
    var promise2 = cb();
    if (typeof promise2.then === 'function') {
      return promise2.then(function () {
        throw reason;
      });
    }
    throw reason;
  });
};

exports.sequentialize = function (queue, promiseFactory) {
  return function () {
    var args = arguments;
    var that = this;
    return queue.add(function () {
      return promiseFactory.apply(that, args);
    });
  };
};

var crypto = _dereq_('crypto');
var md5 = _dereq_('md5-jkmyers');

exports.MD5 = function (string) {
  /* istanbul ignore else */
  if (!process.browser) {
    return crypto.createHash('md5').update(string).digest('hex');
  } else {
    return md5(string);
  }
};
}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":25,"argsarray":22,"crypto":23,"extend":26,"inherits":27,"lie":31,"md5-jkmyers":45}]},{},[15])
(15)
});