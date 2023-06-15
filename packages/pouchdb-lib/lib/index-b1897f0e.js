import levelup from 'levelup';
import sublevelPouch from './sublevel-pouchdb.js';
import Stream from 'stream';
import { c as commonjsGlobal } from './_commonjsHelpers-7d1333e8.js';
import require$$2 from 'events';
import require$$0 from 'buffer';
import require$$1 from 'util';
import Deque from 'double-ended-queue';
import PouchDB from './pouchdb-core.js';
import { changesHandler as Changes, uuid, filterChange } from './pouchdb-utils.js';
import { a as allDocsKeysQuery } from './allDocsKeysQuery-65aa064d.js';
import { p as parseDoc } from './parseDoc-a0994e12.js';
import { a as collectConflicts } from './collectConflicts-ad0b7c70.js';
import { t as traverseRevTree, w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { l as latest, c as compactTree } from './latest-0521537f.js';
import { a as isLocalId, i as isDeleted } from './isLocalId-d067de54.js';
import { b as binStringToBluffer } from './binaryStringToBlobOrBuffer-39ece35b.js';
import { createError, MISSING_DOC, NOT_OPEN, REV_CONFLICT, MISSING_STUB, BAD_ARG } from './pouchdb-errors.js';
import { b as binaryMd5 } from './binaryMd5-601b2421.js';
import 'crypto';
import { p as processDocs } from './processDocs-2980e64a.js';
import { s as safeJsonStringify, a as safeJsonParse } from './safeJsonStringify-a65d9a0c.js';
import { t as typedBuffer } from './typedBuffer-a8220a49.js';
import { f as functionName } from './functionName-56a2e70f.js';
import 'node:events';
import { n as nextTick } from './nextTick-ea093886.js';
import 'clone-buffer';
import { c as clone } from './clone-3530a126.js';

var through2$1 = {exports: {}};

var readable = {exports: {}};

var processNextickArgs = {exports: {}};

var hasRequiredProcessNextickArgs;

function requireProcessNextickArgs () {
	if (hasRequiredProcessNextickArgs) return processNextickArgs.exports;
	hasRequiredProcessNextickArgs = 1;

	if (typeof process === 'undefined' ||
	    !process.version ||
	    process.version.indexOf('v0.') === 0 ||
	    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
	  processNextickArgs.exports = { nextTick: nextTick };
	} else {
	  processNextickArgs.exports = process;
	}

	function nextTick(fn, arg1, arg2, arg3) {
	  if (typeof fn !== 'function') {
	    throw new TypeError('"callback" argument must be a function');
	  }
	  var len = arguments.length;
	  var args, i;
	  switch (len) {
	  case 0:
	  case 1:
	    return process.nextTick(fn);
	  case 2:
	    return process.nextTick(function afterTickOne() {
	      fn.call(null, arg1);
	    });
	  case 3:
	    return process.nextTick(function afterTickTwo() {
	      fn.call(null, arg1, arg2);
	    });
	  case 4:
	    return process.nextTick(function afterTickThree() {
	      fn.call(null, arg1, arg2, arg3);
	    });
	  default:
	    args = new Array(len - 1);
	    i = 0;
	    while (i < args.length) {
	      args[i++] = arguments[i];
	    }
	    return process.nextTick(function afterTick() {
	      fn.apply(null, args);
	    });
	  }
	}
	return processNextickArgs.exports;
}

var isarray;
var hasRequiredIsarray;

function requireIsarray () {
	if (hasRequiredIsarray) return isarray;
	hasRequiredIsarray = 1;
	var toString = {}.toString;

	isarray = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};
	return isarray;
}

var stream;
var hasRequiredStream;

function requireStream () {
	if (hasRequiredStream) return stream;
	hasRequiredStream = 1;
	stream = Stream;
	return stream;
}

var safeBuffer = {exports: {}};

/* eslint-disable node/no-deprecated-api */
safeBuffer.exports;

var hasRequiredSafeBuffer;

function requireSafeBuffer () {
	if (hasRequiredSafeBuffer) return safeBuffer.exports;
	hasRequiredSafeBuffer = 1;
	(function (module, exports) {
		var buffer = require$$0;
		var Buffer = buffer.Buffer;

		// alternative to using Object.keys for old browsers
		function copyProps (src, dst) {
		  for (var key in src) {
		    dst[key] = src[key];
		  }
		}
		if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
		  module.exports = buffer;
		} else {
		  // Copy properties from require('buffer')
		  copyProps(buffer, exports);
		  exports.Buffer = SafeBuffer;
		}

		function SafeBuffer (arg, encodingOrOffset, length) {
		  return Buffer(arg, encodingOrOffset, length)
		}

		// Copy static methods from Buffer
		copyProps(Buffer, SafeBuffer);

		SafeBuffer.from = function (arg, encodingOrOffset, length) {
		  if (typeof arg === 'number') {
		    throw new TypeError('Argument must not be a number')
		  }
		  return Buffer(arg, encodingOrOffset, length)
		};

		SafeBuffer.alloc = function (size, fill, encoding) {
		  if (typeof size !== 'number') {
		    throw new TypeError('Argument must be a number')
		  }
		  var buf = Buffer(size);
		  if (fill !== undefined) {
		    if (typeof encoding === 'string') {
		      buf.fill(fill, encoding);
		    } else {
		      buf.fill(fill);
		    }
		  } else {
		    buf.fill(0);
		  }
		  return buf
		};

		SafeBuffer.allocUnsafe = function (size) {
		  if (typeof size !== 'number') {
		    throw new TypeError('Argument must be a number')
		  }
		  return Buffer(size)
		};

		SafeBuffer.allocUnsafeSlow = function (size) {
		  if (typeof size !== 'number') {
		    throw new TypeError('Argument must be a number')
		  }
		  return buffer.SlowBuffer(size)
		}; 
	} (safeBuffer, safeBuffer.exports));
	return safeBuffer.exports;
}

var util = {};

var hasRequiredUtil;

function requireUtil () {
	if (hasRequiredUtil) return util;
	hasRequiredUtil = 1;
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

	// NOTE: These type checking functions intentionally don't use `instanceof`
	// because it is fragile and can be easily faked with `Object.create()`.

	function isArray(arg) {
	  if (Array.isArray) {
	    return Array.isArray(arg);
	  }
	  return objectToString(arg) === '[object Array]';
	}
	util.isArray = isArray;

	function isBoolean(arg) {
	  return typeof arg === 'boolean';
	}
	util.isBoolean = isBoolean;

	function isNull(arg) {
	  return arg === null;
	}
	util.isNull = isNull;

	function isNullOrUndefined(arg) {
	  return arg == null;
	}
	util.isNullOrUndefined = isNullOrUndefined;

	function isNumber(arg) {
	  return typeof arg === 'number';
	}
	util.isNumber = isNumber;

	function isString(arg) {
	  return typeof arg === 'string';
	}
	util.isString = isString;

	function isSymbol(arg) {
	  return typeof arg === 'symbol';
	}
	util.isSymbol = isSymbol;

	function isUndefined(arg) {
	  return arg === void 0;
	}
	util.isUndefined = isUndefined;

	function isRegExp(re) {
	  return objectToString(re) === '[object RegExp]';
	}
	util.isRegExp = isRegExp;

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}
	util.isObject = isObject;

	function isDate(d) {
	  return objectToString(d) === '[object Date]';
	}
	util.isDate = isDate;

	function isError(e) {
	  return (objectToString(e) === '[object Error]' || e instanceof Error);
	}
	util.isError = isError;

	function isFunction(arg) {
	  return typeof arg === 'function';
	}
	util.isFunction = isFunction;

	function isPrimitive(arg) {
	  return arg === null ||
	         typeof arg === 'boolean' ||
	         typeof arg === 'number' ||
	         typeof arg === 'string' ||
	         typeof arg === 'symbol' ||  // ES6 symbol
	         typeof arg === 'undefined';
	}
	util.isPrimitive = isPrimitive;

	util.isBuffer = require$$0.Buffer.isBuffer;

	function objectToString(o) {
	  return Object.prototype.toString.call(o);
	}
	return util;
}

var inherits$1 = {exports: {}};

var inherits_browser = {exports: {}};

var hasRequiredInherits_browser;

function requireInherits_browser () {
	if (hasRequiredInherits_browser) return inherits_browser.exports;
	hasRequiredInherits_browser = 1;
	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      ctor.prototype = Object.create(superCtor.prototype, {
	        constructor: {
	          value: ctor,
	          enumerable: false,
	          writable: true,
	          configurable: true
	        }
	      });
	    }
	  };
	} else {
	  // old school shim for old browsers
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      var TempCtor = function () {};
	      TempCtor.prototype = superCtor.prototype;
	      ctor.prototype = new TempCtor();
	      ctor.prototype.constructor = ctor;
	    }
	  };
	}
	return inherits_browser.exports;
}

var hasRequiredInherits;

function requireInherits () {
	if (hasRequiredInherits) return inherits$1.exports;
	hasRequiredInherits = 1;
	try {
	  var util = require('util');
	  /* istanbul ignore next */
	  if (typeof util.inherits !== 'function') throw '';
	  inherits$1.exports = util.inherits;
	} catch (e) {
	  /* istanbul ignore next */
	  inherits$1.exports = requireInherits_browser();
	}
	return inherits$1.exports;
}

var BufferList = {exports: {}};

BufferList.exports;

var hasRequiredBufferList;

function requireBufferList () {
	if (hasRequiredBufferList) return BufferList.exports;
	hasRequiredBufferList = 1;
	(function (module) {

		function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

		var Buffer = requireSafeBuffer().Buffer;
		var util = require$$1;

		function copyBuffer(src, target, offset) {
		  src.copy(target, offset);
		}

		module.exports = function () {
		  function BufferList() {
		    _classCallCheck(this, BufferList);

		    this.head = null;
		    this.tail = null;
		    this.length = 0;
		  }

		  BufferList.prototype.push = function push(v) {
		    var entry = { data: v, next: null };
		    if (this.length > 0) this.tail.next = entry;else this.head = entry;
		    this.tail = entry;
		    ++this.length;
		  };

		  BufferList.prototype.unshift = function unshift(v) {
		    var entry = { data: v, next: this.head };
		    if (this.length === 0) this.tail = entry;
		    this.head = entry;
		    ++this.length;
		  };

		  BufferList.prototype.shift = function shift() {
		    if (this.length === 0) return;
		    var ret = this.head.data;
		    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
		    --this.length;
		    return ret;
		  };

		  BufferList.prototype.clear = function clear() {
		    this.head = this.tail = null;
		    this.length = 0;
		  };

		  BufferList.prototype.join = function join(s) {
		    if (this.length === 0) return '';
		    var p = this.head;
		    var ret = '' + p.data;
		    while (p = p.next) {
		      ret += s + p.data;
		    }return ret;
		  };

		  BufferList.prototype.concat = function concat(n) {
		    if (this.length === 0) return Buffer.alloc(0);
		    var ret = Buffer.allocUnsafe(n >>> 0);
		    var p = this.head;
		    var i = 0;
		    while (p) {
		      copyBuffer(p.data, ret, i);
		      i += p.data.length;
		      p = p.next;
		    }
		    return ret;
		  };

		  return BufferList;
		}();

		if (util && util.inspect && util.inspect.custom) {
		  module.exports.prototype[util.inspect.custom] = function () {
		    var obj = util.inspect({ length: this.length });
		    return this.constructor.name + ' ' + obj;
		  };
		} 
	} (BufferList));
	return BufferList.exports;
}

var destroy_1;
var hasRequiredDestroy;

function requireDestroy () {
	if (hasRequiredDestroy) return destroy_1;
	hasRequiredDestroy = 1;

	/*<replacement>*/

	var pna = requireProcessNextickArgs();
	/*</replacement>*/

	// undocumented cb() API, needed for core, not for public API
	function destroy(err, cb) {
	  var _this = this;

	  var readableDestroyed = this._readableState && this._readableState.destroyed;
	  var writableDestroyed = this._writableState && this._writableState.destroyed;

	  if (readableDestroyed || writableDestroyed) {
	    if (cb) {
	      cb(err);
	    } else if (err) {
	      if (!this._writableState) {
	        pna.nextTick(emitErrorNT, this, err);
	      } else if (!this._writableState.errorEmitted) {
	        this._writableState.errorEmitted = true;
	        pna.nextTick(emitErrorNT, this, err);
	      }
	    }

	    return this;
	  }

	  // we set destroyed to true before firing error callbacks in order
	  // to make it re-entrance safe in case destroy() is called within callbacks

	  if (this._readableState) {
	    this._readableState.destroyed = true;
	  }

	  // if this is a duplex stream mark the writable part as destroyed as well
	  if (this._writableState) {
	    this._writableState.destroyed = true;
	  }

	  this._destroy(err || null, function (err) {
	    if (!cb && err) {
	      if (!_this._writableState) {
	        pna.nextTick(emitErrorNT, _this, err);
	      } else if (!_this._writableState.errorEmitted) {
	        _this._writableState.errorEmitted = true;
	        pna.nextTick(emitErrorNT, _this, err);
	      }
	    } else if (cb) {
	      cb(err);
	    }
	  });

	  return this;
	}

	function undestroy() {
	  if (this._readableState) {
	    this._readableState.destroyed = false;
	    this._readableState.reading = false;
	    this._readableState.ended = false;
	    this._readableState.endEmitted = false;
	  }

	  if (this._writableState) {
	    this._writableState.destroyed = false;
	    this._writableState.ended = false;
	    this._writableState.ending = false;
	    this._writableState.finalCalled = false;
	    this._writableState.prefinished = false;
	    this._writableState.finished = false;
	    this._writableState.errorEmitted = false;
	  }
	}

	function emitErrorNT(self, err) {
	  self.emit('error', err);
	}

	destroy_1 = {
	  destroy: destroy,
	  undestroy: undestroy
	};
	return destroy_1;
}

var node;
var hasRequiredNode;

function requireNode () {
	if (hasRequiredNode) return node;
	hasRequiredNode = 1;
	/**
	 * For Node.js, simply re-export the core `util.deprecate` function.
	 */

	node = require$$1.deprecate;
	return node;
}

var _stream_writable;
var hasRequired_stream_writable;

