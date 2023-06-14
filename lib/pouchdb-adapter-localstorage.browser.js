import { L as LevelPouch } from './index-1e3c58ae.js';
import { c as commonjsGlobal, g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import { b as buffer, i as inherits_browserExports } from './index-30b6bd50.js';
import './__node-resolve_empty-5ffda92e.js';
import './functionName-9335a350.js';
import './pouchdb-core.browser.js';
import './bulkGetShim-d4877145.js';
import './toPromise-9dada06a.js';
import './clone-abfcddc8.js';
import './guardedConsole-f54e5a40.js';
import './pouchdb-errors.browser.js';
import './rev-5645662a.js';
import './spark-md5-2c57e5fc.js';
import './stringMd5-browser-5aecd2bd.js';
import './isRemote-f9121da9.js';
import './upsert-331b6913.js';
import './collectConflicts-6afe46fc.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import 'node:events';
import './findPathToLeaf-7e69c93c.js';
import './pouchdb-fetch.browser.js';
import './pouchdb-changes-filter.browser.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './pouchdb-selector-core.browser.js';
import './index-3a476dad.js';
import './scopeEval-ff3a416d.js';
import './pouchdb-utils.browser.js';
import './explainError-browser-c025e6c9.js';
import './parseUri-b061a2c5.js';
import './flatten-994f45c6.js';
import './allDocsKeysQuery-9ff66512.js';
import './parseDoc-5d2a34bd.js';
import './latest-0521537f.js';
import './pouchdb-binary-utils.browser.js';
import './base64StringToBlobOrBuffer-browser-cdc72594.js';
import './blobOrBufferToBase64-browser-bbef19a6.js';
import './binaryMd5-browser-25ce905b.js';
import './processDocs-7ad6f99c.js';
import './merge-7299d068.js';
import './revExists-12209d1c.js';
import './pouchdb-json.browser.js';
import 'stream';

var toString = Object.prototype.toString;

var isModern = (
  typeof Buffer.alloc === 'function' &&
  typeof Buffer.allocUnsafe === 'function' &&
  typeof Buffer.from === 'function'
);

function isArrayBuffer (input) {
  return toString.call(input).slice(8, -1) === 'ArrayBuffer'
}

function fromArrayBuffer (obj, byteOffset, length) {
  byteOffset >>>= 0;

  var maxLength = obj.byteLength - byteOffset;

  if (maxLength < 0) {
    throw new RangeError("'offset' is out of bounds")
  }

  if (length === undefined) {
    length = maxLength;
  } else {
    length >>>= 0;

    if (length > maxLength) {
      throw new RangeError("'length' is out of bounds")
    }
  }

  return isModern
    ? Buffer.from(obj.slice(byteOffset, byteOffset + length))
    : new Buffer(new Uint8Array(obj.slice(byteOffset, byteOffset + length)))
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  return isModern
    ? Buffer.from(string, encoding)
    : new Buffer(string, encoding)
}

function bufferFrom$1 (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value)) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return isModern
    ? Buffer.from(value)
    : new Buffer(value)
}

var bufferFrom_1 = bufferFrom$1;

var abstractLeveldown = {};

var xtend$1 = extend;

function extend() {
    var target = {};

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }

    return target
}

/* Copyright (c) 2013 Rod Vagg, MIT License */

function AbstractIterator$2 (db) {
  this.db = db;
  this._ended = false;
  this._nexting = false;
}

AbstractIterator$2.prototype.next = function (callback) {
  var self = this;

  if (typeof callback != 'function')
    throw new Error('next() requires a callback argument')

  if (self._ended)
    return callback(new Error('cannot call next() after end()'))
  if (self._nexting)
    return callback(new Error('cannot call next() before previous next() has completed'))

  self._nexting = true;
  if (typeof self._next == 'function') {
    return self._next(function () {
      self._nexting = false;
      callback.apply(null, arguments);
    })
  }

  process.nextTick(function () {
    self._nexting = false;
    callback();
  });
};

AbstractIterator$2.prototype.end = function (callback) {
  if (typeof callback != 'function')
    throw new Error('end() requires a callback argument')

  if (this._ended)
    return callback(new Error('end() already called on iterator'))

  this._ended = true;

  if (typeof this._end == 'function')
    return this._end(callback)

  process.nextTick(callback);
};

var abstractIterator = AbstractIterator$2;

/* Copyright (c) 2013 Rod Vagg, MIT License */

function AbstractChainedBatch$1 (db) {
  this._db         = db;
  this._operations = [];
  this._written    = false;
}

AbstractChainedBatch$1.prototype._checkWritten = function () {
  if (this._written)
    throw new Error('write() already called on this batch')
};

AbstractChainedBatch$1.prototype.put = function (key, value) {
  this._checkWritten();

  var err = this._db._checkKeyValue(key, 'key', this._db._isBuffer);
  if (err) throw err
  err = this._db._checkKeyValue(value, 'value', this._db._isBuffer);
  if (err) throw err

  if (!this._db._isBuffer(key)) key = String(key);
  if (!this._db._isBuffer(value)) value = String(value);

  if (typeof this._put == 'function' )
    this._put(key, value);
  else
    this._operations.push({ type: 'put', key: key, value: value });

  return this
};

AbstractChainedBatch$1.prototype.del = function (key) {
  this._checkWritten();

  var err = this._db._checkKeyValue(key, 'key', this._db._isBuffer);
  if (err) throw err

  if (!this._db._isBuffer(key)) key = String(key);

  if (typeof this._del == 'function' )
    this._del(key);
  else
    this._operations.push({ type: 'del', key: key });

  return this
};

AbstractChainedBatch$1.prototype.clear = function () {
  this._checkWritten();

  this._operations = [];

  if (typeof this._clear == 'function' )
    this._clear();

  return this
};

AbstractChainedBatch$1.prototype.write = function (options, callback) {
  this._checkWritten();

  if (typeof options == 'function')
    callback = options;
  if (typeof callback != 'function')
    throw new Error('write() requires a callback argument')
  if (typeof options != 'object')
    options = {};

  this._written = true;

  if (typeof this._write == 'function' )
    return this._write(callback)

  if (typeof this._db._batch == 'function')
    return this._db._batch(this._operations, options, callback)

  process.nextTick(callback);
};

var abstractChainedBatch = AbstractChainedBatch$1;

/* Copyright (c) 2013 Rod Vagg, MIT License */

var xtend                = xtend$1
  , AbstractIterator$1     = abstractIterator
  , AbstractChainedBatch = abstractChainedBatch;

function AbstractLevelDOWN$1 (location) {
  if (!arguments.length || location === undefined)
    throw new Error('constructor requires at least a location argument')

  if (typeof location != 'string')
    throw new Error('constructor requires a location string argument')

  this.location = location;
}

AbstractLevelDOWN$1.prototype.open = function (options, callback) {
  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('open() requires a callback argument')

  if (typeof options != 'object')
    options = {};

  if (typeof this._open == 'function')
    return this._open(options, callback)

  process.nextTick(callback);
};

AbstractLevelDOWN$1.prototype.close = function (callback) {
  if (typeof callback != 'function')
    throw new Error('close() requires a callback argument')

  if (typeof this._close == 'function')
    return this._close(callback)

  process.nextTick(callback);
};

AbstractLevelDOWN$1.prototype.get = function (key, options, callback) {
  var err;

  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('get() requires a callback argument')

  if (err = this._checkKeyValue(key, 'key', this._isBuffer))
    return callback(err)

  if (!this._isBuffer(key))
    key = String(key);

  if (typeof options != 'object')
    options = {};

  if (typeof this._get == 'function')
    return this._get(key, options, callback)

  process.nextTick(function () { callback(new Error('NotFound')); });
};

AbstractLevelDOWN$1.prototype.put = function (key, value, options, callback) {
  var err;

  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('put() requires a callback argument')

  if (err = this._checkKeyValue(key, 'key', this._isBuffer))
    return callback(err)

  if (err = this._checkKeyValue(value, 'value', this._isBuffer))
    return callback(err)

  if (!this._isBuffer(key))
    key = String(key);

  // coerce value to string in node, don't touch it in browser
  // (indexeddb can store any JS type)
  if (!this._isBuffer(value) && !process.browser)
    value = String(value);

  if (typeof options != 'object')
    options = {};

  if (typeof this._put == 'function')
    return this._put(key, value, options, callback)

  process.nextTick(callback);
};

AbstractLevelDOWN$1.prototype.del = function (key, options, callback) {
  var err;

  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('del() requires a callback argument')

  if (err = this._checkKeyValue(key, 'key', this._isBuffer))
    return callback(err)

  if (!this._isBuffer(key))
    key = String(key);

  if (typeof options != 'object')
    options = {};

  if (typeof this._del == 'function')
    return this._del(key, options, callback)

  process.nextTick(callback);
};

AbstractLevelDOWN$1.prototype.batch = function (array, options, callback) {
  if (!arguments.length)
    return this._chainedBatch()

  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('batch(array) requires a callback argument')

  if (!Array.isArray(array))
    return callback(new Error('batch(array) requires an array argument'))

  if (typeof options != 'object')
    options = {};

  var i = 0
    , l = array.length
    , e
    , err;

  for (; i < l; i++) {
    e = array[i];
    if (typeof e != 'object')
      continue

    if (err = this._checkKeyValue(e.type, 'type', this._isBuffer))
      return callback(err)

    if (err = this._checkKeyValue(e.key, 'key', this._isBuffer))
      return callback(err)

    if (e.type == 'put') {
      if (err = this._checkKeyValue(e.value, 'value', this._isBuffer))
        return callback(err)
    }
  }

  if (typeof this._batch == 'function')
    return this._batch(array, options, callback)

  process.nextTick(callback);
};

//TODO: remove from here, not a necessary primitive
AbstractLevelDOWN$1.prototype.approximateSize = function (start, end, callback) {
  if (   start == null
      || end == null
      || typeof start == 'function'
      || typeof end == 'function') {
    throw new Error('approximateSize() requires valid `start`, `end` and `callback` arguments')
  }

  if (typeof callback != 'function')
    throw new Error('approximateSize() requires a callback argument')

  if (!this._isBuffer(start))
    start = String(start);

  if (!this._isBuffer(end))
    end = String(end);

  if (typeof this._approximateSize == 'function')
    return this._approximateSize(start, end, callback)

  process.nextTick(function () {
    callback(null, 0);
  });
};

AbstractLevelDOWN$1.prototype._setupIteratorOptions = function (options) {
  var self = this;

  options = xtend(options)

  ;[ 'start', 'end', 'gt', 'gte', 'lt', 'lte' ].forEach(function (o) {
    if (options[o] && self._isBuffer(options[o]) && options[o].length === 0)
      delete options[o];
  });

  options.reverse = !!options.reverse;

  // fix `start` so it takes into account gt, gte, lt, lte as appropriate
  if (options.reverse && options.lt)
    options.start = options.lt;
  if (options.reverse && options.lte)
    options.start = options.lte;
  if (!options.reverse && options.gt)
    options.start = options.gt;
  if (!options.reverse && options.gte)
    options.start = options.gte;

  if ((options.reverse && options.lt && !options.lte)
    || (!options.reverse && options.gt && !options.gte))
    options.exclusiveStart = true; // start should *not* include matching key

  return options
};

AbstractLevelDOWN$1.prototype.iterator = function (options) {
  if (typeof options != 'object')
    options = {};

  options = this._setupIteratorOptions(options);

  if (typeof this._iterator == 'function')
    return this._iterator(options)

  return new AbstractIterator$1(this)
};

AbstractLevelDOWN$1.prototype._chainedBatch = function () {
  return new AbstractChainedBatch(this)
};

AbstractLevelDOWN$1.prototype._isBuffer = function (obj) {
  return Buffer.isBuffer(obj)
};

AbstractLevelDOWN$1.prototype._checkKeyValue = function (obj, type) {
  if (obj === null || obj === undefined)
    return new Error(type + ' cannot be `null` or `undefined`')

  if (obj === null || obj === undefined)
    return new Error(type + ' cannot be `null` or `undefined`')

  if (this._isBuffer(obj)) {
    if (obj.length === 0)
      return new Error(type + ' cannot be an empty Buffer')
  } else if (String(obj) === '')
    return new Error(type + ' cannot be an empty String')
};

abstractLeveldown.AbstractLevelDOWN    = AbstractLevelDOWN$1;
abstractLeveldown.AbstractIterator     = AbstractIterator$1;
abstractLeveldown.AbstractChainedBatch = AbstractChainedBatch;

var localstorage = {};

var utils$2 = {};

