import { i as immutable, l as levelSupports, e as errors, a as levelup$1, o as obj, L as LevelPouch$1 } from './index-1e3c58ae.js';
import fs from 'node:fs';
import path from 'path';
import { w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { l as lib } from './functionName-9335a350.js';
import './__node-resolve_empty-5ffda92e.js';
import './pouchdb-errors.browser.js';
import './spark-md5-2c57e5fc.js';
import { a as isLocalId } from './isLocalId-d067de54.js';
import { c as commonjsGlobal, g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import { b as buffer, i as inherits_browserExports, a as levelCodec, l as ltgt$1 } from './index-30b6bd50.js';
import require$$0 from 'node:stream';
import './pouchdb-core.browser.js';
import './bulkGetShim-d4877145.js';
import './toPromise-9dada06a.js';
import './clone-abfcddc8.js';
import './guardedConsole-f54e5a40.js';
import './rev-5645662a.js';
import './stringMd5-browser-5aecd2bd.js';
import './isRemote-f9121da9.js';
import './upsert-331b6913.js';
import './collectConflicts-6afe46fc.js';
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

// require leveldown. provide verbose output on error as it is the default
// nodejs adapter, which we do not provide for the user
/* istanbul ignore next */
var requireLeveldown = function () {
  try {
    return require('leveldown');
  } catch (err) {
    /* eslint no-ex-assign: 0*/
    err = err || 'leveldown import error';
    if (err.code === 'MODULE_NOT_FOUND') {
      // handle leveldown not installed case
      return new Error([
        'the \'leveldown\' package is not available. install it, or,',
        'specify another storage backend using the \'db\' option'
      ].join(' '));
    } else if (err.message && err.message.match('Module version mismatch')) {
      // handle common user enviornment error
      return new Error([
        err.message,
        'This generally implies that leveldown was built with a different',
        'version of node than that which is running now.  You may try',
        'fully removing and reinstalling PouchDB or leveldown to resolve.'
      ].join(' '));
    }
    // handle general internal nodejs require error
    return new Error(err.toString() + ': unable to import leveldown');
  }
};

var abstractLeveldown$3 = {};

var nextTickBrowser$1 = lib;

var nextTick$5 = nextTickBrowser$1;

function AbstractIterator$5 (db) {
  if (typeof db !== 'object' || db === null) {
    throw new TypeError('First argument must be an abstract-leveldown compliant store')
  }

  this.db = db;
  this._ended = false;
  this._nexting = false;
}

AbstractIterator$5.prototype.next = function (callback) {
  var self = this;

  if (typeof callback !== 'function') {
    throw new Error('next() requires a callback argument')
  }

  if (self._ended) {
    nextTick$5(callback, new Error('cannot call next() after end()'));
    return self
  }

  if (self._nexting) {
    nextTick$5(callback, new Error('cannot call next() before previous next() has completed'));
    return self
  }

  self._nexting = true;
  self._next(function () {
    self._nexting = false;
    callback.apply(null, arguments);
  });

  return self
};

AbstractIterator$5.prototype._next = function (callback) {
  nextTick$5(callback);
};

AbstractIterator$5.prototype.seek = function (target) {
  if (this._ended) {
    throw new Error('cannot call seek() after end()')
  }
  if (this._nexting) {
    throw new Error('cannot call seek() before next() has completed')
  }

  target = this.db._serializeKey(target);
  this._seek(target);
};

AbstractIterator$5.prototype._seek = function (target) {};

AbstractIterator$5.prototype.end = function (callback) {
  if (typeof callback !== 'function') {
    throw new Error('end() requires a callback argument')
  }

  if (this._ended) {
    return nextTick$5(callback, new Error('end() already called on iterator'))
  }

  this._ended = true;
  this._end(callback);
};

AbstractIterator$5.prototype._end = function (callback) {
  nextTick$5(callback);
};

// Expose browser-compatible nextTick for dependents
AbstractIterator$5.prototype._nextTick = nextTick$5;

var abstractIterator$1 = AbstractIterator$5;

var nextTick$4 = nextTickBrowser$1;

function AbstractChainedBatch$4 (db) {
  if (typeof db !== 'object' || db === null) {
    throw new TypeError('First argument must be an abstract-leveldown compliant store')
  }

  this.db = db;
  this._operations = [];
  this._written = false;
}

AbstractChainedBatch$4.prototype._checkWritten = function () {
  if (this._written) {
    throw new Error('write() already called on this batch')
  }
};

AbstractChainedBatch$4.prototype.put = function (key, value) {
  this._checkWritten();

  var err = this.db._checkKey(key) || this.db._checkValue(value);
  if (err) throw err

  key = this.db._serializeKey(key);
  value = this.db._serializeValue(value);

  this._put(key, value);

  return this
};

AbstractChainedBatch$4.prototype._put = function (key, value) {
  this._operations.push({ type: 'put', key: key, value: value });
};

AbstractChainedBatch$4.prototype.del = function (key) {
  this._checkWritten();

  var err = this.db._checkKey(key);
  if (err) throw err

  key = this.db._serializeKey(key);
  this._del(key);

  return this
};

AbstractChainedBatch$4.prototype._del = function (key) {
  this._operations.push({ type: 'del', key: key });
};

AbstractChainedBatch$4.prototype.clear = function () {
  this._checkWritten();
  this._clear();

  return this
};

AbstractChainedBatch$4.prototype._clear = function () {
  this._operations = [];
};

AbstractChainedBatch$4.prototype.write = function (options, callback) {
  this._checkWritten();

  if (typeof options === 'function') { callback = options; }
  if (typeof callback !== 'function') {
    throw new Error('write() requires a callback argument')
  }
  if (typeof options !== 'object' || options === null) {
    options = {};
  }

  this._written = true;
  this._write(options, callback);
};

AbstractChainedBatch$4.prototype._write = function (options, callback) {
  this.db._batch(this._operations, options, callback);
};

// Expose browser-compatible nextTick for dependents
AbstractChainedBatch$4.prototype._nextTick = nextTick$4;

var abstractChainedBatch$1 = AbstractChainedBatch$4;

var xtend$1 = immutable;
var supports$1 = levelSupports;
var Buffer$3 = buffer.Buffer;
var AbstractIterator$4 = abstractIterator$1;
var AbstractChainedBatch$3 = abstractChainedBatch$1;
var nextTick$3 = nextTickBrowser$1;
var hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var rangeOptions$1 = 'start end gt gte lt lte'.split(' ');

function AbstractLevelDOWN$3 (manifest) {
  this.status = 'new';

  // TODO (next major): make this mandatory
  this.supports = supports$1(manifest, {
    status: true
  });
}

AbstractLevelDOWN$3.prototype.open = function (options, callback) {
  var self = this;
  var oldStatus = this.status;

  if (typeof options === 'function') callback = options;

  if (typeof callback !== 'function') {
    throw new Error('open() requires a callback argument')
  }

  if (typeof options !== 'object' || options === null) options = {};

  options.createIfMissing = options.createIfMissing !== false;
  options.errorIfExists = !!options.errorIfExists;

  this.status = 'opening';
  this._open(options, function (err) {
    if (err) {
      self.status = oldStatus;
      return callback(err)
    }
    self.status = 'open';
    callback();
  });
};

AbstractLevelDOWN$3.prototype._open = function (options, callback) {
  nextTick$3(callback);
};

AbstractLevelDOWN$3.prototype.close = function (callback) {
  var self = this;
  var oldStatus = this.status;

  if (typeof callback !== 'function') {
    throw new Error('close() requires a callback argument')
  }

  this.status = 'closing';
  this._close(function (err) {
    if (err) {
      self.status = oldStatus;
      return callback(err)
    }
    self.status = 'closed';
    callback();
  });
};

AbstractLevelDOWN$3.prototype._close = function (callback) {
  nextTick$3(callback);
};

AbstractLevelDOWN$3.prototype.get = function (key, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof callback !== 'function') {
    throw new Error('get() requires a callback argument')
  }

  var err = this._checkKey(key);
  if (err) return nextTick$3(callback, err)

  key = this._serializeKey(key);

  if (typeof options !== 'object' || options === null) options = {};

  options.asBuffer = options.asBuffer !== false;

  this._get(key, options, callback);
};

AbstractLevelDOWN$3.prototype._get = function (key, options, callback) {
  nextTick$3(function () { callback(new Error('NotFound')); });
};

AbstractLevelDOWN$3.prototype.put = function (key, value, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof callback !== 'function') {
    throw new Error('put() requires a callback argument')
  }

  var err = this._checkKey(key) || this._checkValue(value);
  if (err) return nextTick$3(callback, err)

  key = this._serializeKey(key);
  value = this._serializeValue(value);

  if (typeof options !== 'object' || options === null) options = {};

  this._put(key, value, options, callback);
};

AbstractLevelDOWN$3.prototype._put = function (key, value, options, callback) {
  nextTick$3(callback);
};

AbstractLevelDOWN$3.prototype.del = function (key, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof callback !== 'function') {
    throw new Error('del() requires a callback argument')
  }

  var err = this._checkKey(key);
  if (err) return nextTick$3(callback, err)

  key = this._serializeKey(key);

  if (typeof options !== 'object' || options === null) options = {};

  this._del(key, options, callback);
};

AbstractLevelDOWN$3.prototype._del = function (key, options, callback) {
  nextTick$3(callback);
};

AbstractLevelDOWN$3.prototype.batch = function (array, options, callback) {
  if (!arguments.length) return this._chainedBatch()

  if (typeof options === 'function') callback = options;

  if (typeof array === 'function') callback = array;

  if (typeof callback !== 'function') {
    throw new Error('batch(array) requires a callback argument')
  }

  if (!Array.isArray(array)) {
    return nextTick$3(callback, new Error('batch(array) requires an array argument'))
  }

  if (array.length === 0) {
    return nextTick$3(callback)
  }

  if (typeof options !== 'object' || options === null) options = {};

  var serialized = new Array(array.length);

  for (var i = 0; i < array.length; i++) {
    if (typeof array[i] !== 'object' || array[i] === null) {
      return nextTick$3(callback, new Error('batch(array) element must be an object and not `null`'))
    }

    var e = xtend$1(array[i]);

    if (e.type !== 'put' && e.type !== 'del') {
      return nextTick$3(callback, new Error("`type` must be 'put' or 'del'"))
    }

    var err = this._checkKey(e.key);
    if (err) return nextTick$3(callback, err)

    e.key = this._serializeKey(e.key);

    if (e.type === 'put') {
      var valueErr = this._checkValue(e.value);
      if (valueErr) return nextTick$3(callback, valueErr)

      e.value = this._serializeValue(e.value);
    }

    serialized[i] = e;
  }

  this._batch(serialized, options, callback);
};

AbstractLevelDOWN$3.prototype._batch = function (array, options, callback) {
  nextTick$3(callback);
};

AbstractLevelDOWN$3.prototype.clear = function (options, callback) {
  if (typeof options === 'function') {
    callback = options;
  } else if (typeof callback !== 'function') {
    throw new Error('clear() requires a callback argument')
  }

  options = cleanRangeOptions$1(this, options);
  options.reverse = !!options.reverse;
  options.limit = 'limit' in options ? options.limit : -1;

  this._clear(options, callback);
};

AbstractLevelDOWN$3.prototype._clear = function (options, callback) {
  // Avoid setupIteratorOptions, would serialize range options a second time.
  options.keys = true;
  options.values = false;
  options.keyAsBuffer = true;
  options.valueAsBuffer = true;

  var iterator = this._iterator(options);
  var emptyOptions = {};
  var self = this;

  var next = function (err) {
    if (err) {
      return iterator.end(function () {
        callback(err);
      })
    }

    iterator.next(function (err, key) {
      if (err) return next(err)
      if (key === undefined) return iterator.end(callback)

      // This could be optimized by using a batch, but the default _clear
      // is not meant to be fast. Implementations have more room to optimize
      // if they override _clear. Note: using _del bypasses key serialization.
      self._del(key, emptyOptions, next);
    });
  };

  next();
};

AbstractLevelDOWN$3.prototype._setupIteratorOptions = function (options) {
  options = cleanRangeOptions$1(this, options);

  options.reverse = !!options.reverse;
  options.keys = options.keys !== false;
  options.values = options.values !== false;
  options.limit = 'limit' in options ? options.limit : -1;
  options.keyAsBuffer = options.keyAsBuffer !== false;
  options.valueAsBuffer = options.valueAsBuffer !== false;

  return options
};

function cleanRangeOptions$1 (db, options) {
  var result = {};

  for (var k in options) {
    if (!hasOwnProperty$1.call(options, k)) continue

    var opt = options[k];

    if (isRangeOption$1(k)) {
      // Note that we don't reject nullish and empty options here. While
      // those types are invalid as keys, they are valid as range options.
      opt = db._serializeKey(opt);
    }

    result[k] = opt;
  }

  return result
}

function isRangeOption$1 (k) {
  return rangeOptions$1.indexOf(k) !== -1
}

AbstractLevelDOWN$3.prototype.iterator = function (options) {
  if (typeof options !== 'object' || options === null) options = {};
  options = this._setupIteratorOptions(options);
  return this._iterator(options)
};

AbstractLevelDOWN$3.prototype._iterator = function (options) {
  return new AbstractIterator$4(this)
};

AbstractLevelDOWN$3.prototype._chainedBatch = function () {
  return new AbstractChainedBatch$3(this)
};

AbstractLevelDOWN$3.prototype._serializeKey = function (key) {
  return key
};

AbstractLevelDOWN$3.prototype._serializeValue = function (value) {
  return value
};

AbstractLevelDOWN$3.prototype._checkKey = function (key) {
  if (key === null || key === undefined) {
    return new Error('key cannot be `null` or `undefined`')
  } else if (Buffer$3.isBuffer(key) && key.length === 0) {
    return new Error('key cannot be an empty Buffer')
  } else if (key === '') {
    return new Error('key cannot be an empty String')
  } else if (Array.isArray(key) && key.length === 0) {
    return new Error('key cannot be an empty Array')
  }
};

AbstractLevelDOWN$3.prototype._checkValue = function (value) {
  if (value === null || value === undefined) {
    return new Error('value cannot be `null` or `undefined`')
  }
};

// Expose browser-compatible nextTick for dependents
AbstractLevelDOWN$3.prototype._nextTick = nextTick$3;

var abstractLeveldown$2 = AbstractLevelDOWN$3;

abstractLeveldown$3.AbstractLevelDOWN = abstractLeveldown$2;
abstractLeveldown$3.AbstractIterator = abstractIterator$1;
abstractLeveldown$3.AbstractChainedBatch = abstractChainedBatch$1;

var AbstractLevelDOWN$2 = abstractLeveldown$3.AbstractLevelDOWN;
var AbstractChainedBatch$2 = abstractLeveldown$3.AbstractChainedBatch;
var AbstractIterator$3 = abstractLeveldown$3.AbstractIterator;
var inherits$2 = inherits_browserExports;
var Codec = levelCodec;
var EncodingError = errors.EncodingError;
var rangeMethods = ['approximateSize', 'compactRange'];

var encodingDown = DB.default = DB;

function DB (db, opts) {
  if (!(this instanceof DB)) return new DB(db, opts)

  var manifest = db.supports || {};
  var additionalMethods = manifest.additionalMethods || {};

  AbstractLevelDOWN$2.call(this, manifest);

  this.supports.encodings = true;
  this.supports.additionalMethods = {};

  rangeMethods.forEach(function (m) {
    // TODO (future major): remove this fallback
    var fallback = typeof db[m] === 'function';

    if (additionalMethods[m] || fallback) {
      this.supports.additionalMethods[m] = true;

      this[m] = function (start, end, opts, cb) {
        start = this.codec.encodeKey(start, opts);
        end = this.codec.encodeKey(end, opts);
        return this.db[m](start, end, opts, cb)
      };
    }
  }, this);

  opts = opts || {};
  if (typeof opts.keyEncoding === 'undefined') opts.keyEncoding = 'utf8';
  if (typeof opts.valueEncoding === 'undefined') opts.valueEncoding = 'utf8';

  this.db = db;
  this.codec = new Codec(opts);
}

inherits$2(DB, AbstractLevelDOWN$2);

DB.prototype.type = 'encoding-down';

DB.prototype._serializeKey =
DB.prototype._serializeValue = function (datum) {
  return datum
};

DB.prototype._open = function (opts, cb) {
  this.db.open(opts, cb);
};

DB.prototype._close = function (cb) {
  this.db.close(cb);
};

DB.prototype._put = function (key, value, opts, cb) {
  key = this.codec.encodeKey(key, opts);
  value = this.codec.encodeValue(value, opts);
  this.db.put(key, value, opts, cb);
};

DB.prototype._get = function (key, opts, cb) {
  var self = this;
  key = this.codec.encodeKey(key, opts);
  opts.asBuffer = this.codec.valueAsBuffer(opts);
  this.db.get(key, opts, function (err, value) {
    if (err) return cb(err)
    try {
      value = self.codec.decodeValue(value, opts);
    } catch (err) {
      return cb(new EncodingError(err))
    }
    cb(null, value);
  });
};

DB.prototype._del = function (key, opts, cb) {
  key = this.codec.encodeKey(key, opts);
  this.db.del(key, opts, cb);
};

DB.prototype._chainedBatch = function () {
  return new Batch(this)
};

DB.prototype._batch = function (ops, opts, cb) {
  ops = this.codec.encodeBatch(ops, opts);
  this.db.batch(ops, opts, cb);
};

DB.prototype._iterator = function (opts) {
  opts.keyAsBuffer = this.codec.keyAsBuffer(opts);
  opts.valueAsBuffer = this.codec.valueAsBuffer(opts);
  return new Iterator$2(this, opts)
};

DB.prototype._clear = function (opts, callback) {
  opts = this.codec.encodeLtgt(opts);
  this.db.clear(opts, callback);
};

function Iterator$2 (db, opts) {
  AbstractIterator$3.call(this, db);
  this.codec = db.codec;
  this.keys = opts.keys;
  this.values = opts.values;
  this.opts = this.codec.encodeLtgt(opts);
  this.it = db.db.iterator(this.opts);
}

inherits$2(Iterator$2, AbstractIterator$3);

Iterator$2.prototype._next = function (cb) {
  var self = this;
  this.it.next(function (err, key, value) {
    if (err) return cb(err)
    try {
      if (self.keys && typeof key !== 'undefined') {
        key = self.codec.decodeKey(key, self.opts);
      } else {
        key = undefined;
      }

      if (self.values && typeof value !== 'undefined') {
        value = self.codec.decodeValue(value, self.opts);
      } else {
        value = undefined;
      }
    } catch (err) {
      return cb(new EncodingError(err))
    }
    cb(null, key, value);
  });
};

Iterator$2.prototype._seek = function (key) {
  key = this.codec.encodeKey(key, this.opts);
  this.it.seek(key);
};

Iterator$2.prototype._end = function (cb) {
  this.it.end(cb);
};

function Batch (db, codec) {
  AbstractChainedBatch$2.call(this, db);
  this.codec = db.codec;
  this.batch = db.db.batch();
}

inherits$2(Batch, AbstractChainedBatch$2);

Batch.prototype._put = function (key, value) {
  key = this.codec.encodeKey(key);
  value = this.codec.encodeValue(value);
  this.batch.put(key, value);
};

Batch.prototype._del = function (key) {
  key = this.codec.encodeKey(key);
  this.batch.del(key);
};

Batch.prototype._clear = function () {
  this.batch.clear();
};

Batch.prototype._write = function (opts, cb) {
  this.batch.write(opts, cb);
};

var levelup = levelup$1;
var encode = encodingDown;

function packager (leveldown) {
  function Level (location, options, callback) {
    if (typeof location === 'function') {
      callback = location;
    } else if (typeof options === 'function') {
      callback = options;
    }

    if (!isObject(options)) {
      options = isObject(location) ? location : {};
    }

    return levelup(encode(leveldown(location, options), options), options, callback)
  }

  function isObject (o) {
    return typeof o === 'object' && o !== null
  }

  ['destroy', 'repair'].forEach(function (m) {
    if (typeof leveldown[m] === 'function') {
      Level[m] = function () {
        leveldown[m].apply(leveldown, arguments);
      };
    }
  });

  Level.errors = levelup.errors;

  return Level
}

var levelPackager = packager;

var abstractLeveldown$1 = {};

var nextTickBrowser = lib;

var nextTick$2 = nextTickBrowser;

function AbstractIterator$2 (db) {
  if (typeof db !== 'object' || db === null) {
    throw new TypeError('First argument must be an abstract-leveldown compliant store')
  }

  this.db = db;
  this._ended = false;
  this._nexting = false;
}

AbstractIterator$2.prototype.next = function (callback) {
  var self = this;

  if (typeof callback !== 'function') {
    throw new Error('next() requires a callback argument')
  }

  if (self._ended) {
    nextTick$2(callback, new Error('cannot call next() after end()'));
    return self
  }

  if (self._nexting) {
    nextTick$2(callback, new Error('cannot call next() before previous next() has completed'));
    return self
  }

  self._nexting = true;
  self._next(function () {
    self._nexting = false;
    callback.apply(null, arguments);
  });

  return self
};

AbstractIterator$2.prototype._next = function (callback) {
  nextTick$2(callback);
};

AbstractIterator$2.prototype.seek = function (target) {
  if (this._ended) {
    throw new Error('cannot call seek() after end()')
  }
  if (this._nexting) {
    throw new Error('cannot call seek() before next() has completed')
  }

  target = this.db._serializeKey(target);
  this._seek(target);
};

AbstractIterator$2.prototype._seek = function (target) {};