function require_stream_writable () {
	if (hasRequired_stream_writable) return _stream_writable;
	hasRequired_stream_writable = 1;

	/*<replacement>*/

	var pna = requireProcessNextickArgs();
	/*</replacement>*/

	_stream_writable = Writable;

	// It seems a linked list but it is not
	// there will be only 2 of these for each stream
	function CorkedRequest(state) {
	  var _this = this;

	  this.next = null;
	  this.entry = null;
	  this.finish = function () {
	    onCorkedFinish(_this, state);
	  };
	}
	/* </replacement> */

	/*<replacement>*/
	var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
	/*</replacement>*/

	/*<replacement>*/
	var Duplex;
	/*</replacement>*/

	Writable.WritableState = WritableState;

	/*<replacement>*/
	var util = Object.create(requireUtil());
	util.inherits = requireInherits();
	/*</replacement>*/

	/*<replacement>*/
	var internalUtil = {
	  deprecate: requireNode()
	};
	/*</replacement>*/

	/*<replacement>*/
	var Stream = requireStream();
	/*</replacement>*/

	/*<replacement>*/

	var Buffer = requireSafeBuffer().Buffer;
	var OurUint8Array = (typeof commonjsGlobal !== 'undefined' ? commonjsGlobal : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {}).Uint8Array || function () {};
	function _uint8ArrayToBuffer(chunk) {
	  return Buffer.from(chunk);
	}
	function _isUint8Array(obj) {
	  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
	}

	/*</replacement>*/

	var destroyImpl = requireDestroy();

	util.inherits(Writable, Stream);

	function nop() {}

	function WritableState(options, stream) {
	  Duplex = Duplex || require_stream_duplex();

	  options = options || {};

	  // Duplex streams are both readable and writable, but share
	  // the same options object.
	  // However, some cases require setting options to different
	  // values for the readable and the writable sides of the duplex stream.
	  // These options can be provided separately as readableXXX and writableXXX.
	  var isDuplex = stream instanceof Duplex;

	  // object stream flag to indicate whether or not this stream
	  // contains buffers or objects.
	  this.objectMode = !!options.objectMode;

	  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

	  // the point at which write() starts returning false
	  // Note: 0 is a valid value, means that we always return false if
	  // the entire buffer is not flushed immediately on write()
	  var hwm = options.highWaterMark;
	  var writableHwm = options.writableHighWaterMark;
	  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

	  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;else this.highWaterMark = defaultHwm;

	  // cast to ints.
	  this.highWaterMark = Math.floor(this.highWaterMark);

	  // if _final has been called
	  this.finalCalled = false;

	  // drain event flag.
	  this.needDrain = false;
	  // at the start of calling end()
	  this.ending = false;
	  // when end() has been called, and returned
	  this.ended = false;
	  // when 'finish' is emitted
	  this.finished = false;

	  // has it been destroyed
	  this.destroyed = false;

	  // should we decode strings into buffers before passing to _write?
	  // this is here so that some node-core streams can optimize string
	  // handling at a lower level.
	  var noDecode = options.decodeStrings === false;
	  this.decodeStrings = !noDecode;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // not an actual buffer we keep track of, but a measurement
	  // of how much we're waiting to get pushed to some underlying
	  // socket or file.
	  this.length = 0;

	  // a flag to see when we're in the middle of a write.
	  this.writing = false;

	  // when true all writes will be buffered until .uncork() call
	  this.corked = 0;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // a flag to know if we're processing previously buffered items, which
	  // may call the _write() callback in the same tick, so that we don't
	  // end up in an overlapped onwrite situation.
	  this.bufferProcessing = false;

	  // the callback that's passed to _write(chunk,cb)
	  this.onwrite = function (er) {
	    onwrite(stream, er);
	  };

	  // the callback that the user supplies to write(chunk,encoding,cb)
	  this.writecb = null;

	  // the amount that is being written when _write is called.
	  this.writelen = 0;

	  this.bufferedRequest = null;
	  this.lastBufferedRequest = null;

	  // number of pending user-supplied write callbacks
	  // this must be 0 before 'finish' can be emitted
	  this.pendingcb = 0;

	  // emit prefinish if the only thing we're waiting for is _write cbs
	  // This is relevant for synchronous Transform streams
	  this.prefinished = false;

	  // True if the error was already emitted and should not be thrown again
	  this.errorEmitted = false;

	  // count buffered requests
	  this.bufferedRequestCount = 0;

	  // allocate the first CorkedRequest, there is always
	  // one allocated and free to use, and we maintain at most two
	  this.corkedRequestsFree = new CorkedRequest(this);
	}

	WritableState.prototype.getBuffer = function getBuffer() {
	  var current = this.bufferedRequest;
	  var out = [];
	  while (current) {
	    out.push(current);
	    current = current.next;
	  }
	  return out;
	};

	(function () {
	  try {
	    Object.defineProperty(WritableState.prototype, 'buffer', {
	      get: internalUtil.deprecate(function () {
	        return this.getBuffer();
	      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
	    });
	  } catch (_) {}
	})();

	// Test _writableState for inheritance to account for Duplex streams,
	// whose prototype chain only points to Readable.
	var realHasInstance;
	if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
	  realHasInstance = Function.prototype[Symbol.hasInstance];
	  Object.defineProperty(Writable, Symbol.hasInstance, {
	    value: function (object) {
	      if (realHasInstance.call(this, object)) return true;
	      if (this !== Writable) return false;

	      return object && object._writableState instanceof WritableState;
	    }
	  });
	} else {
	  realHasInstance = function (object) {
	    return object instanceof this;
	  };
	}

	function Writable(options) {
	  Duplex = Duplex || require_stream_duplex();

	  // Writable ctor is applied to Duplexes, too.
	  // `realHasInstance` is necessary because using plain `instanceof`
	  // would return false, as no `_writableState` property is attached.

	  // Trying to use the custom `instanceof` for Writable here will also break the
	  // Node.js LazyTransform implementation, which has a non-trivial getter for
	  // `_writableState` that would lead to infinite recursion.
	  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
	    return new Writable(options);
	  }

	  this._writableState = new WritableState(options, this);

	  // legacy.
	  this.writable = true;

	  if (options) {
	    if (typeof options.write === 'function') this._write = options.write;

	    if (typeof options.writev === 'function') this._writev = options.writev;

	    if (typeof options.destroy === 'function') this._destroy = options.destroy;

	    if (typeof options.final === 'function') this._final = options.final;
	  }

	  Stream.call(this);
	}

	// Otherwise people can pipe Writable streams, which is just wrong.
	Writable.prototype.pipe = function () {
	  this.emit('error', new Error('Cannot pipe, not readable'));
	};

	function writeAfterEnd(stream, cb) {
	  var er = new Error('write after end');
	  // TODO: defer error events consistently everywhere, not just the cb
	  stream.emit('error', er);
	  pna.nextTick(cb, er);
	}

	// Checks that a user-supplied chunk is valid, especially for the particular
	// mode the stream is in. Currently this means that `null` is never accepted
	// and undefined/non-string values are only allowed in object mode.
	function validChunk(stream, state, chunk, cb) {
	  var valid = true;
	  var er = false;

	  if (chunk === null) {
	    er = new TypeError('May not write null values to stream');
	  } else if (typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  if (er) {
	    stream.emit('error', er);
	    pna.nextTick(cb, er);
	    valid = false;
	  }
	  return valid;
	}

	Writable.prototype.write = function (chunk, encoding, cb) {
	  var state = this._writableState;
	  var ret = false;
	  var isBuf = !state.objectMode && _isUint8Array(chunk);

	  if (isBuf && !Buffer.isBuffer(chunk)) {
	    chunk = _uint8ArrayToBuffer(chunk);
	  }

	  if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

	  if (typeof cb !== 'function') cb = nop;

	  if (state.ended) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
	    state.pendingcb++;
	    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
	  }

	  return ret;
	};

	Writable.prototype.cork = function () {
	  var state = this._writableState;

	  state.corked++;
	};

	Writable.prototype.uncork = function () {
	  var state = this._writableState;

	  if (state.corked) {
	    state.corked--;

	    if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
	  }
	};

	Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
	  // node::ParseEncoding() requires lower case.
	  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
	  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
	  this._writableState.defaultEncoding = encoding;
	  return this;
	};

	function decodeChunk(state, chunk, encoding) {
	  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
	    chunk = Buffer.from(chunk, encoding);
	  }
	  return chunk;
	}

	Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function () {
	    return this._writableState.highWaterMark;
	  }
	});

	// if we're already writing something, then just put this
	// in the queue, and wait our turn.  Otherwise, call _write
	// If we return false, then we need a drain event, so set that flag.
	function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
	  if (!isBuf) {
	    var newChunk = decodeChunk(state, chunk, encoding);
	    if (chunk !== newChunk) {
	      isBuf = true;
	      encoding = 'buffer';
	      chunk = newChunk;
	    }
	  }
	  var len = state.objectMode ? 1 : chunk.length;

	  state.length += len;

	  var ret = state.length < state.highWaterMark;
	  // we must ensure that previous needDrain will not be reset to false.
	  if (!ret) state.needDrain = true;

	  if (state.writing || state.corked) {
	    var last = state.lastBufferedRequest;
	    state.lastBufferedRequest = {
	      chunk: chunk,
	      encoding: encoding,
	      isBuf: isBuf,
	      callback: cb,
	      next: null
	    };
	    if (last) {
	      last.next = state.lastBufferedRequest;
	    } else {
	      state.bufferedRequest = state.lastBufferedRequest;
	    }
	    state.bufferedRequestCount += 1;
	  } else {
	    doWrite(stream, state, false, len, chunk, encoding, cb);
	  }

	  return ret;
	}

	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
	  state.writelen = len;
	  state.writecb = cb;
	  state.writing = true;
	  state.sync = true;
	  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
	  state.sync = false;
	}

	function onwriteError(stream, state, sync, er, cb) {
	  --state.pendingcb;

	  if (sync) {
	    // defer the callback if we are being called synchronously
	    // to avoid piling up things on the stack
	    pna.nextTick(cb, er);
	    // this can emit finish, and it will always happen
	    // after error
	    pna.nextTick(finishMaybe, stream, state);
	    stream._writableState.errorEmitted = true;
	    stream.emit('error', er);
	  } else {
	    // the caller expect this to happen before if
	    // it is async
	    cb(er);
	    stream._writableState.errorEmitted = true;
	    stream.emit('error', er);
	    // this can emit finish, but finish must
	    // always follow error
	    finishMaybe(stream, state);
	  }
	}

	function onwriteStateUpdate(state) {
	  state.writing = false;
	  state.writecb = null;
	  state.length -= state.writelen;
	  state.writelen = 0;
	}

	function onwrite(stream, er) {
	  var state = stream._writableState;
	  var sync = state.sync;
	  var cb = state.writecb;

	  onwriteStateUpdate(state);

	  if (er) onwriteError(stream, state, sync, er, cb);else {
	    // Check if we're actually ready to finish, but don't emit yet
	    var finished = needFinish(state);

	    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
	      clearBuffer(stream, state);
	    }

	    if (sync) {
	      /*<replacement>*/
	      asyncWrite(afterWrite, stream, state, finished, cb);
	      /*</replacement>*/
	    } else {
	      afterWrite(stream, state, finished, cb);
	    }
	  }
	}

	function afterWrite(stream, state, finished, cb) {
	  if (!finished) onwriteDrain(stream, state);
	  state.pendingcb--;
	  cb();
	  finishMaybe(stream, state);
	}

	// Must force callback to be called on nextTick, so that we don't
	// emit 'drain' before the write() consumer gets the 'false' return
	// value, and has a chance to attach a 'drain' listener.
	function onwriteDrain(stream, state) {
	  if (state.length === 0 && state.needDrain) {
	    state.needDrain = false;
	    stream.emit('drain');
	  }
	}

	// if there's something in the buffer waiting, then process it
	function clearBuffer(stream, state) {
	  state.bufferProcessing = true;
	  var entry = state.bufferedRequest;

	  if (stream._writev && entry && entry.next) {
	    // Fast case, write everything using _writev()
	    var l = state.bufferedRequestCount;
	    var buffer = new Array(l);
	    var holder = state.corkedRequestsFree;
	    holder.entry = entry;

	    var count = 0;
	    var allBuffers = true;
	    while (entry) {
	      buffer[count] = entry;
	      if (!entry.isBuf) allBuffers = false;
	      entry = entry.next;
	      count += 1;
	    }
	    buffer.allBuffers = allBuffers;

	    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

	    // doWrite is almost always async, defer these to save a bit of time
	    // as the hot path ends with doWrite
	    state.pendingcb++;
	    state.lastBufferedRequest = null;
	    if (holder.next) {
	      state.corkedRequestsFree = holder.next;
	      holder.next = null;
	    } else {
	      state.corkedRequestsFree = new CorkedRequest(state);
	    }
	    state.bufferedRequestCount = 0;
	  } else {
	    // Slow case, write chunks one-by-one
	    while (entry) {
	      var chunk = entry.chunk;
	      var encoding = entry.encoding;
	      var cb = entry.callback;
	      var len = state.objectMode ? 1 : chunk.length;

	      doWrite(stream, state, false, len, chunk, encoding, cb);
	      entry = entry.next;
	      state.bufferedRequestCount--;
	      // if we didn't call the onwrite immediately, then
	      // it means that we need to wait until it does.
	      // also, that means that the chunk and cb are currently
	      // being processed, so move the buffer counter past them.
	      if (state.writing) {
	        break;
	      }
	    }

	    if (entry === null) state.lastBufferedRequest = null;
	  }

	  state.bufferedRequest = entry;
	  state.bufferProcessing = false;
	}

	Writable.prototype._write = function (chunk, encoding, cb) {
	  cb(new Error('_write() is not implemented'));
	};

	Writable.prototype._writev = null;

	Writable.prototype.end = function (chunk, encoding, cb) {
	  var state = this._writableState;

	  if (typeof chunk === 'function') {
	    cb = chunk;
	    chunk = null;
	    encoding = null;
	  } else if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

	  // .end() fully uncorks
	  if (state.corked) {
	    state.corked = 1;
	    this.uncork();
	  }

	  // ignore unnecessary end() calls.
	  if (!state.ending) endWritable(this, state, cb);
	};

	function needFinish(state) {
	  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
	}
	function callFinal(stream, state) {
	  stream._final(function (err) {
	    state.pendingcb--;
	    if (err) {
	      stream.emit('error', err);
	    }
	    state.prefinished = true;
	    stream.emit('prefinish');
	    finishMaybe(stream, state);
	  });
	}
	function prefinish(stream, state) {
	  if (!state.prefinished && !state.finalCalled) {
	    if (typeof stream._final === 'function') {
	      state.pendingcb++;
	      state.finalCalled = true;
	      pna.nextTick(callFinal, stream, state);
	    } else {
	      state.prefinished = true;
	      stream.emit('prefinish');
	    }
	  }
	}

	function finishMaybe(stream, state) {
	  var need = needFinish(state);
	  if (need) {
	    prefinish(stream, state);
	    if (state.pendingcb === 0) {
	      state.finished = true;
	      stream.emit('finish');
	    }
	  }
	  return need;
	}

	function endWritable(stream, state, cb) {
	  state.ending = true;
	  finishMaybe(stream, state);
	  if (cb) {
	    if (state.finished) pna.nextTick(cb);else stream.once('finish', cb);
	  }
	  state.ended = true;
	  stream.writable = false;
	}

	function onCorkedFinish(corkReq, state, err) {
	  var entry = corkReq.entry;
	  corkReq.entry = null;
	  while (entry) {
	    var cb = entry.callback;
	    state.pendingcb--;
	    cb(err);
	    entry = entry.next;
	  }

	  // reuse the free corkReq.
	  state.corkedRequestsFree.next = corkReq;
	}

	Object.defineProperty(Writable.prototype, 'destroyed', {
	  get: function () {
	    if (this._writableState === undefined) {
	      return false;
	    }
	    return this._writableState.destroyed;
	  },
	  set: function (value) {
	    // we ignore the value if the stream
	    // has not been initialized yet
	    if (!this._writableState) {
	      return;
	    }

	    // backward compatibility, the user is explicitly
	    // managing destroyed
	    this._writableState.destroyed = value;
	  }
	});

	Writable.prototype.destroy = destroyImpl.destroy;
	Writable.prototype._undestroy = destroyImpl.undestroy;
	Writable.prototype._destroy = function (err, cb) {
	  this.end();
	  cb(err);
	};
	return _stream_writable;
}

