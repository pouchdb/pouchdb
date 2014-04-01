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
var EventEmitter = require('events').EventEmitter;
var Promise = typeof global.Promise === 'function' ? global.Promise : require('bluebird');

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
exports.inherits = require('inherits');
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

exports.getArguments = function (fun) {
  return function () {
    var len = arguments.length;
    var args = new Array(len);
    var i = -1;
    while (++i < len) {
      args[i] = arguments[i];
    }
    return fun.call(this, args);
  };
};
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
        if (change.doc._attachments.hasOwnProperty(att)) {
          change.doc._attachments[att].stub = true;
        }
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
  if (!opts.continuous) {
    exports.call(opts.complete, null, {results: changes, last_seq: last_seq});
  }
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

  error = exports.invalidIdError(doc._id);

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
        eventEmitter.emit(e.dbName.newValue);//object only has oldValue, newValue members
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

// From http://stackoverflow.com/questions/14967647/encode-decode-image-with-base64-breaks-image (2013-04-21)
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
    var tempCB = (typeof args[args.length - 1] === 'function') ? args.pop() : false;
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
        func.apply(self, args);
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
    if (!this.taskqueue.isReady) {
      this.taskqueue.addTask(name, args);
      return;
    }
    callback.apply(this, args);
  }));
};
//Can't find original post, but this is close
//http://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers
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

  opts = opts ? exports.extend(true, {}, opts) : {};
  opts.complete = opts.complete || function () { };
  var complete = exports.once(opts.complete);

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
    return promise;
  } else {
    fun(self, opts, promise);
    return promise;
  }
};