// taken from rvagg/memdown commit 2078b40
utils$2.sortedIndexOf = function(arr, item) {
  var low = 0;
  var high = arr.length;
  var mid;
  while (low < high) {
    mid = (low + high) >>> 1;
    if (arr[mid] < item) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

var api$1 = {exports: {}};

var localstorageMemory = {exports: {}};

(function (module, exports) {
	(function (root) {
	  var localStorageMemory = {};
	  var cache = {};

	  /**
	   * number of stored items.
	   */
	  localStorageMemory.length = 0;

	  /**
	   * returns item for passed key, or null
	   *
	   * @para {String} key
	   *       name of item to be returned
	   * @returns {String|null}
	   */
	  localStorageMemory.getItem = function (key) {
	    if (key in cache) {
	      return cache[key]
	    }

	    return null
	  };

	  /**
	   * sets item for key to passed value, as String
	   *
	   * @para {String} key
	   *       name of item to be set
	   * @para {String} value
	   *       value, will always be turned into a String
	   * @returns {undefined}
	   */
	  localStorageMemory.setItem = function (key, value) {
	    if (typeof value === 'undefined') {
	      localStorageMemory.removeItem(key);
	    } else {
	      if (!(cache.hasOwnProperty(key))) {
	        localStorageMemory.length++;
	      }

	      cache[key] = '' + value;
	    }
	  };

	  /**
	   * removes item for passed key
	   *
	   * @para {String} key
	   *       name of item to be removed
	   * @returns {undefined}
	   */
	  localStorageMemory.removeItem = function (key) {
	    if (cache.hasOwnProperty(key)) {
	      delete cache[key];
	      localStorageMemory.length--;
	    }
	  };

	  /**
	   * returns name of key at passed index
	   *
	   * @para {Number} index
	   *       Position for key to be returned (starts at 0)
	   * @returns {String|null}
	   */
	  localStorageMemory.key = function (index) {
	    return Object.keys(cache)[index] || null
	  };

	  /**
	   * removes all stored items and sets length to 0
	   *
	   * @returns {undefined}
	   */
	  localStorageMemory.clear = function () {
	    cache = {};
	    localStorageMemory.length = 0;
	  };

	  {
	    module.exports = localStorageMemory;
	  }
	})(); 
} (localstorageMemory));

var localstorageMemoryExports = localstorageMemory.exports;

var hasLocalstorage = {exports: {}};

/**
 * # hasLocalStorage()
 *
 * returns `true` or `false` depending on whether localStorage is supported or not.
 * Beware that some browsers like Safari do not support localStorage in private mode.
 *
 * inspired by this cappuccino commit
 * https://github.com/cappuccino/cappuccino/commit/063b05d9643c35b303568a28809e4eb3224f71ec
 *
 * @returns {Boolean}
 */

(function (module, exports) {
	function hasLocalStorage() {
	  try {

	    // we've to put this in here. I've seen Firefox throwing `Security error: 1000`
	    // when cookies have been disabled
	    if (typeof localStorage === 'undefined') {
	      return false;
	    }

	    // Just because localStorage exists does not mean it works. In particular it might be disabled
	    // as it is when Safari's private browsing mode is active.
	    localStorage.setItem('Storage-Test', '1');

	    // that should not happen ...
	    if (localStorage.getItem('Storage-Test') !== '1') {
	      return false;
	    }

	    // okay, let's clean up if we got here.
	    localStorage.removeItem('Storage-Test');
	  } catch (_error) {

	    // in case of an error, like Safari's Private Mode, return false
	    return false;
	  }

	  // we're good.
	  return true;
	}


	{
	  module.exports = hasLocalStorage;
	} 
} (hasLocalstorage));

var hasLocalstorageExports = hasLocalstorage.exports;

var exports = api$1.exports = {};
var localStorageMemory = localstorageMemoryExports;
exports.hasLocalStorage = hasLocalstorageExports;

/**
 * returns localStorage-compatible API, either backed by window.localStorage
 * or memory if it's not available or not persistent.
 *
 * It also adds an object API (`.getObject(key)`,
 * `.setObject(key, properties)`) and a `isPresistent` property
 *
 * @returns {Object}
 */
exports.create = function () {
  var api;

  if (!exports.hasLocalStorage()) {
    api = localStorageMemory;
    api.isPersistent = false;
  } else {
    api = commonjsGlobal.localStorage;
    api = {
      get length() { return commonjsGlobal.localStorage.length; },
      getItem: commonjsGlobal.localStorage.getItem.bind(commonjsGlobal.localStorage),
      setItem: commonjsGlobal.localStorage.setItem.bind(commonjsGlobal.localStorage),
      removeItem: commonjsGlobal.localStorage.removeItem.bind(commonjsGlobal.localStorage),
      key: commonjsGlobal.localStorage.key.bind(commonjsGlobal.localStorage),
      clear: commonjsGlobal.localStorage.clear.bind(commonjsGlobal.localStorage),
    };

    api.isPersistent = true;
  }

  api.getObject = exports.getObject.bind(null, api);
  api.setObject = exports.setObject.bind(null, api);

  return api;
};

/**
 * sets key to passed Object.
 *
 * @returns undefined
 */
exports.setObject = function (store, key, object) {
  if (typeof object !== 'object') {
    return store.setItem(key, object);
  }

  return store.setItem(key, JSON.stringify(object));
};

/**
 * returns Object for key, or null
 *
 * @returns {Object|null}
 */
exports.getObject = function (store, key) {
  var item = store.getItem(key);

  if (!item) {
    return null;
  }

  try {
    return JSON.parse(item);
  } catch (e) {
    return item;
  }
};

var apiExports = api$1.exports;

var api = apiExports;
var lib$1 = api.create();

//
// Class that should contain everything necessary to interact
// with localStorage as a generic key-value store.
// The idea is that authors who want to create an AbstractKeyValueDOWN
// module (e.g. on lawnchair, S3, whatever) will only have to
// reimplement this file.
//

// see http://stackoverflow.com/a/15349865/680742
var nextTick$2 = commonjsGlobal.setImmediate || process.nextTick;

// We use humble-localstorage as a wrapper for localStorage because
// it falls back to an in-memory implementation in environments without
// localStorage, like Node or Safari private browsing.
var storage = lib$1;

function callbackify(callback, fun) {
  var val;
  var err;
  try {
    val = fun();
  } catch (e) {
    err = e;
  }
  nextTick$2(function () {
    callback(err, val);
  });
}

function createPrefix(dbname) {
  return dbname.replace(/!/g, '!!') + '!'; // escape bangs in dbname;
}

function LocalStorageCore$2(dbname) {
  this._prefix = createPrefix(dbname);
}

LocalStorageCore$2.prototype.getKeys = function (callback) {
  var self = this;
  callbackify(callback, function () {
    var keys = [];
    var prefixLen = self._prefix.length;
    var i = -1;
    var len = storage.length;
    while (++i < len) {
      var fullKey = storage.key(i);
      if (fullKey.substring(0, prefixLen) === self._prefix) {
        keys.push(fullKey.substring(prefixLen));
      }
    }
    keys.sort();
    return keys;
  });
};

LocalStorageCore$2.prototype.put = function (key, value, callback) {
  var self = this;
  callbackify(callback, function () {
    storage.setItem(self._prefix + key, value);
  });
};

LocalStorageCore$2.prototype.get = function (key, callback) {
  var self = this;
  callbackify(callback, function () {
    return storage.getItem(self._prefix + key);
  });
};

LocalStorageCore$2.prototype.remove = function (key, callback) {
  var self = this;
  callbackify(callback, function () {
    storage.removeItem(self._prefix + key);
  });
};

LocalStorageCore$2.destroy = function (dbname, callback) {
  var prefix = createPrefix(dbname);
  callbackify(callback, function () {
    var keysToDelete = [];
    var i = -1;
    var len = storage.length;
    while (++i < len) {
      var key = storage.key(i);
      if (key.substring(0, prefix.length) === prefix) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(function (key) {
      storage.removeItem(key);
    });
  });
};

var localstorageCore = LocalStorageCore$2;

var argsarray$1 = argsArray;

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

// Simple FIFO queue implementation to avoid having to do shift()
// on an array, which is slow.

function Queue$1() {
  this.length = 0;
}

Queue$1.prototype.push = function (item) {
  var node = {item: item};
  if (this.last) {
    this.last = this.last.next = node;
  } else {
    this.last = this.first = node;
  }
  this.length++;
};

Queue$1.prototype.shift = function () {
  var node = this.first;
  if (node) {
    this.first = node.next;
    if (!(--this.length)) {
      this.last = undefined;
    }
    return node.item;
  }
};

Queue$1.prototype.slice = function (start, end) {
  start = typeof start === 'undefined' ? 0 : start;
  end = typeof end === 'undefined' ? Infinity : end;

  var output = [];

  var i = 0;
  for (var node = this.first; node; node = node.next) {
    if (--end < 0) {
      break;
    } else if (++i > start) {
      output.push(node.item);
    }
  }
  return output;
};

var tinyQueue = Queue$1;

var argsarray = argsarray$1;
var Queue = tinyQueue;

// see http://stackoverflow.com/a/15349865/680742
var nextTick$1 = commonjsGlobal.setImmediate || process.nextTick;

function TaskQueue$1() {
  this.queue = new Queue();
  this.running = false;
}

TaskQueue$1.prototype.add = function (fun, callback) {
  this.queue.push({fun: fun, callback: callback});
  this.processNext();
};

TaskQueue$1.prototype.processNext = function () {
  var self = this;
  if (self.running || !self.queue.length) {
    return;
  }
  self.running = true;

  var task = self.queue.shift();
  nextTick$1(function () {
    task.fun(argsarray(function (args) {
      task.callback.apply(null, args);
      self.running = false;
      self.processNext();
    }));
  });
};

var taskqueue = TaskQueue$1;

var d64$1 = {exports: {}};

d64$1.exports;

(function (module) {
	var Buffer = buffer.Buffer;

	var CHARS = '.PYFGCRLAOEUIDHTNSQJKXBMWVZ_pyfgcrlaoeuidhtnsqjkxbmwvz1234567890'
	  .split('').sort().join('');

	module.exports = function (chars, exports) {
	  chars = chars || CHARS;
	  exports = exports || {};
	  if(chars.length !== 64) throw new Error('a base 64 encoding requires 64 chars')

	  var codeToIndex = new Buffer(128);
	  codeToIndex.fill();

	  for(var i = 0; i < 64; i++) {
	    var code = chars.charCodeAt(i);
	    codeToIndex[code] = i;
	  }

	  exports.encode = function (data) {
	      var s = '', l = data.length, hang = 0;
	      for(var i = 0; i < l; i++) {
	        var v = data[i];

	        switch (i % 3) {
	          case 0:
	            s += chars[v >> 2];
	            hang = (v & 3) << 4;
	          break;
	          case 1:
	            s += chars[hang | v >> 4];
	            hang = (v & 0xf) << 2;
	          break;
	          case 2:
	            s += chars[hang | v >> 6];
	            s += chars[v & 0x3f];
	            hang = 0;
	          break;
	        }

	      }
	      if(l%3) s += chars[hang];
	      return s
	    };
	  exports.decode = function (str) {
	      var l = str.length, j = 0;
	      var b = new Buffer(~~((l/4)*3)), hang = 0;

	      for(var i = 0; i < l; i++) {
	        var v = codeToIndex[str.charCodeAt(i)];

	        switch (i % 4) {
	          case 0:
	            hang = v << 2;
	          break;
	          case 1:
	            b[j++] = hang | v >> 4;
	            hang = (v << 4) & 0xff;
	          break;
	          case 2:
	            b[j++] = hang | v >> 2;
	            hang = (v << 6) & 0xff;
	          break;
	          case 3:
	            b[j++] = hang | v;
	          break;
	        }

	      }
	      return b
	    };
	  return exports
	};

	module.exports(CHARS, module.exports); 
} (d64$1));

var d64Exports = d64$1.exports;

// ArrayBuffer/Uint8Array are old formats that date back to before we
// had a proper browserified buffer type. they may be removed later
var arrayBuffPrefix = 'ArrayBuffer:';
var arrayBuffRegex = new RegExp('^' + arrayBuffPrefix);
var uintPrefix = 'Uint8Array:';
var uintRegex = new RegExp('^' + uintPrefix);

// this is the new encoding format used going forward
var bufferPrefix = 'Buff:';
var bufferRegex = new RegExp('^' + bufferPrefix);

var utils$1 = utils$2;
var LocalStorageCore$1 = localstorageCore;
var TaskQueue = taskqueue;
var d64 = d64Exports;

function LocalStorage$1(dbname) {
  this._store = new LocalStorageCore$1(dbname);
  this._queue = new TaskQueue();
}

LocalStorage$1.prototype.sequentialize = function (callback, fun) {
  this._queue.add(fun, callback);
};

LocalStorage$1.prototype.init = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    self._store.getKeys(function (err, keys) {
      if (err) {
        return callback(err);
      }
      self._keys = keys;
      return callback();
    });
  });
};

LocalStorage$1.prototype.keys = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    self._store.getKeys(function (err, keys) {
      callback(null, keys.slice());
    });
  });
};

//setItem: Saves and item at the key provided.
LocalStorage$1.prototype.setItem = function (key, value, callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    if (Buffer.isBuffer(value)) {
      value = bufferPrefix + d64.encode(value);
    }

    var idx = utils$1.sortedIndexOf(self._keys, key);
    if (self._keys[idx] !== key) {
      self._keys.splice(idx, 0, key);
    }
    self._store.put(key, value, callback);
  });
};

//getItem: Returns the item identified by it's key.
LocalStorage$1.prototype.getItem = function (key, callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    self._store.get(key, function (err, retval) {
      if (err) {
        return callback(err);
      }
      if (typeof retval === 'undefined' || retval === null) {
        // 'NotFound' error, consistent with LevelDOWN API
        return callback(new Error('NotFound'));
      }
      if (typeof retval !== 'undefined') {
        if (bufferRegex.test(retval)) {
          retval = d64.decode(retval.substring(bufferPrefix.length));
        } else if (arrayBuffRegex.test(retval)) {
          // this type is kept for backwards
          // compatibility with older databases, but may be removed
          // after a major version bump
          retval = retval.substring(arrayBuffPrefix.length);
          retval = new ArrayBuffer(atob(retval).split('').map(function (c) {
            return c.charCodeAt(0);
          }));
        } else if (uintRegex.test(retval)) {
          // ditto
          retval = retval.substring(uintPrefix.length);
          retval = new Uint8Array(atob(retval).split('').map(function (c) {
            return c.charCodeAt(0);
          }));
        }
      }
      callback(null, retval);
    });
  });
};

//removeItem: Removes the item identified by it's key.
LocalStorage$1.prototype.removeItem = function (key, callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    var idx = utils$1.sortedIndexOf(self._keys, key);
    if (self._keys[idx] === key) {
      self._keys.splice(idx, 1);
      self._store.remove(key, function (err) {
        if (err) {
          return callback(err);
        }
        callback();
      });
    } else {
      callback();
    }
  });
};

LocalStorage$1.prototype.length = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    callback(null, self._keys.length);
  });
};

localstorage.LocalStorage = LocalStorage$1;

var inherits = inherits_browserExports;
var bufferFrom = bufferFrom_1;
var AbstractLevelDOWN = abstractLeveldown.AbstractLevelDOWN;
var AbstractIterator = abstractLeveldown.AbstractIterator;

var LocalStorage = localstorage.LocalStorage;
var LocalStorageCore = localstorageCore;
var utils = utils$2;

// see http://stackoverflow.com/a/15349865/680742
var nextTick = commonjsGlobal.setImmediate || process.nextTick;

function LDIterator(db, options) {

  AbstractIterator.call(this, db);

  this._reverse = !!options.reverse;
  this._endkey     = options.end;
  this._startkey   = options.start;
  this._gt      = options.gt;
  this._gte     = options.gte;
  this._lt      = options.lt;
  this._lte     = options.lte;
  this._exclusiveStart = options.exclusiveStart;
  this._keysOnly = options.values === false;
  this._limit = options.limit;
  this._count = 0;

  this.onInitCompleteListeners = [];
}

inherits(LDIterator, AbstractIterator);

LDIterator.prototype._init = function (callback) {
  nextTick(function () {
    callback();
  });
};

