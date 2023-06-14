import { L as LevelPouch } from './index-61da9795.js';
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
import './base64-browser-5f7b6479.js';
import './binaryStringToBlobOrBuffer-browser-7dc25c1d.js';
import './binaryMd5-browser-ad85bb67.js';
import './readAsArrayBuffer-625b2d33.js';
import './processDocs-7ad6f99c.js';
import './merge-7299d068.js';
import './revExists-12209d1c.js';
import './pouchdb-json.browser.js';
import './readAsBinaryString-06e911ba.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWxvY2Fsc3RvcmFnZS5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvbG9jYWxzdG9yYWdlLWRvd24vbm9kZV9tb2R1bGVzL2J1ZmZlci1mcm9tL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9ub2RlX21vZHVsZXMveHRlbmQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL2Fic3RyYWN0LWl0ZXJhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1jaGFpbmVkLWJhdGNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1sZXZlbGRvd24uanMiLCIuLi9ub2RlX21vZHVsZXMvbG9jYWxzdG9yYWdlLWRvd24vbGliL3V0aWxzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xvY2Fsc3RvcmFnZS1tZW1vcnkvbGliL2xvY2Fsc3RvcmFnZS1tZW1vcnkuanMiLCIuLi9ub2RlX21vZHVsZXMvaGFzLWxvY2Fsc3RvcmFnZS9saWIvaGFzLWxvY2Fsc3RvcmFnZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9odW1ibGUtbG9jYWxzdG9yYWdlL2xpYi9hcGkuanMiLCIuLi9ub2RlX21vZHVsZXMvaHVtYmxlLWxvY2Fsc3RvcmFnZS9saWIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvbG9jYWxzdG9yYWdlLWRvd24vbGliL2xvY2Fsc3RvcmFnZS1jb3JlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2FyZ3NhcnJheS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy90aW55LXF1ZXVlL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xvY2Fsc3RvcmFnZS1kb3duL2xpYi90YXNrcXVldWUuanMiLCIuLi9ub2RlX21vZHVsZXMvZDY0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xvY2Fsc3RvcmFnZS1kb3duL2xpYi9sb2NhbHN0b3JhZ2UuanMiLCIuLi9ub2RlX21vZHVsZXMvbG9jYWxzdG9yYWdlLWRvd24vbGliL2luZGV4LmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWxvY2Fsc3RvcmFnZS9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuXG52YXIgaXNNb2Rlcm4gPSAoXG4gIHR5cGVvZiBCdWZmZXIuYWxsb2MgPT09ICdmdW5jdGlvbicgJiZcbiAgdHlwZW9mIEJ1ZmZlci5hbGxvY1Vuc2FmZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICB0eXBlb2YgQnVmZmVyLmZyb20gPT09ICdmdW5jdGlvbidcbilcblxuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlciAoaW5wdXQpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaW5wdXQpLnNsaWNlKDgsIC0xKSA9PT0gJ0FycmF5QnVmZmVyJ1xufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKG9iaiwgYnl0ZU9mZnNldCwgbGVuZ3RoKSB7XG4gIGJ5dGVPZmZzZXQgPj4+PSAwXG5cbiAgdmFyIG1heExlbmd0aCA9IG9iai5ieXRlTGVuZ3RoIC0gYnl0ZU9mZnNldFxuXG4gIGlmIChtYXhMZW5ndGggPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCInb2Zmc2V0JyBpcyBvdXQgb2YgYm91bmRzXCIpXG4gIH1cblxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSBtYXhMZW5ndGhcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPj4+PSAwXG5cbiAgICBpZiAobGVuZ3RoID4gbWF4TGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIidsZW5ndGgnIGlzIG91dCBvZiBib3VuZHNcIilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaXNNb2Rlcm5cbiAgICA/IEJ1ZmZlci5mcm9tKG9iai5zbGljZShieXRlT2Zmc2V0LCBieXRlT2Zmc2V0ICsgbGVuZ3RoKSlcbiAgICA6IG5ldyBCdWZmZXIobmV3IFVpbnQ4QXJyYXkob2JqLnNsaWNlKGJ5dGVPZmZzZXQsIGJ5dGVPZmZzZXQgKyBsZW5ndGgpKSlcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICB9XG5cbiAgaWYgKCFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImVuY29kaW5nXCIgbXVzdCBiZSBhIHZhbGlkIHN0cmluZyBlbmNvZGluZycpXG4gIH1cblxuICByZXR1cm4gaXNNb2Rlcm5cbiAgICA/IEJ1ZmZlci5mcm9tKHN0cmluZywgZW5jb2RpbmcpXG4gICAgOiBuZXcgQnVmZmVyKHN0cmluZywgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGJ1ZmZlckZyb20gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgYSBudW1iZXInKVxuICB9XG5cbiAgaWYgKGlzQXJyYXlCdWZmZXIodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldClcbiAgfVxuXG4gIHJldHVybiBpc01vZGVyblxuICAgID8gQnVmZmVyLmZyb20odmFsdWUpXG4gICAgOiBuZXcgQnVmZmVyKHZhbHVlKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1ZmZlckZyb21cbiIsIm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICB2YXIgdGFyZ2V0ID0ge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV1cblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0XG59XG4iLCIvKiBDb3B5cmlnaHQgKGMpIDIwMTMgUm9kIFZhZ2csIE1JVCBMaWNlbnNlICovXG5cbmZ1bmN0aW9uIEFic3RyYWN0SXRlcmF0b3IgKGRiKSB7XG4gIHRoaXMuZGIgPSBkYlxuICB0aGlzLl9lbmRlZCA9IGZhbHNlXG4gIHRoaXMuX25leHRpbmcgPSBmYWxzZVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ25leHQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAoc2VsZi5fZW5kZWQpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignY2Fubm90IGNhbGwgbmV4dCgpIGFmdGVyIGVuZCgpJykpXG4gIGlmIChzZWxmLl9uZXh0aW5nKVxuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIG5leHQoKSBiZWZvcmUgcHJldmlvdXMgbmV4dCgpIGhhcyBjb21wbGV0ZWQnKSlcblxuICBzZWxmLl9uZXh0aW5nID0gdHJ1ZVxuICBpZiAodHlwZW9mIHNlbGYuX25leHQgPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBzZWxmLl9uZXh0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX25leHRpbmcgPSBmYWxzZVxuICAgICAgY2FsbGJhY2suYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH0pXG4gIH1cblxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLl9uZXh0aW5nID0gZmFsc2VcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdlbmQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAodGhpcy5fZW5kZWQpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignZW5kKCkgYWxyZWFkeSBjYWxsZWQgb24gaXRlcmF0b3InKSlcblxuICB0aGlzLl9lbmRlZCA9IHRydWVcblxuICBpZiAodHlwZW9mIHRoaXMuX2VuZCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9lbmQoY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdEl0ZXJhdG9yXG4iLCIvKiBDb3B5cmlnaHQgKGMpIDIwMTMgUm9kIFZhZ2csIE1JVCBMaWNlbnNlICovXG5cbmZ1bmN0aW9uIEFic3RyYWN0Q2hhaW5lZEJhdGNoIChkYikge1xuICB0aGlzLl9kYiAgICAgICAgID0gZGJcbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG4gIHRoaXMuX3dyaXR0ZW4gICAgPSBmYWxzZVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX2NoZWNrV3JpdHRlbiA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuX3dyaXR0ZW4pXG4gICAgdGhyb3cgbmV3IEVycm9yKCd3cml0ZSgpIGFscmVhZHkgY2FsbGVkIG9uIHRoaXMgYmF0Y2gnKVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB2YXIgZXJyID0gdGhpcy5fZGIuX2NoZWNrS2V5VmFsdWUoa2V5LCAna2V5JywgdGhpcy5fZGIuX2lzQnVmZmVyKVxuICBpZiAoZXJyKSB0aHJvdyBlcnJcbiAgZXJyID0gdGhpcy5fZGIuX2NoZWNrS2V5VmFsdWUodmFsdWUsICd2YWx1ZScsIHRoaXMuX2RiLl9pc0J1ZmZlcilcbiAgaWYgKGVycikgdGhyb3cgZXJyXG5cbiAgaWYgKCF0aGlzLl9kYi5faXNCdWZmZXIoa2V5KSkga2V5ID0gU3RyaW5nKGtleSlcbiAgaWYgKCF0aGlzLl9kYi5faXNCdWZmZXIodmFsdWUpKSB2YWx1ZSA9IFN0cmluZyh2YWx1ZSlcblxuICBpZiAodHlwZW9mIHRoaXMuX3B1dCA9PSAnZnVuY3Rpb24nIClcbiAgICB0aGlzLl9wdXQoa2V5LCB2YWx1ZSlcbiAgZWxzZVxuICAgIHRoaXMuX29wZXJhdGlvbnMucHVzaCh7IHR5cGU6ICdwdXQnLCBrZXk6IGtleSwgdmFsdWU6IHZhbHVlIH0pXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB2YXIgZXJyID0gdGhpcy5fZGIuX2NoZWNrS2V5VmFsdWUoa2V5LCAna2V5JywgdGhpcy5fZGIuX2lzQnVmZmVyKVxuICBpZiAoZXJyKSB0aHJvdyBlcnJcblxuICBpZiAoIXRoaXMuX2RiLl9pc0J1ZmZlcihrZXkpKSBrZXkgPSBTdHJpbmcoa2V5KVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fZGVsID09ICdmdW5jdGlvbicgKVxuICAgIHRoaXMuX2RlbChrZXkpXG4gIGVsc2VcbiAgICB0aGlzLl9vcGVyYXRpb25zLnB1c2goeyB0eXBlOiAnZGVsJywga2V5OiBrZXkgfSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9jbGVhciA9PSAnZnVuY3Rpb24nIClcbiAgICB0aGlzLl9jbGVhcigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dyaXRlKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPSAnb2JqZWN0JylcbiAgICBvcHRpb25zID0ge31cblxuICB0aGlzLl93cml0dGVuID0gdHJ1ZVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fd3JpdGUgPT0gJ2Z1bmN0aW9uJyApXG4gICAgcmV0dXJuIHRoaXMuX3dyaXRlKGNhbGxiYWNrKVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fZGIuX2JhdGNoID09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIHRoaXMuX2RiLl9iYXRjaCh0aGlzLl9vcGVyYXRpb25zLCBvcHRpb25zLCBjYWxsYmFjaylcblxuICBwcm9jZXNzLm5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Q2hhaW5lZEJhdGNoIiwiLyogQ29weXJpZ2h0IChjKSAyMDEzIFJvZCBWYWdnLCBNSVQgTGljZW5zZSAqL1xuXG52YXIgeHRlbmQgICAgICAgICAgICAgICAgPSByZXF1aXJlKCd4dGVuZCcpXG4gICwgQWJzdHJhY3RJdGVyYXRvciAgICAgPSByZXF1aXJlKCcuL2Fic3RyYWN0LWl0ZXJhdG9yJylcbiAgLCBBYnN0cmFjdENoYWluZWRCYXRjaCA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaCcpXG5cbmZ1bmN0aW9uIEFic3RyYWN0TGV2ZWxET1dOIChsb2NhdGlvbikge1xuICBpZiAoIWFyZ3VtZW50cy5sZW5ndGggfHwgbG9jYXRpb24gPT09IHVuZGVmaW5lZClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbnN0cnVjdG9yIHJlcXVpcmVzIGF0IGxlYXN0IGEgbG9jYXRpb24gYXJndW1lbnQnKVxuXG4gIGlmICh0eXBlb2YgbG9jYXRpb24gIT0gJ3N0cmluZycpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjb25zdHJ1Y3RvciByZXF1aXJlcyBhIGxvY2F0aW9uIHN0cmluZyBhcmd1bWVudCcpXG5cbiAgdGhpcy5sb2NhdGlvbiA9IGxvY2F0aW9uXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ29wZW4oKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9vcGVuID09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIHRoaXMuX29wZW4ob3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nsb3NlKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9jbG9zZSA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9jbG9zZShjYWxsYmFjaylcblxuICBwcm9jZXNzLm5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIGVyclxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuXG4gIGlmIChlcnIgPSB0aGlzLl9jaGVja0tleVZhbHVlKGtleSwgJ2tleScsIHRoaXMuX2lzQnVmZmVyKSlcbiAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuXG4gIGlmICghdGhpcy5faXNCdWZmZXIoa2V5KSlcbiAgICBrZXkgPSBTdHJpbmcoa2V5KVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPSAnb2JqZWN0JylcbiAgICBvcHRpb25zID0ge31cblxuICBpZiAodHlwZW9mIHRoaXMuX2dldCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9nZXQoa2V5LCBvcHRpb25zLCBjYWxsYmFjaylcblxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHsgY2FsbGJhY2sobmV3IEVycm9yKCdOb3RGb3VuZCcpKSB9KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBlcnJcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT0gJ2Z1bmN0aW9uJylcbiAgICBjYWxsYmFjayA9IG9wdGlvbnNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdwdXQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZShrZXksICdrZXknLCB0aGlzLl9pc0J1ZmZlcikpXG4gICAgcmV0dXJuIGNhbGxiYWNrKGVycilcblxuICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZSh2YWx1ZSwgJ3ZhbHVlJywgdGhpcy5faXNCdWZmZXIpKVxuICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAgaWYgKCF0aGlzLl9pc0J1ZmZlcihrZXkpKVxuICAgIGtleSA9IFN0cmluZyhrZXkpXG5cbiAgLy8gY29lcmNlIHZhbHVlIHRvIHN0cmluZyBpbiBub2RlLCBkb24ndCB0b3VjaCBpdCBpbiBicm93c2VyXG4gIC8vIChpbmRleGVkZGIgY2FuIHN0b3JlIGFueSBKUyB0eXBlKVxuICBpZiAoIXRoaXMuX2lzQnVmZmVyKHZhbHVlKSAmJiAhcHJvY2Vzcy5icm93c2VyKVxuICAgIHZhbHVlID0gU3RyaW5nKHZhbHVlKVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPSAnb2JqZWN0JylcbiAgICBvcHRpb25zID0ge31cblxuICBpZiAodHlwZW9mIHRoaXMuX3B1dCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9wdXQoa2V5LCB2YWx1ZSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBlcnJcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT0gJ2Z1bmN0aW9uJylcbiAgICBjYWxsYmFjayA9IG9wdGlvbnNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdkZWwoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZShrZXksICdrZXknLCB0aGlzLl9pc0J1ZmZlcikpXG4gICAgcmV0dXJuIGNhbGxiYWNrKGVycilcblxuICBpZiAoIXRoaXMuX2lzQnVmZmVyKGtleSkpXG4gICAga2V5ID0gU3RyaW5nKGtleSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9kZWwgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fZGVsKGtleSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmJhdGNoID0gZnVuY3Rpb24gKGFycmF5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpXG4gICAgcmV0dXJuIHRoaXMuX2NoYWluZWRCYXRjaCgpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcignYmF0Y2goYXJyYXkpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuXG4gIGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignYmF0Y2goYXJyYXkpIHJlcXVpcmVzIGFuIGFycmF5IGFyZ3VtZW50JykpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIHZhciBpID0gMFxuICAgICwgbCA9IGFycmF5Lmxlbmd0aFxuICAgICwgZVxuICAgICwgZXJyXG5cbiAgZm9yICg7IGkgPCBsOyBpKyspIHtcbiAgICBlID0gYXJyYXlbaV1cbiAgICBpZiAodHlwZW9mIGUgIT0gJ29iamVjdCcpXG4gICAgICBjb250aW51ZVxuXG4gICAgaWYgKGVyciA9IHRoaXMuX2NoZWNrS2V5VmFsdWUoZS50eXBlLCAndHlwZScsIHRoaXMuX2lzQnVmZmVyKSlcbiAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAgICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZShlLmtleSwgJ2tleScsIHRoaXMuX2lzQnVmZmVyKSlcbiAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAgICBpZiAoZS50eXBlID09ICdwdXQnKSB7XG4gICAgICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXlWYWx1ZShlLnZhbHVlLCAndmFsdWUnLCB0aGlzLl9pc0J1ZmZlcikpXG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9iYXRjaCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9iYXRjaChhcnJheSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuLy9UT0RPOiByZW1vdmUgZnJvbSBoZXJlLCBub3QgYSBuZWNlc3NhcnkgcHJpbWl0aXZlXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuYXBwcm94aW1hdGVTaXplID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIGNhbGxiYWNrKSB7XG4gIGlmICggICBzdGFydCA9PSBudWxsXG4gICAgICB8fCBlbmQgPT0gbnVsbFxuICAgICAgfHwgdHlwZW9mIHN0YXJ0ID09ICdmdW5jdGlvbidcbiAgICAgIHx8IHR5cGVvZiBlbmQgPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYXBwcm94aW1hdGVTaXplKCkgcmVxdWlyZXMgdmFsaWQgYHN0YXJ0YCwgYGVuZGAgYW5kIGBjYWxsYmFja2AgYXJndW1lbnRzJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FwcHJveGltYXRlU2l6ZSgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuXG4gIGlmICghdGhpcy5faXNCdWZmZXIoc3RhcnQpKVxuICAgIHN0YXJ0ID0gU3RyaW5nKHN0YXJ0KVxuXG4gIGlmICghdGhpcy5faXNCdWZmZXIoZW5kKSlcbiAgICBlbmQgPSBTdHJpbmcoZW5kKVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fYXBwcm94aW1hdGVTaXplID09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIHRoaXMuX2FwcHJveGltYXRlU2l6ZShzdGFydCwgZW5kLCBjYWxsYmFjaylcblxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayhudWxsLCAwKVxuICB9KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX3NldHVwSXRlcmF0b3JPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgb3B0aW9ucyA9IHh0ZW5kKG9wdGlvbnMpXG5cbiAgO1sgJ3N0YXJ0JywgJ2VuZCcsICdndCcsICdndGUnLCAnbHQnLCAnbHRlJyBdLmZvckVhY2goZnVuY3Rpb24gKG8pIHtcbiAgICBpZiAob3B0aW9uc1tvXSAmJiBzZWxmLl9pc0J1ZmZlcihvcHRpb25zW29dKSAmJiBvcHRpb25zW29dLmxlbmd0aCA9PT0gMClcbiAgICAgIGRlbGV0ZSBvcHRpb25zW29dXG4gIH0pXG5cbiAgb3B0aW9ucy5yZXZlcnNlID0gISFvcHRpb25zLnJldmVyc2VcblxuICAvLyBmaXggYHN0YXJ0YCBzbyBpdCB0YWtlcyBpbnRvIGFjY291bnQgZ3QsIGd0ZSwgbHQsIGx0ZSBhcyBhcHByb3ByaWF0ZVxuICBpZiAob3B0aW9ucy5yZXZlcnNlICYmIG9wdGlvbnMubHQpXG4gICAgb3B0aW9ucy5zdGFydCA9IG9wdGlvbnMubHRcbiAgaWYgKG9wdGlvbnMucmV2ZXJzZSAmJiBvcHRpb25zLmx0ZSlcbiAgICBvcHRpb25zLnN0YXJ0ID0gb3B0aW9ucy5sdGVcbiAgaWYgKCFvcHRpb25zLnJldmVyc2UgJiYgb3B0aW9ucy5ndClcbiAgICBvcHRpb25zLnN0YXJ0ID0gb3B0aW9ucy5ndFxuICBpZiAoIW9wdGlvbnMucmV2ZXJzZSAmJiBvcHRpb25zLmd0ZSlcbiAgICBvcHRpb25zLnN0YXJ0ID0gb3B0aW9ucy5ndGVcblxuICBpZiAoKG9wdGlvbnMucmV2ZXJzZSAmJiBvcHRpb25zLmx0ICYmICFvcHRpb25zLmx0ZSlcbiAgICB8fCAoIW9wdGlvbnMucmV2ZXJzZSAmJiBvcHRpb25zLmd0ICYmICFvcHRpb25zLmd0ZSkpXG4gICAgb3B0aW9ucy5leGNsdXNpdmVTdGFydCA9IHRydWUgLy8gc3RhcnQgc2hvdWxkICpub3QqIGluY2x1ZGUgbWF0Y2hpbmcga2V5XG5cbiAgcmV0dXJuIG9wdGlvbnNcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLml0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIG9wdGlvbnMgPSB0aGlzLl9zZXR1cEl0ZXJhdG9yT3B0aW9ucyhvcHRpb25zKVxuXG4gIGlmICh0eXBlb2YgdGhpcy5faXRlcmF0b3IgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5faXRlcmF0b3Iob3B0aW9ucylcblxuICByZXR1cm4gbmV3IEFic3RyYWN0SXRlcmF0b3IodGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGFpbmVkQmF0Y2ggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgQWJzdHJhY3RDaGFpbmVkQmF0Y2godGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9pc0J1ZmZlciA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihvYmopXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2hlY2tLZXlWYWx1ZSA9IGZ1bmN0aW9uIChvYmosIHR5cGUpIHtcbiAgaWYgKG9iaiA9PT0gbnVsbCB8fCBvYmogPT09IHVuZGVmaW5lZClcbiAgICByZXR1cm4gbmV3IEVycm9yKHR5cGUgKyAnIGNhbm5vdCBiZSBgbnVsbGAgb3IgYHVuZGVmaW5lZGAnKVxuXG4gIGlmIChvYmogPT09IG51bGwgfHwgb2JqID09PSB1bmRlZmluZWQpXG4gICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYG51bGxgIG9yIGB1bmRlZmluZWRgJylcblxuICBpZiAodGhpcy5faXNCdWZmZXIob2JqKSkge1xuICAgIGlmIChvYmoubGVuZ3RoID09PSAwKVxuICAgICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYW4gZW1wdHkgQnVmZmVyJylcbiAgfSBlbHNlIGlmIChTdHJpbmcob2JqKSA9PT0gJycpXG4gICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYW4gZW1wdHkgU3RyaW5nJylcbn1cblxubW9kdWxlLmV4cG9ydHMuQWJzdHJhY3RMZXZlbERPV04gICAgPSBBYnN0cmFjdExldmVsRE9XTlxubW9kdWxlLmV4cG9ydHMuQWJzdHJhY3RJdGVyYXRvciAgICAgPSBBYnN0cmFjdEl0ZXJhdG9yXG5tb2R1bGUuZXhwb3J0cy5BYnN0cmFjdENoYWluZWRCYXRjaCA9IEFic3RyYWN0Q2hhaW5lZEJhdGNoXG4iLCIndXNlIHN0cmljdCc7XG4vLyB0YWtlbiBmcm9tIHJ2YWdnL21lbWRvd24gY29tbWl0IDIwNzhiNDBcbmV4cG9ydHMuc29ydGVkSW5kZXhPZiA9IGZ1bmN0aW9uKGFyciwgaXRlbSkge1xuICB2YXIgbG93ID0gMDtcbiAgdmFyIGhpZ2ggPSBhcnIubGVuZ3RoO1xuICB2YXIgbWlkO1xuICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgIG1pZCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcbiAgICBpZiAoYXJyW21pZF0gPCBpdGVtKSB7XG4gICAgICBsb3cgPSBtaWQgKyAxO1xuICAgIH0gZWxzZSB7XG4gICAgICBoaWdoID0gbWlkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbG93O1xufTtcbiIsIihmdW5jdGlvbiAocm9vdCkge1xuICB2YXIgbG9jYWxTdG9yYWdlTWVtb3J5ID0ge31cbiAgdmFyIGNhY2hlID0ge31cblxuICAvKipcbiAgICogbnVtYmVyIG9mIHN0b3JlZCBpdGVtcy5cbiAgICovXG4gIGxvY2FsU3RvcmFnZU1lbW9yeS5sZW5ndGggPSAwXG5cbiAgLyoqXG4gICAqIHJldHVybnMgaXRlbSBmb3IgcGFzc2VkIGtleSwgb3IgbnVsbFxuICAgKlxuICAgKiBAcGFyYSB7U3RyaW5nfSBrZXlcbiAgICogICAgICAgbmFtZSBvZiBpdGVtIHRvIGJlIHJldHVybmVkXG4gICAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAgICovXG4gIGxvY2FsU3RvcmFnZU1lbW9yeS5nZXRJdGVtID0gZnVuY3Rpb24gKGtleSkge1xuICAgIGlmIChrZXkgaW4gY2FjaGUpIHtcbiAgICAgIHJldHVybiBjYWNoZVtrZXldXG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIC8qKlxuICAgKiBzZXRzIGl0ZW0gZm9yIGtleSB0byBwYXNzZWQgdmFsdWUsIGFzIFN0cmluZ1xuICAgKlxuICAgKiBAcGFyYSB7U3RyaW5nfSBrZXlcbiAgICogICAgICAgbmFtZSBvZiBpdGVtIHRvIGJlIHNldFxuICAgKiBAcGFyYSB7U3RyaW5nfSB2YWx1ZVxuICAgKiAgICAgICB2YWx1ZSwgd2lsbCBhbHdheXMgYmUgdHVybmVkIGludG8gYSBTdHJpbmdcbiAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICovXG4gIGxvY2FsU3RvcmFnZU1lbW9yeS5zZXRJdGVtID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgbG9jYWxTdG9yYWdlTWVtb3J5LnJlbW92ZUl0ZW0oa2V5KVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIShjYWNoZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSkge1xuICAgICAgICBsb2NhbFN0b3JhZ2VNZW1vcnkubGVuZ3RoKytcbiAgICAgIH1cblxuICAgICAgY2FjaGVba2V5XSA9ICcnICsgdmFsdWVcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogcmVtb3ZlcyBpdGVtIGZvciBwYXNzZWQga2V5XG4gICAqXG4gICAqIEBwYXJhIHtTdHJpbmd9IGtleVxuICAgKiAgICAgICBuYW1lIG9mIGl0ZW0gdG8gYmUgcmVtb3ZlZFxuICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgKi9cbiAgbG9jYWxTdG9yYWdlTWVtb3J5LnJlbW92ZUl0ZW0gPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgaWYgKGNhY2hlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIGRlbGV0ZSBjYWNoZVtrZXldXG4gICAgICBsb2NhbFN0b3JhZ2VNZW1vcnkubGVuZ3RoLS1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogcmV0dXJucyBuYW1lIG9mIGtleSBhdCBwYXNzZWQgaW5kZXhcbiAgICpcbiAgICogQHBhcmEge051bWJlcn0gaW5kZXhcbiAgICogICAgICAgUG9zaXRpb24gZm9yIGtleSB0byBiZSByZXR1cm5lZCAoc3RhcnRzIGF0IDApXG4gICAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAgICovXG4gIGxvY2FsU3RvcmFnZU1lbW9yeS5rZXkgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoY2FjaGUpW2luZGV4XSB8fCBudWxsXG4gIH1cblxuICAvKipcbiAgICogcmVtb3ZlcyBhbGwgc3RvcmVkIGl0ZW1zIGFuZCBzZXRzIGxlbmd0aCB0byAwXG4gICAqXG4gICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAqL1xuICBsb2NhbFN0b3JhZ2VNZW1vcnkuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FjaGUgPSB7fVxuICAgIGxvY2FsU3RvcmFnZU1lbW9yeS5sZW5ndGggPSAwXG4gIH1cblxuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBsb2NhbFN0b3JhZ2VNZW1vcnlcbiAgfSBlbHNlIHtcbiAgICByb290LmxvY2FsU3RvcmFnZU1lbW9yeSA9IGxvY2FsU3RvcmFnZU1lbW9yeVxuICB9XG59KSh0aGlzKVxuIiwiLyoqXG4gKiAjIGhhc0xvY2FsU3RvcmFnZSgpXG4gKlxuICogcmV0dXJucyBgdHJ1ZWAgb3IgYGZhbHNlYCBkZXBlbmRpbmcgb24gd2hldGhlciBsb2NhbFN0b3JhZ2UgaXMgc3VwcG9ydGVkIG9yIG5vdC5cbiAqIEJld2FyZSB0aGF0IHNvbWUgYnJvd3NlcnMgbGlrZSBTYWZhcmkgZG8gbm90IHN1cHBvcnQgbG9jYWxTdG9yYWdlIGluIHByaXZhdGUgbW9kZS5cbiAqXG4gKiBpbnNwaXJlZCBieSB0aGlzIGNhcHB1Y2Npbm8gY29tbWl0XG4gKiBodHRwczovL2dpdGh1Yi5jb20vY2FwcHVjY2luby9jYXBwdWNjaW5vL2NvbW1pdC8wNjNiMDVkOTY0M2MzNWIzMDM1NjhhMjg4MDllNGViMzIyNGY3MWVjXG4gKlxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbmZ1bmN0aW9uIGhhc0xvY2FsU3RvcmFnZSgpIHtcbiAgdHJ5IHtcblxuICAgIC8vIHdlJ3ZlIHRvIHB1dCB0aGlzIGluIGhlcmUuIEkndmUgc2VlbiBGaXJlZm94IHRocm93aW5nIGBTZWN1cml0eSBlcnJvcjogMTAwMGBcbiAgICAvLyB3aGVuIGNvb2tpZXMgaGF2ZSBiZWVuIGRpc2FibGVkXG4gICAgaWYgKHR5cGVvZiBsb2NhbFN0b3JhZ2UgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gSnVzdCBiZWNhdXNlIGxvY2FsU3RvcmFnZSBleGlzdHMgZG9lcyBub3QgbWVhbiBpdCB3b3Jrcy4gSW4gcGFydGljdWxhciBpdCBtaWdodCBiZSBkaXNhYmxlZFxuICAgIC8vIGFzIGl0IGlzIHdoZW4gU2FmYXJpJ3MgcHJpdmF0ZSBicm93c2luZyBtb2RlIGlzIGFjdGl2ZS5cbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnU3RvcmFnZS1UZXN0JywgJzEnKTtcblxuICAgIC8vIHRoYXQgc2hvdWxkIG5vdCBoYXBwZW4gLi4uXG4gICAgaWYgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdTdG9yYWdlLVRlc3QnKSAhPT0gJzEnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gb2theSwgbGV0J3MgY2xlYW4gdXAgaWYgd2UgZ290IGhlcmUuXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ1N0b3JhZ2UtVGVzdCcpO1xuICB9IGNhdGNoIChfZXJyb3IpIHtcblxuICAgIC8vIGluIGNhc2Ugb2YgYW4gZXJyb3IsIGxpa2UgU2FmYXJpJ3MgUHJpdmF0ZSBNb2RlLCByZXR1cm4gZmFsc2VcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyB3ZSdyZSBnb29kLlxuICByZXR1cm4gdHJ1ZTtcbn1cblxuXG5pZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gaGFzTG9jYWxTdG9yYWdlO1xufVxuIiwidmFyIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIGxvY2FsU3RvcmFnZU1lbW9yeSA9IHJlcXVpcmUoJ2xvY2Fsc3RvcmFnZS1tZW1vcnknKTtcbmV4cG9ydHMuaGFzTG9jYWxTdG9yYWdlID0gcmVxdWlyZSgnaGFzLWxvY2Fsc3RvcmFnZScpO1xuXG4vKipcbiAqIHJldHVybnMgbG9jYWxTdG9yYWdlLWNvbXBhdGlibGUgQVBJLCBlaXRoZXIgYmFja2VkIGJ5IHdpbmRvdy5sb2NhbFN0b3JhZ2VcbiAqIG9yIG1lbW9yeSBpZiBpdCdzIG5vdCBhdmFpbGFibGUgb3Igbm90IHBlcnNpc3RlbnQuXG4gKlxuICogSXQgYWxzbyBhZGRzIGFuIG9iamVjdCBBUEkgKGAuZ2V0T2JqZWN0KGtleSlgLFxuICogYC5zZXRPYmplY3Qoa2V5LCBwcm9wZXJ0aWVzKWApIGFuZCBhIGBpc1ByZXNpc3RlbnRgIHByb3BlcnR5XG4gKlxuICogQHJldHVybnMge09iamVjdH1cbiAqL1xuZXhwb3J0cy5jcmVhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBhcGk7XG5cbiAgaWYgKCFleHBvcnRzLmhhc0xvY2FsU3RvcmFnZSgpKSB7XG4gICAgYXBpID0gbG9jYWxTdG9yYWdlTWVtb3J5O1xuICAgIGFwaS5pc1BlcnNpc3RlbnQgPSBmYWxzZTtcbiAgfSBlbHNlIHtcbiAgICBhcGkgPSBnbG9iYWwubG9jYWxTdG9yYWdlO1xuICAgIGFwaSA9IHtcbiAgICAgIGdldCBsZW5ndGgoKSB7IHJldHVybiBnbG9iYWwubG9jYWxTdG9yYWdlLmxlbmd0aDsgfSxcbiAgICAgIGdldEl0ZW06IGdsb2JhbC5sb2NhbFN0b3JhZ2UuZ2V0SXRlbS5iaW5kKGdsb2JhbC5sb2NhbFN0b3JhZ2UpLFxuICAgICAgc2V0SXRlbTogZ2xvYmFsLmxvY2FsU3RvcmFnZS5zZXRJdGVtLmJpbmQoZ2xvYmFsLmxvY2FsU3RvcmFnZSksXG4gICAgICByZW1vdmVJdGVtOiBnbG9iYWwubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0uYmluZChnbG9iYWwubG9jYWxTdG9yYWdlKSxcbiAgICAgIGtleTogZ2xvYmFsLmxvY2FsU3RvcmFnZS5rZXkuYmluZChnbG9iYWwubG9jYWxTdG9yYWdlKSxcbiAgICAgIGNsZWFyOiBnbG9iYWwubG9jYWxTdG9yYWdlLmNsZWFyLmJpbmQoZ2xvYmFsLmxvY2FsU3RvcmFnZSksXG4gICAgfTtcblxuICAgIGFwaS5pc1BlcnNpc3RlbnQgPSB0cnVlO1xuICB9XG5cbiAgYXBpLmdldE9iamVjdCA9IGV4cG9ydHMuZ2V0T2JqZWN0LmJpbmQobnVsbCwgYXBpKTtcbiAgYXBpLnNldE9iamVjdCA9IGV4cG9ydHMuc2V0T2JqZWN0LmJpbmQobnVsbCwgYXBpKTtcblxuICByZXR1cm4gYXBpO1xufTtcblxuLyoqXG4gKiBzZXRzIGtleSB0byBwYXNzZWQgT2JqZWN0LlxuICpcbiAqIEByZXR1cm5zIHVuZGVmaW5lZFxuICovXG5leHBvcnRzLnNldE9iamVjdCA9IGZ1bmN0aW9uIChzdG9yZSwga2V5LCBvYmplY3QpIHtcbiAgaWYgKHR5cGVvZiBvYmplY3QgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIHN0b3JlLnNldEl0ZW0oa2V5LCBvYmplY3QpO1xuICB9XG5cbiAgcmV0dXJuIHN0b3JlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShvYmplY3QpKTtcbn07XG5cbi8qKlxuICogcmV0dXJucyBPYmplY3QgZm9yIGtleSwgb3IgbnVsbFxuICpcbiAqIEByZXR1cm5zIHtPYmplY3R8bnVsbH1cbiAqL1xuZXhwb3J0cy5nZXRPYmplY3QgPSBmdW5jdGlvbiAoc3RvcmUsIGtleSkge1xuICB2YXIgaXRlbSA9IHN0b3JlLmdldEl0ZW0oa2V5KTtcblxuICBpZiAoIWl0ZW0pIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoaXRlbSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gaXRlbTtcbiAgfVxufTtcbiIsInZhciBhcGkgPSByZXF1aXJlKCcuL2FwaScpO1xubW9kdWxlLmV4cG9ydHMgPSBhcGkuY3JlYXRlKCk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vXG4vLyBDbGFzcyB0aGF0IHNob3VsZCBjb250YWluIGV2ZXJ5dGhpbmcgbmVjZXNzYXJ5IHRvIGludGVyYWN0XG4vLyB3aXRoIGxvY2FsU3RvcmFnZSBhcyBhIGdlbmVyaWMga2V5LXZhbHVlIHN0b3JlLlxuLy8gVGhlIGlkZWEgaXMgdGhhdCBhdXRob3JzIHdobyB3YW50IHRvIGNyZWF0ZSBhbiBBYnN0cmFjdEtleVZhbHVlRE9XTlxuLy8gbW9kdWxlIChlLmcuIG9uIGxhd25jaGFpciwgUzMsIHdoYXRldmVyKSB3aWxsIG9ubHkgaGF2ZSB0b1xuLy8gcmVpbXBsZW1lbnQgdGhpcyBmaWxlLlxuLy9cblxuLy8gc2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE1MzQ5ODY1LzY4MDc0MlxudmFyIG5leHRUaWNrID0gZ2xvYmFsLnNldEltbWVkaWF0ZSB8fCBwcm9jZXNzLm5leHRUaWNrO1xuXG4vLyBXZSB1c2UgaHVtYmxlLWxvY2Fsc3RvcmFnZSBhcyBhIHdyYXBwZXIgZm9yIGxvY2FsU3RvcmFnZSBiZWNhdXNlXG4vLyBpdCBmYWxscyBiYWNrIHRvIGFuIGluLW1lbW9yeSBpbXBsZW1lbnRhdGlvbiBpbiBlbnZpcm9ubWVudHMgd2l0aG91dFxuLy8gbG9jYWxTdG9yYWdlLCBsaWtlIE5vZGUgb3IgU2FmYXJpIHByaXZhdGUgYnJvd3NpbmcuXG52YXIgc3RvcmFnZSA9IHJlcXVpcmUoJ2h1bWJsZS1sb2NhbHN0b3JhZ2UnKTtcblxuZnVuY3Rpb24gY2FsbGJhY2tpZnkoY2FsbGJhY2ssIGZ1bikge1xuICB2YXIgdmFsO1xuICB2YXIgZXJyO1xuICB0cnkge1xuICAgIHZhbCA9IGZ1bigpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZXJyID0gZTtcbiAgfVxuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soZXJyLCB2YWwpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUHJlZml4KGRibmFtZSkge1xuICByZXR1cm4gZGJuYW1lLnJlcGxhY2UoLyEvZywgJyEhJykgKyAnISc7IC8vIGVzY2FwZSBiYW5ncyBpbiBkYm5hbWU7XG59XG5cbmZ1bmN0aW9uIExvY2FsU3RvcmFnZUNvcmUoZGJuYW1lKSB7XG4gIHRoaXMuX3ByZWZpeCA9IGNyZWF0ZVByZWZpeChkYm5hbWUpO1xufVxuXG5Mb2NhbFN0b3JhZ2VDb3JlLnByb3RvdHlwZS5nZXRLZXlzID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2FsbGJhY2tpZnkoY2FsbGJhY2ssIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciBwcmVmaXhMZW4gPSBzZWxmLl9wcmVmaXgubGVuZ3RoO1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHN0b3JhZ2UubGVuZ3RoO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIHZhciBmdWxsS2V5ID0gc3RvcmFnZS5rZXkoaSk7XG4gICAgICBpZiAoZnVsbEtleS5zdWJzdHJpbmcoMCwgcHJlZml4TGVuKSA9PT0gc2VsZi5fcHJlZml4KSB7XG4gICAgICAgIGtleXMucHVzaChmdWxsS2V5LnN1YnN0cmluZyhwcmVmaXhMZW4pKTtcbiAgICAgIH1cbiAgICB9XG4gICAga2V5cy5zb3J0KCk7XG4gICAgcmV0dXJuIGtleXM7XG4gIH0pO1xufTtcblxuTG9jYWxTdG9yYWdlQ29yZS5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2FsbGJhY2tpZnkoY2FsbGJhY2ssIGZ1bmN0aW9uICgpIHtcbiAgICBzdG9yYWdlLnNldEl0ZW0oc2VsZi5fcHJlZml4ICsga2V5LCB2YWx1ZSk7XG4gIH0pO1xufTtcblxuTG9jYWxTdG9yYWdlQ29yZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBjYWxsYmFja2lmeShjYWxsYmFjaywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBzdG9yYWdlLmdldEl0ZW0oc2VsZi5fcHJlZml4ICsga2V5KTtcbiAgfSk7XG59O1xuXG5Mb2NhbFN0b3JhZ2VDb3JlLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoa2V5LCBjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGNhbGxiYWNraWZ5KGNhbGxiYWNrLCBmdW5jdGlvbiAoKSB7XG4gICAgc3RvcmFnZS5yZW1vdmVJdGVtKHNlbGYuX3ByZWZpeCArIGtleSk7XG4gIH0pO1xufTtcblxuTG9jYWxTdG9yYWdlQ29yZS5kZXN0cm95ID0gZnVuY3Rpb24gKGRibmFtZSwgY2FsbGJhY2spIHtcbiAgdmFyIHByZWZpeCA9IGNyZWF0ZVByZWZpeChkYm5hbWUpO1xuICBjYWxsYmFja2lmeShjYWxsYmFjaywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBrZXlzVG9EZWxldGUgPSBbXTtcbiAgICB2YXIgaSA9IC0xO1xuICAgIHZhciBsZW4gPSBzdG9yYWdlLmxlbmd0aDtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICB2YXIga2V5ID0gc3RvcmFnZS5rZXkoaSk7XG4gICAgICBpZiAoa2V5LnN1YnN0cmluZygwLCBwcmVmaXgubGVuZ3RoKSA9PT0gcHJlZml4KSB7XG4gICAgICAgIGtleXNUb0RlbGV0ZS5wdXNoKGtleSk7XG4gICAgICB9XG4gICAgfVxuICAgIGtleXNUb0RlbGV0ZS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTG9jYWxTdG9yYWdlQ29yZTsiLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gYXJnc0FycmF5O1xuXG5mdW5jdGlvbiBhcmdzQXJyYXkoZnVuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgaWYgKGxlbikge1xuICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgIHZhciBpID0gLTE7XG4gICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmdW4uY2FsbCh0aGlzLCBbXSk7XG4gICAgfVxuICB9O1xufSIsIid1c2Ugc3RyaWN0JztcblxuLy8gU2ltcGxlIEZJRk8gcXVldWUgaW1wbGVtZW50YXRpb24gdG8gYXZvaWQgaGF2aW5nIHRvIGRvIHNoaWZ0KClcbi8vIG9uIGFuIGFycmF5LCB3aGljaCBpcyBzbG93LlxuXG5mdW5jdGlvbiBRdWV1ZSgpIHtcbiAgdGhpcy5sZW5ndGggPSAwO1xufVxuXG5RdWV1ZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChpdGVtKSB7XG4gIHZhciBub2RlID0ge2l0ZW06IGl0ZW19O1xuICBpZiAodGhpcy5sYXN0KSB7XG4gICAgdGhpcy5sYXN0ID0gdGhpcy5sYXN0Lm5leHQgPSBub2RlO1xuICB9IGVsc2Uge1xuICAgIHRoaXMubGFzdCA9IHRoaXMuZmlyc3QgPSBub2RlO1xuICB9XG4gIHRoaXMubGVuZ3RoKys7XG59O1xuXG5RdWV1ZS5wcm90b3R5cGUuc2hpZnQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBub2RlID0gdGhpcy5maXJzdDtcbiAgaWYgKG5vZGUpIHtcbiAgICB0aGlzLmZpcnN0ID0gbm9kZS5uZXh0O1xuICAgIGlmICghKC0tdGhpcy5sZW5ndGgpKSB7XG4gICAgICB0aGlzLmxhc3QgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBub2RlLml0ZW07XG4gIH1cbn07XG5cblF1ZXVlLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHN0YXJ0ID0gdHlwZW9mIHN0YXJ0ID09PSAndW5kZWZpbmVkJyA/IDAgOiBzdGFydDtcbiAgZW5kID0gdHlwZW9mIGVuZCA9PT0gJ3VuZGVmaW5lZCcgPyBJbmZpbml0eSA6IGVuZDtcblxuICB2YXIgb3V0cHV0ID0gW107XG5cbiAgdmFyIGkgPSAwO1xuICBmb3IgKHZhciBub2RlID0gdGhpcy5maXJzdDsgbm9kZTsgbm9kZSA9IG5vZGUubmV4dCkge1xuICAgIGlmICgtLWVuZCA8IDApIHtcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSBpZiAoKytpID4gc3RhcnQpIHtcbiAgICAgIG91dHB1dC5wdXNoKG5vZGUuaXRlbSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKTtcbnZhciBRdWV1ZSA9IHJlcXVpcmUoJ3RpbnktcXVldWUnKTtcblxuLy8gc2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE1MzQ5ODY1LzY4MDc0MlxudmFyIG5leHRUaWNrID0gZ2xvYmFsLnNldEltbWVkaWF0ZSB8fCBwcm9jZXNzLm5leHRUaWNrO1xuXG5mdW5jdGlvbiBUYXNrUXVldWUoKSB7XG4gIHRoaXMucXVldWUgPSBuZXcgUXVldWUoKTtcbiAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG59XG5cblRhc2tRdWV1ZS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKGZ1biwgY2FsbGJhY2spIHtcbiAgdGhpcy5xdWV1ZS5wdXNoKHtmdW46IGZ1biwgY2FsbGJhY2s6IGNhbGxiYWNrfSk7XG4gIHRoaXMucHJvY2Vzc05leHQoKTtcbn07XG5cblRhc2tRdWV1ZS5wcm90b3R5cGUucHJvY2Vzc05leHQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgaWYgKHNlbGYucnVubmluZyB8fCAhc2VsZi5xdWV1ZS5sZW5ndGgpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2VsZi5ydW5uaW5nID0gdHJ1ZTtcblxuICB2YXIgdGFzayA9IHNlbGYucXVldWUuc2hpZnQoKTtcbiAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgIHRhc2suZnVuKGFyZ3NhcnJheShmdW5jdGlvbiAoYXJncykge1xuICAgICAgdGFzay5jYWxsYmFjay5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIHNlbGYucnVubmluZyA9IGZhbHNlO1xuICAgICAgc2VsZi5wcm9jZXNzTmV4dCgpO1xuICAgIH0pKTtcbiAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRhc2tRdWV1ZTtcbiIsInZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXJcblxudmFyIENIQVJTID0gJy5QWUZHQ1JMQU9FVUlESFROU1FKS1hCTVdWWl9weWZnY3JsYW9ldWlkaHRuc3Fqa3hibXd2ejEyMzQ1Njc4OTAnXG4gIC5zcGxpdCgnJykuc29ydCgpLmpvaW4oJycpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNoYXJzLCBleHBvcnRzKSB7XG4gIGNoYXJzID0gY2hhcnMgfHwgQ0hBUlNcbiAgZXhwb3J0cyA9IGV4cG9ydHMgfHwge31cbiAgaWYoY2hhcnMubGVuZ3RoICE9PSA2NCkgdGhyb3cgbmV3IEVycm9yKCdhIGJhc2UgNjQgZW5jb2RpbmcgcmVxdWlyZXMgNjQgY2hhcnMnKVxuXG4gIHZhciBjb2RlVG9JbmRleCA9IG5ldyBCdWZmZXIoMTI4KVxuICBjb2RlVG9JbmRleC5maWxsKClcblxuICBmb3IodmFyIGkgPSAwOyBpIDwgNjQ7IGkrKykge1xuICAgIHZhciBjb2RlID0gY2hhcnMuY2hhckNvZGVBdChpKVxuICAgIGNvZGVUb0luZGV4W2NvZGVdID0gaVxuICB9XG5cbiAgZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgdmFyIHMgPSAnJywgbCA9IGRhdGEubGVuZ3RoLCBoYW5nID0gMFxuICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIgdiA9IGRhdGFbaV1cblxuICAgICAgICBzd2l0Y2ggKGkgJSAzKSB7XG4gICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgcyArPSBjaGFyc1t2ID4+IDJdXG4gICAgICAgICAgICBoYW5nID0gKHYgJiAzKSA8PCA0XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgcyArPSBjaGFyc1toYW5nIHwgdiA+PiA0XVxuICAgICAgICAgICAgaGFuZyA9ICh2ICYgMHhmKSA8PCAyXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgcyArPSBjaGFyc1toYW5nIHwgdiA+PiA2XVxuICAgICAgICAgICAgcyArPSBjaGFyc1t2ICYgMHgzZl1cbiAgICAgICAgICAgIGhhbmcgPSAwXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgfVxuICAgICAgaWYobCUzKSBzICs9IGNoYXJzW2hhbmddXG4gICAgICByZXR1cm4gc1xuICAgIH1cbiAgZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgICB2YXIgbCA9IHN0ci5sZW5ndGgsIGogPSAwXG4gICAgICB2YXIgYiA9IG5ldyBCdWZmZXIofn4oKGwvNCkqMykpLCBoYW5nID0gMFxuXG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciB2ID0gY29kZVRvSW5kZXhbc3RyLmNoYXJDb2RlQXQoaSldXG5cbiAgICAgICAgc3dpdGNoIChpICUgNCkge1xuICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgIGhhbmcgPSB2IDw8IDI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgYltqKytdID0gaGFuZyB8IHYgPj4gNFxuICAgICAgICAgICAgaGFuZyA9ICh2IDw8IDQpICYgMHhmZlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIGJbaisrXSA9IGhhbmcgfCB2ID4+IDJcbiAgICAgICAgICAgIGhhbmcgPSAodiA8PCA2KSAmIDB4ZmZcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBiW2orK10gPSBoYW5nIHwgdlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgIH1cbiAgICAgIHJldHVybiBiXG4gICAgfVxuICByZXR1cm4gZXhwb3J0c1xufVxuXG5tb2R1bGUuZXhwb3J0cyhDSEFSUywgbW9kdWxlLmV4cG9ydHMpXG5cbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gQXJyYXlCdWZmZXIvVWludDhBcnJheSBhcmUgb2xkIGZvcm1hdHMgdGhhdCBkYXRlIGJhY2sgdG8gYmVmb3JlIHdlXG4vLyBoYWQgYSBwcm9wZXIgYnJvd3NlcmlmaWVkIGJ1ZmZlciB0eXBlLiB0aGV5IG1heSBiZSByZW1vdmVkIGxhdGVyXG52YXIgYXJyYXlCdWZmUHJlZml4ID0gJ0FycmF5QnVmZmVyOic7XG52YXIgYXJyYXlCdWZmUmVnZXggPSBuZXcgUmVnRXhwKCdeJyArIGFycmF5QnVmZlByZWZpeCk7XG52YXIgdWludFByZWZpeCA9ICdVaW50OEFycmF5Oic7XG52YXIgdWludFJlZ2V4ID0gbmV3IFJlZ0V4cCgnXicgKyB1aW50UHJlZml4KTtcblxuLy8gdGhpcyBpcyB0aGUgbmV3IGVuY29kaW5nIGZvcm1hdCB1c2VkIGdvaW5nIGZvcndhcmRcbnZhciBidWZmZXJQcmVmaXggPSAnQnVmZjonO1xudmFyIGJ1ZmZlclJlZ2V4ID0gbmV3IFJlZ0V4cCgnXicgKyBidWZmZXJQcmVmaXgpO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgTG9jYWxTdG9yYWdlQ29yZSA9IHJlcXVpcmUoJy4vbG9jYWxzdG9yYWdlLWNvcmUnKTtcbnZhciBUYXNrUXVldWUgPSByZXF1aXJlKCcuL3Rhc2txdWV1ZScpO1xudmFyIGQ2NCA9IHJlcXVpcmUoJ2Q2NCcpO1xuXG5mdW5jdGlvbiBMb2NhbFN0b3JhZ2UoZGJuYW1lKSB7XG4gIHRoaXMuX3N0b3JlID0gbmV3IExvY2FsU3RvcmFnZUNvcmUoZGJuYW1lKTtcbiAgdGhpcy5fcXVldWUgPSBuZXcgVGFza1F1ZXVlKCk7XG59XG5cbkxvY2FsU3RvcmFnZS5wcm90b3R5cGUuc2VxdWVudGlhbGl6ZSA9IGZ1bmN0aW9uIChjYWxsYmFjaywgZnVuKSB7XG4gIHRoaXMuX3F1ZXVlLmFkZChmdW4sIGNhbGxiYWNrKTtcbn07XG5cbkxvY2FsU3RvcmFnZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuc2VxdWVudGlhbGl6ZShjYWxsYmFjaywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgc2VsZi5fc3RvcmUuZ2V0S2V5cyhmdW5jdGlvbiAoZXJyLCBrZXlzKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgICAgc2VsZi5fa2V5cyA9IGtleXM7XG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG5Mb2NhbFN0b3JhZ2UucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLnNlcXVlbnRpYWxpemUoY2FsbGJhY2ssIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHNlbGYuX3N0b3JlLmdldEtleXMoZnVuY3Rpb24gKGVyciwga2V5cykge1xuICAgICAgY2FsbGJhY2sobnVsbCwga2V5cy5zbGljZSgpKTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vL3NldEl0ZW06IFNhdmVzIGFuZCBpdGVtIGF0IHRoZSBrZXkgcHJvdmlkZWQuXG5Mb2NhbFN0b3JhZ2UucHJvdG90eXBlLnNldEl0ZW0gPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLnNlcXVlbnRpYWxpemUoY2FsbGJhY2ssIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsdWUpKSB7XG4gICAgICB2YWx1ZSA9IGJ1ZmZlclByZWZpeCArIGQ2NC5lbmNvZGUodmFsdWUpO1xuICAgIH1cblxuICAgIHZhciBpZHggPSB1dGlscy5zb3J0ZWRJbmRleE9mKHNlbGYuX2tleXMsIGtleSk7XG4gICAgaWYgKHNlbGYuX2tleXNbaWR4XSAhPT0ga2V5KSB7XG4gICAgICBzZWxmLl9rZXlzLnNwbGljZShpZHgsIDAsIGtleSk7XG4gICAgfVxuICAgIHNlbGYuX3N0b3JlLnB1dChrZXksIHZhbHVlLCBjYWxsYmFjayk7XG4gIH0pO1xufTtcblxuLy9nZXRJdGVtOiBSZXR1cm5zIHRoZSBpdGVtIGlkZW50aWZpZWQgYnkgaXQncyBrZXkuXG5Mb2NhbFN0b3JhZ2UucHJvdG90eXBlLmdldEl0ZW0gPSBmdW5jdGlvbiAoa2V5LCBjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuc2VxdWVudGlhbGl6ZShjYWxsYmFjaywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgc2VsZi5fc3RvcmUuZ2V0KGtleSwgZnVuY3Rpb24gKGVyciwgcmV0dmFsKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiByZXR2YWwgPT09ICd1bmRlZmluZWQnIHx8IHJldHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAvLyAnTm90Rm91bmQnIGVycm9yLCBjb25zaXN0ZW50IHdpdGggTGV2ZWxET1dOIEFQSVxuICAgICAgICByZXR1cm4gY2FsbGJhY2sobmV3IEVycm9yKCdOb3RGb3VuZCcpKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgcmV0dmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAoYnVmZmVyUmVnZXgudGVzdChyZXR2YWwpKSB7XG4gICAgICAgICAgcmV0dmFsID0gZDY0LmRlY29kZShyZXR2YWwuc3Vic3RyaW5nKGJ1ZmZlclByZWZpeC5sZW5ndGgpKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcnJheUJ1ZmZSZWdleC50ZXN0KHJldHZhbCkpIHtcbiAgICAgICAgICAvLyB0aGlzIHR5cGUgaXMga2VwdCBmb3IgYmFja3dhcmRzXG4gICAgICAgICAgLy8gY29tcGF0aWJpbGl0eSB3aXRoIG9sZGVyIGRhdGFiYXNlcywgYnV0IG1heSBiZSByZW1vdmVkXG4gICAgICAgICAgLy8gYWZ0ZXIgYSBtYWpvciB2ZXJzaW9uIGJ1bXBcbiAgICAgICAgICByZXR2YWwgPSByZXR2YWwuc3Vic3RyaW5nKGFycmF5QnVmZlByZWZpeC5sZW5ndGgpO1xuICAgICAgICAgIHJldHZhbCA9IG5ldyBBcnJheUJ1ZmZlcihhdG9iKHJldHZhbCkuc3BsaXQoJycpLm1hcChmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgcmV0dXJuIGMuY2hhckNvZGVBdCgwKTtcbiAgICAgICAgICB9KSk7XG4gICAgICAgIH0gZWxzZSBpZiAodWludFJlZ2V4LnRlc3QocmV0dmFsKSkge1xuICAgICAgICAgIC8vIGRpdHRvXG4gICAgICAgICAgcmV0dmFsID0gcmV0dmFsLnN1YnN0cmluZyh1aW50UHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgcmV0dmFsID0gbmV3IFVpbnQ4QXJyYXkoYXRvYihyZXR2YWwpLnNwbGl0KCcnKS5tYXAoZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIHJldHVybiBjLmNoYXJDb2RlQXQoMCk7XG4gICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCByZXR2YWwpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8vcmVtb3ZlSXRlbTogUmVtb3ZlcyB0aGUgaXRlbSBpZGVudGlmaWVkIGJ5IGl0J3Mga2V5LlxuTG9jYWxTdG9yYWdlLnByb3RvdHlwZS5yZW1vdmVJdGVtID0gZnVuY3Rpb24gKGtleSwgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLnNlcXVlbnRpYWxpemUoY2FsbGJhY2ssIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBpZHggPSB1dGlscy5zb3J0ZWRJbmRleE9mKHNlbGYuX2tleXMsIGtleSk7XG4gICAgaWYgKHNlbGYuX2tleXNbaWR4XSA9PT0ga2V5KSB7XG4gICAgICBzZWxmLl9rZXlzLnNwbGljZShpZHgsIDEpO1xuICAgICAgc2VsZi5fc3RvcmUucmVtb3ZlKGtleSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5Mb2NhbFN0b3JhZ2UucHJvdG90eXBlLmxlbmd0aCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuc2VxdWVudGlhbGl6ZShjYWxsYmFjaywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgc2VsZi5fa2V5cy5sZW5ndGgpO1xuICB9KTtcbn07XG5cbmV4cG9ydHMuTG9jYWxTdG9yYWdlID0gTG9jYWxTdG9yYWdlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xudmFyIGJ1ZmZlckZyb20gPSByZXF1aXJlKCdidWZmZXItZnJvbScpO1xudmFyIEFic3RyYWN0TGV2ZWxET1dOID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RMZXZlbERPV047XG52YXIgQWJzdHJhY3RJdGVyYXRvciA9IHJlcXVpcmUoJ2Fic3RyYWN0LWxldmVsZG93bicpLkFic3RyYWN0SXRlcmF0b3I7XG5cbnZhciBMb2NhbFN0b3JhZ2UgPSByZXF1aXJlKCcuL2xvY2Fsc3RvcmFnZScpLkxvY2FsU3RvcmFnZTtcbnZhciBMb2NhbFN0b3JhZ2VDb3JlID0gcmVxdWlyZSgnLi9sb2NhbHN0b3JhZ2UtY29yZScpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG4vLyBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTUzNDk4NjUvNjgwNzQyXG52YXIgbmV4dFRpY2sgPSBnbG9iYWwuc2V0SW1tZWRpYXRlIHx8IHByb2Nlc3MubmV4dFRpY2s7XG5cbmZ1bmN0aW9uIExESXRlcmF0b3IoZGIsIG9wdGlvbnMpIHtcblxuICBBYnN0cmFjdEl0ZXJhdG9yLmNhbGwodGhpcywgZGIpO1xuXG4gIHRoaXMuX3JldmVyc2UgPSAhIW9wdGlvbnMucmV2ZXJzZTtcbiAgdGhpcy5fZW5ka2V5ICAgICA9IG9wdGlvbnMuZW5kO1xuICB0aGlzLl9zdGFydGtleSAgID0gb3B0aW9ucy5zdGFydDtcbiAgdGhpcy5fZ3QgICAgICA9IG9wdGlvbnMuZ3Q7XG4gIHRoaXMuX2d0ZSAgICAgPSBvcHRpb25zLmd0ZTtcbiAgdGhpcy5fbHQgICAgICA9IG9wdGlvbnMubHQ7XG4gIHRoaXMuX2x0ZSAgICAgPSBvcHRpb25zLmx0ZTtcbiAgdGhpcy5fZXhjbHVzaXZlU3RhcnQgPSBvcHRpb25zLmV4Y2x1c2l2ZVN0YXJ0O1xuICB0aGlzLl9rZXlzT25seSA9IG9wdGlvbnMudmFsdWVzID09PSBmYWxzZTtcbiAgdGhpcy5fbGltaXQgPSBvcHRpb25zLmxpbWl0O1xuICB0aGlzLl9jb3VudCA9IDA7XG5cbiAgdGhpcy5vbkluaXRDb21wbGV0ZUxpc3RlbmVycyA9IFtdO1xufVxuXG5pbmhlcml0cyhMREl0ZXJhdG9yLCBBYnN0cmFjdEl0ZXJhdG9yKTtcblxuTERJdGVyYXRvci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgIGNhbGxiYWNrKCk7XG4gIH0pO1xufTtcblxuTERJdGVyYXRvci5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGZ1bmN0aW9uIG9uSW5pdENvbXBsZXRlKCkge1xuICAgIGlmIChzZWxmLl9wb3MgPT09IHNlbGYuX2tleXMubGVuZ3RoIHx8IHNlbGYuX3BvcyA8IDApIHsgLy8gZG9uZSByZWFkaW5nXG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICB2YXIga2V5ID0gc2VsZi5fa2V5c1tzZWxmLl9wb3NdO1xuXG4gICAgaWYgKCEhc2VsZi5fZW5ka2V5ICYmIChzZWxmLl9yZXZlcnNlID8ga2V5IDwgc2VsZi5fZW5ka2V5IDoga2V5ID4gc2VsZi5fZW5ka2V5KSkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgaWYgKCEhc2VsZi5fbGltaXQgJiYgc2VsZi5fbGltaXQgPiAwICYmIHNlbGYuX2NvdW50KysgPj0gc2VsZi5fbGltaXQpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH1cblxuICAgIGlmICgoc2VsZi5fbHQgICYmIGtleSA+PSBzZWxmLl9sdCkgfHxcbiAgICAgIChzZWxmLl9sdGUgJiYga2V5ID4gc2VsZi5fbHRlKSB8fFxuICAgICAgKHNlbGYuX2d0ICAmJiBrZXkgPD0gc2VsZi5fZ3QpIHx8XG4gICAgICAoc2VsZi5fZ3RlICYmIGtleSA8IHNlbGYuX2d0ZSkpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH1cblxuICAgIHNlbGYuX3BvcyArPSBzZWxmLl9yZXZlcnNlID8gLTEgOiAxO1xuICAgIGlmIChzZWxmLl9rZXlzT25seSkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIGtleSk7XG4gICAgfVxuXG4gICAgc2VsZi5kYi5jb250YWluZXIuZ2V0SXRlbShrZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIubWVzc2FnZSA9PT0gJ05vdEZvdW5kJykge1xuICAgICAgICAgIHJldHVybiBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLl9uZXh0KGNhbGxiYWNrKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKG51bGwsIGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG4gIGlmICghc2VsZi5pbml0U3RhcnRlZCkge1xuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5pbml0U3RhcnRlZCA9IHRydWU7XG4gICAgICBzZWxmLl9pbml0KGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuZGIuY29udGFpbmVyLmtleXMoZnVuY3Rpb24gKGVyciwga2V5cykge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLl9rZXlzID0ga2V5cztcbiAgICAgICAgICBpZiAoc2VsZi5fc3RhcnRrZXkpIHtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHV0aWxzLnNvcnRlZEluZGV4T2Yoc2VsZi5fa2V5cywgc2VsZi5fc3RhcnRrZXkpO1xuICAgICAgICAgICAgdmFyIHN0YXJ0a2V5ID0gKGluZGV4ID49IHNlbGYuX2tleXMubGVuZ3RoIHx8IGluZGV4IDwgMCkgP1xuICAgICAgICAgICAgICB1bmRlZmluZWQgOiBzZWxmLl9rZXlzW2luZGV4XTtcbiAgICAgICAgICAgIHNlbGYuX3BvcyA9IGluZGV4O1xuICAgICAgICAgICAgaWYgKHNlbGYuX3JldmVyc2UpIHtcbiAgICAgICAgICAgICAgaWYgKHNlbGYuX2V4Y2x1c2l2ZVN0YXJ0IHx8IHN0YXJ0a2V5ICE9PSBzZWxmLl9zdGFydGtleSkge1xuICAgICAgICAgICAgICAgIHNlbGYuX3Bvcy0tO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNlbGYuX2V4Y2x1c2l2ZVN0YXJ0ICYmIHN0YXJ0a2V5ID09PSBzZWxmLl9zdGFydGtleSkge1xuICAgICAgICAgICAgICBzZWxmLl9wb3MrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5fcG9zID0gc2VsZi5fcmV2ZXJzZSA/IHNlbGYuX2tleXMubGVuZ3RoIC0gMSA6IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9uSW5pdENvbXBsZXRlKCk7XG5cbiAgICAgICAgICBzZWxmLmluaXRDb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICAgIHZhciBpID0gLTE7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IHNlbGYub25Jbml0Q29tcGxldGVMaXN0ZW5lcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBuZXh0VGljayhzZWxmLm9uSW5pdENvbXBsZXRlTGlzdGVuZXJzW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAoIXNlbGYuaW5pdENvbXBsZXRlZCkge1xuICAgIHNlbGYub25Jbml0Q29tcGxldGVMaXN0ZW5lcnMucHVzaChvbkluaXRDb21wbGV0ZSk7XG4gIH0gZWxzZSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhvbkluaXRDb21wbGV0ZSk7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIExEKGxvY2F0aW9uKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBMRCkpIHtcbiAgICByZXR1cm4gbmV3IExEKGxvY2F0aW9uKTtcbiAgfVxuICBBYnN0cmFjdExldmVsRE9XTi5jYWxsKHRoaXMsIGxvY2F0aW9uKTtcbiAgdGhpcy5jb250YWluZXIgPSBuZXcgTG9jYWxTdG9yYWdlKGxvY2F0aW9uKTtcbn1cblxuaW5oZXJpdHMoTEQsIEFic3RyYWN0TGV2ZWxET1dOKTtcblxuTEQucHJvdG90eXBlLl9vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHRoaXMuY29udGFpbmVyLmluaXQoY2FsbGJhY2spO1xufTtcblxuTEQucHJvdG90eXBlLl9wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgb3B0aW9ucywgY2FsbGJhY2spIHtcblxuICB2YXIgZXJyID0gY2hlY2tLZXlWYWx1ZShrZXksICdrZXknKTtcblxuICBpZiAoZXJyKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSk7XG4gIH1cblxuICBlcnIgPSBjaGVja0tleVZhbHVlKHZhbHVlLCAndmFsdWUnKTtcblxuICBpZiAoZXJyKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSk7XG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQnVmZmVyLmlzQnVmZmVyKHZhbHVlKSAmJiB2YWx1ZS5idWZmZXIgPT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICBvYmouc3RvcmV0eXBlID0gXCJqc29uXCI7XG4gICAgb2JqLmRhdGEgPSB2YWx1ZTtcbiAgICB2YWx1ZSA9IEpTT04uc3RyaW5naWZ5KG9iaik7XG4gIH1cblxuICB0aGlzLmNvbnRhaW5lci5zZXRJdGVtKGtleSwgdmFsdWUsIGNhbGxiYWNrKTtcbn07XG5cbkxELnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcblxuICB2YXIgZXJyID0gY2hlY2tLZXlWYWx1ZShrZXksICdrZXknKTtcblxuICBpZiAoZXJyKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSk7XG4gIH1cblxuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihrZXkpKSB7XG4gICAga2V5ID0gU3RyaW5nKGtleSk7XG4gIH1cbiAgdGhpcy5jb250YWluZXIuZ2V0SXRlbShrZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG5cbiAgICBpZiAoZXJyKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5hc0J1ZmZlciAhPT0gZmFsc2UgJiYgIUJ1ZmZlci5pc0J1ZmZlcih2YWx1ZSkpIHtcbiAgICAgIHZhbHVlID0gYnVmZmVyRnJvbSh2YWx1ZSk7XG4gICAgfVxuXG5cbiAgICBpZiAob3B0aW9ucy5hc0J1ZmZlciA9PT0gZmFsc2UpIHtcbiAgICAgIGlmICh2YWx1ZS5pbmRleE9mKFwie1xcXCJzdG9yZXR5cGVcXFwiOlxcXCJqc29uXFxcIixcXFwiZGF0YVxcXCJcIikgPiAtMSkge1xuICAgICAgICB2YXIgcmVzID0gSlNPTi5wYXJzZSh2YWx1ZSk7XG4gICAgICAgIHZhbHVlID0gcmVzLmRhdGE7XG4gICAgICB9XG4gICAgfVxuICAgIGNhbGxiYWNrKG51bGwsIHZhbHVlKTtcbiAgfSk7XG59O1xuXG5MRC5wcm90b3R5cGUuX2RlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG5cbiAgdmFyIGVyciA9IGNoZWNrS2V5VmFsdWUoa2V5LCAna2V5Jyk7XG5cbiAgaWYgKGVycikge1xuICAgIHJldHVybiBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH0pO1xuICB9XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGtleSkpIHtcbiAgICBrZXkgPSBTdHJpbmcoa2V5KTtcbiAgfVxuXG4gIHRoaXMuY29udGFpbmVyLnJlbW92ZUl0ZW0oa2V5LCBjYWxsYmFjayk7XG59O1xuXG5MRC5wcm90b3R5cGUuX2JhdGNoID0gZnVuY3Rpb24gKGFycmF5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXJyO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIHZhbHVlO1xuXG4gICAgdmFyIG51bURvbmUgPSAwO1xuICAgIHZhciBvdmVyYWxsRXJyO1xuICAgIGZ1bmN0aW9uIGNoZWNrRG9uZSgpIHtcbiAgICAgIGlmICgrK251bURvbmUgPT09IGFycmF5Lmxlbmd0aCkge1xuICAgICAgICBjYWxsYmFjayhvdmVyYWxsRXJyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShhcnJheSkgJiYgYXJyYXkubGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciB0YXNrID0gYXJyYXlbaV07XG4gICAgICAgIGlmICh0YXNrKSB7XG4gICAgICAgICAga2V5ID0gQnVmZmVyLmlzQnVmZmVyKHRhc2sua2V5KSA/IHRhc2sua2V5IDogU3RyaW5nKHRhc2sua2V5KTtcbiAgICAgICAgICBlcnIgPSBjaGVja0tleVZhbHVlKGtleSwgJ2tleScpO1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIG92ZXJhbGxFcnIgPSBlcnI7XG4gICAgICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRhc2sudHlwZSA9PT0gJ2RlbCcpIHtcbiAgICAgICAgICAgIHNlbGYuX2RlbCh0YXNrLmtleSwgb3B0aW9ucywgY2hlY2tEb25lKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRhc2sudHlwZSA9PT0gJ3B1dCcpIHtcbiAgICAgICAgICAgIHZhbHVlID0gQnVmZmVyLmlzQnVmZmVyKHRhc2sudmFsdWUpID8gdGFzay52YWx1ZSA6IFN0cmluZyh0YXNrLnZhbHVlKTtcbiAgICAgICAgICAgIGVyciA9IGNoZWNrS2V5VmFsdWUodmFsdWUsICd2YWx1ZScpO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBvdmVyYWxsRXJyID0gZXJyO1xuICAgICAgICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHNlbGYuX3B1dChrZXksIHZhbHVlLCBvcHRpb25zLCBjaGVja0RvbmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5MRC5wcm90b3R5cGUuX2l0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMREl0ZXJhdG9yKHRoaXMsIG9wdGlvbnMpO1xufTtcblxuTEQuZGVzdHJveSA9IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaykge1xuICBMb2NhbFN0b3JhZ2VDb3JlLmRlc3Ryb3kobmFtZSwgY2FsbGJhY2spO1xufTtcblxuZnVuY3Rpb24gY2hlY2tLZXlWYWx1ZShvYmosIHR5cGUpIHtcbiAgaWYgKG9iaiA9PT0gbnVsbCB8fCBvYmogPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBuZXcgRXJyb3IodHlwZSArICcgY2Fubm90IGJlIGBudWxsYCBvciBgdW5kZWZpbmVkYCcpO1xuICB9XG4gIGlmIChvYmogPT09IG51bGwgfHwgb2JqID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKHR5cGUgKyAnIGNhbm5vdCBiZSBgbnVsbGAgb3IgYHVuZGVmaW5lZGAnKTtcbiAgfVxuXG4gIGlmICh0eXBlID09PSAna2V5Jykge1xuXG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIEJvb2xlYW4pIHtcbiAgICAgIHJldHVybiBuZXcgRXJyb3IodHlwZSArICcgY2Fubm90IGJlIGBudWxsYCBvciBgdW5kZWZpbmVkYCcpO1xuICAgIH1cbiAgICBpZiAob2JqID09PSAnJykge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgZW1wdHknKTtcbiAgICB9XG4gIH1cbiAgaWYgKG9iai50b1N0cmluZygpLmluZGV4T2YoXCJbb2JqZWN0IEFycmF5QnVmZmVyXVwiKSA9PT0gMCkge1xuICAgIGlmIChvYmouYnl0ZUxlbmd0aCA9PT0gMCB8fCBvYmouYnl0ZUxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbmV3IEVycm9yKHR5cGUgKyAnIGNhbm5vdCBiZSBhbiBlbXB0eSBCdWZmZXInKTtcbiAgICB9XG4gIH1cblxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iaikpIHtcbiAgICBpZiAob2JqLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYW4gZW1wdHkgQnVmZmVyJyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKFN0cmluZyhvYmopID09PSAnJykge1xuICAgIHJldHVybiBuZXcgRXJyb3IodHlwZSArICcgY2Fubm90IGJlIGFuIGVtcHR5IFN0cmluZycpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gTEQ7XG4iLCJpbXBvcnQgQ29yZUxldmVsUG91Y2ggZnJvbSAncG91Y2hkYi1hZGFwdGVyLWxldmVsZGItY29yZSc7XG5pbXBvcnQgbG9jYWxzdG9yYWdlZG93biBmcm9tICdsb2NhbHN0b3JhZ2UtZG93bic7XG5cbmZ1bmN0aW9uIExvY2FsU3RvcmFnZVBvdWNoKG9wdHMsIGNhbGxiYWNrKSB7XG4gIHZhciBfb3B0cyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGRiOiBsb2NhbHN0b3JhZ2Vkb3duXG4gIH0sIG9wdHMpO1xuXG4gIENvcmVMZXZlbFBvdWNoLmNhbGwodGhpcywgX29wdHMsIGNhbGxiYWNrKTtcbn1cblxuLy8gb3ZlcnJpZGVzIGZvciBub3JtYWwgTGV2ZWxEQiBiZWhhdmlvciBvbiBOb2RlXG5Mb2NhbFN0b3JhZ2VQb3VjaC52YWxpZCA9ICgpID0+IHR5cGVvZiBsb2NhbFN0b3JhZ2UgIT09ICd1bmRlZmluZWQnO1xuTG9jYWxTdG9yYWdlUG91Y2gudXNlX3ByZWZpeCA9IHRydWU7XG5cbmNvbnN0IGxvY2Fsc3RvcmFnZUFkYXB0ZXIgPSAoUG91Y2hEQikgPT4ge1xuICBQb3VjaERCLmFkYXB0ZXIoJ2xvY2Fsc3RvcmFnZScsIExvY2FsU3RvcmFnZVBvdWNoLCB0cnVlKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGxvY2Fsc3RvcmFnZUFkYXB0ZXI7Il0sIm5hbWVzIjpbImJ1ZmZlckZyb20iLCJ4dGVuZCIsIkFic3RyYWN0SXRlcmF0b3IiLCJBYnN0cmFjdENoYWluZWRCYXRjaCIsInJlcXVpcmUkJDAiLCJyZXF1aXJlJCQxIiwicmVxdWlyZSQkMiIsIkFic3RyYWN0TGV2ZWxET1dOIiwidXRpbHMiLCJhcGlNb2R1bGUiLCJnbG9iYWwiLCJsaWIiLCJuZXh0VGljayIsIkxvY2FsU3RvcmFnZUNvcmUiLCJhcmdzYXJyYXkiLCJRdWV1ZSIsIlRhc2tRdWV1ZSIsInJlcXVpcmUkJDMiLCJMb2NhbFN0b3JhZ2UiLCJyZXF1aXJlJCQ0IiwicmVxdWlyZSQkNSIsIkNvcmVMZXZlbFBvdWNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFJLFFBQVEsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVE7QUFDeEM7QUFDQSxJQUFJLFFBQVE7QUFDWixFQUFFLE9BQU8sTUFBTSxDQUFDLEtBQUssS0FBSyxVQUFVO0FBQ3BDLEVBQUUsT0FBTyxNQUFNLENBQUMsV0FBVyxLQUFLLFVBQVU7QUFDMUMsRUFBRSxPQUFPLE1BQU0sQ0FBQyxJQUFJLEtBQUssVUFBVTtBQUNuQyxFQUFDO0FBQ0Q7QUFDQSxTQUFTLGFBQWEsRUFBRSxLQUFLLEVBQUU7QUFDL0IsRUFBRSxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLGFBQWE7QUFDNUQsQ0FBQztBQUNEO0FBQ0EsU0FBUyxlQUFlLEVB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QUFFO0FBQ3ZFLEVBQUUsSUFBSSxJQUFJLEdBQUcsS0FBSTtBQUNqQjtBQUNBLEVBQUUsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDMUI7QUFDQSxHQUFHLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUU7QUFDckUsSUFBSSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQztBQUMzRSxNQUFNLE9BQU8sT0FBTyxDQUFDLENBQUMsRUFBQztBQUN2QixHQUFHLEVBQUM7QUFDSjtBQUNBLEVBQUUsT0FBTyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQU87QUFDckM7QUFDQTtBQUNBLEVBQUUsSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxFQUFFO0FBQ25DLElBQUksT0FBTyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRTtBQUM5QixFQUFFLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRztBQUNwQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUc7QUFDL0IsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsRUFBRTtBQUNwQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUU7QUFDOUIsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRztBQUNyQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUc7QUFDL0I7QUFDQSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxF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TUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO0FBQzFELE1BQU0sT0FBTyxRQUFRLEVBQUUsQ0FBQztBQUN4QixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3BDO0FBQ0EsSUFBSSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUNyRixNQUFNLE9BQU8sUUFBUSxFQUFFLENBQUM7QUFDeEIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQzFFLE1BQU0sT0FBTyxRQUFRLEVBQUUsQ0FBQztBQUN4QixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRztBQUNyQyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDcEMsT0FBTyxJQUFJLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQ3BDLE9BQU8sSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ3RDLE1BQU0sT0FBTyxRQUFRLEVBQUUsQ0FBQztBQUN4QixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDeEMsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDeEIsTUFBTSxPQUFPLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDakMsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsR0FBRyxFQUFFLEtBQUssRUFBRTtBQUN6RCxNQUFNLElBQUksR0FBRyxFQUFFO0FBQ2YsUUFBUSxJQUFJLEdBQUcsQ0FBQyxPQUFPLEtBQUssVUFBVSxFQUFFO0FBQ3hDLFVBQVUsT0FBTyxRQUFRLENBQUMsWUFBWTtBQUN0QyxZQUFZLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDakMsV0FBVyxDQUFDLENBQUM7QUFDYixTQUFTO0FBQ1QsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixPQUFPO0FBQ1AsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNqQyxLQUFLLENBQUMsQ0FBQztBQUNQLEdBQUc7QUFDSCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO0FBQ3pCLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxZQUFZO0FBQ2pDLE1BQU0sSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7QUFDOUIsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ2hDLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDakIsVUFBVSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMvQixTQUFTO0FBQ1QsUUFBUSxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsSUFBSSxFQUFFO0FBQ3BELFVBQVUsSUFBSSxHQUFHLEVBQUU7QUFDbkIsWUFBWSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNqQyxXQUFXO0FBQ1gsVUFBVSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztBQUM1QixVQUFVLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtBQUM5QixZQUFZLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDeEUsWUFBWSxJQUFJLFFBQVEsR0FBRyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLEdBQUcsQ0FBQztBQUNuRSxjQUFjLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVDLFlBQVksSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7QUFDOUIsWUFBWSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7QUFDL0IsY0FBYyxJQUFJLElBQUksQ0FBQyxlQUFlLElBQUksUUFBUSxLQUFLLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDdkUsZ0JBQWdCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUM1QixlQUFlO0FBQ2YsYUFBYSxNQUFNLElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxRQUFRLEtBQUssSUFBSSxDQUFDLFNBQVMsRUFBRTtBQUM1RSxjQUFjLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUMxQixhQUFhO0FBQ2IsV0FBVyxNQUFNO0FBQ2pCLFlBQVksSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbEUsV0FBVztBQUNYLFVBQVUsY0FBYyxFQUFFLENBQUM7QUFDM0I7QUFDQSxVQUFVLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQ3BDLFVBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDckIsVUFBVSxPQUFPLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUU7QUFDNUQsWUFBWSxRQUFRLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEQsV0FBVztBQUNYLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLENBQUMsQ0FBQztBQUNQLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtBQUNsQyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDdEQsR0FBRyxNQUFNO0FBQ1QsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQ3JDLEdBQUc7QUFDSCxDQUFDLENBQUM7QUFDRjtBQUNBLFNBQVMsRUFBRSxDQUFDLFFBQVEsRUFBRTtBQUN0QixFQUFFLElBQUksRUFBRSxJQUFJLFlBQVksRUFBRSxDQUFDLEVBQUU7QUFDN0IsSUFBSSxPQUFPLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzVCLEdBQUc7QUFDSCxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDekMsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFDRDtBQUNBLFFBQVEsQ0FBQyxFQUFFLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUNoQztBQUNBLEVBQUUsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFVBQVUsT0FBTyxFQUFFLFFBQVEsRUFBRTtBQUNsRCxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2hDLENBQUMsQ0FBQztBQUNGO0FBQ0EsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsVUFBVSxHQUFHLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUU7QUFDN0Q7QUFDQSxFQUFFLElBQUksR0FBRyxHQUFHLGFBQWEsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDdEM7QUFDQSxFQUFFLElBQUksR0FBRyxFQUFFO0FBQ1gsSUFBSSxPQUFPLFFBQVEsQ0FBQyxZQUFZO0FBQ2hDLE1BQU0sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLEtBQUssQ0FBQyxDQUFDO0FBQ1AsR0FBRztBQUNIO0FBQ0EsRUFBRSxHQUFHLEdBQUcsYUFBYSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN0QztBQUNBLEVBQUUsSUFBSSxHQUFHLEVBQUU7QUFDWCxJQUFJLE9BQU8sUUFBUSxDQUFDLFlBQVk7QUFDaEMsTUFBTSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDcEIsS0FBSyxDQUFDLENBQUM7QUFDUCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtBQUMxRixJQUFJLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUNqQixJQUFJLEdBQUcsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDO0FBQzNCLElBQUksR0FBRyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7QUFDckIsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNoQyxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDL0MsQ0FBQyxDQUFDO0FBQ0Y7QUFDQSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFVLEdBQUcsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFO0FBQ3REO0FBQ0EsRUFBRSxJQUFJLEdBQUcsR0FBRyxhQUFhLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3RDO0FBQ0EsRUFBRSxJQUFJLEdBQUcsRUFBRTtBQUNYLElBQUksT0FBTyxRQUFRLENBQUMsWUFBWTtBQUNoQyxNQUFNLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwQixLQUFLLENBQUMsQ0FBQztBQUNQLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDN0IsSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLEdBQUc7QUFDSCxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxVQUFVLEdBQUcsRUFBRSxLQUFLLEVBQUU7QUFDcEQ7QUFDQSxJQUFJLElBQUksR0FBRyxFQUFFO0FBQ2IsTUFBTSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMzQixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQy9ELE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNoQyxLQUFLO0FBQ0w7QUFDQTtBQUNBLElBQUksSUFBSSxPQUFPLENBQUMsUUFBUSxLQUFLLEtBQUssRUFBRTtBQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQ0FBa0MsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQ2xFLFFBQVEsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNwQyxRQUFRLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO0FBQ3pCLE9BQU87QUFDUCxLQUFLO0FBQ0wsSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzFCLEdBQUcsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDO0FBQ0Y7QUFDQSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFVLEdBQUcsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFO0FBQ3REO0FBQ0EsRUFBRSxJQUFJLEdBQUcsR0FBRyxhQUFhLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3RDO0FBQ0EsRUFBRSxJQUFJLEdBQUcsRUFBRTtBQUNYLElBQUksT0FBTyxRQUFRLENBQUMsWUFBWTtBQUNoQyxNQUFNLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwQixLQUFLLENBQUMsQ0FBQztBQUNQLEdBQUc7QUFDSCxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQzdCLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN0QixHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUMzQyxDQUFDLENBQUM7QUFDRjtBQUNBLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUU7QUFDMUQsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7QUFDbEIsRUFBRSxRQUFRLENBQUMsWUFBWTtBQUN2QixJQUFJLElBQUksR0FBRyxDQUFDO0FBQ1osSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNaLElBQUksSUFBSSxLQUFLLENBQUM7QUFDZDtBQUNBLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLElBQUksSUFBSSxVQUFVLENBQUM7QUFDbkIsSUFBSSxTQUFTLFNBQVMsR0FBRztBQUN6QixNQUFNLElBQUksRUFBRSxPQUFPLEtBQUssS0FBSyxDQUFDLE1BQU0sRUFBRTtBQUN0QyxRQUFRLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUM3QixPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtBQUM5QyxNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzdDLFFBQVEsSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVCLFFBQVEsSUFBSSxJQUFJLEVBQUU7QUFDbEIsVUFBVSxHQUFHLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3hFLFVBQVUsR0FBRyxHQUFHLGFBQWEsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDMUMsVUFBVSxJQUFJLEdBQUcsRUFBRTtBQUNuQixZQUFZLFVBQVUsR0FBRyxHQUFHLENBQUM7QUFDN0IsWUFBWSxTQUFTLEVBQUUsQ0FBQztBQUN4QixXQUFXLE1BQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssRUFBRTtBQUMxQyxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDcEQsV0FBVyxNQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLEVBQUU7QUFDMUMsWUFBWSxLQUFLLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2xGLFlBQVksR0FBRyxHQUFHLGFBQWEsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDaEQsWUFBWSxJQUFJLEdBQUcsRUFBRTtBQUNyQixjQUFjLFVBQVUsR0FBRyxHQUFHLENBQUM7QUFDL0IsY0FBYyxTQUFTLEVBQUUsQ0FBQztBQUMxQixhQUFhLE1BQU07QUFDbkIsY0FBYyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ3hELGFBQWE7QUFDYixXQUFXO0FBQ1gsU0FBUyxNQUFNO0FBQ2YsVUFBVSxTQUFTLEVBQUUsQ0FBQztBQUN0QixTQUFTO0FBQ1QsT0FBTztBQUNQLEtBQUssTUFBTTtBQUNYLE1BQU0sUUFBUSxFQUFFLENBQUM7QUFDakIsS0FBSztBQUNMLEdBQUcsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDO0FBQ0Y7QUFDQSxFQUFFLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxVQUFVLE9BQU8sRUFBRTtBQUM1QyxFQUFFLE9BQU8sSUFBSSxVQUFVLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZDLENBQUMsQ0FBQztBQUNGO0FBQ0EsRUFBRSxDQUFDLE9BQU8sR0FBRyxVQUFVLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDdkMsRUFBRSxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzNDLENBQUMsQ0FBQztBQUNGO0FBQ0EsU0FBUyxhQUFhLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtBQUNsQyxFQUFFLElBQUksR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLEtBQUssU0FBUyxFQUFFO0FBQ3pDLElBQUksT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLEdBQUcsa0NBQWtDLENBQUMsQ0FBQztBQUNoRSxHQUFHO0FBQ0gsRUFBRSxJQUFJLEdBQUcsS0FBSyxJQUFJLElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRTtBQUN6QyxJQUFJLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLGtDQUFrQyxDQUFDLENBQUM7QUFDaEUsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksS0FBSyxLQUFLLEVBQUU7QUFDdEI7QUFDQSxJQUFJLElBQUksR0FBRyxZQUFZLE9BQU8sRUFBRTtBQUNoQyxNQUFNLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLGtDQUFrQyxDQUFDLENBQUM7QUFDbEUsS0FBSztBQUNMLElBQUksSUFBSSxHQUFHLEtBQUssRUFBRSxFQUFFO0FBQ3BCLE1BQU0sT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLEdBQUcsa0JBQWtCLENBQUMsQ0FBQztBQUNsRCxLQUFLO0FBQ0wsR0FBRztBQUNILEVBQUUsSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQzVELElBQUksSUFBSSxHQUFHLENBQUMsVUFBVSxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRTtBQUM5RCxNQUFNLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLDRCQUE0QixDQUFDLENBQUM7QUFDNUQsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQzVCLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUMxQixNQUFNLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLDRCQUE0QixDQUFDLENBQUM7QUFDNUQsS0FBSztBQUNMLEdBQUcsTUFBTSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUU7QUFDakMsSUFBSSxPQUFPLElBQUksS0FBSyxDQUFDLElBQUksR0FBRyw0QkFBNEIsQ0FBQyxDQUFDO0FBQzFELEdBQUc7QUFDSCxDQUFDO0FBQ0Q7QUFDQSxJQUFBLEdBQWMsR0FBRyxFQUFFLENBQUE7Ozs7QUM5U25CLFNBQVMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUMzQyxFQUFFLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDNUIsSUFBSSxFQUFFLEVBQUUsZ0JBQWdCO0FBQ3hCLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNYO0FBQ0EsRUFBRVcsVUFBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFDRDtBQUNBO0FBQ0EsaUJBQWlCLENBQUMsS0FBSyxHQUFHLE1BQU0sT0FBTyxZQUFZLEtBQUssV0FBVyxDQUFDO0FBQ3BFLGlCQUFpQixDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7QUFDcEM7QUFDSyxNQUFDLG1CQUFtQixHQUFHLENBQUMsT0FBTyxLQUFLO0FBQ3pDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0Q7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMTZdfQ==
