import { e as events, a as events$1, r as require$$3$1 } from './__node-resolve_empty-5ffda92e.js';
import { g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import require$$3 from 'stream';

var buffer = {};

var base64Js = {};

base64Js.byteLength = byteLength;
base64Js.toByteArray = toByteArray;
base64Js.fromByteArray = fromByteArray;

var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i];
  revLookup[code.charCodeAt(i)] = i;
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62;
revLookup['_'.charCodeAt(0)] = 63;

function getLens (b64) {
  var len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=');
  if (validLen === -1) validLen = len;

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4);

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64);
  var validLen = lens[0];
  var placeHoldersLen = lens[1];
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp;
  var lens = getLens(b64);
  var validLen = lens[0];
  var placeHoldersLen = lens[1];

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

  var curByte = 0;

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen;

  var i;
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)];
    arr[curByte++] = (tmp >> 16) & 0xFF;
    arr[curByte++] = (tmp >> 8) & 0xFF;
    arr[curByte++] = tmp & 0xFF;
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4);
    arr[curByte++] = tmp & 0xFF;
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2);
    arr[curByte++] = (tmp >> 8) & 0xFF;
    arr[curByte++] = tmp & 0xFF;
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF);
    output.push(tripletToBase64(tmp));
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
  var parts = [];
  var maxChunkLength = 16383; // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    );
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    );
  }

  return parts.join('')
}

var ieee754 = {};

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */

ieee754.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = (nBytes * 8) - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? (nBytes - 1) : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
};

ieee754.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = (nBytes * 8) - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
  var i = isLE ? 0 : (nBytes - 1);
  var d = isLE ? 1 : -1;
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
};

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

(function (exports) {

	var base64 = base64Js;
	var ieee754$1 = ieee754;
	var customInspectSymbol =
	  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
	    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
	    : null;

	exports.Buffer = Buffer;
	exports.SlowBuffer = SlowBuffer;
	exports.INSPECT_MAX_BYTES = 50;

	var K_MAX_LENGTH = 0x7fffffff;
	exports.kMaxLength = K_MAX_LENGTH;

	/**
	 * If `Buffer.TYPED_ARRAY_SUPPORT`:
	 *   === true    Use Uint8Array implementation (fastest)
	 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
	 *               implementation (most compatible, even IE6)
	 *
	 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
	 * Opera 11.6+, iOS 4.2+.
	 *
	 * We report that the browser does not support typed arrays if the are not subclassable
	 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
	 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
	 * for __proto__ and has a buggy typed array implementation.
	 */
	Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();

	if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
	    typeof console.error === 'function') {
	  console.error(
	    'This browser lacks typed array (Uint8Array) support which is required by ' +
	    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
	  );
	}

	function typedArraySupport () {
	  // Can typed array instances can be augmented?
	  try {
	    var arr = new Uint8Array(1);
	    var proto = { foo: function () { return 42 } };
	    Object.setPrototypeOf(proto, Uint8Array.prototype);
	    Object.setPrototypeOf(arr, proto);
	    return arr.foo() === 42
	  } catch (e) {
	    return false
	  }
	}

	Object.defineProperty(Buffer.prototype, 'parent', {
	  enumerable: true,
	  get: function () {
	    if (!Buffer.isBuffer(this)) return undefined
	    return this.buffer
	  }
	});

	Object.defineProperty(Buffer.prototype, 'offset', {
	  enumerable: true,
	  get: function () {
	    if (!Buffer.isBuffer(this)) return undefined
	    return this.byteOffset
	  }
	});

	function createBuffer (length) {
	  if (length > K_MAX_LENGTH) {
	    throw new RangeError('The value "' + length + '" is invalid for option "size"')
	  }
	  // Return an augmented `Uint8Array` instance
	  var buf = new Uint8Array(length);
	  Object.setPrototypeOf(buf, Buffer.prototype);
	  return buf
	}

	/**
	 * The Buffer constructor returns instances of `Uint8Array` that have their
	 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
	 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
	 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
	 * returns a single octet.
	 *
	 * The `Uint8Array` prototype remains unmodified.
	 */

	function Buffer (arg, encodingOrOffset, length) {
	  // Common case.
	  if (typeof arg === 'number') {
	    if (typeof encodingOrOffset === 'string') {
	      throw new TypeError(
	        'The "string" argument must be of type string. Received type number'
	      )
	    }
	    return allocUnsafe(arg)
	  }
	  return from(arg, encodingOrOffset, length)
	}

	Buffer.poolSize = 8192; // not used by this implementation

	function from (value, encodingOrOffset, length) {
	  if (typeof value === 'string') {
	    return fromString(value, encodingOrOffset)
	  }

	  if (ArrayBuffer.isView(value)) {
	    return fromArrayView(value)
	  }

	  if (value == null) {
	    throw new TypeError(
	      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
	      'or Array-like Object. Received type ' + (typeof value)
	    )
	  }

	  if (isInstance(value, ArrayBuffer) ||
	      (value && isInstance(value.buffer, ArrayBuffer))) {
	    return fromArrayBuffer(value, encodingOrOffset, length)
	  }

	  if (typeof SharedArrayBuffer !== 'undefined' &&
	      (isInstance(value, SharedArrayBuffer) ||
	      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
	    return fromArrayBuffer(value, encodingOrOffset, length)
	  }

	  if (typeof value === 'number') {
	    throw new TypeError(
	      'The "value" argument must not be of type number. Received type number'
	    )
	  }

	  var valueOf = value.valueOf && value.valueOf();
	  if (valueOf != null && valueOf !== value) {
	    return Buffer.from(valueOf, encodingOrOffset, length)
	  }

	  var b = fromObject(value);
	  if (b) return b

	  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
	      typeof value[Symbol.toPrimitive] === 'function') {
	    return Buffer.from(
	      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
	    )
	  }

	  throw new TypeError(
	    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
	    'or Array-like Object. Received type ' + (typeof value)
	  )
	}

	/**
	 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
	 * if value is a number.
	 * Buffer.from(str[, encoding])
	 * Buffer.from(array)
	 * Buffer.from(buffer)
	 * Buffer.from(arrayBuffer[, byteOffset[, length]])
	 **/
	Buffer.from = function (value, encodingOrOffset, length) {
	  return from(value, encodingOrOffset, length)
	};

	// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
	// https://github.com/feross/buffer/pull/148
	Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
	Object.setPrototypeOf(Buffer, Uint8Array);

	function assertSize (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('"size" argument must be of type number')
	  } else if (size < 0) {
	    throw new RangeError('The value "' + size + '" is invalid for option "size"')
	  }
	}

	function alloc (size, fill, encoding) {
	  assertSize(size);
	  if (size <= 0) {
	    return createBuffer(size)
	  }
	  if (fill !== undefined) {
	    // Only pay attention to encoding if it's a string. This
	    // prevents accidentally sending in a number that would
	    // be interpreted as a start offset.
	    return typeof encoding === 'string'
	      ? createBuffer(size).fill(fill, encoding)
	      : createBuffer(size).fill(fill)
	  }
	  return createBuffer(size)
	}

	/**
	 * Creates a new filled Buffer instance.
	 * alloc(size[, fill[, encoding]])
	 **/
	Buffer.alloc = function (size, fill, encoding) {
	  return alloc(size, fill, encoding)
	};

	function allocUnsafe (size) {
	  assertSize(size);
	  return createBuffer(size < 0 ? 0 : checked(size) | 0)
	}

	/**
	 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
	 * */
	Buffer.allocUnsafe = function (size) {
	  return allocUnsafe(size)
	};
	/**
	 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
	 */
	Buffer.allocUnsafeSlow = function (size) {
	  return allocUnsafe(size)
	};

	function fromString (string, encoding) {
	  if (typeof encoding !== 'string' || encoding === '') {
	    encoding = 'utf8';
	  }

	  if (!Buffer.isEncoding(encoding)) {
	    throw new TypeError('Unknown encoding: ' + encoding)
	  }

	  var length = byteLength(string, encoding) | 0;
	  var buf = createBuffer(length);

	  var actual = buf.write(string, encoding);

	  if (actual !== length) {
	    // Writing a hex string, for example, that contains invalid characters will
	    // cause everything after the first invalid character to be ignored. (e.g.
	    // 'abxxcd' will be treated as 'ab')
	    buf = buf.slice(0, actual);
	  }

	  return buf
	}

	function fromArrayLike (array) {
	  var length = array.length < 0 ? 0 : checked(array.length) | 0;
	  var buf = createBuffer(length);
	  for (var i = 0; i < length; i += 1) {
	    buf[i] = array[i] & 255;
	  }
	  return buf
	}

	function fromArrayView (arrayView) {
	  if (isInstance(arrayView, Uint8Array)) {
	    var copy = new Uint8Array(arrayView);
	    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
	  }
	  return fromArrayLike(arrayView)
	}

	function fromArrayBuffer (array, byteOffset, length) {
	  if (byteOffset < 0 || array.byteLength < byteOffset) {
	    throw new RangeError('"offset" is outside of buffer bounds')
	  }

	  if (array.byteLength < byteOffset + (length || 0)) {
	    throw new RangeError('"length" is outside of buffer bounds')
	  }

	  var buf;
	  if (byteOffset === undefined && length === undefined) {
	    buf = new Uint8Array(array);
	  } else if (length === undefined) {
	    buf = new Uint8Array(array, byteOffset);
	  } else {
	    buf = new Uint8Array(array, byteOffset, length);
	  }

	  // Return an augmented `Uint8Array` instance
	  Object.setPrototypeOf(buf, Buffer.prototype);

	  return buf
	}

	function fromObject (obj) {
	  if (Buffer.isBuffer(obj)) {
	    var len = checked(obj.length) | 0;
	    var buf = createBuffer(len);

	    if (buf.length === 0) {
	      return buf
	    }

	    obj.copy(buf, 0, 0, len);
	    return buf
	  }

	  if (obj.length !== undefined) {
	    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
	      return createBuffer(0)
	    }
	    return fromArrayLike(obj)
	  }

	  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
	    return fromArrayLike(obj.data)
	  }
	}

	function checked (length) {
	  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
	  // length is NaN (which is otherwise coerced to zero.)
	  if (length >= K_MAX_LENGTH) {
	    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
	                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
	  }
	  return length | 0
	}

	function SlowBuffer (length) {
	  if (+length != length) { // eslint-disable-line eqeqeq
	    length = 0;
	  }
	  return Buffer.alloc(+length)
	}

	Buffer.isBuffer = function isBuffer (b) {
	  return b != null && b._isBuffer === true &&
	    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
	};

	Buffer.compare = function compare (a, b) {
	  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
	  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
	  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
	    throw new TypeError(
	      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
	    )
	  }

	  if (a === b) return 0

	  var x = a.length;
	  var y = b.length;

	  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
	    if (a[i] !== b[i]) {
	      x = a[i];
	      y = b[i];
	      break
	    }
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	};

	Buffer.isEncoding = function isEncoding (encoding) {
	  switch (String(encoding).toLowerCase()) {
	    case 'hex':
	    case 'utf8':
	    case 'utf-8':
	    case 'ascii':
	    case 'latin1':
	    case 'binary':
	    case 'base64':
	    case 'ucs2':
	    case 'ucs-2':
	    case 'utf16le':
	    case 'utf-16le':
	      return true
	    default:
	      return false
	  }
	};

	Buffer.concat = function concat (list, length) {
	  if (!Array.isArray(list)) {
	    throw new TypeError('"list" argument must be an Array of Buffers')
	  }

	  if (list.length === 0) {
	    return Buffer.alloc(0)
	  }

	  var i;
	  if (length === undefined) {
	    length = 0;
	    for (i = 0; i < list.length; ++i) {
	      length += list[i].length;
	    }
	  }

	  var buffer = Buffer.allocUnsafe(length);
	  var pos = 0;
	  for (i = 0; i < list.length; ++i) {
	    var buf = list[i];
	    if (isInstance(buf, Uint8Array)) {
	      if (pos + buf.length > buffer.length) {
	        Buffer.from(buf).copy(buffer, pos);
	      } else {
	        Uint8Array.prototype.set.call(
	          buffer,
	          buf,
	          pos
	        );
	      }
	    } else if (!Buffer.isBuffer(buf)) {
	      throw new TypeError('"list" argument must be an Array of Buffers')
	    } else {
	      buf.copy(buffer, pos);
	    }
	    pos += buf.length;
	  }
	  return buffer
	};

	function byteLength (string, encoding) {
	  if (Buffer.isBuffer(string)) {
	    return string.length
	  }
	  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
	    return string.byteLength
	  }
	  if (typeof string !== 'string') {
	    throw new TypeError(
	      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
	      'Received type ' + typeof string
	    )
	  }

	  var len = string.length;
	  var mustMatch = (arguments.length > 2 && arguments[2] === true);
	  if (!mustMatch && len === 0) return 0

	  // Use a for loop to avoid recursion
	  var loweredCase = false;
	  for (;;) {
	    switch (encoding) {
	      case 'ascii':
	      case 'latin1':
	      case 'binary':
	        return len
	      case 'utf8':
	      case 'utf-8':
	        return utf8ToBytes(string).length
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return len * 2
	      case 'hex':
	        return len >>> 1
	      case 'base64':
	        return base64ToBytes(string).length
	      default:
	        if (loweredCase) {
	          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
	        }
	        encoding = ('' + encoding).toLowerCase();
	        loweredCase = true;
	    }
	  }
	}
	Buffer.byteLength = byteLength;

	function slowToString (encoding, start, end) {
	  var loweredCase = false;

	  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
	  // property of a typed array.

	  // This behaves neither like String nor Uint8Array in that we set start/end
	  // to their upper/lower bounds if the value passed is out of range.
	  // undefined is handled specially as per ECMA-262 6th Edition,
	  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
	  if (start === undefined || start < 0) {
	    start = 0;
	  }
	  // Return early if start > this.length. Done here to prevent potential uint32
	  // coercion fail below.
	  if (start > this.length) {
	    return ''
	  }

	  if (end === undefined || end > this.length) {
	    end = this.length;
	  }

	  if (end <= 0) {
	    return ''
	  }

	  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
	  end >>>= 0;
	  start >>>= 0;

	  if (end <= start) {
	    return ''
	  }

	  if (!encoding) encoding = 'utf8';

	  while (true) {
	    switch (encoding) {
	      case 'hex':
	        return hexSlice(this, start, end)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Slice(this, start, end)

	      case 'ascii':
	        return asciiSlice(this, start, end)

	      case 'latin1':
	      case 'binary':
	        return latin1Slice(this, start, end)

	      case 'base64':
	        return base64Slice(this, start, end)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return utf16leSlice(this, start, end)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = (encoding + '').toLowerCase();
	        loweredCase = true;
	    }
	  }
	}

	// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
	// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
	// reliably in a browserify context because there could be multiple different
	// copies of the 'buffer' package in use. This method works even for Buffer
	// instances that were created from another copy of the `buffer` package.
	// See: https://github.com/feross/buffer/issues/154
	Buffer.prototype._isBuffer = true;

	function swap (b, n, m) {
	  var i = b[n];
	  b[n] = b[m];
	  b[m] = i;
	}

	Buffer.prototype.swap16 = function swap16 () {
	  var len = this.length;
	  if (len % 2 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 16-bits')
	  }
	  for (var i = 0; i < len; i += 2) {
	    swap(this, i, i + 1);
	  }
	  return this
	};

	Buffer.prototype.swap32 = function swap32 () {
	  var len = this.length;
	  if (len % 4 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 32-bits')
	  }
	  for (var i = 0; i < len; i += 4) {
	    swap(this, i, i + 3);
	    swap(this, i + 1, i + 2);
	  }
	  return this
	};

	Buffer.prototype.swap64 = function swap64 () {
	  var len = this.length;
	  if (len % 8 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 64-bits')
	  }
	  for (var i = 0; i < len; i += 8) {
	    swap(this, i, i + 7);
	    swap(this, i + 1, i + 6);
	    swap(this, i + 2, i + 5);
	    swap(this, i + 3, i + 4);
	  }
	  return this
	};

	Buffer.prototype.toString = function toString () {
	  var length = this.length;
	  if (length === 0) return ''
	  if (arguments.length === 0) return utf8Slice(this, 0, length)
	  return slowToString.apply(this, arguments)
	};

	Buffer.prototype.toLocaleString = Buffer.prototype.toString;

	Buffer.prototype.equals = function equals (b) {
	  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
	  if (this === b) return true
	  return Buffer.compare(this, b) === 0
	};

	Buffer.prototype.inspect = function inspect () {
	  var str = '';
	  var max = exports.INSPECT_MAX_BYTES;
	  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim();
	  if (this.length > max) str += ' ... ';
	  return '<Buffer ' + str + '>'
	};
	if (customInspectSymbol) {
	  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
	}

	Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
	  if (isInstance(target, Uint8Array)) {
	    target = Buffer.from(target, target.offset, target.byteLength);
	  }
	  if (!Buffer.isBuffer(target)) {
	    throw new TypeError(
	      'The "target" argument must be one of type Buffer or Uint8Array. ' +
	      'Received type ' + (typeof target)
	    )
	  }

	  if (start === undefined) {
	    start = 0;
	  }
	  if (end === undefined) {
	    end = target ? target.length : 0;
	  }
	  if (thisStart === undefined) {
	    thisStart = 0;
	  }
	  if (thisEnd === undefined) {
	    thisEnd = this.length;
	  }

	  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
	    throw new RangeError('out of range index')
	  }

	  if (thisStart >= thisEnd && start >= end) {
	    return 0
	  }
	  if (thisStart >= thisEnd) {
	    return -1
	  }
	  if (start >= end) {
	    return 1
	  }

	  start >>>= 0;
	  end >>>= 0;
	  thisStart >>>= 0;
	  thisEnd >>>= 0;

	  if (this === target) return 0

	  var x = thisEnd - thisStart;
	  var y = end - start;
	  var len = Math.min(x, y);

	  var thisCopy = this.slice(thisStart, thisEnd);
	  var targetCopy = target.slice(start, end);

	  for (var i = 0; i < len; ++i) {
	    if (thisCopy[i] !== targetCopy[i]) {
	      x = thisCopy[i];
	      y = targetCopy[i];
	      break
	    }
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	};

	// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
	// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
	//
	// Arguments:
	// - buffer - a Buffer to search
	// - val - a string, Buffer, or number
	// - byteOffset - an index into `buffer`; will be clamped to an int32
	// - encoding - an optional encoding, relevant is val is a string
	// - dir - true for indexOf, false for lastIndexOf
	function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
	  // Empty buffer means no match
	  if (buffer.length === 0) return -1

	  // Normalize byteOffset
	  if (typeof byteOffset === 'string') {
	    encoding = byteOffset;
	    byteOffset = 0;
	  } else if (byteOffset > 0x7fffffff) {
	    byteOffset = 0x7fffffff;
	  } else if (byteOffset < -0x80000000) {
	    byteOffset = -0x80000000;
	  }
	  byteOffset = +byteOffset; // Coerce to Number.
	  if (numberIsNaN(byteOffset)) {
	    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
	    byteOffset = dir ? 0 : (buffer.length - 1);
	  }

	  // Normalize byteOffset: negative offsets start from the end of the buffer
	  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
	  if (byteOffset >= buffer.length) {
	    if (dir) return -1
	    else byteOffset = buffer.length - 1;
	  } else if (byteOffset < 0) {
	    if (dir) byteOffset = 0;
	    else return -1
	  }

	  // Normalize val
	  if (typeof val === 'string') {
	    val = Buffer.from(val, encoding);
	  }

	  // Finally, search either indexOf (if dir is true) or lastIndexOf
	  if (Buffer.isBuffer(val)) {
	    // Special case: looking for empty string/buffer always fails
	    if (val.length === 0) {
	      return -1
	    }
	    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
	  } else if (typeof val === 'number') {
	    val = val & 0xFF; // Search for a byte value [0-255]
	    if (typeof Uint8Array.prototype.indexOf === 'function') {
	      if (dir) {
	        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
	      } else {
	        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
	      }
	    }
	    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
	  }

	  throw new TypeError('val must be string, number or Buffer')
	}

	function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
	  var indexSize = 1;
	  var arrLength = arr.length;
	  var valLength = val.length;

	  if (encoding !== undefined) {
	    encoding = String(encoding).toLowerCase();
	    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
	        encoding === 'utf16le' || encoding === 'utf-16le') {
	      if (arr.length < 2 || val.length < 2) {
	        return -1
	      }
	      indexSize = 2;
	      arrLength /= 2;
	      valLength /= 2;
	      byteOffset /= 2;
	    }
	  }

	  function read (buf, i) {
	    if (indexSize === 1) {
	      return buf[i]
	    } else {
	      return buf.readUInt16BE(i * indexSize)
	    }
	  }

	  var i;
	  if (dir) {
	    var foundIndex = -1;
	    for (i = byteOffset; i < arrLength; i++) {
	      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
	        if (foundIndex === -1) foundIndex = i;
	        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
	      } else {
	        if (foundIndex !== -1) i -= i - foundIndex;
	        foundIndex = -1;
	      }
	    }
	  } else {
	    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
	    for (i = byteOffset; i >= 0; i--) {
	      var found = true;
	      for (var j = 0; j < valLength; j++) {
	        if (read(arr, i + j) !== read(val, j)) {
	          found = false;
	          break
	        }
	      }
	      if (found) return i
	    }
	  }

	  return -1
	}

	Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
	  return this.indexOf(val, byteOffset, encoding) !== -1
	};

	Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
	};

	Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
	};

	function hexWrite (buf, string, offset, length) {
	  offset = Number(offset) || 0;
	  var remaining = buf.length - offset;
	  if (!length) {
	    length = remaining;
	  } else {
	    length = Number(length);
	    if (length > remaining) {
	      length = remaining;
	    }
	  }

	  var strLen = string.length;

	  if (length > strLen / 2) {
	    length = strLen / 2;
	  }
	  for (var i = 0; i < length; ++i) {
	    var parsed = parseInt(string.substr(i * 2, 2), 16);
	    if (numberIsNaN(parsed)) return i
	    buf[offset + i] = parsed;
	  }
	  return i
	}

	function utf8Write (buf, string, offset, length) {
	  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
	}

	function asciiWrite (buf, string, offset, length) {
	  return blitBuffer(asciiToBytes(string), buf, offset, length)
	}

	function base64Write (buf, string, offset, length) {
	  return blitBuffer(base64ToBytes(string), buf, offset, length)
	}

	function ucs2Write (buf, string, offset, length) {
	  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
	}

	Buffer.prototype.write = function write (string, offset, length, encoding) {
	  // Buffer#write(string)
	  if (offset === undefined) {
	    encoding = 'utf8';
	    length = this.length;
	    offset = 0;
	  // Buffer#write(string, encoding)
	  } else if (length === undefined && typeof offset === 'string') {
	    encoding = offset;
	    length = this.length;
	    offset = 0;
	  // Buffer#write(string, offset[, length][, encoding])
	  } else if (isFinite(offset)) {
	    offset = offset >>> 0;
	    if (isFinite(length)) {
	      length = length >>> 0;
	      if (encoding === undefined) encoding = 'utf8';
	    } else {
	      encoding = length;
	      length = undefined;
	    }
	  } else {
	    throw new Error(
	      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
	    )
	  }

	  var remaining = this.length - offset;
	  if (length === undefined || length > remaining) length = remaining;

	  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
	    throw new RangeError('Attempt to write outside buffer bounds')
	  }

	  if (!encoding) encoding = 'utf8';

	  var loweredCase = false;
	  for (;;) {
	    switch (encoding) {
	      case 'hex':
	        return hexWrite(this, string, offset, length)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Write(this, string, offset, length)

	      case 'ascii':
	      case 'latin1':
	      case 'binary':
	        return asciiWrite(this, string, offset, length)

	      case 'base64':
	        // Warning: maxLength not taken into account in base64Write
	        return base64Write(this, string, offset, length)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return ucs2Write(this, string, offset, length)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = ('' + encoding).toLowerCase();
	        loweredCase = true;
	    }
	  }
	};

	Buffer.prototype.toJSON = function toJSON () {
	  return {
	    type: 'Buffer',
	    data: Array.prototype.slice.call(this._arr || this, 0)
	  }
	};

	function base64Slice (buf, start, end) {
	  if (start === 0 && end === buf.length) {
	    return base64.fromByteArray(buf)
	  } else {
	    return base64.fromByteArray(buf.slice(start, end))
	  }
	}

	function utf8Slice (buf, start, end) {
	  end = Math.min(buf.length, end);
	  var res = [];

	  var i = start;
	  while (i < end) {
	    var firstByte = buf[i];
	    var codePoint = null;
	    var bytesPerSequence = (firstByte > 0xEF)
	      ? 4
	      : (firstByte > 0xDF)
	          ? 3
	          : (firstByte > 0xBF)
	              ? 2
	              : 1;

	    if (i + bytesPerSequence <= end) {
	      var secondByte, thirdByte, fourthByte, tempCodePoint;

	      switch (bytesPerSequence) {
	        case 1:
	          if (firstByte < 0x80) {
	            codePoint = firstByte;
	          }
	          break
	        case 2:
	          secondByte = buf[i + 1];
	          if ((secondByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
	            if (tempCodePoint > 0x7F) {
	              codePoint = tempCodePoint;
	            }
	          }
	          break
	        case 3:
	          secondByte = buf[i + 1];
	          thirdByte = buf[i + 2];
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
	            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
	              codePoint = tempCodePoint;
	            }
	          }
	          break
	        case 4:
	          secondByte = buf[i + 1];
	          thirdByte = buf[i + 2];
	          fourthByte = buf[i + 3];
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
	            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
	              codePoint = tempCodePoint;
	            }
	          }
	      }
	    }

	    if (codePoint === null) {
	      // we did not generate a valid codePoint so insert a
	      // replacement char (U+FFFD) and advance only 1 byte
	      codePoint = 0xFFFD;
	      bytesPerSequence = 1;
	    } else if (codePoint > 0xFFFF) {
	      // encode to utf16 (surrogate pair dance)
	      codePoint -= 0x10000;
	      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
	      codePoint = 0xDC00 | codePoint & 0x3FF;
	    }

	    res.push(codePoint);
	    i += bytesPerSequence;
	  }

	  return decodeCodePointsArray(res)
	}

	// Based on http://stackoverflow.com/a/22747272/680742, the browser with
	// the lowest limit is Chrome, with 0x10000 args.
	// We go 1 magnitude less, for safety
	var MAX_ARGUMENTS_LENGTH = 0x1000;

	function decodeCodePointsArray (codePoints) {
	  var len = codePoints.length;
	  if (len <= MAX_ARGUMENTS_LENGTH) {
	    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
	  }

	  // Decode in chunks to avoid "call stack size exceeded".
	  var res = '';
	  var i = 0;
	  while (i < len) {
	    res += String.fromCharCode.apply(
	      String,
	      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
	    );
	  }
	  return res
	}

	function asciiSlice (buf, start, end) {
	  var ret = '';
	  end = Math.min(buf.length, end);

	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i] & 0x7F);
	  }
	  return ret
	}

	function latin1Slice (buf, start, end) {
	  var ret = '';
	  end = Math.min(buf.length, end);

	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i]);
	  }
	  return ret
	}

	function hexSlice (buf, start, end) {
	  var len = buf.length;

	  if (!start || start < 0) start = 0;
	  if (!end || end < 0 || end > len) end = len;

	  var out = '';
	  for (var i = start; i < end; ++i) {
	    out += hexSliceLookupTable[buf[i]];
	  }
	  return out
	}

	function utf16leSlice (buf, start, end) {
	  var bytes = buf.slice(start, end);
	  var res = '';
	  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
	  for (var i = 0; i < bytes.length - 1; i += 2) {
	    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256));
	  }
	  return res
	}

	Buffer.prototype.slice = function slice (start, end) {
	  var len = this.length;
	  start = ~~start;
	  end = end === undefined ? len : ~~end;

	  if (start < 0) {
	    start += len;
	    if (start < 0) start = 0;
	  } else if (start > len) {
	    start = len;
	  }

	  if (end < 0) {
	    end += len;
	    if (end < 0) end = 0;
	  } else if (end > len) {
	    end = len;
	  }

	  if (end < start) end = start;

	  var newBuf = this.subarray(start, end);
	  // Return an augmented `Uint8Array` instance
	  Object.setPrototypeOf(newBuf, Buffer.prototype);

	  return newBuf
	};

	/*
	 * Need to make sure that buffer isn't trying to write out of bounds.
	 */
	function checkOffset (offset, ext, length) {
	  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
	  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
	}

	Buffer.prototype.readUintLE =
	Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
	  offset = offset >>> 0;
	  byteLength = byteLength >>> 0;
	  if (!noAssert) checkOffset(offset, byteLength, this.length);

	  var val = this[offset];
	  var mul = 1;
	  var i = 0;
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul;
	  }

	  return val
	};

	Buffer.prototype.readUintBE =
	Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
	  offset = offset >>> 0;
	  byteLength = byteLength >>> 0;
	  if (!noAssert) {
	    checkOffset(offset, byteLength, this.length);
	  }

	  var val = this[offset + --byteLength];
	  var mul = 1;
	  while (byteLength > 0 && (mul *= 0x100)) {
	    val += this[offset + --byteLength] * mul;
	  }

	  return val
	};

	Buffer.prototype.readUint8 =
	Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 1, this.length);
	  return this[offset]
	};

	Buffer.prototype.readUint16LE =
	Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 2, this.length);
	  return this[offset] | (this[offset + 1] << 8)
	};

	Buffer.prototype.readUint16BE =
	Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 2, this.length);
	  return (this[offset] << 8) | this[offset + 1]
	};

	Buffer.prototype.readUint32LE =
	Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 4, this.length);

	  return ((this[offset]) |
	      (this[offset + 1] << 8) |
	      (this[offset + 2] << 16)) +
	      (this[offset + 3] * 0x1000000)
	};

	Buffer.prototype.readUint32BE =
	Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 4, this.length);

	  return (this[offset] * 0x1000000) +
	    ((this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    this[offset + 3])
	};

	Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
	  offset = offset >>> 0;
	  byteLength = byteLength >>> 0;
	  if (!noAssert) checkOffset(offset, byteLength, this.length);

	  var val = this[offset];
	  var mul = 1;
	  var i = 0;
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul;
	  }
	  mul *= 0x80;

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

	  return val
	};

	Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
	  offset = offset >>> 0;
	  byteLength = byteLength >>> 0;
	  if (!noAssert) checkOffset(offset, byteLength, this.length);

	  var i = byteLength;
	  var mul = 1;
	  var val = this[offset + --i];
	  while (i > 0 && (mul *= 0x100)) {
	    val += this[offset + --i] * mul;
	  }
	  mul *= 0x80;

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

	  return val
	};

	Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 1, this.length);
	  if (!(this[offset] & 0x80)) return (this[offset])
	  return ((0xff - this[offset] + 1) * -1)
	};

	Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 2, this.length);
	  var val = this[offset] | (this[offset + 1] << 8);
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	};

	Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 2, this.length);
	  var val = this[offset + 1] | (this[offset] << 8);
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	};

	Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 4, this.length);

	  return (this[offset]) |
	    (this[offset + 1] << 8) |
	    (this[offset + 2] << 16) |
	    (this[offset + 3] << 24)
	};

	Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 4, this.length);

	  return (this[offset] << 24) |
	    (this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    (this[offset + 3])
	};

	Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 4, this.length);
	  return ieee754$1.read(this, offset, true, 23, 4)
	};

	Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 4, this.length);
	  return ieee754$1.read(this, offset, false, 23, 4)
	};

	Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 8, this.length);
	  return ieee754$1.read(this, offset, true, 52, 8)
	};

	Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
	  offset = offset >>> 0;
	  if (!noAssert) checkOffset(offset, 8, this.length);
	  return ieee754$1.read(this, offset, false, 52, 8)
	};

	function checkInt (buf, value, offset, ext, max, min) {
	  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
	  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	}

	Buffer.prototype.writeUintLE =
	Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  byteLength = byteLength >>> 0;
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
	    checkInt(this, value, offset, byteLength, maxBytes, 0);
	  }

	  var mul = 1;
	  var i = 0;
	  this[offset] = value & 0xFF;
	  while (++i < byteLength && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF;
	  }

	  return offset + byteLength
	};

	Buffer.prototype.writeUintBE =
	Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  byteLength = byteLength >>> 0;
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
	    checkInt(this, value, offset, byteLength, maxBytes, 0);
	  }

	  var i = byteLength - 1;
	  var mul = 1;
	  this[offset + i] = value & 0xFF;
	  while (--i >= 0 && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF;
	  }

	  return offset + byteLength
	};

	Buffer.prototype.writeUint8 =
	Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
	  this[offset] = (value & 0xff);
	  return offset + 1
	};

	Buffer.prototype.writeUint16LE =
	Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
	  this[offset] = (value & 0xff);
	  this[offset + 1] = (value >>> 8);
	  return offset + 2
	};

	Buffer.prototype.writeUint16BE =
	Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
	  this[offset] = (value >>> 8);
	  this[offset + 1] = (value & 0xff);
	  return offset + 2
	};

	Buffer.prototype.writeUint32LE =
	Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
	  this[offset + 3] = (value >>> 24);
	  this[offset + 2] = (value >>> 16);
	  this[offset + 1] = (value >>> 8);
	  this[offset] = (value & 0xff);
	  return offset + 4
	};

	Buffer.prototype.writeUint32BE =
	Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
	  this[offset] = (value >>> 24);
	  this[offset + 1] = (value >>> 16);
	  this[offset + 2] = (value >>> 8);
	  this[offset + 3] = (value & 0xff);
	  return offset + 4
	};

	Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) {
	    var limit = Math.pow(2, (8 * byteLength) - 1);

	    checkInt(this, value, offset, byteLength, limit - 1, -limit);
	  }

	  var i = 0;
	  var mul = 1;
	  var sub = 0;
	  this[offset] = value & 0xFF;
	  while (++i < byteLength && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
	      sub = 1;
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
	  }

	  return offset + byteLength
	};

	Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) {
	    var limit = Math.pow(2, (8 * byteLength) - 1);

	    checkInt(this, value, offset, byteLength, limit - 1, -limit);
	  }

	  var i = byteLength - 1;
	  var mul = 1;
	  var sub = 0;
	  this[offset + i] = value & 0xFF;
	  while (--i >= 0 && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
	      sub = 1;
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
	  }

	  return offset + byteLength
	};

	Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
	  if (value < 0) value = 0xff + value + 1;
	  this[offset] = (value & 0xff);
	  return offset + 1
	};

	Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
	  this[offset] = (value & 0xff);
	  this[offset + 1] = (value >>> 8);
	  return offset + 2
	};

	Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
	  this[offset] = (value >>> 8);
	  this[offset + 1] = (value & 0xff);
	  return offset + 2
	};

	Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
	  this[offset] = (value & 0xff);
	  this[offset + 1] = (value >>> 8);
	  this[offset + 2] = (value >>> 16);
	  this[offset + 3] = (value >>> 24);
	  return offset + 4
	};

	Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
	  if (value < 0) value = 0xffffffff + value + 1;
	  this[offset] = (value >>> 24);
	  this[offset + 1] = (value >>> 16);
	  this[offset + 2] = (value >>> 8);
	  this[offset + 3] = (value & 0xff);
	  return offset + 4
	};

	function checkIEEE754 (buf, value, offset, ext, max, min) {
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	  if (offset < 0) throw new RangeError('Index out of range')
	}

	function writeFloat (buf, value, offset, littleEndian, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 4);
	  }
	  ieee754$1.write(buf, value, offset, littleEndian, 23, 4);
	  return offset + 4
	}

	Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, true, noAssert)
	};

	Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, false, noAssert)
	};

	function writeDouble (buf, value, offset, littleEndian, noAssert) {
	  value = +value;
	  offset = offset >>> 0;
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 8);
	  }
	  ieee754$1.write(buf, value, offset, littleEndian, 52, 8);
	  return offset + 8
	}

	Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, true, noAssert)
	};

	Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, false, noAssert)
	};

	// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
	Buffer.prototype.copy = function copy (target, targetStart, start, end) {
	  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
	  if (!start) start = 0;
	  if (!end && end !== 0) end = this.length;
	  if (targetStart >= target.length) targetStart = target.length;
	  if (!targetStart) targetStart = 0;
	  if (end > 0 && end < start) end = start;

	  // Copy 0 bytes; we're done
	  if (end === start) return 0
	  if (target.length === 0 || this.length === 0) return 0

	  // Fatal error conditions
	  if (targetStart < 0) {
	    throw new RangeError('targetStart out of bounds')
	  }
	  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
	  if (end < 0) throw new RangeError('sourceEnd out of bounds')

	  // Are we oob?
	  if (end > this.length) end = this.length;
	  if (target.length - targetStart < end - start) {
	    end = target.length - targetStart + start;
	  }

	  var len = end - start;

	  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
	    // Use built-in when available, missing from IE11
	    this.copyWithin(targetStart, start, end);
	  } else {
	    Uint8Array.prototype.set.call(
	      target,
	      this.subarray(start, end),
	      targetStart
	    );
	  }

	  return len
	};

	// Usage:
	//    buffer.fill(number[, offset[, end]])
	//    buffer.fill(buffer[, offset[, end]])
	//    buffer.fill(string[, offset[, end]][, encoding])
	Buffer.prototype.fill = function fill (val, start, end, encoding) {
	  // Handle string cases:
	  if (typeof val === 'string') {
	    if (typeof start === 'string') {
	      encoding = start;
	      start = 0;
	      end = this.length;
	    } else if (typeof end === 'string') {
	      encoding = end;
	      end = this.length;
	    }
	    if (encoding !== undefined && typeof encoding !== 'string') {
	      throw new TypeError('encoding must be a string')
	    }
	    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
	      throw new TypeError('Unknown encoding: ' + encoding)
	    }
	    if (val.length === 1) {
	      var code = val.charCodeAt(0);
	      if ((encoding === 'utf8' && code < 128) ||
	          encoding === 'latin1') {
	        // Fast path: If `val` fits into a single byte, use that numeric value.
	        val = code;
	      }
	    }
	  } else if (typeof val === 'number') {
	    val = val & 255;
	  } else if (typeof val === 'boolean') {
	    val = Number(val);
	  }

	  // Invalid ranges are not set to a default, so can range check early.
	  if (start < 0 || this.length < start || this.length < end) {
	    throw new RangeError('Out of range index')
	  }

	  if (end <= start) {
	    return this
	  }

	  start = start >>> 0;
	  end = end === undefined ? this.length : end >>> 0;

	  if (!val) val = 0;

	  var i;
	  if (typeof val === 'number') {
	    for (i = start; i < end; ++i) {
	      this[i] = val;
	    }
	  } else {
	    var bytes = Buffer.isBuffer(val)
	      ? val
	      : Buffer.from(val, encoding);
	    var len = bytes.length;
	    if (len === 0) {
	      throw new TypeError('The value "' + val +
	        '" is invalid for argument "value"')
	    }
	    for (i = 0; i < end - start; ++i) {
	      this[i + start] = bytes[i % len];
	    }
	  }

	  return this
	};

	// HELPER FUNCTIONS
	// ================

	var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

	function base64clean (str) {
	  // Node takes equal signs as end of the Base64 encoding
	  str = str.split('=')[0];
	  // Node strips out invalid characters like \n and \t from the string, base64-js does not
	  str = str.trim().replace(INVALID_BASE64_RE, '');
	  // Node converts strings with length < 2 to ''
	  if (str.length < 2) return ''
	  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
	  while (str.length % 4 !== 0) {
	    str = str + '=';
	  }
	  return str
	}

	function utf8ToBytes (string, units) {
	  units = units || Infinity;
	  var codePoint;
	  var length = string.length;
	  var leadSurrogate = null;
	  var bytes = [];

	  for (var i = 0; i < length; ++i) {
	    codePoint = string.charCodeAt(i);

	    // is surrogate component
	    if (codePoint > 0xD7FF && codePoint < 0xE000) {
	      // last char was a lead
	      if (!leadSurrogate) {
	        // no lead yet
	        if (codePoint > 0xDBFF) {
	          // unexpected trail
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	          continue
	        } else if (i + 1 === length) {
	          // unpaired lead
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	          continue
	        }

	        // valid lead
	        leadSurrogate = codePoint;

	        continue
	      }

	      // 2 leads in a row
	      if (codePoint < 0xDC00) {
	        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	        leadSurrogate = codePoint;
	        continue
	      }

	      // valid surrogate pair
	      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
	    } else if (leadSurrogate) {
	      // valid bmp char, but last char was a lead
	      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	    }

	    leadSurrogate = null;

	    // encode utf8
	    if (codePoint < 0x80) {
	      if ((units -= 1) < 0) break
	      bytes.push(codePoint);
	    } else if (codePoint < 0x800) {
	      if ((units -= 2) < 0) break
	      bytes.push(
	        codePoint >> 0x6 | 0xC0,
	        codePoint & 0x3F | 0x80
	      );
	    } else if (codePoint < 0x10000) {
	      if ((units -= 3) < 0) break
	      bytes.push(
	        codePoint >> 0xC | 0xE0,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      );
	    } else if (codePoint < 0x110000) {
	      if ((units -= 4) < 0) break
	      bytes.push(
	        codePoint >> 0x12 | 0xF0,
	        codePoint >> 0xC & 0x3F | 0x80,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      );
	    } else {
	      throw new Error('Invalid code point')
	    }
	  }

	  return bytes
	}

	function asciiToBytes (str) {
	  var byteArray = [];
	  for (var i = 0; i < str.length; ++i) {
	    // Node's code seems to be doing this and not & 0x7F..
	    byteArray.push(str.charCodeAt(i) & 0xFF);
	  }
	  return byteArray
	}

	function utf16leToBytes (str, units) {
	  var c, hi, lo;
	  var byteArray = [];
	  for (var i = 0; i < str.length; ++i) {
	    if ((units -= 2) < 0) break

	    c = str.charCodeAt(i);
	    hi = c >> 8;
	    lo = c % 256;
	    byteArray.push(lo);
	    byteArray.push(hi);
	  }

	  return byteArray
	}

	function base64ToBytes (str) {
	  return base64.toByteArray(base64clean(str))
	}

	function blitBuffer (src, dst, offset, length) {
	  for (var i = 0; i < length; ++i) {
	    if ((i + offset >= dst.length) || (i >= src.length)) break
	    dst[i + offset] = src[i];
	  }
	  return i
	}

	// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
	// the `instanceof` check but they should be treated as of that type.
	// See: https://github.com/feross/buffer/issues/166
	function isInstance (obj, type) {
	  return obj instanceof type ||
	    (obj != null && obj.constructor != null && obj.constructor.name != null &&
	      obj.constructor.name === type.name)
	}
	function numberIsNaN (obj) {
	  // For IE11 support
	  return obj !== obj // eslint-disable-line no-self-compare
	}

	// Create lookup table for `toString('hex')`
	// See: https://github.com/feross/buffer/issues/219
	var hexSliceLookupTable = (function () {
	  var alphabet = '0123456789abcdef';
	  var table = new Array(256);
	  for (var i = 0; i < 16; ++i) {
	    var i16 = i * 16;
	    for (var j = 0; j < 16; ++j) {
	      table[i16 + j] = alphabet[i] + alphabet[j];
	    }
	  }
	  return table
	})(); 
} (buffer));

var inherits_browser = {exports: {}};

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

var inherits_browserExports = inherits_browser.exports;

var ltgt = {};

(function (exports) {
	exports.compare = function (a, b) {

	  if(Buffer.isBuffer(a)) {
	    var l = Math.min(a.length, b.length);
	    for(var i = 0; i < l; i++) {
	      var cmp = a[i] - b[i];
	      if(cmp) return cmp
	    }
	    return a.length - b.length
	  }

	  return a < b ? -1 : a > b ? 1 : 0
	};

	// to be compatible with the current abstract-leveldown tests
	// nullish or empty strings.
	// I could use !!val but I want to permit numbers and booleans,
	// if possible.

	function isDef (val) {
	  return val !== undefined && val !== ''
	}

	function has (range, name) {
	  return Object.hasOwnProperty.call(range, name)
	}

	function hasKey(range, name) {
	  return Object.hasOwnProperty.call(range, name) && name
	}

	var lowerBoundKey = exports.lowerBoundKey = function (range) {
	    return (
	       hasKey(range, 'gt')
	    || hasKey(range, 'gte')
	    || hasKey(range, 'min')
	    || (range.reverse ? hasKey(range, 'end') : hasKey(range, 'start'))
	    || undefined
	    )
	};

	var lowerBound = exports.lowerBound = function (range, def) {
	  var k = lowerBoundKey(range);
	  return k ? range[k] : def
	};

	var lowerBoundInclusive = exports.lowerBoundInclusive = function (range) {
	  return has(range, 'gt') ? false : true
	};

	var upperBoundInclusive = exports.upperBoundInclusive =
	  function (range) {
	    return (has(range, 'lt') /*&& !range.maxEx*/) ? false : true
	  };

	var lowerBoundExclusive = exports.lowerBoundExclusive =
	  function (range) {
	    return !lowerBoundInclusive(range)
	  };

	var upperBoundExclusive = exports.upperBoundExclusive =
	  function (range) {
	    return !upperBoundInclusive(range)
	  };

	var upperBoundKey = exports.upperBoundKey = function (range) {
	    return (
	       hasKey(range, 'lt')
	    || hasKey(range, 'lte')
	    || hasKey(range, 'max')
	    || (range.reverse ? hasKey(range, 'start') : hasKey(range, 'end'))
	    || undefined
	    )
	};

	var upperBound = exports.upperBound = function (range, def) {
	  var k = upperBoundKey(range);
	  return k ? range[k] : def
	};

	exports.start = function (range, def) {
	  return range.reverse ? upperBound(range, def) : lowerBound(range, def)
	};
	exports.end = function (range, def) {
	  return range.reverse ? lowerBound(range, def) : upperBound(range, def)
	};
	exports.startInclusive = function (range) {
	  return (
	    range.reverse
	  ? upperBoundInclusive(range)
	  : lowerBoundInclusive(range)
	  )
	};
	exports.endInclusive = function (range) {
	  return (
	    range.reverse
	  ? lowerBoundInclusive(range)
	  : upperBoundInclusive(range)
	  )
	};

	function id (e) { return e }

	exports.toLtgt = function (range, _range, map, lower, upper) {
	  _range = _range || {};
	  map = map || id;
	  var defaults = arguments.length > 3;
	  var lb = exports.lowerBoundKey(range);
	  var ub = exports.upperBoundKey(range);
	  if(lb) {
	    if(lb === 'gt') _range.gt = map(range.gt, false);
	    else            _range.gte = map(range[lb], false);
	  }
	  else if(defaults)
	    _range.gte = map(lower, false);

	  if(ub) {
	    if(ub === 'lt') _range.lt = map(range.lt, true);
	    else            _range.lte = map(range[ub], true);
	  }
	  else if(defaults)
	    _range.lte = map(upper, true);

	  if(range.reverse != null)
	    _range.reverse = !!range.reverse;

	  //if range was used mutably
	  //(in level-sublevel it's part of an options object
	  //that has more properties on it.)
	  if(has(_range, 'max'))   delete _range.max;
	  if(has(_range, 'min'))   delete _range.min;
	  if(has(_range, 'start')) delete _range.start;
	  if(has(_range, 'end'))   delete _range.end;

	  return _range
	};

	exports.contains = function (range, key, compare) {
	  compare = compare || exports.compare;

	  var lb = lowerBound(range);
	  if(isDef(lb)) {
	    var cmp = compare(key, lb);
	    if(cmp < 0 || (cmp === 0 && lowerBoundExclusive(range)))
	      return false
	  }

	  var ub = upperBound(range);
	  if(isDef(ub)) {
	    var cmp = compare(key, ub);
	    if(cmp > 0 || (cmp === 0) && upperBoundExclusive(range))
	      return false
	  }

	  return true
	};

	exports.filter = function (range, compare) {
	  return function (key) {
	    return exports.contains(range, key, compare)
	  }
	}; 
} (ltgt));

function isFunction$1(f) {
  return 'function' === typeof f;
}

function getPrefix(db) {
  if (isFunction$1(db.prefix)) {
    return db.prefix();
  }
  return db;
}

function clone(_obj) {
  var obj = {};
  for (var k in _obj) {
    obj[k] = _obj[k];
  }
  return obj;
}

function nut(db, precodec, codec) {
  function encodePrefix(prefix, key, opts1, opts2) {
    return precodec.encode([ prefix, codec.encodeKey(key, opts1, opts2 ) ]);
  }

  function addEncodings(op, prefix) {
    if (prefix && prefix.options) {
      op.keyEncoding =
        op.keyEncoding || prefix.options.keyEncoding;
      op.valueEncoding =
        op.valueEncoding || prefix.options.valueEncoding;
    }
    return op;
  }

  db.open(function () { /* no-op */});

  return {
    apply: function (ops, opts, cb) {
      opts = opts || {};

      var batch = [];
      var i = -1;
      var len = ops.length;

      while (++i < len) {
        var op = ops[i];
        addEncodings(op, op.prefix);
        op.prefix = getPrefix(op.prefix);
        batch.push({
          key: encodePrefix(op.prefix, op.key, opts, op),
          value: op.type !== 'del' && codec.encodeValue(op.value, opts, op),
          type: op.type
        });
      }
      db.db.batch(batch, opts, cb);
    },
    get: function (key, prefix, opts, cb) {
      opts.asBuffer = codec.valueAsBuffer(opts);
      return db.db.get(
        encodePrefix(prefix, key, opts),
        opts,
        function (err, value) {
          if (err) {
            cb(err);
          } else {
            cb(null, codec.decodeValue(value, opts));
          }
        }
      );
    },
    createDecoder: function (opts) {
      return function (key, value) {
        return {
          key: codec.decodeKey(precodec.decode(key)[1], opts),
          value: codec.decodeValue(value, opts)
        };
      };
    },
    isClosed: function isClosed() {
      return db.isClosed();
    },
    close: function close(cb) {
      return db.close(cb);
    },
    iterator: function (_opts) {
      var opts = clone(_opts || {});
      var prefix = _opts.prefix || [];

      function encodeKey(key) {
        return encodePrefix(prefix, key, opts, {});
      }

      ltgt.toLtgt(_opts, opts, encodeKey, precodec.lowerBound, precodec.upperBound);

      // if these legacy values are in the options, remove them

      opts.prefix = null;

      //************************************************
      //hard coded defaults, for now...
      //TODO: pull defaults and encoding out of levelup.
      opts.keyAsBuffer = opts.valueAsBuffer = false;
      //************************************************


      //this is vital, otherwise limit: undefined will
      //create an empty stream.
      /* istanbul ignore next */
      if ('number' !== typeof opts.limit) {
        opts.limit = -1;
      }

      opts.keyAsBuffer = precodec.buffer;
      opts.valueAsBuffer = codec.valueAsBuffer(opts);

      function wrapIterator(iterator) {
        return {
          next: function (cb) {
            return iterator.next(cb);
          },
          end: function (cb) {
            iterator.end(cb);
          }
        };
      }

      return wrapIterator(db.db.iterator(opts));
    }
  };
}

class NotFoundError extends Error {
  constructor() {
    super();
    this.name = 'NotFoundError';
  }
}

var EventEmitter = events.EventEmitter;
var version = "6.5.4";

var NOT_FOUND_ERROR = new NotFoundError();

var sublevel = function (nut, prefix, createStream, options) {
  var emitter = new EventEmitter();
  emitter.sublevels = {};
  emitter.options = options;

  emitter.version = version;

  emitter.methods = {};
  prefix = prefix || [];

  function mergeOpts(opts) {
    var o = {};
    var k;
    if (options) {
      for (k in options) {
        if (typeof options[k] !== 'undefined') {
          o[k] = options[k];
        }
      }
    }
    if (opts) {
      for (k in opts) {
        if (typeof opts[k] !== 'undefined') {
          o[k] = opts[k];
        }
      }
    }
    return o;
  }

  emitter.put = function (key, value, opts, cb) {
    if ('function' === typeof opts) {
      cb = opts;
      opts = {};
    }

    nut.apply([{
      key: key, value: value,
      prefix: prefix.slice(), type: 'put'
    }], mergeOpts(opts), function (err) {
      /* istanbul ignore next */
      if (err) {
        return cb(err);
      }
      emitter.emit('put', key, value);
      cb(null);
    });
  };

  emitter.prefix = function () {
    return prefix.slice();
  };

  emitter.batch = function (ops, opts, cb) {
    if ('function' === typeof opts) {
      cb = opts;
      opts = {};
    }

    ops = ops.map(function (op) {
      return {
        key: op.key,
        value: op.value,
        prefix: op.prefix || prefix,
        keyEncoding: op.keyEncoding,    // *
        valueEncoding: op.valueEncoding,  // * (TODO: encodings on sublevel)
        type: op.type
      };
    });

    nut.apply(ops, mergeOpts(opts), function (err) {
      /* istanbul ignore next */
      if (err) {
        return cb(err);
      }
      emitter.emit('batch', ops);
      cb(null);
    });
  };

  emitter.get = function (key, opts, cb) {
    /* istanbul ignore else */
    if ('function' === typeof opts) {
      cb = opts;
      opts = {};
    }
    nut.get(key, prefix, mergeOpts(opts), function (err, value) {
      if (err) {
        cb(NOT_FOUND_ERROR);
      } else {
        cb(null, value);
      }
    });
  };

  emitter.sublevel = function (name, opts) {
    return emitter.sublevels[name] =
      emitter.sublevels[name] || sublevel(nut, prefix.concat(name), createStream, mergeOpts(opts));
  };

  emitter.readStream = emitter.createReadStream = function (opts) {
    opts = mergeOpts(opts);
    opts.prefix = prefix;
    var stream;
    var it = nut.iterator(opts);

    stream = createStream(opts, nut.createDecoder(opts));
    stream.setIterator(it);

    return stream;
  };

  emitter.close = function (cb) {
    nut.close(cb);
  };

  emitter.isOpen = nut.isOpen;
  emitter.isClosed = nut.isClosed;

  return emitter;
};

var encodings$1 = {};

(function (exports) {
	var Buffer = buffer.Buffer;

	exports.utf8 = exports['utf-8'] = {
	  encode: function (data) {
	    return isBinary(data) ? data : String(data)
	  },
	  decode: identity,
	  buffer: false,
	  type: 'utf8'
	};

	exports.json = {
	  encode: JSON.stringify,
	  decode: JSON.parse,
	  buffer: false,
	  type: 'json'
	};

	exports.binary = {
	  encode: function (data) {
	    return isBinary(data) ? data : Buffer.from(data)
	  },
	  decode: identity,
	  buffer: true,
	  type: 'binary'
	};

	exports.none = {
	  encode: identity,
	  decode: identity,
	  buffer: false,
	  type: 'id'
	};

	exports.id = exports.none;

	var bufferEncodings = [
	  'hex',
	  'ascii',
	  'base64',
	  'ucs2',
	  'ucs-2',
	  'utf16le',
	  'utf-16le'
	];

	bufferEncodings.forEach(function (type) {
	  exports[type] = {
	    encode: function (data) {
	      return isBinary(data) ? data : Buffer.from(data, type)
	    },
	    decode: function (buffer) {
	      return buffer.toString(type)
	    },
	    buffer: true,
	    type: type
	  };
	});

	function identity (value) {
	  return value
	}

	function isBinary (data) {
	  return data === undefined || data === null || Buffer.isBuffer(data)
	} 
} (encodings$1));

var encodings = encodings$1;

var levelCodec = Codec;

function Codec (opts) {
  if (!(this instanceof Codec)) {
    return new Codec(opts)
  }
  this.opts = opts || {};
  this.encodings = encodings;
}

Codec.prototype._encoding = function (encoding) {
  if (typeof encoding === 'string') encoding = encodings[encoding];
  if (!encoding) encoding = encodings.id;
  return encoding
};

Codec.prototype._keyEncoding = function (opts, batchOpts) {
  return this._encoding((batchOpts && batchOpts.keyEncoding) ||
                        (opts && opts.keyEncoding) ||
                        this.opts.keyEncoding)
};

Codec.prototype._valueEncoding = function (opts, batchOpts) {
  return this._encoding((batchOpts && (batchOpts.valueEncoding || batchOpts.encoding)) ||
                        (opts && (opts.valueEncoding || opts.encoding)) ||
                        (this.opts.valueEncoding || this.opts.encoding))
};

Codec.prototype.encodeKey = function (key, opts, batchOpts) {
  return this._keyEncoding(opts, batchOpts).encode(key)
};

Codec.prototype.encodeValue = function (value, opts, batchOpts) {
  return this._valueEncoding(opts, batchOpts).encode(value)
};

Codec.prototype.decodeKey = function (key, opts) {
  return this._keyEncoding(opts).decode(key)
};

Codec.prototype.decodeValue = function (value, opts) {
  return this._valueEncoding(opts).decode(value)
};

Codec.prototype.encodeBatch = function (ops, opts) {
  var self = this;

  return ops.map(function (_op) {
    var op = {
      type: _op.type,
      key: self.encodeKey(_op.key, opts, _op)
    };
    if (self.keyAsBuffer(opts, _op)) op.keyEncoding = 'binary';
    if (_op.prefix) op.prefix = _op.prefix;
    if ('value' in _op) {
      op.value = self.encodeValue(_op.value, opts, _op);
      if (self.valueAsBuffer(opts, _op)) op.valueEncoding = 'binary';
    }
    return op
  })
};

var ltgtKeys = ['lt', 'gt', 'lte', 'gte', 'start', 'end'];

Codec.prototype.encodeLtgt = function (ltgt) {
  var self = this;
  var ret = {};
  Object.keys(ltgt).forEach(function (key) {
    ret[key] = ltgtKeys.indexOf(key) > -1
      ? self.encodeKey(ltgt[key], ltgt)
      : ltgt[key];
  });
  return ret
};

Codec.prototype.createStreamDecoder = function (opts) {
  var self = this;

  if (opts.keys && opts.values) {
    return function (key, value) {
      return {
        key: self.decodeKey(key, opts),
        value: self.decodeValue(value, opts)
      }
    }
  } else if (opts.keys) {
    return function (key) {
      return self.decodeKey(key, opts)
    }
  } else if (opts.values) {
    return function (_, value) {
      return self.decodeValue(value, opts)
    }
  } else {
    return function () {}
  }
};

Codec.prototype.keyAsBuffer = function (opts) {
  return this._keyEncoding(opts).buffer
};

Codec.prototype.valueAsBuffer = function (opts) {
  return this._valueEncoding(opts).buffer
};

var Codec$1 = /*@__PURE__*/getDefaultExportFromCjs(levelCodec);

var readable = {exports: {}};

var isarray = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

var util$2 = {};

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
util$2.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
util$2.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
util$2.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
util$2.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
util$2.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
util$2.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
util$2.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
util$2.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
util$2.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
util$2.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
util$2.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
util$2.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
util$2.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
util$2.isPrimitive = isPrimitive;

util$2.isBuffer = buffer.Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

var _stream_writable;
var hasRequired_stream_writable;

function require_stream_writable () {
	if (hasRequired_stream_writable) return _stream_writable;
	hasRequired_stream_writable = 1;
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

	// A bit simpler than readable streams.
	// Implement an async ._write(chunk, cb), and it'll handle all
	// the drain event emission and buffering.

	_stream_writable = Writable;

	/*<replacement>*/
	var Buffer = buffer.Buffer;
	/*</replacement>*/

	Writable.WritableState = WritableState;


	/*<replacement>*/
	var util = util$2;
	util.inherits = inherits_browserExports;
	/*</replacement>*/

	var Stream = require$$3;

	util.inherits(Writable, Stream);

	function WriteReq(chunk, encoding, cb) {
	  this.chunk = chunk;
	  this.encoding = encoding;
	  this.callback = cb;
	}

	function WritableState(options, stream) {
	  var Duplex = require_stream_duplex();

	  options = options || {};

	  // the point at which write() starts returning false
	  // Note: 0 is a valid value, means that we always return false if
	  // the entire buffer is not flushed immediately on write()
	  var hwm = options.highWaterMark;
	  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

	  // object stream flag to indicate whether or not this stream
	  // contains buffers or objects.
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex)
	    this.objectMode = this.objectMode || !!options.writableObjectMode;

	  // cast to ints.
	  this.highWaterMark = ~~this.highWaterMark;

	  this.needDrain = false;
	  // at the start of calling end()
	  this.ending = false;
	  // when end() has been called, and returned
	  this.ended = false;
	  // when 'finish' is emitted
	  this.finished = false;

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
	  this.onwrite = function(er) {
	    onwrite(stream, er);
	  };

	  // the callback that the user supplies to write(chunk,encoding,cb)
	  this.writecb = null;

	  // the amount that is being written when _write is called.
	  this.writelen = 0;

	  this.buffer = [];

	  // number of pending user-supplied write callbacks
	  // this must be 0 before 'finish' can be emitted
	  this.pendingcb = 0;

	  // emit prefinish if the only thing we're waiting for is _write cbs
	  // This is relevant for synchronous Transform streams
	  this.prefinished = false;

	  // True if the error was already emitted and should not be thrown again
	  this.errorEmitted = false;
	}

	function Writable(options) {
	  var Duplex = require_stream_duplex();

	  // Writable ctor is applied to Duplexes, though they're not
	  // instanceof Writable, they're instanceof Readable.
	  if (!(this instanceof Writable) && !(this instanceof Duplex))
	    return new Writable(options);

	  this._writableState = new WritableState(options, this);

	  // legacy.
	  this.writable = true;

	  Stream.call(this);
	}

	// Otherwise people can pipe Writable streams, which is just wrong.
	Writable.prototype.pipe = function() {
	  this.emit('error', new Error('Cannot pipe. Not readable.'));
	};


	function writeAfterEnd(stream, state, cb) {
	  var er = new Error('write after end');
	  // TODO: defer error events consistently everywhere, not just the cb
	  stream.emit('error', er);
	  process.nextTick(function() {
	    cb(er);
	  });
	}

	// If we get something that is not a buffer, string, null, or undefined,
	// and we're not in objectMode, then that's an error.
	// Otherwise stream chunks are all considered to be of length=1, and the
	// watermarks determine how many objects to keep in the buffer, rather than
	// how many bytes or characters.
	function validChunk(stream, state, chunk, cb) {
	  var valid = true;
	  if (!util.isBuffer(chunk) &&
	      !util.isString(chunk) &&
	      !util.isNullOrUndefined(chunk) &&
	      !state.objectMode) {
	    var er = new TypeError('Invalid non-string/buffer chunk');
	    stream.emit('error', er);
	    process.nextTick(function() {
	      cb(er);
	    });
	    valid = false;
	  }
	  return valid;
	}

	Writable.prototype.write = function(chunk, encoding, cb) {
	  var state = this._writableState;
	  var ret = false;

	  if (util.isFunction(encoding)) {
	    cb = encoding;
	    encoding = null;
	  }

	  if (util.isBuffer(chunk))
	    encoding = 'buffer';
	  else if (!encoding)
	    encoding = state.defaultEncoding;

	  if (!util.isFunction(cb))
	    cb = function() {};

	  if (state.ended)
	    writeAfterEnd(this, state, cb);
	  else if (validChunk(this, state, chunk, cb)) {
	    state.pendingcb++;
	    ret = writeOrBuffer(this, state, chunk, encoding, cb);
	  }

	  return ret;
	};

	Writable.prototype.cork = function() {
	  var state = this._writableState;

	  state.corked++;
	};

	Writable.prototype.uncork = function() {
	  var state = this._writableState;

	  if (state.corked) {
	    state.corked--;

	    if (!state.writing &&
	        !state.corked &&
	        !state.finished &&
	        !state.bufferProcessing &&
	        state.buffer.length)
	      clearBuffer(this, state);
	  }
	};

	function decodeChunk(state, chunk, encoding) {
	  if (!state.objectMode &&
	      state.decodeStrings !== false &&
	      util.isString(chunk)) {
	    chunk = new Buffer(chunk, encoding);
	  }
	  return chunk;
	}

	// if we're already writing something, then just put this
	// in the queue, and wait our turn.  Otherwise, call _write
	// If we return false, then we need a drain event, so set that flag.
	function writeOrBuffer(stream, state, chunk, encoding, cb) {
	  chunk = decodeChunk(state, chunk, encoding);
	  if (util.isBuffer(chunk))
	    encoding = 'buffer';
	  var len = state.objectMode ? 1 : chunk.length;

	  state.length += len;

	  var ret = state.length < state.highWaterMark;
	  // we must ensure that previous needDrain will not be reset to false.
	  if (!ret)
	    state.needDrain = true;

	  if (state.writing || state.corked)
	    state.buffer.push(new WriteReq(chunk, encoding, cb));
	  else
	    doWrite(stream, state, false, len, chunk, encoding, cb);

	  return ret;
	}

	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
	  state.writelen = len;
	  state.writecb = cb;
	  state.writing = true;
	  state.sync = true;
	  if (writev)
	    stream._writev(chunk, state.onwrite);
	  else
	    stream._write(chunk, encoding, state.onwrite);
	  state.sync = false;
	}

	function onwriteError(stream, state, sync, er, cb) {
	  if (sync)
	    process.nextTick(function() {
	      state.pendingcb--;
	      cb(er);
	    });
	  else {
	    state.pendingcb--;
	    cb(er);
	  }

	  stream._writableState.errorEmitted = true;
	  stream.emit('error', er);
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

	  if (er)
	    onwriteError(stream, state, sync, er, cb);
	  else {
	    // Check if we're actually ready to finish, but don't emit yet
	    var finished = needFinish(stream, state);

	    if (!finished &&
	        !state.corked &&
	        !state.bufferProcessing &&
	        state.buffer.length) {
	      clearBuffer(stream, state);
	    }

	    if (sync) {
	      process.nextTick(function() {
	        afterWrite(stream, state, finished, cb);
	      });
	    } else {
	      afterWrite(stream, state, finished, cb);
	    }
	  }
	}

	function afterWrite(stream, state, finished, cb) {
	  if (!finished)
	    onwriteDrain(stream, state);
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

	  if (stream._writev && state.buffer.length > 1) {
	    // Fast case, write everything using _writev()
	    var cbs = [];
	    for (var c = 0; c < state.buffer.length; c++)
	      cbs.push(state.buffer[c].callback);

	    // count the one we are adding, as well.
	    // TODO(isaacs) clean this up
	    state.pendingcb++;
	    doWrite(stream, state, true, state.length, state.buffer, '', function(err) {
	      for (var i = 0; i < cbs.length; i++) {
	        state.pendingcb--;
	        cbs[i](err);
	      }
	    });

	    // Clear buffer
	    state.buffer = [];
	  } else {
	    // Slow case, write chunks one-by-one
	    for (var c = 0; c < state.buffer.length; c++) {
	      var entry = state.buffer[c];
	      var chunk = entry.chunk;
	      var encoding = entry.encoding;
	      var cb = entry.callback;
	      var len = state.objectMode ? 1 : chunk.length;

	      doWrite(stream, state, false, len, chunk, encoding, cb);

	      // if we didn't call the onwrite immediately, then
	      // it means that we need to wait until it does.
	      // also, that means that the chunk and cb are currently
	      // being processed, so move the buffer counter past them.
	      if (state.writing) {
	        c++;
	        break;
	      }
	    }

	    if (c < state.buffer.length)
	      state.buffer = state.buffer.slice(c);
	    else
	      state.buffer.length = 0;
	  }

	  state.bufferProcessing = false;
	}

	Writable.prototype._write = function(chunk, encoding, cb) {
	  cb(new Error('not implemented'));

	};

	Writable.prototype._writev = null;

	Writable.prototype.end = function(chunk, encoding, cb) {
	  var state = this._writableState;

	  if (util.isFunction(chunk)) {
	    cb = chunk;
	    chunk = null;
	    encoding = null;
	  } else if (util.isFunction(encoding)) {
	    cb = encoding;
	    encoding = null;
	  }

	  if (!util.isNullOrUndefined(chunk))
	    this.write(chunk, encoding);

	  // .end() fully uncorks
	  if (state.corked) {
	    state.corked = 1;
	    this.uncork();
	  }

	  // ignore unnecessary end() calls.
	  if (!state.ending && !state.finished)
	    endWritable(this, state, cb);
	};


	function needFinish(stream, state) {
	  return (state.ending &&
	          state.length === 0 &&
	          !state.finished &&
	          !state.writing);
	}

	function prefinish(stream, state) {
	  if (!state.prefinished) {
	    state.prefinished = true;
	    stream.emit('prefinish');
	  }
	}

	function finishMaybe(stream, state) {
	  var need = needFinish(stream, state);
	  if (need) {
	    if (state.pendingcb === 0) {
	      prefinish(stream, state);
	      state.finished = true;
	      stream.emit('finish');
	    } else
	      prefinish(stream, state);
	  }
	  return need;
	}

	function endWritable(stream, state, cb) {
	  state.ending = true;
	  finishMaybe(stream, state);
	  if (cb) {
	    if (state.finished)
	      process.nextTick(cb);
	    else
	      stream.once('finish', cb);
	  }
	  state.ended = true;
	}
	return _stream_writable;
}

var _stream_duplex;
var hasRequired_stream_duplex;

function require_stream_duplex () {
	if (hasRequired_stream_duplex) return _stream_duplex;
	hasRequired_stream_duplex = 1;
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

	// a duplex stream is just a stream that is both readable and writable.
	// Since JS doesn't have multiple prototypal inheritance, this class
	// prototypally inherits from Readable, and then parasitically from
	// Writable.

	_stream_duplex = Duplex;

	/*<replacement>*/
	var objectKeys = Object.keys || function (obj) {
	  var keys = [];
	  for (var key in obj) keys.push(key);
	  return keys;
	};
	/*</replacement>*/


	/*<replacement>*/
	var util = util$2;
	util.inherits = inherits_browserExports;
	/*</replacement>*/

	var Readable = require_stream_readable();
	var Writable = require_stream_writable();

	util.inherits(Duplex, Readable);

	forEach(objectKeys(Writable.prototype), function(method) {
	  if (!Duplex.prototype[method])
	    Duplex.prototype[method] = Writable.prototype[method];
	});

	function Duplex(options) {
	  if (!(this instanceof Duplex))
	    return new Duplex(options);

	  Readable.call(this, options);
	  Writable.call(this, options);

	  if (options && options.readable === false)
	    this.readable = false;

	  if (options && options.writable === false)
	    this.writable = false;

	  this.allowHalfOpen = true;
	  if (options && options.allowHalfOpen === false)
	    this.allowHalfOpen = false;

	  this.once('end', onend);
	}

	// the no-half-open enforcer
	function onend() {
	  // if we allow half-open state, or if the writable side ended,
	  // then we're ok.
	  if (this.allowHalfOpen || this._writableState.ended)
	    return;

	  // no more data can be written.
	  // But allow more writes to happen in this tick.
	  process.nextTick(this.end.bind(this));
	}

	function forEach (xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}
	return _stream_duplex;
}

var string_decoder = {};

var hasRequiredString_decoder;

function requireString_decoder () {
	if (hasRequiredString_decoder) return string_decoder;
	hasRequiredString_decoder = 1;
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

	var Buffer = buffer.Buffer;

	var isBufferEncoding = Buffer.isEncoding
	  || function(encoding) {
	       switch (encoding && encoding.toLowerCase()) {
	         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
	         default: return false;
	       }
	     };


	function assertEncoding(encoding) {
	  if (encoding && !isBufferEncoding(encoding)) {
	    throw new Error('Unknown encoding: ' + encoding);
	  }
	}

	// StringDecoder provides an interface for efficiently splitting a series of
	// buffers into a series of JS strings without breaking apart multi-byte
	// characters. CESU-8 is handled as part of the UTF-8 encoding.
	//
	// @TODO Handling all encodings inside a single object makes it very difficult
	// to reason about this code, so it should be split up in the future.
	// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
	// points as used by CESU-8.
	var StringDecoder = string_decoder.StringDecoder = function(encoding) {
	  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
	  assertEncoding(encoding);
	  switch (this.encoding) {
	    case 'utf8':
	      // CESU-8 represents each of Surrogate Pair by 3-bytes
	      this.surrogateSize = 3;
	      break;
	    case 'ucs2':
	    case 'utf16le':
	      // UTF-16 represents each of Surrogate Pair by 2-bytes
	      this.surrogateSize = 2;
	      this.detectIncompleteChar = utf16DetectIncompleteChar;
	      break;
	    case 'base64':
	      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
	      this.surrogateSize = 3;
	      this.detectIncompleteChar = base64DetectIncompleteChar;
	      break;
	    default:
	      this.write = passThroughWrite;
	      return;
	  }

	  // Enough space to store all bytes of a single character. UTF-8 needs 4
	  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
	  this.charBuffer = new Buffer(6);
	  // Number of bytes received for the current incomplete multi-byte character.
	  this.charReceived = 0;
	  // Number of bytes expected for the current incomplete multi-byte character.
	  this.charLength = 0;
	};


	// write decodes the given buffer and returns it as JS string that is
	// guaranteed to not contain any partial multi-byte characters. Any partial
	// character found at the end of the buffer is buffered up, and will be
	// returned when calling write again with the remaining bytes.
	//
	// Note: Converting a Buffer containing an orphan surrogate to a String
	// currently works, but converting a String to a Buffer (via `new Buffer`, or
	// Buffer#write) will replace incomplete surrogates with the unicode
	// replacement character. See https://codereview.chromium.org/121173009/ .
	StringDecoder.prototype.write = function(buffer) {
	  var charStr = '';
	  // if our last write ended with an incomplete multibyte character
	  while (this.charLength) {
	    // determine how many remaining bytes this buffer has to offer for this char
	    var available = (buffer.length >= this.charLength - this.charReceived) ?
	        this.charLength - this.charReceived :
	        buffer.length;

	    // add the new bytes to the char buffer
	    buffer.copy(this.charBuffer, this.charReceived, 0, available);
	    this.charReceived += available;

	    if (this.charReceived < this.charLength) {
	      // still not enough chars in this buffer? wait for more ...
	      return '';
	    }

	    // remove bytes belonging to the current character from the buffer
	    buffer = buffer.slice(available, buffer.length);

	    // get the character that was split
	    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

	    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
	    var charCode = charStr.charCodeAt(charStr.length - 1);
	    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
	      this.charLength += this.surrogateSize;
	      charStr = '';
	      continue;
	    }
	    this.charReceived = this.charLength = 0;

	    // if there are no more bytes in this buffer, just emit our char
	    if (buffer.length === 0) {
	      return charStr;
	    }
	    break;
	  }

	  // determine and set charLength / charReceived
	  this.detectIncompleteChar(buffer);

	  var end = buffer.length;
	  if (this.charLength) {
	    // buffer the incomplete character bytes we got
	    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
	    end -= this.charReceived;
	  }

	  charStr += buffer.toString(this.encoding, 0, end);

	  var end = charStr.length - 1;
	  var charCode = charStr.charCodeAt(end);
	  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
	  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
	    var size = this.surrogateSize;
	    this.charLength += size;
	    this.charReceived += size;
	    this.charBuffer.copy(this.charBuffer, size, 0, size);
	    buffer.copy(this.charBuffer, 0, 0, size);
	    return charStr.substring(0, end);
	  }

	  // or just emit the charStr
	  return charStr;
	};

	// detectIncompleteChar determines if there is an incomplete UTF-8 character at
	// the end of the given buffer. If so, it sets this.charLength to the byte
	// length that character, and sets this.charReceived to the number of bytes
	// that are available for this character.
	StringDecoder.prototype.detectIncompleteChar = function(buffer) {
	  // determine how many bytes we have to check at the end of this buffer
	  var i = (buffer.length >= 3) ? 3 : buffer.length;

	  // Figure out if one of the last i bytes of our buffer announces an
	  // incomplete char.
	  for (; i > 0; i--) {
	    var c = buffer[buffer.length - i];

	    // See http://en.wikipedia.org/wiki/UTF-8#Description

	    // 110XXXXX
	    if (i == 1 && c >> 5 == 0x06) {
	      this.charLength = 2;
	      break;
	    }

	    // 1110XXXX
	    if (i <= 2 && c >> 4 == 0x0E) {
	      this.charLength = 3;
	      break;
	    }

	    // 11110XXX
	    if (i <= 3 && c >> 3 == 0x1E) {
	      this.charLength = 4;
	      break;
	    }
	  }
	  this.charReceived = i;
	};

	StringDecoder.prototype.end = function(buffer) {
	  var res = '';
	  if (buffer && buffer.length)
	    res = this.write(buffer);

	  if (this.charReceived) {
	    var cr = this.charReceived;
	    var buf = this.charBuffer;
	    var enc = this.encoding;
	    res += buf.slice(0, cr).toString(enc);
	  }

	  return res;
	};

	function passThroughWrite(buffer) {
	  return buffer.toString(this.encoding);
	}

	function utf16DetectIncompleteChar(buffer) {
	  this.charReceived = buffer.length % 2;
	  this.charLength = this.charReceived ? 2 : 0;
	}

	function base64DetectIncompleteChar(buffer) {
	  this.charReceived = buffer.length % 3;
	  this.charLength = this.charReceived ? 3 : 0;
	}
	return string_decoder;
}

var _stream_readable;
var hasRequired_stream_readable;

function require_stream_readable () {
	if (hasRequired_stream_readable) return _stream_readable;
	hasRequired_stream_readable = 1;
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

	_stream_readable = Readable;

	/*<replacement>*/
	var isArray = isarray;
	/*</replacement>*/


	/*<replacement>*/
	var Buffer = buffer.Buffer;
	/*</replacement>*/

	Readable.ReadableState = ReadableState;

	var EE = events$1.EventEmitter;

	/*<replacement>*/
	if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
	  return emitter.listeners(type).length;
	};
	/*</replacement>*/

	var Stream = require$$3;

	/*<replacement>*/
	var util = util$2;
	util.inherits = inherits_browserExports;
	/*</replacement>*/

	var StringDecoder;


	/*<replacement>*/
	var debug = require$$3$1;
	if (debug && debug.debuglog) {
	  debug = debug.debuglog('stream');
	} else {
	  debug = function () {};
	}
	/*</replacement>*/


	util.inherits(Readable, Stream);

	function ReadableState(options, stream) {
	  var Duplex = require_stream_duplex();

	  options = options || {};

	  // the point at which it stops calling _read() to fill the buffer
	  // Note: 0 is a valid value, means "don't call _read preemptively ever"
	  var hwm = options.highWaterMark;
	  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

	  // cast to ints.
	  this.highWaterMark = ~~this.highWaterMark;

	  this.buffer = [];
	  this.length = 0;
	  this.pipes = null;
	  this.pipesCount = 0;
	  this.flowing = null;
	  this.ended = false;
	  this.endEmitted = false;
	  this.reading = false;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // whenever we return null, then we set a flag to say
	  // that we're awaiting a 'readable' event emission.
	  this.needReadable = false;
	  this.emittedReadable = false;
	  this.readableListening = false;


	  // object stream flag. Used to make read(n) ignore n and to
	  // make all the buffer merging and length checks go away
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex)
	    this.objectMode = this.objectMode || !!options.readableObjectMode;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // when piping, we only care about 'readable' events that happen
	  // after read()ing all the bytes and not getting any pushback.
	  this.ranOut = false;

	  // the number of writers that are awaiting a drain event in .pipe()s
	  this.awaitDrain = 0;

	  // if true, a maybeReadMore has been scheduled
	  this.readingMore = false;

	  this.decoder = null;
	  this.encoding = null;
	  if (options.encoding) {
	    if (!StringDecoder)
	      StringDecoder = requireString_decoder().StringDecoder;
	    this.decoder = new StringDecoder(options.encoding);
	    this.encoding = options.encoding;
	  }
	}

	function Readable(options) {
	  require_stream_duplex();

	  if (!(this instanceof Readable))
	    return new Readable(options);

	  this._readableState = new ReadableState(options, this);

	  // legacy
	  this.readable = true;

	  Stream.call(this);
	}

	// Manually shove something into the read() buffer.
	// This returns true if the highWaterMark has not been hit yet,
	// similar to how Writable.write() returns true if you should
	// write() some more.
	Readable.prototype.push = function(chunk, encoding) {
	  var state = this._readableState;

	  if (util.isString(chunk) && !state.objectMode) {
	    encoding = encoding || state.defaultEncoding;
	    if (encoding !== state.encoding) {
	      chunk = new Buffer(chunk, encoding);
	      encoding = '';
	    }
	  }

	  return readableAddChunk(this, state, chunk, encoding, false);
	};

	// Unshift should *always* be something directly out of read()
	Readable.prototype.unshift = function(chunk) {
	  var state = this._readableState;
	  return readableAddChunk(this, state, chunk, '', true);
	};

	function readableAddChunk(stream, state, chunk, encoding, addToFront) {
	  var er = chunkInvalid(state, chunk);
	  if (er) {
	    stream.emit('error', er);
	  } else if (util.isNullOrUndefined(chunk)) {
	    state.reading = false;
	    if (!state.ended)
	      onEofChunk(stream, state);
	  } else if (state.objectMode || chunk && chunk.length > 0) {
	    if (state.ended && !addToFront) {
	      var e = new Error('stream.push() after EOF');
	      stream.emit('error', e);
	    } else if (state.endEmitted && addToFront) {
	      var e = new Error('stream.unshift() after end event');
	      stream.emit('error', e);
	    } else {
	      if (state.decoder && !addToFront && !encoding)
	        chunk = state.decoder.write(chunk);

	      if (!addToFront)
	        state.reading = false;

	      // if we want the data now, just emit it.
	      if (state.flowing && state.length === 0 && !state.sync) {
	        stream.emit('data', chunk);
	        stream.read(0);
	      } else {
	        // update the buffer info.
	        state.length += state.objectMode ? 1 : chunk.length;
	        if (addToFront)
	          state.buffer.unshift(chunk);
	        else
	          state.buffer.push(chunk);

	        if (state.needReadable)
	          emitReadable(stream);
	      }

	      maybeReadMore(stream, state);
	    }
	  } else if (!addToFront) {
	    state.reading = false;
	  }

	  return needMoreData(state);
	}



	// if it's past the high water mark, we can push in some more.
	// Also, if we have no data yet, we can stand some
	// more bytes.  This is to work around cases where hwm=0,
	// such as the repl.  Also, if the push() triggered a
	// readable event, and the user called read(largeNumber) such that
	// needReadable was set, then we ought to push more, so that another
	// 'readable' event will be triggered.
	function needMoreData(state) {
	  return !state.ended &&
	         (state.needReadable ||
	          state.length < state.highWaterMark ||
	          state.length === 0);
	}

	// backwards compatibility.
	Readable.prototype.setEncoding = function(enc) {
	  if (!StringDecoder)
	    StringDecoder = requireString_decoder().StringDecoder;
	  this._readableState.decoder = new StringDecoder(enc);
	  this._readableState.encoding = enc;
	  return this;
	};

	// Don't raise the hwm > 128MB
	var MAX_HWM = 0x800000;
	function roundUpToNextPowerOf2(n) {
	  if (n >= MAX_HWM) {
	    n = MAX_HWM;
	  } else {
	    // Get the next highest power of 2
	    n--;
	    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
	    n++;
	  }
	  return n;
	}

	function howMuchToRead(n, state) {
	  if (state.length === 0 && state.ended)
	    return 0;

	  if (state.objectMode)
	    return n === 0 ? 0 : 1;

	  if (isNaN(n) || util.isNull(n)) {
	    // only flow one buffer at a time
	    if (state.flowing && state.buffer.length)
	      return state.buffer[0].length;
	    else
	      return state.length;
	  }

	  if (n <= 0)
	    return 0;

	  // If we're asking for more than the target buffer level,
	  // then raise the water mark.  Bump up to the next highest
	  // power of 2, to prevent increasing it excessively in tiny
	  // amounts.
	  if (n > state.highWaterMark)
	    state.highWaterMark = roundUpToNextPowerOf2(n);

	  // don't have that much.  return null, unless we've ended.
	  if (n > state.length) {
	    if (!state.ended) {
	      state.needReadable = true;
	      return 0;
	    } else
	      return state.length;
	  }

	  return n;
	}

	// you can override either this method, or the async _read(n) below.
	Readable.prototype.read = function(n) {
	  debug('read', n);
	  var state = this._readableState;
	  var nOrig = n;

	  if (!util.isNumber(n) || n > 0)
	    state.emittedReadable = false;

	  // if we're doing read(0) to trigger a readable event, but we
	  // already have a bunch of data in the buffer, then just trigger
	  // the 'readable' event and move on.
	  if (n === 0 &&
	      state.needReadable &&
	      (state.length >= state.highWaterMark || state.ended)) {
	    debug('read: emitReadable', state.length, state.ended);
	    if (state.length === 0 && state.ended)
	      endReadable(this);
	    else
	      emitReadable(this);
	    return null;
	  }

	  n = howMuchToRead(n, state);

	  // if we've ended, and we're now clear, then finish it up.
	  if (n === 0 && state.ended) {
	    if (state.length === 0)
	      endReadable(this);
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
	  }

	  if (doRead) {
	    debug('do read');
	    state.reading = true;
	    state.sync = true;
	    // if the length is currently zero, then we *need* a readable event.
	    if (state.length === 0)
	      state.needReadable = true;
	    // call internal read method
	    this._read(state.highWaterMark);
	    state.sync = false;
	  }

	  // If _read pushed data synchronously, then `reading` will be false,
	  // and we need to re-evaluate how much data we can return to the user.
	  if (doRead && !state.reading)
	    n = howMuchToRead(nOrig, state);

	  var ret;
	  if (n > 0)
	    ret = fromList(n, state);
	  else
	    ret = null;

	  if (util.isNull(ret)) {
	    state.needReadable = true;
	    n = 0;
	  }

	  state.length -= n;

	  // If we have nothing in the buffer, then we want to know
	  // as soon as we *do* get something into the buffer.
	  if (state.length === 0 && !state.ended)
	    state.needReadable = true;

	  // If we tried to read() past the EOF, then emit end on the next tick.
	  if (nOrig !== n && state.ended && state.length === 0)
	    endReadable(this);

	  if (!util.isNull(ret))
	    this.emit('data', ret);

	  return ret;
	};

	function chunkInvalid(state, chunk) {
	  var er = null;
	  if (!util.isBuffer(chunk) &&
	      !util.isString(chunk) &&
	      !util.isNullOrUndefined(chunk) &&
	      !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  return er;
	}


	function onEofChunk(stream, state) {
	  if (state.decoder && !state.ended) {
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
	    if (state.sync)
	      process.nextTick(function() {
	        emitReadable_(stream);
	      });
	    else
	      emitReadable_(stream);
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
	    process.nextTick(function() {
	      maybeReadMore_(stream, state);
	    });
	  }
	}

	function maybeReadMore_(stream, state) {
	  var len = state.length;
	  while (!state.reading && !state.flowing && !state.ended &&
	         state.length < state.highWaterMark) {
	    debug('maybeReadMore read 0');
	    stream.read(0);
	    if (len === state.length)
	      // didn't get any data, stop spinning.
	      break;
	    else
	      len = state.length;
	  }
	  state.readingMore = false;
	}

	// abstract method.  to be overridden in specific implementation classes.
	// call cb(er, data) where data is <= n in length.
	// for virtual (non-string, non-buffer) streams, "length" is somewhat
	// arbitrary, and perhaps not very meaningful.
	Readable.prototype._read = function(n) {
	  this.emit('error', new Error('not implemented'));
	};

	Readable.prototype.pipe = function(dest, pipeOpts) {
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

	  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
	              dest !== process.stdout &&
	              dest !== process.stderr;

	  var endFn = doEnd ? onend : cleanup;
	  if (state.endEmitted)
	    process.nextTick(endFn);
	  else
	    src.once('end', endFn);

	  dest.on('unpipe', onunpipe);
	  function onunpipe(readable) {
	    debug('onunpipe');
	    if (readable === src) {
	      cleanup();
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

	  function cleanup() {
	    debug('cleanup');
	    // cleanup event handlers once the pipe is broken
	    dest.removeListener('close', onclose);
	    dest.removeListener('finish', onfinish);
	    dest.removeListener('drain', ondrain);
	    dest.removeListener('error', onerror);
	    dest.removeListener('unpipe', onunpipe);
	    src.removeListener('end', onend);
	    src.removeListener('end', cleanup);
	    src.removeListener('data', ondata);

	    // if the reader is waiting for a drain event from this
	    // specific writer, then it would cause it to never start
	    // flowing again.
	    // So, if this is awaiting a drain, then we just call it now.
	    // If we don't know, then assume that we are waiting for one.
	    if (state.awaitDrain &&
	        (!dest._writableState || dest._writableState.needDrain))
	      ondrain();
	  }

	  src.on('data', ondata);
	  function ondata(chunk) {
	    debug('ondata');
	    var ret = dest.write(chunk);
	    if (false === ret) {
	      debug('false write response, pause',
	            src._readableState.awaitDrain);
	      src._readableState.awaitDrain++;
	      src.pause();
	    }
	  }

	  // if the dest has an error, then stop piping into it.
	  // however, don't suppress the throwing behavior for this.
	  function onerror(er) {
	    debug('onerror', er);
	    unpipe();
	    dest.removeListener('error', onerror);
	    if (EE.listenerCount(dest, 'error') === 0)
	      dest.emit('error', er);
	  }
	  // This is a brutally ugly hack to make sure that our error handler
	  // is attached before any userland ones.  NEVER DO THIS.
	  if (!dest._events || !dest._events.error)
	    dest.on('error', onerror);
	  else if (isArray(dest._events.error))
	    dest._events.error.unshift(onerror);
	  else
	    dest._events.error = [onerror, dest._events.error];



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
	  return function() {
	    var state = src._readableState;
	    debug('pipeOnDrain', state.awaitDrain);
	    if (state.awaitDrain)
	      state.awaitDrain--;
	    if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
	      state.flowing = true;
	      flow(src);
	    }
	  };
	}


	Readable.prototype.unpipe = function(dest) {
	  var state = this._readableState;

	  // if we're not piping anywhere, then do nothing.
	  if (state.pipesCount === 0)
	    return this;

	  // just one destination.  most common case.
	  if (state.pipesCount === 1) {
	    // passed in one, but it's not the right one.
	    if (dest && dest !== state.pipes)
	      return this;

	    if (!dest)
	      dest = state.pipes;

	    // got a match.
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;
	    if (dest)
	      dest.emit('unpipe', this);
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

	    for (var i = 0; i < len; i++)
	      dests[i].emit('unpipe', this);
	    return this;
	  }

	  // try to find the right one.
	  var i = indexOf(state.pipes, dest);
	  if (i === -1)
	    return this;

	  state.pipes.splice(i, 1);
	  state.pipesCount -= 1;
	  if (state.pipesCount === 1)
	    state.pipes = state.pipes[0];

	  dest.emit('unpipe', this);

	  return this;
	};

	// set up data events if they are asked for
	// Ensure readable listeners eventually get something
	Readable.prototype.on = function(ev, fn) {
	  var res = Stream.prototype.on.call(this, ev, fn);

	  // If listening to data, and it has not explicitly been paused,
	  // then call resume to start the flow of data on the next tick.
	  if (ev === 'data' && false !== this._readableState.flowing) {
	    this.resume();
	  }

	  if (ev === 'readable' && this.readable) {
	    var state = this._readableState;
	    if (!state.readableListening) {
	      state.readableListening = true;
	      state.emittedReadable = false;
	      state.needReadable = true;
	      if (!state.reading) {
	        var self = this;
	        process.nextTick(function() {
	          debug('readable nexttick read 0');
	          self.read(0);
	        });
	      } else if (state.length) {
	        emitReadable(this);
	      }
	    }
	  }

	  return res;
	};
	Readable.prototype.addListener = Readable.prototype.on;

	// pause() and resume() are remnants of the legacy readable stream API
	// If the user uses them, then switch into old mode.
	Readable.prototype.resume = function() {
	  var state = this._readableState;
	  if (!state.flowing) {
	    debug('resume');
	    state.flowing = true;
	    if (!state.reading) {
	      debug('resume read 0');
	      this.read(0);
	    }
	    resume(this, state);
	  }
	  return this;
	};

	function resume(stream, state) {
	  if (!state.resumeScheduled) {
	    state.resumeScheduled = true;
	    process.nextTick(function() {
	      resume_(stream, state);
	    });
	  }
	}

	function resume_(stream, state) {
	  state.resumeScheduled = false;
	  stream.emit('resume');
	  flow(stream);
	  if (state.flowing && !state.reading)
	    stream.read(0);
	}

	Readable.prototype.pause = function() {
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
	  if (state.flowing) {
	    do {
	      var chunk = stream.read();
	    } while (null !== chunk && state.flowing);
	  }
	}

	// wrap an old-style stream as the async data source.
	// This is *not* part of the readable stream interface.
	// It is an ugly unfortunate mess of history.
	Readable.prototype.wrap = function(stream) {
	  var state = this._readableState;
	  var paused = false;

	  var self = this;
	  stream.on('end', function() {
	    debug('wrapped end');
	    if (state.decoder && !state.ended) {
	      var chunk = state.decoder.end();
	      if (chunk && chunk.length)
	        self.push(chunk);
	    }

	    self.push(null);
	  });

	  stream.on('data', function(chunk) {
	    debug('wrapped data');
	    if (state.decoder)
	      chunk = state.decoder.write(chunk);
	    if (!chunk || !state.objectMode && !chunk.length)
	      return;

	    var ret = self.push(chunk);
	    if (!ret) {
	      paused = true;
	      stream.pause();
	    }
	  });

	  // proxy all the other methods.
	  // important when wrapping filters and duplexes.
	  for (var i in stream) {
	    if (util.isFunction(stream[i]) && util.isUndefined(this[i])) {
	      this[i] = function(method) { return function() {
	        return stream[method].apply(stream, arguments);
	      }}(i);
	    }
	  }

	  // proxy certain important events.
	  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
	  forEach(events, function(ev) {
	    stream.on(ev, self.emit.bind(self, ev));
	  });

	  // when we try to consume some more bytes, simply unpause the
	  // underlying stream.
	  self._read = function(n) {
	    debug('wrapped _read', n);
	    if (paused) {
	      paused = false;
	      stream.resume();
	    }
	  };

	  return self;
	};



	// exposed for testing purposes only.
	Readable._fromList = fromList;

	// Pluck off n bytes from an array of buffers.
	// Length is the combined lengths of all the buffers in the list.
	function fromList(n, state) {
	  var list = state.buffer;
	  var length = state.length;
	  var stringMode = !!state.decoder;
	  var objectMode = !!state.objectMode;
	  var ret;

	  // nothing in the list, definitely empty.
	  if (list.length === 0)
	    return null;

	  if (length === 0)
	    ret = null;
	  else if (objectMode)
	    ret = list.shift();
	  else if (!n || n >= length) {
	    // read it all, truncate the array.
	    if (stringMode)
	      ret = list.join('');
	    else
	      ret = Buffer.concat(list, length);
	    list.length = 0;
	  } else {
	    // read just some of it.
	    if (n < list[0].length) {
	      // just take a part of the first list item.
	      // slice is the same for buffers and strings.
	      var buf = list[0];
	      ret = buf.slice(0, n);
	      list[0] = buf.slice(n);
	    } else if (n === list[0].length) {
	      // first list is a perfect match
	      ret = list.shift();
	    } else {
	      // complex case.
	      // we have enough to cover it, but it spans past the first buffer.
	      if (stringMode)
	        ret = '';
	      else
	        ret = new Buffer(n);

	      var c = 0;
	      for (var i = 0, l = list.length; i < l && c < n; i++) {
	        var buf = list[0];
	        var cpy = Math.min(n - c, buf.length);

	        if (stringMode)
	          ret += buf.slice(0, cpy);
	        else
	          buf.copy(ret, c, 0, cpy);

	        if (cpy < buf.length)
	          list[0] = buf.slice(cpy);
	        else
	          list.shift();

	        c += cpy;
	      }
	    }
	  }

	  return ret;
	}

	function endReadable(stream) {
	  var state = stream._readableState;

	  // If we get here before consuming all the bytes, then that is a
	  // bug in node.  Should never happen.
	  if (state.length > 0)
	    throw new Error('endReadable called on non-empty stream');

	  if (!state.endEmitted) {
	    state.ended = true;
	    process.nextTick(function() {
	      // Check that we didn't get one last unshift.
	      if (!state.endEmitted && state.length === 0) {
	        state.endEmitted = true;
	        stream.readable = false;
	        stream.emit('end');
	      }
	    });
	  }
	}

	function forEach (xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}

	function indexOf (xs, x) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    if (xs[i] === x) return i;
	  }
	  return -1;
	}
	return _stream_readable;
}

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


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

var _stream_transform = Transform$1;

var Duplex = require_stream_duplex();

/*<replacement>*/
var util$1 = util$2;
util$1.inherits = inherits_browserExports;
/*</replacement>*/

util$1.inherits(Transform$1, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (!util$1.isNullOrUndefined(data))
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform$1(options) {
  if (!(this instanceof Transform$1))
    return new Transform$1(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('prefinish', function() {
    if (util$1.isFunction(this._flush))
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform$1.prototype.push = function(chunk, encoding) {
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
Transform$1.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform$1.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform$1.prototype._read = function(n) {
  var ts = this._transformState;

  if (!util$1.isNull(ts.writechunk) && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

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

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

var _stream_passthrough = PassThrough;

var Transform = _stream_transform;

/*<replacement>*/
var util = util$2;
util.inherits = inherits_browserExports;
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

(function (module, exports) {
	exports = module.exports = require_stream_readable();
	exports.Stream = require$$3;
	exports.Readable = exports;
	exports.Writable = require_stream_writable();
	exports.Duplex = require_stream_duplex();
	exports.Transform = _stream_transform;
	exports.PassThrough = _stream_passthrough;
	if (!process.browser && process.env.READABLE_STREAM === 'disable') {
	  module.exports = require$$3;
	} 
} (readable, readable.exports));

var readableExports = readable.exports;
var ReadableStreamCore = /*@__PURE__*/getDefaultExportFromCjs(readableExports);

/* Copyright (c) 2012-2014 LevelUP contributors
 * See list at <https://github.com/rvagg/node-levelup#contributing>
 * MIT License <https://github.com/rvagg/node-levelup/blob/master/LICENSE.md>
 */


var Readable = ReadableStreamCore.Readable;

function createClass(parent, init) {
  let klass = function (...args) {
    if (!(this instanceof klass)) {
      return new klass(...args);
    }
    init.apply(this, args);
  };
  klass.prototype = Object.create(parent.prototype, {
    constructor: { value: klass }
  });
  return klass;
}

class ReadStreamInternal extends Readable {
  constructor(options, makeData) {
    super({ objectMode: true, highWaterMark: options.highWaterMark });
    this._setup(options, makeData);
  }

  _setup(options, makeData) {
    super.constructor({ objectMode: true, highWaterMark: options.highWaterMark });

    // purely to keep `db` around until we're done so it's not GCed if the user doesn't keep a ref
    this._waiting = false;
    this._options = options;
    this._makeData = makeData;
  }

  setIterator(it) {
    this._iterator = it;
    /* istanbul ignore if */
    if (this._destroyed) {
      return it.end(function () {});
    }
    /* istanbul ignore if */
    if (this._waiting) {
      this._waiting = false;
      return this._read();
    }
    return this;
  }

  _cleanup(err) {
    if (this._destroyed) {
      return;
    }
  
    this._destroyed = true;
  
    var self = this;
    /* istanbul ignore if */
    if (err && err.message !== 'iterator has ended') {
      self.emit('error', err);
    }
  
    /* istanbul ignore else */
    if (self._iterator) {
      self._iterator.end(function () {
        self._iterator = null;
        self.emit('close');
      });
    } else {
      self.emit('close');
    }
  }

  destroy() {
    this._cleanup();
  }
  
  _read() {
    var self = this;
    /* istanbul ignore if */
    if (self._destroyed) {
      return;
    }
    /* istanbul ignore if */
    if (!self._iterator) {
      return this._waiting = true;
    }
  
    self._iterator.next(function (err, key, value) {
      if (err || (key === undefined && value === undefined)) {
        if (!err && !self._destroyed) {
          self.push(null);
        }
        return self._cleanup(err);
      }
  
  
      value = self._makeData(key, value);
      if (!self._destroyed) {
        self.push(value);
      }
    });
  }
}

const ReadStream = createClass(ReadStreamInternal, function (options, makeData) {
  ReadStreamInternal.prototype._setup.call(this, options, makeData);
});

var precodec = {
  encode: function (decodedKey) {
    return '\xff' + decodedKey[0] + '\xff' + decodedKey[1];
  },
  decode: function (encodedKeyAsBuffer) {
    var str = encodedKeyAsBuffer.toString();
    var idx = str.indexOf('\xff', 1);
    return [str.substring(1, idx), str.substring(idx + 1)];
  },
  lowerBound: '\x00',
  upperBound: '\xff'
};

var codec = new Codec$1();

function sublevelPouch(db) {
  return sublevel(nut(db, precodec, codec), [], ReadStream, db.options);
}

export { levelCodec as a, buffer as b, inherits_browserExports as i, ltgt as l, sublevelPouch as s };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtMzBiNmJkNTAuanMiLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvaW5oZXJpdHMvaW5oZXJpdHNfYnJvd3Nlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9sdGd0L2luZGV4LmpzIiwiLi4vcGFja2FnZXMvc3VibGV2ZWwtcG91Y2hkYi9zcmMvbnV0LmpzIiwiLi4vcGFja2FnZXMvc3VibGV2ZWwtcG91Y2hkYi9zcmMvTm90Rm91bmRFcnJvci5qcyIsIi4uL3BhY2thZ2VzL3N1YmxldmVsLXBvdWNoZGIvc3JjL3NoZWxsLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xldmVsLWNvZGVjL2xpYi9lbmNvZGluZ3MuanMiLCIuLi9ub2RlX21vZHVsZXMvbGV2ZWwtY29kZWMvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2NvcmUtdXRpbC1pcy9saWIvdXRpbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fd3JpdGFibGUuanMiLCIuLi9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX2R1cGxleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbm9kZV9tb2R1bGVzL3N0cmluZ19kZWNvZGVyL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9yZWFkYWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9wYXNzdGhyb3VnaC5qcyIsIi4uL25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vcmVhZGFibGUuanMiLCIuLi9wYWNrYWdlcy9zdWJsZXZlbC1wb3VjaGRiL3NyYy9yZWFkU3RyZWFtLmpzIiwiLi4vcGFja2FnZXMvc3VibGV2ZWwtcG91Y2hkYi9zcmMvbGVnYWN5Q29kZWMuanMiLCIuLi9wYWNrYWdlcy9zdWJsZXZlbC1wb3VjaGRiL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCdcblxuZXhwb3J0cy5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuZXhwb3J0cy50b0J5dGVBcnJheSA9IHRvQnl0ZUFycmF5XG5leHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5XG5cbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG5cbnZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG5mb3IgKHZhciBpID0gMCwgbGVuID0gY29kZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxufVxuXG4vLyBTdXBwb3J0IGRlY29kaW5nIFVSTC1zYWZlIGJhc2U2NCBzdHJpbmdzLCBhcyBOb2RlLmpzIGRvZXMuXG4vLyBTZWU6IGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Jhc2U2NCNVUkxfYXBwbGljYXRpb25zXG5yZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbnJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xuXG5mdW5jdGlvbiBnZXRMZW5zIChiNjQpIHtcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcblxuICBpZiAobGVuICUgNCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICB9XG5cbiAgLy8gVHJpbSBvZmYgZXh0cmEgYnl0ZXMgYWZ0ZXIgcGxhY2Vob2xkZXIgYnl0ZXMgYXJlIGZvdW5kXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2JlYXRnYW1taXQvYmFzZTY0LWpzL2lzc3Vlcy80MlxuICB2YXIgdmFsaWRMZW4gPSBiNjQuaW5kZXhPZignPScpXG4gIGlmICh2YWxpZExlbiA9PT0gLTEpIHZhbGlkTGVuID0gbGVuXG5cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IHZhbGlkTGVuID09PSBsZW5cbiAgICA/IDBcbiAgICA6IDQgLSAodmFsaWRMZW4gJSA0KVxuXG4gIHJldHVybiBbdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbl1cbn1cblxuLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChiNjQpIHtcbiAgdmFyIGxlbnMgPSBnZXRMZW5zKGI2NClcbiAgdmFyIHZhbGlkTGVuID0gbGVuc1swXVxuICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gbGVuc1sxXVxuICByZXR1cm4gKCh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCkgLSBwbGFjZUhvbGRlcnNMZW5cbn1cblxuZnVuY3Rpb24gX2J5dGVMZW5ndGggKGI2NCwgdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbikge1xuICByZXR1cm4gKCh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCkgLSBwbGFjZUhvbGRlcnNMZW5cbn1cblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW5zID0gZ2V0TGVucyhiNjQpXG4gIHZhciB2YWxpZExlbiA9IGxlbnNbMF1cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IGxlbnNbMV1cblxuICB2YXIgYXJyID0gbmV3IEFycihfYnl0ZUxlbmd0aChiNjQsIHZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW4pKVxuXG4gIHZhciBjdXJCeXRlID0gMFxuXG4gIC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcbiAgdmFyIGxlbiA9IHBsYWNlSG9sZGVyc0xlbiA+IDBcbiAgICA/IHZhbGlkTGVuIC0gNFxuICAgIDogdmFsaWRMZW5cblxuICB2YXIgaVxuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcbiAgICB0bXAgPVxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCAxMikgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildIDw8IDYpIHxcbiAgICAgIHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW2N1ckJ5dGUrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbY3VyQnl0ZSsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzTGVuID09PSAyKSB7XG4gICAgdG1wID1cbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDIpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA+PiA0KVxuICAgIGFycltjdXJCeXRlKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVyc0xlbiA9PT0gMSkge1xuICAgIHRtcCA9XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDQpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA+PiAyKVxuICAgIGFycltjdXJCeXRlKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgcmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArXG4gICAgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICtcbiAgICBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArXG4gICAgbG9va3VwW251bSAmIDB4M0ZdXG59XG5cbmZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICB2YXIgdG1wXG4gIHZhciBvdXRwdXQgPSBbXVxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgIHRtcCA9XG4gICAgICAoKHVpbnQ4W2ldIDw8IDE2KSAmIDB4RkYwMDAwKSArXG4gICAgICAoKHVpbnQ4W2kgKyAxXSA8PCA4KSAmIDB4RkYwMCkgK1xuICAgICAgKHVpbnQ4W2kgKyAyXSAmIDB4RkYpXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBwYXJ0cyA9IFtdXG4gIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzIC8vIG11c3QgYmUgbXVsdGlwbGUgb2YgM1xuXG4gIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcbiAgZm9yICh2YXIgaSA9IDAsIGxlbjIgPSBsZW4gLSBleHRyYUJ5dGVzOyBpIDwgbGVuMjsgaSArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgIHBhcnRzLnB1c2goZW5jb2RlQ2h1bmsodWludDgsIGksIChpICsgbWF4Q2h1bmtMZW5ndGgpID4gbGVuMiA/IGxlbjIgOiAoaSArIG1heENodW5rTGVuZ3RoKSkpXG4gIH1cblxuICAvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG4gIGlmIChleHRyYUJ5dGVzID09PSAxKSB7XG4gICAgdG1wID0gdWludDhbbGVuIC0gMV1cbiAgICBwYXJ0cy5wdXNoKFxuICAgICAgbG9va3VwW3RtcCA+PiAyXSArXG4gICAgICBsb29rdXBbKHRtcCA8PCA0KSAmIDB4M0ZdICtcbiAgICAgICc9PSdcbiAgICApXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArIHVpbnQ4W2xlbiAtIDFdXG4gICAgcGFydHMucHVzaChcbiAgICAgIGxvb2t1cFt0bXAgPj4gMTBdICtcbiAgICAgIGxvb2t1cFsodG1wID4+IDQpICYgMHgzRl0gK1xuICAgICAgbG9va3VwWyh0bXAgPDwgMikgJiAweDNGXSArXG4gICAgICAnPSdcbiAgICApXG4gIH1cblxuICByZXR1cm4gcGFydHMuam9pbignJylcbn1cbiIsIi8qISBpZWVlNzU0LiBCU0QtMy1DbGF1c2UgTGljZW5zZS4gRmVyb3NzIEFib3VraGFkaWplaCA8aHR0cHM6Ly9mZXJvc3Mub3JnL29wZW5zb3VyY2U+ICovXG5leHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IChuQnl0ZXMgKiA4KSAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IChlICogMjU2KSArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IChtICogMjU2KSArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSAobkJ5dGVzICogOCkgLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKCh2YWx1ZSAqIGMpIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxodHRwczovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgY3VzdG9tSW5zcGVjdFN5bWJvbCA9XG4gICh0eXBlb2YgU3ltYm9sID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBTeW1ib2xbJ2ZvciddID09PSAnZnVuY3Rpb24nKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGRvdC1ub3RhdGlvblxuICAgID8gU3ltYm9sWydmb3InXSgnbm9kZWpzLnV0aWwuaW5zcGVjdC5jdXN0b20nKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGRvdC1ub3RhdGlvblxuICAgIDogbnVsbFxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5cbnZhciBLX01BWF9MRU5HVEggPSAweDdmZmZmZmZmXG5leHBvcnRzLmtNYXhMZW5ndGggPSBLX01BWF9MRU5HVEhcblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgUHJpbnQgd2FybmluZyBhbmQgcmVjb21tZW5kIHVzaW5nIGBidWZmZXJgIHY0Lnggd2hpY2ggaGFzIGFuIE9iamVjdFxuICogICAgICAgICAgICAgICBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogV2UgcmVwb3J0IHRoYXQgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB0eXBlZCBhcnJheXMgaWYgdGhlIGFyZSBub3Qgc3ViY2xhc3NhYmxlXG4gKiB1c2luZyBfX3Byb3RvX18uIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgXG4gKiAoU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzgpLiBJRSAxMCBsYWNrcyBzdXBwb3J0XG4gKiBmb3IgX19wcm90b19fIGFuZCBoYXMgYSBidWdneSB0eXBlZCBhcnJheSBpbXBsZW1lbnRhdGlvbi5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbmlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgdHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmXG4gICAgdHlwZW9mIGNvbnNvbGUuZXJyb3IgPT09ICdmdW5jdGlvbicpIHtcbiAgY29uc29sZS5lcnJvcihcbiAgICAnVGhpcyBicm93c2VyIGxhY2tzIHR5cGVkIGFycmF5IChVaW50OEFycmF5KSBzdXBwb3J0IHdoaWNoIGlzIHJlcXVpcmVkIGJ5ICcgK1xuICAgICdgYnVmZmVyYCB2NS54LiBVc2UgYGJ1ZmZlcmAgdjQueCBpZiB5b3UgcmVxdWlyZSBvbGQgYnJvd3NlciBzdXBwb3J0LidcbiAgKVxufVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIC8vIENhbiB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZD9cbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICB2YXIgcHJvdG8gPSB7IGZvbzogZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfSB9XG4gICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKHByb3RvLCBVaW50OEFycmF5LnByb3RvdHlwZSlcbiAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YoYXJyLCBwcm90bylcbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MlxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlci5wcm90b3R5cGUsICdwYXJlbnQnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghQnVmZmVyLmlzQnVmZmVyKHRoaXMpKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyXG4gIH1cbn0pXG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIucHJvdG90eXBlLCAnb2Zmc2V0Jywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0aGlzKSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHJldHVybiB0aGlzLmJ5dGVPZmZzZXRcbiAgfVxufSlcblxuZnVuY3Rpb24gY3JlYXRlQnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKGxlbmd0aCA+IEtfTUFYX0xFTkdUSCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdUaGUgdmFsdWUgXCInICsgbGVuZ3RoICsgJ1wiIGlzIGludmFsaWQgZm9yIG9wdGlvbiBcInNpemVcIicpXG4gIH1cbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgT2JqZWN0LnNldFByb3RvdHlwZU9mKGJ1ZiwgQnVmZmVyLnByb3RvdHlwZSlcbiAgcmV0dXJuIGJ1ZlxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIGlmICh0eXBlb2YgZW5jb2RpbmdPck9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICdUaGUgXCJzdHJpbmdcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLiBSZWNlaXZlZCB0eXBlIG51bWJlcidcbiAgICAgIClcbiAgICB9XG4gICAgcmV0dXJuIGFsbG9jVW5zYWZlKGFyZylcbiAgfVxuICByZXR1cm4gZnJvbShhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbmZ1bmN0aW9uIGZyb20gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldClcbiAgfVxuXG4gIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheVZpZXcodmFsdWUpXG4gIH1cblxuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAnVGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgb25lIG9mIHR5cGUgc3RyaW5nLCBCdWZmZXIsIEFycmF5QnVmZmVyLCBBcnJheSwgJyArXG4gICAgICAnb3IgQXJyYXktbGlrZSBPYmplY3QuIFJlY2VpdmVkIHR5cGUgJyArICh0eXBlb2YgdmFsdWUpXG4gICAgKVxuICB9XG5cbiAgaWYgKGlzSW5zdGFuY2UodmFsdWUsIEFycmF5QnVmZmVyKSB8fFxuICAgICAgKHZhbHVlICYmIGlzSW5zdGFuY2UodmFsdWUuYnVmZmVyLCBBcnJheUJ1ZmZlcikpKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBTaGFyZWRBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIChpc0luc3RhbmNlKHZhbHVlLCBTaGFyZWRBcnJheUJ1ZmZlcikgfHxcbiAgICAgICh2YWx1ZSAmJiBpc0luc3RhbmNlKHZhbHVlLmJ1ZmZlciwgU2hhcmVkQXJyYXlCdWZmZXIpKSkpIHtcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAnVGhlIFwidmFsdWVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBvZiB0eXBlIG51bWJlci4gUmVjZWl2ZWQgdHlwZSBudW1iZXInXG4gICAgKVxuICB9XG5cbiAgdmFyIHZhbHVlT2YgPSB2YWx1ZS52YWx1ZU9mICYmIHZhbHVlLnZhbHVlT2YoKVxuICBpZiAodmFsdWVPZiAhPSBudWxsICYmIHZhbHVlT2YgIT09IHZhbHVlKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHZhbHVlT2YsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIHZhciBiID0gZnJvbU9iamVjdCh2YWx1ZSlcbiAgaWYgKGIpIHJldHVybiBiXG5cbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1ByaW1pdGl2ZSAhPSBudWxsICYmXG4gICAgICB0eXBlb2YgdmFsdWVbU3ltYm9sLnRvUHJpbWl0aXZlXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBCdWZmZXIuZnJvbShcbiAgICAgIHZhbHVlW1N5bWJvbC50b1ByaW1pdGl2ZV0oJ3N0cmluZycpLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGhcbiAgICApXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICdUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBvbmUgb2YgdHlwZSBzdHJpbmcsIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEFycmF5LCAnICtcbiAgICAnb3IgQXJyYXktbGlrZSBPYmplY3QuIFJlY2VpdmVkIHR5cGUgJyArICh0eXBlb2YgdmFsdWUpXG4gIClcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbSh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBOb3RlOiBDaGFuZ2UgcHJvdG90eXBlICphZnRlciogQnVmZmVyLmZyb20gaXMgZGVmaW5lZCB0byB3b3JrYXJvdW5kIENocm9tZSBidWc6XG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzE0OFxuT2JqZWN0LnNldFByb3RvdHlwZU9mKEJ1ZmZlci5wcm90b3R5cGUsIFVpbnQ4QXJyYXkucHJvdG90eXBlKVxuT2JqZWN0LnNldFByb3RvdHlwZU9mKEJ1ZmZlciwgVWludDhBcnJheSlcblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVGhlIHZhbHVlIFwiJyArIHNpemUgKyAnXCIgaXMgaW52YWxpZCBmb3Igb3B0aW9uIFwic2l6ZVwiJylcbiAgfVxufVxuXG5mdW5jdGlvbiBhbGxvYyAoc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxuICB9XG4gIGlmIChmaWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPbmx5IHBheSBhdHRlbnRpb24gdG8gZW5jb2RpbmcgaWYgaXQncyBhIHN0cmluZy4gVGhpc1xuICAgIC8vIHByZXZlbnRzIGFjY2lkZW50YWxseSBzZW5kaW5nIGluIGEgbnVtYmVyIHRoYXQgd291bGRcbiAgICAvLyBiZSBpbnRlcnByZXRlZCBhcyBhIHN0YXJ0IG9mZnNldC5cbiAgICByZXR1cm4gdHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJ1xuICAgICAgPyBjcmVhdGVCdWZmZXIoc2l6ZSkuZmlsbChmaWxsLCBlbmNvZGluZylcbiAgICAgIDogY3JlYXRlQnVmZmVyKHNpemUpLmZpbGwoZmlsbClcbiAgfVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUpXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmaWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogYWxsb2Moc2l6ZVssIGZpbGxbLCBlbmNvZGluZ11dKVxuICoqL1xuQnVmZmVyLmFsbG9jID0gZnVuY3Rpb24gKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIHJldHVybiBhbGxvYyhzaXplLCBmaWxsLCBlbmNvZGluZylcbn1cblxuZnVuY3Rpb24gYWxsb2NVbnNhZmUgKHNpemUpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUgPCAwID8gMCA6IGNoZWNrZWQoc2l6ZSkgfCAwKVxufVxuXG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gQnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKHNpemUpXG59XG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gU2xvd0J1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICovXG5CdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKHNpemUpXG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgfVxuXG4gIGlmICghQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICB9XG5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuZ3RoKVxuXG4gIHZhciBhY3R1YWwgPSBidWYud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcblxuICBpZiAoYWN0dWFsICE9PSBsZW5ndGgpIHtcbiAgICAvLyBXcml0aW5nIGEgaGV4IHN0cmluZywgZm9yIGV4YW1wbGUsIHRoYXQgY29udGFpbnMgaW52YWxpZCBjaGFyYWN0ZXJzIHdpbGxcbiAgICAvLyBjYXVzZSBldmVyeXRoaW5nIGFmdGVyIHRoZSBmaXJzdCBpbnZhbGlkIGNoYXJhY3RlciB0byBiZSBpZ25vcmVkLiAoZS5nLlxuICAgIC8vICdhYnh4Y2QnIHdpbGwgYmUgdHJlYXRlZCBhcyAnYWInKVxuICAgIGJ1ZiA9IGJ1Zi5zbGljZSgwLCBhY3R1YWwpXG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGggPCAwID8gMCA6IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdmFyIGJ1ZiA9IGNyZWF0ZUJ1ZmZlcihsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICBidWZbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5VmlldyAoYXJyYXlWaWV3KSB7XG4gIGlmIChpc0luc3RhbmNlKGFycmF5VmlldywgVWludDhBcnJheSkpIHtcbiAgICB2YXIgY29weSA9IG5ldyBVaW50OEFycmF5KGFycmF5VmlldylcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKGNvcHkuYnVmZmVyLCBjb3B5LmJ5dGVPZmZzZXQsIGNvcHkuYnl0ZUxlbmd0aClcbiAgfVxuICByZXR1cm4gZnJvbUFycmF5TGlrZShhcnJheVZpZXcpXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAoYnl0ZU9mZnNldCA8IDAgfHwgYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJvZmZzZXRcIiBpcyBvdXRzaWRlIG9mIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0ICsgKGxlbmd0aCB8fCAwKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcImxlbmd0aFwiIGlzIG91dHNpZGUgb2YgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICB2YXIgYnVmXG4gIGlmIChieXRlT2Zmc2V0ID09PSB1bmRlZmluZWQgJiYgbGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBidWYgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZVxuICBPYmplY3Quc2V0UHJvdG90eXBlT2YoYnVmLCBCdWZmZXIucHJvdG90eXBlKVxuXG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAob2JqKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqKSkge1xuICAgIHZhciBsZW4gPSBjaGVja2VkKG9iai5sZW5ndGgpIHwgMFxuICAgIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuKVxuXG4gICAgaWYgKGJ1Zi5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBidWZcbiAgICB9XG5cbiAgICBvYmouY29weShidWYsIDAsIDAsIGxlbilcbiAgICByZXR1cm4gYnVmXG4gIH1cblxuICBpZiAob2JqLmxlbmd0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiBvYmoubGVuZ3RoICE9PSAnbnVtYmVyJyB8fCBudW1iZXJJc05hTihvYmoubGVuZ3RoKSkge1xuICAgICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcigwKVxuICAgIH1cbiAgICByZXR1cm4gZnJvbUFycmF5TGlrZShvYmopXG4gIH1cblxuICBpZiAob2JqLnR5cGUgPT09ICdCdWZmZXInICYmIEFycmF5LmlzQXJyYXkob2JqLmRhdGEpKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUxpa2Uob2JqLmRhdGEpXG4gIH1cbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IEtfTUFYX0xFTkdUSGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBLX01BWF9MRU5HVEgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsgS19NQVhfTEVOR1RILnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAoK2xlbmd0aCAhPSBsZW5ndGgpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBlcWVxZXFcbiAgICBsZW5ndGggPSAwXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlci5hbGxvYygrbGVuZ3RoKVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyID09PSB0cnVlICYmXG4gICAgYiAhPT0gQnVmZmVyLnByb3RvdHlwZSAvLyBzbyBCdWZmZXIuaXNCdWZmZXIoQnVmZmVyLnByb3RvdHlwZSkgd2lsbCBiZSBmYWxzZVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKGlzSW5zdGFuY2UoYSwgVWludDhBcnJheSkpIGEgPSBCdWZmZXIuZnJvbShhLCBhLm9mZnNldCwgYS5ieXRlTGVuZ3RoKVxuICBpZiAoaXNJbnN0YW5jZShiLCBVaW50OEFycmF5KSkgYiA9IEJ1ZmZlci5mcm9tKGIsIGIub2Zmc2V0LCBiLmJ5dGVMZW5ndGgpXG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgJ1RoZSBcImJ1ZjFcIiwgXCJidWYyXCIgYXJndW1lbnRzIG11c3QgYmUgb25lIG9mIHR5cGUgQnVmZmVyIG9yIFVpbnQ4QXJyYXknXG4gICAgKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdsYXRpbjEnOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShsaXN0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gIH1cblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgIHZhciBidWYgPSBsaXN0W2ldXG4gICAgaWYgKGlzSW5zdGFuY2UoYnVmLCBVaW50OEFycmF5KSkge1xuICAgICAgaWYgKHBvcyArIGJ1Zi5sZW5ndGggPiBidWZmZXIubGVuZ3RoKSB7XG4gICAgICAgIEJ1ZmZlci5mcm9tKGJ1ZikuY29weShidWZmZXIsIHBvcylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBidWYsXG4gICAgICAgICAgcG9zXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmLmNvcHkoYnVmZmVyLCBwb3MpXG4gICAgfVxuICAgIHBvcyArPSBidWYubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZmZlclxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIoc3RyaW5nKSkge1xuICAgIHJldHVybiBzdHJpbmcubGVuZ3RoXG4gIH1cbiAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhzdHJpbmcpIHx8IGlzSW5zdGFuY2Uoc3RyaW5nLCBBcnJheUJ1ZmZlcikpIHtcbiAgICByZXR1cm4gc3RyaW5nLmJ5dGVMZW5ndGhcbiAgfVxuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgJ1RoZSBcInN0cmluZ1wiIGFyZ3VtZW50IG11c3QgYmUgb25lIG9mIHR5cGUgc3RyaW5nLCBCdWZmZXIsIG9yIEFycmF5QnVmZmVyLiAnICtcbiAgICAgICdSZWNlaXZlZCB0eXBlICcgKyB0eXBlb2Ygc3RyaW5nXG4gICAgKVxuICB9XG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIG11c3RNYXRjaCA9IChhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gPT09IHRydWUpXG4gIGlmICghbXVzdE1hdGNoICYmIGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkge1xuICAgICAgICAgIHJldHVybiBtdXN0TWF0Y2ggPyAtMSA6IHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIH1cbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgLy8gTm8gbmVlZCB0byB2ZXJpZnkgdGhhdCBcInRoaXMubGVuZ3RoIDw9IE1BWF9VSU5UMzJcIiBzaW5jZSBpdCdzIGEgcmVhZC1vbmx5XG4gIC8vIHByb3BlcnR5IG9mIGEgdHlwZWQgYXJyYXkuXG5cbiAgLy8gVGhpcyBiZWhhdmVzIG5laXRoZXIgbGlrZSBTdHJpbmcgbm9yIFVpbnQ4QXJyYXkgaW4gdGhhdCB3ZSBzZXQgc3RhcnQvZW5kXG4gIC8vIHRvIHRoZWlyIHVwcGVyL2xvd2VyIGJvdW5kcyBpZiB0aGUgdmFsdWUgcGFzc2VkIGlzIG91dCBvZiByYW5nZS5cbiAgLy8gdW5kZWZpbmVkIGlzIGhhbmRsZWQgc3BlY2lhbGx5IGFzIHBlciBFQ01BLTI2MiA2dGggRWRpdGlvbixcbiAgLy8gU2VjdGlvbiAxMy4zLjMuNyBSdW50aW1lIFNlbWFudGljczogS2V5ZWRCaW5kaW5nSW5pdGlhbGl6YXRpb24uXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkIHx8IHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIC8vIFJldHVybiBlYXJseSBpZiBzdGFydCA+IHRoaXMubGVuZ3RoLiBEb25lIGhlcmUgdG8gcHJldmVudCBwb3RlbnRpYWwgdWludDMyXG4gIC8vIGNvZXJjaW9uIGZhaWwgYmVsb3cuXG4gIGlmIChzdGFydCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKGVuZCA8PSAwKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICAvLyBGb3JjZSBjb2VyY2lvbiB0byB1aW50MzIuIFRoaXMgd2lsbCBhbHNvIGNvZXJjZSBmYWxzZXkvTmFOIHZhbHVlcyB0byAwLlxuICBlbmQgPj4+PSAwXG4gIHN0YXJ0ID4+Pj0gMFxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxhdGluMVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGlzIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgKGFuZCB0aGUgYGlzLWJ1ZmZlcmAgbnBtIHBhY2thZ2UpXG4vLyB0byBkZXRlY3QgYSBCdWZmZXIgaW5zdGFuY2UuIEl0J3Mgbm90IHBvc3NpYmxlIHRvIHVzZSBgaW5zdGFuY2VvZiBCdWZmZXJgXG4vLyByZWxpYWJseSBpbiBhIGJyb3dzZXJpZnkgY29udGV4dCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG11bHRpcGxlIGRpZmZlcmVudFxuLy8gY29waWVzIG9mIHRoZSAnYnVmZmVyJyBwYWNrYWdlIGluIHVzZS4gVGhpcyBtZXRob2Qgd29ya3MgZXZlbiBmb3IgQnVmZmVyXG4vLyBpbnN0YW5jZXMgdGhhdCB3ZXJlIGNyZWF0ZWQgZnJvbSBhbm90aGVyIGNvcHkgb2YgdGhlIGBidWZmZXJgIHBhY2thZ2UuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL2lzc3Vlcy8xNTRcbkJ1ZmZlci5wcm90b3R5cGUuX2lzQnVmZmVyID0gdHJ1ZVxuXG5mdW5jdGlvbiBzd2FwIChiLCBuLCBtKSB7XG4gIHZhciBpID0gYltuXVxuICBiW25dID0gYlttXVxuICBiW21dID0gaVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAxNiA9IGZ1bmN0aW9uIHN3YXAxNiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgMiAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMTYtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDEpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMzIgPSBmdW5jdGlvbiBzd2FwMzIgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDQgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDMyLWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAzKVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyAyKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDY0ID0gZnVuY3Rpb24gc3dhcDY0ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA4ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA2NC1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA4KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgNylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgNilcbiAgICBzd2FwKHRoaXMsIGkgKyAyLCBpICsgNSlcbiAgICBzd2FwKHRoaXMsIGkgKyAzLCBpICsgNClcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbmd0aCA9PT0gMCkgcmV0dXJuICcnXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHNsb3dUb1N0cmluZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9Mb2NhbGVTdHJpbmcgPSBCdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nXG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiB0cnVlXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiBpbnNwZWN0ICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkucmVwbGFjZSgvKC57Mn0pL2csICckMSAnKS50cmltKClcbiAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuaWYgKGN1c3RvbUluc3BlY3RTeW1ib2wpIHtcbiAgQnVmZmVyLnByb3RvdHlwZVtjdXN0b21JbnNwZWN0U3ltYm9sXSA9IEJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlICh0YXJnZXQsIHN0YXJ0LCBlbmQsIHRoaXNTdGFydCwgdGhpc0VuZCkge1xuICBpZiAoaXNJbnN0YW5jZSh0YXJnZXQsIFVpbnQ4QXJyYXkpKSB7XG4gICAgdGFyZ2V0ID0gQnVmZmVyLmZyb20odGFyZ2V0LCB0YXJnZXQub2Zmc2V0LCB0YXJnZXQuYnl0ZUxlbmd0aClcbiAgfVxuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICdUaGUgXCJ0YXJnZXRcIiBhcmd1bWVudCBtdXN0IGJlIG9uZSBvZiB0eXBlIEJ1ZmZlciBvciBVaW50OEFycmF5LiAnICtcbiAgICAgICdSZWNlaXZlZCB0eXBlICcgKyAodHlwZW9mIHRhcmdldClcbiAgICApXG4gIH1cblxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuZCA9IHRhcmdldCA/IHRhcmdldC5sZW5ndGggOiAwXG4gIH1cbiAgaWYgKHRoaXNTdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc1N0YXJ0ID0gMFxuICB9XG4gIGlmICh0aGlzRW5kID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzRW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChzdGFydCA8IDAgfHwgZW5kID4gdGFyZ2V0Lmxlbmd0aCB8fCB0aGlzU3RhcnQgPCAwIHx8IHRoaXNFbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdvdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKHRoaXNTdGFydCA+PSB0aGlzRW5kICYmIHN0YXJ0ID49IGVuZCkge1xuICAgIHJldHVybiAwXG4gIH1cbiAgaWYgKHRoaXNTdGFydCA+PSB0aGlzRW5kKSB7XG4gICAgcmV0dXJuIC0xXG4gIH1cbiAgaWYgKHN0YXJ0ID49IGVuZCkge1xuICAgIHJldHVybiAxXG4gIH1cblxuICBzdGFydCA+Pj49IDBcbiAgZW5kID4+Pj0gMFxuICB0aGlzU3RhcnQgPj4+PSAwXG4gIHRoaXNFbmQgPj4+PSAwXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCkgcmV0dXJuIDBcblxuICB2YXIgeCA9IHRoaXNFbmQgLSB0aGlzU3RhcnRcbiAgdmFyIHkgPSBlbmQgLSBzdGFydFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcblxuICB2YXIgdGhpc0NvcHkgPSB0aGlzLnNsaWNlKHRoaXNTdGFydCwgdGhpc0VuZClcbiAgdmFyIHRhcmdldENvcHkgPSB0YXJnZXQuc2xpY2Uoc3RhcnQsIGVuZClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKHRoaXNDb3B5W2ldICE9PSB0YXJnZXRDb3B5W2ldKSB7XG4gICAgICB4ID0gdGhpc0NvcHlbaV1cbiAgICAgIHkgPSB0YXJnZXRDb3B5W2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuLy8gRmluZHMgZWl0aGVyIHRoZSBmaXJzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPj0gYGJ5dGVPZmZzZXRgLFxuLy8gT1IgdGhlIGxhc3QgaW5kZXggb2YgYHZhbGAgaW4gYGJ1ZmZlcmAgYXQgb2Zmc2V0IDw9IGBieXRlT2Zmc2V0YC5cbi8vXG4vLyBBcmd1bWVudHM6XG4vLyAtIGJ1ZmZlciAtIGEgQnVmZmVyIHRvIHNlYXJjaFxuLy8gLSB2YWwgLSBhIHN0cmluZywgQnVmZmVyLCBvciBudW1iZXJcbi8vIC0gYnl0ZU9mZnNldCAtIGFuIGluZGV4IGludG8gYGJ1ZmZlcmA7IHdpbGwgYmUgY2xhbXBlZCB0byBhbiBpbnQzMlxuLy8gLSBlbmNvZGluZyAtIGFuIG9wdGlvbmFsIGVuY29kaW5nLCByZWxldmFudCBpcyB2YWwgaXMgYSBzdHJpbmdcbi8vIC0gZGlyIC0gdHJ1ZSBmb3IgaW5kZXhPZiwgZmFsc2UgZm9yIGxhc3RJbmRleE9mXG5mdW5jdGlvbiBiaWRpcmVjdGlvbmFsSW5kZXhPZiAoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgLy8gRW1wdHkgYnVmZmVyIG1lYW5zIG5vIG1hdGNoXG4gIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSByZXR1cm4gLTFcblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldFxuICBpZiAodHlwZW9mIGJ5dGVPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBieXRlT2Zmc2V0XG4gICAgYnl0ZU9mZnNldCA9IDBcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikge1xuICAgIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSB7XG4gICAgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIH1cbiAgYnl0ZU9mZnNldCA9ICtieXRlT2Zmc2V0IC8vIENvZXJjZSB0byBOdW1iZXIuXG4gIGlmIChudW1iZXJJc05hTihieXRlT2Zmc2V0KSkge1xuICAgIC8vIGJ5dGVPZmZzZXQ6IGl0IGl0J3MgdW5kZWZpbmVkLCBudWxsLCBOYU4sIFwiZm9vXCIsIGV0Yywgc2VhcmNoIHdob2xlIGJ1ZmZlclxuICAgIGJ5dGVPZmZzZXQgPSBkaXIgPyAwIDogKGJ1ZmZlci5sZW5ndGggLSAxKVxuICB9XG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXQ6IG5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCArIGJ5dGVPZmZzZXRcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gYnVmZmVyLmxlbmd0aCkge1xuICAgIGlmIChkaXIpIHJldHVybiAtMVxuICAgIGVsc2UgYnl0ZU9mZnNldCA9IGJ1ZmZlci5sZW5ndGggLSAxXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IDApIHtcbiAgICBpZiAoZGlyKSBieXRlT2Zmc2V0ID0gMFxuICAgIGVsc2UgcmV0dXJuIC0xXG4gIH1cblxuICAvLyBOb3JtYWxpemUgdmFsXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIHZhbCA9IEJ1ZmZlci5mcm9tKHZhbCwgZW5jb2RpbmcpXG4gIH1cblxuICAvLyBGaW5hbGx5LCBzZWFyY2ggZWl0aGVyIGluZGV4T2YgKGlmIGRpciBpcyB0cnVlKSBvciBsYXN0SW5kZXhPZlxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICAvLyBTcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZy9idWZmZXIgYWx3YXlzIGZhaWxzXG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMHhGRiAvLyBTZWFyY2ggZm9yIGEgYnl0ZSB2YWx1ZSBbMC0yNTVdXG4gICAgaWYgKHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBpZiAoZGlyKSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUubGFzdEluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZihidWZmZXIsIFt2YWxdLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsIG11c3QgYmUgc3RyaW5nLCBudW1iZXIgb3IgQnVmZmVyJylcbn1cblxuZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICB2YXIgaW5kZXhTaXplID0gMVxuICB2YXIgYXJyTGVuZ3RoID0gYXJyLmxlbmd0aFxuICB2YXIgdmFsTGVuZ3RoID0gdmFsLmxlbmd0aFxuXG4gIGlmIChlbmNvZGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICBpZiAoZW5jb2RpbmcgPT09ICd1Y3MyJyB8fCBlbmNvZGluZyA9PT0gJ3Vjcy0yJyB8fFxuICAgICAgICBlbmNvZGluZyA9PT0gJ3V0ZjE2bGUnIHx8IGVuY29kaW5nID09PSAndXRmLTE2bGUnKSB7XG4gICAgICBpZiAoYXJyLmxlbmd0aCA8IDIgfHwgdmFsLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgcmV0dXJuIC0xXG4gICAgICB9XG4gICAgICBpbmRleFNpemUgPSAyXG4gICAgICBhcnJMZW5ndGggLz0gMlxuICAgICAgdmFsTGVuZ3RoIC89IDJcbiAgICAgIGJ5dGVPZmZzZXQgLz0gMlxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKGJ1ZiwgaSkge1xuICAgIGlmIChpbmRleFNpemUgPT09IDEpIHtcbiAgICAgIHJldHVybiBidWZbaV1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGJ1Zi5yZWFkVUludDE2QkUoaSAqIGluZGV4U2l6ZSlcbiAgICB9XG4gIH1cblxuICB2YXIgaVxuICBpZiAoZGlyKSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAoaSA9IGJ5dGVPZmZzZXQ7IGkgPCBhcnJMZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHJlYWQoYXJyLCBpKSA9PT0gcmVhZCh2YWwsIGZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4KSkge1xuICAgICAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIGZvdW5kSW5kZXggPSBpXG4gICAgICAgIGlmIChpIC0gZm91bmRJbmRleCArIDEgPT09IHZhbExlbmd0aCkgcmV0dXJuIGZvdW5kSW5kZXggKiBpbmRleFNpemVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ICE9PSAtMSkgaSAtPSBpIC0gZm91bmRJbmRleFxuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGJ5dGVPZmZzZXQgKyB2YWxMZW5ndGggPiBhcnJMZW5ndGgpIGJ5dGVPZmZzZXQgPSBhcnJMZW5ndGggLSB2YWxMZW5ndGhcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpID49IDA7IGktLSkge1xuICAgICAgdmFyIGZvdW5kID0gdHJ1ZVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCB2YWxMZW5ndGg7IGorKykge1xuICAgICAgICBpZiAocmVhZChhcnIsIGkgKyBqKSAhPT0gcmVhZCh2YWwsIGopKSB7XG4gICAgICAgICAgZm91bmQgPSBmYWxzZVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChmb3VuZCkgcmV0dXJuIGlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmNsdWRlcyA9IGZ1bmN0aW9uIGluY2x1ZGVzICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiB0aGlzLmluZGV4T2YodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykgIT09IC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIHRydWUpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUubGFzdEluZGV4T2YgPSBmdW5jdGlvbiBsYXN0SW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gYmlkaXJlY3Rpb25hbEluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZmFsc2UpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAobnVtYmVySXNOYU4ocGFyc2VkKSkgcmV0dXJuIGlcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCA+Pj4gMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0J1ZmZlci53cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXRbLCBsZW5ndGhdKSBpcyBubyBsb25nZXIgc3VwcG9ydGVkJ1xuICAgIClcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpXG4gICAgICA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpXG4gICAgICAgICAgPyAzXG4gICAgICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRilcbiAgICAgICAgICAgICAgPyAyXG4gICAgICAgICAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gbGF0aW4xU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIG91dCArPSBoZXhTbGljZUxvb2t1cFRhYmxlW2J1ZltpXV1cbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgLy8gSWYgYnl0ZXMubGVuZ3RoIGlzIG9kZCwgdGhlIGxhc3QgOCBiaXRzIG11c3QgYmUgaWdub3JlZCAoc2FtZSBhcyBub2RlLmpzKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aCAtIDE7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgKGJ5dGVzW2kgKyAxXSAqIDI1NikpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgT2JqZWN0LnNldFByb3RvdHlwZU9mKG5ld0J1ZiwgQnVmZmVyLnByb3RvdHlwZSlcblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVaW50TEUgPVxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVpbnRCRSA9XG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVaW50OCA9XG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVaW50MTZMRSA9XG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVpbnQxNkJFID1cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVWludDMyTEUgPVxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVaW50MzJCRSA9XG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJidWZmZXJcIiBhcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVaW50TEUgPVxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVaW50QkUgPVxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVaW50OCA9XG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVpbnQxNkxFID1cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVaW50MTZCRSA9XG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVWludDMyTEUgPVxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVpbnQzMkJFID1cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgKDggKiBieXRlTGVuZ3RoKSAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgLSAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsICg4ICogYnl0ZUxlbmd0aCkgLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpICsgMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0YXJnZXQpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdhcmd1bWVudCBzaG91bGQgYmUgYSBCdWZmZXInKVxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiB0eXBlb2YgVWludDhBcnJheS5wcm90b3R5cGUuY29weVdpdGhpbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIC8vIFVzZSBidWlsdC1pbiB3aGVuIGF2YWlsYWJsZSwgbWlzc2luZyBmcm9tIElFMTFcbiAgICB0aGlzLmNvcHlXaXRoaW4odGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpXG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIFVzYWdlOlxuLy8gICAgYnVmZmVyLmZpbGwobnVtYmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChidWZmZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKHN0cmluZ1ssIG9mZnNldFssIGVuZF1dWywgZW5jb2RpbmddKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsLCBzdGFydCwgZW5kLCBlbmNvZGluZykge1xuICAvLyBIYW5kbGUgc3RyaW5nIGNhc2VzOlxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBzdGFydFxuICAgICAgc3RhcnQgPSAwXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gZW5kXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH1cbiAgICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycgJiYgIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgIH1cbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdmFyIGNvZGUgPSB2YWwuY2hhckNvZGVBdCgwKVxuICAgICAgaWYgKChlbmNvZGluZyA9PT0gJ3V0ZjgnICYmIGNvZGUgPCAxMjgpIHx8XG4gICAgICAgICAgZW5jb2RpbmcgPT09ICdsYXRpbjEnKSB7XG4gICAgICAgIC8vIEZhc3QgcGF0aDogSWYgYHZhbGAgZml0cyBpbnRvIGEgc2luZ2xlIGJ5dGUsIHVzZSB0aGF0IG51bWVyaWMgdmFsdWUuXG4gICAgICAgIHZhbCA9IGNvZGVcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAyNTVcbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnYm9vbGVhbicpIHtcbiAgICB2YWwgPSBOdW1iZXIodmFsKVxuICB9XG5cbiAgLy8gSW52YWxpZCByYW5nZXMgYXJlIG5vdCBzZXQgdG8gYSBkZWZhdWx0LCBzbyBjYW4gcmFuZ2UgY2hlY2sgZWFybHkuXG4gIGlmIChzdGFydCA8IDAgfHwgdGhpcy5sZW5ndGggPCBzdGFydCB8fCB0aGlzLmxlbmd0aCA8IGVuZCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdPdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBzdGFydCA9IHN0YXJ0ID4+PiAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gdGhpcy5sZW5ndGggOiBlbmQgPj4+IDBcblxuICBpZiAoIXZhbCkgdmFsID0gMFxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICAgIHRoaXNbaV0gPSB2YWxcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gQnVmZmVyLmlzQnVmZmVyKHZhbClcbiAgICAgID8gdmFsXG4gICAgICA6IEJ1ZmZlci5mcm9tKHZhbCwgZW5jb2RpbmcpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSB2YWx1ZSBcIicgKyB2YWwgK1xuICAgICAgICAnXCIgaXMgaW52YWxpZCBmb3IgYXJndW1lbnQgXCJ2YWx1ZVwiJylcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGVuZCAtIHN0YXJ0OyArK2kpIHtcbiAgICAgIHRoaXNbaSArIHN0YXJ0XSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSB0YWtlcyBlcXVhbCBzaWducyBhcyBlbmQgb2YgdGhlIEJhc2U2NCBlbmNvZGluZ1xuICBzdHIgPSBzdHIuc3BsaXQoJz0nKVswXVxuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyLnRyaW0oKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG4vLyBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IG9iamVjdHMgZnJvbSBvdGhlciBjb250ZXh0cyAoaS5lLiBpZnJhbWVzKSBkbyBub3QgcGFzc1xuLy8gdGhlIGBpbnN0YW5jZW9mYCBjaGVjayBidXQgdGhleSBzaG91bGQgYmUgdHJlYXRlZCBhcyBvZiB0aGF0IHR5cGUuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL2lzc3Vlcy8xNjZcbmZ1bmN0aW9uIGlzSW5zdGFuY2UgKG9iaiwgdHlwZSkge1xuICByZXR1cm4gb2JqIGluc3RhbmNlb2YgdHlwZSB8fFxuICAgIChvYmogIT0gbnVsbCAmJiBvYmouY29uc3RydWN0b3IgIT0gbnVsbCAmJiBvYmouY29uc3RydWN0b3IubmFtZSAhPSBudWxsICYmXG4gICAgICBvYmouY29uc3RydWN0b3IubmFtZSA9PT0gdHlwZS5uYW1lKVxufVxuZnVuY3Rpb24gbnVtYmVySXNOYU4gKG9iaikge1xuICAvLyBGb3IgSUUxMSBzdXBwb3J0XG4gIHJldHVybiBvYmogIT09IG9iaiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXNlbGYtY29tcGFyZVxufVxuXG4vLyBDcmVhdGUgbG9va3VwIHRhYmxlIGZvciBgdG9TdHJpbmcoJ2hleCcpYFxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9pc3N1ZXMvMjE5XG52YXIgaGV4U2xpY2VMb29rdXBUYWJsZSA9IChmdW5jdGlvbiAoKSB7XG4gIHZhciBhbHBoYWJldCA9ICcwMTIzNDU2Nzg5YWJjZGVmJ1xuICB2YXIgdGFibGUgPSBuZXcgQXJyYXkoMjU2KVxuICBmb3IgKHZhciBpID0gMDsgaSA8IDE2OyArK2kpIHtcbiAgICB2YXIgaTE2ID0gaSAqIDE2XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCAxNjsgKytqKSB7XG4gICAgICB0YWJsZVtpMTYgKyBqXSA9IGFscGhhYmV0W2ldICsgYWxwaGFiZXRbal1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRhYmxlXG59KSgpXG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBpZiAoc3VwZXJDdG9yKSB7XG4gICAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGlmIChzdXBlckN0b3IpIHtcbiAgICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgICAgVGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZVxuICAgICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gICAgfVxuICB9XG59XG4iLCJcbmV4cG9ydHMuY29tcGFyZSA9IGZ1bmN0aW9uIChhLCBiKSB7XG5cbiAgaWYoQnVmZmVyLmlzQnVmZmVyKGEpKSB7XG4gICAgdmFyIGwgPSBNYXRoLm1pbihhLmxlbmd0aCwgYi5sZW5ndGgpXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgdmFyIGNtcCA9IGFbaV0gLSBiW2ldXG4gICAgICBpZihjbXApIHJldHVybiBjbXBcbiAgICB9XG4gICAgcmV0dXJuIGEubGVuZ3RoIC0gYi5sZW5ndGhcbiAgfVxuXG4gIHJldHVybiBhIDwgYiA/IC0xIDogYSA+IGIgPyAxIDogMFxufVxuXG4vLyB0byBiZSBjb21wYXRpYmxlIHdpdGggdGhlIGN1cnJlbnQgYWJzdHJhY3QtbGV2ZWxkb3duIHRlc3RzXG4vLyBudWxsaXNoIG9yIGVtcHR5IHN0cmluZ3MuXG4vLyBJIGNvdWxkIHVzZSAhIXZhbCBidXQgSSB3YW50IHRvIHBlcm1pdCBudW1iZXJzIGFuZCBib29sZWFucyxcbi8vIGlmIHBvc3NpYmxlLlxuXG5mdW5jdGlvbiBpc0RlZiAodmFsKSB7XG4gIHJldHVybiB2YWwgIT09IHVuZGVmaW5lZCAmJiB2YWwgIT09ICcnXG59XG5cbmZ1bmN0aW9uIGhhcyAocmFuZ2UsIG5hbWUpIHtcbiAgcmV0dXJuIE9iamVjdC5oYXNPd25Qcm9wZXJ0eS5jYWxsKHJhbmdlLCBuYW1lKVxufVxuXG5mdW5jdGlvbiBoYXNLZXkocmFuZ2UsIG5hbWUpIHtcbiAgcmV0dXJuIE9iamVjdC5oYXNPd25Qcm9wZXJ0eS5jYWxsKHJhbmdlLCBuYW1lKSAmJiBuYW1lXG59XG5cbnZhciBsb3dlckJvdW5kS2V5ID0gZXhwb3J0cy5sb3dlckJvdW5kS2V5ID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICBoYXNLZXkocmFuZ2UsICdndCcpXG4gICAgfHwgaGFzS2V5KHJhbmdlLCAnZ3RlJylcbiAgICB8fCBoYXNLZXkocmFuZ2UsICdtaW4nKVxuICAgIHx8IChyYW5nZS5yZXZlcnNlID8gaGFzS2V5KHJhbmdlLCAnZW5kJykgOiBoYXNLZXkocmFuZ2UsICdzdGFydCcpKVxuICAgIHx8IHVuZGVmaW5lZFxuICAgIClcbn1cblxudmFyIGxvd2VyQm91bmQgPSBleHBvcnRzLmxvd2VyQm91bmQgPSBmdW5jdGlvbiAocmFuZ2UsIGRlZikge1xuICB2YXIgayA9IGxvd2VyQm91bmRLZXkocmFuZ2UpXG4gIHJldHVybiBrID8gcmFuZ2Vba10gOiBkZWZcbn1cblxudmFyIGxvd2VyQm91bmRJbmNsdXNpdmUgPSBleHBvcnRzLmxvd2VyQm91bmRJbmNsdXNpdmUgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgcmV0dXJuIGhhcyhyYW5nZSwgJ2d0JykgPyBmYWxzZSA6IHRydWVcbn1cblxudmFyIHVwcGVyQm91bmRJbmNsdXNpdmUgPSBleHBvcnRzLnVwcGVyQm91bmRJbmNsdXNpdmUgPVxuICBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICByZXR1cm4gKGhhcyhyYW5nZSwgJ2x0JykgLyomJiAhcmFuZ2UubWF4RXgqLykgPyBmYWxzZSA6IHRydWVcbiAgfVxuXG52YXIgbG93ZXJCb3VuZEV4Y2x1c2l2ZSA9IGV4cG9ydHMubG93ZXJCb3VuZEV4Y2x1c2l2ZSA9XG4gIGZ1bmN0aW9uIChyYW5nZSkge1xuICAgIHJldHVybiAhbG93ZXJCb3VuZEluY2x1c2l2ZShyYW5nZSlcbiAgfVxuXG52YXIgdXBwZXJCb3VuZEV4Y2x1c2l2ZSA9IGV4cG9ydHMudXBwZXJCb3VuZEV4Y2x1c2l2ZSA9XG4gIGZ1bmN0aW9uIChyYW5nZSkge1xuICAgIHJldHVybiAhdXBwZXJCb3VuZEluY2x1c2l2ZShyYW5nZSlcbiAgfVxuXG52YXIgdXBwZXJCb3VuZEtleSA9IGV4cG9ydHMudXBwZXJCb3VuZEtleSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICAgIHJldHVybiAoXG4gICAgICAgaGFzS2V5KHJhbmdlLCAnbHQnKVxuICAgIHx8IGhhc0tleShyYW5nZSwgJ2x0ZScpXG4gICAgfHwgaGFzS2V5KHJhbmdlLCAnbWF4JylcbiAgICB8fCAocmFuZ2UucmV2ZXJzZSA/IGhhc0tleShyYW5nZSwgJ3N0YXJ0JykgOiBoYXNLZXkocmFuZ2UsICdlbmQnKSlcbiAgICB8fCB1bmRlZmluZWRcbiAgICApXG59XG5cbnZhciB1cHBlckJvdW5kID0gZXhwb3J0cy51cHBlckJvdW5kID0gZnVuY3Rpb24gKHJhbmdlLCBkZWYpIHtcbiAgdmFyIGsgPSB1cHBlckJvdW5kS2V5KHJhbmdlKVxuICByZXR1cm4gayA/IHJhbmdlW2tdIDogZGVmXG59XG5cbmV4cG9ydHMuc3RhcnQgPSBmdW5jdGlvbiAocmFuZ2UsIGRlZikge1xuICByZXR1cm4gcmFuZ2UucmV2ZXJzZSA/IHVwcGVyQm91bmQocmFuZ2UsIGRlZikgOiBsb3dlckJvdW5kKHJhbmdlLCBkZWYpXG59XG5leHBvcnRzLmVuZCA9IGZ1bmN0aW9uIChyYW5nZSwgZGVmKSB7XG4gIHJldHVybiByYW5nZS5yZXZlcnNlID8gbG93ZXJCb3VuZChyYW5nZSwgZGVmKSA6IHVwcGVyQm91bmQocmFuZ2UsIGRlZilcbn1cbmV4cG9ydHMuc3RhcnRJbmNsdXNpdmUgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgcmV0dXJuIChcbiAgICByYW5nZS5yZXZlcnNlXG4gID8gdXBwZXJCb3VuZEluY2x1c2l2ZShyYW5nZSlcbiAgOiBsb3dlckJvdW5kSW5jbHVzaXZlKHJhbmdlKVxuICApXG59XG5leHBvcnRzLmVuZEluY2x1c2l2ZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICByZXR1cm4gKFxuICAgIHJhbmdlLnJldmVyc2VcbiAgPyBsb3dlckJvdW5kSW5jbHVzaXZlKHJhbmdlKVxuICA6IHVwcGVyQm91bmRJbmNsdXNpdmUocmFuZ2UpXG4gIClcbn1cblxuZnVuY3Rpb24gaWQgKGUpIHsgcmV0dXJuIGUgfVxuXG5leHBvcnRzLnRvTHRndCA9IGZ1bmN0aW9uIChyYW5nZSwgX3JhbmdlLCBtYXAsIGxvd2VyLCB1cHBlcikge1xuICBfcmFuZ2UgPSBfcmFuZ2UgfHwge31cbiAgbWFwID0gbWFwIHx8IGlkXG4gIHZhciBkZWZhdWx0cyA9IGFyZ3VtZW50cy5sZW5ndGggPiAzXG4gIHZhciBsYiA9IGV4cG9ydHMubG93ZXJCb3VuZEtleShyYW5nZSlcbiAgdmFyIHViID0gZXhwb3J0cy51cHBlckJvdW5kS2V5KHJhbmdlKVxuICBpZihsYikge1xuICAgIGlmKGxiID09PSAnZ3QnKSBfcmFuZ2UuZ3QgPSBtYXAocmFuZ2UuZ3QsIGZhbHNlKVxuICAgIGVsc2UgICAgICAgICAgICBfcmFuZ2UuZ3RlID0gbWFwKHJhbmdlW2xiXSwgZmFsc2UpXG4gIH1cbiAgZWxzZSBpZihkZWZhdWx0cylcbiAgICBfcmFuZ2UuZ3RlID0gbWFwKGxvd2VyLCBmYWxzZSlcblxuICBpZih1Yikge1xuICAgIGlmKHViID09PSAnbHQnKSBfcmFuZ2UubHQgPSBtYXAocmFuZ2UubHQsIHRydWUpXG4gICAgZWxzZSAgICAgICAgICAgIF9yYW5nZS5sdGUgPSBtYXAocmFuZ2VbdWJdLCB0cnVlKVxuICB9XG4gIGVsc2UgaWYoZGVmYXVsdHMpXG4gICAgX3JhbmdlLmx0ZSA9IG1hcCh1cHBlciwgdHJ1ZSlcblxuICBpZihyYW5nZS5yZXZlcnNlICE9IG51bGwpXG4gICAgX3JhbmdlLnJldmVyc2UgPSAhIXJhbmdlLnJldmVyc2VcblxuICAvL2lmIHJhbmdlIHdhcyB1c2VkIG11dGFibHlcbiAgLy8oaW4gbGV2ZWwtc3VibGV2ZWwgaXQncyBwYXJ0IG9mIGFuIG9wdGlvbnMgb2JqZWN0XG4gIC8vdGhhdCBoYXMgbW9yZSBwcm9wZXJ0aWVzIG9uIGl0LilcbiAgaWYoaGFzKF9yYW5nZSwgJ21heCcpKSAgIGRlbGV0ZSBfcmFuZ2UubWF4XG4gIGlmKGhhcyhfcmFuZ2UsICdtaW4nKSkgICBkZWxldGUgX3JhbmdlLm1pblxuICBpZihoYXMoX3JhbmdlLCAnc3RhcnQnKSkgZGVsZXRlIF9yYW5nZS5zdGFydFxuICBpZihoYXMoX3JhbmdlLCAnZW5kJykpICAgZGVsZXRlIF9yYW5nZS5lbmRcblxuICByZXR1cm4gX3JhbmdlXG59XG5cbmV4cG9ydHMuY29udGFpbnMgPSBmdW5jdGlvbiAocmFuZ2UsIGtleSwgY29tcGFyZSkge1xuICBjb21wYXJlID0gY29tcGFyZSB8fCBleHBvcnRzLmNvbXBhcmVcblxuICB2YXIgbGIgPSBsb3dlckJvdW5kKHJhbmdlKVxuICBpZihpc0RlZihsYikpIHtcbiAgICB2YXIgY21wID0gY29tcGFyZShrZXksIGxiKVxuICAgIGlmKGNtcCA8IDAgfHwgKGNtcCA9PT0gMCAmJiBsb3dlckJvdW5kRXhjbHVzaXZlKHJhbmdlKSkpXG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIHZhciB1YiA9IHVwcGVyQm91bmQocmFuZ2UpXG4gIGlmKGlzRGVmKHViKSkge1xuICAgIHZhciBjbXAgPSBjb21wYXJlKGtleSwgdWIpXG4gICAgaWYoY21wID4gMCB8fCAoY21wID09PSAwKSAmJiB1cHBlckJvdW5kRXhjbHVzaXZlKHJhbmdlKSlcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgcmV0dXJuIHRydWVcbn1cblxuZXhwb3J0cy5maWx0ZXIgPSBmdW5jdGlvbiAocmFuZ2UsIGNvbXBhcmUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gZXhwb3J0cy5jb250YWlucyhyYW5nZSwga2V5LCBjb21wYXJlKVxuICB9XG59XG5cblxuIiwiaW1wb3J0ICogYXMgbHRndCBmcm9tICdsdGd0JztcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihmKSB7XG4gIHJldHVybiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZjtcbn1cblxuZnVuY3Rpb24gZ2V0UHJlZml4KGRiKSB7XG4gIGlmIChpc0Z1bmN0aW9uKGRiLnByZWZpeCkpIHtcbiAgICByZXR1cm4gZGIucHJlZml4KCk7XG4gIH1cbiAgcmV0dXJuIGRiO1xufVxuXG5mdW5jdGlvbiBjbG9uZShfb2JqKSB7XG4gIHZhciBvYmogPSB7fTtcbiAgZm9yICh2YXIgayBpbiBfb2JqKSB7XG4gICAgb2JqW2tdID0gX29ialtrXTtcbiAgfVxuICByZXR1cm4gb2JqO1xufVxuXG5mdW5jdGlvbiBudXQoZGIsIHByZWNvZGVjLCBjb2RlYykge1xuICBmdW5jdGlvbiBlbmNvZGVQcmVmaXgocHJlZml4LCBrZXksIG9wdHMxLCBvcHRzMikge1xuICAgIHJldHVybiBwcmVjb2RlYy5lbmNvZGUoWyBwcmVmaXgsIGNvZGVjLmVuY29kZUtleShrZXksIG9wdHMxLCBvcHRzMiApIF0pO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkRW5jb2RpbmdzKG9wLCBwcmVmaXgpIHtcbiAgICBpZiAocHJlZml4ICYmIHByZWZpeC5vcHRpb25zKSB7XG4gICAgICBvcC5rZXlFbmNvZGluZyA9XG4gICAgICAgIG9wLmtleUVuY29kaW5nIHx8IHByZWZpeC5vcHRpb25zLmtleUVuY29kaW5nO1xuICAgICAgb3AudmFsdWVFbmNvZGluZyA9XG4gICAgICAgIG9wLnZhbHVlRW5jb2RpbmcgfHwgcHJlZml4Lm9wdGlvbnMudmFsdWVFbmNvZGluZztcbiAgICB9XG4gICAgcmV0dXJuIG9wO1xuICB9XG5cbiAgZGIub3BlbihmdW5jdGlvbiAoKSB7IC8qIG5vLW9wICovfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBhcHBseTogZnVuY3Rpb24gKG9wcywgb3B0cywgY2IpIHtcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gICAgICB2YXIgYmF0Y2ggPSBbXTtcbiAgICAgIHZhciBpID0gLTE7XG4gICAgICB2YXIgbGVuID0gb3BzLmxlbmd0aDtcblxuICAgICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgICB2YXIgb3AgPSBvcHNbaV07XG4gICAgICAgIGFkZEVuY29kaW5ncyhvcCwgb3AucHJlZml4KTtcbiAgICAgICAgb3AucHJlZml4ID0gZ2V0UHJlZml4KG9wLnByZWZpeCk7XG4gICAgICAgIGJhdGNoLnB1c2goe1xuICAgICAgICAgIGtleTogZW5jb2RlUHJlZml4KG9wLnByZWZpeCwgb3Aua2V5LCBvcHRzLCBvcCksXG4gICAgICAgICAgdmFsdWU6IG9wLnR5cGUgIT09ICdkZWwnICYmIGNvZGVjLmVuY29kZVZhbHVlKG9wLnZhbHVlLCBvcHRzLCBvcCksXG4gICAgICAgICAgdHlwZTogb3AudHlwZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGRiLmRiLmJhdGNoKGJhdGNoLCBvcHRzLCBjYik7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChrZXksIHByZWZpeCwgb3B0cywgY2IpIHtcbiAgICAgIG9wdHMuYXNCdWZmZXIgPSBjb2RlYy52YWx1ZUFzQnVmZmVyKG9wdHMpO1xuICAgICAgcmV0dXJuIGRiLmRiLmdldChcbiAgICAgICAgZW5jb2RlUHJlZml4KHByZWZpeCwga2V5LCBvcHRzKSxcbiAgICAgICAgb3B0cyxcbiAgICAgICAgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYihudWxsLCBjb2RlYy5kZWNvZGVWYWx1ZSh2YWx1ZSwgb3B0cykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9LFxuICAgIGNyZWF0ZURlY29kZXI6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBrZXk6IGNvZGVjLmRlY29kZUtleShwcmVjb2RlYy5kZWNvZGUoa2V5KVsxXSwgb3B0cyksXG4gICAgICAgICAgdmFsdWU6IGNvZGVjLmRlY29kZVZhbHVlKHZhbHVlLCBvcHRzKVxuICAgICAgICB9O1xuICAgICAgfTtcbiAgICB9LFxuICAgIGlzQ2xvc2VkOiBmdW5jdGlvbiBpc0Nsb3NlZCgpIHtcbiAgICAgIHJldHVybiBkYi5pc0Nsb3NlZCgpO1xuICAgIH0sXG4gICAgY2xvc2U6IGZ1bmN0aW9uIGNsb3NlKGNiKSB7XG4gICAgICByZXR1cm4gZGIuY2xvc2UoY2IpO1xuICAgIH0sXG4gICAgaXRlcmF0b3I6IGZ1bmN0aW9uIChfb3B0cykge1xuICAgICAgdmFyIG9wdHMgPSBjbG9uZShfb3B0cyB8fCB7fSk7XG4gICAgICB2YXIgcHJlZml4ID0gX29wdHMucHJlZml4IHx8IFtdO1xuXG4gICAgICBmdW5jdGlvbiBlbmNvZGVLZXkoa2V5KSB7XG4gICAgICAgIHJldHVybiBlbmNvZGVQcmVmaXgocHJlZml4LCBrZXksIG9wdHMsIHt9KTtcbiAgICAgIH1cblxuICAgICAgbHRndC50b0x0Z3QoX29wdHMsIG9wdHMsIGVuY29kZUtleSwgcHJlY29kZWMubG93ZXJCb3VuZCwgcHJlY29kZWMudXBwZXJCb3VuZCk7XG5cbiAgICAgIC8vIGlmIHRoZXNlIGxlZ2FjeSB2YWx1ZXMgYXJlIGluIHRoZSBvcHRpb25zLCByZW1vdmUgdGhlbVxuXG4gICAgICBvcHRzLnByZWZpeCA9IG51bGw7XG5cbiAgICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAvL2hhcmQgY29kZWQgZGVmYXVsdHMsIGZvciBub3cuLi5cbiAgICAgIC8vVE9ETzogcHVsbCBkZWZhdWx0cyBhbmQgZW5jb2Rpbmcgb3V0IG9mIGxldmVsdXAuXG4gICAgICBvcHRzLmtleUFzQnVmZmVyID0gb3B0cy52YWx1ZUFzQnVmZmVyID0gZmFsc2U7XG4gICAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXG5cbiAgICAgIC8vdGhpcyBpcyB2aXRhbCwgb3RoZXJ3aXNlIGxpbWl0OiB1bmRlZmluZWQgd2lsbFxuICAgICAgLy9jcmVhdGUgYW4gZW1wdHkgc3RyZWFtLlxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIGlmICgnbnVtYmVyJyAhPT0gdHlwZW9mIG9wdHMubGltaXQpIHtcbiAgICAgICAgb3B0cy5saW1pdCA9IC0xO1xuICAgICAgfVxuXG4gICAgICBvcHRzLmtleUFzQnVmZmVyID0gcHJlY29kZWMuYnVmZmVyO1xuICAgICAgb3B0cy52YWx1ZUFzQnVmZmVyID0gY29kZWMudmFsdWVBc0J1ZmZlcihvcHRzKTtcblxuICAgICAgZnVuY3Rpb24gd3JhcEl0ZXJhdG9yKGl0ZXJhdG9yKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbmV4dDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gaXRlcmF0b3IubmV4dChjYik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBlbmQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgaXRlcmF0b3IuZW5kKGNiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB3cmFwSXRlcmF0b3IoZGIuZGIuaXRlcmF0b3Iob3B0cykpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgbnV0O1xuIiwiY2xhc3MgTm90Rm91bmRFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm5hbWUgPSAnTm90Rm91bmRFcnJvcic7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm90Rm91bmRFcnJvcjsiLCJpbXBvcnQgZXZlbnRzIGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgTm90Rm91bmRFcnJvciBmcm9tICcuL05vdEZvdW5kRXJyb3InO1xuXG52YXIgRXZlbnRFbWl0dGVyID0gZXZlbnRzLkV2ZW50RW1pdHRlcjtcbnZhciB2ZXJzaW9uID0gXCI2LjUuNFwiO1xuXG52YXIgTk9UX0ZPVU5EX0VSUk9SID0gbmV3IE5vdEZvdW5kRXJyb3IoKTtcblxudmFyIHN1YmxldmVsID0gZnVuY3Rpb24gKG51dCwgcHJlZml4LCBjcmVhdGVTdHJlYW0sIG9wdGlvbnMpIHtcbiAgdmFyIGVtaXR0ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gIGVtaXR0ZXIuc3VibGV2ZWxzID0ge307XG4gIGVtaXR0ZXIub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgZW1pdHRlci52ZXJzaW9uID0gdmVyc2lvbjtcblxuICBlbWl0dGVyLm1ldGhvZHMgPSB7fTtcbiAgcHJlZml4ID0gcHJlZml4IHx8IFtdO1xuXG4gIGZ1bmN0aW9uIG1lcmdlT3B0cyhvcHRzKSB7XG4gICAgdmFyIG8gPSB7fTtcbiAgICB2YXIgaztcbiAgICBpZiAob3B0aW9ucykge1xuICAgICAgZm9yIChrIGluIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zW2tdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIG9ba10gPSBvcHRpb25zW2tdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvcHRzKSB7XG4gICAgICBmb3IgKGsgaW4gb3B0cykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdHNba10gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgb1trXSA9IG9wdHNba107XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG87XG4gIH1cblxuICBlbWl0dGVyLnB1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRzLCBjYikge1xuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2Ygb3B0cykge1xuICAgICAgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cblxuICAgIG51dC5hcHBseShbe1xuICAgICAga2V5OiBrZXksIHZhbHVlOiB2YWx1ZSxcbiAgICAgIHByZWZpeDogcHJlZml4LnNsaWNlKCksIHR5cGU6ICdwdXQnXG4gICAgfV0sIG1lcmdlT3B0cyhvcHRzKSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICB9XG4gICAgICBlbWl0dGVyLmVtaXQoJ3B1dCcsIGtleSwgdmFsdWUpO1xuICAgICAgY2IobnVsbCk7XG4gICAgfSk7XG4gIH07XG5cbiAgZW1pdHRlci5wcmVmaXggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHByZWZpeC5zbGljZSgpO1xuICB9O1xuXG4gIGVtaXR0ZXIuYmF0Y2ggPSBmdW5jdGlvbiAob3BzLCBvcHRzLCBjYikge1xuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2Ygb3B0cykge1xuICAgICAgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cblxuICAgIG9wcyA9IG9wcy5tYXAoZnVuY3Rpb24gKG9wKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBrZXk6IG9wLmtleSxcbiAgICAgICAgdmFsdWU6IG9wLnZhbHVlLFxuICAgICAgICBwcmVmaXg6IG9wLnByZWZpeCB8fCBwcmVmaXgsXG4gICAgICAgIGtleUVuY29kaW5nOiBvcC5rZXlFbmNvZGluZywgICAgLy8gKlxuICAgICAgICB2YWx1ZUVuY29kaW5nOiBvcC52YWx1ZUVuY29kaW5nLCAgLy8gKiAoVE9ETzogZW5jb2RpbmdzIG9uIHN1YmxldmVsKVxuICAgICAgICB0eXBlOiBvcC50eXBlXG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgbnV0LmFwcGx5KG9wcywgbWVyZ2VPcHRzKG9wdHMpLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgaWYgKGVycikge1xuICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgIH1cbiAgICAgIGVtaXR0ZXIuZW1pdCgnYmF0Y2gnLCBvcHMpO1xuICAgICAgY2IobnVsbCk7XG4gICAgfSk7XG4gIH07XG5cbiAgZW1pdHRlci5nZXQgPSBmdW5jdGlvbiAoa2V5LCBvcHRzLCBjYikge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBvcHRzKSB7XG4gICAgICBjYiA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuICAgIG51dC5nZXQoa2V5LCBwcmVmaXgsIG1lcmdlT3B0cyhvcHRzKSwgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY2IoTk9UX0ZPVU5EX0VSUk9SKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNiKG51bGwsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICBlbWl0dGVyLnN1YmxldmVsID0gZnVuY3Rpb24gKG5hbWUsIG9wdHMpIHtcbiAgICByZXR1cm4gZW1pdHRlci5zdWJsZXZlbHNbbmFtZV0gPVxuICAgICAgZW1pdHRlci5zdWJsZXZlbHNbbmFtZV0gfHwgc3VibGV2ZWwobnV0LCBwcmVmaXguY29uY2F0KG5hbWUpLCBjcmVhdGVTdHJlYW0sIG1lcmdlT3B0cyhvcHRzKSk7XG4gIH07XG5cbiAgZW1pdHRlci5yZWFkU3RyZWFtID0gZW1pdHRlci5jcmVhdGVSZWFkU3RyZWFtID0gZnVuY3Rpb24gKG9wdHMpIHtcbiAgICBvcHRzID0gbWVyZ2VPcHRzKG9wdHMpO1xuICAgIG9wdHMucHJlZml4ID0gcHJlZml4O1xuICAgIHZhciBzdHJlYW07XG4gICAgdmFyIGl0ID0gbnV0Lml0ZXJhdG9yKG9wdHMpO1xuXG4gICAgc3RyZWFtID0gY3JlYXRlU3RyZWFtKG9wdHMsIG51dC5jcmVhdGVEZWNvZGVyKG9wdHMpKTtcbiAgICBzdHJlYW0uc2V0SXRlcmF0b3IoaXQpO1xuXG4gICAgcmV0dXJuIHN0cmVhbTtcbiAgfTtcblxuICBlbWl0dGVyLmNsb3NlID0gZnVuY3Rpb24gKGNiKSB7XG4gICAgbnV0LmNsb3NlKGNiKTtcbiAgfTtcblxuICBlbWl0dGVyLmlzT3BlbiA9IG51dC5pc09wZW47XG4gIGVtaXR0ZXIuaXNDbG9zZWQgPSBudXQuaXNDbG9zZWQ7XG5cbiAgcmV0dXJuIGVtaXR0ZXI7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBzdWJsZXZlbDsiLCJ2YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyXG5cbmV4cG9ydHMudXRmOCA9IGV4cG9ydHNbJ3V0Zi04J10gPSB7XG4gIGVuY29kZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICByZXR1cm4gaXNCaW5hcnkoZGF0YSkgPyBkYXRhIDogU3RyaW5nKGRhdGEpXG4gIH0sXG4gIGRlY29kZTogaWRlbnRpdHksXG4gIGJ1ZmZlcjogZmFsc2UsXG4gIHR5cGU6ICd1dGY4J1xufVxuXG5leHBvcnRzLmpzb24gPSB7XG4gIGVuY29kZTogSlNPTi5zdHJpbmdpZnksXG4gIGRlY29kZTogSlNPTi5wYXJzZSxcbiAgYnVmZmVyOiBmYWxzZSxcbiAgdHlwZTogJ2pzb24nXG59XG5cbmV4cG9ydHMuYmluYXJ5ID0ge1xuICBlbmNvZGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgcmV0dXJuIGlzQmluYXJ5KGRhdGEpID8gZGF0YSA6IEJ1ZmZlci5mcm9tKGRhdGEpXG4gIH0sXG4gIGRlY29kZTogaWRlbnRpdHksXG4gIGJ1ZmZlcjogdHJ1ZSxcbiAgdHlwZTogJ2JpbmFyeSdcbn1cblxuZXhwb3J0cy5ub25lID0ge1xuICBlbmNvZGU6IGlkZW50aXR5LFxuICBkZWNvZGU6IGlkZW50aXR5LFxuICBidWZmZXI6IGZhbHNlLFxuICB0eXBlOiAnaWQnXG59XG5cbmV4cG9ydHMuaWQgPSBleHBvcnRzLm5vbmVcblxudmFyIGJ1ZmZlckVuY29kaW5ncyA9IFtcbiAgJ2hleCcsXG4gICdhc2NpaScsXG4gICdiYXNlNjQnLFxuICAndWNzMicsXG4gICd1Y3MtMicsXG4gICd1dGYxNmxlJyxcbiAgJ3V0Zi0xNmxlJ1xuXVxuXG5idWZmZXJFbmNvZGluZ3MuZm9yRWFjaChmdW5jdGlvbiAodHlwZSkge1xuICBleHBvcnRzW3R5cGVdID0ge1xuICAgIGVuY29kZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgIHJldHVybiBpc0JpbmFyeShkYXRhKSA/IGRhdGEgOiBCdWZmZXIuZnJvbShkYXRhLCB0eXBlKVxuICAgIH0sXG4gICAgZGVjb2RlOiBmdW5jdGlvbiAoYnVmZmVyKSB7XG4gICAgICByZXR1cm4gYnVmZmVyLnRvU3RyaW5nKHR5cGUpXG4gICAgfSxcbiAgICBidWZmZXI6IHRydWUsXG4gICAgdHlwZTogdHlwZVxuICB9XG59KVxuXG5mdW5jdGlvbiBpZGVudGl0eSAodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlXG59XG5cbmZ1bmN0aW9uIGlzQmluYXJ5IChkYXRhKSB7XG4gIHJldHVybiBkYXRhID09PSB1bmRlZmluZWQgfHwgZGF0YSA9PT0gbnVsbCB8fCBCdWZmZXIuaXNCdWZmZXIoZGF0YSlcbn1cbiIsInZhciBlbmNvZGluZ3MgPSByZXF1aXJlKCcuL2xpYi9lbmNvZGluZ3MnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvZGVjXG5cbmZ1bmN0aW9uIENvZGVjIChvcHRzKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDb2RlYykpIHtcbiAgICByZXR1cm4gbmV3IENvZGVjKG9wdHMpXG4gIH1cbiAgdGhpcy5vcHRzID0gb3B0cyB8fCB7fVxuICB0aGlzLmVuY29kaW5ncyA9IGVuY29kaW5nc1xufVxuXG5Db2RlYy5wcm90b3R5cGUuX2VuY29kaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnKSBlbmNvZGluZyA9IGVuY29kaW5nc1tlbmNvZGluZ11cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSBlbmNvZGluZ3MuaWRcbiAgcmV0dXJuIGVuY29kaW5nXG59XG5cbkNvZGVjLnByb3RvdHlwZS5fa2V5RW5jb2RpbmcgPSBmdW5jdGlvbiAob3B0cywgYmF0Y2hPcHRzKSB7XG4gIHJldHVybiB0aGlzLl9lbmNvZGluZygoYmF0Y2hPcHRzICYmIGJhdGNoT3B0cy5rZXlFbmNvZGluZykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIChvcHRzICYmIG9wdHMua2V5RW5jb2RpbmcpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9wdHMua2V5RW5jb2RpbmcpXG59XG5cbkNvZGVjLnByb3RvdHlwZS5fdmFsdWVFbmNvZGluZyA9IGZ1bmN0aW9uIChvcHRzLCBiYXRjaE9wdHMpIHtcbiAgcmV0dXJuIHRoaXMuX2VuY29kaW5nKChiYXRjaE9wdHMgJiYgKGJhdGNoT3B0cy52YWx1ZUVuY29kaW5nIHx8IGJhdGNoT3B0cy5lbmNvZGluZykpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAob3B0cyAmJiAob3B0cy52YWx1ZUVuY29kaW5nIHx8IG9wdHMuZW5jb2RpbmcpKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgKHRoaXMub3B0cy52YWx1ZUVuY29kaW5nIHx8IHRoaXMub3B0cy5lbmNvZGluZykpXG59XG5cbkNvZGVjLnByb3RvdHlwZS5lbmNvZGVLZXkgPSBmdW5jdGlvbiAoa2V5LCBvcHRzLCBiYXRjaE9wdHMpIHtcbiAgcmV0dXJuIHRoaXMuX2tleUVuY29kaW5nKG9wdHMsIGJhdGNoT3B0cykuZW5jb2RlKGtleSlcbn1cblxuQ29kZWMucHJvdG90eXBlLmVuY29kZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlLCBvcHRzLCBiYXRjaE9wdHMpIHtcbiAgcmV0dXJuIHRoaXMuX3ZhbHVlRW5jb2Rpbmcob3B0cywgYmF0Y2hPcHRzKS5lbmNvZGUodmFsdWUpXG59XG5cbkNvZGVjLnByb3RvdHlwZS5kZWNvZGVLZXkgPSBmdW5jdGlvbiAoa2V5LCBvcHRzKSB7XG4gIHJldHVybiB0aGlzLl9rZXlFbmNvZGluZyhvcHRzKS5kZWNvZGUoa2V5KVxufVxuXG5Db2RlYy5wcm90b3R5cGUuZGVjb2RlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUsIG9wdHMpIHtcbiAgcmV0dXJuIHRoaXMuX3ZhbHVlRW5jb2Rpbmcob3B0cykuZGVjb2RlKHZhbHVlKVxufVxuXG5Db2RlYy5wcm90b3R5cGUuZW5jb2RlQmF0Y2ggPSBmdW5jdGlvbiAob3BzLCBvcHRzKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIHJldHVybiBvcHMubWFwKGZ1bmN0aW9uIChfb3ApIHtcbiAgICB2YXIgb3AgPSB7XG4gICAgICB0eXBlOiBfb3AudHlwZSxcbiAgICAgIGtleTogc2VsZi5lbmNvZGVLZXkoX29wLmtleSwgb3B0cywgX29wKVxuICAgIH1cbiAgICBpZiAoc2VsZi5rZXlBc0J1ZmZlcihvcHRzLCBfb3ApKSBvcC5rZXlFbmNvZGluZyA9ICdiaW5hcnknXG4gICAgaWYgKF9vcC5wcmVmaXgpIG9wLnByZWZpeCA9IF9vcC5wcmVmaXhcbiAgICBpZiAoJ3ZhbHVlJyBpbiBfb3ApIHtcbiAgICAgIG9wLnZhbHVlID0gc2VsZi5lbmNvZGVWYWx1ZShfb3AudmFsdWUsIG9wdHMsIF9vcClcbiAgICAgIGlmIChzZWxmLnZhbHVlQXNCdWZmZXIob3B0cywgX29wKSkgb3AudmFsdWVFbmNvZGluZyA9ICdiaW5hcnknXG4gICAgfVxuICAgIHJldHVybiBvcFxuICB9KVxufVxuXG52YXIgbHRndEtleXMgPSBbJ2x0JywgJ2d0JywgJ2x0ZScsICdndGUnLCAnc3RhcnQnLCAnZW5kJ11cblxuQ29kZWMucHJvdG90eXBlLmVuY29kZUx0Z3QgPSBmdW5jdGlvbiAobHRndCkge1xuICB2YXIgc2VsZiA9IHRoaXNcbiAgdmFyIHJldCA9IHt9XG4gIE9iamVjdC5rZXlzKGx0Z3QpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHJldFtrZXldID0gbHRndEtleXMuaW5kZXhPZihrZXkpID4gLTFcbiAgICAgID8gc2VsZi5lbmNvZGVLZXkobHRndFtrZXldLCBsdGd0KVxuICAgICAgOiBsdGd0W2tleV1cbiAgfSlcbiAgcmV0dXJuIHJldFxufVxuXG5Db2RlYy5wcm90b3R5cGUuY3JlYXRlU3RyZWFtRGVjb2RlciA9IGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGlmIChvcHRzLmtleXMgJiYgb3B0cy52YWx1ZXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGtleTogc2VsZi5kZWNvZGVLZXkoa2V5LCBvcHRzKSxcbiAgICAgICAgdmFsdWU6IHNlbGYuZGVjb2RlVmFsdWUodmFsdWUsIG9wdHMpXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKG9wdHMua2V5cykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICByZXR1cm4gc2VsZi5kZWNvZGVLZXkoa2V5LCBvcHRzKVxuICAgIH1cbiAgfSBlbHNlIGlmIChvcHRzLnZhbHVlcykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoXywgdmFsdWUpIHtcbiAgICAgIHJldHVybiBzZWxmLmRlY29kZVZhbHVlKHZhbHVlLCBvcHRzKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge31cbiAgfVxufVxuXG5Db2RlYy5wcm90b3R5cGUua2V5QXNCdWZmZXIgPSBmdW5jdGlvbiAob3B0cykge1xuICByZXR1cm4gdGhpcy5fa2V5RW5jb2Rpbmcob3B0cykuYnVmZmVyXG59XG5cbkNvZGVjLnByb3RvdHlwZS52YWx1ZUFzQnVmZmVyID0gZnVuY3Rpb24gKG9wdHMpIHtcbiAgcmV0dXJuIHRoaXMuX3ZhbHVlRW5jb2Rpbmcob3B0cykuYnVmZmVyXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cblxuZnVuY3Rpb24gaXNBcnJheShhcmcpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkpIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShhcmcpO1xuICB9XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhhcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyLmlzQnVmZmVyO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gQSBiaXQgc2ltcGxlciB0aGFuIHJlYWRhYmxlIHN0cmVhbXMuXG4vLyBJbXBsZW1lbnQgYW4gYXN5bmMgLl93cml0ZShjaHVuaywgY2IpLCBhbmQgaXQnbGwgaGFuZGxlIGFsbFxuLy8gdGhlIGRyYWluIGV2ZW50IGVtaXNzaW9uIGFuZCBidWZmZXJpbmcuXG5cbm1vZHVsZS5leHBvcnRzID0gV3JpdGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbldyaXRhYmxlLldyaXRhYmxlU3RhdGUgPSBXcml0YWJsZVN0YXRlO1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuXG51dGlsLmluaGVyaXRzKFdyaXRhYmxlLCBTdHJlYW0pO1xuXG5mdW5jdGlvbiBXcml0ZVJlcShjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHRoaXMuY2h1bmsgPSBjaHVuaztcbiAgdGhpcy5lbmNvZGluZyA9IGVuY29kaW5nO1xuICB0aGlzLmNhbGxiYWNrID0gY2I7XG59XG5cbmZ1bmN0aW9uIFdyaXRhYmxlU3RhdGUob3B0aW9ucywgc3RyZWFtKSB7XG4gIHZhciBEdXBsZXggPSByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgLy8gdGhlIHBvaW50IGF0IHdoaWNoIHdyaXRlKCkgc3RhcnRzIHJldHVybmluZyBmYWxzZVxuICAvLyBOb3RlOiAwIGlzIGEgdmFsaWQgdmFsdWUsIG1lYW5zIHRoYXQgd2UgYWx3YXlzIHJldHVybiBmYWxzZSBpZlxuICAvLyB0aGUgZW50aXJlIGJ1ZmZlciBpcyBub3QgZmx1c2hlZCBpbW1lZGlhdGVseSBvbiB3cml0ZSgpXG4gIHZhciBod20gPSBvcHRpb25zLmhpZ2hXYXRlck1hcms7XG4gIHZhciBkZWZhdWx0SHdtID0gb3B0aW9ucy5vYmplY3RNb2RlID8gMTYgOiAxNiAqIDEwMjQ7XG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IChod20gfHwgaHdtID09PSAwKSA/IGh3bSA6IGRlZmF1bHRId207XG5cbiAgLy8gb2JqZWN0IHN0cmVhbSBmbGFnIHRvIGluZGljYXRlIHdoZXRoZXIgb3Igbm90IHRoaXMgc3RyZWFtXG4gIC8vIGNvbnRhaW5zIGJ1ZmZlcnMgb3Igb2JqZWN0cy5cbiAgdGhpcy5vYmplY3RNb2RlID0gISFvcHRpb25zLm9iamVjdE1vZGU7XG5cbiAgaWYgKHN0cmVhbSBpbnN0YW5jZW9mIER1cGxleClcbiAgICB0aGlzLm9iamVjdE1vZGUgPSB0aGlzLm9iamVjdE1vZGUgfHwgISFvcHRpb25zLndyaXRhYmxlT2JqZWN0TW9kZTtcblxuICAvLyBjYXN0IHRvIGludHMuXG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IH5+dGhpcy5oaWdoV2F0ZXJNYXJrO1xuXG4gIHRoaXMubmVlZERyYWluID0gZmFsc2U7XG4gIC8vIGF0IHRoZSBzdGFydCBvZiBjYWxsaW5nIGVuZCgpXG4gIHRoaXMuZW5kaW5nID0gZmFsc2U7XG4gIC8vIHdoZW4gZW5kKCkgaGFzIGJlZW4gY2FsbGVkLCBhbmQgcmV0dXJuZWRcbiAgdGhpcy5lbmRlZCA9IGZhbHNlO1xuICAvLyB3aGVuICdmaW5pc2gnIGlzIGVtaXR0ZWRcbiAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuXG4gIC8vIHNob3VsZCB3ZSBkZWNvZGUgc3RyaW5ncyBpbnRvIGJ1ZmZlcnMgYmVmb3JlIHBhc3NpbmcgdG8gX3dyaXRlP1xuICAvLyB0aGlzIGlzIGhlcmUgc28gdGhhdCBzb21lIG5vZGUtY29yZSBzdHJlYW1zIGNhbiBvcHRpbWl6ZSBzdHJpbmdcbiAgLy8gaGFuZGxpbmcgYXQgYSBsb3dlciBsZXZlbC5cbiAgdmFyIG5vRGVjb2RlID0gb3B0aW9ucy5kZWNvZGVTdHJpbmdzID09PSBmYWxzZTtcbiAgdGhpcy5kZWNvZGVTdHJpbmdzID0gIW5vRGVjb2RlO1xuXG4gIC8vIENyeXB0byBpcyBraW5kIG9mIG9sZCBhbmQgY3J1c3R5LiAgSGlzdG9yaWNhbGx5LCBpdHMgZGVmYXVsdCBzdHJpbmdcbiAgLy8gZW5jb2RpbmcgaXMgJ2JpbmFyeScgc28gd2UgaGF2ZSB0byBtYWtlIHRoaXMgY29uZmlndXJhYmxlLlxuICAvLyBFdmVyeXRoaW5nIGVsc2UgaW4gdGhlIHVuaXZlcnNlIHVzZXMgJ3V0ZjgnLCB0aG91Z2guXG4gIHRoaXMuZGVmYXVsdEVuY29kaW5nID0gb3B0aW9ucy5kZWZhdWx0RW5jb2RpbmcgfHwgJ3V0ZjgnO1xuXG4gIC8vIG5vdCBhbiBhY3R1YWwgYnVmZmVyIHdlIGtlZXAgdHJhY2sgb2YsIGJ1dCBhIG1lYXN1cmVtZW50XG4gIC8vIG9mIGhvdyBtdWNoIHdlJ3JlIHdhaXRpbmcgdG8gZ2V0IHB1c2hlZCB0byBzb21lIHVuZGVybHlpbmdcbiAgLy8gc29ja2V0IG9yIGZpbGUuXG4gIHRoaXMubGVuZ3RoID0gMDtcblxuICAvLyBhIGZsYWcgdG8gc2VlIHdoZW4gd2UncmUgaW4gdGhlIG1pZGRsZSBvZiBhIHdyaXRlLlxuICB0aGlzLndyaXRpbmcgPSBmYWxzZTtcblxuICAvLyB3aGVuIHRydWUgYWxsIHdyaXRlcyB3aWxsIGJlIGJ1ZmZlcmVkIHVudGlsIC51bmNvcmsoKSBjYWxsXG4gIHRoaXMuY29ya2VkID0gMDtcblxuICAvLyBhIGZsYWcgdG8gYmUgYWJsZSB0byB0ZWxsIGlmIHRoZSBvbndyaXRlIGNiIGlzIGNhbGxlZCBpbW1lZGlhdGVseSxcbiAgLy8gb3Igb24gYSBsYXRlciB0aWNrLiAgV2Ugc2V0IHRoaXMgdG8gdHJ1ZSBhdCBmaXJzdCwgYmVjYXVzZSBhbnlcbiAgLy8gYWN0aW9ucyB0aGF0IHNob3VsZG4ndCBoYXBwZW4gdW50aWwgXCJsYXRlclwiIHNob3VsZCBnZW5lcmFsbHkgYWxzb1xuICAvLyBub3QgaGFwcGVuIGJlZm9yZSB0aGUgZmlyc3Qgd3JpdGUgY2FsbC5cbiAgdGhpcy5zeW5jID0gdHJ1ZTtcblxuICAvLyBhIGZsYWcgdG8ga25vdyBpZiB3ZSdyZSBwcm9jZXNzaW5nIHByZXZpb3VzbHkgYnVmZmVyZWQgaXRlbXMsIHdoaWNoXG4gIC8vIG1heSBjYWxsIHRoZSBfd3JpdGUoKSBjYWxsYmFjayBpbiB0aGUgc2FtZSB0aWNrLCBzbyB0aGF0IHdlIGRvbid0XG4gIC8vIGVuZCB1cCBpbiBhbiBvdmVybGFwcGVkIG9ud3JpdGUgc2l0dWF0aW9uLlxuICB0aGlzLmJ1ZmZlclByb2Nlc3NpbmcgPSBmYWxzZTtcblxuICAvLyB0aGUgY2FsbGJhY2sgdGhhdCdzIHBhc3NlZCB0byBfd3JpdGUoY2h1bmssY2IpXG4gIHRoaXMub253cml0ZSA9IGZ1bmN0aW9uKGVyKSB7XG4gICAgb253cml0ZShzdHJlYW0sIGVyKTtcbiAgfTtcblxuICAvLyB0aGUgY2FsbGJhY2sgdGhhdCB0aGUgdXNlciBzdXBwbGllcyB0byB3cml0ZShjaHVuayxlbmNvZGluZyxjYilcbiAgdGhpcy53cml0ZWNiID0gbnVsbDtcblxuICAvLyB0aGUgYW1vdW50IHRoYXQgaXMgYmVpbmcgd3JpdHRlbiB3aGVuIF93cml0ZSBpcyBjYWxsZWQuXG4gIHRoaXMud3JpdGVsZW4gPSAwO1xuXG4gIHRoaXMuYnVmZmVyID0gW107XG5cbiAgLy8gbnVtYmVyIG9mIHBlbmRpbmcgdXNlci1zdXBwbGllZCB3cml0ZSBjYWxsYmFja3NcbiAgLy8gdGhpcyBtdXN0IGJlIDAgYmVmb3JlICdmaW5pc2gnIGNhbiBiZSBlbWl0dGVkXG4gIHRoaXMucGVuZGluZ2NiID0gMDtcblxuICAvLyBlbWl0IHByZWZpbmlzaCBpZiB0aGUgb25seSB0aGluZyB3ZSdyZSB3YWl0aW5nIGZvciBpcyBfd3JpdGUgY2JzXG4gIC8vIFRoaXMgaXMgcmVsZXZhbnQgZm9yIHN5bmNocm9ub3VzIFRyYW5zZm9ybSBzdHJlYW1zXG4gIHRoaXMucHJlZmluaXNoZWQgPSBmYWxzZTtcblxuICAvLyBUcnVlIGlmIHRoZSBlcnJvciB3YXMgYWxyZWFkeSBlbWl0dGVkIGFuZCBzaG91bGQgbm90IGJlIHRocm93biBhZ2FpblxuICB0aGlzLmVycm9yRW1pdHRlZCA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBXcml0YWJsZShvcHRpb25zKSB7XG4gIHZhciBEdXBsZXggPSByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgLy8gV3JpdGFibGUgY3RvciBpcyBhcHBsaWVkIHRvIER1cGxleGVzLCB0aG91Z2ggdGhleSdyZSBub3RcbiAgLy8gaW5zdGFuY2VvZiBXcml0YWJsZSwgdGhleSdyZSBpbnN0YW5jZW9mIFJlYWRhYmxlLlxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgV3JpdGFibGUpICYmICEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpXG4gICAgcmV0dXJuIG5ldyBXcml0YWJsZShvcHRpb25zKTtcblxuICB0aGlzLl93cml0YWJsZVN0YXRlID0gbmV3IFdyaXRhYmxlU3RhdGUob3B0aW9ucywgdGhpcyk7XG5cbiAgLy8gbGVnYWN5LlxuICB0aGlzLndyaXRhYmxlID0gdHJ1ZTtcblxuICBTdHJlYW0uY2FsbCh0aGlzKTtcbn1cblxuLy8gT3RoZXJ3aXNlIHBlb3BsZSBjYW4gcGlwZSBXcml0YWJsZSBzdHJlYW1zLCB3aGljaCBpcyBqdXN0IHdyb25nLlxuV3JpdGFibGUucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignQ2Fubm90IHBpcGUuIE5vdCByZWFkYWJsZS4nKSk7XG59O1xuXG5cbmZ1bmN0aW9uIHdyaXRlQWZ0ZXJFbmQoc3RyZWFtLCBzdGF0ZSwgY2IpIHtcbiAgdmFyIGVyID0gbmV3IEVycm9yKCd3cml0ZSBhZnRlciBlbmQnKTtcbiAgLy8gVE9ETzogZGVmZXIgZXJyb3IgZXZlbnRzIGNvbnNpc3RlbnRseSBldmVyeXdoZXJlLCBub3QganVzdCB0aGUgY2JcbiAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgIGNiKGVyKTtcbiAgfSk7XG59XG5cbi8vIElmIHdlIGdldCBzb21ldGhpbmcgdGhhdCBpcyBub3QgYSBidWZmZXIsIHN0cmluZywgbnVsbCwgb3IgdW5kZWZpbmVkLFxuLy8gYW5kIHdlJ3JlIG5vdCBpbiBvYmplY3RNb2RlLCB0aGVuIHRoYXQncyBhbiBlcnJvci5cbi8vIE90aGVyd2lzZSBzdHJlYW0gY2h1bmtzIGFyZSBhbGwgY29uc2lkZXJlZCB0byBiZSBvZiBsZW5ndGg9MSwgYW5kIHRoZVxuLy8gd2F0ZXJtYXJrcyBkZXRlcm1pbmUgaG93IG1hbnkgb2JqZWN0cyB0byBrZWVwIGluIHRoZSBidWZmZXIsIHJhdGhlciB0aGFuXG4vLyBob3cgbWFueSBieXRlcyBvciBjaGFyYWN0ZXJzLlxuZnVuY3Rpb24gdmFsaWRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgY2IpIHtcbiAgdmFyIHZhbGlkID0gdHJ1ZTtcbiAgaWYgKCF1dGlsLmlzQnVmZmVyKGNodW5rKSAmJlxuICAgICAgIXV0aWwuaXNTdHJpbmcoY2h1bmspICYmXG4gICAgICAhdXRpbC5pc051bGxPclVuZGVmaW5lZChjaHVuaykgJiZcbiAgICAgICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgdmFyIGVyID0gbmV3IFR5cGVFcnJvcignSW52YWxpZCBub24tc3RyaW5nL2J1ZmZlciBjaHVuaycpO1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgY2IoZXIpO1xuICAgIH0pO1xuICAgIHZhbGlkID0gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHZhbGlkO1xufVxuXG5Xcml0YWJsZS5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG4gIHZhciByZXQgPSBmYWxzZTtcblxuICBpZiAodXRpbC5pc0Z1bmN0aW9uKGVuY29kaW5nKSkge1xuICAgIGNiID0gZW5jb2Rpbmc7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9XG5cbiAgaWYgKHV0aWwuaXNCdWZmZXIoY2h1bmspKVxuICAgIGVuY29kaW5nID0gJ2J1ZmZlcic7XG4gIGVsc2UgaWYgKCFlbmNvZGluZylcbiAgICBlbmNvZGluZyA9IHN0YXRlLmRlZmF1bHRFbmNvZGluZztcblxuICBpZiAoIXV0aWwuaXNGdW5jdGlvbihjYikpXG4gICAgY2IgPSBmdW5jdGlvbigpIHt9O1xuXG4gIGlmIChzdGF0ZS5lbmRlZClcbiAgICB3cml0ZUFmdGVyRW5kKHRoaXMsIHN0YXRlLCBjYik7XG4gIGVsc2UgaWYgKHZhbGlkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCBjYikpIHtcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICByZXQgPSB3cml0ZU9yQnVmZmVyKHRoaXMsIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuY29yayA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIHN0YXRlLmNvcmtlZCsrO1xufTtcblxuV3JpdGFibGUucHJvdG90eXBlLnVuY29yayA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIGlmIChzdGF0ZS5jb3JrZWQpIHtcbiAgICBzdGF0ZS5jb3JrZWQtLTtcblxuICAgIGlmICghc3RhdGUud3JpdGluZyAmJlxuICAgICAgICAhc3RhdGUuY29ya2VkICYmXG4gICAgICAgICFzdGF0ZS5maW5pc2hlZCAmJlxuICAgICAgICAhc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyAmJlxuICAgICAgICBzdGF0ZS5idWZmZXIubGVuZ3RoKVxuICAgICAgY2xlYXJCdWZmZXIodGhpcywgc3RhdGUpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBkZWNvZGVDaHVuayhzdGF0ZSwgY2h1bmssIGVuY29kaW5nKSB7XG4gIGlmICghc3RhdGUub2JqZWN0TW9kZSAmJlxuICAgICAgc3RhdGUuZGVjb2RlU3RyaW5ncyAhPT0gZmFsc2UgJiZcbiAgICAgIHV0aWwuaXNTdHJpbmcoY2h1bmspKSB7XG4gICAgY2h1bmsgPSBuZXcgQnVmZmVyKGNodW5rLCBlbmNvZGluZyk7XG4gIH1cbiAgcmV0dXJuIGNodW5rO1xufVxuXG4vLyBpZiB3ZSdyZSBhbHJlYWR5IHdyaXRpbmcgc29tZXRoaW5nLCB0aGVuIGp1c3QgcHV0IHRoaXNcbi8vIGluIHRoZSBxdWV1ZSwgYW5kIHdhaXQgb3VyIHR1cm4uICBPdGhlcndpc2UsIGNhbGwgX3dyaXRlXG4vLyBJZiB3ZSByZXR1cm4gZmFsc2UsIHRoZW4gd2UgbmVlZCBhIGRyYWluIGV2ZW50LCBzbyBzZXQgdGhhdCBmbGFnLlxuZnVuY3Rpb24gd3JpdGVPckJ1ZmZlcihzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNodW5rID0gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZyk7XG4gIGlmICh1dGlsLmlzQnVmZmVyKGNodW5rKSlcbiAgICBlbmNvZGluZyA9ICdidWZmZXInO1xuICB2YXIgbGVuID0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG5cbiAgc3RhdGUubGVuZ3RoICs9IGxlbjtcblxuICB2YXIgcmV0ID0gc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaztcbiAgLy8gd2UgbXVzdCBlbnN1cmUgdGhhdCBwcmV2aW91cyBuZWVkRHJhaW4gd2lsbCBub3QgYmUgcmVzZXQgdG8gZmFsc2UuXG4gIGlmICghcmV0KVxuICAgIHN0YXRlLm5lZWREcmFpbiA9IHRydWU7XG5cbiAgaWYgKHN0YXRlLndyaXRpbmcgfHwgc3RhdGUuY29ya2VkKVxuICAgIHN0YXRlLmJ1ZmZlci5wdXNoKG5ldyBXcml0ZVJlcShjaHVuaywgZW5jb2RpbmcsIGNiKSk7XG4gIGVsc2VcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIGZhbHNlLCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpO1xuXG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgd3JpdGV2LCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgc3RhdGUud3JpdGVsZW4gPSBsZW47XG4gIHN0YXRlLndyaXRlY2IgPSBjYjtcbiAgc3RhdGUud3JpdGluZyA9IHRydWU7XG4gIHN0YXRlLnN5bmMgPSB0cnVlO1xuICBpZiAod3JpdGV2KVxuICAgIHN0cmVhbS5fd3JpdGV2KGNodW5rLCBzdGF0ZS5vbndyaXRlKTtcbiAgZWxzZVxuICAgIHN0cmVhbS5fd3JpdGUoY2h1bmssIGVuY29kaW5nLCBzdGF0ZS5vbndyaXRlKTtcbiAgc3RhdGUuc3luYyA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBvbndyaXRlRXJyb3Ioc3RyZWFtLCBzdGF0ZSwgc3luYywgZXIsIGNiKSB7XG4gIGlmIChzeW5jKVxuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgICAgIGNiKGVyKTtcbiAgICB9KTtcbiAgZWxzZSB7XG4gICAgc3RhdGUucGVuZGluZ2NiLS07XG4gICAgY2IoZXIpO1xuICB9XG5cbiAgc3RyZWFtLl93cml0YWJsZVN0YXRlLmVycm9yRW1pdHRlZCA9IHRydWU7XG4gIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbn1cblxuZnVuY3Rpb24gb253cml0ZVN0YXRlVXBkYXRlKHN0YXRlKSB7XG4gIHN0YXRlLndyaXRpbmcgPSBmYWxzZTtcbiAgc3RhdGUud3JpdGVjYiA9IG51bGw7XG4gIHN0YXRlLmxlbmd0aCAtPSBzdGF0ZS53cml0ZWxlbjtcbiAgc3RhdGUud3JpdGVsZW4gPSAwO1xufVxuXG5mdW5jdGlvbiBvbndyaXRlKHN0cmVhbSwgZXIpIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl93cml0YWJsZVN0YXRlO1xuICB2YXIgc3luYyA9IHN0YXRlLnN5bmM7XG4gIHZhciBjYiA9IHN0YXRlLndyaXRlY2I7XG5cbiAgb253cml0ZVN0YXRlVXBkYXRlKHN0YXRlKTtcblxuICBpZiAoZXIpXG4gICAgb253cml0ZUVycm9yKHN0cmVhbSwgc3RhdGUsIHN5bmMsIGVyLCBjYik7XG4gIGVsc2Uge1xuICAgIC8vIENoZWNrIGlmIHdlJ3JlIGFjdHVhbGx5IHJlYWR5IHRvIGZpbmlzaCwgYnV0IGRvbid0IGVtaXQgeWV0XG4gICAgdmFyIGZpbmlzaGVkID0gbmVlZEZpbmlzaChzdHJlYW0sIHN0YXRlKTtcblxuICAgIGlmICghZmluaXNoZWQgJiZcbiAgICAgICAgIXN0YXRlLmNvcmtlZCAmJlxuICAgICAgICAhc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyAmJlxuICAgICAgICBzdGF0ZS5idWZmZXIubGVuZ3RoKSB7XG4gICAgICBjbGVhckJ1ZmZlcihzdHJlYW0sIHN0YXRlKTtcbiAgICB9XG5cbiAgICBpZiAoc3luYykge1xuICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgYWZ0ZXJXcml0ZShzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFmdGVyV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmluaXNoZWQsIGNiKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWZ0ZXJXcml0ZShzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpIHtcbiAgaWYgKCFmaW5pc2hlZClcbiAgICBvbndyaXRlRHJhaW4oc3RyZWFtLCBzdGF0ZSk7XG4gIHN0YXRlLnBlbmRpbmdjYi0tO1xuICBjYigpO1xuICBmaW5pc2hNYXliZShzdHJlYW0sIHN0YXRlKTtcbn1cblxuLy8gTXVzdCBmb3JjZSBjYWxsYmFjayB0byBiZSBjYWxsZWQgb24gbmV4dFRpY2ssIHNvIHRoYXQgd2UgZG9uJ3Rcbi8vIGVtaXQgJ2RyYWluJyBiZWZvcmUgdGhlIHdyaXRlKCkgY29uc3VtZXIgZ2V0cyB0aGUgJ2ZhbHNlJyByZXR1cm5cbi8vIHZhbHVlLCBhbmQgaGFzIGEgY2hhbmNlIHRvIGF0dGFjaCBhICdkcmFpbicgbGlzdGVuZXIuXG5mdW5jdGlvbiBvbndyaXRlRHJhaW4oc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLm5lZWREcmFpbikge1xuICAgIHN0YXRlLm5lZWREcmFpbiA9IGZhbHNlO1xuICAgIHN0cmVhbS5lbWl0KCdkcmFpbicpO1xuICB9XG59XG5cblxuLy8gaWYgdGhlcmUncyBzb21ldGhpbmcgaW4gdGhlIGJ1ZmZlciB3YWl0aW5nLCB0aGVuIHByb2Nlc3MgaXRcbmZ1bmN0aW9uIGNsZWFyQnVmZmVyKHN0cmVhbSwgc3RhdGUpIHtcbiAgc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyA9IHRydWU7XG5cbiAgaWYgKHN0cmVhbS5fd3JpdGV2ICYmIHN0YXRlLmJ1ZmZlci5sZW5ndGggPiAxKSB7XG4gICAgLy8gRmFzdCBjYXNlLCB3cml0ZSBldmVyeXRoaW5nIHVzaW5nIF93cml0ZXYoKVxuICAgIHZhciBjYnMgPSBbXTtcbiAgICBmb3IgKHZhciBjID0gMDsgYyA8IHN0YXRlLmJ1ZmZlci5sZW5ndGg7IGMrKylcbiAgICAgIGNicy5wdXNoKHN0YXRlLmJ1ZmZlcltjXS5jYWxsYmFjayk7XG5cbiAgICAvLyBjb3VudCB0aGUgb25lIHdlIGFyZSBhZGRpbmcsIGFzIHdlbGwuXG4gICAgLy8gVE9ETyhpc2FhY3MpIGNsZWFuIHRoaXMgdXBcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIHRydWUsIHN0YXRlLmxlbmd0aCwgc3RhdGUuYnVmZmVyLCAnJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNicy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgICAgICAgY2JzW2ldKGVycik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDbGVhciBidWZmZXJcbiAgICBzdGF0ZS5idWZmZXIgPSBbXTtcbiAgfSBlbHNlIHtcbiAgICAvLyBTbG93IGNhc2UsIHdyaXRlIGNodW5rcyBvbmUtYnktb25lXG4gICAgZm9yICh2YXIgYyA9IDA7IGMgPCBzdGF0ZS5idWZmZXIubGVuZ3RoOyBjKyspIHtcbiAgICAgIHZhciBlbnRyeSA9IHN0YXRlLmJ1ZmZlcltjXTtcbiAgICAgIHZhciBjaHVuayA9IGVudHJ5LmNodW5rO1xuICAgICAgdmFyIGVuY29kaW5nID0gZW50cnkuZW5jb2Rpbmc7XG4gICAgICB2YXIgY2IgPSBlbnRyeS5jYWxsYmFjaztcbiAgICAgIHZhciBsZW4gPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcblxuICAgICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCBmYWxzZSwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcblxuICAgICAgLy8gaWYgd2UgZGlkbid0IGNhbGwgdGhlIG9ud3JpdGUgaW1tZWRpYXRlbHksIHRoZW5cbiAgICAgIC8vIGl0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byB3YWl0IHVudGlsIGl0IGRvZXMuXG4gICAgICAvLyBhbHNvLCB0aGF0IG1lYW5zIHRoYXQgdGhlIGNodW5rIGFuZCBjYiBhcmUgY3VycmVudGx5XG4gICAgICAvLyBiZWluZyBwcm9jZXNzZWQsIHNvIG1vdmUgdGhlIGJ1ZmZlciBjb3VudGVyIHBhc3QgdGhlbS5cbiAgICAgIGlmIChzdGF0ZS53cml0aW5nKSB7XG4gICAgICAgIGMrKztcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGMgPCBzdGF0ZS5idWZmZXIubGVuZ3RoKVxuICAgICAgc3RhdGUuYnVmZmVyID0gc3RhdGUuYnVmZmVyLnNsaWNlKGMpO1xuICAgIGVsc2VcbiAgICAgIHN0YXRlLmJ1ZmZlci5sZW5ndGggPSAwO1xuICB9XG5cbiAgc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyA9IGZhbHNlO1xufVxuXG5Xcml0YWJsZS5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBjYihuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcblxufTtcblxuV3JpdGFibGUucHJvdG90eXBlLl93cml0ZXYgPSBudWxsO1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIGlmICh1dGlsLmlzRnVuY3Rpb24oY2h1bmspKSB7XG4gICAgY2IgPSBjaHVuaztcbiAgICBjaHVuayA9IG51bGw7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9IGVsc2UgaWYgKHV0aWwuaXNGdW5jdGlvbihlbmNvZGluZykpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmICghdXRpbC5pc051bGxPclVuZGVmaW5lZChjaHVuaykpXG4gICAgdGhpcy53cml0ZShjaHVuaywgZW5jb2RpbmcpO1xuXG4gIC8vIC5lbmQoKSBmdWxseSB1bmNvcmtzXG4gIGlmIChzdGF0ZS5jb3JrZWQpIHtcbiAgICBzdGF0ZS5jb3JrZWQgPSAxO1xuICAgIHRoaXMudW5jb3JrKCk7XG4gIH1cblxuICAvLyBpZ25vcmUgdW5uZWNlc3NhcnkgZW5kKCkgY2FsbHMuXG4gIGlmICghc3RhdGUuZW5kaW5nICYmICFzdGF0ZS5maW5pc2hlZClcbiAgICBlbmRXcml0YWJsZSh0aGlzLCBzdGF0ZSwgY2IpO1xufTtcblxuXG5mdW5jdGlvbiBuZWVkRmluaXNoKHN0cmVhbSwgc3RhdGUpIHtcbiAgcmV0dXJuIChzdGF0ZS5lbmRpbmcgJiZcbiAgICAgICAgICBzdGF0ZS5sZW5ndGggPT09IDAgJiZcbiAgICAgICAgICAhc3RhdGUuZmluaXNoZWQgJiZcbiAgICAgICAgICAhc3RhdGUud3JpdGluZyk7XG59XG5cbmZ1bmN0aW9uIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucHJlZmluaXNoZWQpIHtcbiAgICBzdGF0ZS5wcmVmaW5pc2hlZCA9IHRydWU7XG4gICAgc3RyZWFtLmVtaXQoJ3ByZWZpbmlzaCcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmlzaE1heWJlKHN0cmVhbSwgc3RhdGUpIHtcbiAgdmFyIG5lZWQgPSBuZWVkRmluaXNoKHN0cmVhbSwgc3RhdGUpO1xuICBpZiAobmVlZCkge1xuICAgIGlmIChzdGF0ZS5wZW5kaW5nY2IgPT09IDApIHtcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgICAgIHN0YXRlLmZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgIHN0cmVhbS5lbWl0KCdmaW5pc2gnKTtcbiAgICB9IGVsc2VcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgfVxuICByZXR1cm4gbmVlZDtcbn1cblxuZnVuY3Rpb24gZW5kV3JpdGFibGUoc3RyZWFtLCBzdGF0ZSwgY2IpIHtcbiAgc3RhdGUuZW5kaW5nID0gdHJ1ZTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG4gIGlmIChjYikge1xuICAgIGlmIChzdGF0ZS5maW5pc2hlZClcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soY2IpO1xuICAgIGVsc2VcbiAgICAgIHN0cmVhbS5vbmNlKCdmaW5pc2gnLCBjYik7XG4gIH1cbiAgc3RhdGUuZW5kZWQgPSB0cnVlO1xufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIGEgZHVwbGV4IHN0cmVhbSBpcyBqdXN0IGEgc3RyZWFtIHRoYXQgaXMgYm90aCByZWFkYWJsZSBhbmQgd3JpdGFibGUuXG4vLyBTaW5jZSBKUyBkb2Vzbid0IGhhdmUgbXVsdGlwbGUgcHJvdG90eXBhbCBpbmhlcml0YW5jZSwgdGhpcyBjbGFzc1xuLy8gcHJvdG90eXBhbGx5IGluaGVyaXRzIGZyb20gUmVhZGFibGUsIGFuZCB0aGVuIHBhcmFzaXRpY2FsbHkgZnJvbVxuLy8gV3JpdGFibGUuXG5cbm1vZHVsZS5leHBvcnRzID0gRHVwbGV4O1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIGtleXMucHVzaChrZXkpO1xuICByZXR1cm4ga2V5cztcbn1cbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFJlYWRhYmxlID0gcmVxdWlyZSgnLi9fc3RyZWFtX3JlYWRhYmxlJyk7XG52YXIgV3JpdGFibGUgPSByZXF1aXJlKCcuL19zdHJlYW1fd3JpdGFibGUnKTtcblxudXRpbC5pbmhlcml0cyhEdXBsZXgsIFJlYWRhYmxlKTtcblxuZm9yRWFjaChvYmplY3RLZXlzKFdyaXRhYmxlLnByb3RvdHlwZSksIGZ1bmN0aW9uKG1ldGhvZCkge1xuICBpZiAoIUR1cGxleC5wcm90b3R5cGVbbWV0aG9kXSlcbiAgICBEdXBsZXgucHJvdG90eXBlW21ldGhvZF0gPSBXcml0YWJsZS5wcm90b3R5cGVbbWV0aG9kXTtcbn0pO1xuXG5mdW5jdGlvbiBEdXBsZXgob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRHVwbGV4KSlcbiAgICByZXR1cm4gbmV3IER1cGxleChvcHRpb25zKTtcblxuICBSZWFkYWJsZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICBXcml0YWJsZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMucmVhZGFibGUgPT09IGZhbHNlKVxuICAgIHRoaXMucmVhZGFibGUgPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLndyaXRhYmxlID09PSBmYWxzZSlcbiAgICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG5cbiAgdGhpcy5hbGxvd0hhbGZPcGVuID0gdHJ1ZTtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5hbGxvd0hhbGZPcGVuID09PSBmYWxzZSlcbiAgICB0aGlzLmFsbG93SGFsZk9wZW4gPSBmYWxzZTtcblxuICB0aGlzLm9uY2UoJ2VuZCcsIG9uZW5kKTtcbn1cblxuLy8gdGhlIG5vLWhhbGYtb3BlbiBlbmZvcmNlclxuZnVuY3Rpb24gb25lbmQoKSB7XG4gIC8vIGlmIHdlIGFsbG93IGhhbGYtb3BlbiBzdGF0ZSwgb3IgaWYgdGhlIHdyaXRhYmxlIHNpZGUgZW5kZWQsXG4gIC8vIHRoZW4gd2UncmUgb2suXG4gIGlmICh0aGlzLmFsbG93SGFsZk9wZW4gfHwgdGhpcy5fd3JpdGFibGVTdGF0ZS5lbmRlZClcbiAgICByZXR1cm47XG5cbiAgLy8gbm8gbW9yZSBkYXRhIGNhbiBiZSB3cml0dGVuLlxuICAvLyBCdXQgYWxsb3cgbW9yZSB3cml0ZXMgdG8gaGFwcGVuIGluIHRoaXMgdGljay5cbiAgcHJvY2Vzcy5uZXh0VGljayh0aGlzLmVuZC5iaW5kKHRoaXMpKTtcbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG5cbnZhciBpc0J1ZmZlckVuY29kaW5nID0gQnVmZmVyLmlzRW5jb2RpbmdcbiAgfHwgZnVuY3Rpb24oZW5jb2RpbmcpIHtcbiAgICAgICBzd2l0Y2ggKGVuY29kaW5nICYmIGVuY29kaW5nLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgIGNhc2UgJ2hleCc6IGNhc2UgJ3V0ZjgnOiBjYXNlICd1dGYtOCc6IGNhc2UgJ2FzY2lpJzogY2FzZSAnYmluYXJ5JzogY2FzZSAnYmFzZTY0JzogY2FzZSAndWNzMic6IGNhc2UgJ3Vjcy0yJzogY2FzZSAndXRmMTZsZSc6IGNhc2UgJ3V0Zi0xNmxlJzogY2FzZSAncmF3JzogcmV0dXJuIHRydWU7XG4gICAgICAgICBkZWZhdWx0OiByZXR1cm4gZmFsc2U7XG4gICAgICAgfVxuICAgICB9XG5cblxuZnVuY3Rpb24gYXNzZXJ0RW5jb2RpbmcoZW5jb2RpbmcpIHtcbiAgaWYgKGVuY29kaW5nICYmICFpc0J1ZmZlckVuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcbiAgfVxufVxuXG4vLyBTdHJpbmdEZWNvZGVyIHByb3ZpZGVzIGFuIGludGVyZmFjZSBmb3IgZWZmaWNpZW50bHkgc3BsaXR0aW5nIGEgc2VyaWVzIG9mXG4vLyBidWZmZXJzIGludG8gYSBzZXJpZXMgb2YgSlMgc3RyaW5ncyB3aXRob3V0IGJyZWFraW5nIGFwYXJ0IG11bHRpLWJ5dGVcbi8vIGNoYXJhY3RlcnMuIENFU1UtOCBpcyBoYW5kbGVkIGFzIHBhcnQgb2YgdGhlIFVURi04IGVuY29kaW5nLlxuLy9cbi8vIEBUT0RPIEhhbmRsaW5nIGFsbCBlbmNvZGluZ3MgaW5zaWRlIGEgc2luZ2xlIG9iamVjdCBtYWtlcyBpdCB2ZXJ5IGRpZmZpY3VsdFxuLy8gdG8gcmVhc29uIGFib3V0IHRoaXMgY29kZSwgc28gaXQgc2hvdWxkIGJlIHNwbGl0IHVwIGluIHRoZSBmdXR1cmUuXG4vLyBAVE9ETyBUaGVyZSBzaG91bGQgYmUgYSB1dGY4LXN0cmljdCBlbmNvZGluZyB0aGF0IHJlamVjdHMgaW52YWxpZCBVVEYtOCBjb2RlXG4vLyBwb2ludHMgYXMgdXNlZCBieSBDRVNVLTguXG52YXIgU3RyaW5nRGVjb2RlciA9IGV4cG9ydHMuU3RyaW5nRGVjb2RlciA9IGZ1bmN0aW9uKGVuY29kaW5nKSB7XG4gIHRoaXMuZW5jb2RpbmcgPSAoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1stX10vLCAnJyk7XG4gIGFzc2VydEVuY29kaW5nKGVuY29kaW5nKTtcbiAgc3dpdGNoICh0aGlzLmVuY29kaW5nKSB7XG4gICAgY2FzZSAndXRmOCc6XG4gICAgICAvLyBDRVNVLTggcmVwcmVzZW50cyBlYWNoIG9mIFN1cnJvZ2F0ZSBQYWlyIGJ5IDMtYnl0ZXNcbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIC8vIFVURi0xNiByZXByZXNlbnRzIGVhY2ggb2YgU3Vycm9nYXRlIFBhaXIgYnkgMi1ieXRlc1xuICAgICAgdGhpcy5zdXJyb2dhdGVTaXplID0gMjtcbiAgICAgIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIgPSB1dGYxNkRldGVjdEluY29tcGxldGVDaGFyO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIC8vIEJhc2UtNjQgc3RvcmVzIDMgYnl0ZXMgaW4gNCBjaGFycywgYW5kIHBhZHMgdGhlIHJlbWFpbmRlci5cbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyID0gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy53cml0ZSA9IHBhc3NUaHJvdWdoV3JpdGU7XG4gICAgICByZXR1cm47XG4gIH1cblxuICAvLyBFbm91Z2ggc3BhY2UgdG8gc3RvcmUgYWxsIGJ5dGVzIG9mIGEgc2luZ2xlIGNoYXJhY3Rlci4gVVRGLTggbmVlZHMgNFxuICAvLyBieXRlcywgYnV0IENFU1UtOCBtYXkgcmVxdWlyZSB1cCB0byA2ICgzIGJ5dGVzIHBlciBzdXJyb2dhdGUpLlxuICB0aGlzLmNoYXJCdWZmZXIgPSBuZXcgQnVmZmVyKDYpO1xuICAvLyBOdW1iZXIgb2YgYnl0ZXMgcmVjZWl2ZWQgZm9yIHRoZSBjdXJyZW50IGluY29tcGxldGUgbXVsdGktYnl0ZSBjaGFyYWN0ZXIuXG4gIHRoaXMuY2hhclJlY2VpdmVkID0gMDtcbiAgLy8gTnVtYmVyIG9mIGJ5dGVzIGV4cGVjdGVkIGZvciB0aGUgY3VycmVudCBpbmNvbXBsZXRlIG11bHRpLWJ5dGUgY2hhcmFjdGVyLlxuICB0aGlzLmNoYXJMZW5ndGggPSAwO1xufTtcblxuXG4vLyB3cml0ZSBkZWNvZGVzIHRoZSBnaXZlbiBidWZmZXIgYW5kIHJldHVybnMgaXQgYXMgSlMgc3RyaW5nIHRoYXQgaXNcbi8vIGd1YXJhbnRlZWQgdG8gbm90IGNvbnRhaW4gYW55IHBhcnRpYWwgbXVsdGktYnl0ZSBjaGFyYWN0ZXJzLiBBbnkgcGFydGlhbFxuLy8gY2hhcmFjdGVyIGZvdW5kIGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlciBpcyBidWZmZXJlZCB1cCwgYW5kIHdpbGwgYmVcbi8vIHJldHVybmVkIHdoZW4gY2FsbGluZyB3cml0ZSBhZ2FpbiB3aXRoIHRoZSByZW1haW5pbmcgYnl0ZXMuXG4vL1xuLy8gTm90ZTogQ29udmVydGluZyBhIEJ1ZmZlciBjb250YWluaW5nIGFuIG9ycGhhbiBzdXJyb2dhdGUgdG8gYSBTdHJpbmdcbi8vIGN1cnJlbnRseSB3b3JrcywgYnV0IGNvbnZlcnRpbmcgYSBTdHJpbmcgdG8gYSBCdWZmZXIgKHZpYSBgbmV3IEJ1ZmZlcmAsIG9yXG4vLyBCdWZmZXIjd3JpdGUpIHdpbGwgcmVwbGFjZSBpbmNvbXBsZXRlIHN1cnJvZ2F0ZXMgd2l0aCB0aGUgdW5pY29kZVxuLy8gcmVwbGFjZW1lbnQgY2hhcmFjdGVyLiBTZWUgaHR0cHM6Ly9jb2RlcmV2aWV3LmNocm9taXVtLm9yZy8xMjExNzMwMDkvIC5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciBjaGFyU3RyID0gJyc7XG4gIC8vIGlmIG91ciBsYXN0IHdyaXRlIGVuZGVkIHdpdGggYW4gaW5jb21wbGV0ZSBtdWx0aWJ5dGUgY2hhcmFjdGVyXG4gIHdoaWxlICh0aGlzLmNoYXJMZW5ndGgpIHtcbiAgICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgcmVtYWluaW5nIGJ5dGVzIHRoaXMgYnVmZmVyIGhhcyB0byBvZmZlciBmb3IgdGhpcyBjaGFyXG4gICAgdmFyIGF2YWlsYWJsZSA9IChidWZmZXIubGVuZ3RoID49IHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkKSA/XG4gICAgICAgIHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkIDpcbiAgICAgICAgYnVmZmVyLmxlbmd0aDtcblxuICAgIC8vIGFkZCB0aGUgbmV3IGJ5dGVzIHRvIHRoZSBjaGFyIGJ1ZmZlclxuICAgIGJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgdGhpcy5jaGFyUmVjZWl2ZWQsIDAsIGF2YWlsYWJsZSk7XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgKz0gYXZhaWxhYmxlO1xuXG4gICAgaWYgKHRoaXMuY2hhclJlY2VpdmVkIDwgdGhpcy5jaGFyTGVuZ3RoKSB7XG4gICAgICAvLyBzdGlsbCBub3QgZW5vdWdoIGNoYXJzIGluIHRoaXMgYnVmZmVyPyB3YWl0IGZvciBtb3JlIC4uLlxuICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIC8vIHJlbW92ZSBieXRlcyBiZWxvbmdpbmcgdG8gdGhlIGN1cnJlbnQgY2hhcmFjdGVyIGZyb20gdGhlIGJ1ZmZlclxuICAgIGJ1ZmZlciA9IGJ1ZmZlci5zbGljZShhdmFpbGFibGUsIGJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgLy8gZ2V0IHRoZSBjaGFyYWN0ZXIgdGhhdCB3YXMgc3BsaXRcbiAgICBjaGFyU3RyID0gdGhpcy5jaGFyQnVmZmVyLnNsaWNlKDAsIHRoaXMuY2hhckxlbmd0aCkudG9TdHJpbmcodGhpcy5lbmNvZGluZyk7XG5cbiAgICAvLyBDRVNVLTg6IGxlYWQgc3Vycm9nYXRlIChEODAwLURCRkYpIGlzIGFsc28gdGhlIGluY29tcGxldGUgY2hhcmFjdGVyXG4gICAgdmFyIGNoYXJDb2RlID0gY2hhclN0ci5jaGFyQ29kZUF0KGNoYXJTdHIubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGNoYXJDb2RlID49IDB4RDgwMCAmJiBjaGFyQ29kZSA8PSAweERCRkYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCArPSB0aGlzLnN1cnJvZ2F0ZVNpemU7XG4gICAgICBjaGFyU3RyID0gJyc7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgPSB0aGlzLmNoYXJMZW5ndGggPSAwO1xuXG4gICAgLy8gaWYgdGhlcmUgYXJlIG5vIG1vcmUgYnl0ZXMgaW4gdGhpcyBidWZmZXIsIGp1c3QgZW1pdCBvdXIgY2hhclxuICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gY2hhclN0cjtcbiAgICB9XG4gICAgYnJlYWs7XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgYW5kIHNldCBjaGFyTGVuZ3RoIC8gY2hhclJlY2VpdmVkXG4gIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKTtcblxuICB2YXIgZW5kID0gYnVmZmVyLmxlbmd0aDtcbiAgaWYgKHRoaXMuY2hhckxlbmd0aCkge1xuICAgIC8vIGJ1ZmZlciB0aGUgaW5jb21wbGV0ZSBjaGFyYWN0ZXIgYnl0ZXMgd2UgZ290XG4gICAgYnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCAwLCBidWZmZXIubGVuZ3RoIC0gdGhpcy5jaGFyUmVjZWl2ZWQsIGVuZCk7XG4gICAgZW5kIC09IHRoaXMuY2hhclJlY2VpdmVkO1xuICB9XG5cbiAgY2hhclN0ciArPSBidWZmZXIudG9TdHJpbmcodGhpcy5lbmNvZGluZywgMCwgZW5kKTtcblxuICB2YXIgZW5kID0gY2hhclN0ci5sZW5ndGggLSAxO1xuICB2YXIgY2hhckNvZGUgPSBjaGFyU3RyLmNoYXJDb2RlQXQoZW5kKTtcbiAgLy8gQ0VTVS04OiBsZWFkIHN1cnJvZ2F0ZSAoRDgwMC1EQkZGKSBpcyBhbHNvIHRoZSBpbmNvbXBsZXRlIGNoYXJhY3RlclxuICBpZiAoY2hhckNvZGUgPj0gMHhEODAwICYmIGNoYXJDb2RlIDw9IDB4REJGRikge1xuICAgIHZhciBzaXplID0gdGhpcy5zdXJyb2dhdGVTaXplO1xuICAgIHRoaXMuY2hhckxlbmd0aCArPSBzaXplO1xuICAgIHRoaXMuY2hhclJlY2VpdmVkICs9IHNpemU7XG4gICAgdGhpcy5jaGFyQnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCBzaXplLCAwLCBzaXplKTtcbiAgICBidWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIDAsIDAsIHNpemUpO1xuICAgIHJldHVybiBjaGFyU3RyLnN1YnN0cmluZygwLCBlbmQpO1xuICB9XG5cbiAgLy8gb3IganVzdCBlbWl0IHRoZSBjaGFyU3RyXG4gIHJldHVybiBjaGFyU3RyO1xufTtcblxuLy8gZGV0ZWN0SW5jb21wbGV0ZUNoYXIgZGV0ZXJtaW5lcyBpZiB0aGVyZSBpcyBhbiBpbmNvbXBsZXRlIFVURi04IGNoYXJhY3RlciBhdFxuLy8gdGhlIGVuZCBvZiB0aGUgZ2l2ZW4gYnVmZmVyLiBJZiBzbywgaXQgc2V0cyB0aGlzLmNoYXJMZW5ndGggdG8gdGhlIGJ5dGVcbi8vIGxlbmd0aCB0aGF0IGNoYXJhY3RlciwgYW5kIHNldHMgdGhpcy5jaGFyUmVjZWl2ZWQgdG8gdGhlIG51bWJlciBvZiBieXRlc1xuLy8gdGhhdCBhcmUgYXZhaWxhYmxlIGZvciB0aGlzIGNoYXJhY3Rlci5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLmRldGVjdEluY29tcGxldGVDaGFyID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIC8vIGRldGVybWluZSBob3cgbWFueSBieXRlcyB3ZSBoYXZlIHRvIGNoZWNrIGF0IHRoZSBlbmQgb2YgdGhpcyBidWZmZXJcbiAgdmFyIGkgPSAoYnVmZmVyLmxlbmd0aCA+PSAzKSA/IDMgOiBidWZmZXIubGVuZ3RoO1xuXG4gIC8vIEZpZ3VyZSBvdXQgaWYgb25lIG9mIHRoZSBsYXN0IGkgYnl0ZXMgb2Ygb3VyIGJ1ZmZlciBhbm5vdW5jZXMgYW5cbiAgLy8gaW5jb21wbGV0ZSBjaGFyLlxuICBmb3IgKDsgaSA+IDA7IGktLSkge1xuICAgIHZhciBjID0gYnVmZmVyW2J1ZmZlci5sZW5ndGggLSBpXTtcblxuICAgIC8vIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1VURi04I0Rlc2NyaXB0aW9uXG5cbiAgICAvLyAxMTBYWFhYWFxuICAgIGlmIChpID09IDEgJiYgYyA+PiA1ID09IDB4MDYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDI7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTEwWFhYWFxuICAgIGlmIChpIDw9IDIgJiYgYyA+PiA0ID09IDB4MEUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDM7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTExMFhYWFxuICAgIGlmIChpIDw9IDMgJiYgYyA+PiAzID09IDB4MUUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDQ7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBpO1xufTtcblxuU3RyaW5nRGVjb2Rlci5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciByZXMgPSAnJztcbiAgaWYgKGJ1ZmZlciAmJiBidWZmZXIubGVuZ3RoKVxuICAgIHJlcyA9IHRoaXMud3JpdGUoYnVmZmVyKTtcblxuICBpZiAodGhpcy5jaGFyUmVjZWl2ZWQpIHtcbiAgICB2YXIgY3IgPSB0aGlzLmNoYXJSZWNlaXZlZDtcbiAgICB2YXIgYnVmID0gdGhpcy5jaGFyQnVmZmVyO1xuICAgIHZhciBlbmMgPSB0aGlzLmVuY29kaW5nO1xuICAgIHJlcyArPSBidWYuc2xpY2UoMCwgY3IpLnRvU3RyaW5nKGVuYyk7XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblxuZnVuY3Rpb24gcGFzc1Rocm91Z2hXcml0ZShidWZmZXIpIHtcbiAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZyh0aGlzLmVuY29kaW5nKTtcbn1cblxuZnVuY3Rpb24gdXRmMTZEZXRlY3RJbmNvbXBsZXRlQ2hhcihidWZmZXIpIHtcbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBidWZmZXIubGVuZ3RoICUgMjtcbiAgdGhpcy5jaGFyTGVuZ3RoID0gdGhpcy5jaGFyUmVjZWl2ZWQgPyAyIDogMDtcbn1cblxuZnVuY3Rpb24gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKSB7XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gYnVmZmVyLmxlbmd0aCAlIDM7XG4gIHRoaXMuY2hhckxlbmd0aCA9IHRoaXMuY2hhclJlY2VpdmVkID8gMyA6IDA7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxubW9kdWxlLmV4cG9ydHMgPSBSZWFkYWJsZTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuUmVhZGFibGUuUmVhZGFibGVTdGF0ZSA9IFJlYWRhYmxlU3RhdGU7XG5cbnZhciBFRSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbmlmICghRUUubGlzdGVuZXJDb3VudCkgRUUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJzKHR5cGUpLmxlbmd0aDtcbn07XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBTdHJpbmdEZWNvZGVyO1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgZGVidWcgPSByZXF1aXJlKCd1dGlsJyk7XG5pZiAoZGVidWcgJiYgZGVidWcuZGVidWdsb2cpIHtcbiAgZGVidWcgPSBkZWJ1Zy5kZWJ1Z2xvZygnc3RyZWFtJyk7XG59IGVsc2Uge1xuICBkZWJ1ZyA9IGZ1bmN0aW9uICgpIHt9O1xufVxuLyo8L3JlcGxhY2VtZW50PiovXG5cblxudXRpbC5pbmhlcml0cyhSZWFkYWJsZSwgU3RyZWFtKTtcblxuZnVuY3Rpb24gUmVhZGFibGVTdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgdmFyIER1cGxleCA9IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyB0aGUgcG9pbnQgYXQgd2hpY2ggaXQgc3RvcHMgY2FsbGluZyBfcmVhZCgpIHRvIGZpbGwgdGhlIGJ1ZmZlclxuICAvLyBOb3RlOiAwIGlzIGEgdmFsaWQgdmFsdWUsIG1lYW5zIFwiZG9uJ3QgY2FsbCBfcmVhZCBwcmVlbXB0aXZlbHkgZXZlclwiXG4gIHZhciBod20gPSBvcHRpb25zLmhpZ2hXYXRlck1hcms7XG4gIHZhciBkZWZhdWx0SHdtID0gb3B0aW9ucy5vYmplY3RNb2RlID8gMTYgOiAxNiAqIDEwMjQ7XG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IChod20gfHwgaHdtID09PSAwKSA/IGh3bSA6IGRlZmF1bHRId207XG5cbiAgLy8gY2FzdCB0byBpbnRzLlxuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSB+fnRoaXMuaGlnaFdhdGVyTWFyaztcblxuICB0aGlzLmJ1ZmZlciA9IFtdO1xuICB0aGlzLmxlbmd0aCA9IDA7XG4gIHRoaXMucGlwZXMgPSBudWxsO1xuICB0aGlzLnBpcGVzQ291bnQgPSAwO1xuICB0aGlzLmZsb3dpbmcgPSBudWxsO1xuICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gIHRoaXMuZW5kRW1pdHRlZCA9IGZhbHNlO1xuICB0aGlzLnJlYWRpbmcgPSBmYWxzZTtcblxuICAvLyBhIGZsYWcgdG8gYmUgYWJsZSB0byB0ZWxsIGlmIHRoZSBvbndyaXRlIGNiIGlzIGNhbGxlZCBpbW1lZGlhdGVseSxcbiAgLy8gb3Igb24gYSBsYXRlciB0aWNrLiAgV2Ugc2V0IHRoaXMgdG8gdHJ1ZSBhdCBmaXJzdCwgYmVjYXVzZSBhbnlcbiAgLy8gYWN0aW9ucyB0aGF0IHNob3VsZG4ndCBoYXBwZW4gdW50aWwgXCJsYXRlclwiIHNob3VsZCBnZW5lcmFsbHkgYWxzb1xuICAvLyBub3QgaGFwcGVuIGJlZm9yZSB0aGUgZmlyc3Qgd3JpdGUgY2FsbC5cbiAgdGhpcy5zeW5jID0gdHJ1ZTtcblxuICAvLyB3aGVuZXZlciB3ZSByZXR1cm4gbnVsbCwgdGhlbiB3ZSBzZXQgYSBmbGFnIHRvIHNheVxuICAvLyB0aGF0IHdlJ3JlIGF3YWl0aW5nIGEgJ3JlYWRhYmxlJyBldmVudCBlbWlzc2lvbi5cbiAgdGhpcy5uZWVkUmVhZGFibGUgPSBmYWxzZTtcbiAgdGhpcy5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcbiAgdGhpcy5yZWFkYWJsZUxpc3RlbmluZyA9IGZhbHNlO1xuXG5cbiAgLy8gb2JqZWN0IHN0cmVhbSBmbGFnLiBVc2VkIHRvIG1ha2UgcmVhZChuKSBpZ25vcmUgbiBhbmQgdG9cbiAgLy8gbWFrZSBhbGwgdGhlIGJ1ZmZlciBtZXJnaW5nIGFuZCBsZW5ndGggY2hlY2tzIGdvIGF3YXlcbiAgdGhpcy5vYmplY3RNb2RlID0gISFvcHRpb25zLm9iamVjdE1vZGU7XG5cbiAgaWYgKHN0cmVhbSBpbnN0YW5jZW9mIER1cGxleClcbiAgICB0aGlzLm9iamVjdE1vZGUgPSB0aGlzLm9iamVjdE1vZGUgfHwgISFvcHRpb25zLnJlYWRhYmxlT2JqZWN0TW9kZTtcblxuICAvLyBDcnlwdG8gaXMga2luZCBvZiBvbGQgYW5kIGNydXN0eS4gIEhpc3RvcmljYWxseSwgaXRzIGRlZmF1bHQgc3RyaW5nXG4gIC8vIGVuY29kaW5nIGlzICdiaW5hcnknIHNvIHdlIGhhdmUgdG8gbWFrZSB0aGlzIGNvbmZpZ3VyYWJsZS5cbiAgLy8gRXZlcnl0aGluZyBlbHNlIGluIHRoZSB1bml2ZXJzZSB1c2VzICd1dGY4JywgdGhvdWdoLlxuICB0aGlzLmRlZmF1bHRFbmNvZGluZyA9IG9wdGlvbnMuZGVmYXVsdEVuY29kaW5nIHx8ICd1dGY4JztcblxuICAvLyB3aGVuIHBpcGluZywgd2Ugb25seSBjYXJlIGFib3V0ICdyZWFkYWJsZScgZXZlbnRzIHRoYXQgaGFwcGVuXG4gIC8vIGFmdGVyIHJlYWQoKWluZyBhbGwgdGhlIGJ5dGVzIGFuZCBub3QgZ2V0dGluZyBhbnkgcHVzaGJhY2suXG4gIHRoaXMucmFuT3V0ID0gZmFsc2U7XG5cbiAgLy8gdGhlIG51bWJlciBvZiB3cml0ZXJzIHRoYXQgYXJlIGF3YWl0aW5nIGEgZHJhaW4gZXZlbnQgaW4gLnBpcGUoKXNcbiAgdGhpcy5hd2FpdERyYWluID0gMDtcblxuICAvLyBpZiB0cnVlLCBhIG1heWJlUmVhZE1vcmUgaGFzIGJlZW4gc2NoZWR1bGVkXG4gIHRoaXMucmVhZGluZ01vcmUgPSBmYWxzZTtcblxuICB0aGlzLmRlY29kZXIgPSBudWxsO1xuICB0aGlzLmVuY29kaW5nID0gbnVsbDtcbiAgaWYgKG9wdGlvbnMuZW5jb2RpbmcpIHtcbiAgICBpZiAoIVN0cmluZ0RlY29kZXIpXG4gICAgICBTdHJpbmdEZWNvZGVyID0gcmVxdWlyZSgnc3RyaW5nX2RlY29kZXIvJykuU3RyaW5nRGVjb2RlcjtcbiAgICB0aGlzLmRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihvcHRpb25zLmVuY29kaW5nKTtcbiAgICB0aGlzLmVuY29kaW5nID0gb3B0aW9ucy5lbmNvZGluZztcbiAgfVxufVxuXG5mdW5jdGlvbiBSZWFkYWJsZShvcHRpb25zKSB7XG4gIHZhciBEdXBsZXggPSByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFJlYWRhYmxlKSlcbiAgICByZXR1cm4gbmV3IFJlYWRhYmxlKG9wdGlvbnMpO1xuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUgPSBuZXcgUmVhZGFibGVTdGF0ZShvcHRpb25zLCB0aGlzKTtcblxuICAvLyBsZWdhY3lcbiAgdGhpcy5yZWFkYWJsZSA9IHRydWU7XG5cbiAgU3RyZWFtLmNhbGwodGhpcyk7XG59XG5cbi8vIE1hbnVhbGx5IHNob3ZlIHNvbWV0aGluZyBpbnRvIHRoZSByZWFkKCkgYnVmZmVyLlxuLy8gVGhpcyByZXR1cm5zIHRydWUgaWYgdGhlIGhpZ2hXYXRlck1hcmsgaGFzIG5vdCBiZWVuIGhpdCB5ZXQsXG4vLyBzaW1pbGFyIHRvIGhvdyBXcml0YWJsZS53cml0ZSgpIHJldHVybnMgdHJ1ZSBpZiB5b3Ugc2hvdWxkXG4vLyB3cml0ZSgpIHNvbWUgbW9yZS5cblJlYWRhYmxlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgaWYgKHV0aWwuaXNTdHJpbmcoY2h1bmspICYmICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgZW5jb2RpbmcgPSBlbmNvZGluZyB8fCBzdGF0ZS5kZWZhdWx0RW5jb2Rpbmc7XG4gICAgaWYgKGVuY29kaW5nICE9PSBzdGF0ZS5lbmNvZGluZykge1xuICAgICAgY2h1bmsgPSBuZXcgQnVmZmVyKGNodW5rLCBlbmNvZGluZyk7XG4gICAgICBlbmNvZGluZyA9ICcnO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZWFkYWJsZUFkZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGZhbHNlKTtcbn07XG5cbi8vIFVuc2hpZnQgc2hvdWxkICphbHdheXMqIGJlIHNvbWV0aGluZyBkaXJlY3RseSBvdXQgb2YgcmVhZCgpXG5SZWFkYWJsZS5wcm90b3R5cGUudW5zaGlmdCA9IGZ1bmN0aW9uKGNodW5rKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHJldHVybiByZWFkYWJsZUFkZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgJycsIHRydWUpO1xufTtcblxuZnVuY3Rpb24gcmVhZGFibGVBZGRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGFkZFRvRnJvbnQpIHtcbiAgdmFyIGVyID0gY2h1bmtJbnZhbGlkKHN0YXRlLCBjaHVuayk7XG4gIGlmIChlcikge1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgfSBlbHNlIGlmICh1dGlsLmlzTnVsbE9yVW5kZWZpbmVkKGNodW5rKSkge1xuICAgIHN0YXRlLnJlYWRpbmcgPSBmYWxzZTtcbiAgICBpZiAoIXN0YXRlLmVuZGVkKVxuICAgICAgb25Fb2ZDaHVuayhzdHJlYW0sIHN0YXRlKTtcbiAgfSBlbHNlIGlmIChzdGF0ZS5vYmplY3RNb2RlIHx8IGNodW5rICYmIGNodW5rLmxlbmd0aCA+IDApIHtcbiAgICBpZiAoc3RhdGUuZW5kZWQgJiYgIWFkZFRvRnJvbnQpIHtcbiAgICAgIHZhciBlID0gbmV3IEVycm9yKCdzdHJlYW0ucHVzaCgpIGFmdGVyIEVPRicpO1xuICAgICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZSk7XG4gICAgfSBlbHNlIGlmIChzdGF0ZS5lbmRFbWl0dGVkICYmIGFkZFRvRnJvbnQpIHtcbiAgICAgIHZhciBlID0gbmV3IEVycm9yKCdzdHJlYW0udW5zaGlmdCgpIGFmdGVyIGVuZCBldmVudCcpO1xuICAgICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFhZGRUb0Zyb250ICYmICFlbmNvZGluZylcbiAgICAgICAgY2h1bmsgPSBzdGF0ZS5kZWNvZGVyLndyaXRlKGNodW5rKTtcblxuICAgICAgaWYgKCFhZGRUb0Zyb250KVxuICAgICAgICBzdGF0ZS5yZWFkaW5nID0gZmFsc2U7XG5cbiAgICAgIC8vIGlmIHdlIHdhbnQgdGhlIGRhdGEgbm93LCBqdXN0IGVtaXQgaXQuXG4gICAgICBpZiAoc3RhdGUuZmxvd2luZyAmJiBzdGF0ZS5sZW5ndGggPT09IDAgJiYgIXN0YXRlLnN5bmMpIHtcbiAgICAgICAgc3RyZWFtLmVtaXQoJ2RhdGEnLCBjaHVuayk7XG4gICAgICAgIHN0cmVhbS5yZWFkKDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdXBkYXRlIHRoZSBidWZmZXIgaW5mby5cbiAgICAgICAgc3RhdGUubGVuZ3RoICs9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuICAgICAgICBpZiAoYWRkVG9Gcm9udClcbiAgICAgICAgICBzdGF0ZS5idWZmZXIudW5zaGlmdChjaHVuayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzdGF0ZS5idWZmZXIucHVzaChjaHVuayk7XG5cbiAgICAgICAgaWYgKHN0YXRlLm5lZWRSZWFkYWJsZSlcbiAgICAgICAgICBlbWl0UmVhZGFibGUoc3RyZWFtKTtcbiAgICAgIH1cblxuICAgICAgbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoIWFkZFRvRnJvbnQpIHtcbiAgICBzdGF0ZS5yZWFkaW5nID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gbmVlZE1vcmVEYXRhKHN0YXRlKTtcbn1cblxuXG5cbi8vIGlmIGl0J3MgcGFzdCB0aGUgaGlnaCB3YXRlciBtYXJrLCB3ZSBjYW4gcHVzaCBpbiBzb21lIG1vcmUuXG4vLyBBbHNvLCBpZiB3ZSBoYXZlIG5vIGRhdGEgeWV0LCB3ZSBjYW4gc3RhbmQgc29tZVxuLy8gbW9yZSBieXRlcy4gIFRoaXMgaXMgdG8gd29yayBhcm91bmQgY2FzZXMgd2hlcmUgaHdtPTAsXG4vLyBzdWNoIGFzIHRoZSByZXBsLiAgQWxzbywgaWYgdGhlIHB1c2goKSB0cmlnZ2VyZWQgYVxuLy8gcmVhZGFibGUgZXZlbnQsIGFuZCB0aGUgdXNlciBjYWxsZWQgcmVhZChsYXJnZU51bWJlcikgc3VjaCB0aGF0XG4vLyBuZWVkUmVhZGFibGUgd2FzIHNldCwgdGhlbiB3ZSBvdWdodCB0byBwdXNoIG1vcmUsIHNvIHRoYXQgYW5vdGhlclxuLy8gJ3JlYWRhYmxlJyBldmVudCB3aWxsIGJlIHRyaWdnZXJlZC5cbmZ1bmN0aW9uIG5lZWRNb3JlRGF0YShzdGF0ZSkge1xuICByZXR1cm4gIXN0YXRlLmVuZGVkICYmXG4gICAgICAgICAoc3RhdGUubmVlZFJlYWRhYmxlIHx8XG4gICAgICAgICAgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyayB8fFxuICAgICAgICAgIHN0YXRlLmxlbmd0aCA9PT0gMCk7XG59XG5cbi8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuUmVhZGFibGUucHJvdG90eXBlLnNldEVuY29kaW5nID0gZnVuY3Rpb24oZW5jKSB7XG4gIGlmICghU3RyaW5nRGVjb2RlcilcbiAgICBTdHJpbmdEZWNvZGVyID0gcmVxdWlyZSgnc3RyaW5nX2RlY29kZXIvJykuU3RyaW5nRGVjb2RlcjtcbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5kZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIoZW5jKTtcbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5lbmNvZGluZyA9IGVuYztcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBEb24ndCByYWlzZSB0aGUgaHdtID4gMTI4TUJcbnZhciBNQVhfSFdNID0gMHg4MDAwMDA7XG5mdW5jdGlvbiByb3VuZFVwVG9OZXh0UG93ZXJPZjIobikge1xuICBpZiAobiA+PSBNQVhfSFdNKSB7XG4gICAgbiA9IE1BWF9IV007XG4gIH0gZWxzZSB7XG4gICAgLy8gR2V0IHRoZSBuZXh0IGhpZ2hlc3QgcG93ZXIgb2YgMlxuICAgIG4tLTtcbiAgICBmb3IgKHZhciBwID0gMTsgcCA8IDMyOyBwIDw8PSAxKSBuIHw9IG4gPj4gcDtcbiAgICBuKys7XG4gIH1cbiAgcmV0dXJuIG47XG59XG5cbmZ1bmN0aW9uIGhvd011Y2hUb1JlYWQobiwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5lbmRlZClcbiAgICByZXR1cm4gMDtcblxuICBpZiAoc3RhdGUub2JqZWN0TW9kZSlcbiAgICByZXR1cm4gbiA9PT0gMCA/IDAgOiAxO1xuXG4gIGlmIChpc05hTihuKSB8fCB1dGlsLmlzTnVsbChuKSkge1xuICAgIC8vIG9ubHkgZmxvdyBvbmUgYnVmZmVyIGF0IGEgdGltZVxuICAgIGlmIChzdGF0ZS5mbG93aW5nICYmIHN0YXRlLmJ1ZmZlci5sZW5ndGgpXG4gICAgICByZXR1cm4gc3RhdGUuYnVmZmVyWzBdLmxlbmd0aDtcbiAgICBlbHNlXG4gICAgICByZXR1cm4gc3RhdGUubGVuZ3RoO1xuICB9XG5cbiAgaWYgKG4gPD0gMClcbiAgICByZXR1cm4gMDtcblxuICAvLyBJZiB3ZSdyZSBhc2tpbmcgZm9yIG1vcmUgdGhhbiB0aGUgdGFyZ2V0IGJ1ZmZlciBsZXZlbCxcbiAgLy8gdGhlbiByYWlzZSB0aGUgd2F0ZXIgbWFyay4gIEJ1bXAgdXAgdG8gdGhlIG5leHQgaGlnaGVzdFxuICAvLyBwb3dlciBvZiAyLCB0byBwcmV2ZW50IGluY3JlYXNpbmcgaXQgZXhjZXNzaXZlbHkgaW4gdGlueVxuICAvLyBhbW91bnRzLlxuICBpZiAobiA+IHN0YXRlLmhpZ2hXYXRlck1hcmspXG4gICAgc3RhdGUuaGlnaFdhdGVyTWFyayA9IHJvdW5kVXBUb05leHRQb3dlck9mMihuKTtcblxuICAvLyBkb24ndCBoYXZlIHRoYXQgbXVjaC4gIHJldHVybiBudWxsLCB1bmxlc3Mgd2UndmUgZW5kZWQuXG4gIGlmIChuID4gc3RhdGUubGVuZ3RoKSB7XG4gICAgaWYgKCFzdGF0ZS5lbmRlZCkge1xuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAgIHJldHVybiAwO1xuICAgIH0gZWxzZVxuICAgICAgcmV0dXJuIHN0YXRlLmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiBuO1xufVxuXG4vLyB5b3UgY2FuIG92ZXJyaWRlIGVpdGhlciB0aGlzIG1ldGhvZCwgb3IgdGhlIGFzeW5jIF9yZWFkKG4pIGJlbG93LlxuUmVhZGFibGUucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbihuKSB7XG4gIGRlYnVnKCdyZWFkJywgbik7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHZhciBuT3JpZyA9IG47XG5cbiAgaWYgKCF1dGlsLmlzTnVtYmVyKG4pIHx8IG4gPiAwKVxuICAgIHN0YXRlLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuXG4gIC8vIGlmIHdlJ3JlIGRvaW5nIHJlYWQoMCkgdG8gdHJpZ2dlciBhIHJlYWRhYmxlIGV2ZW50LCBidXQgd2VcbiAgLy8gYWxyZWFkeSBoYXZlIGEgYnVuY2ggb2YgZGF0YSBpbiB0aGUgYnVmZmVyLCB0aGVuIGp1c3QgdHJpZ2dlclxuICAvLyB0aGUgJ3JlYWRhYmxlJyBldmVudCBhbmQgbW92ZSBvbi5cbiAgaWYgKG4gPT09IDAgJiZcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSAmJlxuICAgICAgKHN0YXRlLmxlbmd0aCA+PSBzdGF0ZS5oaWdoV2F0ZXJNYXJrIHx8IHN0YXRlLmVuZGVkKSkge1xuICAgIGRlYnVnKCdyZWFkOiBlbWl0UmVhZGFibGUnLCBzdGF0ZS5sZW5ndGgsIHN0YXRlLmVuZGVkKTtcbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLmVuZGVkKVxuICAgICAgZW5kUmVhZGFibGUodGhpcyk7XG4gICAgZWxzZVxuICAgICAgZW1pdFJlYWRhYmxlKHRoaXMpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgbiA9IGhvd011Y2hUb1JlYWQobiwgc3RhdGUpO1xuXG4gIC8vIGlmIHdlJ3ZlIGVuZGVkLCBhbmQgd2UncmUgbm93IGNsZWFyLCB0aGVuIGZpbmlzaCBpdCB1cC5cbiAgaWYgKG4gPT09IDAgJiYgc3RhdGUuZW5kZWQpIHtcbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKVxuICAgICAgZW5kUmVhZGFibGUodGhpcyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBBbGwgdGhlIGFjdHVhbCBjaHVuayBnZW5lcmF0aW9uIGxvZ2ljIG5lZWRzIHRvIGJlXG4gIC8vICpiZWxvdyogdGhlIGNhbGwgdG8gX3JlYWQuICBUaGUgcmVhc29uIGlzIHRoYXQgaW4gY2VydGFpblxuICAvLyBzeW50aGV0aWMgc3RyZWFtIGNhc2VzLCBzdWNoIGFzIHBhc3N0aHJvdWdoIHN0cmVhbXMsIF9yZWFkXG4gIC8vIG1heSBiZSBhIGNvbXBsZXRlbHkgc3luY2hyb25vdXMgb3BlcmF0aW9uIHdoaWNoIG1heSBjaGFuZ2VcbiAgLy8gdGhlIHN0YXRlIG9mIHRoZSByZWFkIGJ1ZmZlciwgcHJvdmlkaW5nIGVub3VnaCBkYXRhIHdoZW5cbiAgLy8gYmVmb3JlIHRoZXJlIHdhcyAqbm90KiBlbm91Z2guXG4gIC8vXG4gIC8vIFNvLCB0aGUgc3RlcHMgYXJlOlxuICAvLyAxLiBGaWd1cmUgb3V0IHdoYXQgdGhlIHN0YXRlIG9mIHRoaW5ncyB3aWxsIGJlIGFmdGVyIHdlIGRvXG4gIC8vIGEgcmVhZCBmcm9tIHRoZSBidWZmZXIuXG4gIC8vXG4gIC8vIDIuIElmIHRoYXQgcmVzdWx0aW5nIHN0YXRlIHdpbGwgdHJpZ2dlciBhIF9yZWFkLCB0aGVuIGNhbGwgX3JlYWQuXG4gIC8vIE5vdGUgdGhhdCB0aGlzIG1heSBiZSBhc3luY2hyb25vdXMsIG9yIHN5bmNocm9ub3VzLiAgWWVzLCBpdCBpc1xuICAvLyBkZWVwbHkgdWdseSB0byB3cml0ZSBBUElzIHRoaXMgd2F5LCBidXQgdGhhdCBzdGlsbCBkb2Vzbid0IG1lYW5cbiAgLy8gdGhhdCB0aGUgUmVhZGFibGUgY2xhc3Mgc2hvdWxkIGJlaGF2ZSBpbXByb3Blcmx5LCBhcyBzdHJlYW1zIGFyZVxuICAvLyBkZXNpZ25lZCB0byBiZSBzeW5jL2FzeW5jIGFnbm9zdGljLlxuICAvLyBUYWtlIG5vdGUgaWYgdGhlIF9yZWFkIGNhbGwgaXMgc3luYyBvciBhc3luYyAoaWUsIGlmIHRoZSByZWFkIGNhbGxcbiAgLy8gaGFzIHJldHVybmVkIHlldCksIHNvIHRoYXQgd2Uga25vdyB3aGV0aGVyIG9yIG5vdCBpdCdzIHNhZmUgdG8gZW1pdFxuICAvLyAncmVhZGFibGUnIGV0Yy5cbiAgLy9cbiAgLy8gMy4gQWN0dWFsbHkgcHVsbCB0aGUgcmVxdWVzdGVkIGNodW5rcyBvdXQgb2YgdGhlIGJ1ZmZlciBhbmQgcmV0dXJuLlxuXG4gIC8vIGlmIHdlIG5lZWQgYSByZWFkYWJsZSBldmVudCwgdGhlbiB3ZSBuZWVkIHRvIGRvIHNvbWUgcmVhZGluZy5cbiAgdmFyIGRvUmVhZCA9IHN0YXRlLm5lZWRSZWFkYWJsZTtcbiAgZGVidWcoJ25lZWQgcmVhZGFibGUnLCBkb1JlYWQpO1xuXG4gIC8vIGlmIHdlIGN1cnJlbnRseSBoYXZlIGxlc3MgdGhhbiB0aGUgaGlnaFdhdGVyTWFyaywgdGhlbiBhbHNvIHJlYWQgc29tZVxuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwIHx8IHN0YXRlLmxlbmd0aCAtIG4gPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgZG9SZWFkID0gdHJ1ZTtcbiAgICBkZWJ1ZygnbGVuZ3RoIGxlc3MgdGhhbiB3YXRlcm1hcmsnLCBkb1JlYWQpO1xuICB9XG5cbiAgLy8gaG93ZXZlciwgaWYgd2UndmUgZW5kZWQsIHRoZW4gdGhlcmUncyBubyBwb2ludCwgYW5kIGlmIHdlJ3JlIGFscmVhZHlcbiAgLy8gcmVhZGluZywgdGhlbiBpdCdzIHVubmVjZXNzYXJ5LlxuICBpZiAoc3RhdGUuZW5kZWQgfHwgc3RhdGUucmVhZGluZykge1xuICAgIGRvUmVhZCA9IGZhbHNlO1xuICAgIGRlYnVnKCdyZWFkaW5nIG9yIGVuZGVkJywgZG9SZWFkKTtcbiAgfVxuXG4gIGlmIChkb1JlYWQpIHtcbiAgICBkZWJ1ZygnZG8gcmVhZCcpO1xuICAgIHN0YXRlLnJlYWRpbmcgPSB0cnVlO1xuICAgIHN0YXRlLnN5bmMgPSB0cnVlO1xuICAgIC8vIGlmIHRoZSBsZW5ndGggaXMgY3VycmVudGx5IHplcm8sIHRoZW4gd2UgKm5lZWQqIGEgcmVhZGFibGUgZXZlbnQuXG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMClcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgLy8gY2FsbCBpbnRlcm5hbCByZWFkIG1ldGhvZFxuICAgIHRoaXMuX3JlYWQoc3RhdGUuaGlnaFdhdGVyTWFyayk7XG4gICAgc3RhdGUuc3luYyA9IGZhbHNlO1xuICB9XG5cbiAgLy8gSWYgX3JlYWQgcHVzaGVkIGRhdGEgc3luY2hyb25vdXNseSwgdGhlbiBgcmVhZGluZ2Agd2lsbCBiZSBmYWxzZSxcbiAgLy8gYW5kIHdlIG5lZWQgdG8gcmUtZXZhbHVhdGUgaG93IG11Y2ggZGF0YSB3ZSBjYW4gcmV0dXJuIHRvIHRoZSB1c2VyLlxuICBpZiAoZG9SZWFkICYmICFzdGF0ZS5yZWFkaW5nKVxuICAgIG4gPSBob3dNdWNoVG9SZWFkKG5PcmlnLCBzdGF0ZSk7XG5cbiAgdmFyIHJldDtcbiAgaWYgKG4gPiAwKVxuICAgIHJldCA9IGZyb21MaXN0KG4sIHN0YXRlKTtcbiAgZWxzZVxuICAgIHJldCA9IG51bGw7XG5cbiAgaWYgKHV0aWwuaXNOdWxsKHJldCkpIHtcbiAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIG4gPSAwO1xuICB9XG5cbiAgc3RhdGUubGVuZ3RoIC09IG47XG5cbiAgLy8gSWYgd2UgaGF2ZSBub3RoaW5nIGluIHRoZSBidWZmZXIsIHRoZW4gd2Ugd2FudCB0byBrbm93XG4gIC8vIGFzIHNvb24gYXMgd2UgKmRvKiBnZXQgc29tZXRoaW5nIGludG8gdGhlIGJ1ZmZlci5cbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiAhc3RhdGUuZW5kZWQpXG4gICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcblxuICAvLyBJZiB3ZSB0cmllZCB0byByZWFkKCkgcGFzdCB0aGUgRU9GLCB0aGVuIGVtaXQgZW5kIG9uIHRoZSBuZXh0IHRpY2suXG4gIGlmIChuT3JpZyAhPT0gbiAmJiBzdGF0ZS5lbmRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgZW5kUmVhZGFibGUodGhpcyk7XG5cbiAgaWYgKCF1dGlsLmlzTnVsbChyZXQpKVxuICAgIHRoaXMuZW1pdCgnZGF0YScsIHJldCk7XG5cbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGNodW5rSW52YWxpZChzdGF0ZSwgY2h1bmspIHtcbiAgdmFyIGVyID0gbnVsbDtcbiAgaWYgKCF1dGlsLmlzQnVmZmVyKGNodW5rKSAmJlxuICAgICAgIXV0aWwuaXNTdHJpbmcoY2h1bmspICYmXG4gICAgICAhdXRpbC5pc051bGxPclVuZGVmaW5lZChjaHVuaykgJiZcbiAgICAgICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgZXIgPSBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIG5vbi1zdHJpbmcvYnVmZmVyIGNodW5rJyk7XG4gIH1cbiAgcmV0dXJuIGVyO1xufVxuXG5cbmZ1bmN0aW9uIG9uRW9mQ2h1bmsoc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUuZGVjb2RlciAmJiAhc3RhdGUuZW5kZWQpIHtcbiAgICB2YXIgY2h1bmsgPSBzdGF0ZS5kZWNvZGVyLmVuZCgpO1xuICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpIHtcbiAgICAgIHN0YXRlLmJ1ZmZlci5wdXNoKGNodW5rKTtcbiAgICAgIHN0YXRlLmxlbmd0aCArPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcbiAgICB9XG4gIH1cbiAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuXG4gIC8vIGVtaXQgJ3JlYWRhYmxlJyBub3cgdG8gbWFrZSBzdXJlIGl0IGdldHMgcGlja2VkIHVwLlxuICBlbWl0UmVhZGFibGUoc3RyZWFtKTtcbn1cblxuLy8gRG9uJ3QgZW1pdCByZWFkYWJsZSByaWdodCBhd2F5IGluIHN5bmMgbW9kZSwgYmVjYXVzZSB0aGlzIGNhbiB0cmlnZ2VyXG4vLyBhbm90aGVyIHJlYWQoKSBjYWxsID0+IHN0YWNrIG92ZXJmbG93LiAgVGhpcyB3YXksIGl0IG1pZ2h0IHRyaWdnZXJcbi8vIGEgbmV4dFRpY2sgcmVjdXJzaW9uIHdhcm5pbmcsIGJ1dCB0aGF0J3Mgbm90IHNvIGJhZC5cbmZ1bmN0aW9uIGVtaXRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuICBzdGF0ZS5uZWVkUmVhZGFibGUgPSBmYWxzZTtcbiAgaWYgKCFzdGF0ZS5lbWl0dGVkUmVhZGFibGUpIHtcbiAgICBkZWJ1ZygnZW1pdFJlYWRhYmxlJywgc3RhdGUuZmxvd2luZyk7XG4gICAgc3RhdGUuZW1pdHRlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICBpZiAoc3RhdGUuc3luYylcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgIGVtaXRSZWFkYWJsZV8oc3RyZWFtKTtcbiAgICAgIH0pO1xuICAgIGVsc2VcbiAgICAgIGVtaXRSZWFkYWJsZV8oc3RyZWFtKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbWl0UmVhZGFibGVfKHN0cmVhbSkge1xuICBkZWJ1ZygnZW1pdCByZWFkYWJsZScpO1xuICBzdHJlYW0uZW1pdCgncmVhZGFibGUnKTtcbiAgZmxvdyhzdHJlYW0pO1xufVxuXG5cbi8vIGF0IHRoaXMgcG9pbnQsIHRoZSB1c2VyIGhhcyBwcmVzdW1hYmx5IHNlZW4gdGhlICdyZWFkYWJsZScgZXZlbnQsXG4vLyBhbmQgY2FsbGVkIHJlYWQoKSB0byBjb25zdW1lIHNvbWUgZGF0YS4gIHRoYXQgbWF5IGhhdmUgdHJpZ2dlcmVkXG4vLyBpbiB0dXJuIGFub3RoZXIgX3JlYWQobikgY2FsbCwgaW4gd2hpY2ggY2FzZSByZWFkaW5nID0gdHJ1ZSBpZlxuLy8gaXQncyBpbiBwcm9ncmVzcy5cbi8vIEhvd2V2ZXIsIGlmIHdlJ3JlIG5vdCBlbmRlZCwgb3IgcmVhZGluZywgYW5kIHRoZSBsZW5ndGggPCBod20sXG4vLyB0aGVuIGdvIGFoZWFkIGFuZCB0cnkgdG8gcmVhZCBzb21lIG1vcmUgcHJlZW1wdGl2ZWx5LlxuZnVuY3Rpb24gbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucmVhZGluZ01vcmUpIHtcbiAgICBzdGF0ZS5yZWFkaW5nTW9yZSA9IHRydWU7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgIG1heWJlUmVhZE1vcmVfKHN0cmVhbSwgc3RhdGUpO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1heWJlUmVhZE1vcmVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgdmFyIGxlbiA9IHN0YXRlLmxlbmd0aDtcbiAgd2hpbGUgKCFzdGF0ZS5yZWFkaW5nICYmICFzdGF0ZS5mbG93aW5nICYmICFzdGF0ZS5lbmRlZCAmJlxuICAgICAgICAgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRlYnVnKCdtYXliZVJlYWRNb3JlIHJlYWQgMCcpO1xuICAgIHN0cmVhbS5yZWFkKDApO1xuICAgIGlmIChsZW4gPT09IHN0YXRlLmxlbmd0aClcbiAgICAgIC8vIGRpZG4ndCBnZXQgYW55IGRhdGEsIHN0b3Agc3Bpbm5pbmcuXG4gICAgICBicmVhaztcbiAgICBlbHNlXG4gICAgICBsZW4gPSBzdGF0ZS5sZW5ndGg7XG4gIH1cbiAgc3RhdGUucmVhZGluZ01vcmUgPSBmYWxzZTtcbn1cblxuLy8gYWJzdHJhY3QgbWV0aG9kLiAgdG8gYmUgb3ZlcnJpZGRlbiBpbiBzcGVjaWZpYyBpbXBsZW1lbnRhdGlvbiBjbGFzc2VzLlxuLy8gY2FsbCBjYihlciwgZGF0YSkgd2hlcmUgZGF0YSBpcyA8PSBuIGluIGxlbmd0aC5cbi8vIGZvciB2aXJ0dWFsIChub24tc3RyaW5nLCBub24tYnVmZmVyKSBzdHJlYW1zLCBcImxlbmd0aFwiIGlzIHNvbWV3aGF0XG4vLyBhcmJpdHJhcnksIGFuZCBwZXJoYXBzIG5vdCB2ZXJ5IG1lYW5pbmdmdWwuXG5SZWFkYWJsZS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcbn07XG5cblJlYWRhYmxlLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24oZGVzdCwgcGlwZU9wdHMpIHtcbiAgdmFyIHNyYyA9IHRoaXM7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgc3dpdGNoIChzdGF0ZS5waXBlc0NvdW50KSB7XG4gICAgY2FzZSAwOlxuICAgICAgc3RhdGUucGlwZXMgPSBkZXN0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxOlxuICAgICAgc3RhdGUucGlwZXMgPSBbc3RhdGUucGlwZXMsIGRlc3RdO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHN0YXRlLnBpcGVzLnB1c2goZGVzdCk7XG4gICAgICBicmVhaztcbiAgfVxuICBzdGF0ZS5waXBlc0NvdW50ICs9IDE7XG4gIGRlYnVnKCdwaXBlIGNvdW50PSVkIG9wdHM9JWonLCBzdGF0ZS5waXBlc0NvdW50LCBwaXBlT3B0cyk7XG5cbiAgdmFyIGRvRW5kID0gKCFwaXBlT3B0cyB8fCBwaXBlT3B0cy5lbmQgIT09IGZhbHNlKSAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZG91dCAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZGVycjtcblxuICB2YXIgZW5kRm4gPSBkb0VuZCA/IG9uZW5kIDogY2xlYW51cDtcbiAgaWYgKHN0YXRlLmVuZEVtaXR0ZWQpXG4gICAgcHJvY2Vzcy5uZXh0VGljayhlbmRGbik7XG4gIGVsc2VcbiAgICBzcmMub25jZSgnZW5kJywgZW5kRm4pO1xuXG4gIGRlc3Qub24oJ3VucGlwZScsIG9udW5waXBlKTtcbiAgZnVuY3Rpb24gb251bnBpcGUocmVhZGFibGUpIHtcbiAgICBkZWJ1Zygnb251bnBpcGUnKTtcbiAgICBpZiAocmVhZGFibGUgPT09IHNyYykge1xuICAgICAgY2xlYW51cCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uZW5kKCkge1xuICAgIGRlYnVnKCdvbmVuZCcpO1xuICAgIGRlc3QuZW5kKCk7XG4gIH1cblxuICAvLyB3aGVuIHRoZSBkZXN0IGRyYWlucywgaXQgcmVkdWNlcyB0aGUgYXdhaXREcmFpbiBjb3VudGVyXG4gIC8vIG9uIHRoZSBzb3VyY2UuICBUaGlzIHdvdWxkIGJlIG1vcmUgZWxlZ2FudCB3aXRoIGEgLm9uY2UoKVxuICAvLyBoYW5kbGVyIGluIGZsb3coKSwgYnV0IGFkZGluZyBhbmQgcmVtb3ZpbmcgcmVwZWF0ZWRseSBpc1xuICAvLyB0b28gc2xvdy5cbiAgdmFyIG9uZHJhaW4gPSBwaXBlT25EcmFpbihzcmMpO1xuICBkZXN0Lm9uKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgZGVidWcoJ2NsZWFudXAnKTtcbiAgICAvLyBjbGVhbnVwIGV2ZW50IGhhbmRsZXJzIG9uY2UgdGhlIHBpcGUgaXMgYnJva2VuXG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZHJhaW4nLCBvbmRyYWluKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ3VucGlwZScsIG9udW5waXBlKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIG9uZW5kKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIGNsZWFudXApO1xuICAgIHNyYy5yZW1vdmVMaXN0ZW5lcignZGF0YScsIG9uZGF0YSk7XG5cbiAgICAvLyBpZiB0aGUgcmVhZGVyIGlzIHdhaXRpbmcgZm9yIGEgZHJhaW4gZXZlbnQgZnJvbSB0aGlzXG4gICAgLy8gc3BlY2lmaWMgd3JpdGVyLCB0aGVuIGl0IHdvdWxkIGNhdXNlIGl0IHRvIG5ldmVyIHN0YXJ0XG4gICAgLy8gZmxvd2luZyBhZ2Fpbi5cbiAgICAvLyBTbywgaWYgdGhpcyBpcyBhd2FpdGluZyBhIGRyYWluLCB0aGVuIHdlIGp1c3QgY2FsbCBpdCBub3cuXG4gICAgLy8gSWYgd2UgZG9uJ3Qga25vdywgdGhlbiBhc3N1bWUgdGhhdCB3ZSBhcmUgd2FpdGluZyBmb3Igb25lLlxuICAgIGlmIChzdGF0ZS5hd2FpdERyYWluICYmXG4gICAgICAgICghZGVzdC5fd3JpdGFibGVTdGF0ZSB8fCBkZXN0Ll93cml0YWJsZVN0YXRlLm5lZWREcmFpbikpXG4gICAgICBvbmRyYWluKCk7XG4gIH1cblxuICBzcmMub24oJ2RhdGEnLCBvbmRhdGEpO1xuICBmdW5jdGlvbiBvbmRhdGEoY2h1bmspIHtcbiAgICBkZWJ1Zygnb25kYXRhJyk7XG4gICAgdmFyIHJldCA9IGRlc3Qud3JpdGUoY2h1bmspO1xuICAgIGlmIChmYWxzZSA9PT0gcmV0KSB7XG4gICAgICBkZWJ1ZygnZmFsc2Ugd3JpdGUgcmVzcG9uc2UsIHBhdXNlJyxcbiAgICAgICAgICAgIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKTtcbiAgICAgIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKys7XG4gICAgICBzcmMucGF1c2UoKTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgZGVzdCBoYXMgYW4gZXJyb3IsIHRoZW4gc3RvcCBwaXBpbmcgaW50byBpdC5cbiAgLy8gaG93ZXZlciwgZG9uJ3Qgc3VwcHJlc3MgdGhlIHRocm93aW5nIGJlaGF2aW9yIGZvciB0aGlzLlxuICBmdW5jdGlvbiBvbmVycm9yKGVyKSB7XG4gICAgZGVidWcoJ29uZXJyb3InLCBlcik7XG4gICAgdW5waXBlKCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBpZiAoRUUubGlzdGVuZXJDb3VudChkZXN0LCAnZXJyb3InKSA9PT0gMClcbiAgICAgIGRlc3QuZW1pdCgnZXJyb3InLCBlcik7XG4gIH1cbiAgLy8gVGhpcyBpcyBhIGJydXRhbGx5IHVnbHkgaGFjayB0byBtYWtlIHN1cmUgdGhhdCBvdXIgZXJyb3IgaGFuZGxlclxuICAvLyBpcyBhdHRhY2hlZCBiZWZvcmUgYW55IHVzZXJsYW5kIG9uZXMuICBORVZFUiBETyBUSElTLlxuICBpZiAoIWRlc3QuX2V2ZW50cyB8fCAhZGVzdC5fZXZlbnRzLmVycm9yKVxuICAgIGRlc3Qub24oJ2Vycm9yJywgb25lcnJvcik7XG4gIGVsc2UgaWYgKGlzQXJyYXkoZGVzdC5fZXZlbnRzLmVycm9yKSlcbiAgICBkZXN0Ll9ldmVudHMuZXJyb3IudW5zaGlmdChvbmVycm9yKTtcbiAgZWxzZVxuICAgIGRlc3QuX2V2ZW50cy5lcnJvciA9IFtvbmVycm9yLCBkZXN0Ll9ldmVudHMuZXJyb3JdO1xuXG5cblxuICAvLyBCb3RoIGNsb3NlIGFuZCBmaW5pc2ggc2hvdWxkIHRyaWdnZXIgdW5waXBlLCBidXQgb25seSBvbmNlLlxuICBmdW5jdGlvbiBvbmNsb3NlKCkge1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2ZpbmlzaCcsIG9uZmluaXNoKTtcbiAgICB1bnBpcGUoKTtcbiAgfVxuICBkZXN0Lm9uY2UoJ2Nsb3NlJywgb25jbG9zZSk7XG4gIGZ1bmN0aW9uIG9uZmluaXNoKCkge1xuICAgIGRlYnVnKCdvbmZpbmlzaCcpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG4gICAgdW5waXBlKCk7XG4gIH1cbiAgZGVzdC5vbmNlKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG5cbiAgZnVuY3Rpb24gdW5waXBlKCkge1xuICAgIGRlYnVnKCd1bnBpcGUnKTtcbiAgICBzcmMudW5waXBlKGRlc3QpO1xuICB9XG5cbiAgLy8gdGVsbCB0aGUgZGVzdCB0aGF0IGl0J3MgYmVpbmcgcGlwZWQgdG9cbiAgZGVzdC5lbWl0KCdwaXBlJywgc3JjKTtcblxuICAvLyBzdGFydCB0aGUgZmxvdyBpZiBpdCBoYXNuJ3QgYmVlbiBzdGFydGVkIGFscmVhZHkuXG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdwaXBlIHJlc3VtZScpO1xuICAgIHNyYy5yZXN1bWUoKTtcbiAgfVxuXG4gIHJldHVybiBkZXN0O1xufTtcblxuZnVuY3Rpb24gcGlwZU9uRHJhaW4oc3JjKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhdGUgPSBzcmMuX3JlYWRhYmxlU3RhdGU7XG4gICAgZGVidWcoJ3BpcGVPbkRyYWluJywgc3RhdGUuYXdhaXREcmFpbik7XG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4pXG4gICAgICBzdGF0ZS5hd2FpdERyYWluLS07XG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4gPT09IDAgJiYgRUUubGlzdGVuZXJDb3VudChzcmMsICdkYXRhJykpIHtcbiAgICAgIHN0YXRlLmZsb3dpbmcgPSB0cnVlO1xuICAgICAgZmxvdyhzcmMpO1xuICAgIH1cbiAgfTtcbn1cblxuXG5SZWFkYWJsZS5wcm90b3R5cGUudW5waXBlID0gZnVuY3Rpb24oZGVzdCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIGlmIHdlJ3JlIG5vdCBwaXBpbmcgYW55d2hlcmUsIHRoZW4gZG8gbm90aGluZy5cbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDApXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8ganVzdCBvbmUgZGVzdGluYXRpb24uICBtb3N0IGNvbW1vbiBjYXNlLlxuICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSkge1xuICAgIC8vIHBhc3NlZCBpbiBvbmUsIGJ1dCBpdCdzIG5vdCB0aGUgcmlnaHQgb25lLlxuICAgIGlmIChkZXN0ICYmIGRlc3QgIT09IHN0YXRlLnBpcGVzKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAoIWRlc3QpXG4gICAgICBkZXN0ID0gc3RhdGUucGlwZXM7XG5cbiAgICAvLyBnb3QgYSBtYXRjaC5cbiAgICBzdGF0ZS5waXBlcyA9IG51bGw7XG4gICAgc3RhdGUucGlwZXNDb3VudCA9IDA7XG4gICAgc3RhdGUuZmxvd2luZyA9IGZhbHNlO1xuICAgIGlmIChkZXN0KVxuICAgICAgZGVzdC5lbWl0KCd1bnBpcGUnLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHNsb3cgY2FzZS4gbXVsdGlwbGUgcGlwZSBkZXN0aW5hdGlvbnMuXG5cbiAgaWYgKCFkZXN0KSB7XG4gICAgLy8gcmVtb3ZlIGFsbC5cbiAgICB2YXIgZGVzdHMgPSBzdGF0ZS5waXBlcztcbiAgICB2YXIgbGVuID0gc3RhdGUucGlwZXNDb3VudDtcbiAgICBzdGF0ZS5waXBlcyA9IG51bGw7XG4gICAgc3RhdGUucGlwZXNDb3VudCA9IDA7XG4gICAgc3RhdGUuZmxvd2luZyA9IGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGRlc3RzW2ldLmVtaXQoJ3VucGlwZScsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gdHJ5IHRvIGZpbmQgdGhlIHJpZ2h0IG9uZS5cbiAgdmFyIGkgPSBpbmRleE9mKHN0YXRlLnBpcGVzLCBkZXN0KTtcbiAgaWYgKGkgPT09IC0xKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIHN0YXRlLnBpcGVzLnNwbGljZShpLCAxKTtcbiAgc3RhdGUucGlwZXNDb3VudCAtPSAxO1xuICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSlcbiAgICBzdGF0ZS5waXBlcyA9IHN0YXRlLnBpcGVzWzBdO1xuXG4gIGRlc3QuZW1pdCgndW5waXBlJywgdGhpcyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBzZXQgdXAgZGF0YSBldmVudHMgaWYgdGhleSBhcmUgYXNrZWQgZm9yXG4vLyBFbnN1cmUgcmVhZGFibGUgbGlzdGVuZXJzIGV2ZW50dWFsbHkgZ2V0IHNvbWV0aGluZ1xuUmVhZGFibGUucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXYsIGZuKSB7XG4gIHZhciByZXMgPSBTdHJlYW0ucHJvdG90eXBlLm9uLmNhbGwodGhpcywgZXYsIGZuKTtcblxuICAvLyBJZiBsaXN0ZW5pbmcgdG8gZGF0YSwgYW5kIGl0IGhhcyBub3QgZXhwbGljaXRseSBiZWVuIHBhdXNlZCxcbiAgLy8gdGhlbiBjYWxsIHJlc3VtZSB0byBzdGFydCB0aGUgZmxvdyBvZiBkYXRhIG9uIHRoZSBuZXh0IHRpY2suXG4gIGlmIChldiA9PT0gJ2RhdGEnICYmIGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICB0aGlzLnJlc3VtZSgpO1xuICB9XG5cbiAgaWYgKGV2ID09PSAncmVhZGFibGUnICYmIHRoaXMucmVhZGFibGUpIHtcbiAgICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICAgIGlmICghc3RhdGUucmVhZGFibGVMaXN0ZW5pbmcpIHtcbiAgICAgIHN0YXRlLnJlYWRhYmxlTGlzdGVuaW5nID0gdHJ1ZTtcbiAgICAgIHN0YXRlLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAgIGlmICghc3RhdGUucmVhZGluZykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZGVidWcoJ3JlYWRhYmxlIG5leHR0aWNrIHJlYWQgMCcpO1xuICAgICAgICAgIHNlbGYucmVhZCgwKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlLmxlbmd0aCkge1xuICAgICAgICBlbWl0UmVhZGFibGUodGhpcywgc3RhdGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXM7XG59O1xuUmVhZGFibGUucHJvdG90eXBlLmFkZExpc3RlbmVyID0gUmVhZGFibGUucHJvdG90eXBlLm9uO1xuXG4vLyBwYXVzZSgpIGFuZCByZXN1bWUoKSBhcmUgcmVtbmFudHMgb2YgdGhlIGxlZ2FjeSByZWFkYWJsZSBzdHJlYW0gQVBJXG4vLyBJZiB0aGUgdXNlciB1c2VzIHRoZW0sIHRoZW4gc3dpdGNoIGludG8gb2xkIG1vZGUuXG5SZWFkYWJsZS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdyZXN1bWUnKTtcbiAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICBpZiAoIXN0YXRlLnJlYWRpbmcpIHtcbiAgICAgIGRlYnVnKCdyZXN1bWUgcmVhZCAwJyk7XG4gICAgICB0aGlzLnJlYWQoMCk7XG4gICAgfVxuICAgIHJlc3VtZSh0aGlzLCBzdGF0ZSk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiByZXN1bWUoc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoIXN0YXRlLnJlc3VtZVNjaGVkdWxlZCkge1xuICAgIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IHRydWU7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgIHJlc3VtZV8oc3RyZWFtLCBzdGF0ZSk7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVzdW1lXyhzdHJlYW0sIHN0YXRlKSB7XG4gIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IGZhbHNlO1xuICBzdHJlYW0uZW1pdCgncmVzdW1lJyk7XG4gIGZsb3coc3RyZWFtKTtcbiAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgIXN0YXRlLnJlYWRpbmcpXG4gICAgc3RyZWFtLnJlYWQoMCk7XG59XG5cblJlYWRhYmxlLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICBkZWJ1ZygnY2FsbCBwYXVzZSBmbG93aW5nPSVqJywgdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKTtcbiAgaWYgKGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGF1c2UnKTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ3BhdXNlJyk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiBmbG93KHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIGRlYnVnKCdmbG93Jywgc3RhdGUuZmxvd2luZyk7XG4gIGlmIChzdGF0ZS5mbG93aW5nKSB7XG4gICAgZG8ge1xuICAgICAgdmFyIGNodW5rID0gc3RyZWFtLnJlYWQoKTtcbiAgICB9IHdoaWxlIChudWxsICE9PSBjaHVuayAmJiBzdGF0ZS5mbG93aW5nKTtcbiAgfVxufVxuXG4vLyB3cmFwIGFuIG9sZC1zdHlsZSBzdHJlYW0gYXMgdGhlIGFzeW5jIGRhdGEgc291cmNlLlxuLy8gVGhpcyBpcyAqbm90KiBwYXJ0IG9mIHRoZSByZWFkYWJsZSBzdHJlYW0gaW50ZXJmYWNlLlxuLy8gSXQgaXMgYW4gdWdseSB1bmZvcnR1bmF0ZSBtZXNzIG9mIGhpc3RvcnkuXG5SZWFkYWJsZS5wcm90b3R5cGUud3JhcCA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICB2YXIgcGF1c2VkID0gZmFsc2U7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uKCkge1xuICAgIGRlYnVnKCd3cmFwcGVkIGVuZCcpO1xuICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFzdGF0ZS5lbmRlZCkge1xuICAgICAgdmFyIGNodW5rID0gc3RhdGUuZGVjb2Rlci5lbmQoKTtcbiAgICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpXG4gICAgICAgIHNlbGYucHVzaChjaHVuayk7XG4gICAgfVxuXG4gICAgc2VsZi5wdXNoKG51bGwpO1xuICB9KTtcblxuICBzdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihjaHVuaykge1xuICAgIGRlYnVnKCd3cmFwcGVkIGRhdGEnKTtcbiAgICBpZiAoc3RhdGUuZGVjb2RlcilcbiAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG4gICAgaWYgKCFjaHVuayB8fCAhc3RhdGUub2JqZWN0TW9kZSAmJiAhY2h1bmsubGVuZ3RoKVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIHJldCA9IHNlbGYucHVzaChjaHVuayk7XG4gICAgaWYgKCFyZXQpIHtcbiAgICAgIHBhdXNlZCA9IHRydWU7XG4gICAgICBzdHJlYW0ucGF1c2UoKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIHByb3h5IGFsbCB0aGUgb3RoZXIgbWV0aG9kcy5cbiAgLy8gaW1wb3J0YW50IHdoZW4gd3JhcHBpbmcgZmlsdGVycyBhbmQgZHVwbGV4ZXMuXG4gIGZvciAodmFyIGkgaW4gc3RyZWFtKSB7XG4gICAgaWYgKHV0aWwuaXNGdW5jdGlvbihzdHJlYW1baV0pICYmIHV0aWwuaXNVbmRlZmluZWQodGhpc1tpXSkpIHtcbiAgICAgIHRoaXNbaV0gPSBmdW5jdGlvbihtZXRob2QpIHsgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc3RyZWFtW21ldGhvZF0uYXBwbHkoc3RyZWFtLCBhcmd1bWVudHMpO1xuICAgICAgfX0oaSk7XG4gICAgfVxuICB9XG5cbiAgLy8gcHJveHkgY2VydGFpbiBpbXBvcnRhbnQgZXZlbnRzLlxuICB2YXIgZXZlbnRzID0gWydlcnJvcicsICdjbG9zZScsICdkZXN0cm95JywgJ3BhdXNlJywgJ3Jlc3VtZSddO1xuICBmb3JFYWNoKGV2ZW50cywgZnVuY3Rpb24oZXYpIHtcbiAgICBzdHJlYW0ub24oZXYsIHNlbGYuZW1pdC5iaW5kKHNlbGYsIGV2KSk7XG4gIH0pO1xuXG4gIC8vIHdoZW4gd2UgdHJ5IHRvIGNvbnN1bWUgc29tZSBtb3JlIGJ5dGVzLCBzaW1wbHkgdW5wYXVzZSB0aGVcbiAgLy8gdW5kZXJseWluZyBzdHJlYW0uXG4gIHNlbGYuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gICAgZGVidWcoJ3dyYXBwZWQgX3JlYWQnLCBuKTtcbiAgICBpZiAocGF1c2VkKSB7XG4gICAgICBwYXVzZWQgPSBmYWxzZTtcbiAgICAgIHN0cmVhbS5yZXN1bWUoKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIHNlbGY7XG59O1xuXG5cblxuLy8gZXhwb3NlZCBmb3IgdGVzdGluZyBwdXJwb3NlcyBvbmx5LlxuUmVhZGFibGUuX2Zyb21MaXN0ID0gZnJvbUxpc3Q7XG5cbi8vIFBsdWNrIG9mZiBuIGJ5dGVzIGZyb20gYW4gYXJyYXkgb2YgYnVmZmVycy5cbi8vIExlbmd0aCBpcyB0aGUgY29tYmluZWQgbGVuZ3RocyBvZiBhbGwgdGhlIGJ1ZmZlcnMgaW4gdGhlIGxpc3QuXG5mdW5jdGlvbiBmcm9tTGlzdChuLCBzdGF0ZSkge1xuICB2YXIgbGlzdCA9IHN0YXRlLmJ1ZmZlcjtcbiAgdmFyIGxlbmd0aCA9IHN0YXRlLmxlbmd0aDtcbiAgdmFyIHN0cmluZ01vZGUgPSAhIXN0YXRlLmRlY29kZXI7XG4gIHZhciBvYmplY3RNb2RlID0gISFzdGF0ZS5vYmplY3RNb2RlO1xuICB2YXIgcmV0O1xuXG4gIC8vIG5vdGhpbmcgaW4gdGhlIGxpc3QsIGRlZmluaXRlbHkgZW1wdHkuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMClcbiAgICByZXR1cm4gbnVsbDtcblxuICBpZiAobGVuZ3RoID09PSAwKVxuICAgIHJldCA9IG51bGw7XG4gIGVsc2UgaWYgKG9iamVjdE1vZGUpXG4gICAgcmV0ID0gbGlzdC5zaGlmdCgpO1xuICBlbHNlIGlmICghbiB8fCBuID49IGxlbmd0aCkge1xuICAgIC8vIHJlYWQgaXQgYWxsLCB0cnVuY2F0ZSB0aGUgYXJyYXkuXG4gICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICByZXQgPSBsaXN0LmpvaW4oJycpO1xuICAgIGVsc2VcbiAgICAgIHJldCA9IEJ1ZmZlci5jb25jYXQobGlzdCwgbGVuZ3RoKTtcbiAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gIH0gZWxzZSB7XG4gICAgLy8gcmVhZCBqdXN0IHNvbWUgb2YgaXQuXG4gICAgaWYgKG4gPCBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8ganVzdCB0YWtlIGEgcGFydCBvZiB0aGUgZmlyc3QgbGlzdCBpdGVtLlxuICAgICAgLy8gc2xpY2UgaXMgdGhlIHNhbWUgZm9yIGJ1ZmZlcnMgYW5kIHN0cmluZ3MuXG4gICAgICB2YXIgYnVmID0gbGlzdFswXTtcbiAgICAgIHJldCA9IGJ1Zi5zbGljZSgwLCBuKTtcbiAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2Uobik7XG4gICAgfSBlbHNlIGlmIChuID09PSBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8gZmlyc3QgbGlzdCBpcyBhIHBlcmZlY3QgbWF0Y2hcbiAgICAgIHJldCA9IGxpc3Quc2hpZnQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY29tcGxleCBjYXNlLlxuICAgICAgLy8gd2UgaGF2ZSBlbm91Z2ggdG8gY292ZXIgaXQsIGJ1dCBpdCBzcGFucyBwYXN0IHRoZSBmaXJzdCBidWZmZXIuXG4gICAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgICAgcmV0ID0gJyc7XG4gICAgICBlbHNlXG4gICAgICAgIHJldCA9IG5ldyBCdWZmZXIobik7XG5cbiAgICAgIHZhciBjID0gMDtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdC5sZW5ndGg7IGkgPCBsICYmIGMgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIGJ1ZiA9IGxpc3RbMF07XG4gICAgICAgIHZhciBjcHkgPSBNYXRoLm1pbihuIC0gYywgYnVmLmxlbmd0aCk7XG5cbiAgICAgICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICAgICAgcmV0ICs9IGJ1Zi5zbGljZSgwLCBjcHkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYnVmLmNvcHkocmV0LCBjLCAwLCBjcHkpO1xuXG4gICAgICAgIGlmIChjcHkgPCBidWYubGVuZ3RoKVxuICAgICAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2UoY3B5KTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGxpc3Quc2hpZnQoKTtcblxuICAgICAgICBjICs9IGNweTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIElmIHdlIGdldCBoZXJlIGJlZm9yZSBjb25zdW1pbmcgYWxsIHRoZSBieXRlcywgdGhlbiB0aGF0IGlzIGFcbiAgLy8gYnVnIGluIG5vZGUuICBTaG91bGQgbmV2ZXIgaGFwcGVuLlxuICBpZiAoc3RhdGUubGVuZ3RoID4gMClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2VuZFJlYWRhYmxlIGNhbGxlZCBvbiBub24tZW1wdHkgc3RyZWFtJyk7XG5cbiAgaWYgKCFzdGF0ZS5lbmRFbWl0dGVkKSB7XG4gICAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAvLyBDaGVjayB0aGF0IHdlIGRpZG4ndCBnZXQgb25lIGxhc3QgdW5zaGlmdC5cbiAgICAgIGlmICghc3RhdGUuZW5kRW1pdHRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgc3RhdGUuZW5kRW1pdHRlZCA9IHRydWU7XG4gICAgICAgIHN0cmVhbS5yZWFkYWJsZSA9IGZhbHNlO1xuICAgICAgICBzdHJlYW0uZW1pdCgnZW5kJyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbmRleE9mICh4cywgeCkge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGlmICh4c1tpXSA9PT0geCkgcmV0dXJuIGk7XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cblxuLy8gYSB0cmFuc2Zvcm0gc3RyZWFtIGlzIGEgcmVhZGFibGUvd3JpdGFibGUgc3RyZWFtIHdoZXJlIHlvdSBkb1xuLy8gc29tZXRoaW5nIHdpdGggdGhlIGRhdGEuICBTb21ldGltZXMgaXQncyBjYWxsZWQgYSBcImZpbHRlclwiLFxuLy8gYnV0IHRoYXQncyBub3QgYSBncmVhdCBuYW1lIGZvciBpdCwgc2luY2UgdGhhdCBpbXBsaWVzIGEgdGhpbmcgd2hlcmVcbi8vIHNvbWUgYml0cyBwYXNzIHRocm91Z2gsIGFuZCBvdGhlcnMgYXJlIHNpbXBseSBpZ25vcmVkLiAgKFRoYXQgd291bGRcbi8vIGJlIGEgdmFsaWQgZXhhbXBsZSBvZiBhIHRyYW5zZm9ybSwgb2YgY291cnNlLilcbi8vXG4vLyBXaGlsZSB0aGUgb3V0cHV0IGlzIGNhdXNhbGx5IHJlbGF0ZWQgdG8gdGhlIGlucHV0LCBpdCdzIG5vdCBhXG4vLyBuZWNlc3NhcmlseSBzeW1tZXRyaWMgb3Igc3luY2hyb25vdXMgdHJhbnNmb3JtYXRpb24uICBGb3IgZXhhbXBsZSxcbi8vIGEgemxpYiBzdHJlYW0gbWlnaHQgdGFrZSBtdWx0aXBsZSBwbGFpbi10ZXh0IHdyaXRlcygpLCBhbmQgdGhlblxuLy8gZW1pdCBhIHNpbmdsZSBjb21wcmVzc2VkIGNodW5rIHNvbWUgdGltZSBpbiB0aGUgZnV0dXJlLlxuLy9cbi8vIEhlcmUncyBob3cgdGhpcyB3b3Jrczpcbi8vXG4vLyBUaGUgVHJhbnNmb3JtIHN0cmVhbSBoYXMgYWxsIHRoZSBhc3BlY3RzIG9mIHRoZSByZWFkYWJsZSBhbmQgd3JpdGFibGVcbi8vIHN0cmVhbSBjbGFzc2VzLiAgV2hlbiB5b3Ugd3JpdGUoY2h1bmspLCB0aGF0IGNhbGxzIF93cml0ZShjaHVuayxjYilcbi8vIGludGVybmFsbHksIGFuZCByZXR1cm5zIGZhbHNlIGlmIHRoZXJlJ3MgYSBsb3Qgb2YgcGVuZGluZyB3cml0ZXNcbi8vIGJ1ZmZlcmVkIHVwLiAgV2hlbiB5b3UgY2FsbCByZWFkKCksIHRoYXQgY2FsbHMgX3JlYWQobikgdW50aWxcbi8vIHRoZXJlJ3MgZW5vdWdoIHBlbmRpbmcgcmVhZGFibGUgZGF0YSBidWZmZXJlZCB1cC5cbi8vXG4vLyBJbiBhIHRyYW5zZm9ybSBzdHJlYW0sIHRoZSB3cml0dGVuIGRhdGEgaXMgcGxhY2VkIGluIGEgYnVmZmVyLiAgV2hlblxuLy8gX3JlYWQobikgaXMgY2FsbGVkLCBpdCB0cmFuc2Zvcm1zIHRoZSBxdWV1ZWQgdXAgZGF0YSwgY2FsbGluZyB0aGVcbi8vIGJ1ZmZlcmVkIF93cml0ZSBjYidzIGFzIGl0IGNvbnN1bWVzIGNodW5rcy4gIElmIGNvbnN1bWluZyBhIHNpbmdsZVxuLy8gd3JpdHRlbiBjaHVuayB3b3VsZCByZXN1bHQgaW4gbXVsdGlwbGUgb3V0cHV0IGNodW5rcywgdGhlbiB0aGUgZmlyc3Rcbi8vIG91dHB1dHRlZCBiaXQgY2FsbHMgdGhlIHJlYWRjYiwgYW5kIHN1YnNlcXVlbnQgY2h1bmtzIGp1c3QgZ28gaW50b1xuLy8gdGhlIHJlYWQgYnVmZmVyLCBhbmQgd2lsbCBjYXVzZSBpdCB0byBlbWl0ICdyZWFkYWJsZScgaWYgbmVjZXNzYXJ5LlxuLy9cbi8vIFRoaXMgd2F5LCBiYWNrLXByZXNzdXJlIGlzIGFjdHVhbGx5IGRldGVybWluZWQgYnkgdGhlIHJlYWRpbmcgc2lkZSxcbi8vIHNpbmNlIF9yZWFkIGhhcyB0byBiZSBjYWxsZWQgdG8gc3RhcnQgcHJvY2Vzc2luZyBhIG5ldyBjaHVuay4gIEhvd2V2ZXIsXG4vLyBhIHBhdGhvbG9naWNhbCBpbmZsYXRlIHR5cGUgb2YgdHJhbnNmb3JtIGNhbiBjYXVzZSBleGNlc3NpdmUgYnVmZmVyaW5nXG4vLyBoZXJlLiAgRm9yIGV4YW1wbGUsIGltYWdpbmUgYSBzdHJlYW0gd2hlcmUgZXZlcnkgYnl0ZSBvZiBpbnB1dCBpc1xuLy8gaW50ZXJwcmV0ZWQgYXMgYW4gaW50ZWdlciBmcm9tIDAtMjU1LCBhbmQgdGhlbiByZXN1bHRzIGluIHRoYXQgbWFueVxuLy8gYnl0ZXMgb2Ygb3V0cHV0LiAgV3JpdGluZyB0aGUgNCBieXRlcyB7ZmYsZmYsZmYsZmZ9IHdvdWxkIHJlc3VsdCBpblxuLy8gMWtiIG9mIGRhdGEgYmVpbmcgb3V0cHV0LiAgSW4gdGhpcyBjYXNlLCB5b3UgY291bGQgd3JpdGUgYSB2ZXJ5IHNtYWxsXG4vLyBhbW91bnQgb2YgaW5wdXQsIGFuZCBlbmQgdXAgd2l0aCBhIHZlcnkgbGFyZ2UgYW1vdW50IG9mIG91dHB1dC4gIEluXG4vLyBzdWNoIGEgcGF0aG9sb2dpY2FsIGluZmxhdGluZyBtZWNoYW5pc20sIHRoZXJlJ2QgYmUgbm8gd2F5IHRvIHRlbGxcbi8vIHRoZSBzeXN0ZW0gdG8gc3RvcCBkb2luZyB0aGUgdHJhbnNmb3JtLiAgQSBzaW5nbGUgNE1CIHdyaXRlIGNvdWxkXG4vLyBjYXVzZSB0aGUgc3lzdGVtIHRvIHJ1biBvdXQgb2YgbWVtb3J5LlxuLy9cbi8vIEhvd2V2ZXIsIGV2ZW4gaW4gc3VjaCBhIHBhdGhvbG9naWNhbCBjYXNlLCBvbmx5IGEgc2luZ2xlIHdyaXR0ZW4gY2h1bmtcbi8vIHdvdWxkIGJlIGNvbnN1bWVkLCBhbmQgdGhlbiB0aGUgcmVzdCB3b3VsZCB3YWl0ICh1bi10cmFuc2Zvcm1lZCkgdW50aWxcbi8vIHRoZSByZXN1bHRzIG9mIHRoZSBwcmV2aW91cyB0cmFuc2Zvcm1lZCBjaHVuayB3ZXJlIGNvbnN1bWVkLlxuXG5tb2R1bGUuZXhwb3J0cyA9IFRyYW5zZm9ybTtcblxudmFyIER1cGxleCA9IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG51dGlsLmluaGVyaXRzKFRyYW5zZm9ybSwgRHVwbGV4KTtcblxuXG5mdW5jdGlvbiBUcmFuc2Zvcm1TdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgdGhpcy5hZnRlclRyYW5zZm9ybSA9IGZ1bmN0aW9uKGVyLCBkYXRhKSB7XG4gICAgcmV0dXJuIGFmdGVyVHJhbnNmb3JtKHN0cmVhbSwgZXIsIGRhdGEpO1xuICB9O1xuXG4gIHRoaXMubmVlZFRyYW5zZm9ybSA9IGZhbHNlO1xuICB0aGlzLnRyYW5zZm9ybWluZyA9IGZhbHNlO1xuICB0aGlzLndyaXRlY2IgPSBudWxsO1xuICB0aGlzLndyaXRlY2h1bmsgPSBudWxsO1xufVxuXG5mdW5jdGlvbiBhZnRlclRyYW5zZm9ybShzdHJlYW0sIGVyLCBkYXRhKSB7XG4gIHZhciB0cyA9IHN0cmVhbS5fdHJhbnNmb3JtU3RhdGU7XG4gIHRzLnRyYW5zZm9ybWluZyA9IGZhbHNlO1xuXG4gIHZhciBjYiA9IHRzLndyaXRlY2I7XG5cbiAgaWYgKCFjYilcbiAgICByZXR1cm4gc3RyZWFtLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdubyB3cml0ZWNiIGluIFRyYW5zZm9ybSBjbGFzcycpKTtcblxuICB0cy53cml0ZWNodW5rID0gbnVsbDtcbiAgdHMud3JpdGVjYiA9IG51bGw7XG5cbiAgaWYgKCF1dGlsLmlzTnVsbE9yVW5kZWZpbmVkKGRhdGEpKVxuICAgIHN0cmVhbS5wdXNoKGRhdGEpO1xuXG4gIGlmIChjYilcbiAgICBjYihlcik7XG5cbiAgdmFyIHJzID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuICBycy5yZWFkaW5nID0gZmFsc2U7XG4gIGlmIChycy5uZWVkUmVhZGFibGUgfHwgcnMubGVuZ3RoIDwgcnMuaGlnaFdhdGVyTWFyaykge1xuICAgIHN0cmVhbS5fcmVhZChycy5oaWdoV2F0ZXJNYXJrKTtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIFRyYW5zZm9ybShvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBUcmFuc2Zvcm0pKVxuICAgIHJldHVybiBuZXcgVHJhbnNmb3JtKG9wdGlvbnMpO1xuXG4gIER1cGxleC5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuXG4gIHRoaXMuX3RyYW5zZm9ybVN0YXRlID0gbmV3IFRyYW5zZm9ybVN0YXRlKG9wdGlvbnMsIHRoaXMpO1xuXG4gIC8vIHdoZW4gdGhlIHdyaXRhYmxlIHNpZGUgZmluaXNoZXMsIHRoZW4gZmx1c2ggb3V0IGFueXRoaW5nIHJlbWFpbmluZy5cbiAgdmFyIHN0cmVhbSA9IHRoaXM7XG5cbiAgLy8gc3RhcnQgb3V0IGFza2luZyBmb3IgYSByZWFkYWJsZSBldmVudCBvbmNlIGRhdGEgaXMgdHJhbnNmb3JtZWQuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcblxuICAvLyB3ZSBoYXZlIGltcGxlbWVudGVkIHRoZSBfcmVhZCBtZXRob2QsIGFuZCBkb25lIHRoZSBvdGhlciB0aGluZ3NcbiAgLy8gdGhhdCBSZWFkYWJsZSB3YW50cyBiZWZvcmUgdGhlIGZpcnN0IF9yZWFkIGNhbGwsIHNvIHVuc2V0IHRoZVxuICAvLyBzeW5jIGd1YXJkIGZsYWcuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUuc3luYyA9IGZhbHNlO1xuXG4gIHRoaXMub25jZSgncHJlZmluaXNoJywgZnVuY3Rpb24oKSB7XG4gICAgaWYgKHV0aWwuaXNGdW5jdGlvbih0aGlzLl9mbHVzaCkpXG4gICAgICB0aGlzLl9mbHVzaChmdW5jdGlvbihlcikge1xuICAgICAgICBkb25lKHN0cmVhbSwgZXIpO1xuICAgICAgfSk7XG4gICAgZWxzZVxuICAgICAgZG9uZShzdHJlYW0pO1xuICB9KTtcbn1cblxuVHJhbnNmb3JtLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHRoaXMuX3RyYW5zZm9ybVN0YXRlLm5lZWRUcmFuc2Zvcm0gPSBmYWxzZTtcbiAgcmV0dXJuIER1cGxleC5wcm90b3R5cGUucHVzaC5jYWxsKHRoaXMsIGNodW5rLCBlbmNvZGluZyk7XG59O1xuXG4vLyBUaGlzIGlzIHRoZSBwYXJ0IHdoZXJlIHlvdSBkbyBzdHVmZiFcbi8vIG92ZXJyaWRlIHRoaXMgZnVuY3Rpb24gaW4gaW1wbGVtZW50YXRpb24gY2xhc3Nlcy5cbi8vICdjaHVuaycgaXMgYW4gaW5wdXQgY2h1bmsuXG4vL1xuLy8gQ2FsbCBgcHVzaChuZXdDaHVuaylgIHRvIHBhc3MgYWxvbmcgdHJhbnNmb3JtZWQgb3V0cHV0XG4vLyB0byB0aGUgcmVhZGFibGUgc2lkZS4gIFlvdSBtYXkgY2FsbCAncHVzaCcgemVybyBvciBtb3JlIHRpbWVzLlxuLy9cbi8vIENhbGwgYGNiKGVycilgIHdoZW4geW91IGFyZSBkb25lIHdpdGggdGhpcyBjaHVuay4gIElmIHlvdSBwYXNzXG4vLyBhbiBlcnJvciwgdGhlbiB0aGF0J2xsIHB1dCB0aGUgaHVydCBvbiB0aGUgd2hvbGUgb3BlcmF0aW9uLiAgSWYgeW91XG4vLyBuZXZlciBjYWxsIGNiKCksIHRoZW4geW91J2xsIG5ldmVyIGdldCBhbm90aGVyIGNodW5rLlxuVHJhbnNmb3JtLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xufTtcblxuVHJhbnNmb3JtLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciB0cyA9IHRoaXMuX3RyYW5zZm9ybVN0YXRlO1xuICB0cy53cml0ZWNiID0gY2I7XG4gIHRzLndyaXRlY2h1bmsgPSBjaHVuaztcbiAgdHMud3JpdGVlbmNvZGluZyA9IGVuY29kaW5nO1xuICBpZiAoIXRzLnRyYW5zZm9ybWluZykge1xuICAgIHZhciBycyA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gICAgaWYgKHRzLm5lZWRUcmFuc2Zvcm0gfHxcbiAgICAgICAgcnMubmVlZFJlYWRhYmxlIHx8XG4gICAgICAgIHJzLmxlbmd0aCA8IHJzLmhpZ2hXYXRlck1hcmspXG4gICAgICB0aGlzLl9yZWFkKHJzLmhpZ2hXYXRlck1hcmspO1xuICB9XG59O1xuXG4vLyBEb2Vzbid0IG1hdHRlciB3aGF0IHRoZSBhcmdzIGFyZSBoZXJlLlxuLy8gX3RyYW5zZm9ybSBkb2VzIGFsbCB0aGUgd29yay5cbi8vIFRoYXQgd2UgZ290IGhlcmUgbWVhbnMgdGhhdCB0aGUgcmVhZGFibGUgc2lkZSB3YW50cyBtb3JlIGRhdGEuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl9yZWFkID0gZnVuY3Rpb24obikge1xuICB2YXIgdHMgPSB0aGlzLl90cmFuc2Zvcm1TdGF0ZTtcblxuICBpZiAoIXV0aWwuaXNOdWxsKHRzLndyaXRlY2h1bmspICYmIHRzLndyaXRlY2IgJiYgIXRzLnRyYW5zZm9ybWluZykge1xuICAgIHRzLnRyYW5zZm9ybWluZyA9IHRydWU7XG4gICAgdGhpcy5fdHJhbnNmb3JtKHRzLndyaXRlY2h1bmssIHRzLndyaXRlZW5jb2RpbmcsIHRzLmFmdGVyVHJhbnNmb3JtKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBtYXJrIHRoYXQgd2UgbmVlZCBhIHRyYW5zZm9ybSwgc28gdGhhdCBhbnkgZGF0YSB0aGF0IGNvbWVzIGluXG4gICAgLy8gd2lsbCBnZXQgcHJvY2Vzc2VkLCBub3cgdGhhdCB3ZSd2ZSBhc2tlZCBmb3IgaXQuXG4gICAgdHMubmVlZFRyYW5zZm9ybSA9IHRydWU7XG4gIH1cbn07XG5cblxuZnVuY3Rpb24gZG9uZShzdHJlYW0sIGVyKSB7XG4gIGlmIChlcilcbiAgICByZXR1cm4gc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuXG4gIC8vIGlmIHRoZXJlJ3Mgbm90aGluZyBpbiB0aGUgd3JpdGUgYnVmZmVyLCB0aGVuIHRoYXQgbWVhbnNcbiAgLy8gdGhhdCBub3RoaW5nIG1vcmUgd2lsbCBldmVyIGJlIHByb3ZpZGVkXG4gIHZhciB3cyA9IHN0cmVhbS5fd3JpdGFibGVTdGF0ZTtcbiAgdmFyIHRzID0gc3RyZWFtLl90cmFuc2Zvcm1TdGF0ZTtcblxuICBpZiAod3MubGVuZ3RoKVxuICAgIHRocm93IG5ldyBFcnJvcignY2FsbGluZyB0cmFuc2Zvcm0gZG9uZSB3aGVuIHdzLmxlbmd0aCAhPSAwJyk7XG5cbiAgaWYgKHRzLnRyYW5zZm9ybWluZylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbGxpbmcgdHJhbnNmb3JtIGRvbmUgd2hlbiBzdGlsbCB0cmFuc2Zvcm1pbmcnKTtcblxuICByZXR1cm4gc3RyZWFtLnB1c2gobnVsbCk7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gYSBwYXNzdGhyb3VnaCBzdHJlYW0uXG4vLyBiYXNpY2FsbHkganVzdCB0aGUgbW9zdCBtaW5pbWFsIHNvcnQgb2YgVHJhbnNmb3JtIHN0cmVhbS5cbi8vIEV2ZXJ5IHdyaXR0ZW4gY2h1bmsgZ2V0cyBvdXRwdXQgYXMtaXMuXG5cbm1vZHVsZS5leHBvcnRzID0gUGFzc1Rocm91Z2g7XG5cbnZhciBUcmFuc2Zvcm0gPSByZXF1aXJlKCcuL19zdHJlYW1fdHJhbnNmb3JtJyk7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudXRpbC5pbmhlcml0cyhQYXNzVGhyb3VnaCwgVHJhbnNmb3JtKTtcblxuZnVuY3Rpb24gUGFzc1Rocm91Z2gob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUGFzc1Rocm91Z2gpKVxuICAgIHJldHVybiBuZXcgUGFzc1Rocm91Z2gob3B0aW9ucyk7XG5cbiAgVHJhbnNmb3JtLmNhbGwodGhpcywgb3B0aW9ucyk7XG59XG5cblBhc3NUaHJvdWdoLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBjYihudWxsLCBjaHVuayk7XG59O1xuIiwiZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9yZWFkYWJsZS5qcycpO1xuZXhwb3J0cy5TdHJlYW0gPSByZXF1aXJlKCdzdHJlYW0nKTtcbmV4cG9ydHMuUmVhZGFibGUgPSBleHBvcnRzO1xuZXhwb3J0cy5Xcml0YWJsZSA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fd3JpdGFibGUuanMnKTtcbmV4cG9ydHMuRHVwbGV4ID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9kdXBsZXguanMnKTtcbmV4cG9ydHMuVHJhbnNmb3JtID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV90cmFuc2Zvcm0uanMnKTtcbmV4cG9ydHMuUGFzc1Rocm91Z2ggPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzJyk7XG5pZiAoIXByb2Nlc3MuYnJvd3NlciAmJiBwcm9jZXNzLmVudi5SRUFEQUJMRV9TVFJFQU0gPT09ICdkaXNhYmxlJykge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJ3N0cmVhbScpO1xufVxuIiwiLyogQ29weXJpZ2h0IChjKSAyMDEyLTIwMTQgTGV2ZWxVUCBjb250cmlidXRvcnNcbiAqIFNlZSBsaXN0IGF0IDxodHRwczovL2dpdGh1Yi5jb20vcnZhZ2cvbm9kZS1sZXZlbHVwI2NvbnRyaWJ1dGluZz5cbiAqIE1JVCBMaWNlbnNlIDxodHRwczovL2dpdGh1Yi5jb20vcnZhZ2cvbm9kZS1sZXZlbHVwL2Jsb2IvbWFzdGVyL0xJQ0VOU0UubWQ+XG4gKi9cblxuLy8gTk9URTogd2UgYXJlIGZpeGVkIHRvIHJlYWRhYmxlLXN0cmVhbUAxLjAueCBmb3Igbm93XG4vLyBmb3IgcHVyZSBTdHJlYW1zMiBhY3Jvc3MgTm9kZSB2ZXJzaW9uc1xuaW1wb3J0IFJlYWRhYmxlU3RyZWFtQ29yZSBmcm9tICdyZWFkYWJsZS1zdHJlYW0nO1xuXG52YXIgUmVhZGFibGUgPSBSZWFkYWJsZVN0cmVhbUNvcmUuUmVhZGFibGU7XG5cbmZ1bmN0aW9uIGNyZWF0ZUNsYXNzKHBhcmVudCwgaW5pdCkge1xuICBsZXQga2xhc3MgPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBrbGFzcykpIHtcbiAgICAgIHJldHVybiBuZXcga2xhc3MoLi4uYXJncyk7XG4gICAgfVxuICAgIGluaXQuYXBwbHkodGhpcywgYXJncyk7XG4gIH07XG4gIGtsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUocGFyZW50LnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBrbGFzcyB9XG4gIH0pO1xuICByZXR1cm4ga2xhc3M7XG59XG5cbmNsYXNzIFJlYWRTdHJlYW1JbnRlcm5hbCBleHRlbmRzIFJlYWRhYmxlIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucywgbWFrZURhdGEpIHtcbiAgICBzdXBlcih7IG9iamVjdE1vZGU6IHRydWUsIGhpZ2hXYXRlck1hcms6IG9wdGlvbnMuaGlnaFdhdGVyTWFyayB9KTtcbiAgICB0aGlzLl9zZXR1cChvcHRpb25zLCBtYWtlRGF0YSk7XG4gIH1cblxuICBfc2V0dXAob3B0aW9ucywgbWFrZURhdGEpIHtcbiAgICBzdXBlci5jb25zdHJ1Y3Rvcih7IG9iamVjdE1vZGU6IHRydWUsIGhpZ2hXYXRlck1hcms6IG9wdGlvbnMuaGlnaFdhdGVyTWFyayB9KTtcblxuICAgIC8vIHB1cmVseSB0byBrZWVwIGBkYmAgYXJvdW5kIHVudGlsIHdlJ3JlIGRvbmUgc28gaXQncyBub3QgR0NlZCBpZiB0aGUgdXNlciBkb2Vzbid0IGtlZXAgYSByZWZcbiAgICB0aGlzLl93YWl0aW5nID0gZmFsc2U7XG4gICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5fbWFrZURhdGEgPSBtYWtlRGF0YTtcbiAgfVxuXG4gIHNldEl0ZXJhdG9yKGl0KSB7XG4gICAgdGhpcy5faXRlcmF0b3IgPSBpdDtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAodGhpcy5fZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm4gaXQuZW5kKGZ1bmN0aW9uICgpIHt9KTtcbiAgICB9XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHRoaXMuX3dhaXRpbmcpIHtcbiAgICAgIHRoaXMuX3dhaXRpbmcgPSBmYWxzZTtcbiAgICAgIHJldHVybiB0aGlzLl9yZWFkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgX2NsZWFudXAoZXJyKSB7XG4gICAgaWYgKHRoaXMuX2Rlc3Ryb3llZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgXG4gICAgdGhpcy5fZGVzdHJveWVkID0gdHJ1ZTtcbiAgXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmIChlcnIgJiYgZXJyLm1lc3NhZ2UgIT09ICdpdGVyYXRvciBoYXMgZW5kZWQnKSB7XG4gICAgICBzZWxmLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICB9XG4gIFxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgaWYgKHNlbGYuX2l0ZXJhdG9yKSB7XG4gICAgICBzZWxmLl9pdGVyYXRvci5lbmQoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLl9pdGVyYXRvciA9IG51bGw7XG4gICAgICAgIHNlbGYuZW1pdCgnY2xvc2UnKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLmVtaXQoJ2Nsb3NlJyk7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLl9jbGVhbnVwKCk7XG4gIH1cbiAgXG4gIF9yZWFkKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoc2VsZi5fZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICghc2VsZi5faXRlcmF0b3IpIHtcbiAgICAgIHJldHVybiB0aGlzLl93YWl0aW5nID0gdHJ1ZTtcbiAgICB9XG4gIFxuICAgIHNlbGYuX2l0ZXJhdG9yLm5leHQoZnVuY3Rpb24gKGVyciwga2V5LCB2YWx1ZSkge1xuICAgICAgaWYgKGVyciB8fCAoa2V5ID09PSB1bmRlZmluZWQgJiYgdmFsdWUgPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgaWYgKCFlcnIgJiYgIXNlbGYuX2Rlc3Ryb3llZCkge1xuICAgICAgICAgIHNlbGYucHVzaChudWxsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2VsZi5fY2xlYW51cChlcnIpO1xuICAgICAgfVxuICBcbiAgXG4gICAgICB2YWx1ZSA9IHNlbGYuX21ha2VEYXRhKGtleSwgdmFsdWUpO1xuICAgICAgaWYgKCFzZWxmLl9kZXN0cm95ZWQpIHtcbiAgICAgICAgc2VsZi5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5jb25zdCBSZWFkU3RyZWFtID0gY3JlYXRlQ2xhc3MoUmVhZFN0cmVhbUludGVybmFsLCBmdW5jdGlvbiAob3B0aW9ucywgbWFrZURhdGEpIHtcbiAgUmVhZFN0cmVhbUludGVybmFsLnByb3RvdHlwZS5fc2V0dXAuY2FsbCh0aGlzLCBvcHRpb25zLCBtYWtlRGF0YSk7XG59KTtcblxuZXhwb3J0IGRlZmF1bHQgUmVhZFN0cmVhbTtcblxuIiwiZXhwb3J0IGRlZmF1bHQge1xuICBlbmNvZGU6IGZ1bmN0aW9uIChkZWNvZGVkS2V5KSB7XG4gICAgcmV0dXJuICdcXHhmZicgKyBkZWNvZGVkS2V5WzBdICsgJ1xceGZmJyArIGRlY29kZWRLZXlbMV07XG4gIH0sXG4gIGRlY29kZTogZnVuY3Rpb24gKGVuY29kZWRLZXlBc0J1ZmZlcikge1xuICAgIHZhciBzdHIgPSBlbmNvZGVkS2V5QXNCdWZmZXIudG9TdHJpbmcoKTtcbiAgICB2YXIgaWR4ID0gc3RyLmluZGV4T2YoJ1xceGZmJywgMSk7XG4gICAgcmV0dXJuIFtzdHIuc3Vic3RyaW5nKDEsIGlkeCksIHN0ci5zdWJzdHJpbmcoaWR4ICsgMSldO1xuICB9LFxuICBsb3dlckJvdW5kOiAnXFx4MDAnLFxuICB1cHBlckJvdW5kOiAnXFx4ZmYnXG59OyIsImltcG9ydCBudXQgZnJvbSAnLi9udXQnO1xuaW1wb3J0IHNoZWxsIGZyb20gJy4vc2hlbGwnO1xuaW1wb3J0IENvZGVjIGZyb20gJ2xldmVsLWNvZGVjJztcbmltcG9ydCBSZWFkU3RyZWFtIGZyb20gJy4vcmVhZFN0cmVhbSc7XG5pbXBvcnQgcHJlY29kZWMgZnJvbSAnLi9sZWdhY3lDb2RlYyc7XG5cbnZhciBjb2RlYyA9IG5ldyBDb2RlYygpO1xuXG5mdW5jdGlvbiBzdWJsZXZlbFBvdWNoKGRiKSB7XG4gIHJldHVybiBzaGVsbChudXQoZGIsIHByZWNvZGVjLCBjb2RlYyksIFtdLCBSZWFkU3RyZWFtLCBkYi5vcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgc3VibGV2ZWxQb3VjaDtcbiJdLCJuYW1lcyI6WyJyZXF1aXJlJCQwIiwiaWVlZTc1NCIsInJlcXVpcmUkJDEiLCJpbmhlcml0c19icm93c2VyTW9kdWxlIiwiaXNGdW5jdGlvbiIsImx0Z3QudG9MdGd0IiwidXRpbCIsInJlcXVpcmUkJDIiLCJyZXF1aXJlJCQ0IiwicmVxdWlyZSQkMyIsInJlcXVpcmUkJDUiLCJyZXF1aXJlJCQ2IiwicmVxdWlyZSQkNyIsInJlcXVpcmUkJDgiLCJUcmFuc2Zvcm0iLCJDb2RlYyIsInNoZWxsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUVBLFFBQUEsQ0FBQSxVQUFrQixHQUFHLFdBQVU7QUFDL0IsUUFBQSxDQUFBLFdBQW1CLEdBQUcsWUFBVztBQUNqQyxRQUFBLENBQUEsYUFBcUIsR0FBRyxjQUFhO0FBQ3JDO0FBQ0EsSUFBSSxNQUFNLEdBQUcsR0FBRTtBQUNmLElBQUksU0FBUyxHQUFHLEdBQUU7QUFDbEIsSUFBSSxHQUFHLEdBQUcsT0FBTyxVQUFVLEtBQUssV0FBVyxHQUFHLFVBQVUsR0FBRyxNQUFLO0FBQ2hFO0FBQ0EsSUFBSSxJQUFJLEdBQUcsbUVBQWtFO0FBQzdFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDakQsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBQztBQUNyQixFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBQztBQUNuQyxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFFO0FBQ2pDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdB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LElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFDO0FBQzVCLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUM7QUFDdkIsRUFBRSxJQUFJLEVBQUUsSUFBSSxJQUFJLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUM7QUFDbEUsRUFBRSxJQUFJLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUM7QUFDakMsRUFBRSxJQUFJLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBQztBQUN2QixFQUFFLElBQUksQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFDO0FBQzdEO0FBQ0EsRUFBRSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUM7QUFDekI7QUFDQSxFQUFFLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssS0FBSyxRQUFRLEVBQUU7QUFDMUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFDO0FBQzVCLElBQUksQ0FBQyxHQUFHLEtBQUk7QUFDWixHQUFHLE1BQU07QUFDVCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBQztBQUM5QyxJQUFJLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQzNDLE1BQU0sQ0FBQyxHQUFFO0FBQ1QsTUFBTSxDQUFDLElBQUksRUFBQztBQUNaLEtBQUs7QUFDTCxJQUFJLElBQUksQ0FBQyxHQUFHLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFDeEIsTUFBTSxLQUFLLElBQUksRUFBRSxHQUFHLEVBQUM7QUFDckIsS0FBSyxNQUFNO0FBQ1gsTUFBTSxLQUFLLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUM7QUFDMUMsS0FBSztBQUNMLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN4QixNQUFNLENBQUMsR0FBRTtBQUNULE1BQU0sQ0FBQyxJQUFJLEVBQUM7QUFDWixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksQ0FBQyxHQUFHLEtBQUssSUFBSSxJQUFJLEVBQUU7QUFDM0IsTUFBTSxDQUFDLEdBQUcsRUFBQztBQUNYLE1BQU0sQ0FBQyxHQUFHLEtBQUk7QUFDZCxLQUFLLE1BQU0sSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUMvQixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFDO0FBQy9DLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFLO0FBQ25CLEtBQUssTUFBTTtBQUNYLE1BQU0sQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFDO0FBQzVELE1BQU0sQ0FBQyxHQUFHLEVBQUM7QUFDWCxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLElBQUksSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsRUFBRSxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUU7QUFDbEY7QUFDQSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksRUFBQztBQUNyQixFQUFFLElBQUksSUFBSSxLQUFJO0FBQ2QsRUFBRSxPQUFPLElBQUksR0FBRyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsRUFBRSxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUU7QUFDakY7QUFDQSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFHO0FBQ25DOzs7Ozs7Ozs7O0FDM0VBO0NBQ0EsSUFBSSxNQUFNLEdBQUdBLFNBQW9CO0NBQ2pDLElBQUlDLFNBQU8sR0FBR0MsUUFBa0I7QUFDaEMsQ0FBQSxJQUFJLG1CQUFtQjtBQUN2QixHQUFFLENBQUMsT0FBTyxNQUFNLEtBQUssVUFBVSxJQUFJLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLFVBQVU7QUFDdEUsT0FBTSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsNEJBQTRCLENBQUM7QUFDakQsT0FBTSxLQUFJO0FBQ1Y7QUFDQSxDQUFBLE9BQUEsQ0FBQSxNQUFBLEdBQWlCLE9BQU07QUFDdkIsQ0FBQSxPQUFBLENBQUEsVUFBQSxHQUFxQixXQUFVO0FBQy9CLENBQUEsT0FBQSxDQUFBLGlCQUFBLEdBQTRCLEdBQUU7QUFDOUI7Q0FDQSxJQUFJLFlBQVksR0FBRyxXQUFVO0FBQzdCLENBQUEsT0FBQSxDQUFBLFVBQUEsR0FBcUIsYUFBWTtBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFBLE1BQU0sQ0FBQyxtQkFBbUIsR0FBRyxpQkFBaUIsR0FBRTtBQUNoRDtDQUNBLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLElBQUksT0FBTyxPQUFPLEtBQUssV0FBVztBQUNqRSxLQUFJLE9BQU8sT0FBTyxDQUFDLEtBQUssS0FBSyxVQUFVLEVBQUU7R0FDdkMsT0FBTyxDQUFDLEtBQUs7QUFDZixLQUFJLDJFQUEyRTtBQUMvRSxLQUFJLHNFQUFzRTtLQUN2RTtFQUNGO0FBQ0Q7QUFDQSxDQUFBLFNBQVMsaUJBQWlCLElBQUk7QUFDOUI7QUFDQSxHQUFFLElBQUk7QUFDTixLQUFJLElBQUksR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsRUFBQztLQUMzQixJQUFJLEtBQUssR0FBRyxFQUFFLEdBQUcsRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFFLEVBQUUsR0FBRTtLQUM5QyxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsU0FBUyxFQUFDO0FBQ3RELEtBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFDO0FBQ3JDLEtBQUksT0FBTyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRTtJQUN4QixDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2QsS0FBSSxPQUFPLEtBQUs7SUFDYjtFQUNGO0FBQ0Q7Q0FDQSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFO0dBQ2hELFVBQVUsRUFBRSxJQUFJO0dBQ2hCLEdBQUcsRUFBRSxZQUFZO0tBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxTQUFTO0tBQzVDLE9BQU8sSUFBSSxDQUFDLE1BQU07SUFDbkI7QUFDSCxFQUFDLEVBQUM7QUFDRjtDQUNBLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUU7R0FDaEQsVUFBVSxFQUFFLElBQUk7R0FDaEIsR0FBRyxFQUFFLFlBQVk7S0FDZixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLFNBQVM7S0FDNUMsT0FBTyxJQUFJLENBQUMsVUFBVTtJQUN2QjtBQUNILEVBQUMsRUFBQztBQUNGO0NBQ0EsU0FBUyxZQUFZLEVBQUUsTUFBTSxFQUFFO0FBQy9CLEdBQUUsSUFBSSxNQUFNLEdBQUcsWUFBWSxFQUFFO0tBQ3pCLE1BQU0sSUFBSSxVQUFVLENBQUMsYUFBYSxHQUFHLE1BQU0sR0FBRyxnQ0FBZ0MsQ0FBQztJQUNoRjtBQUNIO0FBQ0EsR0FBRSxJQUFJLEdBQUcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUM7R0FDaEMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLFNBQVMsRUFBQztBQUM5QyxHQUFFLE9BQU8sR0FBRztFQUNYO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUEsU0FBUyxNQUFNLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sRUFBRTtBQUNoRDtBQUNBLEdBQUUsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUU7QUFDL0IsS0FBSSxJQUFJLE9BQU8sZ0JBQWdCLEtBQUssUUFBUSxFQUFFO09BQ3hDLE1BQU0sSUFBSSxTQUFTO0FBQ3pCLFNBQVEsb0VBQW9FO1FBQ3JFO01BQ0Y7QUFDTCxLQUFJLE9BQU8sV0FBVyxDQUFDLEdBQUcsQ0FBQztJQUN4QjtHQUNELE9BQU8sSUFBSSxDQUFDLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLENBQUM7RUFDM0M7QUFDRDtDQUNBLE1BQU0sQ0FBQyxRQUFRLEdBQUcsS0FBSTtBQUN0QjtBQUNBLENBQUEsU0FBUyxJQUFJLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sRUFBRTtBQUNoRCxHQUFFLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO0FBQ2pDLEtBQUksT0FBTyxVQUFVLENBQUMsS0FBSyxFQUFFLGdCQUFnQixDQUFDO0lBQzNDO0FBQ0g7QUFDQSxHQUFFLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUNqQyxLQUFJLE9BQU8sYUFBYSxDQUFDLEtBQUssQ0FBQztJQUM1QjtBQUNIO0FBQ0EsR0FBRSxJQUFJLEtBQUssSUFBSSxJQUFJLEVBQUU7S0FDakIsTUFBTSxJQUFJLFNBQVM7QUFDdkIsT0FBTSw2RUFBNkU7QUFDbkYsT0FBTSxzQ0FBc0MsSUFBSSxPQUFPLEtBQUssQ0FBQztNQUN4RDtJQUNGO0FBQ0g7QUFDQSxHQUFFLElBQUksVUFBVSxDQUFDLEtBQUssRUFBRSxXQUFXLENBQUM7UUFDN0IsS0FBSyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDLEVBQUU7S0FDcEQsT0FBTyxlQUFlLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sQ0FBQztJQUN4RDtBQUNIO0FBQ0EsR0FBRSxJQUFJLE9BQU8saUJBQWlCLEtBQUssV0FBVztBQUM5QyxRQUFPLFVBQVUsQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLENBQUM7QUFDM0MsUUFBTyxLQUFLLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEVBQUU7S0FDM0QsT0FBTyxlQUFlLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sQ0FBQztJQUN4RDtBQUNIO0FBQ0EsR0FBRSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtLQUM3QixNQUFNLElBQUksU0FBUztBQUN2QixPQUFNLHVFQUF1RTtNQUN4RTtJQUNGO0FBQ0g7R0FDRSxJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxPQUFPLEdBQUU7R0FDOUMsSUFBSSxPQUFPLElBQUksSUFBSSxJQUFJLE9BQU8sS0FBSyxLQUFLLEVBQUU7S0FDeEMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLENBQUM7SUFDdEQ7QUFDSDtBQUNBLEdBQUUsSUFBSSxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssRUFBQztBQUMzQixHQUFFLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQztBQUNqQjtHQUNFLElBQUksT0FBTyxNQUFNLEtBQUssV0FBVyxJQUFJLE1BQU0sQ0FBQyxXQUFXLElBQUksSUFBSTtPQUMzRCxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssVUFBVSxFQUFFO0tBQ25ELE9BQU8sTUFBTSxDQUFDLElBQUk7QUFDdEIsT0FBTSxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLE1BQU07TUFDOUQ7SUFDRjtBQUNIO0dBQ0UsTUFBTSxJQUFJLFNBQVM7QUFDckIsS0FBSSw2RUFBNkU7QUFDakYsS0FBSSxzQ0FBc0MsSUFBSSxPQUFPLEtBQUssQ0FBQztJQUN4RDtFQUNGO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0NBQ0EsTUFBTSxDQUFDLElBQUksR0FBRyxVQUFVLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUU7R0FDdkQsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sQ0FBQztHQUM3QztBQUNEO0FBQ0E7QUFDQTtDQUNBLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsU0FBUyxFQUFDO0FBQzdELENBQUEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFDO0FBQ3pDO0NBQ0EsU0FBUyxVQUFVLEVBQUUsSUFBSSxFQUFFO0FBQzNCLEdBQUUsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDaEMsS0FBSSxNQUFNLElBQUksU0FBUyxDQUFDLHdDQUF3QyxDQUFDO0FBQ2pFLElBQUcsTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEVBQUU7S0FDbkIsTUFBTSxJQUFJLFVBQVUsQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLGdDQUFnQyxDQUFDO0lBQzlFO0VBQ0Y7QUFDRDtBQUNBLENBQUEsU0FBUyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7R0FDcEMsVUFBVSxDQUFDLElBQUksRUFBQztBQUNsQixHQUFFLElBQUksSUFBSSxJQUFJLENBQUMsRUFBRTtBQUNqQixLQUFJLE9BQU8sWUFBWSxDQUFDLElBQUksQ0FBQztJQUMxQjtBQUNILEdBQUUsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO0FBQzFCO0FBQ0E7QUFDQTtBQUNBLEtBQUksT0FBTyxPQUFPLFFBQVEsS0FBSyxRQUFRO1NBQy9CLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQztTQUN2QyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNsQztBQUNILEdBQUUsT0FBTyxZQUFZLENBQUMsSUFBSSxDQUFDO0VBQzFCO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtDQUNBLE1BQU0sQ0FBQyxLQUFLLEdBQUcsVUFBVSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtHQUM3QyxPQUFPLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQztHQUNuQztBQUNEO0NBQ0EsU0FBUyxXQUFXLEVBQUUsSUFBSSxFQUFFO0dBQzFCLFVBQVUsQ0FBQyxJQUFJLEVBQUM7QUFDbEIsR0FBRSxPQUFPLFlBQVksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ3REO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFBLE1BQU0sQ0FBQyxXQUFXLEdBQUcsVUFBVSxJQUFJLEVBQUU7QUFDckMsR0FBRSxPQUFPLFdBQVcsQ0FBQyxJQUFJLENBQUM7R0FDekI7QUFDRDtBQUNBO0FBQ0E7QUFDQSxDQUFBLE1BQU0sQ0FBQyxlQUFlLEdBQUcsVUFBVSxJQUFJLEVBQUU7QUFDekMsR0FBRSxPQUFPLFdBQVcsQ0FBQyxJQUFJLENBQUM7R0FDekI7QUFDRDtBQUNBLENBQUEsU0FBUyxVQUFVLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtHQUNyQyxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsSUFBSSxRQUFRLEtBQUssRUFBRSxFQUFFO0tBQ25ELFFBQVEsR0FBRyxPQUFNO0lBQ2xCO0FBQ0g7R0FDRSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUNwQyxLQUFJLE1BQU0sSUFBSSxTQUFTLENBQUMsb0JBQW9CLEdBQUcsUUFBUSxDQUFDO0lBQ3JEO0FBQ0g7R0FDRSxJQUFJLE1BQU0sR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxHQUFHLEVBQUM7QUFDL0MsR0FBRSxJQUFJLEdBQUcsR0FBRyxZQUFZLENBQUMsTUFBTSxFQUFDO0FBQ2hDO0dBQ0UsSUFBSSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFDO0FBQzFDO0FBQ0EsR0FBRSxJQUFJLE1BQU0sS0FBSyxNQUFNLEVBQUU7QUFDekI7QUFDQTtBQUNBO0tBQ0ksR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBQztJQUMzQjtBQUNIO0FBQ0EsR0FBRSxPQUFPLEdBQUc7RUFDWDtBQUNEO0NBQ0EsU0FBUyxhQUFhLEVBQUUsS0FBSyxFQUFFO0FBQy9CLEdBQUUsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBQztBQUMvRCxHQUFFLElBQUksR0FBRyxHQUFHLFlBQVksQ0FBQyxNQUFNLEVBQUM7QUFDaEMsR0FBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7S0FDbEMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFHO0lBQ3hCO0FBQ0gsR0FBRSxPQUFPLEdBQUc7RUFDWDtBQUNEO0NBQ0EsU0FBUyxhQUFhLEVBQUUsU0FBUyxFQUFFO0FBQ25DLEdBQUUsSUFBSSxVQUFVLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxFQUFFO0FBQ3pDLEtBQUksSUFBSSxJQUFJLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxFQUFDO0FBQ3hDLEtBQUksT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDdEU7QUFDSCxHQUFFLE9BQU8sYUFBYSxDQUFDLFNBQVMsQ0FBQztFQUNoQztBQUNEO0FBQ0EsQ0FBQSxTQUFTLGVBQWUsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRTtHQUNuRCxJQUFJLFVBQVUsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLFVBQVUsR0FBRyxVQUFVLEVBQUU7QUFDdkQsS0FBSSxNQUFNLElBQUksVUFBVSxDQUFDLHNDQUFzQyxDQUFDO0lBQzdEO0FBQ0g7R0FDRSxJQUFJLEtBQUssQ0FBQyxVQUFVLEdBQUcsVUFBVSxJQUFJLE1BQU0sSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNyRCxLQUFJLE1BQU0sSUFBSSxVQUFVLENBQUMsc0NBQXNDLENBQUM7SUFDN0Q7QUFDSDtBQUNBLEdBQUUsSUFBSSxJQUFHO0dBQ1AsSUFBSSxVQUFVLEtBQUssU0FBUyxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7QUFDeEQsS0FBSSxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxFQUFDO0FBQy9CLElBQUcsTUFBTSxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7S0FDL0IsR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUM7QUFDM0MsSUFBRyxNQUFNO0tBQ0wsR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFDO0lBQ2hEO0FBQ0g7QUFDQTtHQUNFLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxTQUFTLEVBQUM7QUFDOUM7QUFDQSxHQUFFLE9BQU8sR0FBRztFQUNYO0FBQ0Q7Q0FDQSxTQUFTLFVBQVUsRUFBRSxHQUFHLEVBQUU7QUFDMUIsR0FBRSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7S0FDeEIsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFDO0FBQ3JDLEtBQUksSUFBSSxHQUFHLEdBQUcsWUFBWSxDQUFDLEdBQUcsRUFBQztBQUMvQjtBQUNBLEtBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUMxQixPQUFNLE9BQU8sR0FBRztNQUNYO0FBQ0w7S0FDSSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBQztBQUM1QixLQUFJLE9BQU8sR0FBRztJQUNYO0FBQ0g7QUFDQSxHQUFFLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUU7QUFDaEMsS0FBSSxJQUFJLE9BQU8sR0FBRyxDQUFDLE1BQU0sS0FBSyxRQUFRLElBQUksV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUNuRSxPQUFNLE9BQU8sWUFBWSxDQUFDLENBQUMsQ0FBQztNQUN2QjtBQUNMLEtBQUksT0FBTyxhQUFhLENBQUMsR0FBRyxDQUFDO0lBQzFCO0FBQ0g7QUFDQSxHQUFFLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDeEQsS0FBSSxPQUFPLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO0lBQy9CO0VBQ0Y7QUFDRDtDQUNBLFNBQVMsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMxQjtBQUNBO0FBQ0EsR0FBRSxJQUFJLE1BQU0sSUFBSSxZQUFZLEVBQUU7QUFDOUIsS0FBSSxNQUFNLElBQUksVUFBVSxDQUFDLGlEQUFpRDswQkFDakQsVUFBVSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDO0lBQ3hFO0dBQ0QsT0FBTyxNQUFNLEdBQUcsQ0FBQztFQUNsQjtBQUNEO0NBQ0EsU0FBUyxVQUFVLEVBQUUsTUFBTSxFQUFFO0FBQzdCLEdBQUUsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLEVBQUU7S0FDckIsTUFBTSxHQUFHLEVBQUM7SUFDWDtBQUNILEdBQUUsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDO0VBQzdCO0FBQ0Q7QUFDQSxDQUFBLE1BQU0sQ0FBQyxRQUFRLEdBQUcsU0FBUyxRQUFRLEVBQUUsQ0FBQyxFQUFFO0dBQ3RDLE9BQU8sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxLQUFLLElBQUk7QUFDMUMsS0FBSSxDQUFDLEtBQUssTUFBTSxDQUFDLFNBQVM7R0FDekI7QUFDRDtDQUNBLE1BQU0sQ0FBQyxPQUFPLEdBQUcsU0FBUyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtHQUN2QyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBQztHQUN6RSxJQUFJLFVBQVUsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBQztBQUMzRSxHQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRTtLQUM5QyxNQUFNLElBQUksU0FBUztBQUN2QixPQUFNLHVFQUF1RTtNQUN4RTtJQUNGO0FBQ0g7QUFDQSxHQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxPQUFPLENBQUM7QUFDdkI7QUFDQSxHQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFNO0FBQ2xCLEdBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU07QUFDbEI7R0FDRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRTtLQUNsRCxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdkIsT0FBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBQztBQUNkLE9BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUM7QUFDZCxPQUFNLEtBQUs7TUFDTjtJQUNGO0FBQ0g7QUFDQSxHQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN0QixHQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLENBQUM7QUFDckIsR0FBRSxPQUFPLENBQUM7R0FDVDtBQUNEO0FBQ0EsQ0FBQSxNQUFNLENBQUMsVUFBVSxHQUFHLFNBQVMsVUFBVSxFQUFFLFFBQVEsRUFBRTtBQUNuRCxHQUFFLFFBQVEsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsRUFBRTtLQUNwQyxLQUFLLEtBQUssQ0FBQztLQUNYLEtBQUssTUFBTSxDQUFDO0tBQ1osS0FBSyxPQUFPLENBQUM7S0FDYixLQUFLLE9BQU8sQ0FBQztLQUNiLEtBQUssUUFBUSxDQUFDO0tBQ2QsS0FBSyxRQUFRLENBQUM7S0FDZCxLQUFLLFFBQVEsQ0FBQztLQUNkLEtBQUssTUFBTSxDQUFDO0tBQ1osS0FBSyxPQUFPLENBQUM7S0FDYixLQUFLLFNBQVMsQ0FBQztBQUNuQixLQUFJLEtBQUssVUFBVTtBQUNuQixPQUFNLE9BQU8sSUFBSTtLQUNiO0FBQ0osT0FBTSxPQUFPLEtBQUs7SUFDZjtHQUNGO0FBQ0Q7Q0FDQSxNQUFNLENBQUMsTUFBTSxHQUFHLFNBQVMsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7R0FDN0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDNUIsS0FBSSxNQUFNLElBQUksU0FBUyxDQUFDLDZDQUE2QyxDQUFDO0lBQ25FO0FBQ0g7QUFDQSxHQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDekIsS0FBSSxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3ZCO0FBQ0g7QUFDQSxHQUFFLElBQUksRUFBQztBQUNQLEdBQUUsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFO0tBQ3hCLE1BQU0sR0FBRyxFQUFDO0FBQ2QsS0FBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDdEMsT0FBTSxNQUFNLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU07TUFDekI7SUFDRjtBQUNIO0dBQ0UsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUM7R0FDdkMsSUFBSSxHQUFHLEdBQUcsRUFBQztBQUNiLEdBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQ3BDLEtBQUksSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBQztBQUNyQixLQUFJLElBQUksVUFBVSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsRUFBRTtPQUMvQixJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUU7QUFDNUMsU0FBUSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFDO0FBQzFDLFFBQU8sTUFBTTtBQUNiLFNBQVEsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSTtBQUNyQyxXQUFVLE1BQU07QUFDaEIsV0FBVSxHQUFHO0FBQ2IsV0FBVSxHQUFHO1dBQ0o7UUFDRjtNQUNGLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDdEMsT0FBTSxNQUFNLElBQUksU0FBUyxDQUFDLDZDQUE2QyxDQUFDO0FBQ3hFLE1BQUssTUFBTTtBQUNYLE9BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFDO01BQ3RCO0FBQ0wsS0FBSSxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU07SUFDbEI7QUFDSCxHQUFFLE9BQU8sTUFBTTtHQUNkO0FBQ0Q7QUFDQSxDQUFBLFNBQVMsVUFBVSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7QUFDdkMsR0FBRSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7S0FDM0IsT0FBTyxNQUFNLENBQUMsTUFBTTtJQUNyQjtBQUNILEdBQUUsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLEVBQUU7S0FDakUsT0FBTyxNQUFNLENBQUMsVUFBVTtJQUN6QjtBQUNILEdBQUUsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7S0FDOUIsTUFBTSxJQUFJLFNBQVM7QUFDdkIsT0FBTSw0RUFBNEU7T0FDNUUsZ0JBQWdCLEdBQUcsT0FBTyxNQUFNO01BQ2pDO0lBQ0Y7QUFDSDtBQUNBLEdBQUUsSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLE9BQU07QUFDekIsR0FBRSxJQUFJLFNBQVMsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFDO0dBQy9ELElBQUksQ0FBQyxTQUFTLElBQUksR0FBRyxLQUFLLENBQUMsRUFBRSxPQUFPLENBQUM7QUFDdkM7QUFDQTtHQUNFLElBQUksV0FBVyxHQUFHLE1BQUs7QUFDekIsR0FBRSxTQUFTO0FBQ1gsS0FBSSxRQUFRLFFBQVE7T0FDZCxLQUFLLE9BQU8sQ0FBQztPQUNiLEtBQUssUUFBUSxDQUFDO0FBQ3BCLE9BQU0sS0FBSyxRQUFRO0FBQ25CLFNBQVEsT0FBTyxHQUFHO09BQ1osS0FBSyxNQUFNLENBQUM7QUFDbEIsT0FBTSxLQUFLLE9BQU87QUFDbEIsU0FBUSxPQUFPLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNO09BQ25DLEtBQUssTUFBTSxDQUFDO09BQ1osS0FBSyxPQUFPLENBQUM7T0FDYixLQUFLLFNBQVMsQ0FBQztBQUNyQixPQUFNLEtBQUssVUFBVTtTQUNiLE9BQU8sR0FBRyxHQUFHLENBQUM7QUFDdEIsT0FBTSxLQUFLLEtBQUs7U0FDUixPQUFPLEdBQUcsS0FBSyxDQUFDO0FBQ3hCLE9BQU0sS0FBSyxRQUFRO0FBQ25CLFNBQVEsT0FBTyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTTtPQUNyQztTQUNFLElBQUksV0FBVyxFQUFFO1dBQ2YsT0FBTyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU07VUFDbkQ7U0FDRCxRQUFRLEdBQUcsQ0FBQyxFQUFFLEdBQUcsUUFBUSxFQUFFLFdBQVcsR0FBRTtTQUN4QyxXQUFXLEdBQUcsS0FBSTtNQUNyQjtJQUNGO0VBQ0Y7Q0FDRCxNQUFNLENBQUMsVUFBVSxHQUFHLFdBQVU7QUFDOUI7QUFDQSxDQUFBLFNBQVMsWUFBWSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0dBQzNDLElBQUksV0FBVyxHQUFHLE1BQUs7QUFDekI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtHQUNFLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFO0tBQ3BDLEtBQUssR0FBRyxFQUFDO0lBQ1Y7QUFDSDtBQUNBO0FBQ0EsR0FBRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQzNCLEtBQUksT0FBTyxFQUFFO0lBQ1Y7QUFDSDtHQUNFLElBQUksR0FBRyxLQUFLLFNBQVMsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUM5QyxLQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTTtJQUNsQjtBQUNIO0FBQ0EsR0FBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUU7QUFDaEIsS0FBSSxPQUFPLEVBQUU7SUFDVjtBQUNIO0FBQ0E7R0FDRSxHQUFHLE1BQU0sRUFBQztHQUNWLEtBQUssTUFBTSxFQUFDO0FBQ2Q7QUFDQSxHQUFFLElBQUksR0FBRyxJQUFJLEtBQUssRUFBRTtBQUNwQixLQUFJLE9BQU8sRUFBRTtJQUNWO0FBQ0g7QUFDQSxHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxHQUFHLE9BQU07QUFDbEM7R0FDRSxPQUFPLElBQUksRUFBRTtBQUNmLEtBQUksUUFBUSxRQUFRO0FBQ3BCLE9BQU0sS0FBSyxLQUFLO1NBQ1IsT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUM7QUFDekM7T0FDTSxLQUFLLE1BQU0sQ0FBQztBQUNsQixPQUFNLEtBQUssT0FBTztTQUNWLE9BQU8sU0FBUyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDO0FBQzFDO0FBQ0EsT0FBTSxLQUFLLE9BQU87U0FDVixPQUFPLFVBQVUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQztBQUMzQztPQUNNLEtBQUssUUFBUSxDQUFDO0FBQ3BCLE9BQU0sS0FBSyxRQUFRO1NBQ1gsT0FBTyxXQUFXLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUM7QUFDNUM7QUFDQSxPQUFNLEtBQUssUUFBUTtTQUNYLE9BQU8sV0FBVyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDO0FBQzVDO09BQ00sS0FBSyxNQUFNLENBQUM7T0FDWixLQUFLLE9BQU8sQ0FBQztPQUNiLEtBQUssU0FBUyxDQUFDO0FBQ3JCLE9BQU0sS0FBSyxVQUFVO1NBQ2IsT0FBTyxZQUFZLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUM7QUFDN0M7T0FDTTtTQUNFLElBQUksV0FBVyxFQUFFLE1BQU0sSUFBSSxTQUFTLENBQUMsb0JBQW9CLEdBQUcsUUFBUSxDQUFDO1NBQ3JFLFFBQVEsR0FBRyxDQUFDLFFBQVEsR0FBRyxFQUFFLEVBQUUsV0FBVyxHQUFFO1NBQ3hDLFdBQVcsR0FBRyxLQUFJO01BQ3JCO0lBQ0Y7RUFDRjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxLQUFJO0FBQ2pDO0FBQ0EsQ0FBQSxTQUFTLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUN4QixHQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUM7R0FDWixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBQztBQUNiLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUM7RUFDVDtBQUNEO0FBQ0EsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxTQUFTLE1BQU0sSUFBSTtBQUM3QyxHQUFFLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFNO0FBQ3ZCLEdBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUNyQixLQUFJLE1BQU0sSUFBSSxVQUFVLENBQUMsMkNBQTJDLENBQUM7SUFDbEU7QUFDSCxHQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtLQUMvQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFDO0lBQ3JCO0FBQ0gsR0FBRSxPQUFPLElBQUk7R0FDWjtBQUNEO0FBQ0EsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxTQUFTLE1BQU0sSUFBSTtBQUM3QyxHQUFFLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFNO0FBQ3ZCLEdBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUNyQixLQUFJLE1BQU0sSUFBSSxVQUFVLENBQUMsMkNBQTJDLENBQUM7SUFDbEU7QUFDSCxHQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtLQUMvQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFDO0tBQ3BCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFDO0lBQ3pCO0FBQ0gsR0FBRSxPQUFPLElBQUk7R0FDWjtBQUNEO0FBQ0EsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxTQUFTLE1BQU0sSUFBSTtBQUM3QyxHQUFFLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFNO0FBQ3ZCLEdBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUNyQixLQUFJLE1BQU0sSUFBSSxVQUFVLENBQUMsMkNBQTJDLENBQUM7SUFDbEU7QUFDSCxHQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtLQUMvQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxD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QUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsVUFBVSxFQUFDO0dBQ3JDLElBQUksR0FBRyxHQUFHLEVBQUM7R0FDWCxPQUFPLFVBQVUsR0FBRyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxFQUFFO0tBQ3ZDLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsVUFBVSxDQUFDLEdBQUcsSUFBRztJQUN6QztBQUNIO0FBQ0EsR0FBRSxPQUFPLEdBQUc7R0FDWDtBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTO0NBQzFCLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLFNBQVMsU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7QUFDbkUsR0FBRSxNQUFNLEdBQUcsTUFBTSxLQUFLLEVBQUM7QUFDdkIsR0FBRSxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUM7QUFDcEQsR0FBRSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7R0FDcEI7QUFDRDtDQUNBLE1BQU0sQ0FBQyxTQUFTLENBQUMsWUFBWTtDQUM3QixNQUFNLENBQUMsU0FBUyxDQUFDLFlBQVksR0FBRyxTQUFTLFlBQVksRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0FBQ3pFLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDO0FBQ3BELEdBQUUsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7R0FDOUM7QUFDRDtDQUNBLE1BQU0sQ0FBQyxTQUFTLENBQUMsWUFBWTtDQUM3QixNQUFNLENBQUMsU0FBUyxDQUFDLFlBQVksR0FBRyxTQUFTLFlBQVksRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0FBQ3pFLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDO0FBQ3BELEdBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7R0FDOUM7QUFDRDtDQUNBLE1BQU0sQ0FBQyxTQUFTLENBQUMsWUFBWTtDQUM3QixNQUFNLENBQUMsU0FBUyxDQUFDLFlBQVksR0FBRyxTQUFTLFlBQVksRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0FBQ3pFLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDO0FBQ3BEO0FBQ0EsR0FBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ2hCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDO0dBQ25DO0FBQ0Q7Q0FDQSxNQUFNLENBQUMsU0FBUyxDQUFDLFlBQVk7Q0FDN0IsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUN6RSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUNwRDtBQUNBLEdBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxTQUFTO01BQzdCLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFO01BQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNCLEtBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztHQUNwQjtBQUNEO0FBQ0EsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxTQUFTLFNBQVMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRTtBQUMvRSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLFVBQVUsR0FBRyxVQUFVLEtBQUssRUFBQztBQUMvQixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUM3RDtBQUNBLEdBQUUsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBQztHQUN0QixJQUFJLEdBQUcsR0FBRyxFQUFDO0dBQ1gsSUFBSSxDQUFDLEdBQUcsRUFBQztHQUNULE9BQU8sRUFBRSxDQUFDLEdBQUcsVUFBVSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRTtLQUN6QyxHQUFHLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFHO0lBQzlCO0dBQ0QsR0FBRyxJQUFJLEtBQUk7QUFDYjtBQUNBLEdBQUUsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFDO0FBQ3BEO0FBQ0EsR0FBRSxPQUFPLEdBQUc7R0FDWDtBQUNEO0FBQ0EsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxTQUFTLFNBQVMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRTtBQUMvRSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLFVBQVUsR0FBRyxVQUFVLEtBQUssRUFBQztBQUMvQixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUM3RDtHQUNFLElBQUksQ0FBQyxHQUFHLFdBQVU7R0FDbEIsSUFBSSxHQUFHLEdBQUcsRUFBQztHQUNYLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDLEVBQUM7R0FDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRTtLQUM5QixHQUFHLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUc7SUFDaEM7R0FDRCxHQUFHLElBQUksS0FBSTtBQUNiO0FBQ0EsR0FBRSxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLEVBQUM7QUFDcEQ7QUFDQSxHQUFFLE9BQU8sR0FBRztHQUNYO0FBQ0Q7Q0FDQSxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxTQUFTLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0FBQ2pFLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDO0FBQ3BELEdBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxRQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuRCxHQUFFLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztHQUN4QztBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsU0FBUyxXQUFXLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUN2RSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUNwRCxHQUFFLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQztHQUNoRCxPQUFPLENBQUMsR0FBRyxHQUFHLE1BQU0sSUFBSSxHQUFHLEdBQUcsVUFBVSxHQUFHLEdBQUc7R0FDL0M7QUFDRDtDQUNBLE1BQU0sQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLFNBQVMsV0FBVyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7QUFDdkUsR0FBRSxNQUFNLEdBQUcsTUFBTSxLQUFLLEVBQUM7QUFDdkIsR0FBRSxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUM7QUFDcEQsR0FBRSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUM7R0FDaEQsT0FBTyxDQUFDLEdBQUcsR0FBRyxNQUFNLElBQUksR0FBRyxHQUFHLFVBQVUsR0FBRyxHQUFHO0dBQy9DO0FBQ0Q7Q0FDQSxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxTQUFTLFdBQVcsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0FBQ3ZFLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDO0FBQ3BEO0FBQ0EsR0FBRSxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztNQUNqQixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztNQUN0QixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztNQUN2QixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztHQUMzQjtBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsU0FBUyxXQUFXLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUN2RSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUNwRDtBQUNBLEdBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO01BQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO01BQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNCLE1BQUssSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztHQUNyQjtBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsU0FBUyxXQUFXLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUN2RSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUNwRCxHQUFFLE9BQU9ELFNBQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztHQUMvQztBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsU0FBUyxXQUFXLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUN2RSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUNwRCxHQUFFLE9BQU9BLFNBQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztHQUNoRDtBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUN6RSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUNwRCxHQUFFLE9BQU9BLFNBQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztHQUMvQztBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUN6RSxHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUNwRCxHQUFFLE9BQU9BLFNBQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztHQUNoRDtBQUNEO0FBQ0EsQ0FBQSxTQUFTLFFBQVEsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUN0RCxHQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sSUFBSSxTQUFTLENBQUMsNkNBQTZDLENBQUM7QUFDL0YsR0FBRSxJQUFJLEtBQUssR0FBRyxHQUFHLElBQUksS0FBSyxHQUFHLEdBQUcsRUFBRSxNQUFNLElBQUksVUFBVSxDQUFDLG1DQUFtQyxDQUFDO0FBQzNGLEdBQUUsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxJQUFJLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQztFQUMxRTtBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXO0FBQzVCLENBQUEsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsU0FBUyxXQUFXLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFO0dBQ3hGLEtBQUssR0FBRyxDQUFDLE1BQUs7QUFDaEIsR0FBRSxNQUFNLEdBQUcsTUFBTSxLQUFLLEVBQUM7QUFDdkIsR0FBRSxVQUFVLEdBQUcsVUFBVSxLQUFLLEVBQUM7R0FDN0IsSUFBSSxDQUFDLFFBQVEsRUFBRTtBQUNqQixLQUFJLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFDO0FBQ2xELEtBQUksUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFDO0lBQ3ZEO0FBQ0g7R0FDRSxJQUFJLEdBQUcsR0FBRyxFQUFDO0dBQ1gsSUFBSSxDQUFDLEdBQUcsRUFBQztBQUNYLEdBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEtBQUssR0FBRyxLQUFJO0dBQzNCLE9BQU8sRUFBRSxDQUFDLEdBQUcsVUFBVSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRTtBQUM3QyxLQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsR0FBRyxJQUFJLEtBQUk7SUFDeEM7QUFDSDtHQUNFLE9BQU8sTUFBTSxHQUFHLFVBQVU7R0FDM0I7QUFDRDtDQUNBLE1BQU0sQ0FBQyxTQUFTLENBQUMsV0FBVztBQUM1QixDQUFBLE1BQU0sQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLFNBQVMsV0FBVyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRTtHQUN4RixLQUFLLEdBQUcsQ0FBQyxNQUFLO0FBQ2hCLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsVUFBVSxHQUFHLFVBQVUsS0FBSyxFQUFDO0dBQzdCLElBQUksQ0FBQyxRQUFRLEVBQUU7QUFDakIsS0FBSSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBQztBQUNsRCxLQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBQztJQUN2RDtBQUNIO0FBQ0EsR0FBRSxJQUFJLENBQUMsR0FBRyxVQUFVLEdBQUcsRUFBQztHQUN0QixJQUFJLEdBQUcsR0FBRyxFQUFDO0dBQ1gsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxLQUFLLEdBQUcsS0FBSTtHQUMvQixPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEVBQUU7QUFDckMsS0FBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxHQUFHLEdBQUcsSUFBSSxLQUFJO0lBQ3hDO0FBQ0g7R0FDRSxPQUFPLE1BQU0sR0FBRyxVQUFVO0dBQzNCO0FBQ0Q7Q0FDQSxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVU7QUFDM0IsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxTQUFTLFVBQVUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtHQUMxRSxLQUFLLEdBQUcsQ0FBQyxNQUFLO0FBQ2hCLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7R0FDeEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssR0FBRyxJQUFJLEVBQUM7R0FDN0IsT0FBTyxNQUFNLEdBQUcsQ0FBQztHQUNsQjtBQUNEO0NBQ0EsTUFBTSxDQUFDLFNBQVMsQ0FBQyxhQUFhO0FBQzlCLENBQUEsTUFBTSxDQUFDLFNBQVMsQ0FBQyxhQUFhLEdBQUcsU0FBUyxhQUFhLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7R0FDaEYsS0FBSyxHQUFHLENBQUMsTUFBSztBQUNoQixHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFDO0dBQzFELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLEdBQUcsSUFBSSxFQUFDO0dBQzdCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsRUFBQztHQUNoQyxPQUFPLE1BQU0sR0FBRyxDQUFDO0dBQ2xCO0FBQ0Q7Q0FDQSxNQUFNLENBQUMsU0FBUyxDQUFDLGFBQWE7QUFDOUIsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLGFBQWEsR0FBRyxTQUFTLGFBQWEsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtHQUNoRixLQUFLLEdBQUcsQ0FBQyxNQUFLO0FBQ2hCLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUM7R0FDMUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUM7R0FDNUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLEdBQUcsSUFBSSxFQUFDO0dBQ2pDLE9BQU8sTUFBTSxHQUFHLENBQUM7R0FDbEI7QUFDRDtDQUNBLE1BQU0sQ0FBQyxTQUFTLENBQUMsYUFBYTtBQUM5QixDQUFBLE1BQU0sQ0FBQyxTQUFTLENBQUMsYUFBYSxHQUFHLFNBQVMsYUFBYSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0dBQ2hGLEtBQUssR0FBRyxDQUFDLE1BQUs7QUFDaEIsR0FBRSxNQUFNLEdBQUcsTUFBTSxLQUFLLEVBQUM7QUFDdkIsR0FBRSxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBQztHQUM5RCxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUssS0FBSyxFQUFFLEVBQUM7R0FDakMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLEtBQUssRUFBRSxFQUFDO0dBQ2pDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsRUFBQztHQUNoQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxHQUFHLElBQUksRUFBQztHQUM3QixPQUFPLE1BQU0sR0FBRyxDQUFDO0dBQ2xCO0FBQ0Q7Q0FDQSxNQUFNLENBQUMsU0FBUyxDQUFDLGFBQWE7QUFDOUIsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLGFBQWEsR0FBRyxTQUFTLGFBQWEsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtHQUNoRixLQUFLLEdBQUcsQ0FBQyxNQUFLO0FBQ2hCLEdBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxFQUFDO0FBQ3ZCLEdBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUM7R0FDOUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssS0FBSyxFQUFFLEVBQUM7R0FDN0IsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLEtBQUssRUFBRSxFQUFDO0dBQ2pDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsRUFBQztHQUNoQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUssR0FBRyxJQUFJLEVBQUM7R0FDakMsT0FBTyxNQUFNLEdBQUcsQ0FBQztHQUNsQjtBQUNEO0FBQ0EsQ0FBQSxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxTQUFTLFVBQVUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUU7R0FDdEYsS0FBSyxHQUFHLENBQUMsTUFBSztBQUNoQixHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztHQUNyQixJQUFJLENBQUMsUUFBUSxFQUFFO0FBQ2pCLEtBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxJQUFJLENBQUMsRUFBQztBQUNqRDtBQUNBLEtBQUksUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFDO0lBQzdEO0FBQ0g7R0FDRSxJQUFJLENBQUMsR0FBRyxFQUFDO0dBQ1QsSUFBSSxHQUFHLEdBQUcsRUFBQztHQUNYLElBQUksR0FBRyxHQUFHLEVBQUM7QUFDYixHQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxLQUFLLEdBQUcsS0FBSTtHQUMzQixPQUFPLEVBQUUsQ0FBQyxHQUFHLFVBQVUsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEVBQUU7QUFDN0MsS0FBSSxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUU7T0FDeEQsR0FBRyxHQUFHLEVBQUM7TUFDUjtBQUNMLEtBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLEtBQUk7SUFDckQ7QUFDSDtHQUNFLE9BQU8sTUFBTSxHQUFHLFVBQVU7R0FDM0I7QUFDRDtBQUNBLENBQUEsTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsU0FBUyxVQUFVLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFO0dBQ3RGLEtBQUssR0FBRyxDQUFDLE1BQUs7QUFDaEIsR0FBRSxNQUFNLEdBQUcsTUFBTSxLQUFLLEVBQUM7R0FDckIsSUFBSSxDQUFDLFFBQVEsRUFBRTtBQUNqQixLQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFVBQVUsSUFBSSxDQUFDLEVBQUM7QUFDakQ7QUFDQSxLQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBQztJQUM3RDtBQUNIO0FBQ0EsR0FBRSxJQUFJLENBQUMsR0FBRyxVQUFVLEdBQUcsRUFBQztHQUN0QixJQUFJLEdBQUcsR0FBRyxFQUFDO0dBQ1gsSUFBSSxHQUFHLEdBQUcsRUFBQztHQUNYLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLEtBQUk7R0FDL0IsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxFQUFFO0FBQ3JDLEtBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFO09BQ3hELEdBQUcsR0FBRyxFQUFDO01BQ1I7QUFDTCxLQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxLQUFJO0lBQ3JEO0FBQ0g7R0FDRSxPQUFPLE1BQU0sR0FBRyxVQUFVO0dBQzNCO0FBQ0Q7QUFDQSxDQUFBLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLFNBQVMsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0dBQ3hFLEtBQUssR0FBRyxDQUFDLE1BQUs7QUFDaEIsR0FBRSxNQUFNLEdBQUcsTUFBTSxLQUFLLEVBQUM7QUFDdkIsR0FBRSxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFDO0dBQzVELElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRyxFQUFDO0dBQ3ZDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLEdBQUcsSUFBSSxFQUFDO0dBQzdCLE9BQU8sTUFBTSxHQUFHLENBQUM7R0FDbEI7QUFDRDtBQUNBLENBQUEsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7R0FDOUUsS0FBSyxHQUFHLENBQUMsTUFBSztBQUNoQixHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUM7R0FDaEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssR0FBRyxJQUFJLEVBQUM7R0FDN0IsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxFQUFDO0dBQ2hDLE9BQU8sTUFBTSxHQUFHLENBQUM7R0FDbEI7QUFDRDtBQUNBLENBQUEsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7R0FDOUUsS0FBSyxHQUFHLENBQUMsTUFBSztBQUNoQixHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUM7R0FDaEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUM7R0FDNUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLEdBQUcsSUFBSSxFQUFDO0dBQ2pDLE9BQU8sTUFBTSxHQUFHLENBQUM7R0FDbEI7QUFDRDtBQUNBLENBQUEsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7R0FDOUUsS0FBSyxHQUFHLENBQUMsTUFBSztBQUNoQixHQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssRUFBQztBQUN2QixHQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxD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QUMvR0YsZUFBZTtBQUNmLEVBQUUsTUFBTSxFQUFFLFVBQVUsVUFBVSxFQUFFO0FBQ2hDLElBQUksT0FBTyxNQUFNLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0QsR0FBRztBQUNILEVBQUUsTUFBTSxFQUFFLFVBQVUsa0JBQWtCLEVBQUU7QUFDeEMsSUFBSSxJQUFJLEdBQUcsR0FBRyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUM1QyxJQUFJLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0QsR0FBRztBQUNILEVBQUUsVUFBVSxFQUFFLE1BQU07QUFDcEIsRUFBRSxVQUFVLEVBQUUsTUFBTTtBQUNwQixDQUFDOztBQ0xELElBQUksS0FBSyxHQUFHLElBQUlhLE9BQUssRUFBRSxDQUFDO0FBQ3hCO0FBQ0EsU0FBUyxhQUFhLENBQUMsRUFBRSxFQUFFO0FBQzNCLEVBQUUsT0FBT0MsUUFBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3JFOzs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDEsMiwzLDQsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4XX0=