var _stream_duplex;
var hasRequired_stream_duplex;

function require_stream_duplex () {
	if (hasRequired_stream_duplex) return _stream_duplex;
	hasRequired_stream_duplex = 1;

	/*<replacement>*/

	var pna = requireProcessNextickArgs();
	/*</replacement>*/

	/*<replacement>*/
	var objectKeys = Object.keys || function (obj) {
	  var keys = [];
	  for (var key in obj) {
	    keys.push(key);
	  }return keys;
	};
	/*</replacement>*/

	_stream_duplex = Duplex;

	/*<replacement>*/
	var util = Object.create(requireUtil());
	util.inherits = requireInherits();
	/*</replacement>*/

	var Readable = require_stream_readable();
	var Writable = require_stream_writable();

	util.inherits(Duplex, Readable);

	{
	  // avoid scope creep, the keys array can then be collected
	  var keys = objectKeys(Writable.prototype);
	  for (var v = 0; v < keys.length; v++) {
	    var method = keys[v];
	    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
	  }
	}

	function Duplex(options) {
	  if (!(this instanceof Duplex)) return new Duplex(options);

	  Readable.call(this, options);
	  Writable.call(this, options);

	  if (options && options.readable === false) this.readable = false;

	  if (options && options.writable === false) this.writable = false;

	  this.allowHalfOpen = true;
	  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

	  this.once('end', onend);
	}

	Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function () {
	    return this._writableState.highWaterMark;
	  }
	});

	// the no-half-open enforcer
	function onend() {
	  // if we allow half-open state, or if the writable side ended,
	  // then we're ok.
	  if (this.allowHalfOpen || this._writableState.ended) return;

	  // no more data can be written.
	  // But allow more writes to happen in this tick.
	  pna.nextTick(onEndNT, this);
	}

	function onEndNT(self) {
	  self.end();
	}

	Object.defineProperty(Duplex.prototype, 'destroyed', {
	  get: function () {
	    if (this._readableState === undefined || this._writableState === undefined) {
	      return false;
	    }
	    return this._readableState.destroyed && this._writableState.destroyed;
	  },
	  set: function (value) {
	    // we ignore the value if the stream
	    // has not been initialized yet
	    if (this._readableState === undefined || this._writableState === undefined) {
	      return;
	    }

	    // backward compatibility, the user is explicitly
	    // managing destroyed
	    this._readableState.destroyed = value;
	    this._writableState.destroyed = value;
	  }
	});

	Duplex.prototype._destroy = function (err, cb) {
	  this.push(null);
	  this.end();

	  pna.nextTick(cb, err);
	};
	return _stream_duplex;
}

var string_decoder = {};

var hasRequiredString_decoder;

function requireString_decoder () {
	if (hasRequiredString_decoder) return string_decoder;
	hasRequiredString_decoder = 1;

	/*<replacement>*/

	var Buffer = requireSafeBuffer().Buffer;
	/*</replacement>*/

	var isEncoding = Buffer.isEncoding || function (encoding) {
	  encoding = '' + encoding;
	  switch (encoding && encoding.toLowerCase()) {
	    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
	      return true;
	    default:
	      return false;
	  }
	};

	function _normalizeEncoding(enc) {
	  if (!enc) return 'utf8';
	  var retried;
	  while (true) {
	    switch (enc) {
	      case 'utf8':
	      case 'utf-8':
	        return 'utf8';
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return 'utf16le';
	      case 'latin1':
	      case 'binary':
	        return 'latin1';
	      case 'base64':
	      case 'ascii':
	      case 'hex':
	        return enc;
	      default:
	        if (retried) return; // undefined
	        enc = ('' + enc).toLowerCase();
	        retried = true;
	    }
	  }
	}
	// Do not cache `Buffer.isEncoding` when checking encoding names as some
	// modules monkey-patch it to support additional encodings
	function normalizeEncoding(enc) {
	  var nenc = _normalizeEncoding(enc);
	  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
	  return nenc || enc;
	}

	// StringDecoder provides an interface for efficiently splitting a series of
	// buffers into a series of JS strings without breaking apart multi-byte
	// characters.
	string_decoder.StringDecoder = StringDecoder;
	function StringDecoder(encoding) {
	  this.encoding = normalizeEncoding(encoding);
	  var nb;
	  switch (this.encoding) {
	    case 'utf16le':
	      this.text = utf16Text;
	      this.end = utf16End;
	      nb = 4;
	      break;
	    case 'utf8':
	      this.fillLast = utf8FillLast;
	      nb = 4;
	      break;
	    case 'base64':
	      this.text = base64Text;
	      this.end = base64End;
	      nb = 3;
	      break;
	    default:
	      this.write = simpleWrite;
	      this.end = simpleEnd;
	      return;
	  }
	  this.lastNeed = 0;
	  this.lastTotal = 0;
	  this.lastChar = Buffer.allocUnsafe(nb);
	}

	StringDecoder.prototype.write = function (buf) {
	  if (buf.length === 0) return '';
	  var r;
	  var i;
	  if (this.lastNeed) {
	    r = this.fillLast(buf);
	    if (r === undefined) return '';
	    i = this.lastNeed;
	    this.lastNeed = 0;
	  } else {
	    i = 0;
	  }
	  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
	  return r || '';
	};

	StringDecoder.prototype.end = utf8End;

	// Returns only complete characters in a Buffer
	StringDecoder.prototype.text = utf8Text;

	// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
	StringDecoder.prototype.fillLast = function (buf) {
	  if (this.lastNeed <= buf.length) {
	    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
	    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
	  }
	  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
	  this.lastNeed -= buf.length;
	};

	// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
	// continuation byte. If an invalid byte is detected, -2 is returned.
	function utf8CheckByte(byte) {
	  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
	  return byte >> 6 === 0x02 ? -1 : -2;
	}

	// Checks at most 3 bytes at the end of a Buffer in order to detect an
	// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
	// needed to complete the UTF-8 character (if applicable) are returned.
	function utf8CheckIncomplete(self, buf, i) {
	  var j = buf.length - 1;
	  if (j < i) return 0;
	  var nb = utf8CheckByte(buf[j]);
	  if (nb >= 0) {
	    if (nb > 0) self.lastNeed = nb - 1;
	    return nb;
	  }
	  if (--j < i || nb === -2) return 0;
	  nb = utf8CheckByte(buf[j]);
	  if (nb >= 0) {
	    if (nb > 0) self.lastNeed = nb - 2;
	    return nb;
	  }
	  if (--j < i || nb === -2) return 0;
	  nb = utf8CheckByte(buf[j]);
	  if (nb >= 0) {
	    if (nb > 0) {
	      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
	    }
	    return nb;
	  }
	  return 0;
	}

	// Validates as many continuation bytes for a multi-byte UTF-8 character as
	// needed or are available. If we see a non-continuation byte where we expect
	// one, we "replace" the validated continuation bytes we've seen so far with
	// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
	// behavior. The continuation byte check is included three times in the case
	// where all of the continuation bytes for a character exist in the same buffer.
	// It is also done this way as a slight performance increase instead of using a
	// loop.
	function utf8CheckExtraBytes(self, buf, p) {
	  if ((buf[0] & 0xC0) !== 0x80) {
	    self.lastNeed = 0;
	    return '\ufffd';
	  }
	  if (self.lastNeed > 1 && buf.length > 1) {
	    if ((buf[1] & 0xC0) !== 0x80) {
	      self.lastNeed = 1;
	      return '\ufffd';
	    }
	    if (self.lastNeed > 2 && buf.length > 2) {
	      if ((buf[2] & 0xC0) !== 0x80) {
	        self.lastNeed = 2;
	        return '\ufffd';
	      }
	    }
	  }
	}

	// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
	function utf8FillLast(buf) {
	  var p = this.lastTotal - this.lastNeed;
	  var r = utf8CheckExtraBytes(this, buf);
	  if (r !== undefined) return r;
	  if (this.lastNeed <= buf.length) {
	    buf.copy(this.lastChar, p, 0, this.lastNeed);
	    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
	  }
	  buf.copy(this.lastChar, p, 0, buf.length);
	  this.lastNeed -= buf.length;
	}

	// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
	// partial character, the character's bytes are buffered until the required
	// number of bytes are available.
	function utf8Text(buf, i) {
	  var total = utf8CheckIncomplete(this, buf, i);
	  if (!this.lastNeed) return buf.toString('utf8', i);
	  this.lastTotal = total;
	  var end = buf.length - (total - this.lastNeed);
	  buf.copy(this.lastChar, 0, end);
	  return buf.toString('utf8', i, end);
	}

	// For UTF-8, a replacement character is added when ending on a partial
	// character.
	function utf8End(buf) {
	  var r = buf && buf.length ? this.write(buf) : '';
	  if (this.lastNeed) return r + '\ufffd';
	  return r;
	}

	// UTF-16LE typically needs two bytes per character, but even if we have an even
	// number of bytes available, we need to check if we end on a leading/high
	// surrogate. In that case, we need to wait for the next two bytes in order to
	// decode the last character properly.
	function utf16Text(buf, i) {
	  if ((buf.length - i) % 2 === 0) {
	    var r = buf.toString('utf16le', i);
	    if (r) {
	      var c = r.charCodeAt(r.length - 1);
	      if (c >= 0xD800 && c <= 0xDBFF) {
	        this.lastNeed = 2;
	        this.lastTotal = 4;
	        this.lastChar[0] = buf[buf.length - 2];
	        this.lastChar[1] = buf[buf.length - 1];
	        return r.slice(0, -1);
	      }
	    }
	    return r;
	  }
	  this.lastNeed = 1;
	  this.lastTotal = 2;
	  this.lastChar[0] = buf[buf.length - 1];
	  return buf.toString('utf16le', i, buf.length - 1);
	}

	// For UTF-16LE we do not explicitly append special replacement characters if we
	// end on a partial character, we simply let v8 handle that.
	function utf16End(buf) {
	  var r = buf && buf.length ? this.write(buf) : '';
	  if (this.lastNeed) {
	    var end = this.lastTotal - this.lastNeed;
	    return r + this.lastChar.toString('utf16le', 0, end);
	  }
	  return r;
	}

	function base64Text(buf, i) {
	  var n = (buf.length - i) % 3;
	  if (n === 0) return buf.toString('base64', i);
	  this.lastNeed = 3 - n;
	  this.lastTotal = 3;
	  if (n === 1) {
	    this.lastChar[0] = buf[buf.length - 1];
	  } else {
	    this.lastChar[0] = buf[buf.length - 2];
	    this.lastChar[1] = buf[buf.length - 1];
	  }
	  return buf.toString('base64', i, buf.length - n);
	}

	function base64End(buf) {
	  var r = buf && buf.length ? this.write(buf) : '';
	  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
	  return r;
	}

	// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
	function simpleWrite(buf) {
	  return buf.toString(this.encoding);
	}

	function simpleEnd(buf) {
	  return buf && buf.length ? this.write(buf) : '';
	}
	return string_decoder;
}

var _stream_readable;
var hasRequired_stream_readable;