AbstractIterator$2.prototype.end = function (callback) {
  if (typeof callback !== 'function') {
    throw new Error('end() requires a callback argument')
  }

  if (this._ended) {
    return nextTick$2(callback, new Error('end() already called on iterator'))
  }

  this._ended = true;
  this._end(callback);
};

AbstractIterator$2.prototype._end = function (callback) {
  nextTick$2(callback);
};

// Expose browser-compatible nextTick for dependents
AbstractIterator$2.prototype._nextTick = nextTick$2;

var abstractIterator = AbstractIterator$2;

var nextTick$1 = nextTickBrowser;

function AbstractChainedBatch$1 (db) {
  if (typeof db !== 'object' || db === null) {
    throw new TypeError('First argument must be an abstract-leveldown compliant store')
  }

  this.db = db;
  this._operations = [];
  this._written = false;
}

AbstractChainedBatch$1.prototype._checkWritten = function () {
  if (this._written) {
    throw new Error('write() already called on this batch')
  }
};

AbstractChainedBatch$1.prototype.put = function (key, value) {
  this._checkWritten();

  var err = this.db._checkKey(key) || this.db._checkValue(value);
  if (err) throw err

  key = this.db._serializeKey(key);
  value = this.db._serializeValue(value);

  this._put(key, value);

  return this
};

AbstractChainedBatch$1.prototype._put = function (key, value) {
  this._operations.push({ type: 'put', key: key, value: value });
};

AbstractChainedBatch$1.prototype.del = function (key) {
  this._checkWritten();

  var err = this.db._checkKey(key);
  if (err) throw err

  key = this.db._serializeKey(key);
  this._del(key);

  return this
};

AbstractChainedBatch$1.prototype._del = function (key) {
  this._operations.push({ type: 'del', key: key });
};

AbstractChainedBatch$1.prototype.clear = function () {
  this._checkWritten();
  this._clear();

  return this
};

AbstractChainedBatch$1.prototype._clear = function () {
  this._operations = [];
};

AbstractChainedBatch$1.prototype.write = function (options, callback) {
  this._checkWritten();

  if (typeof options === 'function') { callback = options; }
  if (typeof callback !== 'function') {
    throw new Error('write() requires a callback argument')
  }
  if (typeof options !== 'object' || options === null) {
    options = {};
  }

  this._written = true;
  this._write(options, callback);
};

AbstractChainedBatch$1.prototype._write = function (options, callback) {
  this.db._batch(this._operations, options, callback);
};

// Expose browser-compatible nextTick for dependents
AbstractChainedBatch$1.prototype._nextTick = nextTick$1;

var abstractChainedBatch = AbstractChainedBatch$1;

var xtend = immutable;
var supports = levelSupports;
var Buffer$2 = buffer.Buffer;
var AbstractIterator$1 = abstractIterator;
var AbstractChainedBatch = abstractChainedBatch;
var nextTick = nextTickBrowser;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var rangeOptions = 'start end gt gte lt lte'.split(' ');

function AbstractLevelDOWN$1 (manifest) {
  this.status = 'new';

  // TODO (next major): make this mandatory
  this.supports = supports(manifest, {
    status: true
  });
}

AbstractLevelDOWN$1.prototype.open = function (options, callback) {
  var self = this;
  var oldStatus = this.status;

  if (typeof options === 'function') callback = options;

  if (typeof callback !== 'function') {
    throw new Error('open() requires a callback argument')
  }

  if (typeof options !== 'object' || options === null) options = {};

  options.createIfMissing = options.createIfMissing !== false;
  options.errorIfExists = !!options.errorIfExists;

  this.status = 'opening';
  this._open(options, function (err) {
    if (err) {
      self.status = oldStatus;
      return callback(err)
    }
    self.status = 'open';
    callback();
  });
};

AbstractLevelDOWN$1.prototype._open = function (options, callback) {
  nextTick(callback);
};

AbstractLevelDOWN$1.prototype.close = function (callback) {
  var self = this;
  var oldStatus = this.status;

  if (typeof callback !== 'function') {
    throw new Error('close() requires a callback argument')
  }

  this.status = 'closing';
  this._close(function (err) {
    if (err) {
      self.status = oldStatus;
      return callback(err)
    }
    self.status = 'closed';
    callback();
  });
};

AbstractLevelDOWN$1.prototype._close = function (callback) {
  nextTick(callback);
};

AbstractLevelDOWN$1.prototype.get = function (key, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof callback !== 'function') {
    throw new Error('get() requires a callback argument')
  }

  var err = this._checkKey(key);
  if (err) return nextTick(callback, err)

  key = this._serializeKey(key);

  if (typeof options !== 'object' || options === null) options = {};

  options.asBuffer = options.asBuffer !== false;

  this._get(key, options, callback);
};

AbstractLevelDOWN$1.prototype._get = function (key, options, callback) {
  nextTick(function () { callback(new Error('NotFound')); });
};

AbstractLevelDOWN$1.prototype.put = function (key, value, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof callback !== 'function') {
    throw new Error('put() requires a callback argument')
  }

  var err = this._checkKey(key) || this._checkValue(value);
  if (err) return nextTick(callback, err)

  key = this._serializeKey(key);
  value = this._serializeValue(value);

  if (typeof options !== 'object' || options === null) options = {};

  this._put(key, value, options, callback);
};

AbstractLevelDOWN$1.prototype._put = function (key, value, options, callback) {
  nextTick(callback);
};

AbstractLevelDOWN$1.prototype.del = function (key, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof callback !== 'function') {
    throw new Error('del() requires a callback argument')
  }

  var err = this._checkKey(key);
  if (err) return nextTick(callback, err)

  key = this._serializeKey(key);

  if (typeof options !== 'object' || options === null) options = {};

  this._del(key, options, callback);
};

AbstractLevelDOWN$1.prototype._del = function (key, options, callback) {
  nextTick(callback);
};

AbstractLevelDOWN$1.prototype.batch = function (array, options, callback) {
  if (!arguments.length) return this._chainedBatch()

  if (typeof options === 'function') callback = options;

  if (typeof array === 'function') callback = array;

  if (typeof callback !== 'function') {
    throw new Error('batch(array) requires a callback argument')
  }

  if (!Array.isArray(array)) {
    return nextTick(callback, new Error('batch(array) requires an array argument'))
  }

  if (array.length === 0) {
    return nextTick(callback)
  }

  if (typeof options !== 'object' || options === null) options = {};

  var serialized = new Array(array.length);

  for (var i = 0; i < array.length; i++) {
    if (typeof array[i] !== 'object' || array[i] === null) {
      return nextTick(callback, new Error('batch(array) element must be an object and not `null`'))
    }

    var e = xtend(array[i]);

    if (e.type !== 'put' && e.type !== 'del') {
      return nextTick(callback, new Error("`type` must be 'put' or 'del'"))
    }

    var err = this._checkKey(e.key);
    if (err) return nextTick(callback, err)

    e.key = this._serializeKey(e.key);

    if (e.type === 'put') {
      var valueErr = this._checkValue(e.value);
      if (valueErr) return nextTick(callback, valueErr)

      e.value = this._serializeValue(e.value);
    }

    serialized[i] = e;
  }

  this._batch(serialized, options, callback);
};

AbstractLevelDOWN$1.prototype._batch = function (array, options, callback) {
  nextTick(callback);
};

AbstractLevelDOWN$1.prototype.clear = function (options, callback) {
  if (typeof options === 'function') {
    callback = options;
  } else if (typeof callback !== 'function') {
    throw new Error('clear() requires a callback argument')
  }

  options = cleanRangeOptions(this, options);
  options.reverse = !!options.reverse;
  options.limit = 'limit' in options ? options.limit : -1;

  this._clear(options, callback);
};

AbstractLevelDOWN$1.prototype._clear = function (options, callback) {
  // Avoid setupIteratorOptions, would serialize range options a second time.
  options.keys = true;
  options.values = false;
  options.keyAsBuffer = true;
  options.valueAsBuffer = true;

  var iterator = this._iterator(options);
  var emptyOptions = {};
  var self = this;

  var next = function (err) {
    if (err) {
      return iterator.end(function () {
        callback(err);
      })
    }

    iterator.next(function (err, key) {
      if (err) return next(err)
      if (key === undefined) return iterator.end(callback)

      // This could be optimized by using a batch, but the default _clear
      // is not meant to be fast. Implementations have more room to optimize
      // if they override _clear. Note: using _del bypasses key serialization.
      self._del(key, emptyOptions, next);
    });
  };

  next();
};

AbstractLevelDOWN$1.prototype._setupIteratorOptions = function (options) {
  options = cleanRangeOptions(this, options);

  options.reverse = !!options.reverse;
  options.keys = options.keys !== false;
  options.values = options.values !== false;
  options.limit = 'limit' in options ? options.limit : -1;
  options.keyAsBuffer = options.keyAsBuffer !== false;
  options.valueAsBuffer = options.valueAsBuffer !== false;

  return options
};

function cleanRangeOptions (db, options) {
  var result = {};

  for (var k in options) {
    if (!hasOwnProperty.call(options, k)) continue

    var opt = options[k];

    if (isRangeOption(k)) {
      // Note that we don't reject nullish and empty options here. While
      // those types are invalid as keys, they are valid as range options.
      opt = db._serializeKey(opt);
    }

    result[k] = opt;
  }

  return result
}

function isRangeOption (k) {
  return rangeOptions.indexOf(k) !== -1
}

AbstractLevelDOWN$1.prototype.iterator = function (options) {
  if (typeof options !== 'object' || options === null) options = {};
  options = this._setupIteratorOptions(options);
  return this._iterator(options)
};

AbstractLevelDOWN$1.prototype._iterator = function (options) {
  return new AbstractIterator$1(this)
};

AbstractLevelDOWN$1.prototype._chainedBatch = function () {
  return new AbstractChainedBatch(this)
};

AbstractLevelDOWN$1.prototype._serializeKey = function (key) {
  return key
};

AbstractLevelDOWN$1.prototype._serializeValue = function (value) {
  return value
};

AbstractLevelDOWN$1.prototype._checkKey = function (key) {
  if (key === null || key === undefined) {
    return new Error('key cannot be `null` or `undefined`')
  } else if (Buffer$2.isBuffer(key) && key.length === 0) {
    return new Error('key cannot be an empty Buffer')
  } else if (key === '') {
    return new Error('key cannot be an empty String')
  } else if (Array.isArray(key) && key.length === 0) {
    return new Error('key cannot be an empty Array')
  }
};

AbstractLevelDOWN$1.prototype._checkValue = function (value) {
  if (value === null || value === undefined) {
    return new Error('value cannot be `null` or `undefined`')
  }
};

// Expose browser-compatible nextTick for dependents
AbstractLevelDOWN$1.prototype._nextTick = nextTick;

var abstractLeveldown = AbstractLevelDOWN$1;

abstractLeveldown$1.AbstractLevelDOWN = abstractLeveldown;
abstractLeveldown$1.AbstractIterator = abstractIterator;
abstractLeveldown$1.AbstractChainedBatch = abstractChainedBatch;

/* global IDBKeyRange */

var ltgt = ltgt$1;
var NONE = {};

var keyRange = function createKeyRange (options) {
  var lower = ltgt.lowerBound(options, NONE);
  var upper = ltgt.upperBound(options, NONE);
  var lowerOpen = ltgt.lowerBoundExclusive(options, NONE);
  var upperOpen = ltgt.upperBoundExclusive(options, NONE);

  if (lower !== NONE && upper !== NONE) {
    return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)
  } else if (lower !== NONE) {
    return IDBKeyRange.lowerBound(lower, lowerOpen)
  } else if (upper !== NONE) {
    return IDBKeyRange.upperBound(upper, upperOpen)
  } else {
    return null
  }
};

var Buffer$1 = buffer.Buffer;
var ta2str = (function () {
  if (commonjsGlobal.TextDecoder) {
    var decoder = new TextDecoder('utf-8');
    return decoder.decode.bind(decoder)
  } else {
    return function ta2str (ta) {
      return ta2buf(ta).toString()
    }
  }
})();

var ab2str = (function () {
  if (commonjsGlobal.TextDecoder) {
    var decoder = new TextDecoder('utf-8');
    return decoder.decode.bind(decoder)
  } else {
    return function ab2str (ab) {
      return Buffer$1.from(ab).toString()
    }
  }
})();

function ta2buf (ta) {
  var buf = Buffer$1.from(ta.buffer);

  if (ta.byteLength === ta.buffer.byteLength) {
    return buf
  } else {
    return buf.slice(ta.byteOffset, ta.byteOffset + ta.byteLength)
  }
}

var deserialize$2 = function (data, asBuffer) {
  if (data instanceof Uint8Array) {
    return asBuffer ? ta2buf(data) : ta2str(data)
  } else if (data instanceof ArrayBuffer) {
    return asBuffer ? Buffer$1.from(data) : ab2str(data)
  } else {
    return asBuffer ? Buffer$1.from(String(data)) : String(data)
  }
};

var inherits$1 = inherits_browserExports;
var AbstractIterator = abstractLeveldown$1.AbstractIterator;
var createKeyRange$1 = keyRange;
var deserialize$1 = deserialize$2;
var noop = function () {};

var iterator = Iterator$1;

function Iterator$1 (db, location, options) {
  AbstractIterator.call(this, db);

  this._limit = options.limit;
  this._count = 0;
  this._callback = null;
  this._cache = [];
  this._completed = false;
  this._aborted = false;
  this._error = null;
  this._transaction = null;

  this._keys = options.keys;
  this._values = options.values;
  this._keyAsBuffer = options.keyAsBuffer;
  this._valueAsBuffer = options.valueAsBuffer;

  if (this._limit === 0) {
    this._completed = true;
    return
  }

  try {
    var keyRange = createKeyRange$1(options);
  } catch (e) {
    // The lower key is greater than the upper key.
    // IndexedDB throws an error, but we'll just return 0 results.
    this._completed = true;
    return
  }

  this.createIterator(location, keyRange, options.reverse);
}

inherits$1(Iterator$1, AbstractIterator);

Iterator$1.prototype.createIterator = function (location, keyRange, reverse) {
  var self = this;
  var transaction = this.db.db.transaction([location], 'readonly');
  var store = transaction.objectStore(location);
  var req = store.openCursor(keyRange, reverse ? 'prev' : 'next');

  req.onsuccess = function (ev) {
    var cursor = ev.target.result;
    if (cursor) self.onItem(cursor);
  };

  this._transaction = transaction;

  // If an error occurs (on the request), the transaction will abort.
  transaction.onabort = function () {
    self.onAbort(self._transaction.error || new Error('aborted by user'));
  };

  transaction.oncomplete = function () {
    self.onComplete();
  };
};

Iterator$1.prototype.onItem = function (cursor) {
  this._cache.push(cursor.key, cursor.value);

  if (this._limit <= 0 || ++this._count < this._limit) {
    cursor.continue();
  }

  this.maybeNext();
};

Iterator$1.prototype.onAbort = function (err) {
  this._aborted = true;
  this._error = err;
  this.maybeNext();
};

Iterator$1.prototype.onComplete = function () {
  this._completed = true;
  this.maybeNext();
};

Iterator$1.prototype.maybeNext = function () {
  if (this._callback) {
    this._next(this._callback);
    this._callback = null;
  }
};

Iterator$1.prototype._next = function (callback) {
  if (this._aborted) {
    // The error should be picked up by either next() or end().
    var err = this._error;
    this._error = null;
    this._nextTick(callback, err);
  } else if (this._cache.length > 0) {
    var key = this._cache.shift();
    var value = this._cache.shift();

    if (this._keys && key !== undefined) {
      key = this._deserializeKey(key, this._keyAsBuffer);
    } else {
      key = undefined;
    }

    if (this._values && value !== undefined) {
      value = this._deserializeValue(value, this._valueAsBuffer);
    } else {
      value = undefined;
    }

    this._nextTick(callback, null, key, value);
  } else if (this._completed) {
    this._nextTick(callback);
  } else {
    this._callback = callback;
  }
};

// Exposed for the v4 to v5 upgrade utility
Iterator$1.prototype._deserializeKey = deserialize$1;
Iterator$1.prototype._deserializeValue = deserialize$1;

Iterator$1.prototype._end = function (callback) {
  if (this._aborted || this._completed) {
    return this._nextTick(callback, this._error)
  }

  // Don't advance the cursor anymore, and the transaction will complete
  // on its own in the next tick. This approach is much cleaner than calling
  // transaction.abort() with its unpredictable event order.
  this.onItem = noop;
  this.onAbort = callback;
  this.onComplete = callback;
};

var Buffer = buffer.Buffer;
// Returns either a Uint8Array or Buffer (doesn't matter to
// IndexedDB, because Buffer is a subclass of Uint8Array)
var str2bin = (function () {
  if (commonjsGlobal.TextEncoder) {
    var encoder = new TextEncoder('utf-8');
    return encoder.encode.bind(encoder)
  } else {
    return Buffer.from
  }
})();

var serialize$1 = function (data, asBuffer) {
  if (asBuffer) {
    return Buffer.isBuffer(data) ? data : str2bin(String(data))
  } else {
    return String(data)
  }
};

var support$1 = {};

(function (exports) {

	var Buffer = buffer.Buffer;

	exports.test = function (key) {
	  return function test (impl) {
	    try {
	      impl.cmp(key, 0);
	      return true
	    } catch (err) {
	      return false
	    }
	  }
	};

	// Detect binary key support (IndexedDB Second Edition)
	exports.bufferKeys = exports.test(Buffer.alloc(0)); 
} (support$1));

var clear$1 = function clear (db, location, keyRange, options, callback) {
  if (options.limit === 0) return db._nextTick(callback)

  var transaction = db.db.transaction([location], 'readwrite');
  var store = transaction.objectStore(location);
  var count = 0;

  transaction.oncomplete = function () {
    callback();
  };

  transaction.onabort = function () {
    callback(transaction.error || new Error('aborted by user'));
  };

  // A key cursor is faster (skips reading values) but not supported by IE
  var method = store.openKeyCursor ? 'openKeyCursor' : 'openCursor';
  var direction = options.reverse ? 'prev' : 'next';

  store[method](keyRange, direction).onsuccess = function (ev) {
    var cursor = ev.target.result;

    if (cursor) {
      // Wait for a request to complete before continuing, saving CPU.
      store.delete(cursor.key).onsuccess = function () {
        if (options.limit <= 0 || ++count < options.limit) {
          cursor.continue();
        }
      };
    }
  };
};

/* global indexedDB */

var levelJs = Level;

var AbstractLevelDOWN = abstractLeveldown$1.AbstractLevelDOWN;
var inherits = inherits_browserExports;
var Iterator = iterator;
var serialize = serialize$1;
var deserialize = deserialize$2;
var support = support$1;
var clear = clear$1;
var createKeyRange = keyRange;

var DEFAULT_PREFIX = 'level-js-';

function Level (location, opts) {
  if (!(this instanceof Level)) return new Level(location, opts)

  AbstractLevelDOWN.call(this, {
    bufferKeys: support.bufferKeys(indexedDB),
    snapshots: true,
    permanence: true,
    clear: true
  });

  opts = opts || {};

  if (typeof location !== 'string') {
    throw new Error('constructor requires a location string argument')
  }

  this.location = location;
  this.prefix = opts.prefix == null ? DEFAULT_PREFIX : opts.prefix;
  this.version = parseInt(opts.version || 1, 10);
}

inherits(Level, AbstractLevelDOWN);

Level.prototype.type = 'level-js';

Level.prototype._open = function (options, callback) {
  var req = indexedDB.open(this.prefix + this.location, this.version);
  var self = this;

  req.onerror = function () {
    callback(req.error || new Error('unknown error'));
  };

  req.onsuccess = function () {
    self.db = req.result;
    callback();
  };

  req.onupgradeneeded = function (ev) {
    var db = ev.target.result;

    if (!db.objectStoreNames.contains(self.location)) {
      db.createObjectStore(self.location);
    }
  };
};

Level.prototype.store = function (mode) {
  var transaction = this.db.transaction([this.location], mode);
  return transaction.objectStore(this.location)
};

Level.prototype.await = function (request, callback) {
  var transaction = request.transaction;

  // Take advantage of the fact that a non-canceled request error aborts
  // the transaction. I.e. no need to listen for "request.onerror".
  transaction.onabort = function () {
    callback(transaction.error || new Error('aborted by user'));
  };

  transaction.oncomplete = function () {
    callback(null, request.result);
  };
};

Level.prototype._get = function (key, options, callback) {
  var store = this.store('readonly');

  try {
    var req = store.get(key);
  } catch (err) {
    return this._nextTick(callback, err)
  }

  this.await(req, function (err, value) {
    if (err) return callback(err)

    if (value === undefined) {
      // 'NotFound' error, consistent with LevelDOWN API
      return callback(new Error('NotFound'))
    }

    callback(null, deserialize(value, options.asBuffer));
  });
};

Level.prototype._del = function (key, options, callback) {
  var store = this.store('readwrite');

  try {
    var req = store.delete(key);
  } catch (err) {
    return this._nextTick(callback, err)
  }

  this.await(req, callback);
};

Level.prototype._put = function (key, value, options, callback) {
  var store = this.store('readwrite');

  try {
    // Will throw a DataError or DataCloneError if the environment
    // does not support serializing the key or value respectively.
    var req = store.put(value, key);
  } catch (err) {
    return this._nextTick(callback, err)
  }

  this.await(req, callback);
};

Level.prototype._serializeKey = function (key) {
  return serialize(key, this.supports.bufferKeys)
};

Level.prototype._serializeValue = function (value) {
  return serialize(value, true)
};

Level.prototype._iterator = function (options) {
  return new Iterator(this, this.location, options)
};

