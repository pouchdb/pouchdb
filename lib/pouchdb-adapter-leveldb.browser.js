import { i as immutable, l as levelSupports, e as errors, a as levelup$1, o as obj, L as LevelPouch$1 } from './index-4472578e.js';
import fs from 'node:fs';
import path from 'node:path';
import { w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { l as lib } from './functionName-4d6db487.js';
import 'node:events';
import './pouchdb-errors.browser.js';
import './spark-md5-2c57e5fc.js';
import { a as isLocalId } from './isLocalId-d067de54.js';
import { c as commonjsGlobal, g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import { b as buffer, i as inherits_browserExports, a as levelCodec, l as ltgt$1 } from './index-340bf460.js';
import require$$0 from 'node:stream';
import './__node-resolve_empty-b1d43ca8.js';
import './pouchdb-core.browser.js';
import './bulkGetShim-75479c95.js';
import './toPromise-06b5d6a8.js';
import './clone-f35bcc51.js';
import './guardedConsole-f54e5a40.js';
import './rev-d51344b8.js';
import './stringMd5-browser-5aecd2bd.js';
import './isRemote-f9121da9.js';
import './upsert-331b6913.js';
import './collectConflicts-6afe46fc.js';
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
import './parseDoc-e17a8c17.js';
import './latest-0521537f.js';
import './binaryStringToBlobOrBuffer-browser-2c8e268c.js';
import './binaryMd5-browser-ff2f482d.js';
import './readAsArrayBuffer-625b2d33.js';
import './processDocs-e4ed6d00.js';
import './merge-7299d068.js';
import './revExists-12209d1c.js';
import './pouchdb-json.browser.js';
import './readAsBinaryString-06e911ba.js';
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