function require_stream_readable () {
	if (hasRequired_stream_readable) return _stream_readable;
	hasRequired_stream_readable = 1;

	/*<replacement>*/

	var pna = requireProcessNextickArgs();
	/*</replacement>*/

	_stream_readable = Readable;

	/*<replacement>*/
	var isArray = requireIsarray();
	/*</replacement>*/

	/*<replacement>*/
	var Duplex;
	/*</replacement>*/

	Readable.ReadableState = ReadableState;

	/*<replacement>*/
	require$$2.EventEmitter;

	var EElistenerCount = function (emitter, type) {
	  return emitter.listeners(type).length;
	};
	/*</replacement>*/

	/*<replacement>*/
	var Stream = requireStream();
	/*</replacement>*/

	/*<replacement>*/

	var Buffer = requireSafeBuffer().Buffer;
	var OurUint8Array = (typeof commonjsGlobal !== 'undefined' ? commonjsGlobal : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {}).Uint8Array || function () {};
	function _uint8ArrayToBuffer(chunk) {
	  return Buffer.from(chunk);
	}
	function _isUint8Array(obj) {
	  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
	}

	/*</replacement>*/

	/*<replacement>*/
	var util = Object.create(requireUtil());
	util.inherits = requireInherits();
	/*</replacement>*/

	/*<replacement>*/
	var debugUtil = require$$1;
	var debug = void 0;
	if (debugUtil && debugUtil.debuglog) {
	  debug = debugUtil.debuglog('stream');
	} else {
	  debug = function () {};
	}
	/*</replacement>*/

	var BufferList = requireBufferList();
	var destroyImpl = requireDestroy();
	var StringDecoder;

	util.inherits(Readable, Stream);

	var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];

	function prependListener(emitter, event, fn) {
	  // Sadly this is not cacheable as some libraries bundle their own
	  // event emitter implementation with them.
	  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn);

	  // This is a hack to make sure that our error handler is attached before any
	  // userland ones.  NEVER DO THIS. This is here only because this code needs
	  // to continue to work with older versions of Node.js that do not include
	  // the prependListener() method. The goal is to eventually remove this hack.
	  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
	}

	function ReadableState(options, stream) {
	  Duplex = Duplex || require_stream_duplex();

	  options = options || {};

	  // Duplex streams are both readable and writable, but share
	  // the same options object.
	  // However, some cases require setting options to different
	  // values for the readable and the writable sides of the duplex stream.
	  // These options can be provided separately as readableXXX and writableXXX.
	  var isDuplex = stream instanceof Duplex;

	  // object stream flag. Used to make read(n) ignore n and to
	  // make all the buffer merging and length checks go away
	  this.objectMode = !!options.objectMode;

	  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

	  // the point at which it stops calling _read() to fill the buffer
	  // Note: 0 is a valid value, means "don't call _read preemptively ever"
	  var hwm = options.highWaterMark;
	  var readableHwm = options.readableHighWaterMark;
	  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

	  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;else this.highWaterMark = defaultHwm;

	  // cast to ints.
	  this.highWaterMark = Math.floor(this.highWaterMark);

	  // A linked list is used to store data chunks instead of an array because the
	  // linked list can remove elements from the beginning faster than
	  // array.shift()
	  this.buffer = new BufferList();
	  this.length = 0;
	  this.pipes = null;
	  this.pipesCount = 0;
	  this.flowing = null;
	  this.ended = false;
	  this.endEmitted = false;
	  this.reading = false;

	  // a flag to be able to tell if the event 'readable'/'data' is emitted
	  // immediately, or on a later tick.  We set this to true at first, because
	  // any actions that shouldn't happen until "later" should generally also
	  // not happen before the first read call.
	  this.sync = true;

	  // whenever we return null, then we set a flag to say
	  // that we're awaiting a 'readable' event emission.
	  this.needReadable = false;
	  this.emittedReadable = false;
	  this.readableListening = false;
	  this.resumeScheduled = false;

	  // has it been destroyed
	  this.destroyed = false;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // the number of writers that are awaiting a drain event in .pipe()s
	  this.awaitDrain = 0;

	  // if true, a maybeReadMore has been scheduled
	  this.readingMore = false;

	  this.decoder = null;
	  this.encoding = null;
	  if (options.encoding) {
	    if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
	    this.decoder = new StringDecoder(options.encoding);
	    this.encoding = options.encoding;
	  }
	}

	function Readable(options) {
	  Duplex = Duplex || require_stream_duplex();

	  if (!(this instanceof Readable)) return new Readable(options);

	  this._readableState = new ReadableState(options, this);

	  // legacy
	  this.readable = true;

	  if (options) {
	    if (typeof options.read === 'function') this._read = options.read;

	    if (typeof options.destroy === 'function') this._destroy = options.destroy;
	  }

	  Stream.call(this);
	}

	Object.defineProperty(Readable.prototype, 'destroyed', {
	  get: function () {
	    if (this._readableState === undefined) {
	      return false;
	    }
	    return this._readableState.destroyed;
	  },
	  set: function (value) {
	    // we ignore the value if the stream
	    // has not been initialized yet
	    if (!this._readableState) {
	      return;
	    }

	    // backward compatibility, the user is explicitly
	    // managing destroyed
	    this._readableState.destroyed = value;
	  }
	});

	Readable.prototype.destroy = destroyImpl.destroy;
	Readable.prototype._undestroy = destroyImpl.undestroy;
	Readable.prototype._destroy = function (err, cb) {
	  this.push(null);
	  cb(err);
	};

	// Manually shove something into the read() buffer.
	// This returns true if the highWaterMark has not been hit yet,
	// similar to how Writable.write() returns true if you should
	// write() some more.
	Readable.prototype.push = function (chunk, encoding) {
	  var state = this._readableState;
	  var skipChunkCheck;

	  if (!state.objectMode) {
	    if (typeof chunk === 'string') {
	      encoding = encoding || state.defaultEncoding;
	      if (encoding !== state.encoding) {
	        chunk = Buffer.from(chunk, encoding);
	        encoding = '';
	      }
	      skipChunkCheck = true;
	    }
	  } else {
	    skipChunkCheck = true;
	  }

	  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
	};

	// Unshift should *always* be something directly out of read()
	Readable.prototype.unshift = function (chunk) {
	  return readableAddChunk(this, chunk, null, true, false);
	};

	function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
	  var state = stream._readableState;
	  if (chunk === null) {
	    state.reading = false;
	    onEofChunk(stream, state);
	  } else {
	    var er;
	    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
	    if (er) {
	      stream.emit('error', er);
	    } else if (state.objectMode || chunk && chunk.length > 0) {
	      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
	        chunk = _uint8ArrayToBuffer(chunk);
	      }

	      if (addToFront) {
	        if (state.endEmitted) stream.emit('error', new Error('stream.unshift() after end event'));else addChunk(stream, state, chunk, true);
	      } else if (state.ended) {
	        stream.emit('error', new Error('stream.push() after EOF'));
	      } else {
	        state.reading = false;
	        if (state.decoder && !encoding) {
	          chunk = state.decoder.write(chunk);
	          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
	        } else {
	          addChunk(stream, state, chunk, false);
	        }
	      }
	    } else if (!addToFront) {
	      state.reading = false;
	    }
	  }

	  return needMoreData(state);
	}

	function addChunk(stream, state, chunk, addToFront) {
	  if (state.flowing && state.length === 0 && !state.sync) {
	    stream.emit('data', chunk);
	    stream.read(0);
	  } else {
	    // update the buffer info.
	    state.length += state.objectMode ? 1 : chunk.length;
	    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

	    if (state.needReadable) emitReadable(stream);
	  }
	  maybeReadMore(stream, state);
	}

	function chunkInvalid(state, chunk) {
	  var er;
	  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  return er;
	}

	// if it's past the high water mark, we can push in some more.
	// Also, if we have no data yet, we can stand some
	// more bytes.  This is to work around cases where hwm=0,
	// such as the repl.  Also, if the push() triggered a
	// readable event, and the user called read(largeNumber) such that
	// needReadable was set, then we ought to push more, so that another
	// 'readable' event will be triggered.
	function needMoreData(state) {
	  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
	}

	Readable.prototype.isPaused = function () {
	  return this._readableState.flowing === false;
	};

	// backwards compatibility.
	Readable.prototype.setEncoding = function (enc) {
	  if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
	  this._readableState.decoder = new StringDecoder(enc);
	  this._readableState.encoding = enc;
	  return this;
	};

	// Don't raise the hwm > 8MB
	var MAX_HWM = 0x800000;
	function computeNewHighWaterMark(n) {
	  if (n >= MAX_HWM) {
	    n = MAX_HWM;
	  } else {
	    // Get the next highest power of 2 to prevent increasing hwm excessively in
	    // tiny amounts
	    n--;
	    n |= n >>> 1;
	    n |= n >>> 2;
	    n |= n >>> 4;
	    n |= n >>> 8;
	    n |= n >>> 16;
	    n++;
	  }
	  return n;
	}

	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function howMuchToRead(n, state) {
	  if (n <= 0 || state.length === 0 && state.ended) return 0;
	  if (state.objectMode) return 1;
	  if (n !== n) {
	    // Only flow one buffer at a time
	    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
	  }
	  // If we're asking for more than the current hwm, then raise the hwm.
	  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
	  if (n <= state.length) return n;
	  // Don't have enough
	  if (!state.ended) {
	    state.needReadable = true;
	    return 0;
	  }
	  return state.length;
	}

	// you can override either this method, or the async _read(n) below.
	Readable.prototype.read = function (n) {
	  debug('read', n);
	  n = parseInt(n, 10);
	  var state = this._readableState;
	  var nOrig = n;

	  if (n !== 0) state.emittedReadable = false;

	  // if we're doing read(0) to trigger a readable event, but we
	  // already have a bunch of data in the buffer, then just trigger
	  // the 'readable' event and move on.
	  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
	    debug('read: emitReadable', state.length, state.ended);
	    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
	    return null;
	  }

	  n = howMuchToRead(n, state);

	  // if we've ended, and we're now clear, then finish it up.
	  if (n === 0 && state.ended) {
	    if (state.length === 0) endReadable(this);
	    return null;
	  }

	  // All the actual chunk generation logic needs to be
	  // *below* the call to _read.  The reason is that in certain
	  // synthetic stream cases, such as passthrough streams, _read
	  // may be a completely synchronous operation which may change
	  // the state of the read buffer, providing enough data when
	  // before there was *not* enough.
	  //
	  // So, the steps are:
	  // 1. Figure out what the state of things will be after we do
	  // a read from the buffer.
	  //
	  // 2. If that resulting state will trigger a _read, then call _read.
	  // Note that this may be asynchronous, or synchronous.  Yes, it is
	  // deeply ugly to write APIs this way, but that still doesn't mean
	  // that the Readable class should behave improperly, as streams are
	  // designed to be sync/async agnostic.
	  // Take note if the _read call is sync or async (ie, if the read call
	  // has returned yet), so that we know whether or not it's safe to emit
	  // 'readable' etc.
	  //
	  // 3. Actually pull the requested chunks out of the buffer and return.

	  // if we need a readable event, then we need to do some reading.
	  var doRead = state.needReadable;
	  debug('need readable', doRead);

	  // if we currently have less than the highWaterMark, then also read some
	  if (state.length === 0 || state.length - n < state.highWaterMark) {
	    doRead = true;
	    debug('length less than watermark', doRead);
	  }

	  // however, if we've ended, then there's no point, and if we're already
	  // reading, then it's unnecessary.
	  if (state.ended || state.reading) {
	    doRead = false;
	    debug('reading or ended', doRead);
	  } else if (doRead) {
	    debug('do read');
	    state.reading = true;
	    state.sync = true;
	    // if the length is currently zero, then we *need* a readable event.
	    if (state.length === 0) state.needReadable = true;
	    // call internal read method
	    this._read(state.highWaterMark);
	    state.sync = false;
	    // If _read pushed data synchronously, then `reading` will be false,
	    // and we need to re-evaluate how much data we can return to the user.
	    if (!state.reading) n = howMuchToRead(nOrig, state);
	  }

	  var ret;
	  if (n > 0) ret = fromList(n, state);else ret = null;

	  if (ret === null) {
	    state.needReadable = true;
	    n = 0;
	  } else {
	    state.length -= n;
	  }

	  if (state.length === 0) {
	    // If we have nothing in the buffer, then we want to know
	    // as soon as we *do* get something into the buffer.
	    if (!state.ended) state.needReadable = true;

	    // If we tried to read() past the EOF, then emit end on the next tick.
	    if (nOrig !== n && state.ended) endReadable(this);
	  }

	  if (ret !== null) this.emit('data', ret);

	  return ret;
	};

	function onEofChunk(stream, state) {
	  if (state.ended) return;
	  if (state.decoder) {
	    var chunk = state.decoder.end();
	    if (chunk && chunk.length) {
	      state.buffer.push(chunk);
	      state.length += state.objectMode ? 1 : chunk.length;
	    }
	  }
	  state.ended = true;

	  // emit 'readable' now to make sure it gets picked up.
	  emitReadable(stream);
	}

	// Don't emit readable right away in sync mode, because this can trigger
	// another read() call => stack overflow.  This way, it might trigger
	// a nextTick recursion warning, but that's not so bad.
	function emitReadable(stream) {
	  var state = stream._readableState;
	  state.needReadable = false;
	  if (!state.emittedReadable) {
	    debug('emitReadable', state.flowing);
	    state.emittedReadable = true;
	    if (state.sync) pna.nextTick(emitReadable_, stream);else emitReadable_(stream);
	  }
	}

	function emitReadable_(stream) {
	  debug('emit readable');
	  stream.emit('readable');
	  flow(stream);
	}

	// at this point, the user has presumably seen the 'readable' event,
	// and called read() to consume some data.  that may have triggered
	// in turn another _read(n) call, in which case reading = true if
	// it's in progress.
	// However, if we're not ended, or reading, and the length < hwm,
	// then go ahead and try to read some more preemptively.
	function maybeReadMore(stream, state) {
	  if (!state.readingMore) {
	    state.readingMore = true;
	    pna.nextTick(maybeReadMore_, stream, state);
	  }
	}

	function maybeReadMore_(stream, state) {
	  var len = state.length;
	  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
	    debug('maybeReadMore read 0');
	    stream.read(0);
	    if (len === state.length)
	      // didn't get any data, stop spinning.
	      break;else len = state.length;
	  }
	  state.readingMore = false;
	}

	// abstract method.  to be overridden in specific implementation classes.
	// call cb(er, data) where data is <= n in length.
	// for virtual (non-string, non-buffer) streams, "length" is somewhat
	// arbitrary, and perhaps not very meaningful.
	Readable.prototype._read = function (n) {
	  this.emit('error', new Error('_read() is not implemented'));
	};

	Readable.prototype.pipe = function (dest, pipeOpts) {
	  var src = this;
	  var state = this._readableState;

	  switch (state.pipesCount) {
	    case 0:
	      state.pipes = dest;
	      break;
	    case 1:
	      state.pipes = [state.pipes, dest];
	      break;
	    default:
	      state.pipes.push(dest);
	      break;
	  }
	  state.pipesCount += 1;
	  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

	  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

	  var endFn = doEnd ? onend : unpipe;
	  if (state.endEmitted) pna.nextTick(endFn);else src.once('end', endFn);

	  dest.on('unpipe', onunpipe);
	  function onunpipe(readable, unpipeInfo) {
	    debug('onunpipe');
	    if (readable === src) {
	      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
	        unpipeInfo.hasUnpiped = true;
	        cleanup();
	      }
	    }
	  }

	  function onend() {
	    debug('onend');
	    dest.end();
	  }

	  // when the dest drains, it reduces the awaitDrain counter
	  // on the source.  This would be more elegant with a .once()
	  // handler in flow(), but adding and removing repeatedly is
	  // too slow.
	  var ondrain = pipeOnDrain(src);
	  dest.on('drain', ondrain);

	  var cleanedUp = false;
	  function cleanup() {
	    debug('cleanup');
	    // cleanup event handlers once the pipe is broken
	    dest.removeListener('close', onclose);
	    dest.removeListener('finish', onfinish);
	    dest.removeListener('drain', ondrain);
	    dest.removeListener('error', onerror);
	    dest.removeListener('unpipe', onunpipe);
	    src.removeListener('end', onend);
	    src.removeListener('end', unpipe);
	    src.removeListener('data', ondata);

	    cleanedUp = true;

	    // if the reader is waiting for a drain event from this
	    // specific writer, then it would cause it to never start
	    // flowing again.
	    // So, if this is awaiting a drain, then we just call it now.
	    // If we don't know, then assume that we are waiting for one.
	    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
	  }

	  // If the user pushes more data while we're writing to dest then we'll end up
	  // in ondata again. However, we only want to increase awaitDrain once because
	  // dest will only emit one 'drain' event for the multiple writes.
	  // => Introduce a guard on increasing awaitDrain.
	  var increasedAwaitDrain = false;
	  src.on('data', ondata);
	  function ondata(chunk) {
	    debug('ondata');
	    increasedAwaitDrain = false;
	    var ret = dest.write(chunk);
	    if (false === ret && !increasedAwaitDrain) {
	      // If the user unpiped during `dest.write()`, it is possible
	      // to get stuck in a permanently paused state if that write
	      // also returned false.
	      // => Check whether `dest` is still a piping destination.
	      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
	        debug('false write response, pause', state.awaitDrain);
	        state.awaitDrain++;
	        increasedAwaitDrain = true;
	      }
	      src.pause();
	    }
	  }

	  // if the dest has an error, then stop piping into it.
	  // however, don't suppress the throwing behavior for this.
	  function onerror(er) {
	    debug('onerror', er);
	    unpipe();
	    dest.removeListener('error', onerror);
	    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
	  }

	  // Make sure our error handler is attached before userland ones.
	  prependListener(dest, 'error', onerror);

	  // Both close and finish should trigger unpipe, but only once.
	  function onclose() {
	    dest.removeListener('finish', onfinish);
	    unpipe();
	  }
	  dest.once('close', onclose);
	  function onfinish() {
	    debug('onfinish');
	    dest.removeListener('close', onclose);
	    unpipe();
	  }
	  dest.once('finish', onfinish);

	  function unpipe() {
	    debug('unpipe');
	    src.unpipe(dest);
	  }

	  // tell the dest that it's being piped to
	  dest.emit('pipe', src);

	  // start the flow if it hasn't been started already.
	  if (!state.flowing) {
	    debug('pipe resume');
	    src.resume();
	  }

	  return dest;
	};

	function pipeOnDrain(src) {
	  return function () {
	    var state = src._readableState;
	    debug('pipeOnDrain', state.awaitDrain);
	    if (state.awaitDrain) state.awaitDrain--;
	    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
	      state.flowing = true;
	      flow(src);
	    }
	  };
	}

	Readable.prototype.unpipe = function (dest) {
	  var state = this._readableState;
	  var unpipeInfo = { hasUnpiped: false };

	  // if we're not piping anywhere, then do nothing.
	  if (state.pipesCount === 0) return this;

	  // just one destination.  most common case.
	  if (state.pipesCount === 1) {
	    // passed in one, but it's not the right one.
	    if (dest && dest !== state.pipes) return this;

	    if (!dest) dest = state.pipes;

	    // got a match.
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;
	    if (dest) dest.emit('unpipe', this, unpipeInfo);
	    return this;
	  }

	  // slow case. multiple pipe destinations.

	  if (!dest) {
	    // remove all.
	    var dests = state.pipes;
	    var len = state.pipesCount;
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;

	    for (var i = 0; i < len; i++) {
	      dests[i].emit('unpipe', this, { hasUnpiped: false });
	    }return this;
	  }

	  // try to find the right one.
	  var index = indexOf(state.pipes, dest);
	  if (index === -1) return this;

	  state.pipes.splice(index, 1);
	  state.pipesCount -= 1;
	  if (state.pipesCount === 1) state.pipes = state.pipes[0];

	  dest.emit('unpipe', this, unpipeInfo);

	  return this;
	};

	// set up data events if they are asked for
	// Ensure readable listeners eventually get something
	Readable.prototype.on = function (ev, fn) {
	  var res = Stream.prototype.on.call(this, ev, fn);

	  if (ev === 'data') {
	    // Start flowing on next tick if stream isn't explicitly paused
	    if (this._readableState.flowing !== false) this.resume();
	  } else if (ev === 'readable') {
	    var state = this._readableState;
	    if (!state.endEmitted && !state.readableListening) {
	      state.readableListening = state.needReadable = true;
	      state.emittedReadable = false;
	      if (!state.reading) {
	        pna.nextTick(nReadingNextTick, this);
	      } else if (state.length) {
	        emitReadable(this);
	      }
	    }
	  }

	  return res;
	};
	Readable.prototype.addListener = Readable.prototype.on;

	function nReadingNextTick(self) {
	  debug('readable nexttick read 0');
	  self.read(0);
	}

	// pause() and resume() are remnants of the legacy readable stream API
	// If the user uses them, then switch into old mode.
	Readable.prototype.resume = function () {
	  var state = this._readableState;
	  if (!state.flowing) {
	    debug('resume');
	    state.flowing = true;
	    resume(this, state);
	  }
	  return this;
	};

	function resume(stream, state) {
	  if (!state.resumeScheduled) {
	    state.resumeScheduled = true;
	    pna.nextTick(resume_, stream, state);
	  }
	}

	function resume_(stream, state) {
	  if (!state.reading) {
	    debug('resume read 0');
	    stream.read(0);
	  }

	  state.resumeScheduled = false;
	  state.awaitDrain = 0;
	  stream.emit('resume');
	  flow(stream);
	  if (state.flowing && !state.reading) stream.read(0);
	}

	Readable.prototype.pause = function () {
	  debug('call pause flowing=%j', this._readableState.flowing);
	  if (false !== this._readableState.flowing) {
	    debug('pause');
	    this._readableState.flowing = false;
	    this.emit('pause');
	  }
	  return this;
	};

	function flow(stream) {
	  var state = stream._readableState;
	  debug('flow', state.flowing);
	  while (state.flowing && stream.read() !== null) {}
	}

	// wrap an old-style stream as the async data source.
	// This is *not* part of the readable stream interface.
	// It is an ugly unfortunate mess of history.
	Readable.prototype.wrap = function (stream) {
	  var _this = this;

	  var state = this._readableState;
	  var paused = false;

	  stream.on('end', function () {
	    debug('wrapped end');
	    if (state.decoder && !state.ended) {
	      var chunk = state.decoder.end();
	      if (chunk && chunk.length) _this.push(chunk);
	    }

	    _this.push(null);
	  });

	  stream.on('data', function (chunk) {
	    debug('wrapped data');
	    if (state.decoder) chunk = state.decoder.write(chunk);

	    // don't skip over falsy values in objectMode
	    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

	    var ret = _this.push(chunk);
	    if (!ret) {
	      paused = true;
	      stream.pause();
	    }
	  });

	  // proxy all the other methods.
	  // important when wrapping filters and duplexes.
	  for (var i in stream) {
	    if (this[i] === undefined && typeof stream[i] === 'function') {
	      this[i] = function (method) {
	        return function () {
	          return stream[method].apply(stream, arguments);
	        };
	      }(i);
	    }
	  }

	  // proxy certain important events.
	  for (var n = 0; n < kProxyEvents.length; n++) {
	    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
	  }

	  // when we try to consume some more bytes, simply unpause the
	  // underlying stream.
	  this._read = function (n) {
	    debug('wrapped _read', n);
	    if (paused) {
	      paused = false;
	      stream.resume();
	    }
	  };

	  return this;
	};

	Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function () {
	    return this._readableState.highWaterMark;
	  }
	});

	// exposed for testing purposes only.
	Readable._fromList = fromList;

	// Pluck off n bytes from an array of buffers.
	// Length is the combined lengths of all the buffers in the list.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function fromList(n, state) {
	  // nothing buffered
	  if (state.length === 0) return null;

	  var ret;
	  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
	    // read it all, truncate the list
	    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
	    state.buffer.clear();
	  } else {
	    // read part of list
	    ret = fromListPartial(n, state.buffer, state.decoder);
	  }

	  return ret;
	}

	// Extracts only enough buffered data to satisfy the amount requested.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function fromListPartial(n, list, hasStrings) {
	  var ret;
	  if (n < list.head.data.length) {
	    // slice is the same for buffers and strings
	    ret = list.head.data.slice(0, n);
	    list.head.data = list.head.data.slice(n);
	  } else if (n === list.head.data.length) {
	    // first chunk is a perfect match
	    ret = list.shift();
	  } else {
	    // result spans more than one buffer
	    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
	  }
	  return ret;
	}

	// Copies a specified amount of characters from the list of buffered data
	// chunks.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function copyFromBufferString(n, list) {
	  var p = list.head;
	  var c = 1;
	  var ret = p.data;
	  n -= ret.length;
	  while (p = p.next) {
	    var str = p.data;
	    var nb = n > str.length ? str.length : n;
	    if (nb === str.length) ret += str;else ret += str.slice(0, n);
	    n -= nb;
	    if (n === 0) {
	      if (nb === str.length) {
	        ++c;
	        if (p.next) list.head = p.next;else list.head = list.tail = null;
	      } else {
	        list.head = p;
	        p.data = str.slice(nb);
	      }
	      break;
	    }
	    ++c;
	  }
	  list.length -= c;
	  return ret;
	}

	// Copies a specified amount of bytes from the list of buffered data chunks.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function copyFromBuffer(n, list) {
	  var ret = Buffer.allocUnsafe(n);
	  var p = list.head;
	  var c = 1;
	  p.data.copy(ret);
	  n -= p.data.length;
	  while (p = p.next) {
	    var buf = p.data;
	    var nb = n > buf.length ? buf.length : n;
	    buf.copy(ret, ret.length - n, 0, nb);
	    n -= nb;
	    if (n === 0) {
	      if (nb === buf.length) {
	        ++c;
	        if (p.next) list.head = p.next;else list.head = list.tail = null;
	      } else {
	        list.head = p;
	        p.data = buf.slice(nb);
	      }
	      break;
	    }
	    ++c;
	  }
	  list.length -= c;
	  return ret;
	}

	function endReadable(stream) {
	  var state = stream._readableState;

	  // If we get here before consuming all the bytes, then that is a
	  // bug in node.  Should never happen.
	  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

	  if (!state.endEmitted) {
	    state.ended = true;
	    pna.nextTick(endReadableNT, state, stream);
	  }
	}

	function endReadableNT(state, stream) {
	  // Check that we didn't get one last unshift.
	  if (!state.endEmitted && state.length === 0) {
	    state.endEmitted = true;
	    stream.readable = false;
	    stream.emit('end');
	  }
	}

	function indexOf(xs, x) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    if (xs[i] === x) return i;
	  }
	  return -1;
	}
	return _stream_readable;
}