Level.prototype._batch = function (operations, options, callback) {
  if (operations.length === 0) return this._nextTick(callback)

  var store = this.store('readwrite');
  var transaction = store.transaction;
  var index = 0;
  var error;

  transaction.onabort = function () {
    callback(error || transaction.error || new Error('aborted by user'));
  };

  transaction.oncomplete = function () {
    callback();
  };

  // Wait for a request to complete before making the next, saving CPU.
  function loop () {
    var op = operations[index++];
    var key = op.key;

    try {
      var req = op.type === 'del' ? store.delete(key) : store.put(op.value, key);
    } catch (err) {
      error = err;
      transaction.abort();
      return
    }

    if (index < operations.length) {
      req.onsuccess = loop;
    }
  }

  loop();
};

Level.prototype._clear = function (options, callback) {
  try {
    var keyRange = createKeyRange(options);
  } catch (e) {
    // The lower key is greater than the upper key.
    // IndexedDB throws an error, but we'll just do nothing.
    return this._nextTick(callback)
  }

  if (options.limit >= 0) {
    // IDBObjectStore#delete(range) doesn't have such an option.
    // Fall back to cursor-based implementation.
    return clear(this, this.location, keyRange, options, callback)
  }

  try {
    var store = this.store('readwrite');
    var req = keyRange ? store.delete(keyRange) : store.clear();
  } catch (err) {
    return this._nextTick(callback, err)
  }

  this.await(req, callback);
};

Level.prototype._close = function (callback) {
  this.db.close();
  this._nextTick(callback);
};

// NOTE: remove in a next major release
Level.prototype.upgrade = function (callback) {
  if (this.status !== 'open') {
    return this._nextTick(callback, new Error('cannot upgrade() before open()'))
  }

  var it = this.iterator();
  var batchOptions = {};
  var self = this;

  it._deserializeKey = it._deserializeValue = identity;
  next();

  function next (err) {
    if (err) return finish(err)
    it.next(each);
  }

  function each (err, key, value) {
    if (err || key === undefined) {
      return finish(err)
    }

    var newKey = self._serializeKey(deserialize(key, true));
    var newValue = self._serializeValue(deserialize(value, true));

    // To bypass serialization on the old key, use _batch() instead of batch().
    // NOTE: if we disable snapshotting (#86) this could lead to a loop of
    // inserting and then iterating those same entries, because the new keys
    // possibly sort after the old keys.
    self._batch([
      { type: 'del', key: key },
      { type: 'put', key: newKey, value: newValue }
    ], batchOptions, next);
  }

  function finish (err) {
    it.end(function (err2) {
      callback(err || err2);
    });
  }

  function identity (data) {
    return data
  }
};

Level.destroy = function (location, prefix, callback) {
  if (typeof prefix === 'function') {
    callback = prefix;
    prefix = DEFAULT_PREFIX;
  }
  var request = indexedDB.deleteDatabase(prefix + location);
  request.onsuccess = function () {
    callback();
  };
  request.onerror = function (err) {
    callback(err);
  };
};

var browser = levelPackager(levelJs);

var level = /*@__PURE__*/getDefaultExportFromCjs(browser);

var array;
var hasRequiredArray;

function requireArray () {
	if (hasRequiredArray) return array;
	hasRequiredArray = 1;
	var to = requireWriteStream();

	function toArray(array, end) {
	    if (typeof array === "function") {
	        end = array;
	        array = [];
	    }

	    return to(writeArray, endArray)

	    function writeArray(chunk) {
	        array.push(chunk);
	    }

	    function endArray() {
	        end(array);
	        this.emit("end");
	    }
	}



	array = toArray;
	return array;
}

var writeStream;
var hasRequiredWriteStream;

function requireWriteStream () {
	if (hasRequiredWriteStream) return writeStream;
	hasRequiredWriteStream = 1;
	var Stream = require$$0;

	writeStream = WriteStream;

	WriteStream.toArray = requireArray();

	function WriteStream(write, end) {
	    var stream = new Stream()
	        , ended = false;

	    end = end || defaultEnd;

	    stream.write = handleWrite;
	    stream.end = handleEnd;

	    // Support 0.8 pipe [LEGACY]
	    stream.writable = true;

	    return stream

	    function handleWrite(chunk) {
	        var result = write.call(stream, chunk);
	        return result === false ? false : true
	    }

	    function handleEnd(chunk) {
	        if (ended) {
	            return
	        }

	        ended = true;
	        if (arguments.length) {
	            stream.write(chunk);
	        }
	        end.call(stream);
	    }
	}

	function defaultEnd() {
	    this.emit("finish");
	}
	return writeStream;
}

var WriteStream = requireWriteStream();

var endStream = EndStream$1;

function EndStream$1(write, end) {
    var counter = 0
        , ended = false;

    var stream = WriteStream(function (chunk) {
        counter++;
        write(chunk, function (err) {
            if (err) {
                return stream.emit("error", err)
            }

            counter--;

            if (counter === 0 && ended) {
                stream.emit("finish");
            }
        });
    }, function () {
        ended = true;
        if (counter === 0) {
            this.emit("finish");
        }
    });

    return stream
}

var EndStream = endStream;

var levelWriteStream = LevelWriteStream;

function LevelWriteStream(db) {
    return writeStream

    function writeStream(options) {
        options = options || {};

        var queue = []
            , stream = EndStream(write);

        return stream

        function write(chunk, callback) {
            if (queue.length === 0) {
                process.nextTick(drain);
            }

            queue.push(chunk);
            stream.once("_drain", callback);
        }

        function drain() {
            if (queue.length === 1) {
                var chunk = queue[0];
                db.put(chunk.key, chunk.value, options, emit);
            } else {
                var arr = queue.map(function (chunk) {
                    chunk.type = "put";
                    return chunk
                });

                db.batch(arr, options, emit);
            }

            queue.length = 0;
        }

        function emit(err) {
            stream.emit("_drain", err);
        }
    }
}

var LevelWriteStream$1 = /*@__PURE__*/getDefaultExportFromCjs(levelWriteStream);

var stores = [
  'document-store',
  'by-sequence',
  'attach-store',
  'attach-binary-store'
];
function formatSeq(n) {
  return ('0000000000000000' + n).slice(-16);
}
var UPDATE_SEQ_KEY = '_local_last_update_seq';
var DOC_COUNT_KEY = '_local_doc_count';
var UUID_KEY = '_local_uuid';

var doMigrationOne = function (name, db, callback) {
  // local require to prevent crashing if leveldown isn't installed.
  var leveldown = require("leveldown");

  var base = path.resolve(name);
  function move(store, index, cb) {
    var storePath = path.join(base, store);
    var opts;
    if (index === 3) {
      opts = {
        valueEncoding: 'binary'
      };
    } else {
      opts = {
        valueEncoding: 'json'
      };
    }
    var sub = db.sublevel(store, opts);
    var orig = level(storePath, opts);
    var from = orig.createReadStream();
    var writeStream = new LevelWriteStream$1(sub);
    var to = writeStream();
    from.on('end', function () {
      orig.close(function (err) {
        cb(err, storePath);
      });
    });
    from.pipe(to);
  }
  fs.unlink(base + '.uuid', function (err) {
    if (err) {
      return callback();
    }
    var todo = 4;
    var done = [];
    stores.forEach(function (store, i) {
      move(store, i, function (err, storePath) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        done.push(storePath);
        if (!(--todo)) {
          done.forEach(function (item) {
            leveldown.destroy(item, function () {
              if (++todo === done.length) {
                fs.rmdir(base, callback);
              }
            });
          });
        }
      });
    });
  });
};
var doMigrationTwo = function (db, stores, callback) {
  var batches = [];
  stores.bySeqStore.get(UUID_KEY, function (err, value) {
    if (err) {
      // no uuid key, so don't need to migrate;
      return callback();
    }
    batches.push({
      key: UUID_KEY,
      value: value,
      prefix: stores.metaStore,
      type: 'put',
      valueEncoding: 'json'
    });
    batches.push({
      key: UUID_KEY,
      prefix: stores.bySeqStore,
      type: 'del'
    });
    stores.bySeqStore.get(DOC_COUNT_KEY, function (err, value) {
      if (value) {
        // if no doc count key,
        // just skip
        // we can live with this
        batches.push({
          key: DOC_COUNT_KEY,
          value: value,
          prefix: stores.metaStore,
          type: 'put',
          valueEncoding: 'json'
        });
        batches.push({
          key: DOC_COUNT_KEY,
          prefix: stores.bySeqStore,
          type: 'del'
        });
      }
      stores.bySeqStore.get(UPDATE_SEQ_KEY, function (err, value) {
        if (value) {
          // if no UPDATE_SEQ_KEY
          // just skip
          // we've gone to far to stop.
          batches.push({
            key: UPDATE_SEQ_KEY,
            value: value,
            prefix: stores.metaStore,
            type: 'put',
            valueEncoding: 'json'
          });
          batches.push({
            key: UPDATE_SEQ_KEY,
            prefix: stores.bySeqStore,
            type: 'del'
          });
        }
        var deletedSeqs = {};
        stores.docStore.createReadStream({
          startKey: '_',
          endKey: '_\xFF'
        }).pipe(obj(function (ch, _, next) {
          if (!isLocalId(ch.key)) {
            return next();
          }
          batches.push({
            key: ch.key,
            prefix: stores.docStore,
            type: 'del'
          });
          var winner = winningRev(ch.value);
          Object.keys(ch.value.rev_map).forEach(function (key) {
            if (key !== 'winner') {
              this.push(formatSeq(ch.value.rev_map[key]));
            }
          }, this);
          var winningSeq = ch.value.rev_map[winner];
          stores.bySeqStore.get(formatSeq(winningSeq), function (err, value) {
            if (!err) {
              batches.push({
                key: ch.key,
                value: value,
                prefix: stores.localStore,
                type: 'put',
                valueEncoding: 'json'
              });
            }
            next();
          });

        })).pipe(obj(function (seq, _, next) {
          /* istanbul ignore if */
          if (deletedSeqs[seq]) {
            return next();
          }
          deletedSeqs[seq] = true;
          stores.bySeqStore.get(seq, function (err, resp) {
            /* istanbul ignore if */
            if (err || !isLocalId(resp._id)) {
              return next();
            }
            batches.push({
              key: seq,
              prefix: stores.bySeqStore,
              type: 'del'
            });
            next();
          });
        }, function () {
          db.batch(batches, callback);
        }));
      });
    });
  });

};

var migrate = {
  doMigrationOne: doMigrationOne,
  doMigrationTwo: doMigrationTwo
};

