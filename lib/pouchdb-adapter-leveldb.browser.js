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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWxldmVsZGIuYnJvd3Nlci5qcyIsInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWxldmVsZGIvc3JjL3JlcXVpcmVMZXZlbGRvd24uanMiLCIuLi9ub2RlX21vZHVsZXMvZW5jb2RpbmctZG93bi9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL25leHQtdGljay1icm93c2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VuY29kaW5nLWRvd24vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1pdGVyYXRvci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmNvZGluZy1kb3duL25vZGVfbW9kdWxlcy9hYnN0cmFjdC1sZXZlbGRvd24vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmNvZGluZy1kb3duL25vZGVfbW9kdWxlcy9hYnN0cmFjdC1sZXZlbGRvd24vYWJzdHJhY3QtbGV2ZWxkb3duLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VuY29kaW5nLWRvd24vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmNvZGluZy1kb3duL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLXBhY2thZ2VyL2xldmVsLXBhY2thZ2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL25vZGVfbW9kdWxlcy9hYnN0cmFjdC1sZXZlbGRvd24vbmV4dC10aWNrLWJyb3dzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvbGV2ZWwtanMvbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1pdGVyYXRvci5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZXZlbC1qcy9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL2Fic3RyYWN0LWNoYWluZWQtYmF0Y2guanMiLCIuLi9ub2RlX21vZHVsZXMvbGV2ZWwtanMvbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1sZXZlbGRvd24uanMiLCIuLi9ub2RlX21vZHVsZXMvbGV2ZWwtanMvbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZXZlbC1qcy91dGlsL2tleS1yYW5nZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZXZlbC1qcy91dGlsL2Rlc2VyaWFsaXplLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL2l0ZXJhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL3V0aWwvc2VyaWFsaXplLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL3V0aWwvc3VwcG9ydC5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZXZlbC1qcy91dGlsL2NsZWFyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWpzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsL2Jyb3dzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvd3JpdGUtc3RyZWFtL2FycmF5LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3dyaXRlLXN0cmVhbS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmQtc3RyZWFtL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLXdyaXRlLXN0cmVhbS9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1sZXZlbGRiL3NyYy9taWdyYXRlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWxldmVsZGIvc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHJlcXVpcmUgbGV2ZWxkb3duLiBwcm92aWRlIHZlcmJvc2Ugb3V0cHV0IG9uIGVycm9yIGFzIGl0IGlzIHRoZSBkZWZhdWx0XG4vLyBub2RlanMgYWRhcHRlciwgd2hpY2ggd2UgZG8gbm90IHByb3ZpZGUgZm9yIHRoZSB1c2VyXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xudmFyIHJlcXVpcmVMZXZlbGRvd24gPSBmdW5jdGlvbiAoKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJlcXVpcmUoJ2xldmVsZG93bicpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICAvKiBlc2xpbnQgbm8tZXgtYXNzaWduOiAwKi9cbiAgICBlcnIgPSBlcnIgfHwgJ2xldmVsZG93biBpbXBvcnQgZXJyb3InO1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ01PRFVMRV9OT1RfRk9VTkQnKSB7XG4gICAgICAvLyBoYW5kbGUgbGV2ZWxkb3duIG5vdCBpbnN0YWxsZWQgY2FzZVxuICAgICAgcmV0dXJuIG5ldyBFcnJvcihbXG4gICAgICAgICd0aGUgXFwnbGV2ZWxkb3duXFwnIHBhY2thZ2UgaXMgbm90IGF2YWlsYWJsZS4gaW5zdGFsbCBpdCwgb3IsJyxcbiAgICAgICAgJ3NwZWNpZnkgYW5vdGhlciBzdG9yYWdlIGJhY2tlbmQgdXNpbmcgdGhlIFxcJ2RiXFwnIG9wdGlvbidcbiAgICAgIF0uam9pbignICcpKTtcbiAgICB9IGVsc2UgaWYgKGVyci5tZXNzYWdlICYmIGVyci5tZXNzYWdlLm1hdGNoKCdNb2R1bGUgdmVyc2lvbiBtaXNtYXRjaCcpKSB7XG4gICAgICAvLyBoYW5kbGUgY29tbW9uIHVzZXIgZW52aW9ybm1lbnQgZXJyb3JcbiAgICAgIHJldHVybiBuZXcgRXJyb3IoW1xuICAgICAgICBlcnIubWVzc2FnZSxcbiAgICAgICAgJ1RoaXMgZ2VuZXJhbGx5IGltcGxpZXMgdGhhdCBsZXZlbGRvd24gd2FzIGJ1aWx0IHdpdGggYSBkaWZmZXJlbnQnLFxuICAgICAgICAndmVyc2lvbiBvZiBub2RlIHRoYW4gdGhhdCB3aGljaCBpcyBydW5uaW5nIG5vdy4gIFlvdSBtYXkgdHJ5JyxcbiAgICAgICAgJ2Z1bGx5IHJlbW92aW5nIGFuZCByZWluc3RhbGxpbmcgUG91Y2hEQiBvciBsZXZlbGRvd24gdG8gcmVzb2x2ZS4nXG4gICAgICBdLmpvaW4oJyAnKSk7XG4gICAgfVxuICAgIC8vIGhhbmRsZSBnZW5lcmFsIGludGVybmFsIG5vZGVqcyByZXF1aXJlIGVycm9yXG4gICAgcmV0dXJuIG5ldyBFcnJvcihlcnIudG9TdHJpbmcoKSArICc6IHVuYWJsZSB0byBpbXBvcnQgbGV2ZWxkb3duJyk7XG4gIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IHJlcXVpcmVMZXZlbGRvd247IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCdpbW1lZGlhdGUnKVxuIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgnLi9uZXh0LXRpY2snKVxuXG5mdW5jdGlvbiBBYnN0cmFjdEl0ZXJhdG9yIChkYikge1xuICBpZiAodHlwZW9mIGRiICE9PSAnb2JqZWN0JyB8fCBkYiA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYW4gYWJzdHJhY3QtbGV2ZWxkb3duIGNvbXBsaWFudCBzdG9yZScpXG4gIH1cblxuICB0aGlzLmRiID0gZGJcbiAgdGhpcy5fZW5kZWQgPSBmYWxzZVxuICB0aGlzLl9uZXh0aW5nID0gZmFsc2Vcbn1cblxuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCduZXh0KCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICBpZiAoc2VsZi5fZW5kZWQpIHtcbiAgICBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdjYW5ub3QgY2FsbCBuZXh0KCkgYWZ0ZXIgZW5kKCknKSlcbiAgICByZXR1cm4gc2VsZlxuICB9XG5cbiAgaWYgKHNlbGYuX25leHRpbmcpIHtcbiAgICBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdjYW5ub3QgY2FsbCBuZXh0KCkgYmVmb3JlIHByZXZpb3VzIG5leHQoKSBoYXMgY29tcGxldGVkJykpXG4gICAgcmV0dXJuIHNlbGZcbiAgfVxuXG4gIHNlbGYuX25leHRpbmcgPSB0cnVlXG4gIHNlbGYuX25leHQoZnVuY3Rpb24gKCkge1xuICAgIHNlbGYuX25leHRpbmcgPSBmYWxzZVxuICAgIGNhbGxiYWNrLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgfSlcblxuICByZXR1cm4gc2VsZlxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5fbmV4dCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUuc2VlayA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgaWYgKHRoaXMuX2VuZGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYW5ub3QgY2FsbCBzZWVrKCkgYWZ0ZXIgZW5kKCknKVxuICB9XG4gIGlmICh0aGlzLl9uZXh0aW5nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYW5ub3QgY2FsbCBzZWVrKCkgYmVmb3JlIG5leHQoKSBoYXMgY29tcGxldGVkJylcbiAgfVxuXG4gIHRhcmdldCA9IHRoaXMuZGIuX3NlcmlhbGl6ZUtleSh0YXJnZXQpXG4gIHRoaXMuX3NlZWsodGFyZ2V0KVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5fc2VlayA9IGZ1bmN0aW9uICh0YXJnZXQpIHt9XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdlbmQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIGlmICh0aGlzLl9lbmRlZCkge1xuICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdlbmQoKSBhbHJlYWR5IGNhbGxlZCBvbiBpdGVyYXRvcicpKVxuICB9XG5cbiAgdGhpcy5fZW5kZWQgPSB0cnVlXG4gIHRoaXMuX2VuZChjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUuX2VuZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuLy8gRXhwb3NlIGJyb3dzZXItY29tcGF0aWJsZSBuZXh0VGljayBmb3IgZGVwZW5kZW50c1xuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUuX25leHRUaWNrID0gbmV4dFRpY2tcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdEl0ZXJhdG9yXG4iLCJ2YXIgbmV4dFRpY2sgPSByZXF1aXJlKCcuL25leHQtdGljaycpXG5cbmZ1bmN0aW9uIEFic3RyYWN0Q2hhaW5lZEJhdGNoIChkYikge1xuICBpZiAodHlwZW9mIGRiICE9PSAnb2JqZWN0JyB8fCBkYiA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYW4gYWJzdHJhY3QtbGV2ZWxkb3duIGNvbXBsaWFudCBzdG9yZScpXG4gIH1cblxuICB0aGlzLmRiID0gZGJcbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG4gIHRoaXMuX3dyaXR0ZW4gPSBmYWxzZVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX2NoZWNrV3JpdHRlbiA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuX3dyaXR0ZW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dyaXRlKCkgYWxyZWFkeSBjYWxsZWQgb24gdGhpcyBiYXRjaCcpXG4gIH1cbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLnB1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgdmFyIGVyciA9IHRoaXMuZGIuX2NoZWNrS2V5KGtleSkgfHwgdGhpcy5kYi5fY2hlY2tWYWx1ZSh2YWx1ZSlcbiAgaWYgKGVycikgdGhyb3cgZXJyXG5cbiAga2V5ID0gdGhpcy5kYi5fc2VyaWFsaXplS2V5KGtleSlcbiAgdmFsdWUgPSB0aGlzLmRiLl9zZXJpYWxpemVWYWx1ZSh2YWx1ZSlcblxuICB0aGlzLl9wdXQoa2V5LCB2YWx1ZSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX3B1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gIHRoaXMuX29wZXJhdGlvbnMucHVzaCh7IHR5cGU6ICdwdXQnLCBrZXk6IGtleSwgdmFsdWU6IHZhbHVlIH0pXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgdmFyIGVyciA9IHRoaXMuZGIuX2NoZWNrS2V5KGtleSlcbiAgaWYgKGVycikgdGhyb3cgZXJyXG5cbiAga2V5ID0gdGhpcy5kYi5fc2VyaWFsaXplS2V5KGtleSlcbiAgdGhpcy5fZGVsKGtleSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX2RlbCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgdGhpcy5fb3BlcmF0aW9ucy5wdXNoKHsgdHlwZTogJ2RlbCcsIGtleToga2V5IH0pXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcbiAgdGhpcy5fY2xlYXIoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuX29wZXJhdGlvbnMgPSBbXVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHsgY2FsbGJhY2sgPSBvcHRpb25zIH1cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignd3JpdGUoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIHtcbiAgICBvcHRpb25zID0ge31cbiAgfVxuXG4gIHRoaXMuX3dyaXR0ZW4gPSB0cnVlXG4gIHRoaXMuX3dyaXRlKG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHRoaXMuZGIuX2JhdGNoKHRoaXMuX29wZXJhdGlvbnMsIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG4vLyBFeHBvc2UgYnJvd3Nlci1jb21wYXRpYmxlIG5leHRUaWNrIGZvciBkZXBlbmRlbnRzXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX25leHRUaWNrID0gbmV4dFRpY2tcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdENoYWluZWRCYXRjaFxuIiwidmFyIHh0ZW5kID0gcmVxdWlyZSgneHRlbmQnKVxudmFyIHN1cHBvcnRzID0gcmVxdWlyZSgnbGV2ZWwtc3VwcG9ydHMnKVxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlclxudmFyIEFic3RyYWN0SXRlcmF0b3IgPSByZXF1aXJlKCcuL2Fic3RyYWN0LWl0ZXJhdG9yJylcbnZhciBBYnN0cmFjdENoYWluZWRCYXRjaCA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaCcpXG52YXIgbmV4dFRpY2sgPSByZXF1aXJlKCcuL25leHQtdGljaycpXG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5XG52YXIgcmFuZ2VPcHRpb25zID0gJ3N0YXJ0IGVuZCBndCBndGUgbHQgbHRlJy5zcGxpdCgnICcpXG5cbmZ1bmN0aW9uIEFic3RyYWN0TGV2ZWxET1dOIChtYW5pZmVzdCkge1xuICB0aGlzLnN0YXR1cyA9ICduZXcnXG5cbiAgLy8gVE9ETyAobmV4dCBtYWpvcik6IG1ha2UgdGhpcyBtYW5kYXRvcnlcbiAgdGhpcy5zdXBwb3J0cyA9IHN1cHBvcnRzKG1hbmlmZXN0LCB7XG4gICAgc3RhdHVzOiB0cnVlXG4gIH0pXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgb2xkU3RhdHVzID0gdGhpcy5zdGF0dXNcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ29wZW4oKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkgb3B0aW9ucyA9IHt9XG5cbiAgb3B0aW9ucy5jcmVhdGVJZk1pc3NpbmcgPSBvcHRpb25zLmNyZWF0ZUlmTWlzc2luZyAhPT0gZmFsc2VcbiAgb3B0aW9ucy5lcnJvcklmRXhpc3RzID0gISFvcHRpb25zLmVycm9ySWZFeGlzdHNcblxuICB0aGlzLnN0YXR1cyA9ICdvcGVuaW5nJ1xuICB0aGlzLl9vcGVuKG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICBzZWxmLnN0YXR1cyA9IG9sZFN0YXR1c1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgICB9XG4gICAgc2VsZi5zdGF0dXMgPSAnb3BlbidcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fb3BlbiA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgb2xkU3RhdHVzID0gdGhpcy5zdGF0dXNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbG9zZSgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgdGhpcy5zdGF0dXMgPSAnY2xvc2luZydcbiAgdGhpcy5fY2xvc2UoZnVuY3Rpb24gKGVycikge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIHNlbGYuc3RhdHVzID0gb2xkU3RhdHVzXG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuICAgIH1cbiAgICBzZWxmLnN0YXR1cyA9ICdjbG9zZWQnXG4gICAgY2FsbGJhY2soKVxuICB9KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2Nsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSBjYWxsYmFjayA9IG9wdGlvbnNcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIHZhciBlcnIgPSB0aGlzLl9jaGVja0tleShrZXkpXG4gIGlmIChlcnIpIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgZXJyKVxuXG4gIGtleSA9IHRoaXMuX3NlcmlhbGl6ZUtleShrZXkpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0JyB8fCBvcHRpb25zID09PSBudWxsKSBvcHRpb25zID0ge31cblxuICBvcHRpb25zLmFzQnVmZmVyID0gb3B0aW9ucy5hc0J1ZmZlciAhPT0gZmFsc2VcblxuICB0aGlzLl9nZXQoa2V5LCBvcHRpb25zLCBjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9nZXQgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7IGNhbGxiYWNrKG5ldyBFcnJvcignTm90Rm91bmQnKSkgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLnB1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3B1dCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgdmFyIGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSkgfHwgdGhpcy5fY2hlY2tWYWx1ZSh2YWx1ZSlcbiAgaWYgKGVycikgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcbiAgdmFsdWUgPSB0aGlzLl9zZXJpYWxpemVWYWx1ZSh2YWx1ZSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuXG4gIHRoaXMuX3B1dChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgbmV4dFRpY2soY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2RlbCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgdmFyIGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSlcbiAgaWYgKGVycikgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuXG4gIHRoaXMuX2RlbChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2RlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuYmF0Y2ggPSBmdW5jdGlvbiAoYXJyYXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX2NoYWluZWRCYXRjaCgpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSBjYWxsYmFjayA9IG9wdGlvbnNcblxuICBpZiAodHlwZW9mIGFycmF5ID09PSAnZnVuY3Rpb24nKSBjYWxsYmFjayA9IGFycmF5XG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYmF0Y2goYXJyYXkpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSkge1xuICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdiYXRjaChhcnJheSkgcmVxdWlyZXMgYW4gYXJyYXkgYXJndW1lbnQnKSlcbiAgfVxuXG4gIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2spXG4gIH1cblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuXG4gIHZhciBzZXJpYWxpemVkID0gbmV3IEFycmF5KGFycmF5Lmxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHR5cGVvZiBhcnJheVtpXSAhPT0gJ29iamVjdCcgfHwgYXJyYXlbaV0gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKCdiYXRjaChhcnJheSkgZWxlbWVudCBtdXN0IGJlIGFuIG9iamVjdCBhbmQgbm90IGBudWxsYCcpKVxuICAgIH1cblxuICAgIHZhciBlID0geHRlbmQoYXJyYXlbaV0pXG5cbiAgICBpZiAoZS50eXBlICE9PSAncHV0JyAmJiBlLnR5cGUgIT09ICdkZWwnKSB7XG4gICAgICByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIG5ldyBFcnJvcihcImB0eXBlYCBtdXN0IGJlICdwdXQnIG9yICdkZWwnXCIpKVxuICAgIH1cblxuICAgIHZhciBlcnIgPSB0aGlzLl9jaGVja0tleShlLmtleSlcbiAgICBpZiAoZXJyKSByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIGVycilcblxuICAgIGUua2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGUua2V5KVxuXG4gICAgaWYgKGUudHlwZSA9PT0gJ3B1dCcpIHtcbiAgICAgIHZhciB2YWx1ZUVyciA9IHRoaXMuX2NoZWNrVmFsdWUoZS52YWx1ZSlcbiAgICAgIGlmICh2YWx1ZUVycikgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCB2YWx1ZUVycilcblxuICAgICAgZS52YWx1ZSA9IHRoaXMuX3NlcmlhbGl6ZVZhbHVlKGUudmFsdWUpXG4gICAgfVxuXG4gICAgc2VyaWFsaXplZFtpXSA9IGVcbiAgfVxuXG4gIHRoaXMuX2JhdGNoKHNlcmlhbGl6ZWQsIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2JhdGNoID0gZnVuY3Rpb24gKGFycmF5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuICB9IGVsc2UgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXIoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIG9wdGlvbnMgPSBjbGVhblJhbmdlT3B0aW9ucyh0aGlzLCBvcHRpb25zKVxuICBvcHRpb25zLnJldmVyc2UgPSAhIW9wdGlvbnMucmV2ZXJzZVxuICBvcHRpb25zLmxpbWl0ID0gJ2xpbWl0JyBpbiBvcHRpb25zID8gb3B0aW9ucy5saW1pdCA6IC0xXG5cbiAgdGhpcy5fY2xlYXIob3B0aW9ucywgY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2xlYXIgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgLy8gQXZvaWQgc2V0dXBJdGVyYXRvck9wdGlvbnMsIHdvdWxkIHNlcmlhbGl6ZSByYW5nZSBvcHRpb25zIGEgc2Vjb25kIHRpbWUuXG4gIG9wdGlvbnMua2V5cyA9IHRydWVcbiAgb3B0aW9ucy52YWx1ZXMgPSBmYWxzZVxuICBvcHRpb25zLmtleUFzQnVmZmVyID0gdHJ1ZVxuICBvcHRpb25zLnZhbHVlQXNCdWZmZXIgPSB0cnVlXG5cbiAgdmFyIGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0b3Iob3B0aW9ucylcbiAgdmFyIGVtcHR5T3B0aW9ucyA9IHt9XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIHZhciBuZXh0ID0gZnVuY3Rpb24gKGVycikge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIHJldHVybiBpdGVyYXRvci5lbmQoZnVuY3Rpb24gKCkge1xuICAgICAgICBjYWxsYmFjayhlcnIpXG4gICAgICB9KVxuICAgIH1cblxuICAgIGl0ZXJhdG9yLm5leHQoZnVuY3Rpb24gKGVyciwga2V5KSB7XG4gICAgICBpZiAoZXJyKSByZXR1cm4gbmV4dChlcnIpXG4gICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpIHJldHVybiBpdGVyYXRvci5lbmQoY2FsbGJhY2spXG5cbiAgICAgIC8vIFRoaXMgY291bGQgYmUgb3B0aW1pemVkIGJ5IHVzaW5nIGEgYmF0Y2gsIGJ1dCB0aGUgZGVmYXVsdCBfY2xlYXJcbiAgICAgIC8vIGlzIG5vdCBtZWFudCB0byBiZSBmYXN0LiBJbXBsZW1lbnRhdGlvbnMgaGF2ZSBtb3JlIHJvb20gdG8gb3B0aW1pemVcbiAgICAgIC8vIGlmIHRoZXkgb3ZlcnJpZGUgX2NsZWFyLiBOb3RlOiB1c2luZyBfZGVsIGJ5cGFzc2VzIGtleSBzZXJpYWxpemF0aW9uLlxuICAgICAgc2VsZi5fZGVsKGtleSwgZW1wdHlPcHRpb25zLCBuZXh0KVxuICAgIH0pXG4gIH1cblxuICBuZXh0KClcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9zZXR1cEl0ZXJhdG9yT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBjbGVhblJhbmdlT3B0aW9ucyh0aGlzLCBvcHRpb25zKVxuXG4gIG9wdGlvbnMucmV2ZXJzZSA9ICEhb3B0aW9ucy5yZXZlcnNlXG4gIG9wdGlvbnMua2V5cyA9IG9wdGlvbnMua2V5cyAhPT0gZmFsc2VcbiAgb3B0aW9ucy52YWx1ZXMgPSBvcHRpb25zLnZhbHVlcyAhPT0gZmFsc2VcbiAgb3B0aW9ucy5saW1pdCA9ICdsaW1pdCcgaW4gb3B0aW9ucyA/IG9wdGlvbnMubGltaXQgOiAtMVxuICBvcHRpb25zLmtleUFzQnVmZmVyID0gb3B0aW9ucy5rZXlBc0J1ZmZlciAhPT0gZmFsc2VcbiAgb3B0aW9ucy52YWx1ZUFzQnVmZmVyID0gb3B0aW9ucy52YWx1ZUFzQnVmZmVyICE9PSBmYWxzZVxuXG4gIHJldHVybiBvcHRpb25zXG59XG5cbmZ1bmN0aW9uIGNsZWFuUmFuZ2VPcHRpb25zIChkYiwgb3B0aW9ucykge1xuICB2YXIgcmVzdWx0ID0ge31cblxuICBmb3IgKHZhciBrIGluIG9wdGlvbnMpIHtcbiAgICBpZiAoIWhhc093blByb3BlcnR5LmNhbGwob3B0aW9ucywgaykpIGNvbnRpbnVlXG5cbiAgICB2YXIgb3B0ID0gb3B0aW9uc1trXVxuXG4gICAgaWYgKGlzUmFuZ2VPcHRpb24oaykpIHtcbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCByZWplY3QgbnVsbGlzaCBhbmQgZW1wdHkgb3B0aW9ucyBoZXJlLiBXaGlsZVxuICAgICAgLy8gdGhvc2UgdHlwZXMgYXJlIGludmFsaWQgYXMga2V5cywgdGhleSBhcmUgdmFsaWQgYXMgcmFuZ2Ugb3B0aW9ucy5cbiAgICAgIG9wdCA9IGRiLl9zZXJpYWxpemVLZXkob3B0KVxuICAgIH1cblxuICAgIHJlc3VsdFtrXSA9IG9wdFxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBpc1JhbmdlT3B0aW9uIChrKSB7XG4gIHJldHVybiByYW5nZU9wdGlvbnMuaW5kZXhPZihrKSAhPT0gLTFcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLml0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0JyB8fCBvcHRpb25zID09PSBudWxsKSBvcHRpb25zID0ge31cbiAgb3B0aW9ucyA9IHRoaXMuX3NldHVwSXRlcmF0b3JPcHRpb25zKG9wdGlvbnMpXG4gIHJldHVybiB0aGlzLl9pdGVyYXRvcihvcHRpb25zKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2l0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBBYnN0cmFjdEl0ZXJhdG9yKHRoaXMpXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2hhaW5lZEJhdGNoID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gbmV3IEFic3RyYWN0Q2hhaW5lZEJhdGNoKHRoaXMpXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fc2VyaWFsaXplS2V5ID0gZnVuY3Rpb24gKGtleSkge1xuICByZXR1cm4ga2V5XG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fc2VyaWFsaXplVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2hlY2tLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKCdrZXkgY2Fubm90IGJlIGBudWxsYCBvciBgdW5kZWZpbmVkYCcpXG4gIH0gZWxzZSBpZiAoQnVmZmVyLmlzQnVmZmVyKGtleSkgJiYga2V5Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgRXJyb3IoJ2tleSBjYW5ub3QgYmUgYW4gZW1wdHkgQnVmZmVyJylcbiAgfSBlbHNlIGlmIChrZXkgPT09ICcnKSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcigna2V5IGNhbm5vdCBiZSBhbiBlbXB0eSBTdHJpbmcnKVxuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoa2V5KSAmJiBrZXkubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcigna2V5IGNhbm5vdCBiZSBhbiBlbXB0eSBBcnJheScpXG4gIH1cbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGVja1ZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcigndmFsdWUgY2Fubm90IGJlIGBudWxsYCBvciBgdW5kZWZpbmVkYCcpXG4gIH1cbn1cblxuLy8gRXhwb3NlIGJyb3dzZXItY29tcGF0aWJsZSBuZXh0VGljayBmb3IgZGVwZW5kZW50c1xuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9uZXh0VGljayA9IG5leHRUaWNrXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RMZXZlbERPV05cbiIsImV4cG9ydHMuQWJzdHJhY3RMZXZlbERPV04gPSByZXF1aXJlKCcuL2Fic3RyYWN0LWxldmVsZG93bicpXG5leHBvcnRzLkFic3RyYWN0SXRlcmF0b3IgPSByZXF1aXJlKCcuL2Fic3RyYWN0LWl0ZXJhdG9yJylcbmV4cG9ydHMuQWJzdHJhY3RDaGFpbmVkQmF0Y2ggPSByZXF1aXJlKCcuL2Fic3RyYWN0LWNoYWluZWQtYmF0Y2gnKVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBBYnN0cmFjdExldmVsRE9XTiA9IHJlcXVpcmUoJ2Fic3RyYWN0LWxldmVsZG93bicpLkFic3RyYWN0TGV2ZWxET1dOXG52YXIgQWJzdHJhY3RDaGFpbmVkQmF0Y2ggPSByZXF1aXJlKCdhYnN0cmFjdC1sZXZlbGRvd24nKS5BYnN0cmFjdENoYWluZWRCYXRjaFxudmFyIEFic3RyYWN0SXRlcmF0b3IgPSByZXF1aXJlKCdhYnN0cmFjdC1sZXZlbGRvd24nKS5BYnN0cmFjdEl0ZXJhdG9yXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpXG52YXIgQ29kZWMgPSByZXF1aXJlKCdsZXZlbC1jb2RlYycpXG52YXIgRW5jb2RpbmdFcnJvciA9IHJlcXVpcmUoJ2xldmVsLWVycm9ycycpLkVuY29kaW5nRXJyb3JcbnZhciByYW5nZU1ldGhvZHMgPSBbJ2FwcHJveGltYXRlU2l6ZScsICdjb21wYWN0UmFuZ2UnXVxuXG5tb2R1bGUuZXhwb3J0cyA9IERCLmRlZmF1bHQgPSBEQlxuXG5mdW5jdGlvbiBEQiAoZGIsIG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIERCKSkgcmV0dXJuIG5ldyBEQihkYiwgb3B0cylcblxuICB2YXIgbWFuaWZlc3QgPSBkYi5zdXBwb3J0cyB8fCB7fVxuICB2YXIgYWRkaXRpb25hbE1ldGhvZHMgPSBtYW5pZmVzdC5hZGRpdGlvbmFsTWV0aG9kcyB8fCB7fVxuXG4gIEFic3RyYWN0TGV2ZWxET1dOLmNhbGwodGhpcywgbWFuaWZlc3QpXG5cbiAgdGhpcy5zdXBwb3J0cy5lbmNvZGluZ3MgPSB0cnVlXG4gIHRoaXMuc3VwcG9ydHMuYWRkaXRpb25hbE1ldGhvZHMgPSB7fVxuXG4gIHJhbmdlTWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgLy8gVE9ETyAoZnV0dXJlIG1ham9yKTogcmVtb3ZlIHRoaXMgZmFsbGJhY2tcbiAgICB2YXIgZmFsbGJhY2sgPSB0eXBlb2YgZGJbbV0gPT09ICdmdW5jdGlvbidcblxuICAgIGlmIChhZGRpdGlvbmFsTWV0aG9kc1ttXSB8fCBmYWxsYmFjaykge1xuICAgICAgdGhpcy5zdXBwb3J0cy5hZGRpdGlvbmFsTWV0aG9kc1ttXSA9IHRydWVcblxuICAgICAgdGhpc1ttXSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCBvcHRzLCBjYikge1xuICAgICAgICBzdGFydCA9IHRoaXMuY29kZWMuZW5jb2RlS2V5KHN0YXJ0LCBvcHRzKVxuICAgICAgICBlbmQgPSB0aGlzLmNvZGVjLmVuY29kZUtleShlbmQsIG9wdHMpXG4gICAgICAgIHJldHVybiB0aGlzLmRiW21dKHN0YXJ0LCBlbmQsIG9wdHMsIGNiKVxuICAgICAgfVxuICAgIH1cbiAgfSwgdGhpcylcblxuICBvcHRzID0gb3B0cyB8fCB7fVxuICBpZiAodHlwZW9mIG9wdHMua2V5RW5jb2RpbmcgPT09ICd1bmRlZmluZWQnKSBvcHRzLmtleUVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmICh0eXBlb2Ygb3B0cy52YWx1ZUVuY29kaW5nID09PSAndW5kZWZpbmVkJykgb3B0cy52YWx1ZUVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdGhpcy5kYiA9IGRiXG4gIHRoaXMuY29kZWMgPSBuZXcgQ29kZWMob3B0cylcbn1cblxuaW5oZXJpdHMoREIsIEFic3RyYWN0TGV2ZWxET1dOKVxuXG5EQi5wcm90b3R5cGUudHlwZSA9ICdlbmNvZGluZy1kb3duJ1xuXG5EQi5wcm90b3R5cGUuX3NlcmlhbGl6ZUtleSA9XG5EQi5wcm90b3R5cGUuX3NlcmlhbGl6ZVZhbHVlID0gZnVuY3Rpb24gKGRhdHVtKSB7XG4gIHJldHVybiBkYXR1bVxufVxuXG5EQi5wcm90b3R5cGUuX29wZW4gPSBmdW5jdGlvbiAob3B0cywgY2IpIHtcbiAgdGhpcy5kYi5vcGVuKG9wdHMsIGNiKVxufVxuXG5EQi5wcm90b3R5cGUuX2Nsb3NlID0gZnVuY3Rpb24gKGNiKSB7XG4gIHRoaXMuZGIuY2xvc2UoY2IpXG59XG5cbkRCLnByb3RvdHlwZS5fcHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdHMsIGNiKSB7XG4gIGtleSA9IHRoaXMuY29kZWMuZW5jb2RlS2V5KGtleSwgb3B0cylcbiAgdmFsdWUgPSB0aGlzLmNvZGVjLmVuY29kZVZhbHVlKHZhbHVlLCBvcHRzKVxuICB0aGlzLmRiLnB1dChrZXksIHZhbHVlLCBvcHRzLCBjYilcbn1cblxuREIucHJvdG90eXBlLl9nZXQgPSBmdW5jdGlvbiAoa2V5LCBvcHRzLCBjYikge1xuICB2YXIgc2VsZiA9IHRoaXNcbiAga2V5ID0gdGhpcy5jb2RlYy5lbmNvZGVLZXkoa2V5LCBvcHRzKVxuICBvcHRzLmFzQnVmZmVyID0gdGhpcy5jb2RlYy52YWx1ZUFzQnVmZmVyKG9wdHMpXG4gIHRoaXMuZGIuZ2V0KGtleSwgb3B0cywgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICBpZiAoZXJyKSByZXR1cm4gY2IoZXJyKVxuICAgIHRyeSB7XG4gICAgICB2YWx1ZSA9IHNlbGYuY29kZWMuZGVjb2RlVmFsdWUodmFsdWUsIG9wdHMpXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gY2IobmV3IEVuY29kaW5nRXJyb3IoZXJyKSlcbiAgICB9XG4gICAgY2IobnVsbCwgdmFsdWUpXG4gIH0pXG59XG5cbkRCLnByb3RvdHlwZS5fZGVsID0gZnVuY3Rpb24gKGtleSwgb3B0cywgY2IpIHtcbiAga2V5ID0gdGhpcy5jb2RlYy5lbmNvZGVLZXkoa2V5LCBvcHRzKVxuICB0aGlzLmRiLmRlbChrZXksIG9wdHMsIGNiKVxufVxuXG5EQi5wcm90b3R5cGUuX2NoYWluZWRCYXRjaCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIG5ldyBCYXRjaCh0aGlzKVxufVxuXG5EQi5wcm90b3R5cGUuX2JhdGNoID0gZnVuY3Rpb24gKG9wcywgb3B0cywgY2IpIHtcbiAgb3BzID0gdGhpcy5jb2RlYy5lbmNvZGVCYXRjaChvcHMsIG9wdHMpXG4gIHRoaXMuZGIuYmF0Y2gob3BzLCBvcHRzLCBjYilcbn1cblxuREIucHJvdG90eXBlLl9pdGVyYXRvciA9IGZ1bmN0aW9uIChvcHRzKSB7XG4gIG9wdHMua2V5QXNCdWZmZXIgPSB0aGlzLmNvZGVjLmtleUFzQnVmZmVyKG9wdHMpXG4gIG9wdHMudmFsdWVBc0J1ZmZlciA9IHRoaXMuY29kZWMudmFsdWVBc0J1ZmZlcihvcHRzKVxuICByZXR1cm4gbmV3IEl0ZXJhdG9yKHRoaXMsIG9wdHMpXG59XG5cbkRCLnByb3RvdHlwZS5fY2xlYXIgPSBmdW5jdGlvbiAob3B0cywgY2FsbGJhY2spIHtcbiAgb3B0cyA9IHRoaXMuY29kZWMuZW5jb2RlTHRndChvcHRzKVxuICB0aGlzLmRiLmNsZWFyKG9wdHMsIGNhbGxiYWNrKVxufVxuXG5mdW5jdGlvbiBJdGVyYXRvciAoZGIsIG9wdHMpIHtcbiAgQWJzdHJhY3RJdGVyYXRvci5jYWxsKHRoaXMsIGRiKVxuICB0aGlzLmNvZGVjID0gZGIuY29kZWNcbiAgdGhpcy5rZXlzID0gb3B0cy5rZXlzXG4gIHRoaXMudmFsdWVzID0gb3B0cy52YWx1ZXNcbiAgdGhpcy5vcHRzID0gdGhpcy5jb2RlYy5lbmNvZGVMdGd0KG9wdHMpXG4gIHRoaXMuaXQgPSBkYi5kYi5pdGVyYXRvcih0aGlzLm9wdHMpXG59XG5cbmluaGVyaXRzKEl0ZXJhdG9yLCBBYnN0cmFjdEl0ZXJhdG9yKVxuXG5JdGVyYXRvci5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHRoaXMuaXQubmV4dChmdW5jdGlvbiAoZXJyLCBrZXksIHZhbHVlKSB7XG4gICAgaWYgKGVycikgcmV0dXJuIGNiKGVycilcbiAgICB0cnkge1xuICAgICAgaWYgKHNlbGYua2V5cyAmJiB0eXBlb2Yga2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBrZXkgPSBzZWxmLmNvZGVjLmRlY29kZUtleShrZXksIHNlbGYub3B0cylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSA9IHVuZGVmaW5lZFxuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi52YWx1ZXMgJiYgdHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YWx1ZSA9IHNlbGYuY29kZWMuZGVjb2RlVmFsdWUodmFsdWUsIHNlbGYub3B0cylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gdW5kZWZpbmVkXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gY2IobmV3IEVuY29kaW5nRXJyb3IoZXJyKSlcbiAgICB9XG4gICAgY2IobnVsbCwga2V5LCB2YWx1ZSlcbiAgfSlcbn1cblxuSXRlcmF0b3IucHJvdG90eXBlLl9zZWVrID0gZnVuY3Rpb24gKGtleSkge1xuICBrZXkgPSB0aGlzLmNvZGVjLmVuY29kZUtleShrZXksIHRoaXMub3B0cylcbiAgdGhpcy5pdC5zZWVrKGtleSlcbn1cblxuSXRlcmF0b3IucHJvdG90eXBlLl9lbmQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5pdC5lbmQoY2IpXG59XG5cbmZ1bmN0aW9uIEJhdGNoIChkYiwgY29kZWMpIHtcbiAgQWJzdHJhY3RDaGFpbmVkQmF0Y2guY2FsbCh0aGlzLCBkYilcbiAgdGhpcy5jb2RlYyA9IGRiLmNvZGVjXG4gIHRoaXMuYmF0Y2ggPSBkYi5kYi5iYXRjaCgpXG59XG5cbmluaGVyaXRzKEJhdGNoLCBBYnN0cmFjdENoYWluZWRCYXRjaClcblxuQmF0Y2gucHJvdG90eXBlLl9wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICBrZXkgPSB0aGlzLmNvZGVjLmVuY29kZUtleShrZXkpXG4gIHZhbHVlID0gdGhpcy5jb2RlYy5lbmNvZGVWYWx1ZSh2YWx1ZSlcbiAgdGhpcy5iYXRjaC5wdXQoa2V5LCB2YWx1ZSlcbn1cblxuQmF0Y2gucHJvdG90eXBlLl9kZWwgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIGtleSA9IHRoaXMuY29kZWMuZW5jb2RlS2V5KGtleSlcbiAgdGhpcy5iYXRjaC5kZWwoa2V5KVxufVxuXG5CYXRjaC5wcm90b3R5cGUuX2NsZWFyID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmJhdGNoLmNsZWFyKClcbn1cblxuQmF0Y2gucHJvdG90eXBlLl93cml0ZSA9IGZ1bmN0aW9uIChvcHRzLCBjYikge1xuICB0aGlzLmJhdGNoLndyaXRlKG9wdHMsIGNiKVxufVxuIiwidmFyIGxldmVsdXAgPSByZXF1aXJlKCdsZXZlbHVwJylcbnZhciBlbmNvZGUgPSByZXF1aXJlKCdlbmNvZGluZy1kb3duJylcblxuZnVuY3Rpb24gcGFja2FnZXIgKGxldmVsZG93bikge1xuICBmdW5jdGlvbiBMZXZlbCAobG9jYXRpb24sIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBsb2NhdGlvbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBsb2NhdGlvblxuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuICAgIH1cblxuICAgIGlmICghaXNPYmplY3Qob3B0aW9ucykpIHtcbiAgICAgIG9wdGlvbnMgPSBpc09iamVjdChsb2NhdGlvbikgPyBsb2NhdGlvbiA6IHt9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxldmVsdXAoZW5jb2RlKGxldmVsZG93bihsb2NhdGlvbiwgb3B0aW9ucyksIG9wdGlvbnMpLCBvcHRpb25zLCBjYWxsYmFjaylcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzT2JqZWN0IChvKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJiBvICE9PSBudWxsXG4gIH1cblxuICBbJ2Rlc3Ryb3knLCAncmVwYWlyJ10uZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICAgIGlmICh0eXBlb2YgbGV2ZWxkb3duW21dID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBMZXZlbFttXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbGV2ZWxkb3duW21dLmFwcGx5KGxldmVsZG93biwgYXJndW1lbnRzKVxuICAgICAgfVxuICAgIH1cbiAgfSlcblxuICBMZXZlbC5lcnJvcnMgPSBsZXZlbHVwLmVycm9yc1xuXG4gIHJldHVybiBMZXZlbFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhY2thZ2VyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJ2ltbWVkaWF0ZScpXG4iLCJ2YXIgbmV4dFRpY2sgPSByZXF1aXJlKCcuL25leHQtdGljaycpXG5cbmZ1bmN0aW9uIEFic3RyYWN0SXRlcmF0b3IgKGRiKSB7XG4gIGlmICh0eXBlb2YgZGIgIT09ICdvYmplY3QnIHx8IGRiID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBhYnN0cmFjdC1sZXZlbGRvd24gY29tcGxpYW50IHN0b3JlJylcbiAgfVxuXG4gIHRoaXMuZGIgPSBkYlxuICB0aGlzLl9lbmRlZCA9IGZhbHNlXG4gIHRoaXMuX25leHRpbmcgPSBmYWxzZVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ25leHQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgfVxuXG4gIGlmIChzZWxmLl9lbmRlZCkge1xuICAgIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIG5leHQoKSBhZnRlciBlbmQoKScpKVxuICAgIHJldHVybiBzZWxmXG4gIH1cblxuICBpZiAoc2VsZi5fbmV4dGluZykge1xuICAgIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIG5leHQoKSBiZWZvcmUgcHJldmlvdXMgbmV4dCgpIGhhcyBjb21wbGV0ZWQnKSlcbiAgICByZXR1cm4gc2VsZlxuICB9XG5cbiAgc2VsZi5fbmV4dGluZyA9IHRydWVcbiAgc2VsZi5fbmV4dChmdW5jdGlvbiAoKSB7XG4gICAgc2VsZi5fbmV4dGluZyA9IGZhbHNlXG4gICAgY2FsbGJhY2suYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICB9KVxuXG4gIHJldHVybiBzZWxmXG59XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLl9uZXh0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5zZWVrID0gZnVuY3Rpb24gKHRhcmdldCkge1xuICBpZiAodGhpcy5fZW5kZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIHNlZWsoKSBhZnRlciBlbmQoKScpXG4gIH1cbiAgaWYgKHRoaXMuX25leHRpbmcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIHNlZWsoKSBiZWZvcmUgbmV4dCgpIGhhcyBjb21wbGV0ZWQnKVxuICB9XG5cbiAgdGFyZ2V0ID0gdGhpcy5kYi5fc2VyaWFsaXplS2V5KHRhcmdldClcbiAgdGhpcy5fc2Vlayh0YXJnZXQpXG59XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLl9zZWVrID0gZnVuY3Rpb24gKHRhcmdldCkge31cblxuQWJzdHJhY3RJdGVyYXRvci5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2VuZCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgaWYgKHRoaXMuX2VuZGVkKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2VuZCgpIGFscmVhZHkgY2FsbGVkIG9uIGl0ZXJhdG9yJykpXG4gIH1cblxuICB0aGlzLl9lbmRlZCA9IHRydWVcbiAgdGhpcy5fZW5kKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5fZW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG4vLyBFeHBvc2UgYnJvd3Nlci1jb21wYXRpYmxlIG5leHRUaWNrIGZvciBkZXBlbmRlbnRzXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5fbmV4dFRpY2sgPSBuZXh0VGlja1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0SXRlcmF0b3JcbiIsInZhciBuZXh0VGljayA9IHJlcXVpcmUoJy4vbmV4dC10aWNrJylcblxuZnVuY3Rpb24gQWJzdHJhY3RDaGFpbmVkQmF0Y2ggKGRiKSB7XG4gIGlmICh0eXBlb2YgZGIgIT09ICdvYmplY3QnIHx8IGRiID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBhYnN0cmFjdC1sZXZlbGRvd24gY29tcGxpYW50IHN0b3JlJylcbiAgfVxuXG4gIHRoaXMuZGIgPSBkYlxuICB0aGlzLl9vcGVyYXRpb25zID0gW11cbiAgdGhpcy5fd3JpdHRlbiA9IGZhbHNlXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fY2hlY2tXcml0dGVuID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5fd3JpdHRlbikge1xuICAgIHRocm93IG5ldyBFcnJvcignd3JpdGUoKSBhbHJlYWR5IGNhbGxlZCBvbiB0aGlzIGJhdGNoJylcbiAgfVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB2YXIgZXJyID0gdGhpcy5kYi5fY2hlY2tLZXkoa2V5KSB8fCB0aGlzLmRiLl9jaGVja1ZhbHVlKHZhbHVlKVxuICBpZiAoZXJyKSB0aHJvdyBlcnJcblxuICBrZXkgPSB0aGlzLmRiLl9zZXJpYWxpemVLZXkoa2V5KVxuICB2YWx1ZSA9IHRoaXMuZGIuX3NlcmlhbGl6ZVZhbHVlKHZhbHVlKVxuXG4gIHRoaXMuX3B1dChrZXksIHZhbHVlKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fcHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgdGhpcy5fb3BlcmF0aW9ucy5wdXNoKHsgdHlwZTogJ3B1dCcsIGtleToga2V5LCB2YWx1ZTogdmFsdWUgfSlcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB2YXIgZXJyID0gdGhpcy5kYi5fY2hlY2tLZXkoa2V5KVxuICBpZiAoZXJyKSB0aHJvdyBlcnJcblxuICBrZXkgPSB0aGlzLmRiLl9zZXJpYWxpemVLZXkoa2V5KVxuICB0aGlzLl9kZWwoa2V5KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fZGVsID0gZnVuY3Rpb24gKGtleSkge1xuICB0aGlzLl9vcGVyYXRpb25zLnB1c2goeyB0eXBlOiAnZGVsJywga2V5OiBrZXkgfSlcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLl9jaGVja1dyaXR0ZW4oKVxuICB0aGlzLl9jbGVhcigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuQWJzdHJhY3RDaGFpbmVkQmF0Y2gucHJvdG90eXBlLl9jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuICB0aGlzLl9jaGVja1dyaXR0ZW4oKVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykgeyBjYWxsYmFjayA9IG9wdGlvbnMgfVxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd3cml0ZSgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkge1xuICAgIG9wdGlvbnMgPSB7fVxuICB9XG5cbiAgdGhpcy5fd3JpdHRlbiA9IHRydWVcbiAgdGhpcy5fd3JpdGUob3B0aW9ucywgY2FsbGJhY2spXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdGhpcy5kYi5fYmF0Y2godGhpcy5fb3BlcmF0aW9ucywgb3B0aW9ucywgY2FsbGJhY2spXG59XG5cbi8vIEV4cG9zZSBicm93c2VyLWNvbXBhdGlibGUgbmV4dFRpY2sgZm9yIGRlcGVuZGVudHNcbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fbmV4dFRpY2sgPSBuZXh0VGlja1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Q2hhaW5lZEJhdGNoXG4iLCJ2YXIgeHRlbmQgPSByZXF1aXJlKCd4dGVuZCcpXG52YXIgc3VwcG9ydHMgPSByZXF1aXJlKCdsZXZlbC1zdXBwb3J0cycpXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyXG52YXIgQWJzdHJhY3RJdGVyYXRvciA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtaXRlcmF0b3InKVxudmFyIEFic3RyYWN0Q2hhaW5lZEJhdGNoID0gcmVxdWlyZSgnLi9hYnN0cmFjdC1jaGFpbmVkLWJhdGNoJylcbnZhciBuZXh0VGljayA9IHJlcXVpcmUoJy4vbmV4dC10aWNrJylcbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHlcbnZhciByYW5nZU9wdGlvbnMgPSAnc3RhcnQgZW5kIGd0IGd0ZSBsdCBsdGUnLnNwbGl0KCcgJylcblxuZnVuY3Rpb24gQWJzdHJhY3RMZXZlbERPV04gKG1hbmlmZXN0KSB7XG4gIHRoaXMuc3RhdHVzID0gJ25ldydcblxuICAvLyBUT0RPIChuZXh0IG1ham9yKTogbWFrZSB0aGlzIG1hbmRhdG9yeVxuICB0aGlzLnN1cHBvcnRzID0gc3VwcG9ydHMobWFuaWZlc3QsIHtcbiAgICBzdGF0dXM6IHRydWVcbiAgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBvbGRTdGF0dXMgPSB0aGlzLnN0YXR1c1xuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignb3BlbigpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0JyB8fCBvcHRpb25zID09PSBudWxsKSBvcHRpb25zID0ge31cblxuICBvcHRpb25zLmNyZWF0ZUlmTWlzc2luZyA9IG9wdGlvbnMuY3JlYXRlSWZNaXNzaW5nICE9PSBmYWxzZVxuICBvcHRpb25zLmVycm9ySWZFeGlzdHMgPSAhIW9wdGlvbnMuZXJyb3JJZkV4aXN0c1xuXG4gIHRoaXMuc3RhdHVzID0gJ29wZW5pbmcnXG4gIHRoaXMuX29wZW4ob3B0aW9ucywgZnVuY3Rpb24gKGVycikge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIHNlbGYuc3RhdHVzID0gb2xkU3RhdHVzXG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuICAgIH1cbiAgICBzZWxmLnN0YXR1cyA9ICdvcGVuJ1xuICAgIGNhbGxiYWNrKClcbiAgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBvbGRTdGF0dXMgPSB0aGlzLnN0YXR1c1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nsb3NlKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICB0aGlzLnN0YXR1cyA9ICdjbG9zaW5nJ1xuICB0aGlzLl9jbG9zZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgaWYgKGVycikge1xuICAgICAgc2VsZi5zdGF0dXMgPSBvbGRTdGF0dXNcbiAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG4gICAgfVxuICAgIHNlbGYuc3RhdHVzID0gJ2Nsb3NlZCdcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fY2xvc2UgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgbmV4dFRpY2soY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgdmFyIGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSlcbiAgaWYgKGVycikgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuXG4gIG9wdGlvbnMuYXNCdWZmZXIgPSBvcHRpb25zLmFzQnVmZmVyICE9PSBmYWxzZVxuXG4gIHRoaXMuX2dldChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2dldCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHsgY2FsbGJhY2sobmV3IEVycm9yKCdOb3RGb3VuZCcpKSB9KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcigncHV0KCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICB2YXIgZXJyID0gdGhpcy5fY2hlY2tLZXkoa2V5KSB8fCB0aGlzLl9jaGVja1ZhbHVlKHZhbHVlKVxuICBpZiAoZXJyKSByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIGVycilcblxuICBrZXkgPSB0aGlzLl9zZXJpYWxpemVLZXkoa2V5KVxuICB2YWx1ZSA9IHRoaXMuX3NlcmlhbGl6ZVZhbHVlKHZhbHVlKVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkgb3B0aW9ucyA9IHt9XG5cbiAgdGhpcy5fcHV0KGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX3B1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBuZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignZGVsKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICB2YXIgZXJyID0gdGhpcy5fY2hlY2tLZXkoa2V5KVxuICBpZiAoZXJyKSByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIGVycilcblxuICBrZXkgPSB0aGlzLl9zZXJpYWxpemVLZXkoa2V5KVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkgb3B0aW9ucyA9IHt9XG5cbiAgdGhpcy5fZGVsKGtleSwgb3B0aW9ucywgY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fZGVsID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgbmV4dFRpY2soY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5iYXRjaCA9IGZ1bmN0aW9uIChhcnJheSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fY2hhaW5lZEJhdGNoKClcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgYXJyYXkgPT09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gYXJyYXlcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdiYXRjaChhcnJheSkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG4gIH1cblxuICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXkpKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2JhdGNoKGFycmF5KSByZXF1aXJlcyBhbiBhcnJheSBhcmd1bWVudCcpKVxuICB9XG5cbiAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaylcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkgb3B0aW9ucyA9IHt9XG5cbiAgdmFyIHNlcmlhbGl6ZWQgPSBuZXcgQXJyYXkoYXJyYXkubGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodHlwZW9mIGFycmF5W2ldICE9PSAnb2JqZWN0JyB8fCBhcnJheVtpXSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5leHRUaWNrKGNhbGxiYWNrLCBuZXcgRXJyb3IoJ2JhdGNoKGFycmF5KSBlbGVtZW50IG11c3QgYmUgYW4gb2JqZWN0IGFuZCBub3QgYG51bGxgJykpXG4gICAgfVxuXG4gICAgdmFyIGUgPSB4dGVuZChhcnJheVtpXSlcblxuICAgIGlmIChlLnR5cGUgIT09ICdwdXQnICYmIGUudHlwZSAhPT0gJ2RlbCcpIHtcbiAgICAgIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgbmV3IEVycm9yKFwiYHR5cGVgIG11c3QgYmUgJ3B1dCcgb3IgJ2RlbCdcIikpXG4gICAgfVxuXG4gICAgdmFyIGVyciA9IHRoaXMuX2NoZWNrS2V5KGUua2V5KVxuICAgIGlmIChlcnIpIHJldHVybiBuZXh0VGljayhjYWxsYmFjaywgZXJyKVxuXG4gICAgZS5rZXkgPSB0aGlzLl9zZXJpYWxpemVLZXkoZS5rZXkpXG5cbiAgICBpZiAoZS50eXBlID09PSAncHV0Jykge1xuICAgICAgdmFyIHZhbHVlRXJyID0gdGhpcy5fY2hlY2tWYWx1ZShlLnZhbHVlKVxuICAgICAgaWYgKHZhbHVlRXJyKSByZXR1cm4gbmV4dFRpY2soY2FsbGJhY2ssIHZhbHVlRXJyKVxuXG4gICAgICBlLnZhbHVlID0gdGhpcy5fc2VyaWFsaXplVmFsdWUoZS52YWx1ZSlcbiAgICB9XG5cbiAgICBzZXJpYWxpemVkW2ldID0gZVxuICB9XG5cbiAgdGhpcy5fYmF0Y2goc2VyaWFsaXplZCwgb3B0aW9ucywgY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fYmF0Y2ggPSBmdW5jdGlvbiAoYXJyYXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIG5leHRUaWNrKGNhbGxiYWNrKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG4gIH0gZWxzZSBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhcigpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuICB9XG5cbiAgb3B0aW9ucyA9IGNsZWFuUmFuZ2VPcHRpb25zKHRoaXMsIG9wdGlvbnMpXG4gIG9wdGlvbnMucmV2ZXJzZSA9ICEhb3B0aW9ucy5yZXZlcnNlXG4gIG9wdGlvbnMubGltaXQgPSAnbGltaXQnIGluIG9wdGlvbnMgPyBvcHRpb25zLmxpbWl0IDogLTFcblxuICB0aGlzLl9jbGVhcihvcHRpb25zLCBjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jbGVhciA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuICAvLyBBdm9pZCBzZXR1cEl0ZXJhdG9yT3B0aW9ucywgd291bGQgc2VyaWFsaXplIHJhbmdlIG9wdGlvbnMgYSBzZWNvbmQgdGltZS5cbiAgb3B0aW9ucy5rZXlzID0gdHJ1ZVxuICBvcHRpb25zLnZhbHVlcyA9IGZhbHNlXG4gIG9wdGlvbnMua2V5QXNCdWZmZXIgPSB0cnVlXG4gIG9wdGlvbnMudmFsdWVBc0J1ZmZlciA9IHRydWVcblxuICB2YXIgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRvcihvcHRpb25zKVxuICB2YXIgZW1wdHlPcHRpb25zID0ge31cbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgdmFyIG5leHQgPSBmdW5jdGlvbiAoZXJyKSB7XG4gICAgaWYgKGVycikge1xuICAgICAgcmV0dXJuIGl0ZXJhdG9yLmVuZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycilcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgaXRlcmF0b3IubmV4dChmdW5jdGlvbiAoZXJyLCBrZXkpIHtcbiAgICAgIGlmIChlcnIpIHJldHVybiBuZXh0KGVycilcbiAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGl0ZXJhdG9yLmVuZChjYWxsYmFjaylcblxuICAgICAgLy8gVGhpcyBjb3VsZCBiZSBvcHRpbWl6ZWQgYnkgdXNpbmcgYSBiYXRjaCwgYnV0IHRoZSBkZWZhdWx0IF9jbGVhclxuICAgICAgLy8gaXMgbm90IG1lYW50IHRvIGJlIGZhc3QuIEltcGxlbWVudGF0aW9ucyBoYXZlIG1vcmUgcm9vbSB0byBvcHRpbWl6ZVxuICAgICAgLy8gaWYgdGhleSBvdmVycmlkZSBfY2xlYXIuIE5vdGU6IHVzaW5nIF9kZWwgYnlwYXNzZXMga2V5IHNlcmlhbGl6YXRpb24uXG4gICAgICBzZWxmLl9kZWwoa2V5LCBlbXB0eU9wdGlvbnMsIG5leHQpXG4gICAgfSlcbiAgfVxuXG4gIG5leHQoKVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX3NldHVwSXRlcmF0b3JPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IGNsZWFuUmFuZ2VPcHRpb25zKHRoaXMsIG9wdGlvbnMpXG5cbiAgb3B0aW9ucy5yZXZlcnNlID0gISFvcHRpb25zLnJldmVyc2VcbiAgb3B0aW9ucy5rZXlzID0gb3B0aW9ucy5rZXlzICE9PSBmYWxzZVxuICBvcHRpb25zLnZhbHVlcyA9IG9wdGlvbnMudmFsdWVzICE9PSBmYWxzZVxuICBvcHRpb25zLmxpbWl0ID0gJ2xpbWl0JyBpbiBvcHRpb25zID8gb3B0aW9ucy5saW1pdCA6IC0xXG4gIG9wdGlvbnMua2V5QXNCdWZmZXIgPSBvcHRpb25zLmtleUFzQnVmZmVyICE9PSBmYWxzZVxuICBvcHRpb25zLnZhbHVlQXNCdWZmZXIgPSBvcHRpb25zLnZhbHVlQXNCdWZmZXIgIT09IGZhbHNlXG5cbiAgcmV0dXJuIG9wdGlvbnNcbn1cblxuZnVuY3Rpb24gY2xlYW5SYW5nZU9wdGlvbnMgKGRiLCBvcHRpb25zKSB7XG4gIHZhciByZXN1bHQgPSB7fVxuXG4gIGZvciAodmFyIGsgaW4gb3B0aW9ucykge1xuICAgIGlmICghaGFzT3duUHJvcGVydHkuY2FsbChvcHRpb25zLCBrKSkgY29udGludWVcblxuICAgIHZhciBvcHQgPSBvcHRpb25zW2tdXG5cbiAgICBpZiAoaXNSYW5nZU9wdGlvbihrKSkge1xuICAgICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IHJlamVjdCBudWxsaXNoIGFuZCBlbXB0eSBvcHRpb25zIGhlcmUuIFdoaWxlXG4gICAgICAvLyB0aG9zZSB0eXBlcyBhcmUgaW52YWxpZCBhcyBrZXlzLCB0aGV5IGFyZSB2YWxpZCBhcyByYW5nZSBvcHRpb25zLlxuICAgICAgb3B0ID0gZGIuX3NlcmlhbGl6ZUtleShvcHQpXG4gICAgfVxuXG4gICAgcmVzdWx0W2tdID0gb3B0XG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIGlzUmFuZ2VPcHRpb24gKGspIHtcbiAgcmV0dXJuIHJhbmdlT3B0aW9ucy5pbmRleE9mKGspICE9PSAtMVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuaXRlcmF0b3IgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnIHx8IG9wdGlvbnMgPT09IG51bGwpIG9wdGlvbnMgPSB7fVxuICBvcHRpb25zID0gdGhpcy5fc2V0dXBJdGVyYXRvck9wdGlvbnMob3B0aW9ucylcbiAgcmV0dXJuIHRoaXMuX2l0ZXJhdG9yKG9wdGlvbnMpXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5faXRlcmF0b3IgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICByZXR1cm4gbmV3IEFic3RyYWN0SXRlcmF0b3IodGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGFpbmVkQmF0Y2ggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgQWJzdHJhY3RDaGFpbmVkQmF0Y2godGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9zZXJpYWxpemVLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHJldHVybiBrZXlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9zZXJpYWxpemVWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWVcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGVja0tleSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgaWYgKGtleSA9PT0gbnVsbCB8fCBrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBuZXcgRXJyb3IoJ2tleSBjYW5ub3QgYmUgYG51bGxgIG9yIGB1bmRlZmluZWRgJylcbiAgfSBlbHNlIGlmIChCdWZmZXIuaXNCdWZmZXIoa2V5KSAmJiBrZXkubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcigna2V5IGNhbm5vdCBiZSBhbiBlbXB0eSBCdWZmZXInKVxuICB9IGVsc2UgaWYgKGtleSA9PT0gJycpIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKCdrZXkgY2Fubm90IGJlIGFuIGVtcHR5IFN0cmluZycpXG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShrZXkpICYmIGtleS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKCdrZXkgY2Fubm90IGJlIGFuIGVtcHR5IEFycmF5JylcbiAgfVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX2NoZWNrVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbmV3IEVycm9yKCd2YWx1ZSBjYW5ub3QgYmUgYG51bGxgIG9yIGB1bmRlZmluZWRgJylcbiAgfVxufVxuXG4vLyBFeHBvc2UgYnJvd3Nlci1jb21wYXRpYmxlIG5leHRUaWNrIGZvciBkZXBlbmRlbnRzXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX25leHRUaWNrID0gbmV4dFRpY2tcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdExldmVsRE9XTlxuIiwiZXhwb3J0cy5BYnN0cmFjdExldmVsRE9XTiA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtbGV2ZWxkb3duJylcbmV4cG9ydHMuQWJzdHJhY3RJdGVyYXRvciA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtaXRlcmF0b3InKVxuZXhwb3J0cy5BYnN0cmFjdENoYWluZWRCYXRjaCA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaCcpXG4iLCIvKiBnbG9iYWwgSURCS2V5UmFuZ2UgKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBsdGd0ID0gcmVxdWlyZSgnbHRndCcpXG52YXIgTk9ORSA9IHt9XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlS2V5UmFuZ2UgKG9wdGlvbnMpIHtcbiAgdmFyIGxvd2VyID0gbHRndC5sb3dlckJvdW5kKG9wdGlvbnMsIE5PTkUpXG4gIHZhciB1cHBlciA9IGx0Z3QudXBwZXJCb3VuZChvcHRpb25zLCBOT05FKVxuICB2YXIgbG93ZXJPcGVuID0gbHRndC5sb3dlckJvdW5kRXhjbHVzaXZlKG9wdGlvbnMsIE5PTkUpXG4gIHZhciB1cHBlck9wZW4gPSBsdGd0LnVwcGVyQm91bmRFeGNsdXNpdmUob3B0aW9ucywgTk9ORSlcblxuICBpZiAobG93ZXIgIT09IE5PTkUgJiYgdXBwZXIgIT09IE5PTkUpIHtcbiAgICByZXR1cm4gSURCS2V5UmFuZ2UuYm91bmQobG93ZXIsIHVwcGVyLCBsb3dlck9wZW4sIHVwcGVyT3BlbilcbiAgfSBlbHNlIGlmIChsb3dlciAhPT0gTk9ORSkge1xuICAgIHJldHVybiBJREJLZXlSYW5nZS5sb3dlckJvdW5kKGxvd2VyLCBsb3dlck9wZW4pXG4gIH0gZWxzZSBpZiAodXBwZXIgIT09IE5PTkUpIHtcbiAgICByZXR1cm4gSURCS2V5UmFuZ2UudXBwZXJCb3VuZCh1cHBlciwgdXBwZXJPcGVuKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyXG52YXIgdGEyc3RyID0gKGZ1bmN0aW9uICgpIHtcbiAgaWYgKGdsb2JhbC5UZXh0RGVjb2Rlcikge1xuICAgIHZhciBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXG4gICAgcmV0dXJuIGRlY29kZXIuZGVjb2RlLmJpbmQoZGVjb2RlcilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gdGEyc3RyICh0YSkge1xuICAgICAgcmV0dXJuIHRhMmJ1Zih0YSkudG9TdHJpbmcoKVxuICAgIH1cbiAgfVxufSkoKVxuXG52YXIgYWIyc3RyID0gKGZ1bmN0aW9uICgpIHtcbiAgaWYgKGdsb2JhbC5UZXh0RGVjb2Rlcikge1xuICAgIHZhciBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXG4gICAgcmV0dXJuIGRlY29kZXIuZGVjb2RlLmJpbmQoZGVjb2RlcilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWIyc3RyIChhYikge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGFiKS50b1N0cmluZygpXG4gICAgfVxuICB9XG59KSgpXG5cbmZ1bmN0aW9uIHRhMmJ1ZiAodGEpIHtcbiAgdmFyIGJ1ZiA9IEJ1ZmZlci5mcm9tKHRhLmJ1ZmZlcilcblxuICBpZiAodGEuYnl0ZUxlbmd0aCA9PT0gdGEuYnVmZmVyLmJ5dGVMZW5ndGgpIHtcbiAgICByZXR1cm4gYnVmXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJ1Zi5zbGljZSh0YS5ieXRlT2Zmc2V0LCB0YS5ieXRlT2Zmc2V0ICsgdGEuYnl0ZUxlbmd0aClcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChkYXRhLCBhc0J1ZmZlcikge1xuICBpZiAoZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICByZXR1cm4gYXNCdWZmZXIgPyB0YTJidWYoZGF0YSkgOiB0YTJzdHIoZGF0YSlcbiAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICByZXR1cm4gYXNCdWZmZXIgPyBCdWZmZXIuZnJvbShkYXRhKSA6IGFiMnN0cihkYXRhKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBhc0J1ZmZlciA/IEJ1ZmZlci5mcm9tKFN0cmluZyhkYXRhKSkgOiBTdHJpbmcoZGF0YSlcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJylcbnZhciBBYnN0cmFjdEl0ZXJhdG9yID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RJdGVyYXRvclxudmFyIGNyZWF0ZUtleVJhbmdlID0gcmVxdWlyZSgnLi91dGlsL2tleS1yYW5nZScpXG52YXIgZGVzZXJpYWxpemUgPSByZXF1aXJlKCcuL3V0aWwvZGVzZXJpYWxpemUnKVxudmFyIG5vb3AgPSBmdW5jdGlvbiAoKSB7fVxuXG5tb2R1bGUuZXhwb3J0cyA9IEl0ZXJhdG9yXG5cbmZ1bmN0aW9uIEl0ZXJhdG9yIChkYiwgbG9jYXRpb24sIG9wdGlvbnMpIHtcbiAgQWJzdHJhY3RJdGVyYXRvci5jYWxsKHRoaXMsIGRiKVxuXG4gIHRoaXMuX2xpbWl0ID0gb3B0aW9ucy5saW1pdFxuICB0aGlzLl9jb3VudCA9IDBcbiAgdGhpcy5fY2FsbGJhY2sgPSBudWxsXG4gIHRoaXMuX2NhY2hlID0gW11cbiAgdGhpcy5fY29tcGxldGVkID0gZmFsc2VcbiAgdGhpcy5fYWJvcnRlZCA9IGZhbHNlXG4gIHRoaXMuX2Vycm9yID0gbnVsbFxuICB0aGlzLl90cmFuc2FjdGlvbiA9IG51bGxcblxuICB0aGlzLl9rZXlzID0gb3B0aW9ucy5rZXlzXG4gIHRoaXMuX3ZhbHVlcyA9IG9wdGlvbnMudmFsdWVzXG4gIHRoaXMuX2tleUFzQnVmZmVyID0gb3B0aW9ucy5rZXlBc0J1ZmZlclxuICB0aGlzLl92YWx1ZUFzQnVmZmVyID0gb3B0aW9ucy52YWx1ZUFzQnVmZmVyXG5cbiAgaWYgKHRoaXMuX2xpbWl0ID09PSAwKSB7XG4gICAgdGhpcy5fY29tcGxldGVkID0gdHJ1ZVxuICAgIHJldHVyblxuICB9XG5cbiAgdHJ5IHtcbiAgICB2YXIga2V5UmFuZ2UgPSBjcmVhdGVLZXlSYW5nZShvcHRpb25zKVxuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gVGhlIGxvd2VyIGtleSBpcyBncmVhdGVyIHRoYW4gdGhlIHVwcGVyIGtleS5cbiAgICAvLyBJbmRleGVkREIgdGhyb3dzIGFuIGVycm9yLCBidXQgd2UnbGwganVzdCByZXR1cm4gMCByZXN1bHRzLlxuICAgIHRoaXMuX2NvbXBsZXRlZCA9IHRydWVcbiAgICByZXR1cm5cbiAgfVxuXG4gIHRoaXMuY3JlYXRlSXRlcmF0b3IobG9jYXRpb24sIGtleVJhbmdlLCBvcHRpb25zLnJldmVyc2UpXG59XG5cbmluaGVyaXRzKEl0ZXJhdG9yLCBBYnN0cmFjdEl0ZXJhdG9yKVxuXG5JdGVyYXRvci5wcm90b3R5cGUuY3JlYXRlSXRlcmF0b3IgPSBmdW5jdGlvbiAobG9jYXRpb24sIGtleVJhbmdlLCByZXZlcnNlKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgdHJhbnNhY3Rpb24gPSB0aGlzLmRiLmRiLnRyYW5zYWN0aW9uKFtsb2NhdGlvbl0sICdyZWFkb25seScpXG4gIHZhciBzdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKGxvY2F0aW9uKVxuICB2YXIgcmVxID0gc3RvcmUub3BlbkN1cnNvcihrZXlSYW5nZSwgcmV2ZXJzZSA/ICdwcmV2JyA6ICduZXh0JylcblxuICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2KSB7XG4gICAgdmFyIGN1cnNvciA9IGV2LnRhcmdldC5yZXN1bHRcbiAgICBpZiAoY3Vyc29yKSBzZWxmLm9uSXRlbShjdXJzb3IpXG4gIH1cblxuICB0aGlzLl90cmFuc2FjdGlvbiA9IHRyYW5zYWN0aW9uXG5cbiAgLy8gSWYgYW4gZXJyb3Igb2NjdXJzIChvbiB0aGUgcmVxdWVzdCksIHRoZSB0cmFuc2FjdGlvbiB3aWxsIGFib3J0LlxuICB0cmFuc2FjdGlvbi5vbmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgIHNlbGYub25BYm9ydChzZWxmLl90cmFuc2FjdGlvbi5lcnJvciB8fCBuZXcgRXJyb3IoJ2Fib3J0ZWQgYnkgdXNlcicpKVxuICB9XG5cbiAgdHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLm9uQ29tcGxldGUoKVxuICB9XG59XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5vbkl0ZW0gPSBmdW5jdGlvbiAoY3Vyc29yKSB7XG4gIHRoaXMuX2NhY2hlLnB1c2goY3Vyc29yLmtleSwgY3Vyc29yLnZhbHVlKVxuXG4gIGlmICh0aGlzLl9saW1pdCA8PSAwIHx8ICsrdGhpcy5fY291bnQgPCB0aGlzLl9saW1pdCkge1xuICAgIGN1cnNvci5jb250aW51ZSgpXG4gIH1cblxuICB0aGlzLm1heWJlTmV4dCgpXG59XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5vbkFib3J0ID0gZnVuY3Rpb24gKGVycikge1xuICB0aGlzLl9hYm9ydGVkID0gdHJ1ZVxuICB0aGlzLl9lcnJvciA9IGVyclxuICB0aGlzLm1heWJlTmV4dCgpXG59XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5vbkNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLl9jb21wbGV0ZWQgPSB0cnVlXG4gIHRoaXMubWF5YmVOZXh0KClcbn1cblxuSXRlcmF0b3IucHJvdG90eXBlLm1heWJlTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuX2NhbGxiYWNrKSB7XG4gICAgdGhpcy5fbmV4dCh0aGlzLl9jYWxsYmFjaylcbiAgICB0aGlzLl9jYWxsYmFjayA9IG51bGxcbiAgfVxufVxuXG5JdGVyYXRvci5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuX2Fib3J0ZWQpIHtcbiAgICAvLyBUaGUgZXJyb3Igc2hvdWxkIGJlIHBpY2tlZCB1cCBieSBlaXRoZXIgbmV4dCgpIG9yIGVuZCgpLlxuICAgIHZhciBlcnIgPSB0aGlzLl9lcnJvclxuICAgIHRoaXMuX2Vycm9yID0gbnVsbFxuICAgIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG4gIH0gZWxzZSBpZiAodGhpcy5fY2FjaGUubGVuZ3RoID4gMCkge1xuICAgIHZhciBrZXkgPSB0aGlzLl9jYWNoZS5zaGlmdCgpXG4gICAgdmFyIHZhbHVlID0gdGhpcy5fY2FjaGUuc2hpZnQoKVxuXG4gICAgaWYgKHRoaXMuX2tleXMgJiYga2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGtleSA9IHRoaXMuX2Rlc2VyaWFsaXplS2V5KGtleSwgdGhpcy5fa2V5QXNCdWZmZXIpXG4gICAgfSBlbHNlIHtcbiAgICAgIGtleSA9IHVuZGVmaW5lZFxuICAgIH1cblxuICAgIGlmICh0aGlzLl92YWx1ZXMgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsdWUgPSB0aGlzLl9kZXNlcmlhbGl6ZVZhbHVlKHZhbHVlLCB0aGlzLl92YWx1ZUFzQnVmZmVyKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IHVuZGVmaW5lZFxuICAgIH1cblxuICAgIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrLCBudWxsLCBrZXksIHZhbHVlKVxuICB9IGVsc2UgaWYgKHRoaXMuX2NvbXBsZXRlZCkge1xuICAgIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrKVxuICB9IGVsc2Uge1xuICAgIHRoaXMuX2NhbGxiYWNrID0gY2FsbGJhY2tcbiAgfVxufVxuXG4vLyBFeHBvc2VkIGZvciB0aGUgdjQgdG8gdjUgdXBncmFkZSB1dGlsaXR5XG5JdGVyYXRvci5wcm90b3R5cGUuX2Rlc2VyaWFsaXplS2V5ID0gZGVzZXJpYWxpemVcbkl0ZXJhdG9yLnByb3RvdHlwZS5fZGVzZXJpYWxpemVWYWx1ZSA9IGRlc2VyaWFsaXplXG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5fZW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIGlmICh0aGlzLl9hYm9ydGVkIHx8IHRoaXMuX2NvbXBsZXRlZCkge1xuICAgIHJldHVybiB0aGlzLl9uZXh0VGljayhjYWxsYmFjaywgdGhpcy5fZXJyb3IpXG4gIH1cblxuICAvLyBEb24ndCBhZHZhbmNlIHRoZSBjdXJzb3IgYW55bW9yZSwgYW5kIHRoZSB0cmFuc2FjdGlvbiB3aWxsIGNvbXBsZXRlXG4gIC8vIG9uIGl0cyBvd24gaW4gdGhlIG5leHQgdGljay4gVGhpcyBhcHByb2FjaCBpcyBtdWNoIGNsZWFuZXIgdGhhbiBjYWxsaW5nXG4gIC8vIHRyYW5zYWN0aW9uLmFib3J0KCkgd2l0aCBpdHMgdW5wcmVkaWN0YWJsZSBldmVudCBvcmRlci5cbiAgdGhpcy5vbkl0ZW0gPSBub29wXG4gIHRoaXMub25BYm9ydCA9IGNhbGxiYWNrXG4gIHRoaXMub25Db21wbGV0ZSA9IGNhbGxiYWNrXG59XG4iLCIndXNlIHN0cmljdCdcblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlclxuLy8gUmV0dXJucyBlaXRoZXIgYSBVaW50OEFycmF5IG9yIEJ1ZmZlciAoZG9lc24ndCBtYXR0ZXIgdG9cbi8vIEluZGV4ZWREQiwgYmVjYXVzZSBCdWZmZXIgaXMgYSBzdWJjbGFzcyBvZiBVaW50OEFycmF5KVxudmFyIHN0cjJiaW4gPSAoZnVuY3Rpb24gKCkge1xuICBpZiAoZ2xvYmFsLlRleHRFbmNvZGVyKSB7XG4gICAgdmFyIGVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoJ3V0Zi04JylcbiAgICByZXR1cm4gZW5jb2Rlci5lbmNvZGUuYmluZChlbmNvZGVyKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBCdWZmZXIuZnJvbVxuICB9XG59KSgpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRhdGEsIGFzQnVmZmVyKSB7XG4gIGlmIChhc0J1ZmZlcikge1xuICAgIHJldHVybiBCdWZmZXIuaXNCdWZmZXIoZGF0YSkgPyBkYXRhIDogc3RyMmJpbihTdHJpbmcoZGF0YSkpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFN0cmluZyhkYXRhKVxuICB9XG59XG4iLCIndXNlIHN0cmljdCdcblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlclxuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbiB0ZXN0IChpbXBsKSB7XG4gICAgdHJ5IHtcbiAgICAgIGltcGwuY21wKGtleSwgMClcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cbn1cblxuLy8gRGV0ZWN0IGJpbmFyeSBrZXkgc3VwcG9ydCAoSW5kZXhlZERCIFNlY29uZCBFZGl0aW9uKVxuZXhwb3J0cy5idWZmZXJLZXlzID0gZXhwb3J0cy50ZXN0KEJ1ZmZlci5hbGxvYygwKSlcbiIsIid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNsZWFyIChkYiwgbG9jYXRpb24sIGtleVJhbmdlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAob3B0aW9ucy5saW1pdCA9PT0gMCkgcmV0dXJuIGRiLl9uZXh0VGljayhjYWxsYmFjaylcblxuICB2YXIgdHJhbnNhY3Rpb24gPSBkYi5kYi50cmFuc2FjdGlvbihbbG9jYXRpb25dLCAncmVhZHdyaXRlJylcbiAgdmFyIHN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUobG9jYXRpb24pXG4gIHZhciBjb3VudCA9IDBcblxuICB0cmFuc2FjdGlvbi5vbmNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgIGNhbGxiYWNrKClcbiAgfVxuXG4gIHRyYW5zYWN0aW9uLm9uYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2sodHJhbnNhY3Rpb24uZXJyb3IgfHwgbmV3IEVycm9yKCdhYm9ydGVkIGJ5IHVzZXInKSlcbiAgfVxuXG4gIC8vIEEga2V5IGN1cnNvciBpcyBmYXN0ZXIgKHNraXBzIHJlYWRpbmcgdmFsdWVzKSBidXQgbm90IHN1cHBvcnRlZCBieSBJRVxuICB2YXIgbWV0aG9kID0gc3RvcmUub3BlbktleUN1cnNvciA/ICdvcGVuS2V5Q3Vyc29yJyA6ICdvcGVuQ3Vyc29yJ1xuICB2YXIgZGlyZWN0aW9uID0gb3B0aW9ucy5yZXZlcnNlID8gJ3ByZXYnIDogJ25leHQnXG5cbiAgc3RvcmVbbWV0aG9kXShrZXlSYW5nZSwgZGlyZWN0aW9uKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZXYpIHtcbiAgICB2YXIgY3Vyc29yID0gZXYudGFyZ2V0LnJlc3VsdFxuXG4gICAgaWYgKGN1cnNvcikge1xuICAgICAgLy8gV2FpdCBmb3IgYSByZXF1ZXN0IHRvIGNvbXBsZXRlIGJlZm9yZSBjb250aW51aW5nLCBzYXZpbmcgQ1BVLlxuICAgICAgc3RvcmUuZGVsZXRlKGN1cnNvci5rZXkpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMubGltaXQgPD0gMCB8fCArK2NvdW50IDwgb3B0aW9ucy5saW1pdCkge1xuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsIi8qIGdsb2JhbCBpbmRleGVkREIgKi9cblxuJ3VzZSBzdHJpY3QnXG5cbm1vZHVsZS5leHBvcnRzID0gTGV2ZWxcblxudmFyIEFic3RyYWN0TGV2ZWxET1dOID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RMZXZlbERPV05cbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJylcbnZhciBJdGVyYXRvciA9IHJlcXVpcmUoJy4vaXRlcmF0b3InKVxudmFyIHNlcmlhbGl6ZSA9IHJlcXVpcmUoJy4vdXRpbC9zZXJpYWxpemUnKVxudmFyIGRlc2VyaWFsaXplID0gcmVxdWlyZSgnLi91dGlsL2Rlc2VyaWFsaXplJylcbnZhciBzdXBwb3J0ID0gcmVxdWlyZSgnLi91dGlsL3N1cHBvcnQnKVxudmFyIGNsZWFyID0gcmVxdWlyZSgnLi91dGlsL2NsZWFyJylcbnZhciBjcmVhdGVLZXlSYW5nZSA9IHJlcXVpcmUoJy4vdXRpbC9rZXktcmFuZ2UnKVxuXG52YXIgREVGQVVMVF9QUkVGSVggPSAnbGV2ZWwtanMtJ1xuXG5mdW5jdGlvbiBMZXZlbCAobG9jYXRpb24sIG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIExldmVsKSkgcmV0dXJuIG5ldyBMZXZlbChsb2NhdGlvbiwgb3B0cylcblxuICBBYnN0cmFjdExldmVsRE9XTi5jYWxsKHRoaXMsIHtcbiAgICBidWZmZXJLZXlzOiBzdXBwb3J0LmJ1ZmZlcktleXMoaW5kZXhlZERCKSxcbiAgICBzbmFwc2hvdHM6IHRydWUsXG4gICAgcGVybWFuZW5jZTogdHJ1ZSxcbiAgICBjbGVhcjogdHJ1ZVxuICB9KVxuXG4gIG9wdHMgPSBvcHRzIHx8IHt9XG5cbiAgaWYgKHR5cGVvZiBsb2NhdGlvbiAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbnN0cnVjdG9yIHJlcXVpcmVzIGEgbG9jYXRpb24gc3RyaW5nIGFyZ3VtZW50JylcbiAgfVxuXG4gIHRoaXMubG9jYXRpb24gPSBsb2NhdGlvblxuICB0aGlzLnByZWZpeCA9IG9wdHMucHJlZml4ID09IG51bGwgPyBERUZBVUxUX1BSRUZJWCA6IG9wdHMucHJlZml4XG4gIHRoaXMudmVyc2lvbiA9IHBhcnNlSW50KG9wdHMudmVyc2lvbiB8fCAxLCAxMClcbn1cblxuaW5oZXJpdHMoTGV2ZWwsIEFic3RyYWN0TGV2ZWxET1dOKVxuXG5MZXZlbC5wcm90b3R5cGUudHlwZSA9ICdsZXZlbC1qcydcblxuTGV2ZWwucHJvdG90eXBlLl9vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciByZXEgPSBpbmRleGVkREIub3Blbih0aGlzLnByZWZpeCArIHRoaXMubG9jYXRpb24sIHRoaXMudmVyc2lvbilcbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2socmVxLmVycm9yIHx8IG5ldyBFcnJvcigndW5rbm93biBlcnJvcicpKVxuICB9XG5cbiAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLmRiID0gcmVxLnJlc3VsdFxuICAgIGNhbGxiYWNrKClcbiAgfVxuXG4gIHJlcS5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbiAoZXYpIHtcbiAgICB2YXIgZGIgPSBldi50YXJnZXQucmVzdWx0XG5cbiAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoc2VsZi5sb2NhdGlvbikpIHtcbiAgICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKHNlbGYubG9jYXRpb24pXG4gICAgfVxuICB9XG59XG5cbkxldmVsLnByb3RvdHlwZS5zdG9yZSA9IGZ1bmN0aW9uIChtb2RlKSB7XG4gIHZhciB0cmFuc2FjdGlvbiA9IHRoaXMuZGIudHJhbnNhY3Rpb24oW3RoaXMubG9jYXRpb25dLCBtb2RlKVxuICByZXR1cm4gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUodGhpcy5sb2NhdGlvbilcbn1cblxuTGV2ZWwucHJvdG90eXBlLmF3YWl0ID0gZnVuY3Rpb24gKHJlcXVlc3QsIGNhbGxiYWNrKSB7XG4gIHZhciB0cmFuc2FjdGlvbiA9IHJlcXVlc3QudHJhbnNhY3Rpb25cblxuICAvLyBUYWtlIGFkdmFudGFnZSBvZiB0aGUgZmFjdCB0aGF0IGEgbm9uLWNhbmNlbGVkIHJlcXVlc3QgZXJyb3IgYWJvcnRzXG4gIC8vIHRoZSB0cmFuc2FjdGlvbi4gSS5lLiBubyBuZWVkIHRvIGxpc3RlbiBmb3IgXCJyZXF1ZXN0Lm9uZXJyb3JcIi5cbiAgdHJhbnNhY3Rpb24ub25hYm9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayh0cmFuc2FjdGlvbi5lcnJvciB8fCBuZXcgRXJyb3IoJ2Fib3J0ZWQgYnkgdXNlcicpKVxuICB9XG5cbiAgdHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayhudWxsLCByZXF1ZXN0LnJlc3VsdClcbiAgfVxufVxuXG5MZXZlbC5wcm90b3R5cGUuX2dldCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzdG9yZSA9IHRoaXMuc3RvcmUoJ3JlYWRvbmx5JylcblxuICB0cnkge1xuICAgIHZhciByZXEgPSBzdG9yZS5nZXQoa2V5KVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gdGhpcy5fbmV4dFRpY2soY2FsbGJhY2ssIGVycilcbiAgfVxuXG4gIHRoaXMuYXdhaXQocmVxLCBmdW5jdGlvbiAoZXJyLCB2YWx1ZSkge1xuICAgIGlmIChlcnIpIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gJ05vdEZvdW5kJyBlcnJvciwgY29uc2lzdGVudCB3aXRoIExldmVsRE9XTiBBUElcbiAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ05vdEZvdW5kJykpXG4gICAgfVxuXG4gICAgY2FsbGJhY2sobnVsbCwgZGVzZXJpYWxpemUodmFsdWUsIG9wdGlvbnMuYXNCdWZmZXIpKVxuICB9KVxufVxuXG5MZXZlbC5wcm90b3R5cGUuX2RlbCA9IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzdG9yZSA9IHRoaXMuc3RvcmUoJ3JlYWR3cml0ZScpXG5cbiAgdHJ5IHtcbiAgICB2YXIgcmVxID0gc3RvcmUuZGVsZXRlKGtleSlcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrLCBlcnIpXG4gIH1cblxuICB0aGlzLmF3YWl0KHJlcSwgY2FsbGJhY2spXG59XG5cbkxldmVsLnByb3RvdHlwZS5fcHV0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzdG9yZSA9IHRoaXMuc3RvcmUoJ3JlYWR3cml0ZScpXG5cbiAgdHJ5IHtcbiAgICAvLyBXaWxsIHRocm93IGEgRGF0YUVycm9yIG9yIERhdGFDbG9uZUVycm9yIGlmIHRoZSBlbnZpcm9ubWVudFxuICAgIC8vIGRvZXMgbm90IHN1cHBvcnQgc2VyaWFsaXppbmcgdGhlIGtleSBvciB2YWx1ZSByZXNwZWN0aXZlbHkuXG4gICAgdmFyIHJlcSA9IHN0b3JlLnB1dCh2YWx1ZSwga2V5KVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gdGhpcy5fbmV4dFRpY2soY2FsbGJhY2ssIGVycilcbiAgfVxuXG4gIHRoaXMuYXdhaXQocmVxLCBjYWxsYmFjaylcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9zZXJpYWxpemVLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHJldHVybiBzZXJpYWxpemUoa2V5LCB0aGlzLnN1cHBvcnRzLmJ1ZmZlcktleXMpXG59XG5cbkxldmVsLnByb3RvdHlwZS5fc2VyaWFsaXplVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZSh2YWx1ZSwgdHJ1ZSlcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9pdGVyYXRvciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgSXRlcmF0b3IodGhpcywgdGhpcy5sb2NhdGlvbiwgb3B0aW9ucylcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9iYXRjaCA9IGZ1bmN0aW9uIChvcGVyYXRpb25zLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAob3BlcmF0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzLl9uZXh0VGljayhjYWxsYmFjaylcblxuICB2YXIgc3RvcmUgPSB0aGlzLnN0b3JlKCdyZWFkd3JpdGUnKVxuICB2YXIgdHJhbnNhY3Rpb24gPSBzdG9yZS50cmFuc2FjdGlvblxuICB2YXIgaW5kZXggPSAwXG4gIHZhciBlcnJvclxuXG4gIHRyYW5zYWN0aW9uLm9uYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soZXJyb3IgfHwgdHJhbnNhY3Rpb24uZXJyb3IgfHwgbmV3IEVycm9yKCdhYm9ydGVkIGJ5IHVzZXInKSlcbiAgfVxuXG4gIHRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soKVxuICB9XG5cbiAgLy8gV2FpdCBmb3IgYSByZXF1ZXN0IHRvIGNvbXBsZXRlIGJlZm9yZSBtYWtpbmcgdGhlIG5leHQsIHNhdmluZyBDUFUuXG4gIGZ1bmN0aW9uIGxvb3AgKCkge1xuICAgIHZhciBvcCA9IG9wZXJhdGlvbnNbaW5kZXgrK11cbiAgICB2YXIga2V5ID0gb3Aua2V5XG5cbiAgICB0cnkge1xuICAgICAgdmFyIHJlcSA9IG9wLnR5cGUgPT09ICdkZWwnID8gc3RvcmUuZGVsZXRlKGtleSkgOiBzdG9yZS5wdXQob3AudmFsdWUsIGtleSlcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGVycm9yID0gZXJyXG4gICAgICB0cmFuc2FjdGlvbi5hYm9ydCgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoaW5kZXggPCBvcGVyYXRpb25zLmxlbmd0aCkge1xuICAgICAgcmVxLm9uc3VjY2VzcyA9IGxvb3BcbiAgICB9XG4gIH1cblxuICBsb29wKClcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9jbGVhciA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuICB0cnkge1xuICAgIHZhciBrZXlSYW5nZSA9IGNyZWF0ZUtleVJhbmdlKG9wdGlvbnMpXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBUaGUgbG93ZXIga2V5IGlzIGdyZWF0ZXIgdGhhbiB0aGUgdXBwZXIga2V5LlxuICAgIC8vIEluZGV4ZWREQiB0aHJvd3MgYW4gZXJyb3IsIGJ1dCB3ZSdsbCBqdXN0IGRvIG5vdGhpbmcuXG4gICAgcmV0dXJuIHRoaXMuX25leHRUaWNrKGNhbGxiYWNrKVxuICB9XG5cbiAgaWYgKG9wdGlvbnMubGltaXQgPj0gMCkge1xuICAgIC8vIElEQk9iamVjdFN0b3JlI2RlbGV0ZShyYW5nZSkgZG9lc24ndCBoYXZlIHN1Y2ggYW4gb3B0aW9uLlxuICAgIC8vIEZhbGwgYmFjayB0byBjdXJzb3ItYmFzZWQgaW1wbGVtZW50YXRpb24uXG4gICAgcmV0dXJuIGNsZWFyKHRoaXMsIHRoaXMubG9jYXRpb24sIGtleVJhbmdlLCBvcHRpb25zLCBjYWxsYmFjaylcbiAgfVxuXG4gIHRyeSB7XG4gICAgdmFyIHN0b3JlID0gdGhpcy5zdG9yZSgncmVhZHdyaXRlJylcbiAgICB2YXIgcmVxID0ga2V5UmFuZ2UgPyBzdG9yZS5kZWxldGUoa2V5UmFuZ2UpIDogc3RvcmUuY2xlYXIoKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gdGhpcy5fbmV4dFRpY2soY2FsbGJhY2ssIGVycilcbiAgfVxuXG4gIHRoaXMuYXdhaXQocmVxLCBjYWxsYmFjaylcbn1cblxuTGV2ZWwucHJvdG90eXBlLl9jbG9zZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB0aGlzLmRiLmNsb3NlKClcbiAgdGhpcy5fbmV4dFRpY2soY2FsbGJhY2spXG59XG5cbi8vIE5PVEU6IHJlbW92ZSBpbiBhIG5leHQgbWFqb3IgcmVsZWFzZVxuTGV2ZWwucHJvdG90eXBlLnVwZ3JhZGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuc3RhdHVzICE9PSAnb3BlbicpIHtcbiAgICByZXR1cm4gdGhpcy5fbmV4dFRpY2soY2FsbGJhY2ssIG5ldyBFcnJvcignY2Fubm90IHVwZ3JhZGUoKSBiZWZvcmUgb3BlbigpJykpXG4gIH1cblxuICB2YXIgaXQgPSB0aGlzLml0ZXJhdG9yKClcbiAgdmFyIGJhdGNoT3B0aW9ucyA9IHt9XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGl0Ll9kZXNlcmlhbGl6ZUtleSA9IGl0Ll9kZXNlcmlhbGl6ZVZhbHVlID0gaWRlbnRpdHlcbiAgbmV4dCgpXG5cbiAgZnVuY3Rpb24gbmV4dCAoZXJyKSB7XG4gICAgaWYgKGVycikgcmV0dXJuIGZpbmlzaChlcnIpXG4gICAgaXQubmV4dChlYWNoKVxuICB9XG5cbiAgZnVuY3Rpb24gZWFjaCAoZXJyLCBrZXksIHZhbHVlKSB7XG4gICAgaWYgKGVyciB8fCBrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGZpbmlzaChlcnIpXG4gICAgfVxuXG4gICAgdmFyIG5ld0tleSA9IHNlbGYuX3NlcmlhbGl6ZUtleShkZXNlcmlhbGl6ZShrZXksIHRydWUpKVxuICAgIHZhciBuZXdWYWx1ZSA9IHNlbGYuX3NlcmlhbGl6ZVZhbHVlKGRlc2VyaWFsaXplKHZhbHVlLCB0cnVlKSlcblxuICAgIC8vIFRvIGJ5cGFzcyBzZXJpYWxpemF0aW9uIG9uIHRoZSBvbGQga2V5LCB1c2UgX2JhdGNoKCkgaW5zdGVhZCBvZiBiYXRjaCgpLlxuICAgIC8vIE5PVEU6IGlmIHdlIGRpc2FibGUgc25hcHNob3R0aW5nICgjODYpIHRoaXMgY291bGQgbGVhZCB0byBhIGxvb3Agb2ZcbiAgICAvLyBpbnNlcnRpbmcgYW5kIHRoZW4gaXRlcmF0aW5nIHRob3NlIHNhbWUgZW50cmllcywgYmVjYXVzZSB0aGUgbmV3IGtleXNcbiAgICAvLyBwb3NzaWJseSBzb3J0IGFmdGVyIHRoZSBvbGQga2V5cy5cbiAgICBzZWxmLl9iYXRjaChbXG4gICAgICB7IHR5cGU6ICdkZWwnLCBrZXk6IGtleSB9LFxuICAgICAgeyB0eXBlOiAncHV0Jywga2V5OiBuZXdLZXksIHZhbHVlOiBuZXdWYWx1ZSB9XG4gICAgXSwgYmF0Y2hPcHRpb25zLCBuZXh0KVxuICB9XG5cbiAgZnVuY3Rpb24gZmluaXNoIChlcnIpIHtcbiAgICBpdC5lbmQoZnVuY3Rpb24gKGVycjIpIHtcbiAgICAgIGNhbGxiYWNrKGVyciB8fCBlcnIyKVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBpZGVudGl0eSAoZGF0YSkge1xuICAgIHJldHVybiBkYXRhXG4gIH1cbn1cblxuTGV2ZWwuZGVzdHJveSA9IGZ1bmN0aW9uIChsb2NhdGlvbiwgcHJlZml4LCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIHByZWZpeCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gcHJlZml4XG4gICAgcHJlZml4ID0gREVGQVVMVF9QUkVGSVhcbiAgfVxuICB2YXIgcmVxdWVzdCA9IGluZGV4ZWREQi5kZWxldGVEYXRhYmFzZShwcmVmaXggKyBsb2NhdGlvbilcbiAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2soKVxuICB9XG4gIHJlcXVlc3Qub25lcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICBjYWxsYmFjayhlcnIpXG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnbGV2ZWwtcGFja2FnZXInKShyZXF1aXJlKCdsZXZlbC1qcycpKVxuIiwidmFyIHRvID0gcmVxdWlyZShcIi4vaW5kZXguanNcIilcblxuZnVuY3Rpb24gdG9BcnJheShhcnJheSwgZW5kKSB7XG4gICAgaWYgKHR5cGVvZiBhcnJheSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGVuZCA9IGFycmF5XG4gICAgICAgIGFycmF5ID0gW11cbiAgICB9XG5cbiAgICByZXR1cm4gdG8od3JpdGVBcnJheSwgZW5kQXJyYXkpXG5cbiAgICBmdW5jdGlvbiB3cml0ZUFycmF5KGNodW5rKSB7XG4gICAgICAgIGFycmF5LnB1c2goY2h1bmspXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5kQXJyYXkoKSB7XG4gICAgICAgIGVuZChhcnJheSlcbiAgICAgICAgdGhpcy5lbWl0KFwiZW5kXCIpXG4gICAgfVxufVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSB0b0FycmF5IiwidmFyIFN0cmVhbSA9IHJlcXVpcmUoXCJub2RlOnN0cmVhbVwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFdyaXRlU3RyZWFtXG5cbldyaXRlU3RyZWFtLnRvQXJyYXkgPSByZXF1aXJlKFwiLi9hcnJheS5qc1wiKVxuXG5mdW5jdGlvbiBXcml0ZVN0cmVhbSh3cml0ZSwgZW5kKSB7XG4gICAgdmFyIHN0cmVhbSA9IG5ldyBTdHJlYW0oKVxuICAgICAgICAsIGVuZGVkID0gZmFsc2VcblxuICAgIGVuZCA9IGVuZCB8fCBkZWZhdWx0RW5kXG5cbiAgICBzdHJlYW0ud3JpdGUgPSBoYW5kbGVXcml0ZVxuICAgIHN0cmVhbS5lbmQgPSBoYW5kbGVFbmRcblxuICAgIC8vIFN1cHBvcnQgMC44IHBpcGUgW0xFR0FDWV1cbiAgICBzdHJlYW0ud3JpdGFibGUgPSB0cnVlXG5cbiAgICByZXR1cm4gc3RyZWFtXG5cbiAgICBmdW5jdGlvbiBoYW5kbGVXcml0ZShjaHVuaykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gd3JpdGUuY2FsbChzdHJlYW0sIGNodW5rKVxuICAgICAgICByZXR1cm4gcmVzdWx0ID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZUVuZChjaHVuaykge1xuICAgICAgICBpZiAoZW5kZWQpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgZW5kZWQgPSB0cnVlXG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBzdHJlYW0ud3JpdGUoY2h1bmspXG4gICAgICAgIH1cbiAgICAgICAgZW5kLmNhbGwoc3RyZWFtKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZGVmYXVsdEVuZCgpIHtcbiAgICB0aGlzLmVtaXQoXCJmaW5pc2hcIilcbn1cbiIsInZhciBXcml0ZVN0cmVhbSA9IHJlcXVpcmUoXCJ3cml0ZS1zdHJlYW1cIilcblxubW9kdWxlLmV4cG9ydHMgPSBFbmRTdHJlYW1cblxuZnVuY3Rpb24gRW5kU3RyZWFtKHdyaXRlLCBlbmQpIHtcbiAgICB2YXIgY291bnRlciA9IDBcbiAgICAgICAgLCBlbmRlZCA9IGZhbHNlXG5cbiAgICBlbmQgPSBlbmQgfHwgbm9vcFxuXG4gICAgdmFyIHN0cmVhbSA9IFdyaXRlU3RyZWFtKGZ1bmN0aW9uIChjaHVuaykge1xuICAgICAgICBjb3VudGVyKytcbiAgICAgICAgd3JpdGUoY2h1bmssIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RyZWFtLmVtaXQoXCJlcnJvclwiLCBlcnIpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvdW50ZXItLVxuXG4gICAgICAgICAgICBpZiAoY291bnRlciA9PT0gMCAmJiBlbmRlZCkge1xuICAgICAgICAgICAgICAgIHN0cmVhbS5lbWl0KFwiZmluaXNoXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICBlbmRlZCA9IHRydWVcbiAgICAgICAgaWYgKGNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdChcImZpbmlzaFwiKVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBzdHJlYW1cbn1cblxuZnVuY3Rpb24gbm9vcCgpIHt9XG4iLCJ2YXIgRW5kU3RyZWFtID0gcmVxdWlyZShcImVuZC1zdHJlYW1cIilcblxubW9kdWxlLmV4cG9ydHMgPSBMZXZlbFdyaXRlU3RyZWFtXG5cbmZ1bmN0aW9uIExldmVsV3JpdGVTdHJlYW0oZGIpIHtcbiAgICByZXR1cm4gd3JpdGVTdHJlYW1cblxuICAgIGZ1bmN0aW9uIHdyaXRlU3RyZWFtKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblxuICAgICAgICB2YXIgcXVldWUgPSBbXVxuICAgICAgICAgICAgLCBzdHJlYW0gPSBFbmRTdHJlYW0od3JpdGUpXG5cbiAgICAgICAgcmV0dXJuIHN0cmVhbVxuXG4gICAgICAgIGZ1bmN0aW9uIHdyaXRlKGNodW5rLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soZHJhaW4pXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHF1ZXVlLnB1c2goY2h1bmspXG4gICAgICAgICAgICBzdHJlYW0ub25jZShcIl9kcmFpblwiLCBjYWxsYmFjaylcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRyYWluKCkge1xuICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHZhciBjaHVuayA9IHF1ZXVlWzBdXG4gICAgICAgICAgICAgICAgZGIucHV0KGNodW5rLmtleSwgY2h1bmsudmFsdWUsIG9wdGlvbnMsIGVtaXQpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBhcnIgPSBxdWV1ZS5tYXAoZnVuY3Rpb24gKGNodW5rKSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rLnR5cGUgPSBcInB1dFwiXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjaHVua1xuICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICBkYi5iYXRjaChhcnIsIG9wdGlvbnMsIGVtaXQpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHF1ZXVlLmxlbmd0aCA9IDBcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGVtaXQoZXJyKSB7XG4gICAgICAgICAgICBzdHJlYW0uZW1pdChcIl9kcmFpblwiLCBlcnIpXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgaXNMb2NhbElkLCB3aW5uaW5nUmV2IH0gZnJvbSAncG91Y2hkYi1tZXJnZSc7XG5pbXBvcnQgbGV2ZWwgZnJvbSAnbGV2ZWwnO1xuaW1wb3J0IHsgb2JqIGFzIHRocm91Z2ggfSBmcm9tICd0aHJvdWdoMic7XG5pbXBvcnQgTGV2ZWxXcml0ZVN0cmVhbSBmcm9tICdsZXZlbC13cml0ZS1zdHJlYW0nO1xuXG52YXIgc3RvcmVzID0gW1xuICAnZG9jdW1lbnQtc3RvcmUnLFxuICAnYnktc2VxdWVuY2UnLFxuICAnYXR0YWNoLXN0b3JlJyxcbiAgJ2F0dGFjaC1iaW5hcnktc3RvcmUnXG5dO1xuZnVuY3Rpb24gZm9ybWF0U2VxKG4pIHtcbiAgcmV0dXJuICgnMDAwMDAwMDAwMDAwMDAwMCcgKyBuKS5zbGljZSgtMTYpO1xufVxudmFyIFVQREFURV9TRVFfS0VZID0gJ19sb2NhbF9sYXN0X3VwZGF0ZV9zZXEnO1xudmFyIERPQ19DT1VOVF9LRVkgPSAnX2xvY2FsX2RvY19jb3VudCc7XG52YXIgVVVJRF9LRVkgPSAnX2xvY2FsX3V1aWQnO1xuXG52YXIgZG9NaWdyYXRpb25PbmUgPSBmdW5jdGlvbiAobmFtZSwgZGIsIGNhbGxiYWNrKSB7XG4gIC8vIGxvY2FsIHJlcXVpcmUgdG8gcHJldmVudCBjcmFzaGluZyBpZiBsZXZlbGRvd24gaXNuJ3QgaW5zdGFsbGVkLlxuICB2YXIgbGV2ZWxkb3duID0gcmVxdWlyZShcImxldmVsZG93blwiKTtcblxuICB2YXIgYmFzZSA9IHBhdGgucmVzb2x2ZShuYW1lKTtcbiAgZnVuY3Rpb24gbW92ZShzdG9yZSwgaW5kZXgsIGNiKSB7XG4gICAgdmFyIHN0b3JlUGF0aCA9IHBhdGguam9pbihiYXNlLCBzdG9yZSk7XG4gICAgdmFyIG9wdHM7XG4gICAgaWYgKGluZGV4ID09PSAzKSB7XG4gICAgICBvcHRzID0ge1xuICAgICAgICB2YWx1ZUVuY29kaW5nOiAnYmluYXJ5J1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0cyA9IHtcbiAgICAgICAgdmFsdWVFbmNvZGluZzogJ2pzb24nXG4gICAgICB9O1xuICAgIH1cbiAgICB2YXIgc3ViID0gZGIuc3VibGV2ZWwoc3RvcmUsIG9wdHMpO1xuICAgIHZhciBvcmlnID0gbGV2ZWwoc3RvcmVQYXRoLCBvcHRzKTtcbiAgICB2YXIgZnJvbSA9IG9yaWcuY3JlYXRlUmVhZFN0cmVhbSgpO1xuICAgIHZhciB3cml0ZVN0cmVhbSA9IG5ldyBMZXZlbFdyaXRlU3RyZWFtKHN1Yik7XG4gICAgdmFyIHRvID0gd3JpdGVTdHJlYW0oKTtcbiAgICBmcm9tLm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBvcmlnLmNsb3NlKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgY2IoZXJyLCBzdG9yZVBhdGgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgZnJvbS5waXBlKHRvKTtcbiAgfVxuICBmcy51bmxpbmsoYmFzZSArICcudXVpZCcsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9XG4gICAgdmFyIHRvZG8gPSA0O1xuICAgIHZhciBkb25lID0gW107XG4gICAgc3RvcmVzLmZvckVhY2goZnVuY3Rpb24gKHN0b3JlLCBpKSB7XG4gICAgICBtb3ZlKHN0b3JlLCBpLCBmdW5jdGlvbiAoZXJyLCBzdG9yZVBhdGgpIHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBkb25lLnB1c2goc3RvcmVQYXRoKTtcbiAgICAgICAgaWYgKCEoLS10b2RvKSkge1xuICAgICAgICAgIGRvbmUuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgbGV2ZWxkb3duLmRlc3Ryb3koaXRlbSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICBpZiAoKyt0b2RvID09PSBkb25lLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGZzLnJtZGlyKGJhc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn07XG52YXIgZG9NaWdyYXRpb25Ud28gPSBmdW5jdGlvbiAoZGIsIHN0b3JlcywgY2FsbGJhY2spIHtcbiAgdmFyIGJhdGNoZXMgPSBbXTtcbiAgc3RvcmVzLmJ5U2VxU3RvcmUuZ2V0KFVVSURfS0VZLCBmdW5jdGlvbiAoZXJyLCB2YWx1ZSkge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIC8vIG5vIHV1aWQga2V5LCBzbyBkb24ndCBuZWVkIHRvIG1pZ3JhdGU7XG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9XG4gICAgYmF0Y2hlcy5wdXNoKHtcbiAgICAgIGtleTogVVVJRF9LRVksXG4gICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICBwcmVmaXg6IHN0b3Jlcy5tZXRhU3RvcmUsXG4gICAgICB0eXBlOiAncHV0JyxcbiAgICAgIHZhbHVlRW5jb2Rpbmc6ICdqc29uJ1xuICAgIH0pO1xuICAgIGJhdGNoZXMucHVzaCh7XG4gICAgICBrZXk6IFVVSURfS0VZLFxuICAgICAgcHJlZml4OiBzdG9yZXMuYnlTZXFTdG9yZSxcbiAgICAgIHR5cGU6ICdkZWwnXG4gICAgfSk7XG4gICAgc3RvcmVzLmJ5U2VxU3RvcmUuZ2V0KERPQ19DT1VOVF9LRVksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgLy8gaWYgbm8gZG9jIGNvdW50IGtleSxcbiAgICAgICAgLy8ganVzdCBza2lwXG4gICAgICAgIC8vIHdlIGNhbiBsaXZlIHdpdGggdGhpc1xuICAgICAgICBiYXRjaGVzLnB1c2goe1xuICAgICAgICAgIGtleTogRE9DX0NPVU5UX0tFWSxcbiAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgcHJlZml4OiBzdG9yZXMubWV0YVN0b3JlLFxuICAgICAgICAgIHR5cGU6ICdwdXQnLFxuICAgICAgICAgIHZhbHVlRW5jb2Rpbmc6ICdqc29uJ1xuICAgICAgICB9KTtcbiAgICAgICAgYmF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICBrZXk6IERPQ19DT1VOVF9LRVksXG4gICAgICAgICAgcHJlZml4OiBzdG9yZXMuYnlTZXFTdG9yZSxcbiAgICAgICAgICB0eXBlOiAnZGVsJ1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHN0b3Jlcy5ieVNlcVN0b3JlLmdldChVUERBVEVfU0VRX0tFWSwgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgLy8gaWYgbm8gVVBEQVRFX1NFUV9LRVlcbiAgICAgICAgICAvLyBqdXN0IHNraXBcbiAgICAgICAgICAvLyB3ZSd2ZSBnb25lIHRvIGZhciB0byBzdG9wLlxuICAgICAgICAgIGJhdGNoZXMucHVzaCh7XG4gICAgICAgICAgICBrZXk6IFVQREFURV9TRVFfS0VZLFxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgcHJlZml4OiBzdG9yZXMubWV0YVN0b3JlLFxuICAgICAgICAgICAgdHlwZTogJ3B1dCcsXG4gICAgICAgICAgICB2YWx1ZUVuY29kaW5nOiAnanNvbidcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBiYXRjaGVzLnB1c2goe1xuICAgICAgICAgICAga2V5OiBVUERBVEVfU0VRX0tFWSxcbiAgICAgICAgICAgIHByZWZpeDogc3RvcmVzLmJ5U2VxU3RvcmUsXG4gICAgICAgICAgICB0eXBlOiAnZGVsJ1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciBkZWxldGVkU2VxcyA9IHt9O1xuICAgICAgICBzdG9yZXMuZG9jU3RvcmUuY3JlYXRlUmVhZFN0cmVhbSh7XG4gICAgICAgICAgc3RhcnRLZXk6ICdfJyxcbiAgICAgICAgICBlbmRLZXk6ICdfXFx4RkYnXG4gICAgICAgIH0pLnBpcGUodGhyb3VnaChmdW5jdGlvbiAoY2gsIF8sIG5leHQpIHtcbiAgICAgICAgICBpZiAoIWlzTG9jYWxJZChjaC5rZXkpKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBiYXRjaGVzLnB1c2goe1xuICAgICAgICAgICAga2V5OiBjaC5rZXksXG4gICAgICAgICAgICBwcmVmaXg6IHN0b3Jlcy5kb2NTdG9yZSxcbiAgICAgICAgICAgIHR5cGU6ICdkZWwnXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdmFyIHdpbm5lciA9IHdpbm5pbmdSZXYoY2gudmFsdWUpO1xuICAgICAgICAgIE9iamVjdC5rZXlzKGNoLnZhbHVlLnJldl9tYXApLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgaWYgKGtleSAhPT0gJ3dpbm5lcicpIHtcbiAgICAgICAgICAgICAgdGhpcy5wdXNoKGZvcm1hdFNlcShjaC52YWx1ZS5yZXZfbWFwW2tleV0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICB2YXIgd2lubmluZ1NlcSA9IGNoLnZhbHVlLnJldl9tYXBbd2lubmVyXTtcbiAgICAgICAgICBzdG9yZXMuYnlTZXFTdG9yZS5nZXQoZm9ybWF0U2VxKHdpbm5pbmdTZXEpLCBmdW5jdGlvbiAoZXJyLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgYmF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBrZXk6IGNoLmtleSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICAgICAgcHJlZml4OiBzdG9yZXMubG9jYWxTdG9yZSxcbiAgICAgICAgICAgICAgICB0eXBlOiAncHV0JyxcbiAgICAgICAgICAgICAgICB2YWx1ZUVuY29kaW5nOiAnanNvbidcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgfSkpLnBpcGUodGhyb3VnaChmdW5jdGlvbiAoc2VxLCBfLCBuZXh0KSB7XG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgICAgaWYgKGRlbGV0ZWRTZXFzW3NlcV0pIHtcbiAgICAgICAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlbGV0ZWRTZXFzW3NlcV0gPSB0cnVlO1xuICAgICAgICAgIHN0b3Jlcy5ieVNlcVN0b3JlLmdldChzZXEsIGZ1bmN0aW9uIChlcnIsIHJlc3ApIHtcbiAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICAgICAgaWYgKGVyciB8fCAhaXNMb2NhbElkKHJlc3AuX2lkKSkge1xuICAgICAgICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICAgICAga2V5OiBzZXEsXG4gICAgICAgICAgICAgIHByZWZpeDogc3RvcmVzLmJ5U2VxU3RvcmUsXG4gICAgICAgICAgICAgIHR5cGU6ICdkZWwnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGRiLmJhdGNoKGJhdGNoZXMsIGNhbGxiYWNrKTtcbiAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG59O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGRvTWlncmF0aW9uT25lOiBkb01pZ3JhdGlvbk9uZSxcbiAgZG9NaWdyYXRpb25Ud286IGRvTWlncmF0aW9uVHdvXG59O1xuIiwiaW1wb3J0IENvcmVMZXZlbFBvdWNoIGZyb20gJ3BvdWNoZGItYWRhcHRlci1sZXZlbGRiLWNvcmUnO1xuXG5pbXBvcnQgcmVxdWlyZUxldmVsZG93biBmcm9tICcuL3JlcXVpcmVMZXZlbGRvd24nO1xuaW1wb3J0IG1pZ3JhdGUgZnJvbSAnLi9taWdyYXRlJztcblxuZnVuY3Rpb24gTGV2ZWxEb3duUG91Y2gob3B0cywgY2FsbGJhY2spIHtcblxuICAvLyBVc2VycyBjYW4gcGFzcyBpbiB0aGVpciBvd24gbGV2ZWxkb3duIGFsdGVybmF0aXZlIGhlcmUsIGluIHdoaWNoIGNhc2VcbiAgLy8gaXQgb3ZlcnJpZGVzIHRoZSBkZWZhdWx0IG9uZS4gKFRoaXMgaXMgaW4gYWRkaXRpb24gdG8gdGhlIGN1c3RvbSBidWlsZHMuKVxuICB2YXIgbGV2ZWxkb3duID0gb3B0cy5kYjtcblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICBpZiAoIWxldmVsZG93bikge1xuICAgIGxldmVsZG93biA9IHJlcXVpcmVMZXZlbGRvd24oKTtcblxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmIChsZXZlbGRvd24gaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGxldmVsZG93bik7XG4gICAgfVxuICB9XG5cbiAgdmFyIF9vcHRzID0gT2JqZWN0LmFzc2lnbih7XG4gICAgZGI6IGxldmVsZG93bixcbiAgICBtaWdyYXRlOiBtaWdyYXRlXG4gIH0sIG9wdHMpO1xuXG4gIENvcmVMZXZlbFBvdWNoLmNhbGwodGhpcywgX29wdHMsIGNhbGxiYWNrKTtcbn1cblxuLy8gb3ZlcnJpZGVzIGZvciBub3JtYWwgTGV2ZWxEQiBiZWhhdmlvciBvbiBOb2RlXG5MZXZlbERvd25Qb3VjaC52YWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWU7XG59O1xuTGV2ZWxEb3duUG91Y2gudXNlX3ByZWZpeCA9IGZhbHNlO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoUG91Y2hEQikge1xuICBQb3VjaERCLmFkYXB0ZXIoJ2xldmVsZGInLCBMZXZlbERvd25Qb3VjaCwgdHJ1ZSk7XG59Il0sIm5hbWVzIjpbIm5leHRUaWNrQnJvd3NlciIsInJlcXVpcmUkJDAiLCJuZXh0VGljayIsIkFic3RyYWN0SXRlcmF0b3IiLCJhYnN0cmFjdEl0ZXJhdG9yIiwiQWJzdHJhY3RDaGFpbmVkQmF0Y2giLCJhYnN0cmFjdENoYWluZWRCYXRjaCIsInh0ZW5kIiwic3VwcG9ydHMiLCJyZXF1aXJlJCQxIiwiQnVmZmVyIiwicmVxdWlyZSQkMiIsInJlcXVpcmUkJDMiLCJyZXF1aXJlJCQ0IiwicmVxdWlyZSQkNSIsImhhc093blByb3BlcnR5IiwicmFuZ2VPcHRpb25zIiwiQWJzdHJhY3RMZXZlbERPV04iLCJjbGVhblJhbmdlT3B0aW9ucyIsImlzUmFuZ2VPcHRpb24iLCJhYnN0cmFjdExldmVsZG93biIsImluaGVyaXRzIiwiSXRlcmF0b3IiLCJnbG9iYWwiLCJkZXNlcmlhbGl6ZSIsImNyZWF0ZUtleVJhbmdlIiwic2VyaWFsaXplIiwiY2xlYXIiLCJyZXF1aXJlJCQ2IiwicmVxdWlyZSQkNyIsIkVuZFN0cmVhbSIsIkxldmVsV3JpdGVTdHJlYW0iLCJ0aHJvdWdoIiwiQ29yZUxldmVsUG91Y2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0EsSUFBSSxnQkFBZ0IsR0FBRyxZQUFZO0FBQ25DLEVBQUUsSUFBSTtBQUNOLElBQUksT0FBTyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDaEMsR0FBRyxDQUFDLE9BQU8sR0FBRyxFQUFFO0FBQ2hCO0FBQ0EsSUFBSSxHQUFHLEdBQUcsR0FBRyxJQUFJLHdCQUF3QixDQUFDO0FBQzFDLElBQUksSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLGtCQUFrQixFQUFFO0FBQ3pDO0FBQ0EsTUFBTSxP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QUNBO0FBQ0EsRUFBRSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO0FBQzFCO0FBQ0E7QUFDQSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDbEIsSUFBSSxTQUFTLEdBQUcsZ0JBQWdCLEVBQUUsQ0FBQztBQUNuQztBQUNBO0FBQ0EsSUFBSSxJQUFJLFNBQVMsWUFBWSxLQUFLLEVBQUU7QUFDcEMsTUFBTSxPQUFPLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNqQyxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQzVCLElBQUksRUFBRSxFQUFFLFNBQVM7QUFDakIsSUFBSSxPQUFPLEVBQUUsT0FBTztBQUNwQixHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDWDtBQUNBLEVBQUVDLFlBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBQ0Q7QUFDQTtBQUNBLGNBQWMsQ0FBQyxLQUFLLEdBQUcsWUFBWTtBQUNuQyxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyxDQUFDO0FBQ0YsY0FBYyxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDbEM7QUFDZSxtQkFBUSxFQUFFLE9BQU8sRUFBRTtBQUNsQyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNuRDs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMTYsMTcsMTgsMTksMjAsMjEsMjIsMjMsMjRdfQ==
