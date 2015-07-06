/*jshint strict: false */
/*global chrome */
var merge = require('./merge');
exports.extend = require('pouchdb-extend');
exports.ajax = require('./prequest');
exports.createBlob = require('./deps/binary/blob'); // TODO: don't export this
exports.uuid = require('./deps/uuid');
exports.getArguments = require('argsarray');
var EventEmitter = require('events').EventEmitter;
var collections = require('pouchdb-collections');
exports.Map = collections.Map;
exports.Set = collections.Set;
var parseDoc = require('./deps/docs/parseDoc');

var Promise = require('./deps/promise');
exports.Promise = Promise;

var base64 = require('./deps/binary/base64');

// TODO: don't export these
exports.atob = base64.atob;
exports.btoa = base64.btoa;

var binStringToBlobOrBuffer =
  require('./deps/binary/binaryStringToBlobOrBuffer');

// TODO: only used by the integration tests
exports.binaryStringToBlobOrBuffer = binStringToBlobOrBuffer;

exports.lastIndexOf = function (str, char) {
  for (var i = str.length - 1; i >= 0; i--) {
    if (str.charAt(i) === char) {
      return i;
    }
  }
  return -1;
};

exports.clone = function (obj) {
  return exports.extend(true, {}, obj);
};

// like underscore/lodash _.pick()
function pick(obj, arr) {
  var res = {};
  for (var i = 0, len = arr.length; i < len; i++) {
    var prop = arr[i];
    if (prop in obj) {
      res[prop] = obj[prop];
    }
  }
  return res;
}
exports.pick = pick;

exports.inherits = require('inherits');

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

exports.filterChange = function filterChange(opts) {
  var req = {};
  var hasFilter = opts.filter && typeof opts.filter === 'function';
  req.query = opts.query_params;

  return function filter(change) {
    if (!change.doc) {
      // CSG sends events on the changes feed that don't have documents,
      // this hack makes a whole lot of existing code robust.
      change.doc = {};
    }
    if (opts.filter && hasFilter && !opts.filter.call(this, change.doc, req)) {
      return false;
    }
    if (!opts.include_docs) {
      delete change.doc;
    } else if (!opts.attachments) {
      for (var att in change.doc._attachments) {
        if (change.doc._attachments.hasOwnProperty(att)) {
          change.doc._attachments[att].stub = true;
        }
      }
    }
    return true;
  };
};

exports.parseDoc = parseDoc.parseDoc;
exports.invalidIdError = parseDoc.invalidIdError;

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
    return localStorage;
  } catch (e) {
    return false;
  }
};
exports.Changes = Changes;
exports.inherits(Changes, EventEmitter);
function Changes() {
  if (!(this instanceof Changes)) {
    return new Changes();
  }
  var self = this;
  EventEmitter.call(this);
  this.isChrome = isChromeApp();
  this._listeners = {};
  this.hasLocal = false;
  if (!this.isChrome) {
    this.hasLocal = exports.hasLocalStorage();
  }
  if (this.isChrome) {
    chrome.storage.onChanged.addListener(function (e) {
      // make sure it's event addressed to us
      if (e.db_name != null) {
        //object only has oldValue, newValue members
        self.emit(e.dbName.newValue);
      }
    });
  } else if (this.hasLocal) {
    if (typeof addEventListener !== 'undefined') {
      addEventListener("storage", function (e) {
        self.emit(e.key);
      });
    } else { // old IE
      window.attachEvent("storage", function (e) {
        self.emit(e.key);
      });
    }
  }

}
Changes.prototype.addListener = function (dbName, id, db, opts) {
  if (this._listeners[id]) {
    return;
  }
  var self = this;
  var inprogress = false;
  function eventFunction() {
    if (!self._listeners[id]) {
      return;
    }
    if (inprogress) {
      inprogress = 'waiting';
      return;
    }
    inprogress = true;
    var changesOpts = pick(opts, [
      'style', 'include_docs', 'attachments', 'conflicts', 'filter',
      'doc_ids', 'view', 'since', 'query_params', 'binary'
    ]);

    db.changes(changesOpts).on('change', function (c) {
      if (c.seq > opts.since && !opts.cancelled) {
        opts.since = c.seq;
        exports.call(opts.onChange, c);
      }
    }).on('complete', function () {
      if (inprogress === 'waiting') {
        setTimeout(function(){
          eventFunction();
        },0);
      }
      inprogress = false;
    }).on('error', function () {
      inprogress = false;
    });
  }
  this._listeners[id] = eventFunction;
  this.on(dbName, eventFunction);
};