LDIterator.prototype._next = function (callback) {
  var self = this;

  function onInitComplete() {
    if (self._pos === self._keys.length || self._pos < 0) { // done reading
      return callback();
    }

    var key = self._keys[self._pos];

    if (!!self._endkey && (self._reverse ? key < self._endkey : key > self._endkey)) {
      return callback();
    }

    if (!!self._limit && self._limit > 0 && self._count++ >= self._limit) {
      return callback();
    }

    if ((self._lt  && key >= self._lt) ||
      (self._lte && key > self._lte) ||
      (self._gt  && key <= self._gt) ||
      (self._gte && key < self._gte)) {
      return callback();
    }

    self._pos += self._reverse ? -1 : 1;
    if (self._keysOnly) {
      return callback(null, key);
    }

    self.db.container.getItem(key, function (err, value) {
      if (err) {
        if (err.message === 'NotFound') {
          return nextTick(function () {
            self._next(callback);
          });
        }
        return callback(err);
      }
      callback(null, key, value);
    });
  }
  if (!self.initStarted) {
    process.nextTick(function () {
      self.initStarted = true;
      self._init(function (err) {
        if (err) {
          return callback(err);
        }
        self.db.container.keys(function (err, keys) {
          if (err) {
            return callback(err);
          }
          self._keys = keys;
          if (self._startkey) {
            var index = utils.sortedIndexOf(self._keys, self._startkey);
            var startkey = (index >= self._keys.length || index < 0) ?
              undefined : self._keys[index];
            self._pos = index;
            if (self._reverse) {
              if (self._exclusiveStart || startkey !== self._startkey) {
                self._pos--;
              }
            } else if (self._exclusiveStart && startkey === self._startkey) {
              self._pos++;
            }
          } else {
            self._pos = self._reverse ? self._keys.length - 1 : 0;
          }
          onInitComplete();

          self.initCompleted = true;
          var i = -1;
          while (++i < self.onInitCompleteListeners.length) {
            nextTick(self.onInitCompleteListeners[i]);
          }
        });
      });
    });
  } else if (!self.initCompleted) {
    self.onInitCompleteListeners.push(onInitComplete);
  } else {
    process.nextTick(onInitComplete);
  }
};

function LD(location) {
  if (!(this instanceof LD)) {
    return new LD(location);
  }
  AbstractLevelDOWN.call(this, location);
  this.container = new LocalStorage(location);
}

inherits(LD, AbstractLevelDOWN);

LD.prototype._open = function (options, callback) {
  this.container.init(callback);
};

LD.prototype._put = function (key, value, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }

  err = checkKeyValue(value, 'value');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }

  if (typeof value === 'object' && !Buffer.isBuffer(value) && value.buffer === undefined) {
    var obj = {};
    obj.storetype = "json";
    obj.data = value;
    value = JSON.stringify(obj);
  }

  this.container.setItem(key, value, callback);
};

LD.prototype._get = function (key, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }

  if (!Buffer.isBuffer(key)) {
    key = String(key);
  }
  this.container.getItem(key, function (err, value) {

    if (err) {
      return callback(err);
    }

    if (options.asBuffer !== false && !Buffer.isBuffer(value)) {
      value = bufferFrom(value);
    }


    if (options.asBuffer === false) {
      if (value.indexOf("{\"storetype\":\"json\",\"data\"") > -1) {
        var res = JSON.parse(value);
        value = res.data;
      }
    }
    callback(null, value);
  });
};

LD.prototype._del = function (key, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }
  if (!Buffer.isBuffer(key)) {
    key = String(key);
  }

  this.container.removeItem(key, callback);
};

LD.prototype._batch = function (array, options, callback) {
  var self = this;
  nextTick(function () {
    var err;
    var key;
    var value;

    var numDone = 0;
    var overallErr;
    function checkDone() {
      if (++numDone === array.length) {
        callback(overallErr);
      }
    }

    if (Array.isArray(array) && array.length) {
      for (var i = 0; i < array.length; i++) {
        var task = array[i];
        if (task) {
          key = Buffer.isBuffer(task.key) ? task.key : String(task.key);
          err = checkKeyValue(key, 'key');
          if (err) {
            overallErr = err;
            checkDone();
          } else if (task.type === 'del') {
            self._del(task.key, options, checkDone);
          } else if (task.type === 'put') {
            value = Buffer.isBuffer(task.value) ? task.value : String(task.value);
            err = checkKeyValue(value, 'value');
            if (err) {
              overallErr = err;
              checkDone();
            } else {
              self._put(key, value, options, checkDone);
            }
          }
        } else {
          checkDone();
        }
      }
    } else {
      callback();
    }
  });
};

LD.prototype._iterator = function (options) {
  return new LDIterator(this, options);
};

LD.destroy = function (name, callback) {
  LocalStorageCore.destroy(name, callback);
};

function checkKeyValue(obj, type) {
  if (obj === null || obj === undefined) {
    return new Error(type + ' cannot be `null` or `undefined`');
  }
  if (obj === null || obj === undefined) {
    return new Error(type + ' cannot be `null` or `undefined`');
  }

  if (type === 'key') {

    if (obj instanceof Boolean) {
      return new Error(type + ' cannot be `null` or `undefined`');
    }
    if (obj === '') {
      return new Error(type + ' cannot be empty');
    }
  }
  if (obj.toString().indexOf("[object ArrayBuffer]") === 0) {
    if (obj.byteLength === 0 || obj.byteLength === undefined) {
      return new Error(type + ' cannot be an empty Buffer');
    }
  }

  if (Buffer.isBuffer(obj)) {
    if (obj.length === 0) {
      return new Error(type + ' cannot be an empty Buffer');
    }
  } else if (String(obj) === '') {
    return new Error(type + ' cannot be an empty String');
  }
}

var lib = LD;

var localstoragedown = /*@__PURE__*/getDefaultExportFromCjs(lib);