function LevelDownPouch(opts, callback) {

  // Users can pass in their own leveldown alternative here, in which case
  // it overrides the default one. (This is in addition to the custom builds.)
  var leveldown = opts.db;

  /* istanbul ignore else */
  if (!leveldown) {
    leveldown = requireLeveldown();

    /* istanbul ignore if */
    if (leveldown instanceof Error) {
      return callback(leveldown);
    }
  }

  var _opts = Object.assign({
    db: leveldown,
    migrate: migrate
  }, opts);

  LevelPouch$1.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
LevelDownPouch.valid = function () {
  return true;
};
LevelDownPouch.use_prefix = false;

function LevelPouch (PouchDB) {
  PouchDB.adapter('leveldb', LevelDownPouch, true);
}

export { LevelPouch as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWxldmVsZGIuYnJvd3Nlci5qcyIsInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWxldmVsZGIvc3JjL3JlcXVpcmVMZXZlbGRvd24uanMiLCIuLi9ub2RlX21vZHVsZXMvZW5jb2RpbmctZG93bi9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL25leHQtdGljay1icm93c2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VuY29kaW5nLWRvd24vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1pdGVyYXRvci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmNvZGluZy1kb3duL25vZGVfbW9kdWxlcy9hYnN0cmFjdC1sZXZlbGRvd24vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmNvZGluZy1kb3duL25vZGVfbW9kdWxlcy9hYnN0cmFjdC1sZXZlbGRvd24vYWJzdHJhY3QtbGV2ZWxkb3duLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VuY29kaW5nLWRvd24vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmNvZGluZy1kb3duL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLXBhY2thZ2VyL2xldmVsLXBhY2thZ2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL25vZGVfbW9kdWxlcy9hYnN0cmFjdC1sZXZlbGRvd24vbmV4dC10aWNrLWJyb3dzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvbGV2ZWwtanMvbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1pdGVyYXRvci5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZXZlbC1qcy9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL2Fic3RyYWN0LWNoYWluZWQtYmF0Y2guanMiLCIuLi9ub2RlX21vZHVsZXMvbGV2ZWwtanMvbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1sZXZlbGRvd24uanMiLCIuLi9ub2RlX21vZHVsZXMvbGV2ZWwtanMvbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZXZlbC1qcy91dGlsL2tleS1yYW5nZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZXZlbC1qcy91dGlsL2Rlc2VyaWFsaXplLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL2l0ZXJhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL3V0aWwvc2VyaWFsaXplLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL3V0aWwvc3VwcG9ydC5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZXZlbC1qcy91dGlsL2NsZWFyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsL2Jyb3dzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvd3JpdGUtc3RyZWFtL2FycmF5LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3dyaXRlLXN0cmVhbS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmQtc3RyZWFtL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLXdyaXRlLXN0cmVhbS9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1sZXZlbGRiL3NyYy9taWdyYXRlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWxldmVsZGIvc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHJlcXVpcmUgbGV2ZWxkb3duLiBwcm92aWRlIHZlcmJvc2Ugb3V0cHV0IG9uIGVycm9yIGFzIGl0IGlzIHRoZSBkZWZhdWx0XG4vLyBub2RlanMgYWRhcHRlciwgd2hpY2ggd2UgZG8gbm90IHByb3ZpZGUgZm9yIHRoZSB1c2VyXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xudmFyIHJlcXVpcmVMZXZlbGRvd24gPSBmdW5jdGlvbiAoKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJlcXVpcmUoJ2xldmVsZG93bicpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICAvKiBlc2xpbnQgbm8tZXgtYXNzaWduOiAwKi9cbiAgICBlcnIgPSBlcnIgfHwgJ2xldmVsZG93biBpbXBvcnQgZXJyb3InO1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ01PRFVMRV9OT1RfRk9VTkQnKSB7XG4gICAgICAvLyBoYW5kbGUgbGV2ZWxkb3duIG5vdCBpbnN0YWxsZWQgY2FzZVxuICAgICAgcmV0dXJuIG5ldyBFcnJvcihbXG4gICAgICAgICd0aGUgXFwnbGV2ZWxkb3duXFwnIHBhY2thZ2UgaXMgbm90IGF2YWlsYWJsZS4gaW5zdGFsbCBpdCwgb3IsJyxcbiAgICAgICAgJ3NwZWNpZnkgYW5vdGhlciBzdG9yYWdlIGJhY2tlbmQgdXNpbmcgdGhlIFxcJ2RiXFwnIG9wdGlvbidcbiAgICAgIF0uam9pbignICcpKTtcbiAgICB9IGVsc2UgaWYgKGVyci5tZXNzYWdlICYmIGVyci5tZXNzYWdlLm1hdGNoKCdNb2R1bGUgdmVyc2lvbiBtaXNtYXRjaCcpKSB7XG4gICAgICAvLyBoYW5kbGUgY29tbW9uIHVzZXIgZW52aW9ybm1lbnQgZXJyb3JcbiAgICAgIHJldHVybiBuZXcgRXJyb3IoW1xuICAgICAgICBlcnIubWVzc2FnZSxcbiAgICAgICAgJ1RoaXMgZ2VuZXJhbGx5IGltcGxpZXMgdGhhdCBsZXZlbGRvd24gd2FzIGJ1aWx0IHdpdGggYSBkaWZmZXJlbnQnLFxuICAgICAgICAndmVyc2lvbiBvZiBub2RlIHRoYW4gdGhhdCB3aGljaCBpcyBydW5uaW5nIG5vdy4gIFlvdSBtYXkgdHJ5JyxcbiAgICAgICAgJ2Z1bGx5IHJlbW92aW5nIGFuZCByZWluc3RhbGxpbmcgUG91Y2hEQiBvciBsZXZlbGRvd24gdG8gcmVzb2x2ZS4nXG4gICAgICBdLmpvaW4oJyAnKSk7XG4gICAgfVxuICAgIC8vIGhhbmRsZSBnZW5lcmFsIGludGVybmFsIG5vZGVqcyByZXF1aXJlIGVycm9yXG4gICAgcmV0dXJuIG5ldyBFcnJvcihlcnIudG9TdHJpbmcoKSArICc6IHVuYWJsZSB0byBpbXBvcnQgbGV2ZWxkb3duJyk7XG4gIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IHJlcXVpcmVMZXZlbGRvd247IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCdpbW1lZGlhdGUnKVxuIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgnLi9uZXh0LXRpY2snKVxuXG5mdW5jdGlvbiBBYnN0cmFjdEl0ZXJhdG9yIChkYikge1xuICBpZiAodHlwZW9mIGRiICE9PSAnb2JqZWN0JyB8fCBkYiA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYW4gYWJzdHJhY3QtbGV2ZWxkb3duIGNvbXBsaWFudCBzdG9yZScpXG4gIH1cblxuICB0aGlzLmRiID0gZGJcbiAgdGhpcy5fZW5kZWQgPSBmYWxzZVxuICB0aGlzLl9uZXh0aW5nID0gZmFsc2Vcbn1cblxuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCduZXh0KCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICBpZiAoc2VsZi5fZW5kZWQpIHtcbiAgICBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdjYW5ub3QgY2FsbCBuZXh0KCkgYWZ0ZXIgZW5kKCknKSlcbiAgICByZXR1cm4gc2VsZlxuICB9XG5cbiAgaWYgKHNlbGYuX25leHRpbmcpIHtcbiAgICBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdjYW5ub3QgY2FsbCBuZXh0KCkgYmVmb3JlIHByZXZpb3VzIG5leHQoKSBoYXMgY29tcGxldGVkJykpXG4gICAgcmV0dXJuIHNlbGZcbiAgfVxuXG4gIHNlbGYuX25leHRpbmcgPSB0cnVlXG4gIHNlbGYuX25leHQoZnVuY3Rpb24gKCkge1xuICAgIHNlbGYuX25leHRpbmcgPSBmYWxzZVxuICAgIGNhbGxiYWNrLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgfSlcblxuICByZXR1cm4gc2VsZlxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5fbmV4dCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUuc2VlayA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgaWYgKHRoaXMuX2VuZGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYW5ub3QgY2FsbCBzZWVrKCkgYWZ0ZXIgZW5kKCknKVxuICB9XG4gIGlmICh0aGlzLl9uZXh0aW5nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYW5ub3QgY2FsbCBzZWVrKCkgYmVmb3JlIG5leHQoKSBoYXMgY29tcGxldGVkJylcbiAgfVxuXG4gIHRhcmdldCA9IHRoaXMuZGIuX3NlcmlhbGl6ZUtleSh0YXJnZXQpXG4gIHRoaXMuX3NlZWsodGFyZ2V0KVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5fc2VlayA9IGZ1bmN0aW9uICh0YXJnZXQpIHt9XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdlbmQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIGlmICh0aGlzLl9lbmRlZCkge1xuICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdlbmQoKSBhbHJlYWR5IGNhbGxlZCBvbiBpdGVyYXRvcicpKVxuICB9XG5cbiAgdGhpcy5fZW5kZWQgPSB0cnVlXG4gIHRoaXMuX2VuZChjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUuX2VuZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuLy8gRXhwb3NlIGJyb3dzZXItY29tcGF0aWJsZSBuZXh0VGljayBmb3IgZGVwZW5kZW50c1xuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUuX25leHRUaWNrID0gbmV4dFRpY2tcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdEl0ZXJhdG9yXG4iLCJ2YXIgbmV4dFRpY2sgPSByZXF1aXJlKCcuL25leHQtdGljaycpXG5cbmZ1bmN0aW9uIEFic3RyYWN0Q2hhaW5lZEJhdGNoIChkYikge1xuICBpZiAodHlwZW9mIGRiICE9PSAnb2JqZWN0JyB8fCBkYiA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYW4gYWJzdHJhY3QtbGV2ZWxkb3duIGNvbXBsaWFudCBzdG9yZScpXG4gIH1cblxuICB0aGlzLmRiID0gZGJcbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG4gIHRoaXMuX3dyaXR0ZW4gPSBmYWxzZVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX2NoZWNrV3JpdHRlbiA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuX3dyaXR0ZW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dyaXRlKCkgYWxyZWFkeSBjYWxsZWQgb24gdGhpcyBiYXRjaCcpXG4gIH1cbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLnB1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgdmFyIGVyciA9IHRoaXMuZGIuX2NoZWNrS2V5KGtleSkgfHwgdGhpcy5kYi5fY2hlY2tWYWx1ZSh2YWx1ZSlcbiAgaWYgKGVycikgdGhyb3cgZXJyXG5cbiAga2V5ID0gdGhpcy5kYi5fc2VyaWFsaXplS2V5KGtleSlcbiAgdmFsdWUgPSB0aGlzLmRiLl9zZXJpYWxpemVWYWx1ZSh2YWx1ZSlcblxuICB0aGlzLl9wdXQoa2V5LCB2YWx1ZSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX3B1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gIHRoaXMuX29wZXJhdGlvbnMucHVzaCh7IHR5cGU6ICdwdXQnLCBrZXk6IGtleSwgdmFsdWU6IHZhbHVlIH0pXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgdmFyIGVyciA9IHRoaXMuZGIuX2NoZWNrS2V5KGtleSlcbiAgaWYgKGVycikgdGhyb3cgZXJyXG5cbiAga2V5ID0gdGhpcy5kYi5fc2VyaWFsaXplS2V5KGtleSlcbiAgdGhpcy5fZGVsKGtleSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX2RlbCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgdGhpcy5fb3BlcmF0aW9ucy5wdXNoKHsgdHlwZTogJ2RlbCcsIGtleToga2V5IH0pXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcbiAgdGhpcy5fY2xlYXIoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuX29wZXJhdGlvbnMgPSBbXVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHsgY2FsbGJhY2sgPSBvcHRpb25zIH1cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignd3JpdGUoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIHtcbiAgICBvcHRpb25zID0ge31cbiAgfVxuXG4gIHRoaXMuX3dyaXR0ZW4gPSB0cnVlXG4gIHRoaXMuX3dyaXRlKG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHRoaXMuZGIuX2JhdGNoKHRoaXMuX29wZXJhdGlvbnMsIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG4vLyBFeHBvc2UgYnJvd3Nlci1jb21wYXRpYmxlIG5leHRUaWNrIGZvciBkZXBlbmRlbnRzXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX25leHRUaWNrID0gbmV4dFRpY2tcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdENoYWluZWRCYXRjaFxuIiwidmFyIHh0ZW5kID0gcmVxdWlyZSgneHRlbmQnKVxudmFyIHN1cHBvcnRzID0gcmVxdWlyZSgnbGV2ZWwtc3VwcG9ydHMnKVxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlclxudmFyIEFic3RyYWN0SXRlcmF0b3IgPSByZXF1aXJlKCcuL2Fic3RyYWN0LWl0ZXJhdG9yJylcbnZhciBBYnN0cmFjdENoYWluZWRCYXRjaCA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaCcpXG52YXIgbmV4dFRpY2sgPSByZXF1aXJlKCcuL25leHQtdGljaycpXG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5XG52YXIgcmFuZ2VPcHRpb25zID0gJ3N0YXJ0IGVuZCBndCBndGUgbHQgbHRlJy5zcGxpdCgnICcpXG5cbmZ1bmN0aW9uIEFic3RyYWN0TGV2ZWxET1dOIChtYW5pZmVzdCkge1xuICB0aGlzLnN0YXR1cyA9ICduZXcnXG5cbiAgLy8gVE9ETyAobmV4dCBtYWpvcik6IG1ha2UgdGhpcyBtYW5kYXRvcnlcbiAgdGhpcy5zdXBwb3J0cyA9IHN1cHBvcnRzKG1hbmlmZXN0LCB7XG4gICAgc3RhdHVzOiB0cnVlXG4gIH0pXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgb2xkU3RhdHVzID0gdGhpcy5zdGF0dXNcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ29wZW4oKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkgb3B0aW9ucyA9IHt9XG5cbiAgb3B0aW9ucy5jcmVhdGVJZk1pc3NpbmcgPSBvcHRpb25zLmNyZWF0ZUlmTWlzc2luZyAhPT0gZmFsc2VcbiAgb3B0aW9ucy5lcnJvcklmRXhpc3RzID0gISFvcHRpb25zLmVycm9ySWZFeGlzdHNcblxuICB0aGlzLnN0YXR1cyA9ICdvcGVuaW5nJ1xuICB0aGlzLl9vcGVuKG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICBzZWxmLnN0YXR1cyA9IG9sZFN0YXR1c1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgICB9XG4gICAgc2VsZi5zdGF0dXMgPSAnb3BlbidcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fb3BlbiA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgb2xkU3RhdHVzID0gdGhpcy5zdGF0dXNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbG9zZSgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgdGhpcy5zdGF0dXMgPSAnY2xvc2luZydcbiAgdGhpcy5fY2xvc2UoZnVuY3Rpb24gKGVycikge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIHNlbGYuc3RhdHVzID0gb2xkU3RhdHVzXG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuICAgIH1cbiAgICBzZWxmLnN0YXR1cyA9ICdjbG9zZWQnXG4gICAgY2FsbGJhY2soKVxuICB9KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2Nsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSBjYWxsYmFjayA9IG9wdGlvbnNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIHZhciBlcnIgPSB0aGlzLl9jaGVja0tleShrZXkpXG4gIGlmIChlcnIpIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgZXJyKVxuXG4gIGtleSA9IHRoaXMuX3NlcmlhbGl6ZUtleShrZXkpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0JyB8fCBvcHRpb25zID09PSBudWxsKSBvcHRpb25zID0ge31cblxuICBvcHRpb25zLmFzQnVmZmVyID0gb3B0aW9ucy5hc0J1ZmZlciAhPT0gZmFsc2VcblxuICB0aGlzLl9nZXQoa2V5LCBvcHRpb25zLCBjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9nZXQgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7IGNhbGxiYWNrKG5ldyBFcnJvcignTm90Rm91bmQnKSkgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLnB1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3B1dCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgdmFyIGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSkgfHwgdGhpcy5fY2hlY2tWYWx1ZSh2YWx1ZSlcbiAgaWYgKGVycikgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcbiAgdmFsdWUgPSB0aGlzLl9zZXJpYWxpemVWYWx1ZSh2YWx1ZSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuXG4gIHRoaXMuX3B1dChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgbmV4dFRpY2soY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2RlbCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgdmFyIGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSlcbiAgaWYgKGVycikgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuXG4gIHRoaXMuX2RlbChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2RlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuYmF0Y2ggPSBmdW5jdGlvbiAoYXJyYXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX2NoYWluZWRCYXRjaCgpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSBjYWxsYmFjayA9IG9wdGlvbnNcblxuICBpZiAodHlwZW9mIGFycmF5ID09PSAnZnVuY3Rpb24nKSBjYWxsYmFjayA9IGFycmF5XG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYmF0Y2goYXJyYXkpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSkge1xuICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdiYXRjaChhcnJheSkgcmVxdWlyZXMgYW4gYXJyYXkgYXJndW1lbnQnKSlcbiAgfVxuXG4gIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2spXG4gIH1cblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuXG4gIHZhciBzZXJpYWxpemVkID0gbmV3IEFycmF5KGFycmF5Lmxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHR5cGVvZiBhcnJheVtpXSAhPT0gJ29iamVjdCcgfHwgYXJyYXlbaV0gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdiYXRjaChhcnJheSkgZWxlbWVudCBtdXN0IGJlIGFuIG9iamVjdCBhbmQgbm90IGBudWxsYCcpKVxuICAgIH1cblxuICAgIHZhciBlID0geHRlbmQoYXJyYXlbaV0pXG5cbiAgICBpZiAoZS50eXBlICE9PSAncHV0JyAmJiBlLnR5cGUgIT09ICdkZWwnKSB7XG4gICAgICByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIG5ldyBFcnJvcihcImB0eXBlYCBtdXN0IGJlICdwdXQnIG9yICdkZWwnXCIpKVxuICAgIH1cblxuICAgIHZhciBlcnIgPSB0aGlzLl9jaGVja0tleShlLmtleSlcbiAgICBpZiAoZXJyKSByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIGVycilcblxuICAgIGUua2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGUua2V5KVxuXG4gICAgaWYgKGUudHlwZSA9PT0gJ3B1dCcpIHtcbiAgICAgIHZhciB2YWx1ZUVyciA9IHRoaXMuX2NoZWNrVmFsdWUoZS52YWx1ZSlcbiAgICAgIGlmICh2YWx1ZUVycikgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCB2YWx1ZUVycilcblxuICAgICAgZS52YWx1ZSA9IHRoaXMuX3NlcmlhbGl6ZVZhbHVlKGUudmFsdWUpXG4gICAgfVxuXG4gICAgc2VyaWFsaXplZFtpXSA9IGVcbiAgfVxuXG4gIHRoaXMuX2JhdGNoKHNlcmlhbGl6ZWQsIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2JhdGNoID0gZnVuY3Rpb24gKGFycmF5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuICB9IGVsc2UgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXIoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIG9wdGlvbnMgPSBjbGVhblJhbmdlT3B0aW9ucyh0aGlzLCBvcHRpb25zKVxuICBvcHRpb25zLnJldmVyc2UgPSAhIW9wdGlvbnMucmV2ZXJzZVxuICBvcHRpb25zLmxpbWl0ID0gJ2xpbWl0JyBpbiBvcHRpb25zID8gb3B0aW9ucy5saW1pdCA6IC0xXG5cbiAgdGhpcy5fY2xlYXIob3B0aW9ucywgY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2xlYXIgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgLy8gQXZvaWQgc2V0dXBJdGVyYXRvck9wdGlvbnMsIHdvdWxkIHNlcmlhbGl6ZSByYW5nZSBvcHRpb25zIGEgc2Vjb25kIHRpbWUuXG4gIG9wdGlvbnMua2V5cyA9IHRydWVcbiAgb3B0aW9ucy52YWx1ZXMgPSBmYWxzZVxuICBvcHRpb25zLmtleUFzQnVmZmVyID0gdHJ1ZVxuICBvcHRpb25zLnZhbHVlQXNCdWZmZXIgPSB0cnVlXG5cbiAgdmFyIGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0b3Iob3B0aW9ucylcbiAgdmFyIGVtcHR5T3B0aW9ucyA9IHt9XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIHZhciBuZXh0ID0gZnVuY3Rpb24gKGVycikge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIHJldHVybiBpdGVyYXRvci5lbmQoZnVuY3Rpb24gKCkge1xuICAgICAgICBjYWxsYmFjayhlcnIpXG4gICAgICB9KVxuICAgIH1cblxuICAgIGl0ZXJhdG9yLm5leHQoZnVuY3Rpb24gKGVyciwga2V5KSB7XG4gICAgICBpZiAoZXJyKSByZXR1cm4gbmV4dChlcnIpXG4gICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpIHJldHVybiBpdGVyYXRvci5lbmQoY2FsbGJhY2spXG5cbiAgICAgIC8vIFRoaXMgY291bGQgYmUgb3B0aW1pemVkIGJ5IHVzaW5nIGEgYmF0Y2gsIGJ1dCB0aGUgZGVmYXVsdCBfY2xlYXJcbiAgICAgIC8vIGlzIG5vdCBtZWFudCB0byBiZSBmYXN0LiBJbXBsZW1lbnRhdGlvbnMgaGF2ZSBtb3JlIHJvb20gdG8gb3B0aW1pemVcbiAgICAgIC8vIGlmIHRoZXkgb3ZlcnJpZGUgX2NsZWFyLiBOb3RlOiB1c2luZyBfZGVsIGJ5cGFzc2VzIGtleSBzZXJpYWxpemF0aW9uLlxuICAgICAgc2VsZi5fZGVsKGtleSwgZW1wdHlPcHRpb25zLCBuZXh0KVxuICAgIH0pXG4gIH1cblxuICBuZXh0KClcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9zZXR1cEl0ZXJhdG9yT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBjbGVhblJhbmdlT3B0aW9ucyh0aGlzLCBvcHRpb25zKVxuXG4gIG9wdGlvbnMucmV2ZXJzZSA9ICEhb3B0aW9ucy5yZXZlcnNlXG4gIG9wdGlvbnMua2V5cyA9IG9wdGlvbnMua2V5cyAhPT0gZmFsc2VcbiAgb3B0aW9ucy52YWx1ZXMgPSBvcHRpb25zLnZhbHVlcyAhPT0gZmFsc2VcbiAgb3B0aW9ucy5saW1pdCA9ICdsaW1pdCcgaW4gb3B0aW9ucyA/IG9wdGlvbnMubGltaXQgOiAtMVxuICBvcHRpb25zLmtleUFzQnVmZmVyID0gb3B0aW9ucy5rZXlBc0J1ZmZlciAhPT0gZmFsc2VcbiAgb3B0aW9ucy52YWx1ZUFzQnVmZmVyID0gb3B0aW9ucy52YWx1ZUFzQnVmZmVyICE9PSBmYWxzZVxuXG4gIHJldHVybiBvcHRpb25zXG59XG5cbmZ1bmN0aW9uIGNsZWFuUmFuZ2VPcHRpb25zIChkYiwgb3B0aW9ucykge1xuICB2YXIgcmVzdWx0ID0ge31cblxuICBmb3IgKHZhciBrIGluIG9wdGlvbnMpIHtcbiAgICBpZiAoIWhhc093blByb3BlcnR5LmNhbGwob3B0aW9ucywgaykpIGNvbnRpbnVlXG5cbiAgICB2YXIgb3B0ID0gb3B0aW9uc1trXVxuXG4gICAgaWYgKGlzUmFuZ2VPcHRpb24oaykpIHtcbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCByZWplY3QgbnVsbGlzaCBhbmQgZW1wdHkgb3B0aW9ucyBoZXJlLiBXaGlsZVxuICAgICAgLy8gdGhvc2UgdHlwZXMgYXJlIGludmFsaWQgYXMga2V5cywgdGhleSBhcmUgdmFsaWQgYXMgcmFuZ2Ugb3B0aW9ucy5cbiAgICAgIG9wdCA9IGRiLl9zZXJpYWxpemVLZXkob3B0KVxuICAgIH1cblxuICAgIHJlc3VsdFtrXSA9IG9wdFxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBpc1JhbmdlT3B0aW9uIChrKSB7XG4gIHJldHVybiByYW5nZU9wdGlvbnMuaW5kZXhPZihrKSAhPT0gLTFcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLml0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0JyB8fCBvcHRpb25zID09PSBudWxsKSBvcHRpb25zID0ge31cbiAgb3B0aW9ucyA9IHRoaXMuX3NldHVwSXRlcmF0b3JPcHRpb25zKG9wdGlvbnMpXG4gIHJldHVybiB0aGlzLl9pdGVyYXRvcihvcHRpb25zKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2l0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBBYnN0cmFjdEl0ZXJhdG9yKHRoaXMpXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2hhaW5lZEJhdGNoID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gbmV3IEFic3RyYWN0Q2hhaW5lZEJhdGNoKHRoaXMpXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fc2VyaWFsaXplS2V5ID0gZnVuY3Rpb24gKGtleSkge1xuICByZXR1cm4ga2V5XG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fc2VyaWFsaXplVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2hlY2tLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKCdrZXkgY2Fubm90IGJlIGBudWxsYCBvciBgdW5kZWZpbmVkYCcpXG4gIH0gZWxzZSBpZiAoQnVmZmVyLmlzQnVmZmVyKGtleSkgJiYga2V5Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgRXJyb3IoJ2tleSBjYW5ub3QgYmUgYW4gZW1wdHkgQnVmZmVyJylcbiAgfSBlbHNlIGlmIChrZXkgPT09ICcnKSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcigna2V5IGNhbm5vdCBiZSBhbiBlbXB0eSBTdHJpbmcnKVxuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoa2V5KSAmJiBrZXkubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcigna2V5IGNhbm5vdCBiZSBhbiBlbXB0eSBBcnJheScpXG4gIH1cbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGVja1ZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcigndmFsdWUgY2Fubm90IGJlIGBudWxsYCBvciBgdW5kZWZpbmVkYCcpXG4gIH1cbn1cblxuLy8gRXhwb3NlIGJyb3dzZXItY29tcGF0aWJsZSBuZXh0VGljayBmb3IgZGVwZW5kZW50c1xuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9uZXh0VGljayA9IG5leHRUaWNrXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RMZXZlbERPV05cbiIsImV4cG9ydHMuQWJzdHJhY3RMZXZlbERPV04gPSByZXF1aXJlKCcuL2Fic3RyYWN0LWxldmVsZG93bicpXG5leHBvcnRzLkFic3RyYWN0SXRlcmF0b3IgPSByZXF1aXJlKCcuL2Fic3RyYWN0LWl0ZXJhdG9yJylcbmV4cG9ydHMuQWJzdHJhY3RDaGFpbmVkQmF0Y2ggPSByZXF1aXJlKCcuL2Fic3RyYWN0LWNoYWluZWQtYmF0Y2gnKVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBBYnN0cmFjdExldmVsRE9XTiA9IHJlcXVpcmUoJ2Fic3RyYWN0LWxldmVsZG93bicpLkFic3RyYWN0TGV2ZWxET1dOXG52YXIgQWJzdHJhY3RDaGFpbmVkQmF0Y2ggPSByZXF1aXJlKCdhYnN0cmFjdC1sZXZlbGRvd24nKS5BYnN0cmFjdENoYWluZWRCYXRjaFxudmFyIEFic3RyYWN0SXRlcmF0b3IgPSByZXF1aXJlKCdhYnN0cmFjdC1sZXZlbGRvd24nKS5BYnN0cmFjdEl0ZXJhdG9yXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpXG52YXIgQ29kZWMgPSByZXF1aXJlKCdsZXZlbC1jb2RlYycpXG52YXIgRW5jb2RpbmdFcnJvciA9IHJlcXVpcmUoJ2xldmVsLWVycm9ycycpLkVuY29kaW5nRXJyb3JcbnZhciByYW5nZU1ldGhvZHMgPSBbJ2FwcHJveGltYXRlU2l6ZScsICdjb21wYWN0UmFuZ2UnXVxuXG5tb2R1bGUuZXhwb3J0cyA9IERCLmRlZmF1bHQgPSBEQlxuXG5mdW5jdGlvbiBEQiAoZGIsIG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIERCKSkgcmV0dXJuIG5ldyBEQihkYiwgb3B0cylcblxuICB2YXIgbWFuaWZlc3QgPSBkYi5zdXBwb3J0cyB8fCB7fVxuICB2YXIgYWRkaXRpb25hbE1ldGhvZHMgPSBtYW5pZmVzdC5hZGRpdGlvbmFsTWV0aG9kcyB8fCB7fVxuXG4gIEFic3RyYWN0TGV2ZWxET1dOLmNhbGwodGhpcywgbWFuaWZlc3QpXG5cbiAgdGhpcy5zdXBwb3J0cy5lbmNvZGluZ3MgPSB0cnVlXG4gIHRoaXMuc3VwcG9ydHMuYWRkaXRpb25hbE1ldGhvZHMgPSB7fVxuXG4gIHJhbmdlTWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgLy8gVE9ETyAoZnV0dXJlIG1ham9yKTogcmVtb3ZlIHRoaXMgZmFsbGJhY2tcbiAgICB2YXIgZmFsbGJhY2sgPSB0eXBlb2YgZGJbbV0gPT09ICdmdW5jdGlvbidcblxuICAgIGlmIChhZGRpdGlvbmFsTWV0aG9kc1ttXSB8fCBmYWxsYmFjaykge1xuICAgICAgdGhpcy5zdXBwb3J0cy5hZGRpdGlvbmFsTWV0aG9kc1ttXSA9IHRydWVcblxuICAgICAgdGhpc1ttXSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCBvcHRzLCBjYikge1xuICAgICAgICBzdGFydCA9IHRoaXMuY29kZWMuZW5jb2RlS2V5KHN0YXJ0LCBvcHRzKVxuICAgICAgICBlbmQgPSB0aGlzLmNvZGVjLmVuY29kZUtleShlbmQsIG9wdHMpXG4gICAgICAgIHJldHVybiB0aGlzLmRiW21dKHN0YXJ0LCBlbmQsIG9wdHMsIGNiKVxuICAgICAgfVxuICAgIH1cbiAgfSwgdGhpcylcblxuICBvcHRzID0gb3B0cyB8fCB7fVxuICBpZiAodHlwZW9mIG9wdHMua2V5RW5jb2RpbmcgPT09ICd1bmRlZmluZWQnKSBvcHRzLmtleUVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmICh0eXBlb2Ygb3B0cy52YWx1ZUVuY29kaW5nID09PSAndW5kZWZpbmVkJykgb3B0cy52YWx1ZUVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdGhpcy5kYiA9IGRiXG4gIHRoaXMuY29kZWMgPSBuZXcgQ29kZWMob3B0cylcbn1cblxuaW5oZXJpdHMoREIsIEFic3RyYWN0TGV2ZWxET1dOKVxuXG5EQi5wcm90b3R5cGUudHlwZSA9ICdlbmNvZGluZy1kb3duJ1xuXG5EQi5wcm90b3R5cGUuX3NlcmlhbGl6ZUtleSA9XG5EQi5wcm90b3R5cGUuX3NlcmlhbGl6ZVZhbHVlID0gZnVuY3Rpb24gKGRhdHVtKSB7XG4gIHJldHVybiBkYXR1bVxufVxuXG5EQi5wcm90b3R5cGUuX29wZW4gPSBmdW5jdGlvbiAob3B0cywgY2IpIHtcbiAgdGhpcy5kYi5vcGVuKG9wdHMsIGNiKVxufVxuXG5EQi5wcm90b3R5cGUuX2Nsb3NlID0gZnVuY3Rpb24gKGNiKSB7XG4gIHRoaXMuZGIuY2xvc2UoY2IpXG59XG5cbkRCLnByb3RvdHlwZS5fcHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdHMsIGNiKSB7XG4gIGtleSA9IHRoaXMuY29kZWMuZW5jb2RlS2V5KGtleSwgb3B0cylcbiAgdmFsdWUgPSB0aGlzLmNvZGVjLmVuY29kZVZhbHVlKHZhbHVlLCBvcHRzKVxuICB0aGlzLmRiLnB1dChrZXksIHZhbHVlLCBvcHRzLCBjYilcbn1cblxuREIucHJvdG90eXBlLl9nZXQgPSBmdW5jdGlvbiAoa2V5LCBvcHRzLCBjYikge1xuICB2YXIgc2VsZiA9IHRoaXNcbiAga2V5ID0gdGhpcy5jb2RlYy5lbmNvZGVLZXkoa2V5LCBvcHRzKVxuICBvcHRzLmFzQnVmZmVyID0gdGhpcy5jb2RlYy52YWx1ZUFzQnVmZmVyKG9wdHMpXG4gIHRoaXMuZGIuZ2V0KGtleSwgb3B0cywgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICBpZiAoZXJyKSByZXR1cm4gY2IoZXJyKVxuICAgIHRyeSB7XG4gICAgICB2YWx1ZSA9IHNlbGYuY29kZWMuZGVjb2RlVmFsdWUodmFsdWUsIG9wdHMpXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gY2IobmV3IEVuY29kaW5nRXJyb3IoZXJyKSlcbiAgICB9XG4gICAgY2IobnVsbCwgdmFsdWUpXG4gIH0pXG59XG5cbkRCLnByb3RvdHlwZS5fZGVsID0gZnVuY3Rpb24gKGtleSwgb3B0cywgY2IpIHtcbiAga2V5ID0gdGhpcy5jb2RlYy5lbmNvZGVLZXkoa2V5LCBvcHRzKVxuICB0aGlzLmRiLmRlbChrZXksIG9wdHMsIGNiKVxufVxuXG5EQi5wcm90b3R5cGUuX2NoYWluZWRCYXRjaCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIG5ldyBCYXRjaCh0aGlzKVxufVxuXG5EQi5wcm90b3R5cGUuX2JhdGNoID0gZnVuY3Rpb24gKG9wcywgb3B0cywgY2IpIHtcbiAgb3BzID0gdGhpcy5jb2RlYy5lbmNvZGVCYXRjaChvcHMsIG9wdHMpXG4gIHRoaXMuZGIuYmF0Y2gob3BzLCBvcHRzLCBjYilcbn1cblxuREIucHJvdG90eXBlLl9pdGVyYXRvciA9IGZ1bmN0aW9uIChvcHRzKSB7XG4gIG9wdHMua2V5QXNCdWZmZXIgPSB0aGlzLmNvZGVjLmtleUFzQnVmZmVyKG9wdHMpXG4gIG9wdHMudmFsdWVBc0J1ZmZlciA9IHRoaXMuY29kZWMudmFsdWVBc0J1ZmZlcihvcHRzKVxuICByZXR1cm4gbmV3IEl0ZXJhdG9yKHRoaXMsIG9wdHMpXG59XG5cbkRCLnByb3RvdHlwZS5fY2xlYXIgPSBmdW5jdGlvbiAob3B0cywgY2FsbGJhY2spIHtcbiAgb3B0cyA9IHRoaXMuY29kZWMuZW5jb2RlTHRndChvcHRzKVxuICB0aGlzLmRiLmNsZWFyKG9wdHMsIGNhbGxiYWNrKVxufVxuXG5mdW5jdGlvbiBJdGVyYXRvciAoZGIsIG9wdHMpIHtcbiAgQWJzdHJhY3RJdGVyYXRvci5jYWxsKHRoaXMsIGRiKVxuICB0aGlzLmNvZGVjID0gZGIuY29kZWNcbiAgdGhpcy5rZXlzID0gb3B0cy5rZXlzXG4gIHRoaXMudmFsdWVzID0gb3B0cy52YWx1ZXNcbiAgdGhpcy5vcHRzID0gdGhpcy5jb2RlYy5lbmNvZGVMdGd0KG9wdHMpXG4gIHRoaXMuaXQgPSBkYi5kYi5pdGVyYXRvcih0aGlzLm9wdHMpXG59XG5cbmluaGVyaXRzKEl0ZXJhdG9yLCBBYnN0cmFjdEl0ZXJhdG9yKVxuXG5JdGVyYXRvci5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHRoaXMuaXQubmV4dChmdW5jdGlvbiAoZXJyLCBrZXksIHZhbHVlKSB7XG4gICAgaWYgKGVycikgcmV0dXJuIGNiKGVycilcbiAgICB0cnkge1xuICAgICAgaWYgKHNlbGYua2V5cyAmJiB0eXBlb2Yga2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBrZXkgPSBzZWxmLmNvZGVjLmRlY29kZUtleShrZXksIHNlbGYub3B0cylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSA9IHVuZGVmaW5lZFxuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi52YWx1ZXMgJiYgdHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YWx1ZSA9IHNlbGYuY29kZWMuZGVjb2RlVmFsdWUodmFsdWUsIHNlbGYub3B0cylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gdW5kZWZpbmVkXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gY2IobmV3IEVuY29kaW5nRXJyb3IoZXJyKSlcbiAgICB9XG4gICAgY2IobnVsbCwga2V5LCB2YWx1ZSlcbiAgfSlcbn1cblxuSXRlcmF0b3IucHJvdG90eXBlLl9zZWVrID0gZnVuY3Rpb24gKGtleSkge1xuICBrZXkgPSB0aGlzLmNvZGVjLmVuY29kZUtleShrZXksIHRoaXMub3B0cylcbiAgdGhpcy5pdC5zZWVrKGtleSlcbn1cblxuSXRlcmF0b3IucHJvdG90eXBlLl9lbmQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5pdC5lbmQoY2IpXG59XG5cbmZ1bmN0aW9uIEJhdGNoIChkYiwgY29kZWMpIHtcbiAgQWJzdHJhY3RDaGFpbmVkQmF0Y2guY2FsbCh0aGlzLCBkYilcbiAgdGhpcy5jb2RlYyA9IGRiLmNvZGVjXG4gIHRoaXMuYmF0Y2ggPSBkYi5kYi5iYXRjaCgpXG59XG5cbmluaGVyaXRzKEJhdGNoLCBBYnN0cmFjdENoYWluZWRCYXRjaClcblxuQmF0Y2gucHJvdG90eXBlLl9wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICBrZXkgPSB0aGlzLmNvZGVjLmVuY29kZUtleShrZXkpXG4gIHZhbHVlID0gdGhpcy5jb2RlYy5lbmNvZGVWYWx1ZSh2YWx1ZSlcbiAgdGhpcy5iYXRjaC5wdXQoa2V5LCB2YWx1ZSlcbn1cblxuQmF0Y2gucHJvdG90eXBlLl9kZWwgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIGtleSA9IHRoaXMuY29kZWMuZW5jb2RlS2V5KGtleSlcbiAgdGhpcy5iYXRjaC5kZWwoa2V5KVxufVxuXG5CYXRjaC5wcm90b3R5cGUuX2NsZWFyID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmJhdGNoLmNsZWFyKClcbn1cblxuQmF0Y2gucHJvdG90eXBlLl93cml0ZSA9IGZ1bmN0aW9uIChvcHRzLCBjYikge1xuICB0aGlzLmJhdGNoLndyaXRlKG9wdHMsIGNiKVxufVxuIiwidmFyIGxldmVsdXAgPSByZXF1aXJlKCdsZXZlbHVwJylcbnZhciBlbmNvZGUgPSByZXF1aXJlKCdlbmNvZGluZy1kb3duJylcblxuZnVuY3Rpb24gcGFja2FnZXIgKGxldmVsZG93bikge1xuICBmdW5jdGlvbiBMZXZlbCAobG9jYXRpb24sIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBsb2NhdGlvbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBsb2NhdGlvblxuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuICAgIH1cblxuICAgIGlmICghaXNPYmplY3Qob3B0aW9ucykpIHtcbiAgICAgIG9wdGlvbnMgPSBpc09iamVjdChsb2NhdGlvbikgPyBsb2NhdGlvbiA6IHt9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxldmVsdXAoZW5jb2RlKGxldmVsZG93bihsb2NhdGlvbiwgb3B0aW9ucyksIG9wdGlvbnMpLCBvcHRpb25zLCBjYWxsYmFjaylcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzT2JqZWN0IChvKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJiBvICE9PSBudWxsXG4gIH1cblxuICBbJ2Rlc3Ryb3knLCAncmVwYWlyJ10uZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICAgIGlmICh0eXBlb2YgbGV2ZWxkb3duW21dID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBMZXZlbFttXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbGV2ZWxkb3duW21dLmFwcGx5KGxldmVsZG93biwgYXJndW1lbnRzKVxuICAgICAgfVxuICAgIH1cbiAgfSlcblxuICBMZXZlbC5lcnJvcnMgPSBsZXZlbHVwLmVycm9yc1xuXG4gIHJldHVybiBMZXZlbFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhY2thZ2VyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJ2ltbWVkaWF0ZScpXG4iLCJ2YXIgbmV4dFRpY2sgPSByZXF1aXJlKCcuL25leHQtdGljaycpXG5cbmZ1bmN0aW9uIEFic3RyYWN0SXRlcmF0b3IgKGRiKSB7XG4gIGlmICh0eXBlb2YgZGIgIT09ICdvYmplY3QnIHx8IGRiID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBhYnN0cmFjdC1sZXZlbGRvd24gY29tcGxpYW50IHN0b3JlJylcbiAgfVxuXG4gIHRoaXMuZGIgPSBkYlxuICB0aGlzLl9lbmRlZCA9IGZhbHNlXG4gIHRoaXMuX25leHRpbmcgPSBmYWxzZVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ25leHQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIGlmIChzZWxmLl9lbmRlZCkge1xuICAgIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIG5leHQoKSBhZnRlciBlbmQoKScpKVxuICAgIHJldHVybiBzZWxmXG4gIH1cblxuICBpZiAoc2VsZi5fbmV4dGluZykge1xuICAgIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIG5leHQoKSBiZWZvcmUgcHJldmlvdXMgbmV4dCgpIGhhcyBjb21wbGV0ZWQnKSlcbiAgICByZXR1cm4gc2VsZlxuICB9XG5cbiAgc2VsZi5fbmV4dGluZyA9IHRydWVcbiAgc2VsZi5fbmV4dChmdW5jdGlvbiAoKSB7XG4gICAgc2VsZi5fbmV4dGluZyA9IGZhbHNlXG4gICAgY2FsbGJhY2suYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICB9KVxuXG4gIHJldHVybiBzZWxmXG59XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLl9uZXh0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5zZWVrID0gZnVuY3Rpb24gKHRhcmdldCkge1xuICBpZiAodGhpcy5fZW5kZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIHNlZWsoKSBhZnRlciBlbmQoKScpXG4gIH1cbiAgaWYgKHRoaXMuX25leHRpbmcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIHNlZWsoKSBiZWZvcmUgbmV4dCgpIGhhcyBjb21wbGV0ZWQnKVxuICB9XG5cbiAgdGFyZ2V0ID0gdGhpcy5kYi5fc2VyaWFsaXplS2V5KHRhcmdldClcbiAgdGhpcy5fc2Vlayh0YXJnZXQpXG59XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLl9zZWVrID0gZnVuY3Rpb24gKHRhcmdldCkge31cblxuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2VuZCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgaWYgKHRoaXMuX2VuZGVkKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2VuZCgpIGFscmVhZHkgY2FsbGVkIG9uIGl0ZXJhdG9yJykpXG4gIH1cblxuICB0aGlzLl9lbmRlZCA9IHRydWVcbiAgdGhpcy5fZW5kKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5fZW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG4vLyBFeHBvc2UgYnJvd3Nlci1jb21wYXRpYmxlIG5leHRUaWNrIGZvciBkZXBlbmRlbnRzXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5fbmV4dFRpY2sgPSBuZXh0VGlja1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0SXRlcmF0b3JcbiIsInZhciBuZXh0VGljayA9IHJlcXVpcmUoJy4vbmV4dC10aWNrJylcblxuZnVuY3Rpb24gQWJzdHJhY3RDaGFpbmVkQmF0Y2ggKGRiKSB7XG4gIGlmICh0eXBlb2YgZGIgIT09ICdvYmplY3QnIHx8IGRiID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBhYnN0cmFjdC1sZXZlbGRvd24gY29tcGxpYW50IHN0b3JlJylcbiAgfVxuXG4gIHRoaXMuZGIgPSBkYlxuICB0aGlzLl9vcGVyYXRpb25zID0gW11cbiAgdGhpcy5fd3JpdHRlbiA9IGZhbHNlXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fY2hlY2tXcml0dGVuID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5fd3JpdHRlbikge1xuICAgIHRocm93IG5ldyBFcnJvcignd3JpdGUoKSBhbHJlYWR5IGNhbGxlZCBvbiB0aGlzIGJhdGNoJylcbiAgfVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB2YXIgZXJyID0gdGhpcy5kYi5fY2hlY2tLZXkoa2V5KSB8fCB0aGlzLmRiLl9jaGVja1ZhbHVlKHZhbHVlKVxuICBpZiAoZXJyKSB0aHJvdyBlcnJcblxuICBrZXkgPSB0aGlzLmRiLl9zZXJpYWxpemVLZXkoa2V5KVxuICB2YWx1ZSA9IHRoaXMuZGIuX3NlcmlhbGl6ZVZhbHVlKHZhbHVlKVxuXG4gIHRoaXMuX3B1dChrZXksIHZhbHVlKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fcHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgdGhpcy5fb3BlcmF0aW9ucy5wdXNoKHsgdHlwZTogJ3B1dCcsIGtleToga2V5LCB2YWx1ZTogdmFsdWUgfSlcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB2YXIgZXJyID0gdGhpcy5kYi5fY2hlY2tLZXkoa2V5KVxuICBpZiAoZXJyKSB0aHJvdyBlcnJcblxuICBrZXkgPSB0aGlzLmRiLl9zZXJpYWxpemVLZXkoa2V5KVxuICB0aGlzLl9kZWwoa2V5KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fZGVsID0gZnVuY3Rpb24gKGtleSkge1xuICB0aGlzLl9vcGVyYXRpb25zLnB1c2goeyB0eXBlOiAnZGVsJywga2V5OiBrZXkgfSlcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLl9jaGVja1dyaXR0ZW4oKVxuICB0aGlzLl9jbGVhcigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLl9jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuICB0aGlzLl9jaGVja1dyaXR0ZW4oKVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykgeyBjYWxsYmFjayA9IG9wdGlvbnMgfVxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd3cml0ZSgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkge1xuICAgIG9wdGlvbnMgPSB7fVxuICB9XG5cbiAgdGhpcy5fd3JpdHRlbiA9IHRydWVcbiAgdGhpcy5fd3JpdGUob3B0aW9ucywgY2FsbGJhY2spXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdGhpcy5kYi5fYmF0Y2godGhpcy5fb3BlcmF0aW9ucywgb3B0aW9ucywgY2FsbGJhY2spXG59XG5cbi8vIEV4cG9zZSBicm93c2VyLWNvbXBhdGlibGUgbmV4dFRpY2sgZm9yIGRlcGVuZGVudHNcbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fbmV4dFRpY2sgPSBuZXh0VGlja1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Q2hhaW5lZEJhdGNoXG4iLCJ2YXIgeHRlbmQgPSByZXF1aXJlKCd4dGVuZCcpXG52YXIgc3VwcG9ydHMgPSByZXF1aXJlKCdsZXZlbC1zdXBwb3J0cycpXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyXG52YXIgQWJzdHJhY3RJdGVyYXRvciA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtaXRlcmF0b3InKVxudmFyIEFic3RyYWN0Q2hhaW5lZEJhdGNoID0gcmVxdWlyZSgnLi9hYnN0cmFjdC1jaGFpbmVkLWJhdGNoJylcbnZhciBuZXh0VGljayA9IHJlcXVpcmUoJy4vbmV4dC10aWNrJylcbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHlcbnZhciByYW5nZU9wdGlvbnMgPSAnc3RhcnQgZW5kIGd0IGd0ZSBsdCBsdGUnLnNwbGl0KCcgJylcblxuZnVuY3Rpb24gQWJzdHJhY3RMZXZlbERPV04gKG1hbmlmZXN0KSB7XG4gIHRoaXMuc3RhdHVzID0gJ25ldydcblxuICAvLyBUT0RPIChuZXh0IG1ham9yKTogbWFrZSB0aGlzIG1hbmRhdG9yeVxuICB0aGlzLnN1cHBvcnRzID0gc3VwcG9ydHMobWFuaWZlc3QsIHtcbiAgICBzdGF0dXM6IHRydWVcbiAgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBvbGRTdGF0dXMgPSB0aGlzLnN0YXR1c1xuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignb3BlbigpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0JyB8fCBvcHRpb25zID09PSBudWxsKSBvcHRpb25zID0ge31cblxuICBvcHRpb25zLmNyZWF0ZUlmTWlzc2luZyA9IG9wdGlvbnMuY3JlYXRlSWZNaXNzaW5nICE9PSBmYWxzZVxuICBvcHRpb25zLmVycm9ySWZFeGlzdHMgPSAhIW9wdGlvbnMuZXJyb3JJZkV4aXN0c1xuXG4gIHRoaXMuc3RhdHVzID0gJ29wZW5pbmcnXG4gIHRoaXMuX29wZW4ob3B0aW9ucywgZnVuY3Rpb24gKGVycikge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIHNlbGYuc3RhdHVzID0gb2xkU3RhdHVzXG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuICAgIH1cbiAgICBzZWxmLnN0YXR1cyA9ICdvcGVuJ1xuICAgIGNhbGxiYWNrKClcbiAgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBvbGRTdGF0dXMgPSB0aGlzLnN0YXR1c1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nsb3NlKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICB0aGlzLnN0YXR1cyA9ICdjbG9zaW5nJ1xuICB0aGlzLl9jbG9zZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgaWYgKGVycikge1xuICAgICAgc2VsZi5zdGF0dXMgPSBvbGRTdGF0dXNcbiAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG4gICAgfVxuICAgIHNlbGYuc3RhdHVzID0gJ2Nsb3NlZCdcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2xvc2UgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgbmV4dFRpY2soY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgdmFyIGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSlcbiAgaWYgKGVycikgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuXG4gIG9wdGlvbnMuYXNCdWZmZXIgPSBvcHRpb25zLmFzQnVmZmVyICE9PSBmYWxzZVxuXG4gIHRoaXMuX2dldChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2dldCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHsgY2FsbGJhY2sobmV3IEVycm9yKCdOb3RGb3VuZCcpKSB9KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcigncHV0KCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICB2YXIgZXJyID0gdGhpcy5fY2hlY2tLZXkoa2V5KSB8fCB0aGlzLl9jaGVja1ZhbHVlKHZhbHVlKVxuICBpZiAoZXJyKSByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIGVycilcblxuICBrZXkgPSB0aGlzLl9zZXJpYWxpemVLZXkoa2V5KVxuICB2YWx1ZSA9IHRoaXMuX3NlcmlhbGl6ZVZhbHVlKHZhbHVlKVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkgb3B0aW9ucyA9IHt9XG5cbiAgdGhpcy5fcHV0KGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX3B1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignZGVsKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICB2YXIgZXJyID0gdGhpcy5fY2hlY2tLZXkoa2V5KVxuICBpZiAoZXJyKSByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIGVycilcblxuICBrZXkgPSB0aGlzLl9zZXJpYWxpemVLZXkoa2V5KVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkgb3B0aW9ucyA9IHt9XG5cbiAgdGhpcy5fZGVsKGtleSwgb3B0aW9ucywgY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fZGVsID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgbmV4dFRpY2soY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5iYXRjaCA9IGZ1bmN0aW9uIChhcnJheSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fY2hhaW5lZEJhdGNoKClcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgYXJyYXkgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gYXJyYXlcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdiYXRjaChhcnJheSkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXkpKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2JhdGNoKGFycmF5KSByZXF1aXJlcyBhbiBhcnJheSBhcmd1bWVudCcpKVxuICB9XG5cbiAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaylcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkgb3B0aW9ucyA9IHt9XG5cbiAgdmFyIHNlcmlhbGl6ZWQgPSBuZXcgQXJyYXkoYXJyYXkubGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodHlwZW9mIGFycmF5W2ldICE9PSAnb2JqZWN0JyB8fCBhcnJheVtpXSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2JhdGNoKGFycmF5KSBlbGVtZW50IG11c3QgYmUgYW4gb2JqZWN0IGFuZCBub3QgYG51bGxgJykpXG4gICAgfVxuXG4gICAgdmFyIGUgPSB4dGVuZChhcnJheVtpXSlcblxuICAgIGlmIChlLnR5cGUgIT09ICdwdXQnICYmIGUudHlwZSAhPT0gJ2RlbCcpIHtcbiAgICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKFwiYHR5cGVgIG11c3QgYmUgJ3B1dCcgb3IgJ2RlbCdcIikpXG4gICAgfVxuXG4gICAgdmFyIGVyciA9IHRoaXMuX2NoZWNrS2V5KGUua2V5KVxuICAgIGlmIChlcnIpIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgZXJyKVxuXG4gICAgZS5rZXkgPSB0aGlzLl9zZXJpYWxpemVLZXkoZS5rZXkpXG5cbiAgICBpZiAoZS50eXBlID09PSAncHV0Jykge1xuICAgICAgdmFyIHZhbHVlRXJyID0gdGhpcy5fY2hlY2tWYWx1ZShlLnZhbHVlKVxuICAgICAgaWYgKHZhbHVlRXJyKSByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIHZhbHVlRXJyKVxuXG4gICAgICBlLnZhbHVlID0gdGhpcy5fc2VyaWFsaXplVmFsdWUoZS52YWx1ZSlcbiAgICB9XG5cbiAgICBzZXJpYWxpemVkW2ldID0gZVxuICB9XG5cbiAgdGhpcy5fYmF0Y2goc2VyaWFsaXplZCwgb3B0aW9ucywgY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fYmF0Y2ggPSBmdW5jdGlvbiAoYXJyYXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG4gIH0gZWxzZSBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhcigpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgb3B0aW9ucyA9IGNsZWFuUmFuZ2VPcHRpb25zKHRoaXMsIG9wdGlvbnMpXG4gIG9wdGlvbnMucmV2ZXJzZSA9ICEhb3B0aW9ucy5yZXZlcnNlXG4gIG9wdGlvbnMubGltaXQgPSAnbGltaXQnIGluIG9wdGlvbnMgPyBvcHRpb25zLmxpbWl0IDogLTFcblxuICB0aGlzLl9jbGVhcihvcHRpb25zLCBjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jbGVhciA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuICAvLyBBdm9pZCBzZXR1cEl0ZXJhdG9yT3B0aW9ucywgd291bGQgc2VyaWFsaXplIHJhbmdlIG9wdGlvbnMgYSBzZWNvbmQgdGltZS5cbiAgb3B0aW9ucy5rZXlzID0gdHJ1ZVxuICBvcHRpb25zLnZhbHVlcyA9IGZhbHNlXG4gIG9wdGlvbnMua2V5QXNCdWZmZXIgPSB0cnVlXG4gIG9wdGlvbnMudmFsdWVBc0J1ZmZlciA9IHRydWVcblxuICB2YXIgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRvcihvcHRpb25zKVxuICB2YXIgZW1wdHlPcHRpb25zID0ge31cbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgdmFyIG5leHQgPSBmdW5jdGlvbiAoZXJyKSB7XG4gICAgaWYgKGVycikge1xuICAgICAgcmV0dXJuIGl0ZXJhdG9yLmVuZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycilcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgaXRlcmF0b3IubmV4dChmdW5jdGlvbiAoZXJyLCBrZXkpIHtcbiAgICAgIGlmIChlcnIpIHJldHVybiBuZXh0KGVycilcbiAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGl0ZXJhdG9yLmVuZChjYWxsYmFjaylcblxuICAgICAgLy8gVGhpcyBjb3VsZCBiZSBvcHRpbWl6ZWQgYnkgdXNpbmcgYSBiYXRjaCwgYnV0IHRoZSBkZWZhdWx0IF9jbGVhclxuICAgICAgLy8gaXMgbm90IG1lYW50IHRvIGJlIGZhc3QuIEltcGxlbWVudGF0aW9ucyBoYXZlIG1vcmUgcm9vbSB0byBvcHRpbWl6ZVxuICAgICAgLy8gaWYgdGhleSBvdmVycmlkZSBfY2xlYXIuIE5vdGU6IHVzaW5nIF9kZWwgYnlwYXNzZXMga2V5IHNlcmlhbGl6YXRpb24uXG4gICAgICBzZWxmLl9kZWwoa2V5LCBlbXB0eU9wdGlvbnMsIG5leHQpXG4gICAgfSlcbiAgfVxuXG4gIG5leHQoKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX3NldHVwSXRlcmF0b3JPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IGNsZWFuUmFuZ2VPcHRpb25zKHRoaXMsIG9wdGlvbnMpXG5cbiAgb3B0aW9ucy5yZXZlcnNlID0gISFvcHRpb25zLnJldmVyc2VcbiAgb3B0aW9ucy5rZXlzID0gb3B0aW9ucy5rZXlzICE9PSBmYWxzZVxuICBvcHRpb25zLnZhbHVlcyA9IG9wdGlvbnMudmFsdWVzICE9PSBmYWxzZVxuICBvcHRpb25zLmxpbWl0ID0gJ2xpbWl0JyBpbiBvcHRpb25zID8gb3B0aW9ucy5saW1pdCA6IC0xXG4gIG9wdGlvbnMua2V5QXNCdWZmZXIgPSBvcHRpb25zLmtleUFzQnVmZmVyICE9PSBmYWxzZVxuICBvcHRpb25zLnZhbHVlQXNCdWZmZXIgPSBvcHRpb25zLnZhbHVlQXNCdWZmZXIgIT09IGZhbHNlXG5cbiAgcmV0dXJuIG9wdGlvbnNcbn1cblxuZnVuY3Rpb24gY2xlYW5SYW5nZU9wdGlvbnMgKGRiLCBvcHRpb25zKSB7XG4gIHZhciByZXN1bHQgPSB7fVxuXG4gIGZvciAodmFyIGsgaW4gb3B0aW9ucykge1xuICAgIGlmICghaGFzT3duUHJvcGVydHkuY2FsbChvcHRpb25zLCBrKSkgY29udGludWVcblxuICAgIHZhciBvcHQgPSBvcHRpb25zW2tdXG5cbiAgICBpZiAoaXNSYW5nZU9wdGlvbihrKSkge1xuICAgICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IHJlamVjdCBudWxsaXNoIGFuZCBlbXB0eSBvcHRpb25zIGhlcmUuIFdoaWxlXG4gICAgICAvLyB0aG9zZSB0eXBlcyBhcmUgaW52YWxpZCBhcyBrZXlzLCB0aGV5IGFyZSB2YWxpZCBhcyByYW5nZSBvcHRpb25zLlxuICAgICAgb3B0ID0gZGIuX3NlcmlhbGl6ZUtleShvcHQpXG4gICAgfVxuXG4gICAgcmVzdWx0W2tdID0gb3B0XG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIGlzUmFuZ2VPcHRpb24gKGspIHtcbiAgcmV0dXJuIHJhbmdlT3B0aW9ucy5pbmRleE9mKGspICE9PSAtMVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuaXRlcmF0b3IgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuICBvcHRpb25zID0gdGhpcy5fc2V0dXBJdGVyYXRvck9wdGlvbnMob3B0aW9ucylcbiAgcmV0dXJuIHRoaXMuX2l0ZXJhdG9yKG9wdGlvbnMpXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5faXRlcmF0b3IgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICByZXR1cm4gbmV3IEFic3RyYWN0SXRlcmF0b3IodGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGFpbmVkQmF0Y2ggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgQWJzdHJhY3RDaGFpbmVkQmF0Y2godGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9zZXJpYWxpemVLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHJldHVybiBrZXlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9zZXJpYWxpemVWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWVcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGVja0tleSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgaWYgKGtleSA9PT0gbnVsbCB8fCBrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBuZXcgRXJyb3IoJ2tleSBjYW5ub3QgYmUgYG51bGxgIG9yIGB1bmRlZmluZWRgJylcbiAgfSBlbHNlIGlmIChCdWZmZXIuaXNCdWZmZXIoa2V5KSAmJiBrZXkubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcigna2V5IGNhbm5vdCBiZSBhbiBlbXB0eSBCdWZmZXInKVxuICB9IGVsc2UgaWYgKGtleSA9PT0gJycpIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKCdrZXkgY2Fubm90IGJlIGFuIGVtcHR5IFN0cmluZycpXG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShrZXkpICYmIGtleS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKCdrZXkgY2Fubm90IGJlIGFuIGVtcHR5IEFycmF5JylcbiAgfVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2NoZWNrVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKCd2YWx1ZSBjYW5ub3QgYmUgYG51bGxgIG9yIGB1bmRlZmluZWRgJylcbiAgfVxufVxuXG4vLyBFeHBvc2UgYnJvd3Nlci1jb21wYXRpYmxlIG5leHRUaWNrIGZvciBkZXBlbmRlbnRzXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX25leHRUaWNrID0gbmV4dFRpY2tcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdExldmVsRE9XTlxuIiwiZXhwb3J0cy5BYnN0cmFjdExldmVsRE9XTiA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtbGV2ZWxkb3duJylcbmV4cG9ydHMuQWJzdHJhY3RJdGVyYXRvciA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtaXRlcmF0b3InKVxuZXhwb3J0cy5BYnN0cmFjdENoYWluZWRCYXRjaCA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaCcpXG4iLCIvKiBnbG9iYWwgSURCS2V5UmFuZ2UgKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBsdGd0ID0gcmVxdWlyZSgnbHRndCcpXG52YXIgTk9ORSA9IHt9XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlS2V5UmFuZ2UgKG9wdGlvbnMpIHtcbiAgdmFyIGxvd2VyID0gbHRndC5sb3dlckJvdW5kKG9wdGlvbnMsIE5PTkUpXG4gIHZhciB1cHBlciA9IGx0Z3QudXBwZXJCb3VuZChvcHRpb25zLCBOT05FKVxuICB2YXIgbG93ZXJPcGVuID0gbHRndC5sb3dlckJvdW5kRXhjbHVzaXZlKG9wdGlvbnMsIE5PTkUpXG4gIHZhciB1cHBlck9wZW4gPSBsdGd0LnVwcGVyQm91bmRFeGNsdXNpdmUob3B0aW9ucywgTk9ORSlcblxuICBpZiAobG93ZXIgIT09IE5PTkUgJiYgdXBwZXIgIT09IE5PTkUpIHtcbiAgICByZXR1cm4gSURCS2V5UmFuZ2UuYm91bmQobG93ZXIsIHVwcGVyLCBsb3dlck9wZW4sIHVwcGVyT3BlbilcbiAgfSBlbHNlIGlmIChsb3dlciAhPT0gTk9ORSkge1xuICAgIHJldHVybiBJREJLZXlSYW5nZS5sb3dlckJvdW5kKGxvd2VyLCBsb3dlck9wZW4pXG4gIH0gZWxzZSBpZiAodXBwZXIgIT09IE5PTkUpIHtcbiAgICByZXR1cm4gSURCS2V5UmFuZ2UudXBwZXJCb3VuZCh1cHBlciwgdXBwZXJPcGVuKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyXG52YXIgdGEyc3RyID0gKGZ1bmN0aW9uICgpIHtcbiAgaWYgKGdsb2JhbC5UZXh0RGVjb2Rlcikge1xuICAgIHZhciBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXG4gICAgcmV0dXJuIGRlY29kZXIuZGVjb2RlLmJpbmQoZGVjb2RlcilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gdGEyc3RyICh0YSkge1xuICAgICAgcmV0dXJuIHRhMmJ1Zih0YSkudG9TdHJpbmcoKVxuICAgIH1cbiAgfVxufSkoKVxuXG52YXIgYWIyc3RyID0gKGZ1bmN0aW9uICgpIHtcbiAgaWYgKGdsb2JhbC5UZXh0RGVjb2Rlcikge1xuICAgIHZhciBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXG4gICAgcmV0dXJuIGRlY29kZXIuZGVjb2RlLmJpbmQoZGVjb2RlcilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWIyc3RyIChhYikge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGFiKS50b1N0cmluZygpXG4gICAgfVxuICB9XG59KSgpXG5cbmZ1bmN0aW9uIHRhMmJ1ZiAodGEpIHtcbiAgdmFyIGJ1ZiA9IEJ1ZmZlci5mcm9tKHRhLmJ1ZmZlcilcblxuICBpZiAodGEuYnl0ZUxlbmd0aCA9PT0gdGEuYnVmZmVyLmJ5dGVMZW5ndGgpIHtcbiAgICByZXR1cm4gYnVmXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJ1Zi5zbGljZSh0YS5ieXRlT2Zmc2V0LCB0YS5ieXRlT2Zmc2V0ICsgdGEuYnl0ZUxlbmd0aClcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChkYXRhLCBhc0J1ZmZlcikge1xuICBpZiAoZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICByZXR1cm4gYXNCdWZmZXIgPyB0YTJidWYoZGF0YSkgOiB0YTJzdHIoZGF0YSlcbiAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICByZXR1cm4gYXNCdWZmZXIgPyBCdWZmZXIuZnJvbShkYXRhKSA6IGFiMnN0cihkYXRhKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBhc0J1ZmZlciA/IEJ1ZmZlci5mcm9tKFN0cmluZyhkYXRhKSkgOiBTdHJpbmcoZGF0YSlcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJylcbnZhciBBYnN0cmFjdEl0ZXJhdG9yID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RJdGVyYXRvclxudmFyIGNyZWF0ZUtleVJhbmdlID0gcmVxdWlyZSgnLi91dGlsL2tleS1yYW5nZScpXG52YXIgZGVzZXJpYWxpemUgPSByZXF1aXJlKCcuL3V0aWwvZGVzZXJpYWxpemUnKVxudmFyIG5vb3AgPSBmdW5jdGlvbiAoKSB7fVxuXG5tb2R1bGUuZXhwb3J0cyA9IEl0ZXJhdG9yXG5cbmZ1bmN0aW9uIEl0ZXJhdG9yIChkYiwgbG9jYXRpb24sIG9wdGlvbnMpIHtcbiAgQWJzdHJhY3RJdGVyYXRvci5jYWxsKHRoaXMsIGRiKVxuXG4gIHRoaXMuX2xpbWl0ID0gb3B0aW9ucy5saW1pdFxuICB0aGlzLl9jb3VudCA9IDBcbiAgdGhpcy5fY2FsbGJhY2sgPSBudWxsXG4gIHRoaXMuX2NhY2hlID0gW11cbiAgdGhpcy5fY29tcGxldGVkID0gZmFsc2VcbiAgdGhpcy5fYWJvcnRlZCA9IGZhbHNlXG4gIHRoaXMuX2Vycm9yID0gbnVsbFxuICB0aGlzLl90cmFuc2FjdGlvbiA9IG51bGxcblxuICB0aGlzLl9rZXlzID0gb3B0aW9ucy5rZXlzXG4gIHRoaXMuX3ZhbHVlcyA9IG9wdGlvbnMudmFsdWVzXG4gIHRoaXMuX2tleUFzQnVmZmVyID0gb3B0aW9ucy5rZXlBc0J1ZmZlclxuICB0aGlzLl92YWx1ZUFzQnVmZmVyID0gb3B0aW9ucy52YWx1ZUFzQnVmZmVyXG5cbiAgaWYgKHRoaXMuX2xpbWl0ID09PSAwKSB7XG4gICAgdGhpcy5fY29tcGxldGVkID0gdHJ1ZVxuICAgIHJldHVyblxuICB9XG5cbiAgdHJ5IHtcbiAgICB2YXIga2V5UmFuZ2UgPSBjcmVhdGVLZXlSYW5nZShvcHRpb25zKVxuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gVGhlIGxvd2VyIGtleSBpcyBncmVhdGVyIHRoYW4gdGhlIHVwcGVyIGtleS5cbiAgICAvLyBJbmRleGVkREIgdGhyb3dzIGFuIGVycm9yLCBidXQgd2UnbGwganVzdCByZXR1cm4gMCByZXN1bHRzLlxuICAgIHRoaXMuX2NvbXBsZXRlZCA9IHRydWVcbiAgICByZXR1cm5cbiAgfVxuXG4gIHRoaXMuY3JlYXRlSXRlcmF0b3IobG9jYXRpb24sIGtleVJhbmdlLCBvcHRpb25zLnJldmVyc2UpXG59XG5cbmluaGVyaXRzKEl0ZXJhdG9yLCBBYnN0cmFjdEl0ZXJhdG9yKVxuXG5JdGVyYXRvci5wcm90b3R5cGUuY3JlYXRlSXRlcmF0b3IgPSBmdW5jdGlvbiAobG9jYXRpb24sIGtleVJhbmdlLCByZXZlcnNlKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgdHJhbnNhY3Rpb24gPSB0aGlzLmRiLmRiLnRyYW5zYWN0aW9uKFtsb2NhdGlvbl0sICdyZWFkb25seScpXG4gIHZhciBzdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKGxvY2F0aW9uKVxuICB2YXIgcmVxID0gc3RvcmUub3BlbkN1cnNvcihrZXlSYW5nZSwgcmV2ZXJzZSA/ICdwcmV2JyA6ICduZXh0JylcblxuICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2KSB7XG4gICAgdmFyIGN1cnNvciA9IGV2LnRhcmdldC5yZXN1bHRcbiAgICBpZiAoY3Vyc29yKSBzZWxmLm9uSXRlbShjdXJzb3IpXG4gIH1cblxuICB0aGlzLl90cmFuc2FjdGlvbiA9IHRyYW5zYWN0aW9uXG5cbiAgLy8gSWYgYW4gZXJyb3Igb2NjdXJzIChvbiB0aGUgcmVxdWVzdCksIHRoZSB0cmFuc2FjdGlvbiB3aWxsIGFib3J0LlxuICB0cmFuc2FjdGlvbi5vbmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgIHNlbGYub25BYm9ydChzZWxmLl90cmFuc2FjdGlvbi5lcnJvciB8fCBuZXcgRXJyb3IoJ2Fib3J0ZWQgYnkgdXNlcicpKVxuICB9XG5cbiAgdHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLm9uQ29tcGxldGUoKVxuICB9XG59XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5vbkl0ZW0gPSBmdW5jdGlvbiAoY3Vyc29yKSB7XG4gIHRoaXMuX2NhY2hlLnB1c2goY3Vyc29yLmtleSwgY3Vyc29yLnZhbHVlKVxuXG4gIGlmICh0aGlzLl9saW1pdCA8PSAwIHx8ICsrdGhpcy5fY291bnQgPCB0aGlzLl9saW1pdCkge1xuICAgIGN1cnNvci5jb250aW51ZSgpXG4gIH1cblxuICB0aGlzLm1heWJlTmV4dCgpXG59XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5vbkFib3J0ID0gZnVuY3Rpb24gKGVycikge1xuICB0aGlzLl9hYm9ydGVkID0gdHJ1ZVxuICB0aGlzLl9lcnJvciA9IGVyclxuICB0aGlzLm1heWJlTmV4dCgpXG59XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5vbkNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLl9jb21wbGV0ZWQgPSB0cnVlXG4gIHRoaXMubWF5YmVOZXh0KClcbn1cblxuSXRlcmF0b3IucHJvdG90eXBlLm1heWJlTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuX2NhbGxiYWNrKSB7XG4gICAgdGhpcy5fbmV4dCh0aGlzLl9jYWxsYmFjaylcbiAgICB0aGlzLl9jYWxsYmFjayA9IG51bGxcbiAgfVxufVxuXG5JdGVyYXRvci5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuX2Fib3J0ZWQpIHtcbiAgICAvLyBUaGUgZXJyb3Igc2hvdWxkIGJlIHBpY2tlZCB1cCBieSBlaXRoZXIgbmV4dCgpIG9yIGVuZCgpLlxuICAgIHZhciBlcnIgPSB0aGlzLl9lcnJvclxuICAgIHRoaXMuX2Vycm9yID0gbnVsbFxuICAgIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG4gIH0gZWxzZSBpZiAodGhpcy5fY2FjaGUubGVuZ3RoID4gMCkge1xuICAgIHZhciBrZXkgPSB0aGlzLl9jYWNoZS5zaGlmdCgpXG4gICAgdmFyIHZhbHVlID0gdGhpcy5fY2FjaGUuc2hpZnQoKVxuXG4gICAgaWYgKHRoaXMuX2tleXMgJiYga2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGtleSA9IHRoaXMuX2Rlc2VyaWFsaXplS2V5KGtleSwgdGhpcy5fa2V5QXNCdWZmZXIpXG4gICAgfSBlbHNlIHtcbiAgICAgIGtleSA9IHVuZGVmaW5lZFxuICAgIH1cblxuICAgIGlmICh0aGlzLl92YWx1ZXMgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsdWUgPSB0aGlzLl9kZXNlcmlhbGl6ZVZhbHVlKHZhbHVlLCB0aGlzLl92YWx1ZUFzQnVmZmVyKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IHVuZGVmaW5lZFxuICAgIH1cblxuICAgIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrLCBudWxsLCBrZXksIHZhbHVlKVxuICB9IGVsc2UgaWYgKHRoaXMuX2NvbXBsZXRlZCkge1xuICAgIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrKVxuICB9IGVsc2Uge1xuICAgIHRoaXMuX2NhbGxiYWNrID0gY2FsbGJhY2tcbiAgfVxufVxuXG4vLyBFeHBvc2VkIGZvciB0aGUgdjQgdG8gdjUgdXBncmFkZSB1dGlsaXR5XG5JdGVyYXRvci5wcm90b3R5cGUuX2Rlc2VyaWFsaXplS2V5ID0gZGVzZXJpYWxpemVcbkl0ZXJhdG9yLnByb3RvdHlwZS5fZGVzZXJpYWxpemVWYWx1ZSA9IGRlc2VyaWFsaXplXG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5fZW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIGlmICh0aGlzLl9hYm9ydGVkIHx8IHRoaXMuX2NvbXBsZXRlZCkge1xuICAgIHJldHVybiB0aGlzLl9uZXh0VGljayhjYWxsYmFjaywgdGhpcy5fZXJyb3IpXG4gIH1cblxuICAvLyBEb24ndCBhZHZhbmNlIHRoZSBjdXJzb3IgYW55bW9yZSwgYW5kIHRoZSB0cmFuc2FjdGlvbiB3aWxsIGNvbXBsZXRlXG4gIC8vIG9uIGl0cyBvd24gaW4gdGhlIG5leHQgdGljay4gVGhpcyBhcHByb2FjaCBpcyBtdWNoIGNsZWFuZXIgdGhhbiBjYWxsaW5nXG4gIC8vIHRyYW5zYWN0aW9uLmFib3J0KCkgd2l0aCBpdHMgdW5wcmVkaWN0YWJsZSBldmVudCBvcmRlci5cbiAgdGhpcy5vbkl0ZW0gPSBub29wXG4gIHRoaXMub25BYm9ydCA9IGNhbGxiYWNrXG4gIHRoaXMub25Db21wbGV0ZSA9IGNhbGxiYWNrXG59XG4iLCIndXNlIHN0cmljdCdcblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlclxuLy8gUmV0dXJucyBlaXRoZXIgYSBVaW50OEFycmF5IG9yIEJ1ZmZlciAoZG9lc24ndCBtYXR0ZXIgdG9cbi8vIEluZGV4ZWREQiwgYmVjYXVzZSBCdWZmZXIgaXMgYSBzdWJjbGFzcyBvZiBVaW50OEFycmF5KVxudmFyIHN0cjJiaW4gPSAoZnVuY3Rpb24gKCkge1xuICBpZiAoZ2xvYmFsLlRleHRFbmNvZGVyKSB7XG4gICAgdmFyIGVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoJ3V0Zi04JylcbiAgICByZXR1cm4gZW5jb2Rlci5lbmNvZGUuYmluZChlbmNvZGVyKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBCdWZmZXIuZnJvbVxuICB9XG59KSgpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRhdGEsIGFzQnVmZmVyKSB7XG4gIGlmIChhc0J1ZmZlcikge1xuICAgIHJldHVybiBCdWZmZXIuaXNCdWZmZXIoZGF0YSkgPyBkYXRhIDogc3RyMmJpbihTdHJpbmcoZGF0YSkpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFN0cmluZyhkYXRhKVxuICB9XG59XG4iLCIndXNlIHN0cmljdCdcblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlclxuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbiB0ZXN0IChpbXBsKSB7XG4gICAgdHJ5IHtcbiAgICAgIGltcGwuY21wKGtleSwgMClcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cbn1cblxuLy8gRGV0ZWN0IGJpbmFyeSBrZXkgc3VwcG9ydCAoSW5kZXhlZERCIFNlY29uZCBFZGl0aW9uKVxuZXhwb3J0cy5idWZmZXJLZXlzID0gZXhwb3J0cy50ZXN0KEJ1ZmZlci5hbGxvYygwKSlcbiIsIid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNsZWFyIChkYiwgbG9jYXRpb24sIGtleVJhbmdlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAob3B0aW9ucy5saW1pdCA9PT0gMCkgcmV0dXJuIGRiLl9uZXh0VGljayhjYWxsYmFjaylcblxuICB2YXIgdHJhbnNhY3Rpb24gPSBkYi5kYi50cmFuc2FjdGlvbihbbG9jYXRpb25dLCAncmVhZHdyaXRlJylcbiAgdmFyIHN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUobG9jYXRpb24pXG4gIHZhciBjb3VudCA9IDBcblxuICB0cmFuc2FjdGlvbi5vbmNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgIGNhbGxiYWNrKClcbiAgfVxuXG4gIHRyYW5zYWN0aW9uLm9uYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2sodHJhbnNhY3Rpb24uZXJyb3IgfHwgbmV3IEVycm9yKCdhYm9ydGVkIGJ5IHVzZXInKSlcbiAgfVxuXG4gIC8vIEEga2V5IGN1cnNvciBpcyBmYXN0ZXIgKHNraXBzIHJlYWRpbmcgdmFsdWVzKSBidXQgbm90IHN1cHBvcnRlZCBieSBJRVxuICB2YXIgbWV0aG9kID0gc3RvcmUub3BlbktleUN1cnNvciA/ICdvcGVuS2V5Q3Vyc29yJyA6ICdvcGVuQ3Vyc29yJ1xuICB2YXIgZGlyZWN0aW9uID0gb3B0aW9ucy5yZXZlcnNlID8gJ3ByZXYnIDogJ25leHQnXG5cbiAgc3RvcmVbbWV0aG9kXShrZXlSYW5nZSwgZGlyZWN0aW9uKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZXYpIHtcbiAgICB2YXIgY3Vyc29yID0gZXYudGFyZ2V0LnJlc3VsdFxuXG4gICAgaWYgKGN1cnNvcikge1xuICAgICAgLy8gV2FpdCBmb3IgYSByZXF1ZXN0IHRvIGNvbXBsZXRlIGJlZm9yZSBjb250aW51aW5nLCBzYXZpbmcgQ1BVLlxuICAgICAgc3RvcmUuZGVsZXRlKGN1cnNvci5rZXkpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMubGltaXQgPD0gMCB8fCArK2NvdW50IDwgb3B0aW9ucy5saW1pdCkge1xuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsIi8qIGdsb2JhbCBpbmRleGVkREIgKi9cblxuJ3VzZSBzdHJpY3QnXG5cbm1vZHVsZS5leHBvcnRzID0gTGV2ZWxcblxudmFyIEFic3RyYWN0TGV2ZWxET1dOID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RMZXZlbERPV05cbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJylcbnZhciBJdGVyYXRvciA9IHJlcXVpcmUoJy4vaXRlcmF0b3InKVxudmFyIHNlcmlhbGl6ZSA9IHJlcXVpcmUoJy4vdXRpbC9zZXJpYWxpemUnKVxudmFyIGRlc2VyaWFsaXplID0gcmVxdWlyZSgnLi91dGlsL2Rlc2VyaWFsaXplJylcbnZhciBzdXBwb3J0ID0gcmVxdWlyZSgnLi91dGlsL3N1cHBvcnQnKVxudmFyIGNsZWFyID0gcmVxdWlyZSgnLi91dGlsL2NsZWFyJylcbnZhciBjcmVhdGVLZXlSYW5nZSA9IHJlcXVpcmUoJy4vdXRpbC9rZXktcmFuZ2UnKVxuXG52YXIgREVGQVVMVF9QUkVGSVggPSAnbGV2ZWwtanMtJ1xuXG5mdW5jdGlvbiBMZXZlbCAobG9jYXRpb24sIG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIExldmVsKSkgcmV0dXJuIG5ldyBMZXZlbChsb2NhdGlvbiwgb3B0cylcblxuICBBYnN0cmFjdExldmVsRE9XTi5jYWxsKHRoaXMsIHtcbiAgICBidWZmZXJLZXlzOiBzdXBwb3J0LmJ1ZmZlcktleXMoaW5kZXhlZERCKSxcbiAgICBzbmFwc2hvdHM6IHRydWUsXG4gICAgcGVybWFuZW5jZTogdHJ1ZSxcbiAgICBjbGVhcjogdHJ1ZVxuICB9KVxuXG4gIG9wdHMgPSBvcHRzIHx8IHt9XG5cbiAgaWYgKHR5cGVvZiBsb2NhdGlvbiAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbnN0cnVjdG9yIHJlcXVpcmVzIGEgbG9jYXRpb24gc3RyaW5nIGFyZ3VtZW50JylcbiAgfVxuXG4gIHRoaXMubG9jYXRpb24gPSBsb2NhdGlvblxuICB0aGlzLnByZWZpeCA9IG9wdHMucHJlZml4ID09IG51bGwgPyBERUZBVUxUX1BSRUZJWCA6IG9wdHMucHJlZml4XG4gIHRoaXMudmVyc2lvbiA9IHBhcnNlSW50KG9wdHMudmVyc2lvbiB8fCAxLCAxMClcbn1cblxuaW5oZXJpdHMoTGV2ZWwsIEFic3RyYWN0TGV2ZWxET1dOKVxuXG5MZXZlbC5wcm90b3R5cGUudHlwZSA9ICdsZXZlbC1qcydcblxuTGV2ZWwucHJvdG90eXBlLl9vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciByZXEgPSBpbmRleGVkREIub3Blbih0aGlzLnByZWZpeCArIHRoaXMubG9jYXRpb24sIHRoaXMudmVyc2lvbilcbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2socmVxLmVycm9yIHx8IG5ldyBFcnJvcigndW5rbm93biBlcnJvcicpKVxuICB9XG5cbiAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLmRiID0gcmVxLnJlc3VsdFxuICAgIGNhbGxiYWNrKClcbiAgfVxuXG4gIHJlcS5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbiAoZXYpIHtcbiAgICB2YXIgZGIgPSBldi50YXJnZXQucmVzdWx0XG5cbiAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoc2VsZi5sb2NhdGlvbikpIHtcbiAgICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKHNlbGYubG9jYXRpb24pXG4gICAgfVxuICB9XG59XG5cbkxldmVsLnByb3RvdHlwZS5zdG9yZSA9IGZ1bmN0aW9uIChtb2RlKSB7XG4gIHZhciB0cmFuc2FjdGlvbiA9IHRoaXMuZGIudHJhbnNhY3Rpb24oW3RoaXMubG9jYXRpb25dLCBtb2RlKVxuICByZXR1cm4gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUodGhpcy5sb2NhdGlvbilcbn1cblxuTGV2ZWwucHJvdG90eXBlLmF3YWl0ID0gZnVuY3Rpb24gKHJlcXVlc3QsIGNhbGxiYWNrKSB7XG4gIHZhciB0cmFuc2FjdGlvbiA9IHJlcXVlc3QudHJhbnNhY3Rpb25cblxuICAvLyBUYWtlIGFkdmFudGFnZSBvZiB0aGUgZmFjdCB0aGF0IGEgbm9uLWNhbmNlbGVkIHJlcXVlc3QgZXJyb3IgYWJvcnRzXG4gIC8vIHRoZSB0cmFuc2FjdGlvbi4gSS5lLiBubyBuZWVkIHRvIGxpc3RlbiBmb3IgXCJyZXF1ZXN0Lm9uZXJyb3JcIi5cbiAgdHJhbnNhY3Rpb24ub25hYm9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayh0cmFuc2FjdGlvbi5lcnJvciB8fCBuZXcgRXJyb3IoJ2Fib3J0ZWQgYnkgdXNlcicpKVxuICB9XG5cbiAgdHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayhudWxsLCByZXF1ZXN0LnJlc3VsdClcbiAgfVxufVxuXG5MZXZlbC5wcm90b3R5cGUuX2dldCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzdG9yZSA9IHRoaXMuc3RvcmUoJ3JlYWRvbmx5JylcblxuICB0cnkge1xuICAgIHZhciByZXEgPSBzdG9yZS5nZXQoa2V5KVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gdGhpcy5fbmV4dFRpY2soY2FsbGJhY2ssIGVycilcbiAgfVxuXG4gIHRoaXMuYXdhaXQocmVxLCBmdW5jdGlvbiAoZXJyLCB2YWx1ZSkge1xuICAgIGlmIChlcnIpIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gJ05vdEZvdW5kJyBlcnJvciwgY29uc2lzdGVudCB3aXRoIExldmVsRE9XTiBBUElcbiAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ05vdEZvdW5kJykpXG4gICAgfVxuXG4gICAgY2FsbGJhY2sobnVsbCwgZGVzZXJpYWxpemUodmFsdWUsIG9wdGlvbnMuYXNCdWZmZXIpKVxuICB9KVxufVxuXG5MZXZlbC5wcm90b3R5cGUuX2RlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzdG9yZSA9IHRoaXMuc3RvcmUoJ3JlYWR3cml0ZScpXG5cbiAgdHJ5IHtcbiAgICB2YXIgcmVxID0gc3RvcmUuZGVsZXRlKGtleSlcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG4gIH1cblxuICB0aGlzLmF3YWl0KHJlcSwgY2FsbGJhY2spXG59XG5cbkxldmVsLnByb3RvdHlwZS5fcHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzdG9yZSA9IHRoaXMuc3RvcmUoJ3JlYWR3cml0ZScpXG5cbiAgdHJ5IHtcbiAgICAvLyBXaWxsIHRocm93IGEgRGF0YUVycm9yIG9yIERhdGFDbG9uZUVycm9yIGlmIHRoZSBlbnZpcm9ubWVudFxuICAgIC8vIGRvZXMgbm90IHN1cHBvcnQgc2VyaWFsaXppbmcgdGhlIGtleSBvciB2YWx1ZSByZXNwZWN0aXZlbHkuXG4gICAgdmFyIHJlcSA9IHN0b3JlLnB1dCh2YWx1ZSwga2V5KVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gdGhpcy5fbmV4dFRpY2soY2FsbGJhY2ssIGVycilcbiAgfVxuXG4gIHRoaXMuYXdhaXQocmVxLCBjYWxsYmFjaylcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9zZXJpYWxpemVLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHJldHVybiBzZXJpYWxpemUoa2V5LCB0aGlzLnN1cHBvcnRzLmJ1ZmZlcktleXMpXG59XG5cbkxldmVsLnByb3RvdHlwZS5fc2VyaWFsaXplVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZSh2YWx1ZSwgdHJ1ZSlcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9pdGVyYXRvciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgSXRlcmF0b3IodGhpcywgdGhpcy5sb2NhdGlvbiwgb3B0aW9ucylcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9iYXRjaCA9IGZ1bmN0aW9uIChvcGVyYXRpb25zLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAob3BlcmF0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzLl9uZXh0VGljayhjYWxsYmFjaylcblxuICB2YXIgc3RvcmUgPSB0aGlzLnN0b3JlKCdyZWFkd3JpdGUnKVxuICB2YXIgdHJhbnNhY3Rpb24gPSBzdG9yZS50cmFuc2FjdGlvblxuICB2YXIgaW5kZXggPSAwXG4gIHZhciBlcnJvclxuXG4gIHRyYW5zYWN0aW9uLm9uYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soZXJyb3IgfHwgdHJhbnNhY3Rpb24uZXJyb3IgfHwgbmV3IEVycm9yKCdhYm9ydGVkIGJ5IHVzZXInKSlcbiAgfVxuXG4gIHRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soKVxuICB9XG5cbiAgLy8gV2FpdCBmb3IgYSByZXF1ZXN0IHRvIGNvbXBsZXRlIGJlZm9yZSBtYWtpbmcgdGhlIG5leHQsIHNhdmluZyBDUFUuXG4gIGZ1bmN0aW9uIGxvb3AgKCkge1xuICAgIHZhciBvcCA9IG9wZXJhdGlvbnNbaW5kZXgrK11cbiAgICB2YXIga2V5ID0gb3Aua2V5XG5cbiAgICB0cnkge1xuICAgICAgdmFyIHJlcSA9IG9wLnR5cGUgPT09ICdkZWwnID8gc3RvcmUuZGVsZXRlKGtleSkgOiBzdG9yZS5wdXQob3AudmFsdWUsIGtleSlcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGVycm9yID0gZXJyXG4gICAgICB0cmFuc2FjdGlvbi5hYm9ydCgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoaW5kZXggPCBvcGVyYXRpb25zLmxlbmd0aCkge1xuICAgICAgcmVxLm9uc3VjY2VzcyA9IGxvb3BcbiAgICB9XG4gIH1cblxuICBsb29wKClcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9jbGVhciA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuICB0cnkge1xuICAgIHZhciBrZXlSYW5nZSA9IGNyZWF0ZUtleVJhbmdlKG9wdGlvbnMpXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBUaGUgbG93ZXIga2V5IGlzIGdyZWF0ZXIgdGhhbiB0aGUgdXBwZXIga2V5LlxuICAgIC8vIEluZGV4ZWREQiB0aHJvd3MgYW4gZXJyb3IsIGJ1dCB3ZSdsbCBqdXN0IGRvIG5vdGhpbmcuXG4gICAgcmV0dXJuIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrKVxuICB9XG5cbiAgaWYgKG9wdGlvbnMubGltaXQgPj0gMCkge1xuICAgIC8vIElEQk9iamVjdFN0b3JlI2RlbGV0ZShyYW5nZSkgZG9lc24ndCBoYXZlIHN1Y2ggYW4gb3B0aW9uLlxuICAgIC8vIEZhbGwgYmFjayB0byBjdXJzb3ItYmFzZWQgaW1wbGVtZW50YXRpb24uXG4gICAgcmV0dXJuIGNsZWFyKHRoaXMsIHRoaXMubG9jYXRpb24sIGtleVJhbmdlLCBvcHRpb25zLCBjYWxsYmFjaylcbiAgfVxuXG4gIHRyeSB7XG4gICAgdmFyIHN0b3JlID0gdGhpcy5zdG9yZSgncmVhZHdyaXRlJylcbiAgICB2YXIgcmVxID0ga2V5UmFuZ2UgPyBzdG9yZS5kZWxldGUoa2V5UmFuZ2UpIDogc3RvcmUuY2xlYXIoKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gdGhpcy5fbmV4dFRpY2soY2FsbGJhY2ssIGVycilcbiAgfVxuXG4gIHRoaXMuYXdhaXQocmVxLCBjYWxsYmFjaylcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9jbG9zZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB0aGlzLmRiLmNsb3NlKClcbiAgdGhpcy5fbmV4dFRpY2soY2FsbGJhY2spXG59XG5cbi8vIE5PVEU6IHJlbW92ZSBpbiBhIG5leHQgbWFqb3IgcmVsZWFzZVxuTGV2ZWwucHJvdG90eXBlLnVwZ3JhZGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuc3RhdHVzICE9PSAnb3BlbicpIHtcbiAgICByZXR1cm4gdGhpcy5fbmV4dFRpY2soY2FsbGJhY2ssIG5ldyBFcnJvcignY2Fubm90IHVwZ3JhZGUoKSBiZWZvcmUgb3BlbigpJykpXG4gIH1cblxuICB2YXIgaXQgPSB0aGlzLml0ZXJhdG9yKClcbiAgdmFyIGJhdGNoT3B0aW9ucyA9IHt9XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGl0Ll9kZXNlcmlhbGl6ZUtleSA9IGl0Ll9kZXNlcmlhbGl6ZVZhbHVlID0gaWRlbnRpdHlcbiAgbmV4dCgpXG5cbiAgZnVuY3Rpb24gbmV4dCAoZXJyKSB7XG4gICAgaWYgKGVycikgcmV0dXJuIGZpbmlzaChlcnIpXG4gICAgaXQubmV4dChlYWNoKVxuICB9XG5cbiAgZnVuY3Rpb24gZWFjaCAoZXJyLCBrZXksIHZhbHVlKSB7XG4gICAgaWYgKGVyciB8fCBrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGZpbmlzaChlcnIpXG4gICAgfVxuXG4gICAgdmFyIG5ld0tleSA9IHNlbGYuX3NlcmlhbGl6ZUtleShkZXNlcmlhbGl6ZShrZXksIHRydWUpKVxuICAgIHZhciBuZXdWYWx1ZSA9IHNlbGYuX3NlcmlhbGl6ZVZhbHVlKGRlc2VyaWFsaXplKHZhbHVlLCB0cnVlKSlcblxuICAgIC8vIFRvIGJ5cGFzcyBzZXJpYWxpemF0aW9uIG9uIHRoZSBvbGQga2V5LCB1c2UgX2JhdGNoKCkgaW5zdGVhZCBvZiBiYXRjaCgpLlxuICAgIC8vIE5PVEU6IGlmIHdlIGRpc2FibGUgc25hcHNob3R0aW5nICgjODYpIHRoaXMgY291bGQgbGVhZCB0byBhIGxvb3Agb2ZcbiAgICAvLyBpbnNlcnRpbmcgYW5kIHRoZW4gaXRlcmF0aW5nIHRob3NlIHNhbWUgZW50cmllcywgYmVjYXVzZSB0aGUgbmV3IGtleXNcbiAgICAvLyBwb3NzaWJseSBzb3J0IGFmdGVyIHRoZSBvbGQga2V5cy5cbiAgICBzZWxmLl9iYXRjaChbXG4gICAgICB7IHR5cGU6ICdkZWwnLCBrZXk6IGtleSB9LFxuICAgICAgeyB0eXBlOiAncHV0Jywga2V5OiBuZXdLZXksIHZhbHVlOiBuZXdWYWx1ZSB9XG4gICAgXSwgYmF0Y2hPcHRpb25zLCBuZXh0KVxuICB9XG5cbiAgZnVuY3Rpb24gZmluaXNoIChlcnIpIHtcbiAgICBpdC5lbmQoZnVuY3Rpb24gKGVycjIpIHtcbiAgICAgIGNhbGxiYWNrKGVyciB8fCBlcnIyKVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBpZGVudGl0eSAoZGF0YSkge1xuICAgIHJldHVybiBkYXRhXG4gIH1cbn1cblxuTGV2ZWwuZGVzdHJveSA9IGZ1bmN0aW9uIChsb2NhdGlvbiwgcHJlZml4LCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIHByZWZpeCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gcHJlZml4XG4gICAgcHJlZml4ID0gREVGQVVMVF9QUkVGSVhcbiAgfVxuICB2YXIgcmVxdWVzdCA9IGluZGV4ZWREQi5kZWxldGVEYXRhYmFzZShwcmVmaXggKyBsb2NhdGlvbilcbiAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soKVxuICB9XG4gIHJlcXVlc3Qub25lcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICBjYWxsYmFjayhlcnIpXG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnbGV2ZWwtcGFja2FnZXInKShyZXF1aXJlKCdsZXZlbC1qcycpKVxuIiwidmFyIHRvID0gcmVxdWlyZShcIi4vaW5kZXguanNcIilcblxuZnVuY3Rpb24gdG9BcnJheShhcnJheSwgZW5kKSB7XG4gICAgaWYgKHR5cGVvZiBhcnJheSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGVuZCA9IGFycmF5XG4gICAgICAgIGFycmF5ID0gW11cbiAgICB9XG5cbiAgICByZXR1cm4gdG8od3JpdGVBcnJheSwgZW5kQXJyYXkpXG5cbiAgICBmdW5jdGlvbiB3cml0ZUFycmF5KGNodW5rKSB7XG4gICAgICAgIGFycmF5LnB1c2goY2h1bmspXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5kQXJyYXkoKSB7XG4gICAgICAgIGVuZChhcnJheSlcbiAgICAgICAgdGhpcy5lbWl0KFwiZW5kXCIpXG4gICAgfVxufVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSB0b0FycmF5IiwidmFyIFN0cmVhbSA9IHJlcXVpcmUoXCJub2RlOnN0cmVhbVwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFdyaXRlU3RyZWFtXG5cbldyaXRlU3RyZWFtLnRvQXJyYXkgPSByZXF1aXJlKFwiLi9hcnJheS5qc1wiKVxuXG5mdW5jdGlvbiBXcml0ZVN0cmVhbSh3cml0ZSwgZW5kKSB7XG4gICAgdmFyIHN0cmVhbSA9IG5ldyBTdHJlYW0oKVxuICAgICAgICAsIGVuZGVkID0gZmFsc2VcblxuICAgIGVuZCA9IGVuZCB8fCBkZWZhdWx0RW5kXG5cbiAgICBzdHJlYW0ud3JpdGUgPSBoYW5kbGVXcml0ZVxuICAgIHN0cmVhbS5lbmQgPSBoYW5kbGVFbmRcblxuICAgIC8vIFN1cHBvcnQgMC44IHBpcGUgW0xFR0FDWV1cbiAgICBzdHJlYW0ud3JpdGFibGUgPSB0cnVlXG5cbiAgICByZXR1cm4gc3RyZWFtXG5cbiAgICBmdW5jdGlvbiBoYW5kbGVXcml0ZShjaHVuaykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gd3JpdGUuY2FsbChzdHJlYW0sIGNodW5rKVxuICAgICAgICByZXR1cm4gcmVzdWx0ID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZUVuZChjaHVuaykge1xuICAgICAgICBpZiAoZW5kZWQpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgZW5kZWQgPSB0cnVlXG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBzdHJlYW0ud3JpdGUoY2h1bmspXG4gICAgICAgIH1cbiAgICAgICAgZW5kLmNhbGwoc3RyZWFtKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZGVmYXVsdEVuZCgpIHtcbiAgICB0aGlzLmVtaXQoXCJmaW5pc2hcIilcbn1cbiIsInZhciBXcml0ZVN0cmVhbSA9IHJlcXVpcmUoXCJ3cml0ZS1zdHJlYW1cIilcblxubW9kdWxlLmV4cG9ydHMgPSBFbmRTdHJlYW1cblxuZnVuY3Rpb24gRW5kU3RyZWFtKHdyaXRlLCBlbmQpIHtcbiAgICB2YXIgY291bnRlciA9IDBcbiAgICAgICAgLCBlbmRlZCA9IGZhbHNlXG5cbiAgICBlbmQgPSBlbmQgfHwgbm9vcFxuXG4gICAgdmFyIHN0cmVhbSA9IFdyaXRlU3RyZWFtKGZ1bmN0aW9uIChjaHVuaykge1xuICAgICAgICBjb3VudGVyKytcbiAgICAgICAgd3JpdGUoY2h1bmssIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RyZWFtLmVtaXQoXCJlcnJvclwiLCBlcnIpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvdW50ZXItLVxuXG4gICAgICAgICAgICBpZiAoY291bnRlciA9PT0gMCAmJiBlbmRlZCkge1xuICAgICAgICAgICAgICAgIHN0cmVhbS5lbWl0KFwiZmluaXNoXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICBlbmRlZCA9IHRydWVcbiAgICAgICAgaWYgKGNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdChcImZpbmlzaFwiKVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBzdHJlYW1cbn1cblxuZnVuY3Rpb24gbm9vcCgpIHt9XG4iLCJ2YXIgRW5kU3RyZWFtID0gcmVxdWlyZShcImVuZC1zdHJlYW1cIilcblxubW9kdWxlLmV4cG9ydHMgPSBMZXZlbFdyaXRlU3RyZWFtXG5cbmZ1bmN0aW9uIExldmVsV3JpdGVTdHJlYW0oZGIpIHtcbiAgICByZXR1cm4gd3JpdGVTdHJlYW1cblxuICAgIGZ1bmN0aW9uIHdyaXRlU3RyZWFtKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblxuICAgICAgICB2YXIgcXVldWUgPSBbXVxuICAgICAgICAgICAgLCBzdHJlYW0gPSBFbmRTdHJlYW0od3JpdGUpXG5cbiAgICAgICAgcmV0dXJuIHN0cmVhbVxuXG4gICAgICAgIGZ1bmN0aW9uIHdyaXRlKGNodW5rLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soZHJhaW4pXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHF1ZXVlLnB1c2goY2h1bmspXG4gICAgICAgICAgICBzdHJlYW0ub25jZShcIl9kcmFpblwiLCBjYWxsYmFjaylcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRyYWluKCkge1xuICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHZhciBjaHVuayA9IHF1ZXVlWzBdXG4gICAgICAgICAgICAgICAgZGIucHV0KGNodW5rLmtleSwgY2h1bmsudmFsdWUsIG9wdGlvbnMsIGVtaXQpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBhcnIgPSBxdWV1ZS5tYXAoZnVuY3Rpb24gKGNodW5rKSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rLnR5cGUgPSBcInB1dFwiXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjaHVua1xuICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICBkYi5iYXRjaChhcnIsIG9wdGlvbnMsIGVtaXQpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHF1ZXVlLmxlbmd0aCA9IDBcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGVtaXQoZXJyKSB7XG4gICAgICAgICAgICBzdHJlYW0uZW1pdChcIl9kcmFpblwiLCBlcnIpXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGlzTG9jYWxJZCwgd2lubmluZ1JldiB9IGZyb20gJ3BvdWNoZGItbWVyZ2UnO1xuaW1wb3J0IGxldmVsIGZyb20gJ2xldmVsJztcbmltcG9ydCB7IG9iaiBhcyB0aHJvdWdoIH0gZnJvbSAndGhyb3VnaDInO1xuaW1wb3J0IExldmVsV3JpdGVTdHJlYW0gZnJvbSAnbGV2ZWwtd3JpdGUtc3RyZWFtJztcblxudmFyIHN0b3JlcyA9IFtcbiAgJ2RvY3VtZW50LXN0b3JlJyxcbiAgJ2J5LXNlcXVlbmNlJyxcbiAgJ2F0dGFjaC1zdG9yZScsXG4gICdhdHRhY2gtYmluYXJ5LXN0b3JlJ1xuXTtcbmZ1bmN0aW9uIGZvcm1hdFNlcShuKSB7XG4gIHJldHVybiAoJzAwMDAwMDAwMDAwMDAwMDAnICsgbikuc2xpY2UoLTE2KTtcbn1cbnZhciBVUERBVEVfU0VRX0tFWSA9ICdfbG9jYWxfbGFzdF91cGRhdGVfc2VxJztcbnZhciBET0NfQ09VTlRfS0VZID0gJ19sb2NhbF9kb2NfY291bnQnO1xudmFyIFVVSURfS0VZID0gJ19sb2NhbF91dWlkJztcblxudmFyIGRvTWlncmF0aW9uT25lID0gZnVuY3Rpb24gKG5hbWUsIGRiLCBjYWxsYmFjaykge1xuICAvLyBsb2NhbCByZXF1aXJlIHRvIHByZXZlbnQgY3Jhc2hpbmcgaWYgbGV2ZWxkb3duIGlzbid0IGluc3RhbGxlZC5cbiAgdmFyIGxldmVsZG93biA9IHJlcXVpcmUoXCJsZXZlbGRvd25cIik7XG5cbiAgdmFyIGJhc2UgPSBwYXRoLnJlc29sdmUobmFtZSk7XG4gIGZ1bmN0aW9uIG1vdmUoc3RvcmUsIGluZGV4LCBjYikge1xuICAgIHZhciBzdG9yZVBhdGggPSBwYXRoLmpvaW4oYmFzZSwgc3RvcmUpO1xuICAgIHZhciBvcHRzO1xuICAgIGlmIChpbmRleCA9PT0gMykge1xuICAgICAgb3B0cyA9IHtcbiAgICAgICAgdmFsdWVFbmNvZGluZzogJ2JpbmFyeSdcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdHMgPSB7XG4gICAgICAgIHZhbHVlRW5jb2Rpbmc6ICdqc29uJ1xuICAgICAgfTtcbiAgICB9XG4gICAgdmFyIHN1YiA9IGRiLnN1YmxldmVsKHN0b3JlLCBvcHRzKTtcbiAgICB2YXIgb3JpZyA9IGxldmVsKHN0b3JlUGF0aCwgb3B0cyk7XG4gICAgdmFyIGZyb20gPSBvcmlnLmNyZWF0ZVJlYWRTdHJlYW0oKTtcbiAgICB2YXIgd3JpdGVTdHJlYW0gPSBuZXcgTGV2ZWxXcml0ZVN0cmVhbShzdWIpO1xuICAgIHZhciB0byA9IHdyaXRlU3RyZWFtKCk7XG4gICAgZnJvbS5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuICAgICAgb3JpZy5jbG9zZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIGNiKGVyciwgc3RvcmVQYXRoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGZyb20ucGlwZSh0byk7XG4gIH1cbiAgZnMudW5saW5rKGJhc2UgKyAnLnV1aWQnLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgaWYgKGVycikge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciB0b2RvID0gNDtcbiAgICB2YXIgZG9uZSA9IFtdO1xuICAgIHN0b3Jlcy5mb3JFYWNoKGZ1bmN0aW9uIChzdG9yZSwgaSkge1xuICAgICAgbW92ZShzdG9yZSwgaSwgZnVuY3Rpb24gKGVyciwgc3RvcmVQYXRoKSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgZG9uZS5wdXNoKHN0b3JlUGF0aCk7XG4gICAgICAgIGlmICghKC0tdG9kbykpIHtcbiAgICAgICAgICBkb25lLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgIGxldmVsZG93bi5kZXN0cm95KGl0ZW0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgaWYgKCsrdG9kbyA9PT0gZG9uZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBmcy5ybWRpcihiYXNlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59O1xudmFyIGRvTWlncmF0aW9uVHdvID0gZnVuY3Rpb24gKGRiLCBzdG9yZXMsIGNhbGxiYWNrKSB7XG4gIHZhciBiYXRjaGVzID0gW107XG4gIHN0b3Jlcy5ieVNlcVN0b3JlLmdldChVVUlEX0tFWSwgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICAvLyBubyB1dWlkIGtleSwgc28gZG9uJ3QgbmVlZCB0byBtaWdyYXRlO1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIGJhdGNoZXMucHVzaCh7XG4gICAgICBrZXk6IFVVSURfS0VZLFxuICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgcHJlZml4OiBzdG9yZXMubWV0YVN0b3JlLFxuICAgICAgdHlwZTogJ3B1dCcsXG4gICAgICB2YWx1ZUVuY29kaW5nOiAnanNvbidcbiAgICB9KTtcbiAgICBiYXRjaGVzLnB1c2goe1xuICAgICAga2V5OiBVVUlEX0tFWSxcbiAgICAgIHByZWZpeDogc3RvcmVzLmJ5U2VxU3RvcmUsXG4gICAgICB0eXBlOiAnZGVsJ1xuICAgIH0pO1xuICAgIHN0b3Jlcy5ieVNlcVN0b3JlLmdldChET0NfQ09VTlRfS0VZLCBmdW5jdGlvbiAoZXJyLCB2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIC8vIGlmIG5vIGRvYyBjb3VudCBrZXksXG4gICAgICAgIC8vIGp1c3Qgc2tpcFxuICAgICAgICAvLyB3ZSBjYW4gbGl2ZSB3aXRoIHRoaXNcbiAgICAgICAgYmF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICBrZXk6IERPQ19DT1VOVF9LRVksXG4gICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgIHByZWZpeDogc3RvcmVzLm1ldGFTdG9yZSxcbiAgICAgICAgICB0eXBlOiAncHV0JyxcbiAgICAgICAgICB2YWx1ZUVuY29kaW5nOiAnanNvbidcbiAgICAgICAgfSk7XG4gICAgICAgIGJhdGNoZXMucHVzaCh7XG4gICAgICAgICAga2V5OiBET0NfQ09VTlRfS0VZLFxuICAgICAgICAgIHByZWZpeDogc3RvcmVzLmJ5U2VxU3RvcmUsXG4gICAgICAgICAgdHlwZTogJ2RlbCdcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBzdG9yZXMuYnlTZXFTdG9yZS5nZXQoVVBEQVRFX1NFUV9LRVksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgIC8vIGlmIG5vIFVQREFURV9TRVFfS0VZXG4gICAgICAgICAgLy8ganVzdCBza2lwXG4gICAgICAgICAgLy8gd2UndmUgZ29uZSB0byBmYXIgdG8gc3RvcC5cbiAgICAgICAgICBiYXRjaGVzLnB1c2goe1xuICAgICAgICAgICAga2V5OiBVUERBVEVfU0VRX0tFWSxcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIHByZWZpeDogc3RvcmVzLm1ldGFTdG9yZSxcbiAgICAgICAgICAgIHR5cGU6ICdwdXQnLFxuICAgICAgICAgICAgdmFsdWVFbmNvZGluZzogJ2pzb24nXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYmF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICAgIGtleTogVVBEQVRFX1NFUV9LRVksXG4gICAgICAgICAgICBwcmVmaXg6IHN0b3Jlcy5ieVNlcVN0b3JlLFxuICAgICAgICAgICAgdHlwZTogJ2RlbCdcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVsZXRlZFNlcXMgPSB7fTtcbiAgICAgICAgc3RvcmVzLmRvY1N0b3JlLmNyZWF0ZVJlYWRTdHJlYW0oe1xuICAgICAgICAgIHN0YXJ0S2V5OiAnXycsXG4gICAgICAgICAgZW5kS2V5OiAnX1xceEZGJ1xuICAgICAgICB9KS5waXBlKHRocm91Z2goZnVuY3Rpb24gKGNoLCBfLCBuZXh0KSB7XG4gICAgICAgICAgaWYgKCFpc0xvY2FsSWQoY2gua2V5KSkge1xuICAgICAgICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYmF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICAgIGtleTogY2gua2V5LFxuICAgICAgICAgICAgcHJlZml4OiBzdG9yZXMuZG9jU3RvcmUsXG4gICAgICAgICAgICB0eXBlOiAnZGVsJ1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHZhciB3aW5uZXIgPSB3aW5uaW5nUmV2KGNoLnZhbHVlKTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhjaC52YWx1ZS5yZXZfbWFwKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIGlmIChrZXkgIT09ICd3aW5uZXInKSB7XG4gICAgICAgICAgICAgIHRoaXMucHVzaChmb3JtYXRTZXEoY2gudmFsdWUucmV2X21hcFtrZXldKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgdmFyIHdpbm5pbmdTZXEgPSBjaC52YWx1ZS5yZXZfbWFwW3dpbm5lcl07XG4gICAgICAgICAgc3RvcmVzLmJ5U2VxU3RvcmUuZ2V0KGZvcm1hdFNlcSh3aW5uaW5nU2VxKSwgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIGJhdGNoZXMucHVzaCh7XG4gICAgICAgICAgICAgICAga2V5OiBjaC5rZXksXG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgICAgIHByZWZpeDogc3RvcmVzLmxvY2FsU3RvcmUsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3B1dCcsXG4gICAgICAgICAgICAgICAgdmFsdWVFbmNvZGluZzogJ2pzb24nXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0pKS5waXBlKHRocm91Z2goZnVuY3Rpb24gKHNlcSwgXywgbmV4dCkge1xuICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICAgIGlmIChkZWxldGVkU2Vxc1tzZXFdKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWxldGVkU2Vxc1tzZXFdID0gdHJ1ZTtcbiAgICAgICAgICBzdG9yZXMuYnlTZXFTdG9yZS5nZXQoc2VxLCBmdW5jdGlvbiAoZXJyLCByZXNwKSB7XG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgICAgIGlmIChlcnIgfHwgIWlzTG9jYWxJZChyZXNwLl9pZCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJhdGNoZXMucHVzaCh7XG4gICAgICAgICAgICAgIGtleTogc2VxLFxuICAgICAgICAgICAgICBwcmVmaXg6IHN0b3Jlcy5ieVNlcVN0b3JlLFxuICAgICAgICAgICAgICB0eXBlOiAnZGVsJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBkYi5iYXRjaChiYXRjaGVzLCBjYWxsYmFjayk7XG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBkb01pZ3JhdGlvbk9uZTogZG9NaWdyYXRpb25PbmUsXG4gIGRvTWlncmF0aW9uVHdvOiBkb01pZ3JhdGlvblR3b1xufTtcbiIsImltcG9ydCBDb3JlTGV2ZWxQb3VjaCBmcm9tICdwb3VjaGRiLWFkYXB0ZXItbGV2ZWxkYi1jb3JlJztcblxuaW1wb3J0IHJlcXVpcmVMZXZlbGRvd24gZnJvbSAnLi9yZXF1aXJlTGV2ZWxkb3duJztcbmltcG9ydCBtaWdyYXRlIGZyb20gJy4vbWlncmF0ZSc7XG5cbmZ1bmN0aW9uIExldmVsRG93blBvdWNoKG9wdHMsIGNhbGxiYWNrKSB7XG5cbiAgLy8gVXNlcnMgY2FuIHBhc3MgaW4gdGhlaXIgb3duIGxldmVsZG93biBhbHRlcm5hdGl2ZSBoZXJlLCBpbiB3aGljaCBjYXNlXG4gIC8vIGl0IG92ZXJyaWRlcyB0aGUgZGVmYXVsdCBvbmUuIChUaGlzIGlzIGluIGFkZGl0aW9uIHRvIHRoZSBjdXN0b20gYnVpbGRzLilcbiAgdmFyIGxldmVsZG93biA9IG9wdHMuZGI7XG5cbiAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgaWYgKCFsZXZlbGRvd24pIHtcbiAgICBsZXZlbGRvd24gPSByZXF1aXJlTGV2ZWxkb3duKCk7XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAobGV2ZWxkb3duIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayhsZXZlbGRvd24pO1xuICAgIH1cbiAgfVxuXG4gIHZhciBfb3B0cyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGRiOiBsZXZlbGRvd24sXG4gICAgbWlncmF0ZTogbWlncmF0ZVxuICB9LCBvcHRzKTtcblxuICBDb3JlTGV2ZWxQb3VjaC5jYWxsKHRoaXMsIF9vcHRzLCBjYWxsYmFjayk7XG59XG5cbi8vIG92ZXJyaWRlcyBmb3Igbm9ybWFsIExldmVsREIgYmVoYXZpb3Igb24gTm9kZVxuTGV2ZWxEb3duUG91Y2gudmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0cnVlO1xufTtcbkxldmVsRG93blBvdWNoLnVzZV9wcmVmaXggPSBmYWxzZTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKFBvdWNoREIpIHtcbiAgUG91Y2hEQi5hZGFwdGVyKCdsZXZlbGRiJywgTGV2ZWxEb3duUG91Y2gsIHRydWUpO1xufSJdLCJuYW1lcyI6WyJuZXh0VGlja0Jyb3dzZXIiLCJyZXF1aXJlJCQwIiwibmV4dFRpY2siLCJBYnN0cmFjdEl0ZXJhdG9yIiwiYWJzdHJhY3RJdGVyYXRvciIsIkFic3RyYWN0Q2hhaW5lZEJhdGNoIiwiYWJzdHJhY3RDaGFpbmVkQmF0Y2giLCJ4dGVuZCIsInN1cHBvcnRzIiwicmVxdWlyZSQkMSIsIkJ1ZmZlciIsInJlcXVpcmUkJDIiLCJyZXF1aXJlJCQzIiwicmVxdWlyZSQkNCIsInJlcXVpcmUkJDUiLCJoYXNPd25Qcm9wZXJ0eSIsInJhbmdlT3B0aW9ucyIsIkFic3RyYWN0TGV2ZWxET1dOIiwiY2xlYW5SYW5nZU9wdGlvbnMiLCJpc1JhbmdlT3B0aW9uIiwiYWJzdHJhY3RMZXZlbGRvd24iLCJpbmhlcml0cyIsIkl0ZXJhdG9yIiwiZ2xvYmFsIiwiZGVzZXJpYWxpemUiLCJjcmVhdGVLZXlSYW5nZSIsInNlcmlhbGl6ZSIsImNsZWFyIiwicmVxdWlyZSQkNiIsInJlcXVpcmUkJDciLCJFbmRTdHJlYW0iLCJMZXZlbFdyaXRlU3RyZWFtIiwidGhyb3VnaCIsIkNvcmVMZXZlbFBvdWNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBLElBQUksZ0JBQWdCLEdBQUcsWUFBWTtBQUNuQyxFQUFFLElBQUk7QUFDTixJQUFJLE9BQU8sT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ2hDLEdBQUcsQ0FBQyxPQUFPLEdBQUcsRUFBRTtBQUNoQjtBQUNBLElBQUksR0FBRyxHQUFHLEdBQUcsSUFBSSx3QkFBd0IsQ0FBQztBQUMxQyxJQUFJLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxrQkFBa0IsRUFBRTtBQUN6QztBQUNBLE1BQU0sT0FBTyxJ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QUNBLEVBQUUsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztBQUMxQjtBQUNBO0FBQ0EsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ2xCLElBQUksU0FBUyxHQUFHLGdCQUFnQixFQUFFLENBQUM7QUFDbkM7QUFDQTtBQUNBLElBQUksSUFBSSxTQUFTLFlBQVksS0FBSyxFQUFFO0FBQ3BDLE1BQU0sT0FBTyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDakMsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUM1QixJQUFJLEVBQUUsRUFBRSxTQUFTO0FBQ2pCLElBQUksT0FBTyxFQUFFLE9BQU87QUFDcEIsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ1g7QUFDQSxFQUFFQyxZQUFjLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUNEO0FBQ0E7QUFDQSxjQUFjLENBQUMsS0FBSyxHQUFHLFlBQVk7QUFDbkMsRUFBRSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMsQ0FBQztBQUNGLGNBQWMsQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO0FBQ2xDO0FBQ2UsbUJBQVEsRUFBRSxPQUFPLEVBQUU7QUFDbEMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkQ7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzEsMiwzLDQsNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5LDIwLDIxLDIyLDIzLDI0XX0=