var _stream_transform;
var hasRequired_stream_transform;

function require_stream_transform () {
	if (hasRequired_stream_transform) return _stream_transform;
	hasRequired_stream_transform = 1;

	_stream_transform = Transform;

	var Duplex = require_stream_duplex();

	/*<replacement>*/
	var util = Object.create(requireUtil());
	util.inherits = requireInherits();
	/*</replacement>*/

	util.inherits(Transform, Duplex);

	function afterTransform(er, data) {
	  var ts = this._transformState;
	  ts.transforming = false;

	  var cb = ts.writecb;

	  if (!cb) {
	    return this.emit('error', new Error('write callback called multiple times'));
	  }

	  ts.writechunk = null;
	  ts.writecb = null;

	  if (data != null) // single equals check for both `null` and `undefined`
	    this.push(data);

	  cb(er);

	  var rs = this._readableState;
	  rs.reading = false;
	  if (rs.needReadable || rs.length < rs.highWaterMark) {
	    this._read(rs.highWaterMark);
	  }
	}

	function Transform(options) {
	  if (!(this instanceof Transform)) return new Transform(options);

	  Duplex.call(this, options);

	  this._transformState = {
	    afterTransform: afterTransform.bind(this),
	    needTransform: false,
	    transforming: false,
	    writecb: null,
	    writechunk: null,
	    writeencoding: null
	  };

	  // start out asking for a readable event once data is transformed.
	  this._readableState.needReadable = true;

	  // we have implemented the _read method, and done the other things
	  // that Readable wants before the first _read call, so unset the
	  // sync guard flag.
	  this._readableState.sync = false;

	  if (options) {
	    if (typeof options.transform === 'function') this._transform = options.transform;

	    if (typeof options.flush === 'function') this._flush = options.flush;
	  }

	  // When the writable side finishes, then flush out anything remaining.
	  this.on('prefinish', prefinish);
	}

	function prefinish() {
	  var _this = this;

	  if (typeof this._flush === 'function') {
	    this._flush(function (er, data) {
	      done(_this, er, data);
	    });
	  } else {
	    done(this, null, null);
	  }
	}

	Transform.prototype.push = function (chunk, encoding) {
	  this._transformState.needTransform = false;
	  return Duplex.prototype.push.call(this, chunk, encoding);
	};

	// This is the part where you do stuff!
	// override this function in implementation classes.
	// 'chunk' is an input chunk.
	//
	// Call `push(newChunk)` to pass along transformed output
	// to the readable side.  You may call 'push' zero or more times.
	//
	// Call `cb(err)` when you are done with this chunk.  If you pass
	// an error, then that'll put the hurt on the whole operation.  If you
	// never call cb(), then you'll never get another chunk.
	Transform.prototype._transform = function (chunk, encoding, cb) {
	  throw new Error('_transform() is not implemented');
	};

	Transform.prototype._write = function (chunk, encoding, cb) {
	  var ts = this._transformState;
	  ts.writecb = cb;
	  ts.writechunk = chunk;
	  ts.writeencoding = encoding;
	  if (!ts.transforming) {
	    var rs = this._readableState;
	    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
	  }
	};

	// Doesn't matter what the args are here.
	// _transform does all the work.
	// That we got here means that the readable side wants more data.
	Transform.prototype._read = function (n) {
	  var ts = this._transformState;

	  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
	    ts.transforming = true;
	    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
	  } else {
	    // mark that we need a transform, so that any data that comes in
	    // will get processed, now that we've asked for it.
	    ts.needTransform = true;
	  }
	};

	Transform.prototype._destroy = function (err, cb) {
	  var _this2 = this;

	  Duplex.prototype._destroy.call(this, err, function (err2) {
	    cb(err2);
	    _this2.emit('close');
	  });
	};

	function done(stream, er, data) {
	  if (er) return stream.emit('error', er);

	  if (data != null) // single equals check for both `null` and `undefined`
	    stream.push(data);

	  // if there's nothing in the write buffer, then that means
	  // that nothing more will ever be provided
	  if (stream._writableState.length) throw new Error('Calling transform done when ws.length != 0');

	  if (stream._transformState.transforming) throw new Error('Calling transform done when still transforming');

	  return stream.push(null);
	}
	return _stream_transform;
}

