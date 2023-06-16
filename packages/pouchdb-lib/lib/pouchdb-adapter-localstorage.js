import { L as LevelPouch } from './index-3d81fcba.js';
import { c as commonjsGlobal, g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import { i as inheritsExports } from './readable-bcb7bff2.js';
import require$$0 from 'buffer';
import 'events';
import 'util';
import 'stream';
import 'assert';
import './pouchdb-core.js';
import 'node:events';
import './fetch-f2310cb2.js';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import './rev-48662a2a.js';
import './pouchdb-errors.js';
import 'crypto';
import './stringMd5-15f53eba.js';
import './nextTick-ea093886.js';
import './clone-7eeb6295.js';
import './functionName-706c6c65.js';
import './guardedConsole-f54e5a40.js';
import './isRemote-2533b7cb.js';
import './upsert-331b6913.js';
import './once-de8350b9.js';
import './collectConflicts-ad0b7c70.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import './pouchdb-platform.js';
import 'node:assert';
import 'node:fs';
import 'node:buffer';
import 'node:crypto';
import 'node:stream';
import 'node:http';
import 'node:url';
import 'node:https';
import 'node:zlib';
import 'node:util';
import 'node:vm';
import 'node:path';
import 'node:os';
import './findPathToLeaf-7e69c93c.js';
import 'pouchdb-utils.js';
import './pouchdb-changes-filter.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './matches-selector-87ab4d5f.js';
import './pouchdb-collate.js';
import 'vm';
import './pouchdb-utils.js';
import './flatten-994f45c6.js';
import './scopeEval-ff3a416d.js';
import './toPromise-f6e385ee.js';
import './allDocsKeysQuery-7f4fbcb9.js';
import './parseDoc-71681539.js';
import './latest-0521537f.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './binaryMd5-601b2421.js';
import './processDocs-7c802567.js';
import './merge-1e46cced.js';
import './revExists-12209d1c.js';
import './safeJsonStringify-6520e306.js';

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

localstorageMemory.exports;

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
} (localstorageMemory, localstorageMemory.exports));

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
hasLocalstorage.exports;

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
} (hasLocalstorage, hasLocalstorage.exports));

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
	var Buffer = require$$0.Buffer;

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

var inherits = inheritsExports;
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