function LocalStoragePouch(opts, callback) {
  var _opts = Object.assign({
    db: localstoragedown
  }, opts);

  LevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
LocalStoragePouch.valid = () => typeof localStorage !== 'undefined';
LocalStoragePouch.use_prefix = true;

const localstorageAdapter = (PouchDB) => {
  PouchDB.adapter('localstorage', LocalStoragePouch, true);
};

export { localstorageAdapter as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWxvY2Fsc3RvcmFnZS5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvbG9jYWxzdG9yYWdlLWRvd24vbm9kZV9tb2R1bGVzL2J1ZmZlci1mcm9tL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9ub2RlX21vZHVsZXMveHRlbmQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL2Fic3RyYWN0LWl0ZXJhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1jaGFpbmVkLWJhdGNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1sZXZlbGRvd24uanMiLCIuLi9ub2RlX21vZHVsZXMvbG9jYWxzdG9yYWdlLWRvd24vbGliL3V0aWxzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xvY2Fsc3RvcmFnZS1tZW1vcnkvbGliL2xvY2Fsc3RvcmFnZS1tZW1vcnkuanMiLCIuLi9ub2RlX21vZHVsZXMvaGFzLWxvY2Fsc3RvcmFnZS9saWIvaGFzLWxvY2Fsc3RvcmFnZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9odW1ibGUtbG9jYWxzdG9yYWdlL2xpYi9hcGkuanMiLCIuLi9ub2RlX21vZHVsZXMvaHVtYmxlLWxvY2Fsc3RvcmFnZS9saWIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvbG9jYWxzdG9yYWdlLWRvd24vbGliL2xvY2Fsc3RvcmFnZS1jb3JlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2FyZ3NhcnJheS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy90aW55LXF1ZXVlL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xvY2Fsc3RvcmFnZS1kb3duL2xpYi90YXNrcXVldWUuanMiLCIuLi9ub2RlX21vZHVsZXMvZDY0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xvY2Fsc3RvcmFnZS1kb3duL2xpYi9sb2NhbHN0b3JhZ2UuanMiLCIuLi9ub2RlX21vZHVsZXMvbG9jYWxzdG9yYWdlLWRvd24vbGliL2luZGV4LmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWxvY2Fsc3RvcmFnZS9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuXG52YXIgaXNNb2Rlcm4gPSAoXG4gIHR5cGVvZiBCdWZmZXIuYWxsb2MgPT09ICdmdW5jdGlvbicgJiZcbiAgdHlwZW9mIEJ1ZmZlci5hbGxvY1Vuc2FmZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICB0eXBlb2YgQnVmZmVyLmZyb20gPT09ICdmdW5jdGlvbidcbilcblxuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlciAoaW5wdXQpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaW5wdXQpLnNsaWNlKDgsIC0xKSA9PT0gJ0FycmF5QnVmZmVyJ1xufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKG9iaiwgYnl0ZU9mZnNldCwgbGVuZ3RoKSB7XG4gIGJ5dGVPZmZzZXQgPj4+PSAwXG5cbiAgdmFyIG1heExlbmd0aCA9IG9iai5ieXRlTGVuZ3RoIC0gYnl0ZU9mZnNldFxuXG4gIGlmIChtYXhMZW5ndGggPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCInb2Zmc2V0JyBpcyBvdXQgb2YgYm91bmRzXCIpXG4gIH1cblxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSBtYXhMZW5ndGhcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPj4+PSAwXG5cbiAgICBpZiAobGVuZ3RoID4gbWF4TGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIidsZW5ndGgnIGlzIG91dCBvZiBib3VuZHNcIilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaXNNb2Rlcm5cbiAgICA/IEJ1ZmZlci5mcm9tKG9iai5zbGljZShieXRlT2Zmc2V0LCBieXRlT2Zmc2V0ICsgbGVuZ3RoKSlcbiAgICA6IG5ldyBCdWZmZXIobmV3IFVpbnQ4QXJyYXkob2JqLnNsaWNlKGJ5dGVPZmZzZXQsIGJ5dGVPZmZzZXQgKyBsZW5ndGgpKSlcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICB9XG5cbiAgaWYgKCFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImVuY29kaW5nXCIgbXVzdCBiZSBhIHZhbGlkIHN0cmluZyBlbmNvZGluZycpXG4gIH1cblxuICByZXR1cm4gaXNNb2Rlcm5cbiAgICA/IEJ1ZmZlci5mcm9tKHN0cmluZywgZW5jb2RpbmcpXG4gICAgOiBuZXcgQnVmZmVyKHN0cmluZywgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGJ1ZmZlckZyb20gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgYSBudW1iZXInKVxuICB9XG5cbiAgaWYgKGlzQXJyYXlCdWZmZXIodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldClcbiAgfVxuXG4gIHJldHVybiBpc01vZGVyblxuICAgID8gQnVmZmVyLmZyb20odmFsdWUpXG4gICAgOiBuZXcgQnVmZmVyKHZhbHVlKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1ZmZlckZyb21cbiIsIm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICB2YXIgdGFyZ2V0ID0ge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV1cblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0XG59XG4iLCIvKiBDb3B5cmlnaHQgKGMpIDIwMTMgUm9kIFZhZ2csIE1JVCBMaWNlbnNlICovXG5cbmZ1bmN0aW9uIEFic3RyYWN0SXRlcmF0b3IgKGRiKSB7XG4gIHRoaXMuZGIgPSBkYlxuICB0aGlzLl9lbmRlZCA9IGZhbHNlXG4gIHRoaXMuX25leHRpbmcgPSBmYWxzZVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ25leHQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAoc2VsZi5fZW5kZWQpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignY2Fubm90IGNhbGwgbmV4dCgpIGFmdGVyIGVuZCgpJykpXG4gIGlmIChzZWxmLl9uZXh0aW5nKVxuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIG5leHQoKSBiZWZvcmUgcHJldmlvdXMgbmV4dCgpIGhhcyBjb21wbGV0ZWQnKSlcblxuICBzZWxmLl9uZXh0aW5nID0gdHJ1ZVxuICBpZiAodHlwZW9mIHNlbGYuX25leHQgPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBzZWxmLl9uZXh0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX25leHRpbmcgPSBmYWxzZVxuICAgICAgY2FsbGJhY2suYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH0pXG4gIH1cblxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLl9uZXh0aW5nID0gZmFsc2VcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdlbmQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAodGhpcy5fZW5kZWQpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignZW5kKCkgYWxyZWFkeSBjYWxsZWQgb24gaXRlcmF0b3InKSlcblxuICB0aGlzLl9lbmRlZCA9IHRydWVcblxuICBpZiAodHlwZW9mIHRoaXMuX2VuZCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9lbmQoY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdEl0ZXJhdG9yXG4iLCIvKiBDb3B5cmlnaHQgKGMpIDIwMTMgUm9kIFZhZ2csIE1JVCBMaWNlbnNlICovXG5cbmZ1bmN0aW9uIEFic3RyYWN0Q2hhaW5lZEJhdGNoIChkYikge1xuICB0aGlzLl9kYiAgICAgICAgID0gZGJcbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG4gIHRoaXMuX3dyaXR0ZW4gICAgPSBmYWxzZVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX2NoZWNrV3JpdHRlbiA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuX3dyaXR0ZW4pXG4gICAgdGhyb3cgbmV3IEVycm9yKCd3cml0ZSgpIGFscmVhZHkgY2FsbGVkIG9uIHRoaXMgYmF0Y2gnKVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB2YXIgZXJyID0gdGhpcy5fZGIuX2NoZWNrS2V5VmFsdWUoa2V5LCAna2V5JywgdGhpcy5fZGIuX2lzQnVmZmVyKVxuICBpZiAoZXJyKSB0aHJvdyBlcnJcbiAgZXJyID0gdGhpcy5fZGIuX2NoZWNrS2V5VmFsdWUodmFsdWUsICd2YWx1ZScsIHRoaXMuX2RiLl9pc0J1ZmZlcilcbiAgaWYgKGVycikgdGhyb3cgZXJyXG5cbiAgaWYgKCF0aGlzLl9kYi5faXNCdWZmZXIoa2V5KSkga2V5ID0gU3RyaW5nKGtleSlcbiAgaWYgKCF0aGlzLl9kYi5faXNCdWZmZXIodmFsdWUpKSB2YWx1ZSA9IFN0cmluZyh2YWx1ZSlcblxuICBpZiAodHlwZW9mIHRoaXMuX3B1dCA9PSAnZnVuY3Rpb24nIClcbiAgICB0aGlzLl9wdXQoa2V5LCB2YWx1ZSlcbiAgZWxzZVxuICAgIHRoaXMuX29wZXJhdGlvbnMucHVzaCh7IHR5cGU6ICdwdXQnLCBrZXk6IGtleSwgdmFsdWU6IHZhbHVlIH0pXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB2YXIgZXJyID0gdGhpcy5fZGIuX2NoZWNrS2V5VmFsdWUoa2V5LCAna2V5JywgdGhpcy5fZGIuX2lzQnVmZmVyKVxuICBpZiAoZXJyKSB0aHJvdyBlcnJcblxuICBpZiAoIXRoaXMuX2RiLl9pc0J1ZmZlcihrZXkpKSBrZXkgPSBTdHJpbmcoa2V5KVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fZGVsID09ICdmdW5jdGlvbicgKVxuICAgIHRoaXMuX2RlbChrZXkpXG4gIGVsc2VcbiAgICB0aGlzLl9vcGVyYXRpb25zLnB1c2goeyB0eXBlOiAnZGVsJywga2V5OiBrZXkgfSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9jbGVhciA9PSAnZnVuY3Rpb24nIClcbiAgICB0aGlzLl9jbGVhcigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dyaXRlKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPSAnb2JqZWN0JylcbiAgICBvcHRpb25zID0ge31cblxuICB0aGlzLl93cml0dGVuID0gdHJ1ZVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fd3JpdGUgPT0gJ2Z1bmN0aW9uJyApXG4gICAgcmV0dXJuIHRoaXMuX3dyaXRlKGNhbGxiYWNrKVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fZGIuX2JhdGNoID09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIHRoaXMuX2RiLl9iYXRjaCh0aGlzLl9vcGVyYXRpb25zLCBvcHRpb25zLCBjYWxsYmFjaylcblxuICBwcm9jZXNzLm5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Q2hhaW5lZEJhdGNoIiwiLyogQ29weXJpZ2h0IChjKSAyMDEzIFJvZCBWYWdnLCBNSVQgTGljZW5zZSAqL1xuXG52YXIgeHRlbmQgICAgICAgICAgICAgICAgPSByZXF1aXJlKCd4dGVuZCcpXG4gICwgQWJzdHJhY3RJdGVyYXRvciAgICAgPSByZXF1aXJlKCcuL2Fic3RyYWN0LWl0ZXJhdG9yJylcbiAgLCBBYnN0cmFjdENoYWluZWRCYXRjaCA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaCcpXG5cbmZ1bmN0aW9uIEFic3RyYWN0TGV2ZWxET1dOIChsb2NhdGlvbikge1xuICBpZiAoIWFyZ3VtZW50cy5sZW5ndGggfHwgbG9jYXRpb24gPT09IHVuZGVmaW5lZClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbnN0cnVjdG9yIHJlcXVpcmVzIGF0IGxlYXN0IGEgbG9jYXRpb24gYXJndW1lbnQnKVxuXG4gIGlmICh0eXBlb2YgbG9jYXRpb24gIT0gJ3N0cmluZycpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjb25zdHJ1Y3RvciByZXF1aXJlcyBhIGxvY2F0aW9uIHN0cmluZyBhcmd1bWVudCcpXG5cbiAgdGhpcy5sb2NhdGlvbiA9IGxvY2F0aW9uXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ29wZW4oKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9vcGVuID09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIHRoaXMuX29wZW4ob3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nsb3NlKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9jbG9zZSA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9jbG9zZShjYWxsYmFjaylcblxuICBwcm9jZXNzLm5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIGVyclxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuXG4gIGlmIChlcnIgPSB0aGlzLl9jaGVja0tleVZhbHVlKGtleSwgJ2tleScsIHRoaXMuX2lzQnVmZmVyKSlcbiAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuXG4gIGlmICghdGhpcy5faXNCdWZmZXIoa2V5KSlcbiAgICBrZXkgPSBTdHJpbmcoa2V5KVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPSAnb2JqZWN0JylcbiAgICBvcHRpb25zID0ge31cblxuICBpZiAodHlwZW9mIHRoaXMuX2dldCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9nZXQoa2V5LCBvcHRpb25zLCBjYWxsYmFjaylcblxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHsgY2FsbGJhY2sobmV3IEVycm9yKCdOb3RGb3VuZCcpKSB9KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBlcnJcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT0gJ2Z1bmN0aW9uJylcbiAgICBjYWxsYmFjayA9IG9wdGlvbnNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdwdXQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZShrZXksICdrZXknLCB0aGlzLl9pc0J1ZmZlcikpXG4gICAgcmV0dXJuIGNhbGxiYWNrKGVycilcblxuICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZSh2YWx1ZSwgJ3ZhbHVlJywgdGhpcy5faXNCdWZmZXIpKVxuICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAgaWYgKCF0aGlzLl9pc0J1ZmZlcihrZXkpKVxuICAgIGtleSA9IFN0cmluZyhrZXkpXG5cbiAgLy8gY29lcmNlIHZhbHVlIHRvIHN0cmluZyBpbiBub2RlLCBkb24ndCB0b3VjaCBpdCBpbiBicm93c2VyXG4gIC8vIChpbmRleGVkZGIgY2FuIHN0b3JlIGFueSBKUyB0eXBlKVxuICBpZiAoIXRoaXMuX2lzQnVmZmVyKHZhbHVlKSAmJiAhcHJvY2Vzcy5icm93c2VyKVxuICAgIHZhbHVlID0gU3RyaW5nKHZhbHVlKVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPSAnb2JqZWN0JylcbiAgICBvcHRpb25zID0ge31cblxuICBpZiAodHlwZW9mIHRoaXMuX3B1dCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9wdXQoa2V5LCB2YWx1ZSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBlcnJcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT0gJ2Z1bmN0aW9uJylcbiAgICBjYWxsYmFjayA9IG9wdGlvbnNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdkZWwoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZShrZXksICdrZXknLCB0aGlzLl9pc0J1ZmZlcikpXG4gICAgcmV0dXJuIGNhbGxiYWNrKGVycilcblxuICBpZiAoIXRoaXMuX2lzQnVmZmVyKGtleSkpXG4gICAga2V5ID0gU3RyaW5nKGtleSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9kZWwgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fZGVsKGtleSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmJhdGNoID0gZnVuY3Rpb24gKGFycmF5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpXG4gICAgcmV0dXJuIHRoaXMuX2NoYWluZWRCYXRjaCgpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcignYmF0Y2goYXJyYXkpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuXG4gIGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignYmF0Y2goYXJyYXkpIHJlcXVpcmVzIGFuIGFycmF5IGFyZ3VtZW50JykpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIHZhciBpID0gMFxuICAgICwgbCA9IGFycmF5Lmxlbmd0aFxuICAgICwgZVxuICAgICwgZXJyXG5cbiAgZm9yICg7IGkgPCBsOyBpKyspIHtcbiAgICBlID0gYXJyYXlbaV1cbiAgICBpZiAodHlwZW9mIGUgIT0gJ29iamVjdCcpXG4gICAgICBjb250aW51ZVxuXG4gICAgaWYgKGVyciA9IHRoaXMuX2NoZWNrS2V5VmFsdWUoZS50eXBlLCAndHlwZScsIHRoaXMuX2lzQnVmZmVyKSlcbiAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAgICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZShlLmtleSwgJ2tleScsIHRoaXMuX2lzQnVmZmVyKSlcbiAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAgICBpZiAoZS50eXBlID09ICdwdXQnKSB7XG4gICAgICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZShlLnZhbHVlLCAndmFsdWUnLCB0aGlzLl9pc0J1ZmZlcikpXG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9iYXRjaCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9iYXRjaChhcnJheSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuLy9UT0RPOiByZW1vdmUgZnJvbSBoZXJlLCBub3QgYSBuZWNlc3NhcnkgcHJpbWl0aXZlXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuYXBwcm94aW1hdGVTaXplID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIGNhbGxiYWNrKSB7XG4gIGlmICggICBzdGFydCA9PSBudWxsXG4gICAgICB8fCBlbmQgPT0gbnVsbFxuICAgICAgfHwgdHlwZW9mIHN0YXJ0ID09ICdmdW5jdGlvbidcbiAgICAgIHx8IHR5cGVvZiBlbmQgPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYXBwcm94aW1hdGVTaXplKCkgcmVxdWlyZXMgdmFsaWQgYHN0YXJ0YCwgYGVuZGAgYW5kIGBjYWxsYmFja2AgYXJndW1lbnRzJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FwcHJveGltYXRlU2l6ZSgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuXG4gIGlmICghdGhpcy5faXNCdWZmZXIoc3RhcnQpKVxuICAgIHN0YXJ0ID0gU3RyaW5nKHN0YXJ0KVxuXG4gIGlmICghdGhpcy5faXNCdWZmZXIoZW5kKSlcbiAgICBlbmQgPSBTdHJpbmcoZW5kKVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fYXBwcm94aW1hdGVTaXplID09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIHRoaXMuX2FwcHJveGltYXRlU2l6ZShzdGFydCwgZW5kLCBjYWxsYmFjaylcblxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayhudWxsLCAwKVxuICB9KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX3NldHVwSXRlcmF0b3JPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgb3B0aW9ucyA9IHh0ZW5kKG9wdGlvbnMpXG5cbiAgO1sgJ3N0YXJ0JywgJ2VuZCcsICdndCcsICdndGUnLCAnbHQnLCAnbHRlJyBdLmZvckVhY2goZnVuY3Rpb24gKG8pIHtcbiAgICBpZiAob3B0aW9uc1tvXSAmJiBzZWxmLl9pc0J1ZmZlcihvcHRpb25zW29dKSAmJiBvcHRpb25zW29dLmxlbmd0aCA9PT0gMClcbiAgICAgIGRlbGV0ZSBvcHRpb25zW29dXG4gIH0pXG5cbiAgb3B0aW9ucy5yZXZlcnNlID0gISFvcHRpb25zLnJldmVyc2VcblxuICAvLyBmaXggYHN0YXJ0YCBzbyBpdCB0YWtlcyBpbnRvIGFjY291bnQgZ3QsIGd0ZSwgbHQsIGx0ZSBhcyBhcHByb3ByaWF0ZVxuICBpZiAob3B0aW9ucy5yZXZlcnNlICYmIG9wdGlvbnMubHQpXG4gICAgb3B0aW9ucy5zdGFydCA9IG9wdGlvbnMubHRcbiAgaWYgKG9wdGlvbnMucmV2ZXJzZSAmJiBvcHRpb25zLmx0ZSlcbiAgICBvcHRpb25zLnN0YXJ0ID0gb3B0aW9ucy5sdGVcbiAgaWYgKCFvcHRpb25zLnJldmVyc2UgJiYgb3B0aW9ucy5ndClcbiAgICBvcHRpb25zLnN0YXJ0ID0gb3B0aW9ucy5ndFxuICBpZiAoIW9wdGlvbnMucmV2ZXJzZSAmJiBvcHRpb25zLmd0ZSlcbiAgICBvcHRpb25zLnN0YXJ0ID0gb3B0aW9ucy5ndGVcblxuICBpZiAoKG9wdGlvbnMucmV2ZXJzZSAmJiBvcHRpb25zLmx0ICYmICFvcHRpb25zLmx0ZSlcbiAgICB8fCAoIW9wdGlvbnMucmV2ZXJzZSAmJiBvcHRpb25zLmd0ICYmICFvcHRpb25zLmd0ZSkpXG4gICAgb3B0aW9ucy5leGNsdXNpdmVTdGFydCA9IHRydWUgLy8gc3RhcnQgc2hvdWxkICpub3QqIGluY2x1ZGUgbWF0Y2hpbmcga2V5XG5cbiAgcmV0dXJuIG9wdGlvbnNcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLml0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIG9wdGlvbnMgPSB0aGlzLl9zZXR1cEl0ZXJhdG9yT3B0aW9ucyhvcHRpb25zKVxuXG4gIGlmICh0eXBlb2YgdGhpcy5faXRlcmF0b3IgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5faXRlcmF0b3Iob3B0aW9ucylcblxuICByZXR1cm4gbmV3IEFic3RyYWN0SXRlcmF0b3IodGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGFpbmVkQmF0Y2ggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgQWJzdHJhY3RDaGFpbmVkQmF0Y2godGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9pc0J1ZmZlciA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihvYmopXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2hlY2tLZXlWYWx1ZSA9IGZ1bmN0aW9uIChvYmosIHR5cGUpIHtcbiAgaWYgKG9iaiA9PT0gbnVsbCB8fCBvYmogPT09IHVuZGVmaW5lZClcbiAgICByZXR1cm4gbmV3IEVycm9yKHR5cGUgKyAnIGNhbm5vdCBiZSBgbnVsbGAgb3IgYHVuZGVmaW5lZGAnKVxuXG4gIGlmIChvYmogPT09IG51bGwgfHwgb2JqID09PSB1bmRlZmluZWQpXG4gICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYG51bGxgIG9yIGB1bmRlZmluZWRgJylcblxuICBpZiAodGhpcy5faXNCdWZmZXIob2JqKSkge1xuICAgIGlmIChvYmoubGVuZ3RoID09PSAwKVxuICAgICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYW4gZW1wdHkgQnVmZmVyJylcbiAgfSBlbHNlIGlmIChTdHJpbmcob2JqKSA9PT0gJycpXG4gICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYW4gZW1wdHkgU3RyaW5nJylcbn1cblxubW9kdWxlLmV4cG9ydHMuQWJzdHJhY3RMZXZlbERPV04gICAgPSBBYnN0cmFjdExldmVsRE9XTlxubW9kdWxlLmV4cG9ydHMuQWJzdHJhY3RJdGVyYXRvciAgICAgPSBBYnN0cmFjdEl0ZXJhdG9yXG5tb2R1bGUuZXhwb3J0cy5BYnN0cmFjdENoYWluZWRCYXRjaCA9IEFic3RyYWN0Q2hhaW5lZEJhdGNoXG4iLCIndXNlIHN0cmljdCc7XG4vLyB0YWtlbiBmcm9tIHJ2YWdnL21lbWRvd24gY29tbWl0IDIwNzhiNDBcbmV4cG9ydHMuc29ydGVkSW5kZXhPZiA9IGZ1bmN0aW9uKGFyciwgaXRlbSkge1xuICB2YXIgbG93ID0gMDtcbiAgdmFyIGhpZ2ggPSBhcnIubGVuZ3RoO1xuICB2YXIgbWlkO1xuICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgIG1pZCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcbiAgICBpZiAoYXJyW21pZF0gPCBpdGVtKSB7XG4gICAgICBsb3cgPSBtaWQgKyAxO1xuICAgIH0gZWxzZSB7XG4gICAgICBoaWdoID0gbWlkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbG93O1xufTtcbiIsIihmdW5jdGlvbiAocm9vdCkge1xuICB2YXIgbG9jYWxTdG9yYWdlTWVtb3J5ID0ge31cbiAgdmFyIGNhY2hlID0ge31cblxuICAvKipcbiAgICogbnVtYmVyIG9mIHN0b3JlZCBpdGVtcy5cbiAgICovXG4gIGxvY2FsU3RvcmFnZU1lbW9yeS5sZW5ndGggPSAwXG5cbiAgLyoqXG4gICAqIHJldHVybnMgaXRlbSBmb3IgcGFzc2VkIGtleSwgb3IgbnVsbFxuICAgKlxuICAgKiBAcGFyYSB7U3RyaW5nfSBrZXlcbiAgICogICAgICAgbmFtZSBvZiBpdGVtIHRvIGJlIHJldHVybmVkXG4gICAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAgICovXG4gIGxvY2FsU3RvcmFnZU1lbW9yeS5nZXRJdGVtID0gZnVuY3Rpb24gKGtleSkge1xuICAgIGlmIChrZXkgaW4gY2FjaGUpIHtcbiAgICAgIHJldHVybiBjYWNoZVtrZXldXG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIC8qKlxuICAgKiBzZXRzIGl0ZW0gZm9yIGtleSB0byBwYXNzZWQgdmFsdWUsIGFzIFN0cmluZ1xuICAgKlxuICAgKiBAcGFyYSB7U3RyaW5nfSBrZXlcbiAgICogICAgICAgbmFtZSBvZiBpdGVtIHRvIGJlIHNldFxuICAgKiBAcGFyYSB7U3RyaW5nfSB2YWx1ZVxuICAgKiAgICAgICB2YWx1ZSwgd2lsbCBhbHdheXMgYmUgdHVybmVkIGludG8gYSBTdHJpbmdcbiAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICovXG4gIGxvY2FsU3RvcmFnZU1lbW9yeS5zZXRJdGVtID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgbG9jYWxTdG9yYWdlTWVtb3J5LnJlbW92ZUl0ZW0oa2V5KVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIShjYWNoZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSkge1xuICAgICAgICBsb2NhbFN0b3JhZ2VNZW1vcnkubGVuZ3RoKytcbiAgICAgIH1cblxuICAgICAgY2FjaGVba2V5XSA9ICcnICsgdmFsdWVcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogcmVtb3ZlcyBpdGVtIGZvciBwYXNzZWQga2V5XG4gICAqXG4gICAqIEBwYXJhIHtTdHJpbmd9IGtleVxuICAgKiAgICAgICBuYW1lIG9mIGl0ZW0gdG8gYmUgcmVtb3ZlZFxuICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgKi9cbiAgbG9jYWxTdG9yYWdlTWVtb3J5LnJlbW92ZUl0ZW0gPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgaWYgKGNhY2hlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIGRlbGV0ZSBjYWNoZVtrZXldXG4gICAgICBsb2NhbFN0b3JhZ2VNZW1vcnkubGVuZ3RoLS1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogcmV0dXJucyBuYW1lIG9mIGtleSBhdCBwYXNzZWQgaW5kZXhcbiAgICpcbiAgICogQHBhcmEge051bWJlcn0gaW5kZXhcbiAgICogICAgICAgUG9zaXRpb24gZm9yIGtleSB0byBiZSByZXR1cm5lZCAoc3RhcnRzIGF0IDApXG4gICAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAgICovXG4gIGxvY2FsU3RvcmFnZU1lbW9yeS5rZXkgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoY2FjaGUpW2luZGV4XSB8fCBudWxsXG4gIH1cblxuICAvKipcbiAgICogcmVtb3ZlcyBhbGwgc3RvcmVkIGl0ZW1zIGFuZCBzZXRzIGxlbmd0aCB0byAwXG4gICAqXG4gICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAqL1xuICBsb2NhbFN0b3JhZ2VNZW1vcnkuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FjaGUgPSB7fVxuICAgIGxvY2FsU3RvcmFnZU1lbW9yeS5sZW5ndGggPSAwXG4gIH1cblxuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBsb2NhbFN0b3JhZ2VNZW1vcnlcbiAgfSBlbHNlIHtcbiAgICByb290LmxvY2FsU3RvcmFnZU1lbW9yeSA9IGxvY2FsU3RvcmFnZU1lbW9yeVxuICB9XG59KSh0aGlzKVxuIiwiLyoqXG4gKiAjIGhhc0xvY2FsU3RvcmFnZSgpXG4gKlxuICogcmV0dXJucyBgdHJ1ZWAgb3IgYGZhbHNlYCBkZXBlbmRpbmcgb24gd2hldGhlciBsb2NhbFN0b3JhZ2UgaXMgc3VwcG9ydGVkIG9yIG5vdC5cbiAqIEJld2FyZSB0aGF0IHNvbWUgYnJvd3NlcnMgbGlrZSBTYWZhcmkgZG8gbm90IHN1cHBvcnQgbG9jYWxTdG9yYWdlIGluIHByaXZhdGUgbW9kZS5cbiAqXG4gKiBpbnNwaXJlZCBieSB0aGlzIGNhcHB1Y2Npbm8gY29tbWl0XG4gKiBodHRwczovL2dpdGh1Yi5jb20vY2FwcHVjY2luby9jYXBwdWNjaW5vL2NvbW1pdC8wNjNiMDVkOTY0M2MzNWIzMDM1NjhhMjg4MDllNGViMzIyNGY3MWVjXG4gKlxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbmZ1bmN0aW9uIGhhc0xvY2FsU3RvcmFnZSgpIHtcbiAgdHJ5IHtcblxuICAgIC8vIHdlJ3ZlIHRvIHB1dCB0aGlzIGluIGhlcmUuIEkndmUgc2VlbiBGaXJlZm94IHRocm93aW5nIGBTZWN1cml0eSBlcnJvcjogMTAwMGBcbiAgICAvLyB3aGVuIGNvb2tpZXMgaGF2ZSBiZWVuIGRpc2FibGVkXG4gICAgaWYgKHR5cGVvZiBsb2NhbFN0b3JhZ2UgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gSnVzdCBiZWNhdXNlIGxvY2FsU3RvcmFnZSBleGlzdHMgZG9lcyBub3QgbWVhbiBpdCB3b3Jrcy4gSW4gcGFydGljdWxhciBpdCBtaWdodCBiZSBkaXNhYmxlZFxuICAgIC8vIGFzIGl0IGlzIHdoZW4gU2FmYXJpJ3MgcHJpdmF0ZSBicm93c2luZyBtb2RlIGlzIGFjdGl2ZS5cbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnU3RvcmFnZS1UZXN0JywgJzEnKTtcblxuICAgIC8vIHRoYXQgc2hvdWxkIG5vdCBoYXBwZW4gLi4uXG4gICAgaWYgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdTdG9yYWdlLVRlc3QnKSAhPT0gJzEnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gb2theSwgbGV0J3MgY2xlYW4gdXAgaWYgd2UgZ290IGhlcmUuXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ1N0b3JhZ2UtVGVzdCcpO1xuICB9IGNhdGNoIChfZXJyb3IpIHtcblxuICAgIC8vIGluIGNhc2Ugb2YgYW4gZXJyb3IsIGxpa2UgU2FmYXJpJ3MgUHJpdmF0ZSBNb2RlLCByZXR1cm4gZmFsc2VcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyB3ZSdyZSBnb29kLlxuICByZXR1cm4gdHJ1ZTtcbn1cblxuXG5pZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gaGFzTG9jYWxTdG9yYWdlO1xufVxuIiwidmFyIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIGxvY2FsU3RvcmFnZU1lbW9yeSA9IHJlcXVpcmUoJ2xvY2Fsc3RvcmFnZS1tZW1vcnknKTtcbmV4cG9ydHMuaGFzTG9jYWxTdG9yYWdlID0gcmVxdWlyZSgnaGFzLWxvY2Fsc3RvcmFnZScpO1xuXG4vKipcbiAqIHJldHVybnMgbG9jYWxTdG9yYWdlLWNvbXBhdGlibGUgQVBJLCBlaXRoZXIgYmFja2VkIGJ5IHdpbmRvdy5sb2NhbFN0b3JhZ2VcbiAqIG9yIG1lbW9yeSBpZiBpdCdzIG5vdCBhdmFpbGFibGUgb3Igbm90IHBlcnNpc3RlbnQuXG4gKlxuICogSXQgYWxzbyBhZGRzIGFuIG9iamVjdCBBUEkgKGAuZ2V0T2JqZWN0KGtleSlgLFxuICogYC5zZXRPYmplY3Qoa2V5LCBwcm9wZXJ0aWVzKWApIGFuZCBhIGBpc1ByZXNpc3RlbnRgIHByb3BlcnR5XG4gKlxuICogQHJldHVybnMge09iamVjdH1cbiAqL1xuZXhwb3J0cy5jcmVhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBhcGk7XG5cbiAgaWYgKCFleHBvcnRzLmhhc0xvY2FsU3RvcmFnZSgpKSB7XG4gICAgYXBpID0gbG9jYWxTdG9yYWdlTWVtb3J5O1xuICAgIGFwaS5pc1BlcnNpc3RlbnQgPSBmYWxzZTtcbiAgfSBlbHNlIHtcbiAgICBhcGkgPSBnbG9iYWwubG9jYWxTdG9yYWdlO1xuICAgIGFwaSA9IHtcbiAgICAgIGdldCBsZW5ndGgoKSB7IHJldHVybiBnbG9iYWwubG9jYWxTdG9yYWdlLmxlbmd0aDsgfSxcbiAgICAgIGdldEl0ZW06IGdsb2JhbC5sb2NhbFN0b3JhZ2UuZ2V0SXRlbS5iaW5kKGdsb2JhbC5sb2NhbFN0b3JhZ2UpLFxuICAgICAgc2V0SXRlbTogZ2xvYmFsLmxvY2FsU3RvcmFnZS5zZXRJdGVtLmJpbmQoZ2xvYmFsLmxvY2FsU3RvcmFnZSksXG4gICAgICByZW1vdmVJdGVtOiBnbG9iYWwubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0uYmluZChnbG9iYWwubG9jYWxTdG9yYWdlKSxcbiAgICAgIGtleTogZ2xvYmFsLmxvY2FsU3RvcmFnZS5rZXkuYmluZChnbG9iYWwubG9jYWxTdG9yYWdlKSxcbiAgICAgIGNsZWFyOiBnbG9iYWwubG9jYWxTdG9yYWdlLmNsZWFyLmJpbmQoZ2xvYmFsLmxvY2FsU3RvcmFnZSksXG4gICAgfTtcblxuICAgIGFwaS5pc1BlcnNpc3RlbnQgPSB0cnVlO1xuICB9XG5cbiAgYXBpLmdldE9iamVjdCA9IGV4cG9ydHMuZ2V0T2JqZWN0LmJpbmQobnVsbCwgYXBpKTtcbiAgYXBpLnNldE9iamVjdCA9IGV4cG9ydHMuc2V0T2JqZWN0LmJpbmQobnVsbCwgYXBpKTtcblxuICByZXR1cm4gYXBpO1xufTtcblxuLyoqXG4gKiBzZXRzIGtleSB0byBwYXNzZWQgT2JqZWN0LlxuICpcbiAqIEByZXR1cm5zIHVuZGVmaW5lZFxuICovXG5leHBvcnRzLnNldE9iamVjdCA9IGZ1bmN0aW9uIChzdG9yZSwga2V5LCBvYmplY3QpIHtcbiAgaWYgKHR5cGVvZiBvYmplY3QgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIHN0b3JlLnNldEl0ZW0oa2V5LCBvYmplY3QpO1xuICB9XG5cbiAgcmV0dXJuIHN0b3JlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShvYmplY3QpKTtcbn07XG5cbi8qKlxuICogcmV0dXJucyBPYmplY3QgZm9yIGtleSwgb3IgbnVsbFxuICpcbiAqIEByZXR1cm5zIHtPYmplY3R8bnVsbH1cbiAqL1xuZXhwb3J0cy5nZXRPYmplY3QgPSBmdW5jdGlvbiAoc3RvcmUsIGtleSkge1xuICB2YXIgaXRlbSA9IHN0b3JlLmdldEl0ZW0oa2V5KTtcblxuICBpZiAoIWl0ZW0pIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoaXRlbSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gaXRlbTtcbiAgfVxufTtcbiIsInZhciBhcGkgPSByZXF1aXJlKCcuL2FwaScpO1xubW9kdWxlLmV4cG9ydHMgPSBhcGkuY3JlYXRlKCk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vXG4vLyBDbGFzcyB0aGF0IHNob3VsZCBjb250YWluIGV2ZXJ5dGhpbmcgbmVjZXNzYXJ5IHRvIGludGVyYWN0XG4vLyB3aXRoIGxvY2FsU3RvcmFnZSBhcyBhIGdlbmVyaWMga2V5LXZhbHVlIHN0b3JlLlxuLy8gVGhlIGlkZWEgaXMgdGhhdCBhdXRob3JzIHdobyB3YW50IHRvIGNyZWF0ZSBhbiBBYnN0cmFjdEtleVZhbHVlRE9XTlxuLy8gbW9kdWxlIChlLmcuIG9uIGxhd25jaGFpciwgUzMsIHdoYXRldmVyKSB3aWxsIG9ubHkgaGF2ZSB0b1xuLy8gcmVpbXBsZW1lbnQgdGhpcyBmaWxlLlxuLy9cblxuLy8gc2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE1MzQ5ODY1LzY4MDc0MlxudmFyIG5leHRUaWNrID0gZ2xvYmFsLnNldEltbWVkaWF0ZSB8fCBwcm9jZXNzLm5leHRUaWNrO1xuXG4vLyBXZSB1c2UgaHVtYmxlLWxvY2Fsc3RvcmFnZSBhcyBhIHdyYXBwZXIgZm9yIGxvY2FsU3RvcmFnZSBiZWNhdXNlXG4vLyBpdCBmYWxscyBiYWNrIHRvIGFuIGluLW1lbW9yeSBpbXBsZW1lbnRhdGlvbiBpbiBlbnZpcm9ubWVudHMgd2l0aG91dFxuLy8gbG9jYWxTdG9yYWdlLCBsaWtlIE5vZGUgb3IgU2FmYXJpIHByaXZhdGUgYnJvd3NpbmcuXG52YXIgc3RvcmFnZSA9IHJlcXVpcmUoJ2h1bWJsZS1sb2NhbHN0b3JhZ2UnKTtcblxuZnVuY3Rpb24gY2FsbGJhY2tpZnkoY2FsbGJhY2ssIGZ1bikge1xuICB2YXIgdmFsO1xuICB2YXIgZXJyO1xuICB0cnkge1xuICAgIHZhbCA9IGZ1bigpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZXJyID0gZTtcbiAgfVxuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soZXJyLCB2YWwpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUHJlZml4KGRibmFtZSkge1xuICByZXR1cm4gZGJuYW1lLnJlcGxhY2UoLyEvZywgJyEhJykgKyAnISc7IC8vIGVzY2FwZSBiYW5ncyBpbiBkYm5hbWU7XG59XG5cbmZ1bmN0aW9uIExvY2FsU3RvcmFnZUNvcmUoZGJuYW1lKSB7XG4gIHRoaXMuX3ByZWZpeCA9IGNyZWF0ZVByZWZpeChkYm5hbWUpO1xufVxuXG5Mb2NhbFN0b3JhZ2VDb3JlLnByb3RvdHlwZS5nZXRLZXlzID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2FsbGJhY2tpZnkoY2FsbGJhY2ssIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciBwcmVmaXhMZW4gPSBzZWxmLl9wcmVmaXgubGVuZ3RoO1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHN0b3JhZ2UubGVuZ3RoO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIHZhciBmdWxsS2V5ID0gc3RvcmFnZS5rZXkoaSk7XG4gICAgICBpZiAoZnVsbEtleS5zdWJzdHJpbmcoMCwgcHJlZml4TGVuKSA9PT0gc2VsZi5fcHJlZml4KSB7XG4gICAgICAgIGtleXMucHVzaChmdWxsS2V5LnN1YnN0cmluZyhwcmVmaXhMZW4pKTtcbiAgICAgIH1cbiAgICB9XG4gICAga2V5cy5zb3J0KCk7XG4gICAgcmV0dXJuIGtleXM7XG4gIH0pO1xufTtcblxuTG9jYWxTdG9yYWdlQ29yZS5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2FsbGJhY2tpZnkoY2FsbGJhY2ssIGZ1bmN0aW9uICgpIHtcbiAgICBzdG9yYWdlLnNldEl0ZW0oc2VsZi5fcHJlZml4ICsga2V5LCB2YWx1ZSk7XG4gIH0pO1xufTtcblxuTG9jYWxTdG9yYWdlQ29yZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBjYWxsYmFja2lmeShjYWxsYmFjaywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBzdG9yYWdlLmdldEl0ZW0oc2VsZi5fcHJlZml4ICsga2V5KTtcbiAgfSk7XG59O1xuXG5Mb2NhbFN0b3JhZ2VDb3JlLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoa2V5LCBjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGNhbGxiYWNraWZ5KGNhbGxiYWNrLCBmdW5jdGlvbiAoKSB7XG4gICAgc3RvcmFnZS5yZW1vdmVJdGVtKHNlbGYuX3ByZWZpeCArIGtleSk7XG4gIH0pO1xufTtcblxuTG9jYWxTdG9yYWdlQ29yZS5kZXN0cm95ID0gZnVuY3Rpb24gKGRibmFtZSwgY2FsbGJhY2spIHtcbiAgdmFyIHByZWZpeCA9IGNyZWF0ZVByZWZpeChkYm5hbWUpO1xuICBjYWxsYmFja2lmeShjYWxsYmFjaywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBrZXlzVG9EZWxldGUgPSBbXTtcbiAgICB2YXIgaSA9IC0xO1xuICAgIHZhciBsZW4gPSBzdG9yYWdlLmxlbmd0aDtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICB2YXIga2V5ID0gc3RvcmFnZS5rZXkoaSk7XG4gICAgICBpZiAoa2V5LnN1YnN0cmluZygwLCBwcmVmaXgubGVuZ3RoKSA9PT0gcHJlZml4KSB7XG4gICAgICAgIGtleXNUb0RlbGV0ZS5wdXNoKGtleSk7XG4gICAgICB9XG4gICAgfVxuICAgIGtleXNUb0RlbGV0ZS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTG9jYWxTdG9yYWdlQ29yZTsiLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gYXJnc0FycmF5O1xuXG5mdW5jdGlvbiBhcmdzQXJyYXkoZnVuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgaWYgKGxlbikge1xuICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgIHZhciBpID0gLTE7XG4gICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmdW4uY2FsbCh0aGlzLCBbXSk7XG4gICAgfVxuICB9O1xufSIsIid1c2Ugc3RyaWN0JztcblxuLy8gU2ltcGxlIEZJRk8gcXVldWUgaW1wbGVtZW50YXRpb24gdG8gYXZvaWQgaGF2aW5nIHRvIGRvIHNoaWZ0KClcbi8vIG9uIGFuIGFycmF5LCB3aGljaCBpcyBzbG93LlxuXG5mdW5jdGlvbiBRdWV1ZSgpIHtcbiAgdGhpcy5sZW5ndGggPSAwO1xufVxuXG5RdWV1ZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChpdGVtKSB7XG4gIHZhciBub2RlID0ge2l0ZW06IGl0ZW19O1xuICBpZiAodGhpcy5sYXN0KSB7XG4gICAgdGhpcy5sYXN0ID0gdGhpcy5sYXN0Lm5leHQgPSBub2RlO1xuICB9IGVsc2Uge1xuICAgIHRoaXMubGFzdCA9IHRoaXMuZmlyc3QgPSBub2RlO1xuICB9XG4gIHRoaXMubGVuZ3RoKys7XG59O1xuXG5RdWV1ZS5wcm90b3R5cGUuc2hpZnQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBub2RlID0gdGhpcy5maXJzdDtcbiAgaWYgKG5vZGUpIHtcbiAgICB0aGlzLmZpcnN0ID0gbm9kZS5uZXh0O1xuICAgIGlmICghKC0tdGhpcy5sZW5ndGgpKSB7XG4gICAgICB0aGlzLmxhc3QgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBub2RlLml0ZW07XG4gIH1cbn07XG5cblF1ZXVlLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHN0YXJ0ID0gdHlwZW9mIHN0YXJ0ID09PSAndW5kZWZpbmVkJyA/IDAgOiBzdGFydDtcbiAgZW5kID0gdHlwZW9mIGVuZCA9PT0gJ3VuZGVmaW5lZCcgPyBJbmZpbml0eSA6IGVuZDtcblxuICB2YXIgb3V0cHV0ID0gW107XG5cbiAgdmFyIGkgPSAwO1xuICBmb3IgKHZhciBub2RlID0gdGhpcy5maXJzdDsgbm9kZTsgbm9kZSA9IG5vZGUubmV4dCkge1xuICAgIGlmICgtLWVuZCA8IDApIHtcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSBpZiAoKytpID4gc3RhcnQpIHtcbiAgICAgIG91dHB1dC5wdXNoKG5vZGUuaXRlbSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKTtcbnZhciBRdWV1ZSA9IHJlcXVpcmUoJ3RpbnktcXVldWUnKTtcblxuLy8gc2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE1MzQ5ODY1LzY4MDc0MlxudmFyIG5leHRUaWNrID0gZ2xvYmFsLnNldEltbWVkaWF0ZSB8fCBwcm9jZXNzLm5leHRUaWNrO1xuXG5mdW5jdGlvbiBUYXNrUXVldWUoKSB7XG4gIHRoaXMucXVldWUgPSBuZXcgUXVldWUoKTtcbiAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG59XG5cblRhc2tRdWV1ZS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKGZ1biwgY2FsbGJhY2spIHtcbiAgdGhpcy5xdWV1ZS5wdXNoKHtmdW46IGZ1biwgY2FsbGJhY2s6IGNhbGxiYWNrfSk7XG4gIHRoaXMucHJvY2Vzc05leHQoKTtcbn07XG5cblRhc2tRdWV1ZS5wcm90b3R5cGUucHJvY2Vzc05leHQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgaWYgKHNlbGYucnVubmluZyB8fCAhc2VsZi5xdWV1ZS5sZW5ndGgpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2VsZi5ydW5uaW5nID0gdHJ1ZTtcblxuICB2YXIgdGFzayA9IHNlbGYucXVldWUuc2hpZnQoKTtcbiAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgIHRhc2suZnVuKGFyZ3NhcnJheShmdW5jdGlvbiAoYXJncykge1xuICAgICAgdGFzay5jYWxsYmFjay5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIHNlbGYucnVubmluZyA9IGZhbHNlO1xuICAgICAgc2VsZi5wcm9jZXNzTmV4dCgpO1xuICAgIH0pKTtcbiAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRhc2tRdWV1ZTtcbiIsInZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXJcblxudmFyIENIQVJTID0gJy5QWUZHQ1JMQU9FVUlESFROU1FKS1hCTVdWWl9weWZnY3JsYW9ldWlkaHRuc3Fqa3hibXd2ejEyMzQ1Njc4OTAnXG4gIC5zcGxpdCgnJykuc29ydCgpLmpvaW4oJycpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNoYXJzLCBleHBvcnRzKSB7XG4gIGNoYXJzID0gY2hhcnMgfHwgQ0hBUlNcbiAgZXhwb3J0cyA9IGV4cG9ydHMgfHwge31cbiAgaWYoY2hhcnMubGVuZ3RoICE9PSA2NCkgdGhyb3cgbmV3IEVycm9yKCdhIGJhc2UgNjQgZW5jb2RpbmcgcmVxdWlyZXMgNjQgY2hhcnMnKVxuXG4gIHZhciBjb2RlVG9JbmRleCA9IG5ldyBCdWZmZXIoMTI4KVxuICBjb2RlVG9JbmRleC5maWxsKClcblxuICBmb3IodmFyIGkgPSAwOyBpIDwgNjQ7IGkrKykge1xuICAgIHZhciBjb2RlID0gY2hhcnMuY2hhckNvZGVBdChpKVxuICAgIGNvZGVUb0luZGV4W2NvZGVdID0gaVxuICB9XG5cbiAgZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgdmFyIHMgPSAnJywgbCA9IGRhdGEubGVuZ3RoLCBoYW5nID0gMFxuICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIgdiA9IGRhdGFbaV1cblxuICAgICAgICBzd2l0Y2ggKGkgJSAzKSB7XG4gICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgcyArPSBjaGFyc1t2ID4+IDJdXG4gICAgICAgICAgICBoYW5nID0gKHYgJiAzKSA8PCA0XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgcyArPSBjaGFyc1toYW5nIHwgdiA+PiA0XVxuICAgICAgICAgICAgaGFuZyA9ICh2ICYgMHhmKSA8PCAyXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgcyArPSBjaGFyc1toYW5nIHwgdiA+PiA2XVxuICAgICAgICAgICAgcyArPSBjaGFyc1t2ICYgMHgzZl1cbiAgICAgICAgICAgIGhhbmcgPSAwXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgfVxuICAgICAgaWYobCUzKSBzICs9IGNoYXJzW2hhbmddXG4gICAgICByZXR1cm4gc1xuICAgIH1cbiAgZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgICB2YXIgbCA9IHN0ci5sZW5ndGgsIGogPSAwXG4gICAgICB2YXIgYiA9IG5ldyBCdWZmZXIofn4oKGwvNCkqMykpLCBoYW5nID0gMFxuXG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciB2ID0gY29kZVRvSW5kZXhbc3RyLmNoYXJDb2RlQXQoaSldXG5cbiAgICAgICAgc3dpdGNoIChpICUgNCkge1xuICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgIGhhbmcgPSB2IDw8IDI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgYltqKytdID0gaGFuZyB8IHYgPj4gNFxuICAgICAgICAgICAgaGFuZyA9ICh2IDw8IDQpICYgMHhmZlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIGJbaisrXSA9IGhhbmcgfCB2ID4+IDJcbiAgICAgICAgICAgIGhhbmcgPSAodiA8PCA2KSAmIDB4ZmZcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBiW2orK10gPSBoYW5nIHwgdlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgIH1cbiAgICAgIHJldHVybiBiXG4gICAgfVxuICByZXR1cm4gZXhwb3J0c1xufVxuXG5tb2R1bGUuZXhwb3J0cyhDSEFSUywgbW9kdWxlLmV4cG9ydHMpXG5cbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gQXJyYXlCdWZmZXIvVWludDhBcnJheSBhcmUgb2xkIGZvcm1hdHMgdGhhdCBkYXRlIGJhY2sgdG8gYmVmb3JlIHdlXG4vLyBoYWQgYSBwcm9wZXIgYnJvd3NlcmlmaWVkIGJ1ZmZlciB0eXBlLiB0aGV5IG1heSBiZSByZW1vdmVkIGxhdGVyXG52YXIgYXJyYXlCdWZmUHJlZml4ID0gJ0FycmF5QnVmZmVyOic7XG52YXIgYXJyYXlCdWZmUmVnZXggPSBuZXcgUmVnRXhwKCdeJyArIGFycmF5QnVmZlByZWZpeCk7XG52YXIgdWludFByZWZpeCA9ICdVaW50OEFycmF5Oic7XG52YXIgdWludFJlZ2V4ID0gbmV3IFJlZ0V4cCgnXicgKyB1aW50UHJlZml4KTtcblxuLy8gdGhpcyBpcyB0aGUgbmV3IGVuY29kaW5nIGZvcm1hdCB1c2VkIGdvaW5nIGZvcndhcmRcbnZhciBidWZmZXJQcmVmaXggPSAnQnVmZjonO1xudmFyIGJ1ZmZlclJlZ2V4ID0gbmV3IFJlZ0V4cCgnXicgKyBidWZmZXJQcmVmaXgpO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgTG9jYWxTdG9yYWdlQ29yZSA9IHJlcXVpcmUoJy4vbG9jYWxzdG9yYWdlLWNvcmUnKTtcbnZhciBUYXNrUXVldWUgPSByZXF1aXJlKCcuL3Rhc2txdWV1ZScpO1xudmFyIGQ2NCA9IHJlcXVpcmUoJ2Q2NCcpO1xuXG5mdW5jdGlvbiBMb2NhbFN0b3JhZ2UoZGJuYW1lKSB7XG4gIHRoaXMuX3N0b3JlID0gbmV3IExvY2FsU3RvcmFnZUNvcmUoZGJuYW1lKTtcbiAgdGhpcy5fcXVldWUgPSBuZXcgVGFza1F1ZXVlKCk7XG59XG5cbkxvY2FsU3RvcmFnZS5wcm90b3R5cGUuc2VxdWVudGlhbGl6ZSA9IGZ1bmN0aW9uIChjYWxsYmFjaywgZnVuKSB7XG4gIHRoaXMuX3F1ZXVlLmFkZChmdW4sIGNhbGxiYWNrKTtcbn07XG5cbkxvY2FsU3RvcmFnZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuc2VxdWVudGlhbGl6ZShjYWxsYmFjaywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgc2VsZi5fc3RvcmUuZ2V0S2V5cyhmdW5jdGlvbiAoZXJyLCBrZXlzKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgICAgc2VsZi5fa2V5cyA9IGtleXM7XG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG5Mb2NhbFN0b3JhZ2UucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLnNlcXVlbnRpYWxpemUoY2FsbGJhY2ssIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHNlbGYuX3N0b3JlLmdldEtleXMoZnVuY3Rpb24gKGVyciwga2V5cykge1xuICAgICAgY2FsbGJhY2sobnVsbCwga2V5cy5zbGljZSgpKTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vL3NldEl0ZW06IFNhdmVzIGFuZCBpdGVtIGF0IHRoZSBrZXkgcHJvdmlkZWQuXG5Mb2NhbFN0b3JhZ2UucHJvdG90eXBlLnNldEl0ZW0gPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLnNlcXVlbnRpYWxpemUoY2FsbGJhY2ssIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsdWUpKSB7XG4gICAgICB2YWx1ZSA9IGJ1ZmZlclByZWZpeCArIGQ2NC5lbmNvZGUodmFsdWUpO1xuICAgIH1cblxuICAgIHZhciBpZHggPSB1dGlscy5zb3J0ZWRJbmRleE9mKHNlbGYuX2tleXMsIGtleSk7XG4gICAgaWYgKHNlbGYuX2tleXNbaWR4XSAhPT0ga2V5KSB7XG4gICAgICBzZWxmLl9rZXlzLnNwbGljZShpZHgsIDAsIGtleSk7XG4gICAgfVxuICAgIHNlbGYuX3N0b3JlLnB1dChrZXksIHZhbHVlLCBjYWxsYmFjayk7XG4gIH0pO1xufTtcblxuLy9nZXRJdGVtOiBSZXR1cm5zIHRoZSBpdGVtIGlkZW50aWZpZWQgYnkgaXQncyBrZXkuXG5Mb2NhbFN0b3JhZ2UucHJvdG90eXBlLmdldEl0ZW0gPSBmdW5jdGlvbiAoa2V5LCBjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuc2VxdWVudGlhbGl6ZShjYWxsYmFjaywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgc2VsZi5fc3RvcmUuZ2V0KGtleSwgZnVuY3Rpb24gKGVyciwgcmV0dmFsKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiByZXR2YWwgPT09ICd1bmRlZmluZWQnIHx8IHJldHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAvLyAnTm90Rm91bmQnIGVycm9yLCBjb25zaXN0ZW50IHdpdGggTGV2ZWxET1dOIEFQSVxuICAgICAgICByZXR1cm4gY2FsbGJhY2sobmV3IEVycm9yKCdOb3RGb3VuZCcpKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgcmV0dmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAoYnVmZmVyUmVnZXgudGVzdChyZXR2YWwpKSB7XG4gICAgICAgICAgcmV0dmFsID0gZDY0LmRlY29kZShyZXR2YWwuc3Vic3RyaW5nKGJ1ZmZlclByZWZpeC5sZW5ndGgpKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcnJheUJ1ZmZSZWdleC50ZXN0KHJldHZhbCkpIHtcbiAgICAgICAgICAvLyB0aGlzIHR5cGUgaXMga2VwdCBmb3IgYmFja3dhcmRzXG4gICAgICAgICAgLy8gY29tcGF0aWJpbGl0eSB3aXRoIG9sZGVyIGRhdGFiYXNlcywgYnV0IG1heSBiZSByZW1vdmVkXG4gICAgICAgICAgLy8gYWZ0ZXIgYSBtYWpvciB2ZXJzaW9uIGJ1bXBcbiAgICAgICAgICByZXR2YWwgPSByZXR2YWwuc3Vic3RyaW5nKGFycmF5QnVmZlByZWZpeC5sZW5ndGgpO1xuICAgICAgICAgIHJldHZhbCA9IG5ldyBBcnJheUJ1ZmZlcihhdG9iKHJldHZhbCkuc3BsaXQoJycpLm1hcChmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgcmV0dXJuIGMuY2hhckNvZGVBdCgwKTtcbiAgICAgICAgICB9KSk7XG4gICAgICAgIH0gZWxzZSBpZiAodWludFJlZ2V4LnRlc3QocmV0dmFsKSkge1xuICAgICAgICAgIC8vIGRpdHRvXG4gICAgICAgICAgcmV0dmFsID0gcmV0dmFsLnN1YnN0cmluZyh1aW50UHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgcmV0dmFsID0gbmV3IFVpbnQ4QXJyYXkoYXRvYihyZXR2YWwpLnNwbGl0KCcnKS5tYXAoZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIHJldHVybiBjLmNoYXJDb2RlQXQoMCk7XG4gICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCByZXR2YWwpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8vcmVtb3ZlSXRlbTogUmVtb3ZlcyB0aGUgaXRlbSBpZGVudGlmaWVkIGJ5IGl0J3Mga2V5LlxuTG9jYWxTdG9yYWdlLnByb3RvdHlwZS5yZW1vdmVJdGVtID0gZnVuY3Rpb24gKGtleSwgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLnNlcXVlbnRpYWxpemUoY2FsbGJhY2ssIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBpZHggPSB1dGlscy5zb3J0ZWRJbmRleE9mKHNlbGYuX2tleXMsIGtleSk7XG4gICAgaWYgKHNlbGYuX2tleXNbaWR4XSA9PT0ga2V5KSB7XG4gICAgICBzZWxmLl9rZXlzLnNwbGljZShpZHgsIDEpO1xuICAgICAgc2VsZi5fc3RvcmUucmVtb3ZlKGtleSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5Mb2NhbFN0b3JhZ2UucHJvdG90eXBlLmxlbmd0aCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuc2VxdWVudGlhbGl6ZShjYWxsYmFjaywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgc2VsZi5fa2V5cy5sZW5ndGgpO1xuICB9KTtcbn07XG5cbmV4cG9ydHMuTG9jYWxTdG9yYWdlID0gTG9jYWxTdG9yYWdlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xudmFyIGJ1ZmZlckZyb20gPSByZXF1aXJlKCdidWZmZXItZnJvbScpO1xudmFyIEFic3RyYWN0TGV2ZWxET1dOID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RMZXZlbERPV047XG52YXIgQWJzdHJhY3RJdGVyYXRvciA9IHJlcXVpcmUoJ2Fic3RyYWN0LWxldmVsZG93bicpLkFic3RyYWN0SXRlcmF0b3I7XG5cbnZhciBMb2NhbFN0b3JhZ2UgPSByZXF1aXJlKCcuL2xvY2Fsc3RvcmFnZScpLkxvY2FsU3RvcmFnZTtcbnZhciBMb2NhbFN0b3JhZ2VDb3JlID0gcmVxdWlyZSgnLi9sb2NhbHN0b3JhZ2UtY29yZScpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG4vLyBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTUzNDk4NjUvNjgwNzQyXG52YXIgbmV4dFRpY2sgPSBnbG9iYWwuc2V0SW1tZWRpYXRlIHx8IHByb2Nlc3MubmV4dFRpY2s7XG5cbmZ1bmN0aW9uIExESXRlcmF0b3IoZGIsIG9wdGlvbnMpIHtcblxuICBBYnN0cmFjdEl0ZXJhdG9yLmNhbGwodGhpcywgZGIpO1xuXG4gIHRoaXMuX3JldmVyc2UgPSAhIW9wdGlvbnMucmV2ZXJzZTtcbiAgdGhpcy5fZW5ka2V5ICAgICA9IG9wdGlvbnMuZW5kO1xuICB0aGlzLl9zdGFydGtleSAgID0gb3B0aW9ucy5zdGFydDtcbiAgdGhpcy5fZ3QgICAgICA9IG9wdGlvbnMuZ3Q7XG4gIHRoaXMuX2d0ZSAgICAgPSBvcHRpb25zLmd0ZTtcbiAgdGhpcy5fbHQgICAgICA9IG9wdGlvbnMubHQ7XG4gIHRoaXMuX2x0ZSAgICAgPSBvcHRpb25zLmx0ZTtcbiAgdGhpcy5fZXhjbHVzaXZlU3RhcnQgPSBvcHRpb25zLmV4Y2x1c2l2ZVN0YXJ0O1xuICB0aGlzLl9rZXlzT25seSA9IG9wdGlvbnMudmFsdWVzID09PSBmYWxzZTtcbiAgdGhpcy5fbGltaXQgPSBvcHRpb25zLmxpbWl0O1xuICB0aGlzLl9jb3VudCA9IDA7XG5cbiAgdGhpcy5vbkluaXRDb21wbGV0ZUxpc3RlbmVycyA9IFtdO1xufVxuXG5pbmhlcml0cyhMREl0ZXJhdG9yLCBBYnN0cmFjdEl0ZXJhdG9yKTtcblxuTERJdGVyYXRvci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgIGNhbGxiYWNrKCk7XG4gIH0pO1xufTtcblxuTERJdGVyYXRvci5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGZ1bmN0aW9uIG9uSW5pdENvbXBsZXRlKCkge1xuICAgIGlmIChzZWxmLl9wb3MgPT09IHNlbGYuX2tleXMubGVuZ3RoIHx8IHNlbGYuX3BvcyA8IDApIHsgLy8gZG9uZSByZWFkaW5nXG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICB2YXIga2V5ID0gc2VsZi5fa2V5c1tzZWxmLl9wb3NdO1xuXG4gICAgaWYgKCEhc2VsZi5fZW5ka2V5ICYmIChzZWxmLl9yZXZlcnNlID8ga2V5IDwgc2VsZi5fZW5ka2V5IDoga2V5ID4gc2VsZi5fZW5ka2V5KSkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgaWYgKCEhc2VsZi5fbGltaXQgJiYgc2VsZi5fbGltaXQgPiAwICYmIHNlbGYuX2NvdW50KysgPj0gc2VsZi5fbGltaXQpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH1cblxuICAgIGlmICgoc2VsZi5fbHQgICYmIGtleSA+PSBzZWxmLl9sdCkgfHxcbiAgICAgIChzZWxmLl9sdGUgJiYga2V5ID4gc2VsZi5fbHRlKSB8fFxuICAgICAgKHNlbGYuX2d0ICAmJiBrZXkgPD0gc2VsZi5fZ3QpIHx8XG4gICAgICAoc2VsZi5fZ3RlICYmIGtleSA8IHNlbGYuX2d0ZSkpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH1cblxuICAgIHNlbGYuX3BvcyArPSBzZWxmLl9yZXZlcnNlID8gLTEgOiAxO1xuICAgIGlmIChzZWxmLl9rZXlzT25seSkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIGtleSk7XG4gICAgfVxuXG4gICAgc2VsZi5kYi5jb250YWluZXIuZ2V0SXRlbShrZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIubWVzc2FnZSA9PT0gJ05vdEZvdW5kJykge1xuICAgICAgICAgIHJldHVybiBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLl9uZXh0KGNhbGxiYWNrKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKG51bGwsIGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG4gIGlmICghc2VsZi5pbml0U3RhcnRlZCkge1xuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5pbml0U3RhcnRlZCA9IHRydWU7XG4gICAgICBzZWxmLl9pbml0KGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuZGIuY29udGFpbmVyLmtleXMoZnVuY3Rpb24gKGVyciwga2V5cykge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLl9rZXlzID0ga2V5cztcbiAgICAgICAgICBpZiAoc2VsZi5fc3RhcnRrZXkpIHtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHV0aWxzLnNvcnRlZEluZGV4T2Yoc2VsZi5fa2V5cywgc2VsZi5fc3RhcnRrZXkpO1xuICAgICAgICAgICAgdmFyIHN0YXJ0a2V5ID0gKGluZGV4ID49IHNlbGYuX2tleXMubGVuZ3RoIHx8IGluZGV4IDwgMCkgP1xuICAgICAgICAgICAgICB1bmRlZmluZWQgOiBzZWxmLl9rZXlzW2luZGV4XTtcbiAgICAgICAgICAgIHNlbGYuX3BvcyA9IGluZGV4O1xuICAgICAgICAgICAgaWYgKHNlbGYuX3JldmVyc2UpIHtcbiAgICAgICAgICAgICAgaWYgKHNlbGYuX2V4Y2x1c2l2ZVN0YXJ0IHx8IHN0YXJ0a2V5ICE9PSBzZWxmLl9zdGFydGtleSkge1xuICAgICAgICAgICAgICAgIHNlbGYuX3Bvcy0tO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNlbGYuX2V4Y2x1c2l2ZVN0YXJ0ICYmIHN0YXJ0a2V5ID09PSBzZWxmLl9zdGFydGtleSkge1xuICAgICAgICAgICAgICBzZWxmLl9wb3MrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5fcG9zID0gc2VsZi5fcmV2ZXJzZSA/IHNlbGYuX2tleXMubGVuZ3RoIC0gMSA6IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9uSW5pdENvbXBsZXRlKCk7XG5cbiAgICAgICAgICBzZWxmLmluaXRDb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICAgIHZhciBpID0gLTE7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IHNlbGYub25Jbml0Q29tcGxldGVMaXN0ZW5lcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBuZXh0VGljayhzZWxmLm9uSW5pdENvbXBsZXRlTGlzdGVuZXJzW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAoIXNlbGYuaW5pdENvbXBsZXRlZCkge1xuICAgIHNlbGYub25Jbml0Q29tcGxldGVMaXN0ZW5lcnMucHVzaChvbkluaXRDb21wbGV0ZSk7XG4gIH0gZWxzZSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhvbkluaXRDb21wbGV0ZSk7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIExEKGxvY2F0aW9uKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBMRCkpIHtcbiAgICByZXR1cm4gbmV3IExEKGxvY2F0aW9uKTtcbiAgfVxuICBBYnN0cmFjdExldmVsRE9XTi5jYWxsKHRoaXMsIGxvY2F0aW9uKTtcbiAgdGhpcy5jb250YWluZXIgPSBuZXcgTG9jYWxTdG9yYWdlKGxvY2F0aW9uKTtcbn1cblxuaW5oZXJpdHMoTEQsIEFic3RyYWN0TGV2ZWxET1dOKTtcblxuTEQucHJvdG90eXBlLl9vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHRoaXMuY29udGFpbmVyLmluaXQoY2FsbGJhY2spO1xufTtcblxuTEQucHJvdG90eXBlLl9wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgb3B0aW9ucywgY2FsbGJhY2spIHtcblxuICB2YXIgZXJyID0gY2hlY2tLZXlWYWx1ZShrZXksICdrZXknKTtcblxuICBpZiAoZXJyKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSk7XG4gIH1cblxuICBlcnIgPSBjaGVja0tleVZhbHVlKHZhbHVlLCAndmFsdWUnKTtcblxuICBpZiAoZXJyKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSk7XG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQnVmZmVyLmlzQnVmZmVyKHZhbHVlKSAmJiB2YWx1ZS5idWZmZXIgPT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICBvYmouc3RvcmV0eXBlID0gXCJqc29uXCI7XG4gICAgb2JqLmRhdGEgPSB2YWx1ZTtcbiAgICB2YWx1ZSA9IEpTT04uc3RyaW5naWZ5KG9iaik7XG4gIH1cblxuICB0aGlzLmNvbnRhaW5lci5zZXRJdGVtKGtleSwgdmFsdWUsIGNhbGxiYWNrKTtcbn07XG5cbkxELnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcblxuICB2YXIgZXJyID0gY2hlY2tLZXlWYWx1ZShrZXksICdrZXknKTtcblxuICBpZiAoZXJyKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSk7XG4gIH1cblxuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihrZXkpKSB7XG4gICAga2V5ID0gU3RyaW5nKGtleSk7XG4gIH1cbiAgdGhpcy5jb250YWluZXIuZ2V0SXRlbShrZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG5cbiAgICBpZiAoZXJyKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5hc0J1ZmZlciAhPT0gZmFsc2UgJiYgIUJ1ZmZlci5pc0J1ZmZlcih2YWx1ZSkpIHtcbiAgICAgIHZhbHVlID0gYnVmZmVyRnJvbSh2YWx1ZSk7XG4gICAgfVxuXG5cbiAgICBpZiAob3B0aW9ucy5hc0J1ZmZlciA9PT0gZmFsc2UpIHtcbiAgICAgIGlmICh2YWx1ZS5pbmRleE9mKFwie1xcXCJzdG9yZXR5cGVcXFwiOlxcXCJqc29uXFxcIixcXFwiZGF0YVxcXCJcIikgPiAtMSkge1xuICAgICAgICB2YXIgcmVzID0gSlNPTi5wYXJzZSh2YWx1ZSk7XG4gICAgICAgIHZhbHVlID0gcmVzLmRhdGE7XG4gICAgICB9XG4gICAgfVxuICAgIGNhbGxiYWNrKG51bGwsIHZhbHVlKTtcbiAgfSk7XG59O1xuXG5MRC5wcm90b3R5cGUuX2RlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG5cbiAgdmFyIGVyciA9IGNoZWNrS2V5VmFsdWUoa2V5LCAna2V5Jyk7XG5cbiAgaWYgKGVycikge1xuICAgIHJldHVybiBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH0pO1xuICB9XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGtleSkpIHtcbiAgICBrZXkgPSBTdHJpbmcoa2V5KTtcbiAgfVxuXG4gIHRoaXMuY29udGFpbmVyLnJlbW92ZUl0ZW0oa2V5LCBjYWxsYmFjayk7XG59O1xuXG5MRC5wcm90b3R5cGUuX2JhdGNoID0gZnVuY3Rpb24gKGFycmF5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXJyO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIHZhbHVlO1xuXG4gICAgdmFyIG51bURvbmUgPSAwO1xuICAgIHZhciBvdmVyYWxsRXJyO1xuICAgIGZ1bmN0aW9uIGNoZWNrRG9uZSgpIHtcbiAgICAgIGlmICgrK251bURvbmUgPT09IGFycmF5Lmxlbmd0aCkge1xuICAgICAgICBjYWxsYmFjayhvdmVyYWxsRXJyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShhcnJheSkgJiYgYXJyYXkubGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciB0YXNrID0gYXJyYXlbaV07XG4gICAgICAgIGlmICh0YXNrKSB7XG4gICAgICAgICAga2V5ID0gQnVmZmVyLmlzQnVmZmVyKHRhc2sua2V5KSA/IHRhc2sua2V5IDogU3RyaW5nKHRhc2sua2V5KTtcbiAgICAgICAgICBlcnIgPSBjaGVja0tleVZhbHVlKGtleSwgJ2tleScpO1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIG92ZXJhbGxFcnIgPSBlcnI7XG4gICAgICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRhc2sudHlwZSA9PT0gJ2RlbCcpIHtcbiAgICAgICAgICAgIHNlbGYuX2RlbCh0YXNrLmtleSwgb3B0aW9ucywgY2hlY2tEb25lKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRhc2sudHlwZSA9PT0gJ3B1dCcpIHtcbiAgICAgICAgICAgIHZhbHVlID0gQnVmZmVyLmlzQnVmZmVyKHRhc2sudmFsdWUpID8gdGFzay52YWx1ZSA6IFN0cmluZyh0YXNrLnZhbHVlKTtcbiAgICAgICAgICAgIGVyciA9IGNoZWNrS2V5VmFsdWUodmFsdWUsICd2YWx1ZScpO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBvdmVyYWxsRXJyID0gZXJyO1xuICAgICAgICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHNlbGYuX3B1dChrZXksIHZhbHVlLCBvcHRpb25zLCBjaGVja0RvbmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5MRC5wcm90b3R5cGUuX2l0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMREl0ZXJhdG9yKHRoaXMsIG9wdGlvbnMpO1xufTtcblxuTEQuZGVzdHJveSA9IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaykge1xuICBMb2NhbFN0b3JhZ2VDb3JlLmRlc3Ryb3kobmFtZSwgY2FsbGJhY2spO1xufTtcblxuZnVuY3Rpb24gY2hlY2tLZXlWYWx1ZShvYmosIHR5cGUpIHtcbiAgaWYgKG9iaiA9PT0gbnVsbCB8fCBvYmogPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBuZXcgRXJyb3IodHlwZSArICcgY2Fubm90IGJlIGBudWxsYCBvciBgdW5kZWZpbmVkYCcpO1xuICB9XG4gIGlmIChvYmogPT09IG51bGwgfHwgb2JqID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKHR5cGUgKyAnIGNhbm5vdCBiZSBgbnVsbGAgb3IgYHVuZGVmaW5lZGAnKTtcbiAgfVxuXG4gIGlmICh0eXBlID09PSAna2V5Jykge1xuXG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIEJvb2xlYW4pIHtcbiAgICAgIHJldHVybiBuZXcgRXJyb3IodHlwZSArICcgY2Fubm90IGJlIGBudWxsYCBvciBgdW5kZWZpbmVkYCcpO1xuICAgIH1cbiAgICBpZiAob2JqID09PSAnJykge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgZW1wdHknKTtcbiAgICB9XG4gIH1cbiAgaWYgKG9iai50b1N0cmluZygpLmluZGV4T2YoXCJbb2JqZWN0IEFycmF5QnVmZmVyXVwiKSA9PT0gMCkge1xuICAgIGlmIChvYmouYnl0ZUxlbmd0aCA9PT0gMCB8fCBvYmouYnl0ZUxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbmV3IEVycm9yKHR5cGUgKyAnIGNhbm5vdCBiZSBhbiBlbXB0eSBCdWZmZXInKTtcbiAgICB9XG4gIH1cblxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iaikpIHtcbiAgICBpZiAob2JqLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYW4gZW1wdHkgQnVmZmVyJyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKFN0cmluZyhvYmopID09PSAnJykge1xuICAgIHJldHVybiBuZXcgRXJyb3IodHlwZSArICcgY2Fubm90IGJlIGFuIGVtcHR5IFN0cmluZycpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gTEQ7XG4iLCJpbXBvcnQgQ29yZUxldmVsUG91Y2ggZnJvbSAncG91Y2hkYi1hZGFwdGVyLWxldmVsZGItY29yZSc7XG5pbXBvcnQgbG9jYWxzdG9yYWdlZG93biBmcm9tICdsb2NhbHN0b3JhZ2UtZG93bic7XG5cbmZ1bmN0aW9uIExvY2FsU3RvcmFnZVBvdWNoKG9wdHMsIGNhbGxiYWNrKSB7XG4gIHZhciBfb3B0cyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGRiOiBsb2NhbHN0b3JhZ2Vkb3duXG4gIH0sIG9wdHMpO1xuXG4gIENvcmVMZXZlbFBvdWNoLmNhbGwodGhpcywgX29wdHMsIGNhbGxiYWNrKTtcbn1cblxuLy8gb3ZlcnJpZGVzIGZvciBub3JtYWwgTGV2ZWxEQiBiZWhhdmlvciBvbiBOb2RlXG5Mb2NhbFN0b3JhZ2VQb3VjaC52YWxpZCA9ICgpID0+IHR5cGVvZiBsb2NhbFN0b3JhZ2UgIT09ICd1bmRlZmluZWQnO1xuTG9jYWxTdG9yYWdlUG91Y2gudXNlX3ByZWZpeCA9IHRydWU7XG5cbmNvbnN0IGxvY2Fsc3RvcmFnZUFkYXB0ZXIgPSAoUG91Y2hEQikgPT4ge1xuICBQb3VjaERCLmFkYXB0ZXIoJ2xvY2Fsc3RvcmFnZScsIExvY2FsU3RvcmFnZVBvdWNoLCB0cnVlKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGxvY2Fsc3RvcmFnZUFkYXB0ZXI7Il0sIm5hbWVzIjpbImJ1ZmZlckZyb20iLCJ4dGVuZCIsIkFic3RyYWN0SXRlcmF0b3IiLCJBYnN0cmFjdENoYWluZWRCYXRjaCIsInJlcXVpcmUkJDAiLCJyZXF1aXJlJCQxIiwicmVxdWlyZSQkMiIsIkFic3RyYWN0TGV2ZWxET1dOIiwidXRpbHMiLCJhcGlNb2R1bGUiLCJnbG9iYWwiLCJsaWIiLCJuZXh0VGljayIsIkxvY2FsU3RvcmFnZUNvcmUiLCJhcmdzYXJyYXkiLCJRdWV1ZSIsIlRhc2tRdWV1ZSIsInJlcXVpcmUkJDMiLCJMb2NhbFN0b3JhZ2UiLCJyZXF1aXJlJCQ0IiwicmVxdWlyZSQkNSIsIkNvcmVMZXZlbFBvdWNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUksUUFBUSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUTtBQUN4QztBQUNBLElBQUksUUFBUTtBQUNaLEVBQUUsT0FBTyxNQUFNLENBQUMsS0FBSyxLQUFLLFVBQVU7QUFDcEMsRUFBRSxPQUFPLE1BQU0sQ0FBQyxXQUFXLEtBQUssVUFBVTtBQUMxQyxFQUFFLE9BQU8sTUFBTSxDQUFDLElBQUksS0FBSyxVQUFVO0FBQ25DLEVBQUM7QUFDRDtBQUNBLFNBQVMsYUFBYSxFQUFFLEtBQUssRUFBRTtBQUMvQixFQUFFLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssYUFBYTtBQUM1RCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLGVBQWUsRUFB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QUFNLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUU7QUFDMUQsTUFBTSxPQUFPLFFBQVEsRUFBRSxDQUFDO0FBQ3hCLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDcEM7QUFDQSxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLFFBQVEsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ3JGLE1BQU0sT0FBTyxRQUFRLEVBQUUsQ0FBQztBQUN4QixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDMUUsTUFBTSxPQUFPLFFBQVEsRUFBRSxDQUFDO0FBQ3hCLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHO0FBQ3JDLE9BQU8sSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztBQUNwQyxPQUFPLElBQUksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDcEMsT0FBTyxJQUFJLENBQUMsSUFBSSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDdEMsTUFBTSxPQUFPLFFBQVEsRUFBRSxDQUFDO0FBQ3hCLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4QyxJQUFJLElBQUksSUFB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QUcsa0NBQWtDLENBQUMsQ0FBQztBQUNsRSxLQUFLO0FBQ0wsSUFBSSxJQUFJLEdBQUcsS0FBSyxFQUFFLEVBQUU7QUFDcEIsTUFBTSxPQUFPLElBQUksS0FBSyxDQUFDLElBQUksR0FBRyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ2xELEtBQUs7QUFDTCxHQUFHO0FBQ0gsRUFBRSxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxPQUFPLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFDNUQsSUFBSSxJQUFJLEdBQUcsQ0FBQyxVQUFVLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFO0FBQzlELE1BQU0sT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLEdBQUcsNEJBQTRCLENBQUMsQ0FBQztBQUM1RCxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDNUIsSUFBSSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFCLE1BQU0sT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLEdBQUcsNEJBQTRCLENBQUMsQ0FBQztBQUM1RCxLQUFLO0FBQ0wsR0FBRyxNQUFNLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsRUFBRTtBQUNqQyxJQUFJLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLDRCQUE0QixDQUFDLENBQUM7QUFDMUQsR0FBRztBQUNILENBQUM7QUFDRDtBQUNBLElBQUEsR0FBYyxHQUFHLEVBQUUsQ0FBQTs7OztBQzlTbkIsU0FBUyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQzNDLEVBQUUsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUM1QixJQUFJLEVBQUUsRUFBRSxnQkFBZ0I7QUFDeEIsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ1g7QUFDQSxFQUFFVyxVQUFjLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUNEO0FBQ0E7QUFDQSxpQkFBaUIsQ0FBQyxLQUFLLEdBQUcsTUFBTSxPQUFPLFlBQVksS0FBSyxXQUFXLENBQUM7QUFDcEUsaUJBQWlCLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztBQUNwQztBQUNLLE1BQUMsbUJBQW1CLEdBQUcsQ0FBQyxPQUFPLEtBQUs7QUFDekMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUMzRDs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDIsMyw0LDUsNiw3LDgsOSwxMCwxMSwxMiwxMywxNCwxNSwxNl19