var _stream_passthrough;
var hasRequired_stream_passthrough;

function require_stream_passthrough () {
	if (hasRequired_stream_passthrough) return _stream_passthrough;
	hasRequired_stream_passthrough = 1;

	_stream_passthrough = PassThrough;

	var Transform = require_stream_transform();

	/*<replacement>*/
	var util = Object.create(requireUtil());
	util.inherits = requireInherits();
	/*</replacement>*/

	util.inherits(PassThrough, Transform);

	function PassThrough(options) {
	  if (!(this instanceof PassThrough)) return new PassThrough(options);

	  Transform.call(this, options);
	}

	PassThrough.prototype._transform = function (chunk, encoding, cb) {
	  cb(null, chunk);
	};
	return _stream_passthrough;
}

readable.exports;

(function (module, exports) {
	var Stream$1 = Stream;
	if (process.env.READABLE_STREAM === 'disable' && Stream$1) {
	  module.exports = Stream$1;
	  exports = module.exports = Stream$1.Readable;
	  exports.Readable = Stream$1.Readable;
	  exports.Writable = Stream$1.Writable;
	  exports.Duplex = Stream$1.Duplex;
	  exports.Transform = Stream$1.Transform;
	  exports.PassThrough = Stream$1.PassThrough;
	  exports.Stream = Stream$1;
	} else {
	  exports = module.exports = require_stream_readable();
	  exports.Stream = Stream$1 || exports;
	  exports.Readable = exports;
	  exports.Writable = require_stream_writable();
	  exports.Duplex = require_stream_duplex();
	  exports.Transform = require_stream_transform();
	  exports.PassThrough = require_stream_passthrough();
	} 
} (readable, readable.exports));

var readableExports = readable.exports;

var immutable = extend;

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {};

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key];
            }
        }
    }

    return target
}

var Transform = readableExports.Transform
  , inherits  = require$$1.inherits
  , xtend     = immutable;

function DestroyableTransform(opts) {
  Transform.call(this, opts);
  this._destroyed = false;
}

inherits(DestroyableTransform, Transform);

DestroyableTransform.prototype.destroy = function(err) {
  if (this._destroyed) return
  this._destroyed = true;
  
  var self = this;
  process.nextTick(function() {
    if (err)
      self.emit('error', err);
    self.emit('close');
  });
};

// a noop _transform function
function noop (chunk, enc, callback) {
  callback(null, chunk);
}


// create a new export function, used by both the main export and
// the .ctor export, contains common logic for dealing with arguments
function through2 (construct) {
  return function (options, transform, flush) {
    if (typeof options == 'function') {
      flush     = transform;
      transform = options;
      options   = {};
    }

    if (typeof transform != 'function')
      transform = noop;

    if (typeof flush != 'function')
      flush = null;

    return construct(options, transform, flush)
  }
}


// main export, just make me a transform stream!
through2$1.exports = through2(function (options, transform, flush) {
  var t2 = new DestroyableTransform(options);

  t2._transform = transform;

  if (flush)
    t2._flush = flush;

  return t2
});


// make me a reusable prototype that I can `new`, or implicitly `new`
// with a constructor call
through2$1.exports.ctor = through2(function (options, transform, flush) {
  function Through2 (override) {
    if (!(this instanceof Through2))
      return new Through2(override)

    this.options = xtend(options, override);

    DestroyableTransform.call(this, this.options);
  }

  inherits(Through2, DestroyableTransform);

  Through2.prototype._transform = transform;

  if (flush)
    Through2.prototype._flush = flush;

  return Through2
});


var obj = through2$1.exports.obj = through2(function (options, transform, flush) {
  var t2 = new DestroyableTransform(xtend({ objectMode: true, highWaterMark: 16 }, options));

  t2._transform = transform;

  if (flush)
    t2._flush = flush;

  return t2
});

function readAsBlobOrBuffer(storedObject, type) {
  // In Node, we've stored a buffer
  storedObject.type = type; // non-standard, but used for consistency
  return storedObject;
}

// in Node, we store the buffer directly
function prepareAttachmentForStorage(attData, cb) {
  cb(attData);
}

function createEmptyBlobOrBuffer(type) {
  return typedBuffer('', 'binary', type);
}

// similar to an idb or websql transaction object

function getCacheFor(transaction, store) {
  var prefix = store.prefix()[0];
  var cache = transaction._cache;
  var subCache = cache.get(prefix);
  if (!subCache) {
    subCache = new Map();
    cache.set(prefix, subCache);
  }
  return subCache;
}

class LevelTransaction {
  constructor() {
    this._batch = [];
    this._cache = new Map();
  }

  get(store, key, callback) {
    var cache = getCacheFor(this, store);
    var exists = cache.get(key);
    if (exists) {
      return nextTick(function () {
        callback(null, exists);
      });
    } else if (exists === null) { // deleted marker
      /* istanbul ignore next */
      return nextTick(function () {
        callback({name: 'NotFoundError'});
      });
    }
    store.get(key, function (err, res) {
      if (err) {
        /* istanbul ignore else */
        if (err.name === 'NotFoundError') {
          cache.set(key, null);
        }
        return callback(err);
      }
      cache.set(key, res);
      callback(null, res);
    });
  }

  batch(batch) {
    for (var i = 0, len = batch.length; i < len; i++) {
      var operation = batch[i];

      var cache = getCacheFor(this, operation.prefix);

      if (operation.type === 'put') {
        cache.set(operation.key, operation.value);
      } else {
        cache.set(operation.key, null);
      }
    }
    this._batch = this._batch.concat(batch);
  }

  execute(db, callback) {
    var keys = new Set();
    var uniqBatches = [];

    // remove duplicates; last one wins
    for (var i = this._batch.length - 1; i >= 0; i--) {
      var operation = this._batch[i];
      var lookupKey = operation.prefix.prefix()[0] + '\xff' + operation.key;
      if (keys.has(lookupKey)) {
        continue;
      }
      keys.add(lookupKey);
      uniqBatches.push(operation);
    }

    db.batch(uniqBatches, callback);
  }
}

var DOC_STORE = 'document-store';
var BY_SEQ_STORE = 'by-sequence';
var ATTACHMENT_STORE = 'attach-store';
var BINARY_STORE = 'attach-binary-store';
var LOCAL_STORE = 'local-store';
var META_STORE = 'meta-store';

// leveldb barks if we try to open a db multiple times
// so we cache opened connections here for initstore()
var dbStores = new Map();

// store the value of update_seq in the by-sequence store the key name will
// never conflict, since the keys in the by-sequence store are integers
var UPDATE_SEQ_KEY = '_local_last_update_seq';
var DOC_COUNT_KEY = '_local_doc_count';
var UUID_KEY = '_local_uuid';

var MD5_PREFIX = 'md5-';

var safeJsonEncoding = {
  encode: safeJsonStringify,
  decode: safeJsonParse,
  buffer: false,
  type: 'cheap-json'
};

var levelChanges = new Changes();

// winningRev and deleted are performance-killers, but
// in newer versions of PouchDB, they are cached on the metadata
function getWinningRev(metadata) {
  return 'winningRev' in metadata ?
    metadata.winningRev : winningRev(metadata);
}

function getIsDeleted(metadata, winningRev) {
  return 'deleted' in metadata ?
    metadata.deleted : isDeleted(metadata, winningRev);
}

function fetchAttachment(att, stores, opts) {
  var type = att.content_type;
  return new Promise(function (resolve, reject) {
    stores.binaryStore.get(att.digest, function (err, buffer) {
      var data;
      if (err) {
        /* istanbul ignore if */
        if (err.name !== 'NotFoundError') {
          return reject(err);
        } else {
          // empty
          if (!opts.binary) {
            data = '';
          } else {
            data = binStringToBluffer('', type);
          }
        }
      } else { // non-empty
        if (opts.binary) {
          data = readAsBlobOrBuffer(buffer, type);
        } else {
          data = buffer.toString('base64');
        }
      }
      delete att.stub;
      delete att.length;
      att.data = data;
      resolve();
    });
  });
}

function fetchAttachments(results, stores, opts) {
  var atts = [];
  results.forEach(function (row) {
    if (!(row.doc && row.doc._attachments)) {
      return;
    }
    var attNames = Object.keys(row.doc._attachments);
    attNames.forEach(function (attName) {
      var att = row.doc._attachments[attName];
      if (!('data' in att)) {
        atts.push(att);
      }
    });
  });

  return Promise.all(atts.map(function (att) {
    return fetchAttachment(att, stores, opts);
  }));
}