Changes.prototype.removeListener = function (dbName, id) {
  if (!(id in this._listeners)) {
    return;
  }
  EventEmitter.prototype.removeListener.call(this, dbName,
    this._listeners[id]);
};


Changes.prototype.notifyLocalWindows = function (dbName) {
  //do a useless change on a storage thing
  //in order to get other windows's listeners to activate
  if (this.isChrome) {
    chrome.storage.local.set({dbName: dbName});
  } else if (this.hasLocal) {
    localStorage[dbName] = (localStorage[dbName] === "a") ? "b" : "a";
  }
};

Changes.prototype.notify = function (dbName) {
  this.emit(dbName);
  this.notifyLocalWindows(dbName);
};

exports.once = require('./deps/once');

exports.toPromise = require('./deps/toPromise');

exports.adapterFun = function (name, callback) {
  var log = require('debug')('pouchdb:api');

  function logApiCall(self, name, args) {
    if (!log.enabled) {
      return;
    }
    var logArgs = [self._db_name, name];
    for (var i = 0; i < args.length - 1; i++) {
      logArgs.push(args[i]);
    }
    log.apply(null, logArgs);

    // override the callback itself to log the response
    var origCallback = args[args.length - 1];
    args[args.length - 1] = function (err, res) {
      var responseArgs = [self._db_name, name];
      responseArgs = responseArgs.concat(
        err ? ['error', err] : ['success', res]
      );
      log.apply(null, responseArgs);
      origCallback(err, res);
    };
  }


  return exports.toPromise(exports.getArguments(function (args) {
    if (this._closed) {
      return Promise.reject(new Error('database is closed'));
    }
    var self = this;
    logApiCall(self, name, args);
    if (!this.taskqueue.isReady) {
      return new Promise(function (fulfill, reject) {
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

exports.explain404 = require('./deps/explain404');

exports.info = function (str) {
  if (typeof console !== 'undefined' && 'info' in console) {
    console.info(str);
  }
};

exports.parseUri = require('./deps/parseUri');

exports.compare = function (left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
};


// compact a tree by marking its non-leafs as missing,
// and return a list of revs to delete
exports.compactTree = function compactTree(metadata) {
  var revs = [];
  merge.traverseRevTree(metadata.rev_tree, function (isLeaf, pos,
                                                     revHash, ctx, opts) {
    if (opts.status === 'available' && !isLeaf) {
      revs.push(pos + '-' + revHash);
      opts.status = 'missing';
    }
  });
  return revs;
};

var vuvuzela = require('vuvuzela');

exports.safeJsonParse = function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return vuvuzela.parse(str);
  }
};

exports.safeJsonStringify = function safeJsonStringify(json) {
  try {
    return JSON.stringify(json);
  } catch (e) {
    return vuvuzela.stringify(json);
  }
};

exports.parseDesignDocFunctionName = function (s) {
  if (!s) {
    return null;
  }
  var parts = s.split('/');
  if (parts.length === 2) {
    return parts;
  } else if (parts.length === 1) {
    return [s, s];
  } else {
    return null;
  }
};

exports.normalizeDesignDocFunctionName = function (s) {
  var normalized = this.parseDesignDocFunctionName(s);
  return normalized ? normalized.join('/') : null;
};