function LevelPouch(opts, callback) {
  opts = clone(opts);
  var api = this;
  var instanceId;
  var stores = {};
  var revLimit = opts.revs_limit;
  var db;
  var name = opts.name;
  // TODO: this is undocumented and unused probably
  /* istanbul ignore else */
  if (typeof opts.createIfMissing === 'undefined') {
    opts.createIfMissing = true;
  }

  var leveldown = opts.db;

  var dbStore;
  var leveldownName = functionName(leveldown);
  if (dbStores.has(leveldownName)) {
    dbStore = dbStores.get(leveldownName);
  } else {
    dbStore = new Map();
    dbStores.set(leveldownName, dbStore);
  }
  if (dbStore.has(name)) {
    db = dbStore.get(name);
    afterDBCreated();
  } else {
    dbStore.set(name, sublevelPouch(levelup(leveldown(name), opts, function (err) {
      /* istanbul ignore if */
      if (err) {
        dbStore.delete(name);
        return callback(err);
      }
      db = dbStore.get(name);
      db._docCount  = -1;
      db._queue = new Deque();
      /* istanbul ignore else */
      if (typeof opts.migrate === 'object') { // migration for leveldown
        opts.migrate.doMigrationOne(name, db, afterDBCreated);
      } else {
        afterDBCreated();
      }
    })));
  }

  function afterDBCreated() {
    stores.docStore = db.sublevel(DOC_STORE, {valueEncoding: safeJsonEncoding});
    stores.bySeqStore = db.sublevel(BY_SEQ_STORE, {valueEncoding: 'json'});
    stores.attachmentStore =
      db.sublevel(ATTACHMENT_STORE, {valueEncoding: 'json'});
    stores.binaryStore = db.sublevel(BINARY_STORE, {valueEncoding: 'binary'});
    stores.localStore = db.sublevel(LOCAL_STORE, {valueEncoding: 'json'});
    stores.metaStore = db.sublevel(META_STORE, {valueEncoding: 'json'});
    /* istanbul ignore else */
    if (typeof opts.migrate === 'object') { // migration for leveldown
      opts.migrate.doMigrationTwo(db, stores, afterLastMigration);
    } else {
      afterLastMigration();
    }
  }

  function afterLastMigration() {
    stores.metaStore.get(UPDATE_SEQ_KEY, function (err, value) {
      if (typeof db._updateSeq === 'undefined') {
        db._updateSeq = value || 0;
      }
      stores.metaStore.get(DOC_COUNT_KEY, function (err, value) {
        db._docCount = !err ? value : 0;
        stores.metaStore.get(UUID_KEY, function (err, value) {
          instanceId = !err ? value : uuid();
          stores.metaStore.put(UUID_KEY, instanceId, function () {
            nextTick(function () {
              callback(null, api);
            });
          });
        });
      });
    });
  }

  function countDocs(callback) {
    /* istanbul ignore if */
    if (db.isClosed()) {
      return callback(new Error('database is closed'));
    }
    return callback(null, db._docCount); // use cached value
  }

  api._remote = false;
  /* istanbul ignore next */
  api.type = function () {
    return 'leveldb';
  };

  api._id = function (callback) {
    callback(null, instanceId);
  };

  api._info = function (callback) {
    var res = {
      doc_count: db._docCount,
      update_seq: db._updateSeq,
      backend_adapter: functionName(leveldown)
    };
    return nextTick(function () {
      callback(null, res);
    });
  };

  function tryCode(fun, args) {
    try {
      fun.apply(null, args);
    } catch (err) {
      args[args.length - 1](err);
    }
  }

  function executeNext() {
    var firstTask = db._queue.peekFront();

    if (firstTask.type === 'read') {
      runReadOperation(firstTask);
    } else { // write, only do one at a time
      runWriteOperation(firstTask);
    }
  }

  function runReadOperation(firstTask) {
    // do multiple reads at once simultaneously, because it's safe

    var readTasks = [firstTask];
    var i = 1;
    var nextTask = db._queue.get(i);
    while (typeof nextTask !== 'undefined' && nextTask.type === 'read') {
      readTasks.push(nextTask);
      i++;
      nextTask = db._queue.get(i);
    }

    var numDone = 0;

    readTasks.forEach(function (readTask) {
      var args = readTask.args;
      var callback = args[args.length - 1];
      args[args.length - 1] = function (...cbArgs) {
        callback.apply(null, cbArgs);
        if (++numDone === readTasks.length) {
          nextTick(function () {
            // all read tasks have finished
            readTasks.forEach(function () {
              db._queue.shift();
            });
            if (db._queue.length) {
              executeNext();
            }
          });
        }
      };
      tryCode(readTask.fun, args);
    });
  }

  function runWriteOperation(firstTask) {
    var args = firstTask.args;
    var callback = args[args.length - 1];
    args[args.length - 1] = function (...cbArgs) {
      callback.apply(null, cbArgs);
      nextTick(function () {
        db._queue.shift();
        if (db._queue.length) {
          executeNext();
        }
      });
    };
    tryCode(firstTask.fun, args);
  }

  // all read/write operations to the database are done in a queue,
  // similar to how websql/idb works. this avoids problems such
  // as e.g. compaction needing to have a lock on the database while
  // it updates stuff. in the future we can revisit this.
  function writeLock(fun) {
    return function (...args) {
      db._queue.push({
        fun: fun,
        args: args,
        type: 'write'
      });

      if (db._queue.length === 1) {
        nextTick(executeNext);
      }
    };
  }

  // same as the writelock, but multiple can run at once
  function readLock(fun) {
    return function (...args) {
      db._queue.push({
        fun: fun,
        args: args,
        type: 'read'
      });

      if (db._queue.length === 1) {
        nextTick(executeNext);
      }
    };
  }

  function formatSeq(n) {
    return ('0000000000000000' + n).slice(-16);
  }

  function parseSeq(s) {
    return parseInt(s, 10);
  }

  api._get = readLock(function (id, opts, callback) {
    opts = clone(opts);

    stores.docStore.get(id, function (err, metadata) {

      if (err || !metadata) {
        return callback(createError(MISSING_DOC, 'missing'));
      }

      var rev;
      if (!opts.rev) {
        rev = getWinningRev(metadata);
        var deleted = getIsDeleted(metadata, rev);
        if (deleted) {
          return callback(createError(MISSING_DOC, "deleted"));
        }
      } else {
        rev = opts.latest ? latest(opts.rev, metadata) : opts.rev;
      }

      var seq = metadata.rev_map[rev];

      stores.bySeqStore.get(formatSeq(seq), function (err, doc) {
        if (!doc) {
          return callback(createError(MISSING_DOC));
        }
        /* istanbul ignore if */
        if ('_id' in doc && doc._id !== metadata.id) {
          // this failing implies something very wrong
          return callback(new Error('wrong doc returned'));
        }
        doc._id = metadata.id;
        if ('_rev' in doc) {
          /* istanbul ignore if */
          if (doc._rev !== rev) {
            // this failing implies something very wrong
            return callback(new Error('wrong doc returned'));
          }
        } else {
          // we didn't always store this
          doc._rev = rev;
        }
        return callback(null, {doc: doc, metadata: metadata});
      });
    });
  });

  // not technically part of the spec, but if putAttachment has its own
  // method...
  api._getAttachment = function (docId, attachId, attachment, opts, callback) {
    var digest = attachment.digest;
    var type = attachment.content_type;

    stores.binaryStore.get(digest, function (err, attach) {
      if (err) {
        /* istanbul ignore if */
        if (err.name !== 'NotFoundError') {
          return callback(err);
        }
        // Empty attachment
        return callback(null, opts.binary ? createEmptyBlobOrBuffer(type) : '');
      }

      if (opts.binary) {
        callback(null, readAsBlobOrBuffer(attach, type));
      } else {
        callback(null, attach.toString('base64'));
      }
    });
  };

  api._bulkDocs = writeLock(function (req, opts, callback) {
    var newEdits = opts.new_edits;
    var results = new Array(req.docs.length);
    var fetchedDocs = new Map();
    var stemmedRevs = new Map();

    var txn = new LevelTransaction();
    var docCountDelta = 0;
    var newUpdateSeq = db._updateSeq;

    // parse the docs and give each a sequence number
    var userDocs = req.docs;
    var docInfos = userDocs.map(function (doc) {
      if (doc._id && isLocalId(doc._id)) {
        return doc;
      }
      var newDoc = parseDoc(doc, newEdits, api.__opts);

      if (newDoc.metadata && !newDoc.metadata.rev_map) {
        newDoc.metadata.rev_map = {};
      }

      return newDoc;
    });
    var infoErrors = docInfos.filter(function (doc) {
      return doc.error;
    });

    if (infoErrors.length) {
      return callback(infoErrors[0]);
    }

    // verify any stub attachments as a precondition test

    function verifyAttachment(digest, callback) {
      txn.get(stores.attachmentStore, digest, function (levelErr) {
        if (levelErr) {
          var err = createError(MISSING_STUB,
                                'unknown stub attachment with digest ' +
                                digest);
          callback(err);
        } else {
          callback();
        }
      });
    }

    function verifyAttachments(finish) {
      var digests = [];
      userDocs.forEach(function (doc) {
        if (doc && doc._attachments) {
          Object.keys(doc._attachments).forEach(function (filename) {
            var att = doc._attachments[filename];
            if (att.stub) {
              digests.push(att.digest);
            }
          });
        }
      });
      if (!digests.length) {
        return finish();
      }
      var numDone = 0;
      var err;

      digests.forEach(function (digest) {
        verifyAttachment(digest, function (attErr) {
          if (attErr && !err) {
            err = attErr;
          }

          if (++numDone === digests.length) {
            finish(err);
          }
        });
      });
    }

    function fetchExistingDocs(finish) {
      var numDone = 0;
      var overallErr;
      function checkDone() {
        if (++numDone === userDocs.length) {
          return finish(overallErr);
        }
      }

      userDocs.forEach(function (doc) {
        if (doc._id && isLocalId(doc._id)) {
          // skip local docs
          return checkDone();
        }
        txn.get(stores.docStore, doc._id, function (err, info) {
          if (err) {
            /* istanbul ignore if */
            if (err.name !== 'NotFoundError') {
              overallErr = err;
            }
          } else {
            fetchedDocs.set(doc._id, info);
          }
          checkDone();
        });
      });
    }

    function compact(revsMap, callback) {
      var promise = Promise.resolve();
      revsMap.forEach(function (revs, docId) {
        // TODO: parallelize, for now need to be sequential to
        // pass orphaned attachment tests
        promise = promise.then(function () {
          return new Promise(function (resolve, reject) {
            api._doCompactionNoLock(docId, revs, {ctx: txn}, function (err) {
              /* istanbul ignore if */
              if (err) {
                return reject(err);
              }
              resolve();
            });
          });
        });
      });

      promise.then(function () {
        callback();
      }, callback);
    }

    function autoCompact(callback) {
      var revsMap = new Map();
      fetchedDocs.forEach(function (metadata, docId) {
        revsMap.set(docId, compactTree(metadata));
      });
      compact(revsMap, callback);
    }

    function finish() {
      compact(stemmedRevs, function (error) {
        /* istanbul ignore if */
        if (error) {
          complete(error);
        }
        if (api.auto_compaction) {
          return autoCompact(complete);
        }
        complete();
      });
    }

    function writeDoc(docInfo, winningRev, winningRevIsDeleted, newRevIsDeleted,
                      isUpdate, delta, resultsIdx, callback2) {
      docCountDelta += delta;

      var err = null;
      var recv = 0;

      docInfo.metadata.winningRev = winningRev;
      docInfo.metadata.deleted = winningRevIsDeleted;

      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      if (newRevIsDeleted) {
        docInfo.data._deleted = true;
      }

      if (docInfo.stemmedRevs.length) {
        stemmedRevs.set(docInfo.metadata.id, docInfo.stemmedRevs);
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) :
        [];

      function attachmentSaved(attachmentErr) {
        recv++;
        if (!err) {
          /* istanbul ignore if */
          if (attachmentErr) {
            err = attachmentErr;
            callback2(err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      function onMD5Load(doc, key, data, attachmentSaved) {
        return function (result) {
          saveAttachment(doc, MD5_PREFIX + result, key, data, attachmentSaved);
        };
      }

      function doMD5(doc, key, attachmentSaved) {
        return function (data) {
          binaryMd5(data, onMD5Load(doc, key, data, attachmentSaved));
        };
      }

      for (var i = 0; i < attachments.length; i++) {
        var key = attachments[i];
        var att = docInfo.data._attachments[key];

        if (att.stub) {
          // still need to update the refs mapping
          var id = docInfo.data._id;
          var rev = docInfo.data._rev;
          saveAttachmentRefs(id, rev, att.digest, attachmentSaved);
          continue;
        }
        var data;
        if (typeof att.data === 'string') {
          // input is assumed to be a base64 string
          try {
            data = atob(att.data);
          } catch (e) {
            callback(createError(BAD_ARG,
                     'Attachment is not a valid base64 string'));
            return;
          }
          doMD5(docInfo, key, attachmentSaved)(data);
        } else {
          prepareAttachmentForStorage(att.data,
            doMD5(docInfo, key, attachmentSaved));
        }
      }

      function finish() {
        var seq = docInfo.metadata.rev_map[docInfo.metadata.rev];
        /* istanbul ignore if */
        if (seq) {
          // check that there aren't any existing revisions with the same
          // revision id, else we shouldn't do anything
          return callback2();
        }
        seq = ++newUpdateSeq;
        docInfo.metadata.rev_map[docInfo.metadata.rev] =
          docInfo.metadata.seq = seq;
        var seqKey = formatSeq(seq);
        var batch = [{
          key: seqKey,
          value: docInfo.data,
          prefix: stores.bySeqStore,
          type: 'put'
        }, {
          key: docInfo.metadata.id,
          value: docInfo.metadata,
          prefix: stores.docStore,
          type: 'put'
        }];
        txn.batch(batch);
        results[resultsIdx] = {
          ok: true,
          id: docInfo.metadata.id,
          rev: docInfo.metadata.rev
        };
        fetchedDocs.set(docInfo.metadata.id, docInfo.metadata);
        callback2();
      }

      if (!attachments.length) {
        finish();
      }
    }

    // attachments are queued per-digest, otherwise the refs could be
    // overwritten by concurrent writes in the same bulkDocs session
    var attachmentQueues = {};

    function saveAttachmentRefs(id, rev, digest, callback) {

      function fetchAtt() {
        return new Promise(function (resolve, reject) {
          txn.get(stores.attachmentStore, digest, function (err, oldAtt) {
            /* istanbul ignore if */
            if (err && err.name !== 'NotFoundError') {
              return reject(err);
            }
            resolve(oldAtt);
          });
        });
      }

      function saveAtt(oldAtt) {
        var ref = [id, rev].join('@');
        var newAtt = {};

        if (oldAtt) {
          if (oldAtt.refs) {
            // only update references if this attachment already has them
            // since we cannot migrate old style attachments here without
            // doing a full db scan for references
            newAtt.refs = oldAtt.refs;
            newAtt.refs[ref] = true;
          }
        } else {
          newAtt.refs = {};
          newAtt.refs[ref] = true;
        }

        return new Promise(function (resolve) {
          txn.batch([{
            type: 'put',
            prefix: stores.attachmentStore,
            key: digest,
            value: newAtt
          }]);
          resolve(!oldAtt);
        });
      }

      // put attachments in a per-digest queue, to avoid two docs with the same
      // attachment overwriting each other
      var queue = attachmentQueues[digest] || Promise.resolve();
      attachmentQueues[digest] = queue.then(function () {
        return fetchAtt().then(saveAtt).then(function (isNewAttachment) {
          callback(null, isNewAttachment);
        }, callback);
      });
    }

    function saveAttachment(docInfo, digest, key, data, callback) {
      var att = docInfo.data._attachments[key];
      delete att.data;
      att.digest = digest;
      att.length = data.length;
      var id = docInfo.metadata.id;
      var rev = docInfo.metadata.rev;
      att.revpos = parseInt(rev, 10);

      saveAttachmentRefs(id, rev, digest, function (err, isNewAttachment) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        // do not try to store empty attachments
        if (data.length === 0) {
          return callback(err);
        }
        if (!isNewAttachment) {
          // small optimization - don't bother writing it again
          return callback(err);
        }
        txn.batch([{
          type: 'put',
          prefix: stores.binaryStore,
          key: digest,
          value: Buffer.from(data, 'binary')
        }]);
        callback();
      });
    }

    function complete(err) {
      /* istanbul ignore if */
      if (err) {
        return nextTick(function () {
          callback(err);
        });
      }
      txn.batch([
        {
          prefix: stores.metaStore,
          type: 'put',
          key: UPDATE_SEQ_KEY,
          value: newUpdateSeq
        },
        {
          prefix: stores.metaStore,
          type: 'put',
          key: DOC_COUNT_KEY,
          value: db._docCount + docCountDelta
        }
      ]);
      txn.execute(db, function (err) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        db._docCount += docCountDelta;
        db._updateSeq = newUpdateSeq;
        levelChanges.notify(name);
        nextTick(function () {
          callback(null, results);
        });
      });
    }

    if (!docInfos.length) {
      return callback(null, []);
    }

    verifyAttachments(function (err) {
      if (err) {
        return callback(err);
      }
      fetchExistingDocs(function (err) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        processDocs(revLimit, docInfos, api, fetchedDocs, txn, results,
                    writeDoc, opts, finish);
      });
    });
  });
  api._allDocs = function (opts, callback) {
    if ('keys' in opts) {
      return allDocsKeysQuery(this, opts);
    }
    return readLock(function (opts, callback) {
      opts = clone(opts);
      countDocs(function (err, docCount) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        var readstreamOpts = {};
        var skip = opts.skip || 0;
        if (opts.startkey) {
          readstreamOpts.gte = opts.startkey;
        }
        if (opts.endkey) {
          readstreamOpts.lte = opts.endkey;
        }
        if (opts.key) {
          readstreamOpts.gte = readstreamOpts.lte = opts.key;
        }
        if (opts.descending) {
          readstreamOpts.reverse = true;
          // switch start and ends
          var tmp = readstreamOpts.lte;
          readstreamOpts.lte = readstreamOpts.gte;
          readstreamOpts.gte = tmp;
        }
        var limit;
        if (typeof opts.limit === 'number') {
          limit = opts.limit;
        }
        if (limit === 0 ||
            ('gte' in readstreamOpts && 'lte' in readstreamOpts &&
            readstreamOpts.gte > readstreamOpts.lte)) {
          // should return 0 results when start is greater than end.
          // normally level would "fix" this for us by reversing the order,
          // so short-circuit instead
          var returnVal = {
            total_rows: docCount,
            offset: opts.skip,
            rows: []
          };
          /* istanbul ignore if */
          if (opts.update_seq) {
            returnVal.update_seq = db._updateSeq;
          }
          return callback(null, returnVal);
        }
        var results = [];
        var docstream = stores.docStore.readStream(readstreamOpts);

        var throughStream = obj(function (entry, _, next) {
          var metadata = entry.value;
          // winningRev and deleted are performance-killers, but
          // in newer versions of PouchDB, they are cached on the metadata
          var winningRev = getWinningRev(metadata);
          var deleted = getIsDeleted(metadata, winningRev);
          if (!deleted) {
            if (skip-- > 0) {
              next();
              return;
            } else if (typeof limit === 'number' && limit-- <= 0) {
              docstream.unpipe();
              docstream.destroy();
              next();
              return;
            }
          } else if (opts.deleted !== 'ok') {
            next();
            return;
          }
          function allDocsInner(data) {
            var doc = {
              id: metadata.id,
              key: metadata.id,
              value: {
                rev: winningRev
              }
            };
            if (opts.include_docs) {
              doc.doc = data;
              doc.doc._rev = doc.value.rev;
              if (opts.conflicts) {
                var conflicts = collectConflicts(metadata);
                if (conflicts.length) {
                  doc.doc._conflicts = conflicts;
                }
              }
              for (var att in doc.doc._attachments) {
                if (Object.prototype.hasOwnProperty.call(doc.doc._attachments, att)) {
                  doc.doc._attachments[att].stub = true;
                }
              }
            }
            if (opts.inclusive_end === false && metadata.id === opts.endkey) {
              return next();
            } else if (deleted) {
              if (opts.deleted === 'ok') {
                doc.value.deleted = true;
                doc.doc = null;
              } else {
                /* istanbul ignore next */
                return next();
              }
            }
            results.push(doc);
            next();
          }
          if (opts.include_docs) {
            var seq = metadata.rev_map[winningRev];
            stores.bySeqStore.get(formatSeq(seq), function (err, data) {
              allDocsInner(data);
            });
          }
          else {
            allDocsInner();
          }
        }, function (next) {
          Promise.resolve().then(function () {
            if (opts.include_docs && opts.attachments) {
              return fetchAttachments(results, stores, opts);
            }
          }).then(function () {
            var returnVal = {
              total_rows: docCount,
              offset: opts.skip,
              rows: results
            };

            /* istanbul ignore if */
            if (opts.update_seq) {
              returnVal.update_seq = db._updateSeq;
            }
            callback(null, returnVal);
          }, callback);
          next();
        }).on('unpipe', function () {
          throughStream.end();
        });

        docstream.on('error', callback);

        docstream.pipe(throughStream);
      });
    })(opts, callback);
  };

  api._changes = function (opts) {
    opts = clone(opts);

    if (opts.continuous) {
      var id = name + ':' + uuid();
      levelChanges.addListener(name, id, api, opts);
      levelChanges.notify(name);
      return {
        cancel: function () {
          levelChanges.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending;
    var results = [];
    var lastSeq = opts.since || 0;
    var called = 0;
    var streamOpts = {
      reverse: descending
    };
    var limit;
    if ('limit' in opts && opts.limit > 0) {
      limit = opts.limit;
    }
    if (!streamOpts.reverse) {
      streamOpts.start = formatSeq(opts.since || 0);
    }

    var docIds = opts.doc_ids && new Set(opts.doc_ids);
    var filter = filterChange(opts);
    var docIdsToMetadata = new Map();

    function complete() {
      opts.done = true;
      if (opts.return_docs && opts.limit) {
        /* istanbul ignore if */
        if (opts.limit < results.length) {
          results.length = opts.limit;
        }
      }
      changeStream.unpipe(throughStream);
      changeStream.destroy();
      if (!opts.continuous && !opts.cancelled) {
        if (opts.include_docs && opts.attachments && opts.return_docs) {
          fetchAttachments(results, stores, opts).then(function () {
            opts.complete(null, {results: results, last_seq: lastSeq});
          });
        } else {
          opts.complete(null, {results: results, last_seq: lastSeq});
        }
      }
    }
    var changeStream = stores.bySeqStore.readStream(streamOpts);
    var throughStream = obj(function (data, _, next) {
      if (limit && called >= limit) {
        complete();
        return next();
      }
      if (opts.cancelled || opts.done) {
        return next();
      }

      var seq = parseSeq(data.key);
      var doc = data.value;

      if (seq === opts.since && !descending) {
        // couchdb ignores `since` if descending=true
        return next();
      }

      if (docIds && !docIds.has(doc._id)) {
        return next();
      }

      var metadata;

      function onGetMetadata(metadata) {
        var winningRev = getWinningRev(metadata);

        function onGetWinningDoc(winningDoc) {

          var change = opts.processChange(winningDoc, metadata, opts);
          change.seq = metadata.seq;

          var filtered = filter(change);
          if (typeof filtered === 'object') {
            return opts.complete(filtered);
          }

          if (filtered) {
            called++;

            if (opts.attachments && opts.include_docs) {
              // fetch attachment immediately for the benefit
              // of live listeners
              fetchAttachments([change], stores, opts).then(function () {
                opts.onChange(change);
              });
            } else {
              opts.onChange(change);
            }

            if (opts.return_docs) {
              results.push(change);
            }
          }
          next();
        }

        if (metadata.seq !== seq) {
          // some other seq is later
          return next();
        }

        lastSeq = seq;

        if (winningRev === doc._rev) {
          return onGetWinningDoc(doc);
        }

        // fetch the winner

        var winningSeq = metadata.rev_map[winningRev];

        stores.bySeqStore.get(formatSeq(winningSeq), function (err, doc) {
          onGetWinningDoc(doc);
        });
      }

      metadata = docIdsToMetadata.get(doc._id);
      if (metadata) { // cached
        return onGetMetadata(metadata);
      }
      // metadata not cached, have to go fetch it
      stores.docStore.get(doc._id, function (err, metadata) {
        /* istanbul ignore if */
        if (opts.cancelled || opts.done || db.isClosed() ||
          isLocalId(metadata.id)) {
          return next();
        }
        docIdsToMetadata.set(doc._id, metadata);
        onGetMetadata(metadata);
      });
    }, function (next) {
      if (opts.cancelled) {
        return next();
      }
      if (opts.return_docs && opts.limit) {
        /* istanbul ignore if */
        if (opts.limit < results.length) {
          results.length = opts.limit;
        }
      }

      next();
    }).on('unpipe', function () {
      throughStream.end();
      complete();
    });
    changeStream.pipe(throughStream);
    return {
      cancel: function () {
        opts.cancelled = true;
        complete();
      }
    };
  };

  api._close = function (callback) {
    /* istanbul ignore if */
    if (db.isClosed()) {
      return callback(createError(NOT_OPEN));
    }
    db.close(function (err) {
      /* istanbul ignore if */
      if (err) {
        callback(err);
      } else {
        dbStore.delete(name);

        var adapterName = functionName(leveldown);
        var adapterStore = dbStores.get(adapterName);
        var viewNamePrefix = PouchDB.prefix + name + "-mrview-";
        var keys = [...adapterStore.keys()].filter(k => k.includes(viewNamePrefix));
        keys.forEach(key => {
          var eventEmitter = adapterStore.get(key);
          eventEmitter.removeAllListeners();
          eventEmitter.close();
          adapterStore.delete(key);
        });

        callback();
      }
    });
  };

  api._getRevisionTree = function (docId, callback) {
    stores.docStore.get(docId, function (err, metadata) {
      if (err) {
        callback(createError(MISSING_DOC));
      } else {
        callback(null, metadata.rev_tree);
      }
    });
  };

  api._doCompaction = writeLock(function (docId, revs, opts, callback) {
    api._doCompactionNoLock(docId, revs, opts, callback);
  });

  // the NoLock version is for use by bulkDocs
  api._doCompactionNoLock = function (docId, revs, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (!revs.length) {
      return callback();
    }
    var txn = opts.ctx || new LevelTransaction();

    txn.get(stores.docStore, docId, function (err, metadata) {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }
      var seqs = revs.map(function (rev) {
        var seq = metadata.rev_map[rev];
        delete metadata.rev_map[rev];
        return seq;
      });
      traverseRevTree(metadata.rev_tree, function (isLeaf, pos,
                                                         revHash, ctx, opts) {
        var rev = pos + '-' + revHash;
        if (revs.indexOf(rev) !== -1) {
          opts.status = 'missing';
        }
      });

      var batch = [];
      batch.push({
        key: metadata.id,
        value: metadata,
        type: 'put',
        prefix: stores.docStore
      });

      var digestMap = {};
      var numDone = 0;
      var overallErr;
      function checkDone(err) {
        /* istanbul ignore if */
        if (err) {
          overallErr = err;
        }
        if (++numDone === revs.length) { // done
          /* istanbul ignore if */
          if (overallErr) {
            return callback(overallErr);
          }
          deleteOrphanedAttachments();
        }
      }

      function finish(err) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        txn.batch(batch);
        if (opts.ctx) {
          // don't execute immediately
          return callback();
        }
        txn.execute(db, callback);
      }

      function deleteOrphanedAttachments() {
        var possiblyOrphanedAttachments = Object.keys(digestMap);
        if (!possiblyOrphanedAttachments.length) {
          return finish();
        }
        var numDone = 0;
        var overallErr;
        function checkDone(err) {
          /* istanbul ignore if */
          if (err) {
            overallErr = err;
          }
          if (++numDone === possiblyOrphanedAttachments.length) {
            finish(overallErr);
          }
        }
        var refsToDelete = new Map();
        revs.forEach(function (rev) {
          refsToDelete.set(docId + '@' + rev, true);
        });
        possiblyOrphanedAttachments.forEach(function (digest) {
          txn.get(stores.attachmentStore, digest, function (err, attData) {
            /* istanbul ignore if */
            if (err) {
              if (err.name === 'NotFoundError') {
                return checkDone();
              } else {
                return checkDone(err);
              }
            }
            var refs = Object.keys(attData.refs || {}).filter(function (ref) {
              return !refsToDelete.has(ref);
            });
            var newRefs = {};
            refs.forEach(function (ref) {
              newRefs[ref] = true;
            });
            if (refs.length) { // not orphaned
              batch.push({
                key: digest,
                type: 'put',
                value: {refs: newRefs},
                prefix: stores.attachmentStore
              });
            } else { // orphaned, can safely delete
              batch = batch.concat([{
                key: digest,
                type: 'del',
                prefix: stores.attachmentStore
              }, {
                key: digest,
                type: 'del',
                prefix: stores.binaryStore
              }]);
            }
            checkDone();
          });
        });
      }

      seqs.forEach(function (seq) {
        batch.push({
          key: formatSeq(seq),
          type: 'del',
          prefix: stores.bySeqStore
        });
        txn.get(stores.bySeqStore, formatSeq(seq), function (err, doc) {
          /* istanbul ignore if */
          if (err) {
            if (err.name === 'NotFoundError') {
              return checkDone();
            } else {
              return checkDone(err);
            }
          }
          var atts = Object.keys(doc._attachments || {});
          atts.forEach(function (attName) {
            var digest = doc._attachments[attName].digest;
            digestMap[digest] = true;
          });
          checkDone();
        });
      });
    });
  };

  api._getLocal = function (id, callback) {
    stores.localStore.get(id, function (err, doc) {
      if (err) {
        callback(createError(MISSING_DOC));
      } else {
        callback(null, doc);
      }
    });
  };

  api._putLocal = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (opts.ctx) {
      api._putLocalNoLock(doc, opts, callback);
    } else {
      api._putLocalWithLock(doc, opts, callback);
    }
  };

  api._putLocalWithLock = writeLock(function (doc, opts, callback) {
    api._putLocalNoLock(doc, opts, callback);
  });

  // the NoLock version is for use by bulkDocs
  api._putLocalNoLock = function (doc, opts, callback) {
    delete doc._revisions; // ignore this, trust the rev
    var oldRev = doc._rev;
    var id = doc._id;

    var txn = opts.ctx || new LevelTransaction();

    txn.get(stores.localStore, id, function (err, resp) {
      if (err && oldRev) {
        return callback(createError(REV_CONFLICT));
      }
      if (resp && resp._rev !== oldRev) {
        return callback(createError(REV_CONFLICT));
      }
      doc._rev =
          oldRev ? '0-' + (parseInt(oldRev.split('-')[1], 10) + 1) : '0-1';
      var batch = [
        {
          type: 'put',
          prefix: stores.localStore,
          key: id,
          value: doc
        }
      ];

      txn.batch(batch);
      var ret = {ok: true, id: doc._id, rev: doc._rev};

      if (opts.ctx) {
        // don't execute immediately
        return callback(null, ret);
      }
      txn.execute(db, function (err) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        callback(null, ret);
      });
    });
  };

  api._removeLocal = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (opts.ctx) {
      api._removeLocalNoLock(doc, opts, callback);
    } else {
      api._removeLocalWithLock(doc, opts, callback);
    }
  };

  api._removeLocalWithLock = writeLock(function (doc, opts, callback) {
    api._removeLocalNoLock(doc, opts, callback);
  });

  // the NoLock version is for use by bulkDocs
  api._removeLocalNoLock = function (doc, opts, callback) {
    var txn = opts.ctx || new LevelTransaction();
    txn.get(stores.localStore, doc._id, function (err, resp) {
      if (err) {
        /* istanbul ignore if */
        if (err.name !== 'NotFoundError') {
          return callback(err);
        } else {
          return callback(createError(MISSING_DOC));
        }
      }
      if (resp._rev !== doc._rev) {
        return callback(createError(REV_CONFLICT));
      }
      txn.batch([{
        prefix: stores.localStore,
        type: 'del',
        key: doc._id
      }]);
      var ret = {ok: true, id: doc._id, rev: '0-0'};
      if (opts.ctx) {
        // don't execute immediately
        return callback(null, ret);
      }
      txn.execute(db, function (err) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        callback(null, ret);
      });
    });
  };

  // close and delete open leveldb stores
  api._destroy = function (opts, callback) {
    var dbStore;
    var leveldownName = functionName(leveldown);
    /* istanbul ignore else */
    if (dbStores.has(leveldownName)) {
      dbStore = dbStores.get(leveldownName);
    } else {
      return callDestroy(name, callback);
    }

    /* istanbul ignore else */
    if (dbStore.has(name)) {
      levelChanges.removeAllListeners(name);

      dbStore.get(name).close(function () {
        dbStore.delete(name);
        callDestroy(name, callback);
      });
    } else {
      callDestroy(name, callback);
    }
  };
  function callDestroy(name, cb) {
    // May not exist if leveldown is backed by memory adapter
    /* istanbul ignore else */
    if ('destroy' in leveldown) {
      leveldown.destroy(name, cb);
    } else {
      cb(null);
    }
  }
}

export { LevelPouch as L, obj as o };
