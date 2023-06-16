import { a as getAugmentedNamespace, c as commonjsGlobal, g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import require$$1$1 from 'util';
import require$$0$1 from 'punycode';

var cookie = {};

/** Highest positive signed 32-bit float value */
const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

/** Bootstring parameters */
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128; // 0x80
const delimiter = '-'; // '\x2D'

/** Regular expressions */
const regexPunycode = /^xn--/;
const regexNonASCII = /[^\0-\x7F]/; // Note: U+007F DEL is excluded too.
const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

/** Error messages */
const errors = {
	'overflow': 'Overflow: input needs wider integers to process',
	'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
	'invalid-input': 'Invalid input'
};

/** Convenience shortcuts */
const baseMinusTMin = base - tMin;
const floor = Math.floor;
const stringFromCharCode = String.fromCharCode;

/*--------------------------------------------------------------------------*/

/**
 * A generic error utility function.
 * @private
 * @param {String} type The error type.
 * @returns {Error} Throws a `RangeError` with the applicable error message.
 */
function error(type) {
	throw new RangeError(errors[type]);
}

/**
 * A generic `Array#map` utility function.
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} callback The function that gets called for every array
 * item.
 * @returns {Array} A new array of values returned by the callback function.
 */
function map(array, callback) {
	const result = [];
	let length = array.length;
	while (length--) {
		result[length] = callback(array[length]);
	}
	return result;
}

/**
 * A simple `Array#map`-like wrapper to work with domain name strings or email
 * addresses.
 * @private
 * @param {String} domain The domain name or email address.
 * @param {Function} callback The function that gets called for every
 * character.
 * @returns {String} A new string of characters returned by the callback
 * function.
 */
function mapDomain(domain, callback) {
	const parts = domain.split('@');
	let result = '';
	if (parts.length > 1) {
		// In email addresses, only the domain name should be punycoded. Leave
		// the local part (i.e. everything up to `@`) intact.
		result = parts[0] + '@';
		domain = parts[1];
	}
	// Avoid `split(regex)` for IE8 compatibility. See #17.
	domain = domain.replace(regexSeparators, '\x2E');
	const labels = domain.split('.');
	const encoded = map(labels, callback).join('.');
	return result + encoded;
}

/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 * @see `punycode.ucs2.encode`
 * @see <https://mathiasbynens.be/notes/javascript-encoding>
 * @memberOf punycode.ucs2
 * @name decode
 * @param {String} string The Unicode input string (UCS-2).
 * @returns {Array} The new array of code points.
 */
function ucs2decode(string) {
	const output = [];
	let counter = 0;
	const length = string.length;
	while (counter < length) {
		const value = string.charCodeAt(counter++);
		if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
			// It's a high surrogate, and there is a next character.
			const extra = string.charCodeAt(counter++);
			if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
				output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
			} else {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				output.push(value);
				counter--;
			}
		} else {
			output.push(value);
		}
	}
	return output;
}

/**
 * Creates a string based on an array of numeric code points.
 * @see `punycode.ucs2.decode`
 * @memberOf punycode.ucs2
 * @name encode
 * @param {Array} codePoints The array of numeric code points.
 * @returns {String} The new Unicode string (UCS-2).
 */
const ucs2encode = codePoints => String.fromCodePoint(...codePoints);

/**
 * Converts a basic code point into a digit/integer.
 * @see `digitToBasic()`
 * @private
 * @param {Number} codePoint The basic numeric code point value.
 * @returns {Number} The numeric value of a basic code point (for use in
 * representing integers) in the range `0` to `base - 1`, or `base` if
 * the code point does not represent a value.
 */
const basicToDigit = function(codePoint) {
	if (codePoint >= 0x30 && codePoint < 0x3A) {
		return 26 + (codePoint - 0x30);
	}
	if (codePoint >= 0x41 && codePoint < 0x5B) {
		return codePoint - 0x41;
	}
	if (codePoint >= 0x61 && codePoint < 0x7B) {
		return codePoint - 0x61;
	}
	return base;
};

/**
 * Converts a digit/integer into a basic code point.
 * @see `basicToDigit()`
 * @private
 * @param {Number} digit The numeric value of a basic code point.
 * @returns {Number} The basic code point whose value (when used for
 * representing integers) is `digit`, which needs to be in the range
 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
 * used; else, the lowercase form is used. The behavior is undefined
 * if `flag` is non-zero and `digit` has no uppercase form.
 */
const digitToBasic = function(digit, flag) {
	//  0..25 map to ASCII a..z or A..Z
	// 26..35 map to ASCII 0..9
	return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};

/**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 * @private
 */
const adapt = function(delta, numPoints, firstTime) {
	let k = 0;
	delta = firstTime ? floor(delta / damp) : delta >> 1;
	delta += floor(delta / numPoints);
	for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
		delta = floor(delta / baseMinusTMin);
	}
	return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};

/**
 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
 * symbols.
 * @memberOf punycode
 * @param {String} input The Punycode string of ASCII-only symbols.
 * @returns {String} The resulting string of Unicode symbols.
 */
const decode$1 = function(input) {
	// Don't use UCS-2.
	const output = [];
	const inputLength = input.length;
	let i = 0;
	let n = initialN;
	let bias = initialBias;

	// Handle the basic code points: let `basic` be the number of input code
	// points before the last delimiter, or `0` if there is none, then copy
	// the first basic code points to the output.

	let basic = input.lastIndexOf(delimiter);
	if (basic < 0) {
		basic = 0;
	}

	for (let j = 0; j < basic; ++j) {
		// if it's not a basic code point
		if (input.charCodeAt(j) >= 0x80) {
			error('not-basic');
		}
		output.push(input.charCodeAt(j));
	}

	// Main decoding loop: start just after the last delimiter if any basic code
	// points were copied; start at the beginning otherwise.

	for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

		// `index` is the index of the next character to be consumed.
		// Decode a generalized variable-length integer into `delta`,
		// which gets added to `i`. The overflow checking is easier
		// if we increase `i` as we go, then subtract off its starting
		// value at the end to obtain `delta`.
		const oldi = i;
		for (let w = 1, k = base; /* no condition */; k += base) {

			if (index >= inputLength) {
				error('invalid-input');
			}

			const digit = basicToDigit(input.charCodeAt(index++));

			if (digit >= base) {
				error('invalid-input');
			}
			if (digit > floor((maxInt - i) / w)) {
				error('overflow');
			}

			i += digit * w;
			const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

			if (digit < t) {
				break;
			}

			const baseMinusT = base - t;
			if (w > floor(maxInt / baseMinusT)) {
				error('overflow');
			}

			w *= baseMinusT;

		}

		const out = output.length + 1;
		bias = adapt(i - oldi, out, oldi == 0);

		// `i` was supposed to wrap around from `out` to `0`,
		// incrementing `n` each time, so we'll fix that now:
		if (floor(i / out) > maxInt - n) {
			error('overflow');
		}

		n += floor(i / out);
		i %= out;

		// Insert `n` at position `i` of the output.
		output.splice(i++, 0, n);

	}

	return String.fromCodePoint(...output);
};

/**
 * Converts a string of Unicode symbols (e.g. a domain name label) to a
 * Punycode string of ASCII-only symbols.
 * @memberOf punycode
 * @param {String} input The string of Unicode symbols.
 * @returns {String} The resulting Punycode string of ASCII-only symbols.
 */
const encode$1 = function(input) {
	const output = [];

	// Convert the input in UCS-2 to an array of Unicode code points.
	input = ucs2decode(input);

	// Cache the length.
	const inputLength = input.length;

	// Initialize the state.
	let n = initialN;
	let delta = 0;
	let bias = initialBias;

	// Handle the basic code points.
	for (const currentValue of input) {
		if (currentValue < 0x80) {
			output.push(stringFromCharCode(currentValue));
		}
	}

	const basicLength = output.length;
	let handledCPCount = basicLength;

	// `handledCPCount` is the number of code points that have been handled;
	// `basicLength` is the number of basic code points.

	// Finish the basic string with a delimiter unless it's empty.
	if (basicLength) {
		output.push(delimiter);
	}

	// Main encoding loop:
	while (handledCPCount < inputLength) {

		// All non-basic code points < n have been handled already. Find the next
		// larger one:
		let m = maxInt;
		for (const currentValue of input) {
			if (currentValue >= n && currentValue < m) {
				m = currentValue;
			}
		}

		// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
		// but guard against overflow.
		const handledCPCountPlusOne = handledCPCount + 1;
		if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
			error('overflow');
		}

		delta += (m - n) * handledCPCountPlusOne;
		n = m;

		for (const currentValue of input) {
			if (currentValue < n && ++delta > maxInt) {
				error('overflow');
			}
			if (currentValue === n) {
				// Represent delta as a generalized variable-length integer.
				let q = delta;
				for (let k = base; /* no condition */; k += base) {
					const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
					if (q < t) {
						break;
					}
					const qMinusT = q - t;
					const baseMinusT = base - t;
					output.push(
						stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
					);
					q = floor(qMinusT / baseMinusT);
				}

				output.push(stringFromCharCode(digitToBasic(q, 0)));
				bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
				delta = 0;
				++handledCPCount;
			}
		}

		++delta;
		++n;

	}
	return output.join('');
};

/**
 * Converts a Punycode string representing a domain name or an email address
 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
 * it doesn't matter if you call it on a string that has already been
 * converted to Unicode.
 * @memberOf punycode
 * @param {String} input The Punycoded domain name or email address to
 * convert to Unicode.
 * @returns {String} The Unicode representation of the given Punycode
 * string.
 */
const toUnicode = function(input) {
	return mapDomain(input, function(string) {
		return regexPunycode.test(string)
			? decode$1(string.slice(4).toLowerCase())
			: string;
	});
};

/**
 * Converts a Unicode string representing a domain name or an email address to
 * Punycode. Only the non-ASCII parts of the domain name will be converted,
 * i.e. it doesn't matter if you call it with a domain that's already in
 * ASCII.
 * @memberOf punycode
 * @param {String} input The domain name or email address to convert, as a
 * Unicode string.
 * @returns {String} The Punycode representation of the given domain name or
 * email address.
 */
const toASCII = function(input) {
	return mapDomain(input, function(string) {
		return regexNonASCII.test(string)
			? 'xn--' + encode$1(string)
			: string;
	});
};

/*--------------------------------------------------------------------------*/

/** Define the public API */
const punycode$1 = {
	/**
	 * A string representing the current Punycode.js version number.
	 * @memberOf punycode
	 * @type String
	 */
	'version': '2.1.0',
	/**
	 * An object of methods to convert from JavaScript's internal character
	 * representation (UCS-2) to Unicode code points, and back.
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode
	 * @type Object
	 */
	'ucs2': {
		'decode': ucs2decode,
		'encode': ucs2encode
	},
	'decode': decode$1,
	'encode': encode$1,
	'toASCII': toASCII,
	'toUnicode': toUnicode
};

var punycode_es6 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	ucs2decode: ucs2decode,
	ucs2encode: ucs2encode,
	decode: decode$1,
	encode: encode$1,
	toASCII: toASCII,
	toUnicode: toUnicode,
	default: punycode$1
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(punycode_es6);

/**
 * Check if we're required to add a port number.
 *
 * @see https://url.spec.whatwg.org/#default-port
 * @param {Number|String} port Port number we need to check
 * @param {String} protocol Protocol we need to check against.
 * @returns {Boolean} Is it a default port for the given protocol
 * @api private
 */
var requiresPort = function required(port, protocol) {
  protocol = protocol.split(':')[0];
  port = +port;

  if (!port) return false;

  switch (protocol) {
    case 'http':
    case 'ws':
    return port !== 80;

    case 'https':
    case 'wss':
    return port !== 443;

    case 'ftp':
    return port !== 21;

    case 'gopher':
    return port !== 70;

    case 'file':
    return false;
  }

  return port !== 0;
};

var querystringify$1 = {};

var has = Object.prototype.hasOwnProperty
  , undef;

/**
 * Decode a URI encoded string.
 *
 * @param {String} input The URI encoded string.
 * @returns {String|Null} The decoded string.
 * @api private
 */
function decode(input) {
  try {
    return decodeURIComponent(input.replace(/\+/g, ' '));
  } catch (e) {
    return null;
  }
}

/**
 * Attempts to encode a given input.
 *
 * @param {String} input The string that needs to be encoded.
 * @returns {String|Null} The encoded string.
 * @api private
 */
function encode(input) {
  try {
    return encodeURIComponent(input);
  } catch (e) {
    return null;
  }
}

/**
 * Simple query string parser.
 *
 * @param {String} query The query string that needs to be parsed.
 * @returns {Object}
 * @api public
 */
function querystring(query) {
  var parser = /([^=?#&]+)=?([^&]*)/g
    , result = {}
    , part;

  while (part = parser.exec(query)) {
    var key = decode(part[1])
      , value = decode(part[2]);

    //
    // Prevent overriding of existing properties. This ensures that build-in
    // methods like `toString` or __proto__ are not overriden by malicious
    // querystrings.
    //
    // In the case if failed decoding, we want to omit the key/value pairs
    // from the result.
    //
    if (key === null || value === null || key in result) continue;
    result[key] = value;
  }

  return result;
}

/**
 * Transform a query string to an object.
 *
 * @param {Object} obj Object that should be transformed.
 * @param {String} prefix Optional prefix.
 * @returns {String}
 * @api public
 */
function querystringify(obj, prefix) {
  prefix = prefix || '';

  var pairs = []
    , value
    , key;

  //
  // Optionally prefix with a '?' if needed
  //
  if ('string' !== typeof prefix) prefix = '?';

  for (key in obj) {
    if (has.call(obj, key)) {
      value = obj[key];

      //
      // Edge cases where we actually want to encode the value to an empty
      // string instead of the stringified value.
      //
      if (!value && (value === null || value === undef || isNaN(value))) {
        value = '';
      }

      key = encode(key);
      value = encode(value);

      //
      // If we failed to encode the strings, we should bail out as we don't
      // want to add invalid strings to the query.
      //
      if (key === null || value === null) continue;
      pairs.push(key +'='+ value);
    }
  }

  return pairs.length ? prefix + pairs.join('&') : '';
}

//
// Expose the module.
//
querystringify$1.stringify = querystringify;
querystringify$1.parse = querystring;

var required = requiresPort
  , qs = querystringify$1
  , controlOrWhitespace = /^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/
  , CRHTLF = /[\n\r\t]/g
  , slashes = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//
  , port = /:\d+$/
  , protocolre = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\\/]+)?([\S\s]*)/i
  , windowsDriveLetter = /^[a-zA-Z]:/;

/**
 * Remove control characters and whitespace from the beginning of a string.
 *
 * @param {Object|String} str String to trim.
 * @returns {String} A new string representing `str` stripped of control
 *     characters and whitespace from its beginning.
 * @public
 */
function trimLeft(str) {
  return (str ? str : '').toString().replace(controlOrWhitespace, '');
}

/**
 * These are the parse rules for the URL parser, it informs the parser
 * about:
 *
 * 0. The char it Needs to parse, if it's a string it should be done using
 *    indexOf, RegExp using exec and NaN means set as current value.
 * 1. The property we should set when parsing this value.
 * 2. Indication if it's backwards or forward parsing, when set as number it's
 *    the value of extra chars that should be split off.
 * 3. Inherit from location if non existing in the parser.
 * 4. `toLowerCase` the resulting value.
 */
var rules = [
  ['#', 'hash'],                        // Extract from the back.
  ['?', 'query'],                       // Extract from the back.
  function sanitize(address, url) {     // Sanitize what is left of the address
    return isSpecial(url.protocol) ? address.replace(/\\/g, '/') : address;
  },
  ['/', 'pathname'],                    // Extract from the back.
  ['@', 'auth', 1],                     // Extract from the front.
  [NaN, 'host', undefined, 1, 1],       // Set left over value.
  [/:(\d*)$/, 'port', undefined, 1],    // RegExp the back.
  [NaN, 'hostname', undefined, 1, 1]    // Set left over.
];

/**
 * These properties should not be copied or inherited from. This is only needed
 * for all non blob URL's as a blob URL does not include a hash, only the
 * origin.
 *
 * @type {Object}
 * @private
 */
var ignore = { hash: 1, query: 1 };

/**
 * The location object differs when your code is loaded through a normal page,
 * Worker or through a worker using a blob. And with the blobble begins the
 * trouble as the location object will contain the URL of the blob, not the
 * location of the page where our code is loaded in. The actual origin is
 * encoded in the `pathname` so we can thankfully generate a good "default"
 * location from it so we can generate proper relative URL's again.
 *
 * @param {Object|String} loc Optional default location object.
 * @returns {Object} lolcation object.
 * @public
 */
function lolcation(loc) {
  var globalVar;

  if (typeof window !== 'undefined') globalVar = window;
  else if (typeof commonjsGlobal !== 'undefined') globalVar = commonjsGlobal;
  else if (typeof self !== 'undefined') globalVar = self;
  else globalVar = {};

  var location = globalVar.location || {};
  loc = loc || location;

  var finaldestination = {}
    , type = typeof loc
    , key;

  if ('blob:' === loc.protocol) {
    finaldestination = new Url(unescape(loc.pathname), {});
  } else if ('string' === type) {
    finaldestination = new Url(loc, {});
    for (key in ignore) delete finaldestination[key];
  } else if ('object' === type) {
    for (key in loc) {
      if (key in ignore) continue;
      finaldestination[key] = loc[key];
    }

    if (finaldestination.slashes === undefined) {
      finaldestination.slashes = slashes.test(loc.href);
    }
  }

  return finaldestination;
}

/**
 * Check whether a protocol scheme is special.
 *
 * @param {String} The protocol scheme of the URL
 * @return {Boolean} `true` if the protocol scheme is special, else `false`
 * @private
 */
function isSpecial(scheme) {
  return (
    scheme === 'file:' ||
    scheme === 'ftp:' ||
    scheme === 'http:' ||
    scheme === 'https:' ||
    scheme === 'ws:' ||
    scheme === 'wss:'
  );
}

/**
 * @typedef ProtocolExtract
 * @type Object
 * @property {String} protocol Protocol matched in the URL, in lowercase.
 * @property {Boolean} slashes `true` if protocol is followed by "//", else `false`.
 * @property {String} rest Rest of the URL that is not part of the protocol.
 */

/**
 * Extract protocol information from a URL with/without double slash ("//").
 *
 * @param {String} address URL we want to extract from.
 * @param {Object} location
 * @return {ProtocolExtract} Extracted information.
 * @private
 */
function extractProtocol(address, location) {
  address = trimLeft(address);
  address = address.replace(CRHTLF, '');
  location = location || {};

  var match = protocolre.exec(address);
  var protocol = match[1] ? match[1].toLowerCase() : '';
  var forwardSlashes = !!match[2];
  var otherSlashes = !!match[3];
  var slashesCount = 0;
  var rest;

  if (forwardSlashes) {
    if (otherSlashes) {
      rest = match[2] + match[3] + match[4];
      slashesCount = match[2].length + match[3].length;
    } else {
      rest = match[2] + match[4];
      slashesCount = match[2].length;
    }
  } else {
    if (otherSlashes) {
      rest = match[3] + match[4];
      slashesCount = match[3].length;
    } else {
      rest = match[4];
    }
  }

  if (protocol === 'file:') {
    if (slashesCount >= 2) {
      rest = rest.slice(2);
    }
  } else if (isSpecial(protocol)) {
    rest = match[4];
  } else if (protocol) {
    if (forwardSlashes) {
      rest = rest.slice(2);
    }
  } else if (slashesCount >= 2 && isSpecial(location.protocol)) {
    rest = match[4];
  }

  return {
    protocol: protocol,
    slashes: forwardSlashes || isSpecial(protocol),
    slashesCount: slashesCount,
    rest: rest
  };
}

/**
 * Resolve a relative URL pathname against a base URL pathname.
 *
 * @param {String} relative Pathname of the relative URL.
 * @param {String} base Pathname of the base URL.
 * @return {String} Resolved pathname.
 * @private
 */
function resolve(relative, base) {
  if (relative === '') return base;

  var path = (base || '/').split('/').slice(0, -1).concat(relative.split('/'))
    , i = path.length
    , last = path[i - 1]
    , unshift = false
    , up = 0;

  while (i--) {
    if (path[i] === '.') {
      path.splice(i, 1);
    } else if (path[i] === '..') {
      path.splice(i, 1);
      up++;
    } else if (up) {
      if (i === 0) unshift = true;
      path.splice(i, 1);
      up--;
    }
  }

  if (unshift) path.unshift('');
  if (last === '.' || last === '..') path.push('');

  return path.join('/');
}

/**
 * The actual URL instance. Instead of returning an object we've opted-in to
 * create an actual constructor as it's much more memory efficient and
 * faster and it pleases my OCD.
 *
 * It is worth noting that we should not use `URL` as class name to prevent
 * clashes with the global URL instance that got introduced in browsers.
 *
 * @constructor
 * @param {String} address URL we want to parse.
 * @param {Object|String} [location] Location defaults for relative paths.
 * @param {Boolean|Function} [parser] Parser for the query string.
 * @private
 */
function Url(address, location, parser) {
  address = trimLeft(address);
  address = address.replace(CRHTLF, '');

  if (!(this instanceof Url)) {
    return new Url(address, location, parser);
  }

  var relative, extracted, parse, instruction, index, key
    , instructions = rules.slice()
    , type = typeof location
    , url = this
    , i = 0;

  //
  // The following if statements allows this module two have compatibility with
  // 2 different API:
  //
  // 1. Node.js's `url.parse` api which accepts a URL, boolean as arguments
  //    where the boolean indicates that the query string should also be parsed.
  //
  // 2. The `URL` interface of the browser which accepts a URL, object as
  //    arguments. The supplied object will be used as default values / fall-back
  //    for relative paths.
  //
  if ('object' !== type && 'string' !== type) {
    parser = location;
    location = null;
  }

  if (parser && 'function' !== typeof parser) parser = qs.parse;

  location = lolcation(location);

  //
  // Extract protocol information before running the instructions.
  //
  extracted = extractProtocol(address || '', location);
  relative = !extracted.protocol && !extracted.slashes;
  url.slashes = extracted.slashes || relative && location.slashes;
  url.protocol = extracted.protocol || location.protocol || '';
  address = extracted.rest;

  //
  // When the authority component is absent the URL starts with a path
  // component.
  //
  if (
    extracted.protocol === 'file:' && (
      extracted.slashesCount !== 2 || windowsDriveLetter.test(address)) ||
    (!extracted.slashes &&
      (extracted.protocol ||
        extracted.slashesCount < 2 ||
        !isSpecial(url.protocol)))
  ) {
    instructions[3] = [/(.*)/, 'pathname'];
  }

  for (; i < instructions.length; i++) {
    instruction = instructions[i];

    if (typeof instruction === 'function') {
      address = instruction(address, url);
      continue;
    }

    parse = instruction[0];
    key = instruction[1];

    if (parse !== parse) {
      url[key] = address;
    } else if ('string' === typeof parse) {
      index = parse === '@'
        ? address.lastIndexOf(parse)
        : address.indexOf(parse);

      if (~index) {
        if ('number' === typeof instruction[2]) {
          url[key] = address.slice(0, index);
          address = address.slice(index + instruction[2]);
        } else {
          url[key] = address.slice(index);
          address = address.slice(0, index);
        }
      }
    } else if ((index = parse.exec(address))) {
      url[key] = index[1];
      address = address.slice(0, index.index);
    }

    url[key] = url[key] || (
      relative && instruction[3] ? location[key] || '' : ''
    );

    //
    // Hostname, host and protocol should be lowercased so they can be used to
    // create a proper `origin`.
    //
    if (instruction[4]) url[key] = url[key].toLowerCase();
  }

  //
  // Also parse the supplied query string in to an object. If we're supplied
  // with a custom parser as function use that instead of the default build-in
  // parser.
  //
  if (parser) url.query = parser(url.query);

  //
  // If the URL is relative, resolve the pathname against the base URL.
  //
  if (
      relative
    && location.slashes
    && url.pathname.charAt(0) !== '/'
    && (url.pathname !== '' || location.pathname !== '')
  ) {
    url.pathname = resolve(url.pathname, location.pathname);
  }

  //
  // Default to a / for pathname if none exists. This normalizes the URL
  // to always have a /
  //
  if (url.pathname.charAt(0) !== '/' && isSpecial(url.protocol)) {
    url.pathname = '/' + url.pathname;
  }

  //
  // We should not add port numbers if they are already the default port number
  // for a given protocol. As the host also contains the port number we're going
  // override it with the hostname which contains no port number.
  //
  if (!required(url.port, url.protocol)) {
    url.host = url.hostname;
    url.port = '';
  }

  //
  // Parse down the `auth` for the username and password.
  //
  url.username = url.password = '';

  if (url.auth) {
    index = url.auth.indexOf(':');

    if (~index) {
      url.username = url.auth.slice(0, index);
      url.username = encodeURIComponent(decodeURIComponent(url.username));

      url.password = url.auth.slice(index + 1);
      url.password = encodeURIComponent(decodeURIComponent(url.password));
    } else {
      url.username = encodeURIComponent(decodeURIComponent(url.auth));
    }

    url.auth = url.password ? url.username +':'+ url.password : url.username;
  }

  url.origin = url.protocol !== 'file:' && isSpecial(url.protocol) && url.host
    ? url.protocol +'//'+ url.host
    : 'null';

  //
  // The href is just the compiled result.
  //
  url.href = url.toString();
}

/**
 * This is convenience method for changing properties in the URL instance to
 * insure that they all propagate correctly.
 *
 * @param {String} part          Property we need to adjust.
 * @param {Mixed} value          The newly assigned value.
 * @param {Boolean|Function} fn  When setting the query, it will be the function
 *                               used to parse the query.
 *                               When setting the protocol, double slash will be
 *                               removed from the final url if it is true.
 * @returns {URL} URL instance for chaining.
 * @public
 */
function set(part, value, fn) {
  var url = this;

  switch (part) {
    case 'query':
      if ('string' === typeof value && value.length) {
        value = (fn || qs.parse)(value);
      }

      url[part] = value;
      break;

    case 'port':
      url[part] = value;

      if (!required(value, url.protocol)) {
        url.host = url.hostname;
        url[part] = '';
      } else if (value) {
        url.host = url.hostname +':'+ value;
      }

      break;

    case 'hostname':
      url[part] = value;

      if (url.port) value += ':'+ url.port;
      url.host = value;
      break;

    case 'host':
      url[part] = value;

      if (port.test(value)) {
        value = value.split(':');
        url.port = value.pop();
        url.hostname = value.join(':');
      } else {
        url.hostname = value;
        url.port = '';
      }

      break;

    case 'protocol':
      url.protocol = value.toLowerCase();
      url.slashes = !fn;
      break;

    case 'pathname':
    case 'hash':
      if (value) {
        var char = part === 'pathname' ? '/' : '#';
        url[part] = value.charAt(0) !== char ? char + value : value;
      } else {
        url[part] = value;
      }
      break;

    case 'username':
    case 'password':
      url[part] = encodeURIComponent(value);
      break;

    case 'auth':
      var index = value.indexOf(':');

      if (~index) {
        url.username = value.slice(0, index);
        url.username = encodeURIComponent(decodeURIComponent(url.username));

        url.password = value.slice(index + 1);
        url.password = encodeURIComponent(decodeURIComponent(url.password));
      } else {
        url.username = encodeURIComponent(decodeURIComponent(value));
      }
  }

  for (var i = 0; i < rules.length; i++) {
    var ins = rules[i];

    if (ins[4]) url[ins[1]] = url[ins[1]].toLowerCase();
  }

  url.auth = url.password ? url.username +':'+ url.password : url.username;

  url.origin = url.protocol !== 'file:' && isSpecial(url.protocol) && url.host
    ? url.protocol +'//'+ url.host
    : 'null';

  url.href = url.toString();

  return url;
}

/**
 * Transform the properties back in to a valid and full URL string.
 *
 * @param {Function} stringify Optional query stringify function.
 * @returns {String} Compiled version of the URL.
 * @public
 */
function toString$1(stringify) {
  if (!stringify || 'function' !== typeof stringify) stringify = qs.stringify;

  var query
    , url = this
    , host = url.host
    , protocol = url.protocol;

  if (protocol && protocol.charAt(protocol.length - 1) !== ':') protocol += ':';

  var result =
    protocol +
    ((url.protocol && url.slashes) || isSpecial(url.protocol) ? '//' : '');

  if (url.username) {
    result += url.username;
    if (url.password) result += ':'+ url.password;
    result += '@';
  } else if (url.password) {
    result += ':'+ url.password;
    result += '@';
  } else if (
    url.protocol !== 'file:' &&
    isSpecial(url.protocol) &&
    !host &&
    url.pathname !== '/'
  ) {
    //
    // Add back the empty userinfo, otherwise the original invalid URL
    // might be transformed into a valid one with `url.pathname` as host.
    //
    result += '@';
  }

  //
  // Trailing colon is removed from `url.host` when it is parsed. If it still
  // ends with a colon, then add back the trailing colon that was removed. This
  // prevents an invalid URL from being transformed into a valid one.
  //
  if (host[host.length - 1] === ':' || (port.test(url.hostname) && !url.port)) {
    host += ':';
  }

  result += host + url.pathname;

  query = 'object' === typeof url.query ? stringify(url.query) : url.query;
  if (query) result += '?' !== query.charAt(0) ? '?'+ query : query;

  if (url.hash) result += url.hash;

  return result;
}

Url.prototype = { set: set, toString: toString$1 };

//
// Expose the URL parser and some additional properties that might be useful for
// others or testing.
//
Url.extractProtocol = extractProtocol;
Url.location = lolcation;
Url.trimLeft = trimLeft;
Url.qs = qs;

var urlParse$1 = Url;

var pubsuffixPsl = {};

var psl$1 = {};

var require$$1 = [
	"ac",
	"com.ac",
	"edu.ac",
	"gov.ac",
	"net.ac",
	"mil.ac",
	"org.ac",
	"ad",
	"nom.ad",
	"ae",
	"co.ae",
	"net.ae",
	"org.ae",
	"sch.ae",
	"ac.ae",
	"gov.ae",
	"mil.ae",
	"aero",
	"accident-investigation.aero",
	"accident-prevention.aero",
	"aerobatic.aero",
	"aeroclub.aero",
	"aerodrome.aero",
	"agents.aero",
	"aircraft.aero",
	"airline.aero",
	"airport.aero",
	"air-surveillance.aero",
	"airtraffic.aero",
	"air-traffic-control.aero",
	"ambulance.aero",
	"amusement.aero",
	"association.aero",
	"author.aero",
	"ballooning.aero",
	"broker.aero",
	"caa.aero",
	"cargo.aero",
	"catering.aero",
	"certification.aero",
	"championship.aero",
	"charter.aero",
	"civilaviation.aero",
	"club.aero",
	"conference.aero",
	"consultant.aero",
	"consulting.aero",
	"control.aero",
	"council.aero",
	"crew.aero",
	"design.aero",
	"dgca.aero",
	"educator.aero",
	"emergency.aero",
	"engine.aero",
	"engineer.aero",
	"entertainment.aero",
	"equipment.aero",
	"exchange.aero",
	"express.aero",
	"federation.aero",
	"flight.aero",
	"fuel.aero",
	"gliding.aero",
	"government.aero",
	"groundhandling.aero",
	"group.aero",
	"hanggliding.aero",
	"homebuilt.aero",
	"insurance.aero",
	"journal.aero",
	"journalist.aero",
	"leasing.aero",
	"logistics.aero",
	"magazine.aero",
	"maintenance.aero",
	"media.aero",
	"microlight.aero",
	"modelling.aero",
	"navigation.aero",
	"parachuting.aero",
	"paragliding.aero",
	"passenger-association.aero",
	"pilot.aero",
	"press.aero",
	"production.aero",
	"recreation.aero",
	"repbody.aero",
	"res.aero",
	"research.aero",
	"rotorcraft.aero",
	"safety.aero",
	"scientist.aero",
	"services.aero",
	"show.aero",
	"skydiving.aero",
	"software.aero",
	"student.aero",
	"trader.aero",
	"trading.aero",
	"trainer.aero",
	"union.aero",
	"workinggroup.aero",
	"works.aero",
	"af",
	"gov.af",
	"com.af",
	"org.af",
	"net.af",
	"edu.af",
	"ag",
	"com.ag",
	"org.ag",
	"net.ag",
	"co.ag",
	"nom.ag",
	"ai",
	"off.ai",
	"com.ai",
	"net.ai",
	"org.ai",
	"al",
	"com.al",
	"edu.al",
	"gov.al",
	"mil.al",
	"net.al",
	"org.al",
	"am",
	"co.am",
	"com.am",
	"commune.am",
	"net.am",
	"org.am",
	"ao",
	"ed.ao",
	"gv.ao",
	"og.ao",
	"co.ao",
	"pb.ao",
	"it.ao",
	"aq",
	"ar",
	"bet.ar",
	"com.ar",
	"coop.ar",
	"edu.ar",
	"gob.ar",
	"gov.ar",
	"int.ar",
	"mil.ar",
	"musica.ar",
	"mutual.ar",
	"net.ar",
	"org.ar",
	"senasa.ar",
	"tur.ar",
	"arpa",
	"e164.arpa",
	"in-addr.arpa",
	"ip6.arpa",
	"iris.arpa",
	"uri.arpa",
	"urn.arpa",
	"as",
	"gov.as",
	"asia",
	"at",
	"ac.at",
	"co.at",
	"gv.at",
	"or.at",
	"sth.ac.at",
	"au",
	"com.au",
	"net.au",
	"org.au",
	"edu.au",
	"gov.au",
	"asn.au",
	"id.au",
	"info.au",
	"conf.au",
	"oz.au",
	"act.au",
	"nsw.au",
	"nt.au",
	"qld.au",
	"sa.au",
	"tas.au",
	"vic.au",
	"wa.au",
	"act.edu.au",
	"catholic.edu.au",
	"nsw.edu.au",
	"nt.edu.au",
	"qld.edu.au",
	"sa.edu.au",
	"tas.edu.au",
	"vic.edu.au",
	"wa.edu.au",
	"qld.gov.au",
	"sa.gov.au",
	"tas.gov.au",
	"vic.gov.au",
	"wa.gov.au",
	"schools.nsw.edu.au",
	"aw",
	"com.aw",
	"ax",
	"az",
	"com.az",
	"net.az",
	"int.az",
	"gov.az",
	"org.az",
	"edu.az",
	"info.az",
	"pp.az",
	"mil.az",
	"name.az",
	"pro.az",
	"biz.az",
	"ba",
	"com.ba",
	"edu.ba",
	"gov.ba",
	"mil.ba",
	"net.ba",
	"org.ba",
	"bb",
	"biz.bb",
	"co.bb",
	"com.bb",
	"edu.bb",
	"gov.bb",
	"info.bb",
	"net.bb",
	"org.bb",
	"store.bb",
	"tv.bb",
	"*.bd",
	"be",
	"ac.be",
	"bf",
	"gov.bf",
	"bg",
	"a.bg",
	"b.bg",
	"c.bg",
	"d.bg",
	"e.bg",
	"f.bg",
	"g.bg",
	"h.bg",
	"i.bg",
	"j.bg",
	"k.bg",
	"l.bg",
	"m.bg",
	"n.bg",
	"o.bg",
	"p.bg",
	"q.bg",
	"r.bg",
	"s.bg",
	"t.bg",
	"u.bg",
	"v.bg",
	"w.bg",
	"x.bg",
	"y.bg",
	"z.bg",
	"0.bg",
	"1.bg",
	"2.bg",
	"3.bg",
	"4.bg",
	"5.bg",
	"6.bg",
	"7.bg",
	"8.bg",
	"9.bg",
	"bh",
	"com.bh",
	"edu.bh",
	"net.bh",
	"org.bh",
	"gov.bh",
	"bi",
	"co.bi",
	"com.bi",
	"edu.bi",
	"or.bi",
	"org.bi",
	"biz",
	"bj",
	"asso.bj",
	"barreau.bj",
	"gouv.bj",
	"bm",
	"com.bm",
	"edu.bm",
	"gov.bm",
	"net.bm",
	"org.bm",
	"bn",
	"com.bn",
	"edu.bn",
	"gov.bn",
	"net.bn",
	"org.bn",
	"bo",
	"com.bo",
	"edu.bo",
	"gob.bo",
	"int.bo",
	"org.bo",
	"net.bo",
	"mil.bo",
	"tv.bo",
	"web.bo",
	"academia.bo",
	"agro.bo",
	"arte.bo",
	"blog.bo",
	"bolivia.bo",
	"ciencia.bo",
	"cooperativa.bo",
	"democracia.bo",
	"deporte.bo",
	"ecologia.bo",
	"economia.bo",
	"empresa.bo",
	"indigena.bo",
	"industria.bo",
	"info.bo",
	"medicina.bo",
	"movimiento.bo",
	"musica.bo",
	"natural.bo",
	"nombre.bo",
	"noticias.bo",
	"patria.bo",
	"politica.bo",
	"profesional.bo",
	"plurinacional.bo",
	"pueblo.bo",
	"revista.bo",
	"salud.bo",
	"tecnologia.bo",
	"tksat.bo",
	"transporte.bo",
	"wiki.bo",
	"br",
	"9guacu.br",
	"abc.br",
	"adm.br",
	"adv.br",
	"agr.br",
	"aju.br",
	"am.br",
	"anani.br",
	"aparecida.br",
	"app.br",
	"arq.br",
	"art.br",
	"ato.br",
	"b.br",
	"barueri.br",
	"belem.br",
	"bhz.br",
	"bib.br",
	"bio.br",
	"blog.br",
	"bmd.br",
	"boavista.br",
	"bsb.br",
	"campinagrande.br",
	"campinas.br",
	"caxias.br",
	"cim.br",
	"cng.br",
	"cnt.br",
	"com.br",
	"contagem.br",
	"coop.br",
	"coz.br",
	"cri.br",
	"cuiaba.br",
	"curitiba.br",
	"def.br",
	"des.br",
	"det.br",
	"dev.br",
	"ecn.br",
	"eco.br",
	"edu.br",
	"emp.br",
	"enf.br",
	"eng.br",
	"esp.br",
	"etc.br",
	"eti.br",
	"far.br",
	"feira.br",
	"flog.br",
	"floripa.br",
	"fm.br",
	"fnd.br",
	"fortal.br",
	"fot.br",
	"foz.br",
	"fst.br",
	"g12.br",
	"geo.br",
	"ggf.br",
	"goiania.br",
	"gov.br",
	"ac.gov.br",
	"al.gov.br",
	"am.gov.br",
	"ap.gov.br",
	"ba.gov.br",
	"ce.gov.br",
	"df.gov.br",
	"es.gov.br",
	"go.gov.br",
	"ma.gov.br",
	"mg.gov.br",
	"ms.gov.br",
	"mt.gov.br",
	"pa.gov.br",
	"pb.gov.br",
	"pe.gov.br",
	"pi.gov.br",
	"pr.gov.br",
	"rj.gov.br",
	"rn.gov.br",
	"ro.gov.br",
	"rr.gov.br",
	"rs.gov.br",
	"sc.gov.br",
	"se.gov.br",
	"sp.gov.br",
	"to.gov.br",
	"gru.br",
	"imb.br",
	"ind.br",
	"inf.br",
	"jab.br",
	"jampa.br",
	"jdf.br",
	"joinville.br",
	"jor.br",
	"jus.br",
	"leg.br",
	"lel.br",
	"log.br",
	"londrina.br",
	"macapa.br",
	"maceio.br",
	"manaus.br",
	"maringa.br",
	"mat.br",
	"med.br",
	"mil.br",
	"morena.br",
	"mp.br",
	"mus.br",
	"natal.br",
	"net.br",
	"niteroi.br",
	"*.nom.br",
	"not.br",
	"ntr.br",
	"odo.br",
	"ong.br",
	"org.br",
	"osasco.br",
	"palmas.br",
	"poa.br",
	"ppg.br",
	"pro.br",
	"psc.br",
	"psi.br",
	"pvh.br",
	"qsl.br",
	"radio.br",
	"rec.br",
	"recife.br",
	"rep.br",
	"ribeirao.br",
	"rio.br",
	"riobranco.br",
	"riopreto.br",
	"salvador.br",
	"sampa.br",
	"santamaria.br",
	"santoandre.br",
	"saobernardo.br",
	"saogonca.br",
	"seg.br",
	"sjc.br",
	"slg.br",
	"slz.br",
	"sorocaba.br",
	"srv.br",
	"taxi.br",
	"tc.br",
	"tec.br",
	"teo.br",
	"the.br",
	"tmp.br",
	"trd.br",
	"tur.br",
	"tv.br",
	"udi.br",
	"vet.br",
	"vix.br",
	"vlog.br",
	"wiki.br",
	"zlg.br",
	"bs",
	"com.bs",
	"net.bs",
	"org.bs",
	"edu.bs",
	"gov.bs",
	"bt",
	"com.bt",
	"edu.bt",
	"gov.bt",
	"net.bt",
	"org.bt",
	"bv",
	"bw",
	"co.bw",
	"org.bw",
	"by",
	"gov.by",
	"mil.by",
	"com.by",
	"of.by",
	"bz",
	"com.bz",
	"net.bz",
	"org.bz",
	"edu.bz",
	"gov.bz",
	"ca",
	"ab.ca",
	"bc.ca",
	"mb.ca",
	"nb.ca",
	"nf.ca",
	"nl.ca",
	"ns.ca",
	"nt.ca",
	"nu.ca",
	"on.ca",
	"pe.ca",
	"qc.ca",
	"sk.ca",
	"yk.ca",
	"gc.ca",
	"cat",
	"cc",
	"cd",
	"gov.cd",
	"cf",
	"cg",
	"ch",
	"ci",
	"org.ci",
	"or.ci",
	"com.ci",
	"co.ci",
	"edu.ci",
	"ed.ci",
	"ac.ci",
	"net.ci",
	"go.ci",
	"asso.ci",
	"aéroport.ci",
	"int.ci",
	"presse.ci",
	"md.ci",
	"gouv.ci",
	"*.ck",
	"!www.ck",
	"cl",
	"co.cl",
	"gob.cl",
	"gov.cl",
	"mil.cl",
	"cm",
	"co.cm",
	"com.cm",
	"gov.cm",
	"net.cm",
	"cn",
	"ac.cn",
	"com.cn",
	"edu.cn",
	"gov.cn",
	"net.cn",
	"org.cn",
	"mil.cn",
	"公司.cn",
	"网络.cn",
	"網絡.cn",
	"ah.cn",
	"bj.cn",
	"cq.cn",
	"fj.cn",
	"gd.cn",
	"gs.cn",
	"gz.cn",
	"gx.cn",
	"ha.cn",
	"hb.cn",
	"he.cn",
	"hi.cn",
	"hl.cn",
	"hn.cn",
	"jl.cn",
	"js.cn",
	"jx.cn",
	"ln.cn",
	"nm.cn",
	"nx.cn",
	"qh.cn",
	"sc.cn",
	"sd.cn",
	"sh.cn",
	"sn.cn",
	"sx.cn",
	"tj.cn",
	"xj.cn",
	"xz.cn",
	"yn.cn",
	"zj.cn",
	"hk.cn",
	"mo.cn",
	"tw.cn",
	"co",
	"arts.co",
	"com.co",
	"edu.co",
	"firm.co",
	"gov.co",
	"info.co",
	"int.co",
	"mil.co",
	"net.co",
	"nom.co",
	"org.co",
	"rec.co",
	"web.co",
	"com",
	"coop",
	"cr",
	"ac.cr",
	"co.cr",
	"ed.cr",
	"fi.cr",
	"go.cr",
	"or.cr",
	"sa.cr",
	"cu",
	"com.cu",
	"edu.cu",
	"org.cu",
	"net.cu",
	"gov.cu",
	"inf.cu",
	"cv",
	"com.cv",
	"edu.cv",
	"int.cv",
	"nome.cv",
	"org.cv",
	"cw",
	"com.cw",
	"edu.cw",
	"net.cw",
	"org.cw",
	"cx",
	"gov.cx",
	"cy",
	"ac.cy",
	"biz.cy",
	"com.cy",
	"ekloges.cy",
	"gov.cy",
	"ltd.cy",
	"mil.cy",
	"net.cy",
	"org.cy",
	"press.cy",
	"pro.cy",
	"tm.cy",
	"cz",
	"de",
	"dj",
	"dk",
	"dm",
	"com.dm",
	"net.dm",
	"org.dm",
	"edu.dm",
	"gov.dm",
	"do",
	"art.do",
	"com.do",
	"edu.do",
	"gob.do",
	"gov.do",
	"mil.do",
	"net.do",
	"org.do",
	"sld.do",
	"web.do",
	"dz",
	"art.dz",
	"asso.dz",
	"com.dz",
	"edu.dz",
	"gov.dz",
	"org.dz",
	"net.dz",
	"pol.dz",
	"soc.dz",
	"tm.dz",
	"ec",
	"com.ec",
	"info.ec",
	"net.ec",
	"fin.ec",
	"k12.ec",
	"med.ec",
	"pro.ec",
	"org.ec",
	"edu.ec",
	"gov.ec",
	"gob.ec",
	"mil.ec",
	"edu",
	"ee",
	"edu.ee",
	"gov.ee",
	"riik.ee",
	"lib.ee",
	"med.ee",
	"com.ee",
	"pri.ee",
	"aip.ee",
	"org.ee",
	"fie.ee",
	"eg",
	"com.eg",
	"edu.eg",
	"eun.eg",
	"gov.eg",
	"mil.eg",
	"name.eg",
	"net.eg",
	"org.eg",
	"sci.eg",
	"*.er",
	"es",
	"com.es",
	"nom.es",
	"org.es",
	"gob.es",
	"edu.es",
	"et",
	"com.et",
	"gov.et",
	"org.et",
	"edu.et",
	"biz.et",
	"name.et",
	"info.et",
	"net.et",
	"eu",
	"fi",
	"aland.fi",
	"fj",
	"ac.fj",
	"biz.fj",
	"com.fj",
	"gov.fj",
	"info.fj",
	"mil.fj",
	"name.fj",
	"net.fj",
	"org.fj",
	"pro.fj",
	"*.fk",
	"com.fm",
	"edu.fm",
	"net.fm",
	"org.fm",
	"fm",
	"fo",
	"fr",
	"asso.fr",
	"com.fr",
	"gouv.fr",
	"nom.fr",
	"prd.fr",
	"tm.fr",
	"aeroport.fr",
	"avocat.fr",
	"avoues.fr",
	"cci.fr",
	"chambagri.fr",
	"chirurgiens-dentistes.fr",
	"experts-comptables.fr",
	"geometre-expert.fr",
	"greta.fr",
	"huissier-justice.fr",
	"medecin.fr",
	"notaires.fr",
	"pharmacien.fr",
	"port.fr",
	"veterinaire.fr",
	"ga",
	"gb",
	"edu.gd",
	"gov.gd",
	"gd",
	"ge",
	"com.ge",
	"edu.ge",
	"gov.ge",
	"org.ge",
	"mil.ge",
	"net.ge",
	"pvt.ge",
	"gf",
	"gg",
	"co.gg",
	"net.gg",
	"org.gg",
	"gh",
	"com.gh",
	"edu.gh",
	"gov.gh",
	"org.gh",
	"mil.gh",
	"gi",
	"com.gi",
	"ltd.gi",
	"gov.gi",
	"mod.gi",
	"edu.gi",
	"org.gi",
	"gl",
	"co.gl",
	"com.gl",
	"edu.gl",
	"net.gl",
	"org.gl",
	"gm",
	"gn",
	"ac.gn",
	"com.gn",
	"edu.gn",
	"gov.gn",
	"org.gn",
	"net.gn",
	"gov",
	"gp",
	"com.gp",
	"net.gp",
	"mobi.gp",
	"edu.gp",
	"org.gp",
	"asso.gp",
	"gq",
	"gr",
	"com.gr",
	"edu.gr",
	"net.gr",
	"org.gr",
	"gov.gr",
	"gs",
	"gt",
	"com.gt",
	"edu.gt",
	"gob.gt",
	"ind.gt",
	"mil.gt",
	"net.gt",
	"org.gt",
	"gu",
	"com.gu",
	"edu.gu",
	"gov.gu",
	"guam.gu",
	"info.gu",
	"net.gu",
	"org.gu",
	"web.gu",
	"gw",
	"gy",
	"co.gy",
	"com.gy",
	"edu.gy",
	"gov.gy",
	"net.gy",
	"org.gy",
	"hk",
	"com.hk",
	"edu.hk",
	"gov.hk",
	"idv.hk",
	"net.hk",
	"org.hk",
	"公司.hk",
	"教育.hk",
	"敎育.hk",
	"政府.hk",
	"個人.hk",
	"个��.hk",
	"箇人.hk",
	"網络.hk",
	"网络.hk",
	"组織.hk",
	"網絡.hk",
	"网絡.hk",
	"组织.hk",
	"組織.hk",
	"組织.hk",
	"hm",
	"hn",
	"com.hn",
	"edu.hn",
	"org.hn",
	"net.hn",
	"mil.hn",
	"gob.hn",
	"hr",
	"iz.hr",
	"from.hr",
	"name.hr",
	"com.hr",
	"ht",
	"com.ht",
	"shop.ht",
	"firm.ht",
	"info.ht",
	"adult.ht",
	"net.ht",
	"pro.ht",
	"org.ht",
	"med.ht",
	"art.ht",
	"coop.ht",
	"pol.ht",
	"asso.ht",
	"edu.ht",
	"rel.ht",
	"gouv.ht",
	"perso.ht",
	"hu",
	"co.hu",
	"info.hu",
	"org.hu",
	"priv.hu",
	"sport.hu",
	"tm.hu",
	"2000.hu",
	"agrar.hu",
	"bolt.hu",
	"casino.hu",
	"city.hu",
	"erotica.hu",
	"erotika.hu",
	"film.hu",
	"forum.hu",
	"games.hu",
	"hotel.hu",
	"ingatlan.hu",
	"jogasz.hu",
	"konyvelo.hu",
	"lakas.hu",
	"media.hu",
	"news.hu",
	"reklam.hu",
	"sex.hu",
	"shop.hu",
	"suli.hu",
	"szex.hu",
	"tozsde.hu",
	"utazas.hu",
	"video.hu",
	"id",
	"ac.id",
	"biz.id",
	"co.id",
	"desa.id",
	"go.id",
	"mil.id",
	"my.id",
	"net.id",
	"or.id",
	"ponpes.id",
	"sch.id",
	"web.id",
	"ie",
	"gov.ie",
	"il",
	"ac.il",
	"co.il",
	"gov.il",
	"idf.il",
	"k12.il",
	"muni.il",
	"net.il",
	"org.il",
	"im",
	"ac.im",
	"co.im",
	"com.im",
	"ltd.co.im",
	"net.im",
	"org.im",
	"plc.co.im",
	"tt.im",
	"tv.im",
	"in",
	"co.in",
	"firm.in",
	"net.in",
	"org.in",
	"gen.in",
	"ind.in",
	"nic.in",
	"ac.in",
	"edu.in",
	"res.in",
	"gov.in",
	"mil.in",
	"info",
	"int",
	"eu.int",
	"io",
	"com.io",
	"iq",
	"gov.iq",
	"edu.iq",
	"mil.iq",
	"com.iq",
	"org.iq",
	"net.iq",
	"ir",
	"ac.ir",
	"co.ir",
	"gov.ir",
	"id.ir",
	"net.ir",
	"org.ir",
	"sch.ir",
	"ایران.ir",
	"ايران.ir",
	"is",
	"net.is",
	"com.is",
	"edu.is",
	"gov.is",
	"org.is",
	"int.is",
	"it",
	"gov.it",
	"edu.it",
	"abr.it",
	"abruzzo.it",
	"aosta-valley.it",
	"aostavalley.it",
	"bas.it",
	"basilicata.it",
	"cal.it",
	"calabria.it",
	"cam.it",
	"campania.it",
	"emilia-romagna.it",
	"emiliaromagna.it",
	"emr.it",
	"friuli-v-giulia.it",
	"friuli-ve-giulia.it",
	"friuli-vegiulia.it",
	"friuli-venezia-giulia.it",
	"friuli-veneziagiulia.it",
	"friuli-vgiulia.it",
	"friuliv-giulia.it",
	"friulive-giulia.it",
	"friulivegiulia.it",
	"friulivenezia-giulia.it",
	"friuliveneziagiulia.it",
	"friulivgiulia.it",
	"fvg.it",
	"laz.it",
	"lazio.it",
	"lig.it",
	"liguria.it",
	"lom.it",
	"lombardia.it",
	"lombardy.it",
	"lucania.it",
	"mar.it",
	"marche.it",
	"mol.it",
	"molise.it",
	"piedmont.it",
	"piemonte.it",
	"pmn.it",
	"pug.it",
	"puglia.it",
	"sar.it",
	"sardegna.it",
	"sardinia.it",
	"sic.it",
	"sicilia.it",
	"sicily.it",
	"taa.it",
	"tos.it",
	"toscana.it",
	"trentin-sud-tirol.it",
	"trentin-süd-tirol.it",
	"trentin-sudtirol.it",
	"trentin-südtirol.it",
	"trentin-sued-tirol.it",
	"trentin-suedtirol.it",
	"trentino-a-adige.it",
	"trentino-aadige.it",
	"trentino-alto-adige.it",
	"trentino-altoadige.it",
	"trentino-s-tirol.it",
	"trentino-stirol.it",
	"trentino-sud-tirol.it",
	"trentino-süd-tirol.it",
	"trentino-sudtirol.it",
	"trentino-südtirol.it",
	"trentino-sued-tirol.it",
	"trentino-suedtirol.it",
	"trentino.it",
	"trentinoa-adige.it",
	"trentinoaadige.it",
	"trentinoalto-adige.it",
	"trentinoaltoadige.it",
	"trentinos-tirol.it",
	"trentinostirol.it",
	"trentinosud-tirol.it",
	"trentinosüd-tirol.it",
	"trentinosudtirol.it",
	"trentinosüdtirol.it",
	"trentinosued-tirol.it",
	"trentinosuedtirol.it",
	"trentinsud-tirol.it",
	"trentinsüd-tirol.it",
	"trentinsudtirol.it",
	"trentinsüdtirol.it",
	"trentinsued-tirol.it",
	"trentinsuedtirol.it",
	"tuscany.it",
	"umb.it",
	"umbria.it",
	"val-d-aosta.it",
	"val-daosta.it",
	"vald-aosta.it",
	"valdaosta.it",
	"valle-aosta.it",
	"valle-d-aosta.it",
	"valle-daosta.it",
	"valleaosta.it",
	"valled-aosta.it",
	"valledaosta.it",
	"vallee-aoste.it",
	"vallée-aoste.it",
	"vallee-d-aoste.it",
	"vallée-d-aoste.it",
	"valleeaoste.it",
	"valléeaoste.it",
	"valleedaoste.it",
	"valléedaoste.it",
	"vao.it",
	"vda.it",
	"ven.it",
	"veneto.it",
	"ag.it",
	"agrigento.it",
	"al.it",
	"alessandria.it",
	"alto-adige.it",
	"altoadige.it",
	"an.it",
	"ancona.it",
	"andria-barletta-trani.it",
	"andria-trani-barletta.it",
	"andriabarlettatrani.it",
	"andriatranibarletta.it",
	"ao.it",
	"aosta.it",
	"aoste.it",
	"ap.it",
	"aq.it",
	"aquila.it",
	"ar.it",
	"arezzo.it",
	"ascoli-piceno.it",
	"ascolipiceno.it",
	"asti.it",
	"at.it",
	"av.it",
	"avellino.it",
	"ba.it",
	"balsan-sudtirol.it",
	"balsan-südtirol.it",
	"balsan-suedtirol.it",
	"balsan.it",
	"bari.it",
	"barletta-trani-andria.it",
	"barlettatraniandria.it",
	"belluno.it",
	"benevento.it",
	"bergamo.it",
	"bg.it",
	"bi.it",
	"biella.it",
	"bl.it",
	"bn.it",
	"bo.it",
	"bologna.it",
	"bolzano-altoadige.it",
	"bolzano.it",
	"bozen-sudtirol.it",
	"bozen-südtirol.it",
	"bozen-suedtirol.it",
	"bozen.it",
	"br.it",
	"brescia.it",
	"brindisi.it",
	"bs.it",
	"bt.it",
	"bulsan-sudtirol.it",
	"bulsan-südtirol.it",
	"bulsan-suedtirol.it",
	"bulsan.it",
	"bz.it",
	"ca.it",
	"cagliari.it",
	"caltanissetta.it",
	"campidano-medio.it",
	"campidanomedio.it",
	"campobasso.it",
	"carbonia-iglesias.it",
	"carboniaiglesias.it",
	"carrara-massa.it",
	"carraramassa.it",
	"caserta.it",
	"catania.it",
	"catanzaro.it",
	"cb.it",
	"ce.it",
	"cesena-forli.it",
	"cesena-forlì.it",
	"cesenaforli.it",
	"cesenaforlì.it",
	"ch.it",
	"chieti.it",
	"ci.it",
	"cl.it",
	"cn.it",
	"co.it",
	"como.it",
	"cosenza.it",
	"cr.it",
	"cremona.it",
	"crotone.it",
	"cs.it",
	"ct.it",
	"cuneo.it",
	"cz.it",
	"dell-ogliastra.it",
	"dellogliastra.it",
	"en.it",
	"enna.it",
	"fc.it",
	"fe.it",
	"fermo.it",
	"ferrara.it",
	"fg.it",
	"fi.it",
	"firenze.it",
	"florence.it",
	"fm.it",
	"foggia.it",
	"forli-cesena.it",
	"forlì-cesena.it",
	"forlicesena.it",
	"forlìcesena.it",
	"fr.it",
	"frosinone.it",
	"ge.it",
	"genoa.it",
	"genova.it",
	"go.it",
	"gorizia.it",
	"gr.it",
	"grosseto.it",
	"iglesias-carbonia.it",
	"iglesiascarbonia.it",
	"im.it",
	"imperia.it",
	"is.it",
	"isernia.it",
	"kr.it",
	"la-spezia.it",
	"laquila.it",
	"laspezia.it",
	"latina.it",
	"lc.it",
	"le.it",
	"lecce.it",
	"lecco.it",
	"li.it",
	"livorno.it",
	"lo.it",
	"lodi.it",
	"lt.it",
	"lu.it",
	"lucca.it",
	"macerata.it",
	"mantova.it",
	"massa-carrara.it",
	"massacarrara.it",
	"matera.it",
	"mb.it",
	"mc.it",
	"me.it",
	"medio-campidano.it",
	"mediocampidano.it",
	"messina.it",
	"mi.it",
	"milan.it",
	"milano.it",
	"mn.it",
	"mo.it",
	"modena.it",
	"monza-brianza.it",
	"monza-e-della-brianza.it",
	"monza.it",
	"monzabrianza.it",
	"monzaebrianza.it",
	"monzaedellabrianza.it",
	"ms.it",
	"mt.it",
	"na.it",
	"naples.it",
	"napoli.it",
	"no.it",
	"novara.it",
	"nu.it",
	"nuoro.it",
	"og.it",
	"ogliastra.it",
	"olbia-tempio.it",
	"olbiatempio.it",
	"or.it",
	"oristano.it",
	"ot.it",
	"pa.it",
	"padova.it",
	"padua.it",
	"palermo.it",
	"parma.it",
	"pavia.it",
	"pc.it",
	"pd.it",
	"pe.it",
	"perugia.it",
	"pesaro-urbino.it",
	"pesarourbino.it",
	"pescara.it",
	"pg.it",
	"pi.it",
	"piacenza.it",
	"pisa.it",
	"pistoia.it",
	"pn.it",
	"po.it",
	"pordenone.it",
	"potenza.it",
	"pr.it",
	"prato.it",
	"pt.it",
	"pu.it",
	"pv.it",
	"pz.it",
	"ra.it",
	"ragusa.it",
	"ravenna.it",
	"rc.it",
	"re.it",
	"reggio-calabria.it",
	"reggio-emilia.it",
	"reggiocalabria.it",
	"reggioemilia.it",
	"rg.it",
	"ri.it",
	"rieti.it",
	"rimini.it",
	"rm.it",
	"rn.it",
	"ro.it",
	"roma.it",
	"rome.it",
	"rovigo.it",
	"sa.it",
	"salerno.it",
	"sassari.it",
	"savona.it",
	"si.it",
	"siena.it",
	"siracusa.it",
	"so.it",
	"sondrio.it",
	"sp.it",
	"sr.it",
	"ss.it",
	"suedtirol.it",
	"südtirol.it",
	"sv.it",
	"ta.it",
	"taranto.it",
	"te.it",
	"tempio-olbia.it",
	"tempioolbia.it",
	"teramo.it",
	"terni.it",
	"tn.it",
	"to.it",
	"torino.it",
	"tp.it",
	"tr.it",
	"trani-andria-barletta.it",
	"trani-barletta-andria.it",
	"traniandriabarletta.it",
	"tranibarlettaandria.it",
	"trapani.it",
	"trento.it",
	"treviso.it",
	"trieste.it",
	"ts.it",
	"turin.it",
	"tv.it",
	"ud.it",
	"udine.it",
	"urbino-pesaro.it",
	"urbinopesaro.it",
	"va.it",
	"varese.it",
	"vb.it",
	"vc.it",
	"ve.it",
	"venezia.it",
	"venice.it",
	"verbania.it",
	"vercelli.it",
	"verona.it",
	"vi.it",
	"vibo-valentia.it",
	"vibovalentia.it",
	"vicenza.it",
	"viterbo.it",
	"vr.it",
	"vs.it",
	"vt.it",
	"vv.it",
	"je",
	"co.je",
	"net.je",
	"org.je",
	"*.jm",
	"jo",
	"com.jo",
	"org.jo",
	"net.jo",
	"edu.jo",
	"sch.jo",
	"gov.jo",
	"mil.jo",
	"name.jo",
	"jobs",
	"jp",
	"ac.jp",
	"ad.jp",
	"co.jp",
	"ed.jp",
	"go.jp",
	"gr.jp",
	"lg.jp",
	"ne.jp",
	"or.jp",
	"aichi.jp",
	"akita.jp",
	"aomori.jp",
	"chiba.jp",
	"ehime.jp",
	"fukui.jp",
	"fukuoka.jp",
	"fukushima.jp",
	"gifu.jp",
	"gunma.jp",
	"hiroshima.jp",
	"hokkaido.jp",
	"hyogo.jp",
	"ibaraki.jp",
	"ishikawa.jp",
	"iwate.jp",
	"kagawa.jp",
	"kagoshima.jp",
	"kanagawa.jp",
	"kochi.jp",
	"kumamoto.jp",
	"kyoto.jp",
	"mie.jp",
	"miyagi.jp",
	"miyazaki.jp",
	"nagano.jp",
	"nagasaki.jp",
	"nara.jp",
	"niigata.jp",
	"oita.jp",
	"okayama.jp",
	"okinawa.jp",
	"osaka.jp",
	"saga.jp",
	"saitama.jp",
	"shiga.jp",
	"shimane.jp",
	"shizuoka.jp",
	"tochigi.jp",
	"tokushima.jp",
	"tokyo.jp",
	"tottori.jp",
	"toyama.jp",
	"wakayama.jp",
	"yamagata.jp",
	"yamaguchi.jp",
	"yamanashi.jp",
	"栃木.jp",
	"愛知.jp",
	"愛媛.jp",
	"兵庫.jp",
	"熊本.jp",
	"茨城.jp",
	"北海道.jp",
	"千葉.jp",
	"和歌山.jp",
	"長崎.jp",
	"長野.jp",
	"新潟.jp",
	"青森.jp",
	"静岡.jp",
	"東京.jp",
	"石川.jp",
	"埼玉.jp",
	"三重.jp",
	"京都.jp",
	"佐賀.jp",
	"大分.jp",
	"大阪.jp",
	"奈良.jp",
	"宮城.jp",
	"宮崎.jp",
	"富山.jp",
	"山口.jp",
	"山形.jp",
	"山梨.jp",
	"岩手.jp",
	"岐阜.jp",
	"岡山.jp",
	"島根.jp",
	"広島.jp",
	"徳島.jp",
	"沖縄.jp",
	"滋賀.jp",
	"神奈川.jp",
	"福井.jp",
	"福岡.jp",
	"福島.jp",
	"秋田.jp",
	"群馬.jp",
	"香川.jp",
	"高知.jp",
	"鳥取.jp",
	"鹿児島.jp",
	"*.kawasaki.jp",
	"*.kitakyushu.jp",
	"*.kobe.jp",
	"*.nagoya.jp",
	"*.sapporo.jp",
	"*.sendai.jp",
	"*.yokohama.jp",
	"!city.kawasaki.jp",
	"!city.kitakyushu.jp",
	"!city.kobe.jp",
	"!city.nagoya.jp",
	"!city.sapporo.jp",
	"!city.sendai.jp",
	"!city.yokohama.jp",
	"aisai.aichi.jp",
	"ama.aichi.jp",
	"anjo.aichi.jp",
	"asuke.aichi.jp",
	"chiryu.aichi.jp",
	"chita.aichi.jp",
	"fuso.aichi.jp",
	"gamagori.aichi.jp",
	"handa.aichi.jp",
	"hazu.aichi.jp",
	"hekinan.aichi.jp",
	"higashiura.aichi.jp",
	"ichinomiya.aichi.jp",
	"inazawa.aichi.jp",
	"inuyama.aichi.jp",
	"isshiki.aichi.jp",
	"iwakura.aichi.jp",
	"kanie.aichi.jp",
	"kariya.aichi.jp",
	"kasugai.aichi.jp",
	"kira.aichi.jp",
	"kiyosu.aichi.jp",
	"komaki.aichi.jp",
	"konan.aichi.jp",
	"kota.aichi.jp",
	"mihama.aichi.jp",
	"miyoshi.aichi.jp",
	"nishio.aichi.jp",
	"nisshin.aichi.jp",
	"obu.aichi.jp",
	"oguchi.aichi.jp",
	"oharu.aichi.jp",
	"okazaki.aichi.jp",
	"owariasahi.aichi.jp",
	"seto.aichi.jp",
	"shikatsu.aichi.jp",
	"shinshiro.aichi.jp",
	"shitara.aichi.jp",
	"tahara.aichi.jp",
	"takahama.aichi.jp",
	"tobishima.aichi.jp",
	"toei.aichi.jp",
	"togo.aichi.jp",
	"tokai.aichi.jp",
	"tokoname.aichi.jp",
	"toyoake.aichi.jp",
	"toyohashi.aichi.jp",
	"toyokawa.aichi.jp",
	"toyone.aichi.jp",
	"toyota.aichi.jp",
	"tsushima.aichi.jp",
	"yatomi.aichi.jp",
	"akita.akita.jp",
	"daisen.akita.jp",
	"fujisato.akita.jp",
	"gojome.akita.jp",
	"hachirogata.akita.jp",
	"happou.akita.jp",
	"higashinaruse.akita.jp",
	"honjo.akita.jp",
	"honjyo.akita.jp",
	"ikawa.akita.jp",
	"kamikoani.akita.jp",
	"kamioka.akita.jp",
	"katagami.akita.jp",
	"kazuno.akita.jp",
	"kitaakita.akita.jp",
	"kosaka.akita.jp",
	"kyowa.akita.jp",
	"misato.akita.jp",
	"mitane.akita.jp",
	"moriyoshi.akita.jp",
	"nikaho.akita.jp",
	"noshiro.akita.jp",
	"odate.akita.jp",
	"oga.akita.jp",
	"ogata.akita.jp",
	"semboku.akita.jp",
	"yokote.akita.jp",
	"yurihonjo.akita.jp",
	"aomori.aomori.jp",
	"gonohe.aomori.jp",
	"hachinohe.aomori.jp",
	"hashikami.aomori.jp",
	"hiranai.aomori.jp",
	"hirosaki.aomori.jp",
	"itayanagi.aomori.jp",
	"kuroishi.aomori.jp",
	"misawa.aomori.jp",
	"mutsu.aomori.jp",
	"nakadomari.aomori.jp",
	"noheji.aomori.jp",
	"oirase.aomori.jp",
	"owani.aomori.jp",
	"rokunohe.aomori.jp",
	"sannohe.aomori.jp",
	"shichinohe.aomori.jp",
	"shingo.aomori.jp",
	"takko.aomori.jp",
	"towada.aomori.jp",
	"tsugaru.aomori.jp",
	"tsuruta.aomori.jp",
	"abiko.chiba.jp",
	"asahi.chiba.jp",
	"chonan.chiba.jp",
	"chosei.chiba.jp",
	"choshi.chiba.jp",
	"chuo.chiba.jp",
	"funabashi.chiba.jp",
	"futtsu.chiba.jp",
	"hanamigawa.chiba.jp",
	"ichihara.chiba.jp",
	"ichikawa.chiba.jp",
	"ichinomiya.chiba.jp",
	"inzai.chiba.jp",
	"isumi.chiba.jp",
	"kamagaya.chiba.jp",
	"kamogawa.chiba.jp",
	"kashiwa.chiba.jp",
	"katori.chiba.jp",
	"katsuura.chiba.jp",
	"kimitsu.chiba.jp",
	"kisarazu.chiba.jp",
	"kozaki.chiba.jp",
	"kujukuri.chiba.jp",
	"kyonan.chiba.jp",
	"matsudo.chiba.jp",
	"midori.chiba.jp",
	"mihama.chiba.jp",
	"minamiboso.chiba.jp",
	"mobara.chiba.jp",
	"mutsuzawa.chiba.jp",
	"nagara.chiba.jp",
	"nagareyama.chiba.jp",
	"narashino.chiba.jp",
	"narita.chiba.jp",
	"noda.chiba.jp",
	"oamishirasato.chiba.jp",
	"omigawa.chiba.jp",
	"onjuku.chiba.jp",
	"otaki.chiba.jp",
	"sakae.chiba.jp",
	"sakura.chiba.jp",
	"shimofusa.chiba.jp",
	"shirako.chiba.jp",
	"shiroi.chiba.jp",
	"shisui.chiba.jp",
	"sodegaura.chiba.jp",
	"sosa.chiba.jp",
	"tako.chiba.jp",
	"tateyama.chiba.jp",
	"togane.chiba.jp",
	"tohnosho.chiba.jp",
	"tomisato.chiba.jp",
	"urayasu.chiba.jp",
	"yachimata.chiba.jp",
	"yachiyo.chiba.jp",
	"yokaichiba.chiba.jp",
	"yokoshibahikari.chiba.jp",
	"yotsukaido.chiba.jp",
	"ainan.ehime.jp",
	"honai.ehime.jp",
	"ikata.ehime.jp",
	"imabari.ehime.jp",
	"iyo.ehime.jp",
	"kamijima.ehime.jp",
	"kihoku.ehime.jp",
	"kumakogen.ehime.jp",
	"masaki.ehime.jp",
	"matsuno.ehime.jp",
	"matsuyama.ehime.jp",
	"namikata.ehime.jp",
	"niihama.ehime.jp",
	"ozu.ehime.jp",
	"saijo.ehime.jp",
	"seiyo.ehime.jp",
	"shikokuchuo.ehime.jp",
	"tobe.ehime.jp",
	"toon.ehime.jp",
	"uchiko.ehime.jp",
	"uwajima.ehime.jp",
	"yawatahama.ehime.jp",
	"echizen.fukui.jp",
	"eiheiji.fukui.jp",
	"fukui.fukui.jp",
	"ikeda.fukui.jp",
	"katsuyama.fukui.jp",
	"mihama.fukui.jp",
	"minamiechizen.fukui.jp",
	"obama.fukui.jp",
	"ohi.fukui.jp",
	"ono.fukui.jp",
	"sabae.fukui.jp",
	"sakai.fukui.jp",
	"takahama.fukui.jp",
	"tsuruga.fukui.jp",
	"wakasa.fukui.jp",
	"ashiya.fukuoka.jp",
	"buzen.fukuoka.jp",
	"chikugo.fukuoka.jp",
	"chikuho.fukuoka.jp",
	"chikujo.fukuoka.jp",
	"chikushino.fukuoka.jp",
	"chikuzen.fukuoka.jp",
	"chuo.fukuoka.jp",
	"dazaifu.fukuoka.jp",
	"fukuchi.fukuoka.jp",
	"hakata.fukuoka.jp",
	"higashi.fukuoka.jp",
	"hirokawa.fukuoka.jp",
	"hisayama.fukuoka.jp",
	"iizuka.fukuoka.jp",
	"inatsuki.fukuoka.jp",
	"kaho.fukuoka.jp",
	"kasuga.fukuoka.jp",
	"kasuya.fukuoka.jp",
	"kawara.fukuoka.jp",
	"keisen.fukuoka.jp",
	"koga.fukuoka.jp",
	"kurate.fukuoka.jp",
	"kurogi.fukuoka.jp",
	"kurume.fukuoka.jp",
	"minami.fukuoka.jp",
	"miyako.fukuoka.jp",
	"miyama.fukuoka.jp",
	"miyawaka.fukuoka.jp",
	"mizumaki.fukuoka.jp",
	"munakata.fukuoka.jp",
	"nakagawa.fukuoka.jp",
	"nakama.fukuoka.jp",
	"nishi.fukuoka.jp",
	"nogata.fukuoka.jp",
	"ogori.fukuoka.jp",
	"okagaki.fukuoka.jp",
	"okawa.fukuoka.jp",
	"oki.fukuoka.jp",
	"omuta.fukuoka.jp",
	"onga.fukuoka.jp",
	"onojo.fukuoka.jp",
	"oto.fukuoka.jp",
	"saigawa.fukuoka.jp",
	"sasaguri.fukuoka.jp",
	"shingu.fukuoka.jp",
	"shinyoshitomi.fukuoka.jp",
	"shonai.fukuoka.jp",
	"soeda.fukuoka.jp",
	"sue.fukuoka.jp",
	"tachiarai.fukuoka.jp",
	"tagawa.fukuoka.jp",
	"takata.fukuoka.jp",
	"toho.fukuoka.jp",
	"toyotsu.fukuoka.jp",
	"tsuiki.fukuoka.jp",
	"ukiha.fukuoka.jp",
	"umi.fukuoka.jp",
	"usui.fukuoka.jp",
	"yamada.fukuoka.jp",
	"yame.fukuoka.jp",
	"yanagawa.fukuoka.jp",
	"yukuhashi.fukuoka.jp",
	"aizubange.fukushima.jp",
	"aizumisato.fukushima.jp",
	"aizuwakamatsu.fukushima.jp",
	"asakawa.fukushima.jp",
	"bandai.fukushima.jp",
	"date.fukushima.jp",
	"fukushima.fukushima.jp",
	"furudono.fukushima.jp",
	"futaba.fukushima.jp",
	"hanawa.fukushima.jp",
	"higashi.fukushima.jp",
	"hirata.fukushima.jp",
	"hirono.fukushima.jp",
	"iitate.fukushima.jp",
	"inawashiro.fukushima.jp",
	"ishikawa.fukushima.jp",
	"iwaki.fukushima.jp",
	"izumizaki.fukushima.jp",
	"kagamiishi.fukushima.jp",
	"kaneyama.fukushima.jp",
	"kawamata.fukushima.jp",
	"kitakata.fukushima.jp",
	"kitashiobara.fukushima.jp",
	"koori.fukushima.jp",
	"koriyama.fukushima.jp",
	"kunimi.fukushima.jp",
	"miharu.fukushima.jp",
	"mishima.fukushima.jp",
	"namie.fukushima.jp",
	"nango.fukushima.jp",
	"nishiaizu.fukushima.jp",
	"nishigo.fukushima.jp",
	"okuma.fukushima.jp",
	"omotego.fukushima.jp",
	"ono.fukushima.jp",
	"otama.fukushima.jp",
	"samegawa.fukushima.jp",
	"shimogo.fukushima.jp",
	"shirakawa.fukushima.jp",
	"showa.fukushima.jp",
	"soma.fukushima.jp",
	"sukagawa.fukushima.jp",
	"taishin.fukushima.jp",
	"tamakawa.fukushima.jp",
	"tanagura.fukushima.jp",
	"tenei.fukushima.jp",
	"yabuki.fukushima.jp",
	"yamato.fukushima.jp",
	"yamatsuri.fukushima.jp",
	"yanaizu.fukushima.jp",
	"yugawa.fukushima.jp",
	"anpachi.gifu.jp",
	"ena.gifu.jp",
	"gifu.gifu.jp",
	"ginan.gifu.jp",
	"godo.gifu.jp",
	"gujo.gifu.jp",
	"hashima.gifu.jp",
	"hichiso.gifu.jp",
	"hida.gifu.jp",
	"higashishirakawa.gifu.jp",
	"ibigawa.gifu.jp",
	"ikeda.gifu.jp",
	"kakamigahara.gifu.jp",
	"kani.gifu.jp",
	"kasahara.gifu.jp",
	"kasamatsu.gifu.jp",
	"kawaue.gifu.jp",
	"kitagata.gifu.jp",
	"mino.gifu.jp",
	"minokamo.gifu.jp",
	"mitake.gifu.jp",
	"mizunami.gifu.jp",
	"motosu.gifu.jp",
	"nakatsugawa.gifu.jp",
	"ogaki.gifu.jp",
	"sakahogi.gifu.jp",
	"seki.gifu.jp",
	"sekigahara.gifu.jp",
	"shirakawa.gifu.jp",
	"tajimi.gifu.jp",
	"takayama.gifu.jp",
	"tarui.gifu.jp",
	"toki.gifu.jp",
	"tomika.gifu.jp",
	"wanouchi.gifu.jp",
	"yamagata.gifu.jp",
	"yaotsu.gifu.jp",
	"yoro.gifu.jp",
	"annaka.gunma.jp",
	"chiyoda.gunma.jp",
	"fujioka.gunma.jp",
	"higashiagatsuma.gunma.jp",
	"isesaki.gunma.jp",
	"itakura.gunma.jp",
	"kanna.gunma.jp",
	"kanra.gunma.jp",
	"katashina.gunma.jp",
	"kawaba.gunma.jp",
	"kiryu.gunma.jp",
	"kusatsu.gunma.jp",
	"maebashi.gunma.jp",
	"meiwa.gunma.jp",
	"midori.gunma.jp",
	"minakami.gunma.jp",
	"naganohara.gunma.jp",
	"nakanojo.gunma.jp",
	"nanmoku.gunma.jp",
	"numata.gunma.jp",
	"oizumi.gunma.jp",
	"ora.gunma.jp",
	"ota.gunma.jp",
	"shibukawa.gunma.jp",
	"shimonita.gunma.jp",
	"shinto.gunma.jp",
	"showa.gunma.jp",
	"takasaki.gunma.jp",
	"takayama.gunma.jp",
	"tamamura.gunma.jp",
	"tatebayashi.gunma.jp",
	"tomioka.gunma.jp",
	"tsukiyono.gunma.jp",
	"tsumagoi.gunma.jp",
	"ueno.gunma.jp",
	"yoshioka.gunma.jp",
	"asaminami.hiroshima.jp",
	"daiwa.hiroshima.jp",
	"etajima.hiroshima.jp",
	"fuchu.hiroshima.jp",
	"fukuyama.hiroshima.jp",
	"hatsukaichi.hiroshima.jp",
	"higashihiroshima.hiroshima.jp",
	"hongo.hiroshima.jp",
	"jinsekikogen.hiroshima.jp",
	"kaita.hiroshima.jp",
	"kui.hiroshima.jp",
	"kumano.hiroshima.jp",
	"kure.hiroshima.jp",
	"mihara.hiroshima.jp",
	"miyoshi.hiroshima.jp",
	"naka.hiroshima.jp",
	"onomichi.hiroshima.jp",
	"osakikamijima.hiroshima.jp",
	"otake.hiroshima.jp",
	"saka.hiroshima.jp",
	"sera.hiroshima.jp",
	"seranishi.hiroshima.jp",
	"shinichi.hiroshima.jp",
	"shobara.hiroshima.jp",
	"takehara.hiroshima.jp",
	"abashiri.hokkaido.jp",
	"abira.hokkaido.jp",
	"aibetsu.hokkaido.jp",
	"akabira.hokkaido.jp",
	"akkeshi.hokkaido.jp",
	"asahikawa.hokkaido.jp",
	"ashibetsu.hokkaido.jp",
	"ashoro.hokkaido.jp",
	"assabu.hokkaido.jp",
	"atsuma.hokkaido.jp",
	"bibai.hokkaido.jp",
	"biei.hokkaido.jp",
	"bifuka.hokkaido.jp",
	"bihoro.hokkaido.jp",
	"biratori.hokkaido.jp",
	"chippubetsu.hokkaido.jp",
	"chitose.hokkaido.jp",
	"date.hokkaido.jp",
	"ebetsu.hokkaido.jp",
	"embetsu.hokkaido.jp",
	"eniwa.hokkaido.jp",
	"erimo.hokkaido.jp",
	"esan.hokkaido.jp",
	"esashi.hokkaido.jp",
	"fukagawa.hokkaido.jp",
	"fukushima.hokkaido.jp",
	"furano.hokkaido.jp",
	"furubira.hokkaido.jp",
	"haboro.hokkaido.jp",
	"hakodate.hokkaido.jp",
	"hamatonbetsu.hokkaido.jp",
	"hidaka.hokkaido.jp",
	"higashikagura.hokkaido.jp",
	"higashikawa.hokkaido.jp",
	"hiroo.hokkaido.jp",
	"hokuryu.hokkaido.jp",
	"hokuto.hokkaido.jp",
	"honbetsu.hokkaido.jp",
	"horokanai.hokkaido.jp",
	"horonobe.hokkaido.jp",
	"ikeda.hokkaido.jp",
	"imakane.hokkaido.jp",
	"ishikari.hokkaido.jp",
	"iwamizawa.hokkaido.jp",
	"iwanai.hokkaido.jp",
	"kamifurano.hokkaido.jp",
	"kamikawa.hokkaido.jp",
	"kamishihoro.hokkaido.jp",
	"kamisunagawa.hokkaido.jp",
	"kamoenai.hokkaido.jp",
	"kayabe.hokkaido.jp",
	"kembuchi.hokkaido.jp",
	"kikonai.hokkaido.jp",
	"kimobetsu.hokkaido.jp",
	"kitahiroshima.hokkaido.jp",
	"kitami.hokkaido.jp",
	"kiyosato.hokkaido.jp",
	"koshimizu.hokkaido.jp",
	"kunneppu.hokkaido.jp",
	"kuriyama.hokkaido.jp",
	"kuromatsunai.hokkaido.jp",
	"kushiro.hokkaido.jp",
	"kutchan.hokkaido.jp",
	"kyowa.hokkaido.jp",
	"mashike.hokkaido.jp",
	"matsumae.hokkaido.jp",
	"mikasa.hokkaido.jp",
	"minamifurano.hokkaido.jp",
	"mombetsu.hokkaido.jp",
	"moseushi.hokkaido.jp",
	"mukawa.hokkaido.jp",
	"muroran.hokkaido.jp",
	"naie.hokkaido.jp",
	"nakagawa.hokkaido.jp",
	"nakasatsunai.hokkaido.jp",
	"nakatombetsu.hokkaido.jp",
	"nanae.hokkaido.jp",
	"nanporo.hokkaido.jp",
	"nayoro.hokkaido.jp",
	"nemuro.hokkaido.jp",
	"niikappu.hokkaido.jp",
	"niki.hokkaido.jp",
	"nishiokoppe.hokkaido.jp",
	"noboribetsu.hokkaido.jp",
	"numata.hokkaido.jp",
	"obihiro.hokkaido.jp",
	"obira.hokkaido.jp",
	"oketo.hokkaido.jp",
	"okoppe.hokkaido.jp",
	"otaru.hokkaido.jp",
	"otobe.hokkaido.jp",
	"otofuke.hokkaido.jp",
	"otoineppu.hokkaido.jp",
	"oumu.hokkaido.jp",
	"ozora.hokkaido.jp",
	"pippu.hokkaido.jp",
	"rankoshi.hokkaido.jp",
	"rebun.hokkaido.jp",
	"rikubetsu.hokkaido.jp",
	"rishiri.hokkaido.jp",
	"rishirifuji.hokkaido.jp",
	"saroma.hokkaido.jp",
	"sarufutsu.hokkaido.jp",
	"shakotan.hokkaido.jp",
	"shari.hokkaido.jp",
	"shibecha.hokkaido.jp",
	"shibetsu.hokkaido.jp",
	"shikabe.hokkaido.jp",
	"shikaoi.hokkaido.jp",
	"shimamaki.hokkaido.jp",
	"shimizu.hokkaido.jp",
	"shimokawa.hokkaido.jp",
	"shinshinotsu.hokkaido.jp",
	"shintoku.hokkaido.jp",
	"shiranuka.hokkaido.jp",
	"shiraoi.hokkaido.jp",
	"shiriuchi.hokkaido.jp",
	"sobetsu.hokkaido.jp",
	"sunagawa.hokkaido.jp",
	"taiki.hokkaido.jp",
	"takasu.hokkaido.jp",
	"takikawa.hokkaido.jp",
	"takinoue.hokkaido.jp",
	"teshikaga.hokkaido.jp",
	"tobetsu.hokkaido.jp",
	"tohma.hokkaido.jp",
	"tomakomai.hokkaido.jp",
	"tomari.hokkaido.jp",
	"toya.hokkaido.jp",
	"toyako.hokkaido.jp",
	"toyotomi.hokkaido.jp",
	"toyoura.hokkaido.jp",
	"tsubetsu.hokkaido.jp",
	"tsukigata.hokkaido.jp",
	"urakawa.hokkaido.jp",
	"urausu.hokkaido.jp",
	"uryu.hokkaido.jp",
	"utashinai.hokkaido.jp",
	"wakkanai.hokkaido.jp",
	"wassamu.hokkaido.jp",
	"yakumo.hokkaido.jp",
	"yoichi.hokkaido.jp",
	"aioi.hyogo.jp",
	"akashi.hyogo.jp",
	"ako.hyogo.jp",
	"amagasaki.hyogo.jp",
	"aogaki.hyogo.jp",
	"asago.hyogo.jp",
	"ashiya.hyogo.jp",
	"awaji.hyogo.jp",
	"fukusaki.hyogo.jp",
	"goshiki.hyogo.jp",
	"harima.hyogo.jp",
	"himeji.hyogo.jp",
	"ichikawa.hyogo.jp",
	"inagawa.hyogo.jp",
	"itami.hyogo.jp",
	"kakogawa.hyogo.jp",
	"kamigori.hyogo.jp",
	"kamikawa.hyogo.jp",
	"kasai.hyogo.jp",
	"kasuga.hyogo.jp",
	"kawanishi.hyogo.jp",
	"miki.hyogo.jp",
	"minamiawaji.hyogo.jp",
	"nishinomiya.hyogo.jp",
	"nishiwaki.hyogo.jp",
	"ono.hyogo.jp",
	"sanda.hyogo.jp",
	"sannan.hyogo.jp",
	"sasayama.hyogo.jp",
	"sayo.hyogo.jp",
	"shingu.hyogo.jp",
	"shinonsen.hyogo.jp",
	"shiso.hyogo.jp",
	"sumoto.hyogo.jp",
	"taishi.hyogo.jp",
	"taka.hyogo.jp",
	"takarazuka.hyogo.jp",
	"takasago.hyogo.jp",
	"takino.hyogo.jp",
	"tamba.hyogo.jp",
	"tatsuno.hyogo.jp",
	"toyooka.hyogo.jp",
	"yabu.hyogo.jp",
	"yashiro.hyogo.jp",
	"yoka.hyogo.jp",
	"yokawa.hyogo.jp",
	"ami.ibaraki.jp",
	"asahi.ibaraki.jp",
	"bando.ibaraki.jp",
	"chikusei.ibaraki.jp",
	"daigo.ibaraki.jp",
	"fujishiro.ibaraki.jp",
	"hitachi.ibaraki.jp",
	"hitachinaka.ibaraki.jp",
	"hitachiomiya.ibaraki.jp",
	"hitachiota.ibaraki.jp",
	"ibaraki.ibaraki.jp",
	"ina.ibaraki.jp",
	"inashiki.ibaraki.jp",
	"itako.ibaraki.jp",
	"iwama.ibaraki.jp",
	"joso.ibaraki.jp",
	"kamisu.ibaraki.jp",
	"kasama.ibaraki.jp",
	"kashima.ibaraki.jp",
	"kasumigaura.ibaraki.jp",
	"koga.ibaraki.jp",
	"miho.ibaraki.jp",
	"mito.ibaraki.jp",
	"moriya.ibaraki.jp",
	"naka.ibaraki.jp",
	"namegata.ibaraki.jp",
	"oarai.ibaraki.jp",
	"ogawa.ibaraki.jp",
	"omitama.ibaraki.jp",
	"ryugasaki.ibaraki.jp",
	"sakai.ibaraki.jp",
	"sakuragawa.ibaraki.jp",
	"shimodate.ibaraki.jp",
	"shimotsuma.ibaraki.jp",
	"shirosato.ibaraki.jp",
	"sowa.ibaraki.jp",
	"suifu.ibaraki.jp",
	"takahagi.ibaraki.jp",
	"tamatsukuri.ibaraki.jp",
	"tokai.ibaraki.jp",
	"tomobe.ibaraki.jp",
	"tone.ibaraki.jp",
	"toride.ibaraki.jp",
	"tsuchiura.ibaraki.jp",
	"tsukuba.ibaraki.jp",
	"uchihara.ibaraki.jp",
	"ushiku.ibaraki.jp",
	"yachiyo.ibaraki.jp",
	"yamagata.ibaraki.jp",
	"yawara.ibaraki.jp",
	"yuki.ibaraki.jp",
	"anamizu.ishikawa.jp",
	"hakui.ishikawa.jp",
	"hakusan.ishikawa.jp",
	"kaga.ishikawa.jp",
	"kahoku.ishikawa.jp",
	"kanazawa.ishikawa.jp",
	"kawakita.ishikawa.jp",
	"komatsu.ishikawa.jp",
	"nakanoto.ishikawa.jp",
	"nanao.ishikawa.jp",
	"nomi.ishikawa.jp",
	"nonoichi.ishikawa.jp",
	"noto.ishikawa.jp",
	"shika.ishikawa.jp",
	"suzu.ishikawa.jp",
	"tsubata.ishikawa.jp",
	"tsurugi.ishikawa.jp",
	"uchinada.ishikawa.jp",
	"wajima.ishikawa.jp",
	"fudai.iwate.jp",
	"fujisawa.iwate.jp",
	"hanamaki.iwate.jp",
	"hiraizumi.iwate.jp",
	"hirono.iwate.jp",
	"ichinohe.iwate.jp",
	"ichinoseki.iwate.jp",
	"iwaizumi.iwate.jp",
	"iwate.iwate.jp",
	"joboji.iwate.jp",
	"kamaishi.iwate.jp",
	"kanegasaki.iwate.jp",
	"karumai.iwate.jp",
	"kawai.iwate.jp",
	"kitakami.iwate.jp",
	"kuji.iwate.jp",
	"kunohe.iwate.jp",
	"kuzumaki.iwate.jp",
	"miyako.iwate.jp",
	"mizusawa.iwate.jp",
	"morioka.iwate.jp",
	"ninohe.iwate.jp",
	"noda.iwate.jp",
	"ofunato.iwate.jp",
	"oshu.iwate.jp",
	"otsuchi.iwate.jp",
	"rikuzentakata.iwate.jp",
	"shiwa.iwate.jp",
	"shizukuishi.iwate.jp",
	"sumita.iwate.jp",
	"tanohata.iwate.jp",
	"tono.iwate.jp",
	"yahaba.iwate.jp",
	"yamada.iwate.jp",
	"ayagawa.kagawa.jp",
	"higashikagawa.kagawa.jp",
	"kanonji.kagawa.jp",
	"kotohira.kagawa.jp",
	"manno.kagawa.jp",
	"marugame.kagawa.jp",
	"mitoyo.kagawa.jp",
	"naoshima.kagawa.jp",
	"sanuki.kagawa.jp",
	"tadotsu.kagawa.jp",
	"takamatsu.kagawa.jp",
	"tonosho.kagawa.jp",
	"uchinomi.kagawa.jp",
	"utazu.kagawa.jp",
	"zentsuji.kagawa.jp",
	"akune.kagoshima.jp",
	"amami.kagoshima.jp",
	"hioki.kagoshima.jp",
	"isa.kagoshima.jp",
	"isen.kagoshima.jp",
	"izumi.kagoshima.jp",
	"kagoshima.kagoshima.jp",
	"kanoya.kagoshima.jp",
	"kawanabe.kagoshima.jp",
	"kinko.kagoshima.jp",
	"kouyama.kagoshima.jp",
	"makurazaki.kagoshima.jp",
	"matsumoto.kagoshima.jp",
	"minamitane.kagoshima.jp",
	"nakatane.kagoshima.jp",
	"nishinoomote.kagoshima.jp",
	"satsumasendai.kagoshima.jp",
	"soo.kagoshima.jp",
	"tarumizu.kagoshima.jp",
	"yusui.kagoshima.jp",
	"aikawa.kanagawa.jp",
	"atsugi.kanagawa.jp",
	"ayase.kanagawa.jp",
	"chigasaki.kanagawa.jp",
	"ebina.kanagawa.jp",
	"fujisawa.kanagawa.jp",
	"hadano.kanagawa.jp",
	"hakone.kanagawa.jp",
	"hiratsuka.kanagawa.jp",
	"isehara.kanagawa.jp",
	"kaisei.kanagawa.jp",
	"kamakura.kanagawa.jp",
	"kiyokawa.kanagawa.jp",
	"matsuda.kanagawa.jp",
	"minamiashigara.kanagawa.jp",
	"miura.kanagawa.jp",
	"nakai.kanagawa.jp",
	"ninomiya.kanagawa.jp",
	"odawara.kanagawa.jp",
	"oi.kanagawa.jp",
	"oiso.kanagawa.jp",
	"sagamihara.kanagawa.jp",
	"samukawa.kanagawa.jp",
	"tsukui.kanagawa.jp",
	"yamakita.kanagawa.jp",
	"yamato.kanagawa.jp",
	"yokosuka.kanagawa.jp",
	"yugawara.kanagawa.jp",
	"zama.kanagawa.jp",
	"zushi.kanagawa.jp",
	"aki.kochi.jp",
	"geisei.kochi.jp",
	"hidaka.kochi.jp",
	"higashitsuno.kochi.jp",
	"ino.kochi.jp",
	"kagami.kochi.jp",
	"kami.kochi.jp",
	"kitagawa.kochi.jp",
	"kochi.kochi.jp",
	"mihara.kochi.jp",
	"motoyama.kochi.jp",
	"muroto.kochi.jp",
	"nahari.kochi.jp",
	"nakamura.kochi.jp",
	"nankoku.kochi.jp",
	"nishitosa.kochi.jp",
	"niyodogawa.kochi.jp",
	"ochi.kochi.jp",
	"okawa.kochi.jp",
	"otoyo.kochi.jp",
	"otsuki.kochi.jp",
	"sakawa.kochi.jp",
	"sukumo.kochi.jp",
	"susaki.kochi.jp",
	"tosa.kochi.jp",
	"tosashimizu.kochi.jp",
	"toyo.kochi.jp",
	"tsuno.kochi.jp",
	"umaji.kochi.jp",
	"yasuda.kochi.jp",
	"yusuhara.kochi.jp",
	"amakusa.kumamoto.jp",
	"arao.kumamoto.jp",
	"aso.kumamoto.jp",
	"choyo.kumamoto.jp",
	"gyokuto.kumamoto.jp",
	"kamiamakusa.kumamoto.jp",
	"kikuchi.kumamoto.jp",
	"kumamoto.kumamoto.jp",
	"mashiki.kumamoto.jp",
	"mifune.kumamoto.jp",
	"minamata.kumamoto.jp",
	"minamioguni.kumamoto.jp",
	"nagasu.kumamoto.jp",
	"nishihara.kumamoto.jp",
	"oguni.kumamoto.jp",
	"ozu.kumamoto.jp",
	"sumoto.kumamoto.jp",
	"takamori.kumamoto.jp",
	"uki.kumamoto.jp",
	"uto.kumamoto.jp",
	"yamaga.kumamoto.jp",
	"yamato.kumamoto.jp",
	"yatsushiro.kumamoto.jp",
	"ayabe.kyoto.jp",
	"fukuchiyama.kyoto.jp",
	"higashiyama.kyoto.jp",
	"ide.kyoto.jp",
	"ine.kyoto.jp",
	"joyo.kyoto.jp",
	"kameoka.kyoto.jp",
	"kamo.kyoto.jp",
	"kita.kyoto.jp",
	"kizu.kyoto.jp",
	"kumiyama.kyoto.jp",
	"kyotamba.kyoto.jp",
	"kyotanabe.kyoto.jp",
	"kyotango.kyoto.jp",
	"maizuru.kyoto.jp",
	"minami.kyoto.jp",
	"minamiyamashiro.kyoto.jp",
	"miyazu.kyoto.jp",
	"muko.kyoto.jp",
	"nagaokakyo.kyoto.jp",
	"nakagyo.kyoto.jp",
	"nantan.kyoto.jp",
	"oyamazaki.kyoto.jp",
	"sakyo.kyoto.jp",
	"seika.kyoto.jp",
	"tanabe.kyoto.jp",
	"uji.kyoto.jp",
	"ujitawara.kyoto.jp",
	"wazuka.kyoto.jp",
	"yamashina.kyoto.jp",
	"yawata.kyoto.jp",
	"asahi.mie.jp",
	"inabe.mie.jp",
	"ise.mie.jp",
	"kameyama.mie.jp",
	"kawagoe.mie.jp",
	"kiho.mie.jp",
	"kisosaki.mie.jp",
	"kiwa.mie.jp",
	"komono.mie.jp",
	"kumano.mie.jp",
	"kuwana.mie.jp",
	"matsusaka.mie.jp",
	"meiwa.mie.jp",
	"mihama.mie.jp",
	"minamiise.mie.jp",
	"misugi.mie.jp",
	"miyama.mie.jp",
	"nabari.mie.jp",
	"shima.mie.jp",
	"suzuka.mie.jp",
	"tado.mie.jp",
	"taiki.mie.jp",
	"taki.mie.jp",
	"tamaki.mie.jp",
	"toba.mie.jp",
	"tsu.mie.jp",
	"udono.mie.jp",
	"ureshino.mie.jp",
	"watarai.mie.jp",
	"yokkaichi.mie.jp",
	"furukawa.miyagi.jp",
	"higashimatsushima.miyagi.jp",
	"ishinomaki.miyagi.jp",
	"iwanuma.miyagi.jp",
	"kakuda.miyagi.jp",
	"kami.miyagi.jp",
	"kawasaki.miyagi.jp",
	"marumori.miyagi.jp",
	"matsushima.miyagi.jp",
	"minamisanriku.miyagi.jp",
	"misato.miyagi.jp",
	"murata.miyagi.jp",
	"natori.miyagi.jp",
	"ogawara.miyagi.jp",
	"ohira.miyagi.jp",
	"onagawa.miyagi.jp",
	"osaki.miyagi.jp",
	"rifu.miyagi.jp",
	"semine.miyagi.jp",
	"shibata.miyagi.jp",
	"shichikashuku.miyagi.jp",
	"shikama.miyagi.jp",
	"shiogama.miyagi.jp",
	"shiroishi.miyagi.jp",
	"tagajo.miyagi.jp",
	"taiwa.miyagi.jp",
	"tome.miyagi.jp",
	"tomiya.miyagi.jp",
	"wakuya.miyagi.jp",
	"watari.miyagi.jp",
	"yamamoto.miyagi.jp",
	"zao.miyagi.jp",
	"aya.miyazaki.jp",
	"ebino.miyazaki.jp",
	"gokase.miyazaki.jp",
	"hyuga.miyazaki.jp",
	"kadogawa.miyazaki.jp",
	"kawaminami.miyazaki.jp",
	"kijo.miyazaki.jp",
	"kitagawa.miyazaki.jp",
	"kitakata.miyazaki.jp",
	"kitaura.miyazaki.jp",
	"kobayashi.miyazaki.jp",
	"kunitomi.miyazaki.jp",
	"kushima.miyazaki.jp",
	"mimata.miyazaki.jp",
	"miyakonojo.miyazaki.jp",
	"miyazaki.miyazaki.jp",
	"morotsuka.miyazaki.jp",
	"nichinan.miyazaki.jp",
	"nishimera.miyazaki.jp",
	"nobeoka.miyazaki.jp",
	"saito.miyazaki.jp",
	"shiiba.miyazaki.jp",
	"shintomi.miyazaki.jp",
	"takaharu.miyazaki.jp",
	"takanabe.miyazaki.jp",
	"takazaki.miyazaki.jp",
	"tsuno.miyazaki.jp",
	"achi.nagano.jp",
	"agematsu.nagano.jp",
	"anan.nagano.jp",
	"aoki.nagano.jp",
	"asahi.nagano.jp",
	"azumino.nagano.jp",
	"chikuhoku.nagano.jp",
	"chikuma.nagano.jp",
	"chino.nagano.jp",
	"fujimi.nagano.jp",
	"hakuba.nagano.jp",
	"hara.nagano.jp",
	"hiraya.nagano.jp",
	"iida.nagano.jp",
	"iijima.nagano.jp",
	"iiyama.nagano.jp",
	"iizuna.nagano.jp",
	"ikeda.nagano.jp",
	"ikusaka.nagano.jp",
	"ina.nagano.jp",
	"karuizawa.nagano.jp",
	"kawakami.nagano.jp",
	"kiso.nagano.jp",
	"kisofukushima.nagano.jp",
	"kitaaiki.nagano.jp",
	"komagane.nagano.jp",
	"komoro.nagano.jp",
	"matsukawa.nagano.jp",
	"matsumoto.nagano.jp",
	"miasa.nagano.jp",
	"minamiaiki.nagano.jp",
	"minamimaki.nagano.jp",
	"minamiminowa.nagano.jp",
	"minowa.nagano.jp",
	"miyada.nagano.jp",
	"miyota.nagano.jp",
	"mochizuki.nagano.jp",
	"nagano.nagano.jp",
	"nagawa.nagano.jp",
	"nagiso.nagano.jp",
	"nakagawa.nagano.jp",
	"nakano.nagano.jp",
	"nozawaonsen.nagano.jp",
	"obuse.nagano.jp",
	"ogawa.nagano.jp",
	"okaya.nagano.jp",
	"omachi.nagano.jp",
	"omi.nagano.jp",
	"ookuwa.nagano.jp",
	"ooshika.nagano.jp",
	"otaki.nagano.jp",
	"otari.nagano.jp",
	"sakae.nagano.jp",
	"sakaki.nagano.jp",
	"saku.nagano.jp",
	"sakuho.nagano.jp",
	"shimosuwa.nagano.jp",
	"shinanomachi.nagano.jp",
	"shiojiri.nagano.jp",
	"suwa.nagano.jp",
	"suzaka.nagano.jp",
	"takagi.nagano.jp",
	"takamori.nagano.jp",
	"takayama.nagano.jp",
	"tateshina.nagano.jp",
	"tatsuno.nagano.jp",
	"togakushi.nagano.jp",
	"togura.nagano.jp",
	"tomi.nagano.jp",
	"ueda.nagano.jp",
	"wada.nagano.jp",
	"yamagata.nagano.jp",
	"yamanouchi.nagano.jp",
	"yasaka.nagano.jp",
	"yasuoka.nagano.jp",
	"chijiwa.nagasaki.jp",
	"futsu.nagasaki.jp",
	"goto.nagasaki.jp",
	"hasami.nagasaki.jp",
	"hirado.nagasaki.jp",
	"iki.nagasaki.jp",
	"isahaya.nagasaki.jp",
	"kawatana.nagasaki.jp",
	"kuchinotsu.nagasaki.jp",
	"matsuura.nagasaki.jp",
	"nagasaki.nagasaki.jp",
	"obama.nagasaki.jp",
	"omura.nagasaki.jp",
	"oseto.nagasaki.jp",
	"saikai.nagasaki.jp",
	"sasebo.nagasaki.jp",
	"seihi.nagasaki.jp",
	"shimabara.nagasaki.jp",
	"shinkamigoto.nagasaki.jp",
	"togitsu.nagasaki.jp",
	"tsushima.nagasaki.jp",
	"unzen.nagasaki.jp",
	"ando.nara.jp",
	"gose.nara.jp",
	"heguri.nara.jp",
	"higashiyoshino.nara.jp",
	"ikaruga.nara.jp",
	"ikoma.nara.jp",
	"kamikitayama.nara.jp",
	"kanmaki.nara.jp",
	"kashiba.nara.jp",
	"kashihara.nara.jp",
	"katsuragi.nara.jp",
	"kawai.nara.jp",
	"kawakami.nara.jp",
	"kawanishi.nara.jp",
	"koryo.nara.jp",
	"kurotaki.nara.jp",
	"mitsue.nara.jp",
	"miyake.nara.jp",
	"nara.nara.jp",
	"nosegawa.nara.jp",
	"oji.nara.jp",
	"ouda.nara.jp",
	"oyodo.nara.jp",
	"sakurai.nara.jp",
	"sango.nara.jp",
	"shimoichi.nara.jp",
	"shimokitayama.nara.jp",
	"shinjo.nara.jp",
	"soni.nara.jp",
	"takatori.nara.jp",
	"tawaramoto.nara.jp",
	"tenkawa.nara.jp",
	"tenri.nara.jp",
	"uda.nara.jp",
	"yamatokoriyama.nara.jp",
	"yamatotakada.nara.jp",
	"yamazoe.nara.jp",
	"yoshino.nara.jp",
	"aga.niigata.jp",
	"agano.niigata.jp",
	"gosen.niigata.jp",
	"itoigawa.niigata.jp",
	"izumozaki.niigata.jp",
	"joetsu.niigata.jp",
	"kamo.niigata.jp",
	"kariwa.niigata.jp",
	"kashiwazaki.niigata.jp",
	"minamiuonuma.niigata.jp",
	"mitsuke.niigata.jp",
	"muika.niigata.jp",
	"murakami.niigata.jp",
	"myoko.niigata.jp",
	"nagaoka.niigata.jp",
	"niigata.niigata.jp",
	"ojiya.niigata.jp",
	"omi.niigata.jp",
	"sado.niigata.jp",
	"sanjo.niigata.jp",
	"seiro.niigata.jp",
	"seirou.niigata.jp",
	"sekikawa.niigata.jp",
	"shibata.niigata.jp",
	"tagami.niigata.jp",
	"tainai.niigata.jp",
	"tochio.niigata.jp",
	"tokamachi.niigata.jp",
	"tsubame.niigata.jp",
	"tsunan.niigata.jp",
	"uonuma.niigata.jp",
	"yahiko.niigata.jp",
	"yoita.niigata.jp",
	"yuzawa.niigata.jp",
	"beppu.oita.jp",
	"bungoono.oita.jp",
	"bungotakada.oita.jp",
	"hasama.oita.jp",
	"hiji.oita.jp",
	"himeshima.oita.jp",
	"hita.oita.jp",
	"kamitsue.oita.jp",
	"kokonoe.oita.jp",
	"kuju.oita.jp",
	"kunisaki.oita.jp",
	"kusu.oita.jp",
	"oita.oita.jp",
	"saiki.oita.jp",
	"taketa.oita.jp",
	"tsukumi.oita.jp",
	"usa.oita.jp",
	"usuki.oita.jp",
	"yufu.oita.jp",
	"akaiwa.okayama.jp",
	"asakuchi.okayama.jp",
	"bizen.okayama.jp",
	"hayashima.okayama.jp",
	"ibara.okayama.jp",
	"kagamino.okayama.jp",
	"kasaoka.okayama.jp",
	"kibichuo.okayama.jp",
	"kumenan.okayama.jp",
	"kurashiki.okayama.jp",
	"maniwa.okayama.jp",
	"misaki.okayama.jp",
	"nagi.okayama.jp",
	"niimi.okayama.jp",
	"nishiawakura.okayama.jp",
	"okayama.okayama.jp",
	"satosho.okayama.jp",
	"setouchi.okayama.jp",
	"shinjo.okayama.jp",
	"shoo.okayama.jp",
	"soja.okayama.jp",
	"takahashi.okayama.jp",
	"tamano.okayama.jp",
	"tsuyama.okayama.jp",
	"wake.okayama.jp",
	"yakage.okayama.jp",
	"aguni.okinawa.jp",
	"ginowan.okinawa.jp",
	"ginoza.okinawa.jp",
	"gushikami.okinawa.jp",
	"haebaru.okinawa.jp",
	"higashi.okinawa.jp",
	"hirara.okinawa.jp",
	"iheya.okinawa.jp",
	"ishigaki.okinawa.jp",
	"ishikawa.okinawa.jp",
	"itoman.okinawa.jp",
	"izena.okinawa.jp",
	"kadena.okinawa.jp",
	"kin.okinawa.jp",
	"kitadaito.okinawa.jp",
	"kitanakagusuku.okinawa.jp",
	"kumejima.okinawa.jp",
	"kunigami.okinawa.jp",
	"minamidaito.okinawa.jp",
	"motobu.okinawa.jp",
	"nago.okinawa.jp",
	"naha.okinawa.jp",
	"nakagusuku.okinawa.jp",
	"nakijin.okinawa.jp",
	"nanjo.okinawa.jp",
	"nishihara.okinawa.jp",
	"ogimi.okinawa.jp",
	"okinawa.okinawa.jp",
	"onna.okinawa.jp",
	"shimoji.okinawa.jp",
	"taketomi.okinawa.jp",
	"tarama.okinawa.jp",
	"tokashiki.okinawa.jp",
	"tomigusuku.okinawa.jp",
	"tonaki.okinawa.jp",
	"urasoe.okinawa.jp",
	"uruma.okinawa.jp",
	"yaese.okinawa.jp",
	"yomitan.okinawa.jp",
	"yonabaru.okinawa.jp",
	"yonaguni.okinawa.jp",
	"zamami.okinawa.jp",
	"abeno.osaka.jp",
	"chihayaakasaka.osaka.jp",
	"chuo.osaka.jp",
	"daito.osaka.jp",
	"fujiidera.osaka.jp",
	"habikino.osaka.jp",
	"hannan.osaka.jp",
	"higashiosaka.osaka.jp",
	"higashisumiyoshi.osaka.jp",
	"higashiyodogawa.osaka.jp",
	"hirakata.osaka.jp",
	"ibaraki.osaka.jp",
	"ikeda.osaka.jp",
	"izumi.osaka.jp",
	"izumiotsu.osaka.jp",
	"izumisano.osaka.jp",
	"kadoma.osaka.jp",
	"kaizuka.osaka.jp",
	"kanan.osaka.jp",
	"kashiwara.osaka.jp",
	"katano.osaka.jp",
	"kawachinagano.osaka.jp",
	"kishiwada.osaka.jp",
	"kita.osaka.jp",
	"kumatori.osaka.jp",
	"matsubara.osaka.jp",
	"minato.osaka.jp",
	"minoh.osaka.jp",
	"misaki.osaka.jp",
	"moriguchi.osaka.jp",
	"neyagawa.osaka.jp",
	"nishi.osaka.jp",
	"nose.osaka.jp",
	"osakasayama.osaka.jp",
	"sakai.osaka.jp",
	"sayama.osaka.jp",
	"sennan.osaka.jp",
	"settsu.osaka.jp",
	"shijonawate.osaka.jp",
	"shimamoto.osaka.jp",
	"suita.osaka.jp",
	"tadaoka.osaka.jp",
	"taishi.osaka.jp",
	"tajiri.osaka.jp",
	"takaishi.osaka.jp",
	"takatsuki.osaka.jp",
	"tondabayashi.osaka.jp",
	"toyonaka.osaka.jp",
	"toyono.osaka.jp",
	"yao.osaka.jp",
	"ariake.saga.jp",
	"arita.saga.jp",
	"fukudomi.saga.jp",
	"genkai.saga.jp",
	"hamatama.saga.jp",
	"hizen.saga.jp",
	"imari.saga.jp",
	"kamimine.saga.jp",
	"kanzaki.saga.jp",
	"karatsu.saga.jp",
	"kashima.saga.jp",
	"kitagata.saga.jp",
	"kitahata.saga.jp",
	"kiyama.saga.jp",
	"kouhoku.saga.jp",
	"kyuragi.saga.jp",
	"nishiarita.saga.jp",
	"ogi.saga.jp",
	"omachi.saga.jp",
	"ouchi.saga.jp",
	"saga.saga.jp",
	"shiroishi.saga.jp",
	"taku.saga.jp",
	"tara.saga.jp",
	"tosu.saga.jp",
	"yoshinogari.saga.jp",
	"arakawa.saitama.jp",
	"asaka.saitama.jp",
	"chichibu.saitama.jp",
	"fujimi.saitama.jp",
	"fujimino.saitama.jp",
	"fukaya.saitama.jp",
	"hanno.saitama.jp",
	"hanyu.saitama.jp",
	"hasuda.saitama.jp",
	"hatogaya.saitama.jp",
	"hatoyama.saitama.jp",
	"hidaka.saitama.jp",
	"higashichichibu.saitama.jp",
	"higashimatsuyama.saitama.jp",
	"honjo.saitama.jp",
	"ina.saitama.jp",
	"iruma.saitama.jp",
	"iwatsuki.saitama.jp",
	"kamiizumi.saitama.jp",
	"kamikawa.saitama.jp",
	"kamisato.saitama.jp",
	"kasukabe.saitama.jp",
	"kawagoe.saitama.jp",
	"kawaguchi.saitama.jp",
	"kawajima.saitama.jp",
	"kazo.saitama.jp",
	"kitamoto.saitama.jp",
	"koshigaya.saitama.jp",
	"kounosu.saitama.jp",
	"kuki.saitama.jp",
	"kumagaya.saitama.jp",
	"matsubushi.saitama.jp",
	"minano.saitama.jp",
	"misato.saitama.jp",
	"miyashiro.saitama.jp",
	"miyoshi.saitama.jp",
	"moroyama.saitama.jp",
	"nagatoro.saitama.jp",
	"namegawa.saitama.jp",
	"niiza.saitama.jp",
	"ogano.saitama.jp",
	"ogawa.saitama.jp",
	"ogose.saitama.jp",
	"okegawa.saitama.jp",
	"omiya.saitama.jp",
	"otaki.saitama.jp",
	"ranzan.saitama.jp",
	"ryokami.saitama.jp",
	"saitama.saitama.jp",
	"sakado.saitama.jp",
	"satte.saitama.jp",
	"sayama.saitama.jp",
	"shiki.saitama.jp",
	"shiraoka.saitama.jp",
	"soka.saitama.jp",
	"sugito.saitama.jp",
	"toda.saitama.jp",
	"tokigawa.saitama.jp",
	"tokorozawa.saitama.jp",
	"tsurugashima.saitama.jp",
	"urawa.saitama.jp",
	"warabi.saitama.jp",
	"yashio.saitama.jp",
	"yokoze.saitama.jp",
	"yono.saitama.jp",
	"yorii.saitama.jp",
	"yoshida.saitama.jp",
	"yoshikawa.saitama.jp",
	"yoshimi.saitama.jp",
	"aisho.shiga.jp",
	"gamo.shiga.jp",
	"higashiomi.shiga.jp",
	"hikone.shiga.jp",
	"koka.shiga.jp",
	"konan.shiga.jp",
	"kosei.shiga.jp",
	"koto.shiga.jp",
	"kusatsu.shiga.jp",
	"maibara.shiga.jp",
	"moriyama.shiga.jp",
	"nagahama.shiga.jp",
	"nishiazai.shiga.jp",
	"notogawa.shiga.jp",
	"omihachiman.shiga.jp",
	"otsu.shiga.jp",
	"ritto.shiga.jp",
	"ryuoh.shiga.jp",
	"takashima.shiga.jp",
	"takatsuki.shiga.jp",
	"torahime.shiga.jp",
	"toyosato.shiga.jp",
	"yasu.shiga.jp",
	"akagi.shimane.jp",
	"ama.shimane.jp",
	"gotsu.shimane.jp",
	"hamada.shimane.jp",
	"higashiizumo.shimane.jp",
	"hikawa.shimane.jp",
	"hikimi.shimane.jp",
	"izumo.shimane.jp",
	"kakinoki.shimane.jp",
	"masuda.shimane.jp",
	"matsue.shimane.jp",
	"misato.shimane.jp",
	"nishinoshima.shimane.jp",
	"ohda.shimane.jp",
	"okinoshima.shimane.jp",
	"okuizumo.shimane.jp",
	"shimane.shimane.jp",
	"tamayu.shimane.jp",
	"tsuwano.shimane.jp",
	"unnan.shimane.jp",
	"yakumo.shimane.jp",
	"yasugi.shimane.jp",
	"yatsuka.shimane.jp",
	"arai.shizuoka.jp",
	"atami.shizuoka.jp",
	"fuji.shizuoka.jp",
	"fujieda.shizuoka.jp",
	"fujikawa.shizuoka.jp",
	"fujinomiya.shizuoka.jp",
	"fukuroi.shizuoka.jp",
	"gotemba.shizuoka.jp",
	"haibara.shizuoka.jp",
	"hamamatsu.shizuoka.jp",
	"higashiizu.shizuoka.jp",
	"ito.shizuoka.jp",
	"iwata.shizuoka.jp",
	"izu.shizuoka.jp",
	"izunokuni.shizuoka.jp",
	"kakegawa.shizuoka.jp",
	"kannami.shizuoka.jp",
	"kawanehon.shizuoka.jp",
	"kawazu.shizuoka.jp",
	"kikugawa.shizuoka.jp",
	"kosai.shizuoka.jp",
	"makinohara.shizuoka.jp",
	"matsuzaki.shizuoka.jp",
	"minamiizu.shizuoka.jp",
	"mishima.shizuoka.jp",
	"morimachi.shizuoka.jp",
	"nishiizu.shizuoka.jp",
	"numazu.shizuoka.jp",
	"omaezaki.shizuoka.jp",
	"shimada.shizuoka.jp",
	"shimizu.shizuoka.jp",
	"shimoda.shizuoka.jp",
	"shizuoka.shizuoka.jp",
	"susono.shizuoka.jp",
	"yaizu.shizuoka.jp",
	"yoshida.shizuoka.jp",
	"ashikaga.tochigi.jp",
	"bato.tochigi.jp",
	"haga.tochigi.jp",
	"ichikai.tochigi.jp",
	"iwafune.tochigi.jp",
	"kaminokawa.tochigi.jp",
	"kanuma.tochigi.jp",
	"karasuyama.tochigi.jp",
	"kuroiso.tochigi.jp",
	"mashiko.tochigi.jp",
	"mibu.tochigi.jp",
	"moka.tochigi.jp",
	"motegi.tochigi.jp",
	"nasu.tochigi.jp",
	"nasushiobara.tochigi.jp",
	"nikko.tochigi.jp",
	"nishikata.tochigi.jp",
	"nogi.tochigi.jp",
	"ohira.tochigi.jp",
	"ohtawara.tochigi.jp",
	"oyama.tochigi.jp",
	"sakura.tochigi.jp",
	"sano.tochigi.jp",
	"shimotsuke.tochigi.jp",
	"shioya.tochigi.jp",
	"takanezawa.tochigi.jp",
	"tochigi.tochigi.jp",
	"tsuga.tochigi.jp",
	"ujiie.tochigi.jp",
	"utsunomiya.tochigi.jp",
	"yaita.tochigi.jp",
	"aizumi.tokushima.jp",
	"anan.tokushima.jp",
	"ichiba.tokushima.jp",
	"itano.tokushima.jp",
	"kainan.tokushima.jp",
	"komatsushima.tokushima.jp",
	"matsushige.tokushima.jp",
	"mima.tokushima.jp",
	"minami.tokushima.jp",
	"miyoshi.tokushima.jp",
	"mugi.tokushima.jp",
	"nakagawa.tokushima.jp",
	"naruto.tokushima.jp",
	"sanagochi.tokushima.jp",
	"shishikui.tokushima.jp",
	"tokushima.tokushima.jp",
	"wajiki.tokushima.jp",
	"adachi.tokyo.jp",
	"akiruno.tokyo.jp",
	"akishima.tokyo.jp",
	"aogashima.tokyo.jp",
	"arakawa.tokyo.jp",
	"bunkyo.tokyo.jp",
	"chiyoda.tokyo.jp",
	"chofu.tokyo.jp",
	"chuo.tokyo.jp",
	"edogawa.tokyo.jp",
	"fuchu.tokyo.jp",
	"fussa.tokyo.jp",
	"hachijo.tokyo.jp",
	"hachioji.tokyo.jp",
	"hamura.tokyo.jp",
	"higashikurume.tokyo.jp",
	"higashimurayama.tokyo.jp",
	"higashiyamato.tokyo.jp",
	"hino.tokyo.jp",
	"hinode.tokyo.jp",
	"hinohara.tokyo.jp",
	"inagi.tokyo.jp",
	"itabashi.tokyo.jp",
	"katsushika.tokyo.jp",
	"kita.tokyo.jp",
	"kiyose.tokyo.jp",
	"kodaira.tokyo.jp",
	"koganei.tokyo.jp",
	"kokubunji.tokyo.jp",
	"komae.tokyo.jp",
	"koto.tokyo.jp",
	"kouzushima.tokyo.jp",
	"kunitachi.tokyo.jp",
	"machida.tokyo.jp",
	"meguro.tokyo.jp",
	"minato.tokyo.jp",
	"mitaka.tokyo.jp",
	"mizuho.tokyo.jp",
	"musashimurayama.tokyo.jp",
	"musashino.tokyo.jp",
	"nakano.tokyo.jp",
	"nerima.tokyo.jp",
	"ogasawara.tokyo.jp",
	"okutama.tokyo.jp",
	"ome.tokyo.jp",
	"oshima.tokyo.jp",
	"ota.tokyo.jp",
	"setagaya.tokyo.jp",
	"shibuya.tokyo.jp",
	"shinagawa.tokyo.jp",
	"shinjuku.tokyo.jp",
	"suginami.tokyo.jp",
	"sumida.tokyo.jp",
	"tachikawa.tokyo.jp",
	"taito.tokyo.jp",
	"tama.tokyo.jp",
	"toshima.tokyo.jp",
	"chizu.tottori.jp",
	"hino.tottori.jp",
	"kawahara.tottori.jp",
	"koge.tottori.jp",
	"kotoura.tottori.jp",
	"misasa.tottori.jp",
	"nanbu.tottori.jp",
	"nichinan.tottori.jp",
	"sakaiminato.tottori.jp",
	"tottori.tottori.jp",
	"wakasa.tottori.jp",
	"yazu.tottori.jp",
	"yonago.tottori.jp",
	"asahi.toyama.jp",
	"fuchu.toyama.jp",
	"fukumitsu.toyama.jp",
	"funahashi.toyama.jp",
	"himi.toyama.jp",
	"imizu.toyama.jp",
	"inami.toyama.jp",
	"johana.toyama.jp",
	"kamiichi.toyama.jp",
	"kurobe.toyama.jp",
	"nakaniikawa.toyama.jp",
	"namerikawa.toyama.jp",
	"nanto.toyama.jp",
	"nyuzen.toyama.jp",
	"oyabe.toyama.jp",
	"taira.toyama.jp",
	"takaoka.toyama.jp",
	"tateyama.toyama.jp",
	"toga.toyama.jp",
	"tonami.toyama.jp",
	"toyama.toyama.jp",
	"unazuki.toyama.jp",
	"uozu.toyama.jp",
	"yamada.toyama.jp",
	"arida.wakayama.jp",
	"aridagawa.wakayama.jp",
	"gobo.wakayama.jp",
	"hashimoto.wakayama.jp",
	"hidaka.wakayama.jp",
	"hirogawa.wakayama.jp",
	"inami.wakayama.jp",
	"iwade.wakayama.jp",
	"kainan.wakayama.jp",
	"kamitonda.wakayama.jp",
	"katsuragi.wakayama.jp",
	"kimino.wakayama.jp",
	"kinokawa.wakayama.jp",
	"kitayama.wakayama.jp",
	"koya.wakayama.jp",
	"koza.wakayama.jp",
	"kozagawa.wakayama.jp",
	"kudoyama.wakayama.jp",
	"kushimoto.wakayama.jp",
	"mihama.wakayama.jp",
	"misato.wakayama.jp",
	"nachikatsuura.wakayama.jp",
	"shingu.wakayama.jp",
	"shirahama.wakayama.jp",
	"taiji.wakayama.jp",
	"tanabe.wakayama.jp",
	"wakayama.wakayama.jp",
	"yuasa.wakayama.jp",
	"yura.wakayama.jp",
	"asahi.yamagata.jp",
	"funagata.yamagata.jp",
	"higashine.yamagata.jp",
	"iide.yamagata.jp",
	"kahoku.yamagata.jp",
	"kaminoyama.yamagata.jp",
	"kaneyama.yamagata.jp",
	"kawanishi.yamagata.jp",
	"mamurogawa.yamagata.jp",
	"mikawa.yamagata.jp",
	"murayama.yamagata.jp",
	"nagai.yamagata.jp",
	"nakayama.yamagata.jp",
	"nanyo.yamagata.jp",
	"nishikawa.yamagata.jp",
	"obanazawa.yamagata.jp",
	"oe.yamagata.jp",
	"oguni.yamagata.jp",
	"ohkura.yamagata.jp",
	"oishida.yamagata.jp",
	"sagae.yamagata.jp",
	"sakata.yamagata.jp",
	"sakegawa.yamagata.jp",
	"shinjo.yamagata.jp",
	"shirataka.yamagata.jp",
	"shonai.yamagata.jp",
	"takahata.yamagata.jp",
	"tendo.yamagata.jp",
	"tozawa.yamagata.jp",
	"tsuruoka.yamagata.jp",
	"yamagata.yamagata.jp",
	"yamanobe.yamagata.jp",
	"yonezawa.yamagata.jp",
	"yuza.yamagata.jp",
	"abu.yamaguchi.jp",
	"hagi.yamaguchi.jp",
	"hikari.yamaguchi.jp",
	"hofu.yamaguchi.jp",
	"iwakuni.yamaguchi.jp",
	"kudamatsu.yamaguchi.jp",
	"mitou.yamaguchi.jp",
	"nagato.yamaguchi.jp",
	"oshima.yamaguchi.jp",
	"shimonoseki.yamaguchi.jp",
	"shunan.yamaguchi.jp",
	"tabuse.yamaguchi.jp",
	"tokuyama.yamaguchi.jp",
	"toyota.yamaguchi.jp",
	"ube.yamaguchi.jp",
	"yuu.yamaguchi.jp",
	"chuo.yamanashi.jp",
	"doshi.yamanashi.jp",
	"fuefuki.yamanashi.jp",
	"fujikawa.yamanashi.jp",
	"fujikawaguchiko.yamanashi.jp",
	"fujiyoshida.yamanashi.jp",
	"hayakawa.yamanashi.jp",
	"hokuto.yamanashi.jp",
	"ichikawamisato.yamanashi.jp",
	"kai.yamanashi.jp",
	"kofu.yamanashi.jp",
	"koshu.yamanashi.jp",
	"kosuge.yamanashi.jp",
	"minami-alps.yamanashi.jp",
	"minobu.yamanashi.jp",
	"nakamichi.yamanashi.jp",
	"nanbu.yamanashi.jp",
	"narusawa.yamanashi.jp",
	"nirasaki.yamanashi.jp",
	"nishikatsura.yamanashi.jp",
	"oshino.yamanashi.jp",
	"otsuki.yamanashi.jp",
	"showa.yamanashi.jp",
	"tabayama.yamanashi.jp",
	"tsuru.yamanashi.jp",
	"uenohara.yamanashi.jp",
	"yamanakako.yamanashi.jp",
	"yamanashi.yamanashi.jp",
	"ke",
	"ac.ke",
	"co.ke",
	"go.ke",
	"info.ke",
	"me.ke",
	"mobi.ke",
	"ne.ke",
	"or.ke",
	"sc.ke",
	"kg",
	"org.kg",
	"net.kg",
	"com.kg",
	"edu.kg",
	"gov.kg",
	"mil.kg",
	"*.kh",
	"ki",
	"edu.ki",
	"biz.ki",
	"net.ki",
	"org.ki",
	"gov.ki",
	"info.ki",
	"com.ki",
	"km",
	"org.km",
	"nom.km",
	"gov.km",
	"prd.km",
	"tm.km",
	"edu.km",
	"mil.km",
	"ass.km",
	"com.km",
	"coop.km",
	"asso.km",
	"presse.km",
	"medecin.km",
	"notaires.km",
	"pharmaciens.km",
	"veterinaire.km",
	"gouv.km",
	"kn",
	"net.kn",
	"org.kn",
	"edu.kn",
	"gov.kn",
	"kp",
	"com.kp",
	"edu.kp",
	"gov.kp",
	"org.kp",
	"rep.kp",
	"tra.kp",
	"kr",
	"ac.kr",
	"co.kr",
	"es.kr",
	"go.kr",
	"hs.kr",
	"kg.kr",
	"mil.kr",
	"ms.kr",
	"ne.kr",
	"or.kr",
	"pe.kr",
	"re.kr",
	"sc.kr",
	"busan.kr",
	"chungbuk.kr",
	"chungnam.kr",
	"daegu.kr",
	"daejeon.kr",
	"gangwon.kr",
	"gwangju.kr",
	"gyeongbuk.kr",
	"gyeonggi.kr",
	"gyeongnam.kr",
	"incheon.kr",
	"jeju.kr",
	"jeonbuk.kr",
	"jeonnam.kr",
	"seoul.kr",
	"ulsan.kr",
	"kw",
	"com.kw",
	"edu.kw",
	"emb.kw",
	"gov.kw",
	"ind.kw",
	"net.kw",
	"org.kw",
	"ky",
	"com.ky",
	"edu.ky",
	"net.ky",
	"org.ky",
	"kz",
	"org.kz",
	"edu.kz",
	"net.kz",
	"gov.kz",
	"mil.kz",
	"com.kz",
	"la",
	"int.la",
	"net.la",
	"info.la",
	"edu.la",
	"gov.la",
	"per.la",
	"com.la",
	"org.la",
	"lb",
	"com.lb",
	"edu.lb",
	"gov.lb",
	"net.lb",
	"org.lb",
	"lc",
	"com.lc",
	"net.lc",
	"co.lc",
	"org.lc",
	"edu.lc",
	"gov.lc",
	"li",
	"lk",
	"gov.lk",
	"sch.lk",
	"net.lk",
	"int.lk",
	"com.lk",
	"org.lk",
	"edu.lk",
	"ngo.lk",
	"soc.lk",
	"web.lk",
	"ltd.lk",
	"assn.lk",
	"grp.lk",
	"hotel.lk",
	"ac.lk",
	"lr",
	"com.lr",
	"edu.lr",
	"gov.lr",
	"org.lr",
	"net.lr",
	"ls",
	"ac.ls",
	"biz.ls",
	"co.ls",
	"edu.ls",
	"gov.ls",
	"info.ls",
	"net.ls",
	"org.ls",
	"sc.ls",
	"lt",
	"gov.lt",
	"lu",
	"lv",
	"com.lv",
	"edu.lv",
	"gov.lv",
	"org.lv",
	"mil.lv",
	"id.lv",
	"net.lv",
	"asn.lv",
	"conf.lv",
	"ly",
	"com.ly",
	"net.ly",
	"gov.ly",
	"plc.ly",
	"edu.ly",
	"sch.ly",
	"med.ly",
	"org.ly",
	"id.ly",
	"ma",
	"co.ma",
	"net.ma",
	"gov.ma",
	"org.ma",
	"ac.ma",
	"press.ma",
	"mc",
	"tm.mc",
	"asso.mc",
	"md",
	"me",
	"co.me",
	"net.me",
	"org.me",
	"edu.me",
	"ac.me",
	"gov.me",
	"its.me",
	"priv.me",
	"mg",
	"org.mg",
	"nom.mg",
	"gov.mg",
	"prd.mg",
	"tm.mg",
	"edu.mg",
	"mil.mg",
	"com.mg",
	"co.mg",
	"mh",
	"mil",
	"mk",
	"com.mk",
	"org.mk",
	"net.mk",
	"edu.mk",
	"gov.mk",
	"inf.mk",
	"name.mk",
	"ml",
	"com.ml",
	"edu.ml",
	"gouv.ml",
	"gov.ml",
	"net.ml",
	"org.ml",
	"presse.ml",
	"*.mm",
	"mn",
	"gov.mn",
	"edu.mn",
	"org.mn",
	"mo",
	"com.mo",
	"net.mo",
	"org.mo",
	"edu.mo",
	"gov.mo",
	"mobi",
	"mp",
	"mq",
	"mr",
	"gov.mr",
	"ms",
	"com.ms",
	"edu.ms",
	"gov.ms",
	"net.ms",
	"org.ms",
	"mt",
	"com.mt",
	"edu.mt",
	"net.mt",
	"org.mt",
	"mu",
	"com.mu",
	"net.mu",
	"org.mu",
	"gov.mu",
	"ac.mu",
	"co.mu",
	"or.mu",
	"museum",
	"academy.museum",
	"agriculture.museum",
	"air.museum",
	"airguard.museum",
	"alabama.museum",
	"alaska.museum",
	"amber.museum",
	"ambulance.museum",
	"american.museum",
	"americana.museum",
	"americanantiques.museum",
	"americanart.museum",
	"amsterdam.museum",
	"and.museum",
	"annefrank.museum",
	"anthro.museum",
	"anthropology.museum",
	"antiques.museum",
	"aquarium.museum",
	"arboretum.museum",
	"archaeological.museum",
	"archaeology.museum",
	"architecture.museum",
	"art.museum",
	"artanddesign.museum",
	"artcenter.museum",
	"artdeco.museum",
	"arteducation.museum",
	"artgallery.museum",
	"arts.museum",
	"artsandcrafts.museum",
	"asmatart.museum",
	"assassination.museum",
	"assisi.museum",
	"association.museum",
	"astronomy.museum",
	"atlanta.museum",
	"austin.museum",
	"australia.museum",
	"automotive.museum",
	"aviation.museum",
	"axis.museum",
	"badajoz.museum",
	"baghdad.museum",
	"bahn.museum",
	"bale.museum",
	"baltimore.museum",
	"barcelona.museum",
	"baseball.museum",
	"basel.museum",
	"baths.museum",
	"bauern.museum",
	"beauxarts.museum",
	"beeldengeluid.museum",
	"bellevue.museum",
	"bergbau.museum",
	"berkeley.museum",
	"berlin.museum",
	"bern.museum",
	"bible.museum",
	"bilbao.museum",
	"bill.museum",
	"birdart.museum",
	"birthplace.museum",
	"bonn.museum",
	"boston.museum",
	"botanical.museum",
	"botanicalgarden.museum",
	"botanicgarden.museum",
	"botany.museum",
	"brandywinevalley.museum",
	"brasil.museum",
	"bristol.museum",
	"british.museum",
	"britishcolumbia.museum",
	"broadcast.museum",
	"brunel.museum",
	"brussel.museum",
	"brussels.museum",
	"bruxelles.museum",
	"building.museum",
	"burghof.museum",
	"bus.museum",
	"bushey.museum",
	"cadaques.museum",
	"california.museum",
	"cambridge.museum",
	"can.museum",
	"canada.museum",
	"capebreton.museum",
	"carrier.museum",
	"cartoonart.museum",
	"casadelamoneda.museum",
	"castle.museum",
	"castres.museum",
	"celtic.museum",
	"center.museum",
	"chattanooga.museum",
	"cheltenham.museum",
	"chesapeakebay.museum",
	"chicago.museum",
	"children.museum",
	"childrens.museum",
	"childrensgarden.museum",
	"chiropractic.museum",
	"chocolate.museum",
	"christiansburg.museum",
	"cincinnati.museum",
	"cinema.museum",
	"circus.museum",
	"civilisation.museum",
	"civilization.museum",
	"civilwar.museum",
	"clinton.museum",
	"clock.museum",
	"coal.museum",
	"coastaldefence.museum",
	"cody.museum",
	"coldwar.museum",
	"collection.museum",
	"colonialwilliamsburg.museum",
	"coloradoplateau.museum",
	"columbia.museum",
	"columbus.museum",
	"communication.museum",
	"communications.museum",
	"community.museum",
	"computer.museum",
	"computerhistory.museum",
	"comunicações.museum",
	"contemporary.museum",
	"contemporaryart.museum",
	"convent.museum",
	"copenhagen.museum",
	"corporation.museum",
	"correios-e-telecomunicações.museum",
	"corvette.museum",
	"costume.museum",
	"countryestate.museum",
	"county.museum",
	"crafts.museum",
	"cranbrook.museum",
	"creation.museum",
	"cultural.museum",
	"culturalcenter.museum",
	"culture.museum",
	"cyber.museum",
	"cymru.museum",
	"dali.museum",
	"dallas.museum",
	"database.museum",
	"ddr.museum",
	"decorativearts.museum",
	"delaware.museum",
	"delmenhorst.museum",
	"denmark.museum",
	"depot.museum",
	"design.museum",
	"detroit.museum",
	"dinosaur.museum",
	"discovery.museum",
	"dolls.museum",
	"donostia.museum",
	"durham.museum",
	"eastafrica.museum",
	"eastcoast.museum",
	"education.museum",
	"educational.museum",
	"egyptian.museum",
	"eisenbahn.museum",
	"elburg.museum",
	"elvendrell.museum",
	"embroidery.museum",
	"encyclopedic.museum",
	"england.museum",
	"entomology.museum",
	"environment.museum",
	"environmentalconservation.museum",
	"epilepsy.museum",
	"essex.museum",
	"estate.museum",
	"ethnology.museum",
	"exeter.museum",
	"exhibition.museum",
	"family.museum",
	"farm.museum",
	"farmequipment.museum",
	"farmers.museum",
	"farmstead.museum",
	"field.museum",
	"figueres.museum",
	"filatelia.museum",
	"film.museum",
	"fineart.museum",
	"finearts.museum",
	"finland.museum",
	"flanders.museum",
	"florida.museum",
	"force.museum",
	"fortmissoula.museum",
	"fortworth.museum",
	"foundation.museum",
	"francaise.museum",
	"frankfurt.museum",
	"franziskaner.museum",
	"freemasonry.museum",
	"freiburg.museum",
	"fribourg.museum",
	"frog.museum",
	"fundacio.museum",
	"furniture.museum",
	"gallery.museum",
	"garden.museum",
	"gateway.museum",
	"geelvinck.museum",
	"gemological.museum",
	"geology.museum",
	"georgia.museum",
	"giessen.museum",
	"glas.museum",
	"glass.museum",
	"gorge.museum",
	"grandrapids.museum",
	"graz.museum",
	"guernsey.museum",
	"halloffame.museum",
	"hamburg.museum",
	"handson.museum",
	"harvestcelebration.museum",
	"hawaii.museum",
	"health.museum",
	"heimatunduhren.museum",
	"hellas.museum",
	"helsinki.museum",
	"hembygdsforbund.museum",
	"heritage.museum",
	"histoire.museum",
	"historical.museum",
	"historicalsociety.museum",
	"historichouses.museum",
	"historisch.museum",
	"historisches.museum",
	"history.museum",
	"historyofscience.museum",
	"horology.museum",
	"house.museum",
	"humanities.museum",
	"illustration.museum",
	"imageandsound.museum",
	"indian.museum",
	"indiana.museum",
	"indianapolis.museum",
	"indianmarket.museum",
	"intelligence.museum",
	"interactive.museum",
	"iraq.museum",
	"iron.museum",
	"isleofman.museum",
	"jamison.museum",
	"jefferson.museum",
	"jerusalem.museum",
	"jewelry.museum",
	"jewish.museum",
	"jewishart.museum",
	"jfk.museum",
	"journalism.museum",
	"judaica.museum",
	"judygarland.museum",
	"juedisches.museum",
	"juif.museum",
	"karate.museum",
	"karikatur.museum",
	"kids.museum",
	"koebenhavn.museum",
	"koeln.museum",
	"kunst.museum",
	"kunstsammlung.museum",
	"kunstunddesign.museum",
	"labor.museum",
	"labour.museum",
	"lajolla.museum",
	"lancashire.museum",
	"landes.museum",
	"lans.museum",
	"läns.museum",
	"larsson.museum",
	"lewismiller.museum",
	"lincoln.museum",
	"linz.museum",
	"living.museum",
	"livinghistory.museum",
	"localhistory.museum",
	"london.museum",
	"losangeles.museum",
	"louvre.museum",
	"loyalist.museum",
	"lucerne.museum",
	"luxembourg.museum",
	"luzern.museum",
	"mad.museum",
	"madrid.museum",
	"mallorca.museum",
	"manchester.museum",
	"mansion.museum",
	"mansions.museum",
	"manx.museum",
	"marburg.museum",
	"maritime.museum",
	"maritimo.museum",
	"maryland.museum",
	"marylhurst.museum",
	"media.museum",
	"medical.museum",
	"medizinhistorisches.museum",
	"meeres.museum",
	"memorial.museum",
	"mesaverde.museum",
	"michigan.museum",
	"midatlantic.museum",
	"military.museum",
	"mill.museum",
	"miners.museum",
	"mining.museum",
	"minnesota.museum",
	"missile.museum",
	"missoula.museum",
	"modern.museum",
	"moma.museum",
	"money.museum",
	"monmouth.museum",
	"monticello.museum",
	"montreal.museum",
	"moscow.museum",
	"motorcycle.museum",
	"muenchen.museum",
	"muenster.museum",
	"mulhouse.museum",
	"muncie.museum",
	"museet.museum",
	"museumcenter.museum",
	"museumvereniging.museum",
	"music.museum",
	"national.museum",
	"nationalfirearms.museum",
	"nationalheritage.museum",
	"nativeamerican.museum",
	"naturalhistory.museum",
	"naturalhistorymuseum.museum",
	"naturalsciences.museum",
	"nature.museum",
	"naturhistorisches.museum",
	"natuurwetenschappen.museum",
	"naumburg.museum",
	"naval.museum",
	"nebraska.museum",
	"neues.museum",
	"newhampshire.museum",
	"newjersey.museum",
	"newmexico.museum",
	"newport.museum",
	"newspaper.museum",
	"newyork.museum",
	"niepce.museum",
	"norfolk.museum",
	"north.museum",
	"nrw.museum",
	"nyc.museum",
	"nyny.museum",
	"oceanographic.museum",
	"oceanographique.museum",
	"omaha.museum",
	"online.museum",
	"ontario.museum",
	"openair.museum",
	"oregon.museum",
	"oregontrail.museum",
	"otago.museum",
	"oxford.museum",
	"pacific.museum",
	"paderborn.museum",
	"palace.museum",
	"paleo.museum",
	"palmsprings.museum",
	"panama.museum",
	"paris.museum",
	"pasadena.museum",
	"pharmacy.museum",
	"philadelphia.museum",
	"philadelphiaarea.museum",
	"philately.museum",
	"phoenix.museum",
	"photography.museum",
	"pilots.museum",
	"pittsburgh.museum",
	"planetarium.museum",
	"plantation.museum",
	"plants.museum",
	"plaza.museum",
	"portal.museum",
	"portland.museum",
	"portlligat.museum",
	"posts-and-telecommunications.museum",
	"preservation.museum",
	"presidio.museum",
	"press.museum",
	"project.museum",
	"public.museum",
	"pubol.museum",
	"quebec.museum",
	"railroad.museum",
	"railway.museum",
	"research.museum",
	"resistance.museum",
	"riodejaneiro.museum",
	"rochester.museum",
	"rockart.museum",
	"roma.museum",
	"russia.museum",
	"saintlouis.museum",
	"salem.museum",
	"salvadordali.museum",
	"salzburg.museum",
	"sandiego.museum",
	"sanfrancisco.museum",
	"santabarbara.museum",
	"santacruz.museum",
	"santafe.museum",
	"saskatchewan.museum",
	"satx.museum",
	"savannahga.museum",
	"schlesisches.museum",
	"schoenbrunn.museum",
	"schokoladen.museum",
	"school.museum",
	"schweiz.museum",
	"science.museum",
	"scienceandhistory.museum",
	"scienceandindustry.museum",
	"sciencecenter.museum",
	"sciencecenters.museum",
	"science-fiction.museum",
	"sciencehistory.museum",
	"sciences.museum",
	"sciencesnaturelles.museum",
	"scotland.museum",
	"seaport.museum",
	"settlement.museum",
	"settlers.museum",
	"shell.museum",
	"sherbrooke.museum",
	"sibenik.museum",
	"silk.museum",
	"ski.museum",
	"skole.museum",
	"society.museum",
	"sologne.museum",
	"soundandvision.museum",
	"southcarolina.museum",
	"southwest.museum",
	"space.museum",
	"spy.museum",
	"square.museum",
	"stadt.museum",
	"stalbans.museum",
	"starnberg.museum",
	"state.museum",
	"stateofdelaware.museum",
	"station.museum",
	"steam.museum",
	"steiermark.museum",
	"stjohn.museum",
	"stockholm.museum",
	"stpetersburg.museum",
	"stuttgart.museum",
	"suisse.museum",
	"surgeonshall.museum",
	"surrey.museum",
	"svizzera.museum",
	"sweden.museum",
	"sydney.museum",
	"tank.museum",
	"tcm.museum",
	"technology.museum",
	"telekommunikation.museum",
	"television.museum",
	"texas.museum",
	"textile.museum",
	"theater.museum",
	"time.museum",
	"timekeeping.museum",
	"topology.museum",
	"torino.museum",
	"touch.museum",
	"town.museum",
	"transport.museum",
	"tree.museum",
	"trolley.museum",
	"trust.museum",
	"trustee.museum",
	"uhren.museum",
	"ulm.museum",
	"undersea.museum",
	"university.museum",
	"usa.museum",
	"usantiques.museum",
	"usarts.museum",
	"uscountryestate.museum",
	"usculture.museum",
	"usdecorativearts.museum",
	"usgarden.museum",
	"ushistory.museum",
	"ushuaia.museum",
	"uslivinghistory.museum",
	"utah.museum",
	"uvic.museum",
	"valley.museum",
	"vantaa.museum",
	"versailles.museum",
	"viking.museum",
	"village.museum",
	"virginia.museum",
	"virtual.museum",
	"virtuel.museum",
	"vlaanderen.museum",
	"volkenkunde.museum",
	"wales.museum",
	"wallonie.museum",
	"war.museum",
	"washingtondc.museum",
	"watchandclock.museum",
	"watch-and-clock.museum",
	"western.museum",
	"westfalen.museum",
	"whaling.museum",
	"wildlife.museum",
	"williamsburg.museum",
	"windmill.museum",
	"workshop.museum",
	"york.museum",
	"yorkshire.museum",
	"yosemite.museum",
	"youth.museum",
	"zoological.museum",
	"zoology.museum",
	"ירושלים.museum",
	"иком.museum",
	"mv",
	"aero.mv",
	"biz.mv",
	"com.mv",
	"coop.mv",
	"edu.mv",
	"gov.mv",
	"info.mv",
	"int.mv",
	"mil.mv",
	"museum.mv",
	"name.mv",
	"net.mv",
	"org.mv",
	"pro.mv",
	"mw",
	"ac.mw",
	"biz.mw",
	"co.mw",
	"com.mw",
	"coop.mw",
	"edu.mw",
	"gov.mw",
	"int.mw",
	"museum.mw",
	"net.mw",
	"org.mw",
	"mx",
	"com.mx",
	"org.mx",
	"gob.mx",
	"edu.mx",
	"net.mx",
	"my",
	"biz.my",
	"com.my",
	"edu.my",
	"gov.my",
	"mil.my",
	"name.my",
	"net.my",
	"org.my",
	"mz",
	"ac.mz",
	"adv.mz",
	"co.mz",
	"edu.mz",
	"gov.mz",
	"mil.mz",
	"net.mz",
	"org.mz",
	"na",
	"info.na",
	"pro.na",
	"name.na",
	"school.na",
	"or.na",
	"dr.na",
	"us.na",
	"mx.na",
	"ca.na",
	"in.na",
	"cc.na",
	"tv.na",
	"ws.na",
	"mobi.na",
	"co.na",
	"com.na",
	"org.na",
	"name",
	"nc",
	"asso.nc",
	"nom.nc",
	"ne",
	"net",
	"nf",
	"com.nf",
	"net.nf",
	"per.nf",
	"rec.nf",
	"web.nf",
	"arts.nf",
	"firm.nf",
	"info.nf",
	"other.nf",
	"store.nf",
	"ng",
	"com.ng",
	"edu.ng",
	"gov.ng",
	"i.ng",
	"mil.ng",
	"mobi.ng",
	"name.ng",
	"net.ng",
	"org.ng",
	"sch.ng",
	"ni",
	"ac.ni",
	"biz.ni",
	"co.ni",
	"com.ni",
	"edu.ni",
	"gob.ni",
	"in.ni",
	"info.ni",
	"int.ni",
	"mil.ni",
	"net.ni",
	"nom.ni",
	"org.ni",
	"web.ni",
	"nl",
	"no",
	"fhs.no",
	"vgs.no",
	"fylkesbibl.no",
	"folkebibl.no",
	"museum.no",
	"idrett.no",
	"priv.no",
	"mil.no",
	"stat.no",
	"dep.no",
	"kommune.no",
	"herad.no",
	"aa.no",
	"ah.no",
	"bu.no",
	"fm.no",
	"hl.no",
	"hm.no",
	"jan-mayen.no",
	"mr.no",
	"nl.no",
	"nt.no",
	"of.no",
	"ol.no",
	"oslo.no",
	"rl.no",
	"sf.no",
	"st.no",
	"svalbard.no",
	"tm.no",
	"tr.no",
	"va.no",
	"vf.no",
	"gs.aa.no",
	"gs.ah.no",
	"gs.bu.no",
	"gs.fm.no",
	"gs.hl.no",
	"gs.hm.no",
	"gs.jan-mayen.no",
	"gs.mr.no",
	"gs.nl.no",
	"gs.nt.no",
	"gs.of.no",
	"gs.ol.no",
	"gs.oslo.no",
	"gs.rl.no",
	"gs.sf.no",
	"gs.st.no",
	"gs.svalbard.no",
	"gs.tm.no",
	"gs.tr.no",
	"gs.va.no",
	"gs.vf.no",
	"akrehamn.no",
	"åkrehamn.no",
	"algard.no",
	"ålgård.no",
	"arna.no",
	"brumunddal.no",
	"bryne.no",
	"bronnoysund.no",
	"brønnøysund.no",
	"drobak.no",
	"drøbak.no",
	"egersund.no",
	"fetsund.no",
	"floro.no",
	"florø.no",
	"fredrikstad.no",
	"hokksund.no",
	"honefoss.no",
	"hønefoss.no",
	"jessheim.no",
	"jorpeland.no",
	"jørpeland.no",
	"kirkenes.no",
	"kopervik.no",
	"krokstadelva.no",
	"langevag.no",
	"langevåg.no",
	"leirvik.no",
	"mjondalen.no",
	"mjøndalen.no",
	"mo-i-rana.no",
	"mosjoen.no",
	"mosjøen.no",
	"nesoddtangen.no",
	"orkanger.no",
	"osoyro.no",
	"osøyro.no",
	"raholt.no",
	"råholt.no",
	"sandnessjoen.no",
	"sandnessjøen.no",
	"skedsmokorset.no",
	"slattum.no",
	"spjelkavik.no",
	"stathelle.no",
	"stavern.no",
	"stjordalshalsen.no",
	"stjørdalshalsen.no",
	"tananger.no",
	"tranby.no",
	"vossevangen.no",
	"afjord.no",
	"åfjord.no",
	"agdenes.no",
	"al.no",
	"ål.no",
	"alesund.no",
	"ålesund.no",
	"alstahaug.no",
	"alta.no",
	"áltá.no",
	"alaheadju.no",
	"álaheadju.no",
	"alvdal.no",
	"amli.no",
	"åmli.no",
	"amot.no",
	"åmot.no",
	"andebu.no",
	"andoy.no",
	"andøy.no",
	"andasuolo.no",
	"ardal.no",
	"årdal.no",
	"aremark.no",
	"arendal.no",
	"ås.no",
	"aseral.no",
	"åseral.no",
	"asker.no",
	"askim.no",
	"askvoll.no",
	"askoy.no",
	"askøy.no",
	"asnes.no",
	"åsnes.no",
	"audnedaln.no",
	"aukra.no",
	"aure.no",
	"aurland.no",
	"aurskog-holand.no",
	"aurskog-høland.no",
	"austevoll.no",
	"austrheim.no",
	"averoy.no",
	"averøy.no",
	"balestrand.no",
	"ballangen.no",
	"balat.no",
	"bálát.no",
	"balsfjord.no",
	"bahccavuotna.no",
	"báhccavuotna.no",
	"bamble.no",
	"bardu.no",
	"beardu.no",
	"beiarn.no",
	"bajddar.no",
	"bájddar.no",
	"baidar.no",
	"báidár.no",
	"berg.no",
	"bergen.no",
	"berlevag.no",
	"berlevåg.no",
	"bearalvahki.no",
	"bearalváhki.no",
	"bindal.no",
	"birkenes.no",
	"bjarkoy.no",
	"bjarkøy.no",
	"bjerkreim.no",
	"bjugn.no",
	"bodo.no",
	"bodø.no",
	"badaddja.no",
	"bådåddjå.no",
	"budejju.no",
	"bokn.no",
	"bremanger.no",
	"bronnoy.no",
	"brønnøy.no",
	"bygland.no",
	"bykle.no",
	"barum.no",
	"bærum.no",
	"bo.telemark.no",
	"bø.telemark.no",
	"bo.nordland.no",
	"bø.nordland.no",
	"bievat.no",
	"bievát.no",
	"bomlo.no",
	"bømlo.no",
	"batsfjord.no",
	"båtsfjord.no",
	"bahcavuotna.no",
	"báhcavuotna.no",
	"dovre.no",
	"drammen.no",
	"drangedal.no",
	"dyroy.no",
	"dyrøy.no",
	"donna.no",
	"dønna.no",
	"eid.no",
	"eidfjord.no",
	"eidsberg.no",
	"eidskog.no",
	"eidsvoll.no",
	"eigersund.no",
	"elverum.no",
	"enebakk.no",
	"engerdal.no",
	"etne.no",
	"etnedal.no",
	"evenes.no",
	"evenassi.no",
	"evenášši.no",
	"evje-og-hornnes.no",
	"farsund.no",
	"fauske.no",
	"fuossko.no",
	"fuoisku.no",
	"fedje.no",
	"fet.no",
	"finnoy.no",
	"finnøy.no",
	"fitjar.no",
	"fjaler.no",
	"fjell.no",
	"flakstad.no",
	"flatanger.no",
	"flekkefjord.no",
	"flesberg.no",
	"flora.no",
	"fla.no",
	"flå.no",
	"folldal.no",
	"forsand.no",
	"fosnes.no",
	"frei.no",
	"frogn.no",
	"froland.no",
	"frosta.no",
	"frana.no",
	"fræna.no",
	"froya.no",
	"frøya.no",
	"fusa.no",
	"fyresdal.no",
	"forde.no",
	"førde.no",
	"gamvik.no",
	"gangaviika.no",
	"gáŋgaviika.no",
	"gaular.no",
	"gausdal.no",
	"gildeskal.no",
	"gildeskål.no",
	"giske.no",
	"gjemnes.no",
	"gjerdrum.no",
	"gjerstad.no",
	"gjesdal.no",
	"gjovik.no",
	"gjøvik.no",
	"gloppen.no",
	"gol.no",
	"gran.no",
	"grane.no",
	"granvin.no",
	"gratangen.no",
	"grimstad.no",
	"grong.no",
	"kraanghke.no",
	"kråanghke.no",
	"grue.no",
	"gulen.no",
	"hadsel.no",
	"halden.no",
	"halsa.no",
	"hamar.no",
	"hamaroy.no",
	"habmer.no",
	"hábmer.no",
	"hapmir.no",
	"hápmir.no",
	"hammerfest.no",
	"hammarfeasta.no",
	"hámmárfeasta.no",
	"haram.no",
	"hareid.no",
	"harstad.no",
	"hasvik.no",
	"aknoluokta.no",
	"ákŋoluokta.no",
	"hattfjelldal.no",
	"aarborte.no",
	"haugesund.no",
	"hemne.no",
	"hemnes.no",
	"hemsedal.no",
	"heroy.more-og-romsdal.no",
	"herøy.møre-og-romsdal.no",
	"heroy.nordland.no",
	"herøy.nordland.no",
	"hitra.no",
	"hjartdal.no",
	"hjelmeland.no",
	"hobol.no",
	"hobøl.no",
	"hof.no",
	"hol.no",
	"hole.no",
	"holmestrand.no",
	"holtalen.no",
	"holtålen.no",
	"hornindal.no",
	"horten.no",
	"hurdal.no",
	"hurum.no",
	"hvaler.no",
	"hyllestad.no",
	"hagebostad.no",
	"hægebostad.no",
	"hoyanger.no",
	"høyanger.no",
	"hoylandet.no",
	"høylandet.no",
	"ha.no",
	"hå.no",
	"ibestad.no",
	"inderoy.no",
	"inderøy.no",
	"iveland.no",
	"jevnaker.no",
	"jondal.no",
	"jolster.no",
	"jølster.no",
	"karasjok.no",
	"karasjohka.no",
	"kárášjohka.no",
	"karlsoy.no",
	"galsa.no",
	"gálsá.no",
	"karmoy.no",
	"karmøy.no",
	"kautokeino.no",
	"guovdageaidnu.no",
	"klepp.no",
	"klabu.no",
	"klæbu.no",
	"kongsberg.no",
	"kongsvinger.no",
	"kragero.no",
	"kragerø.no",
	"kristiansand.no",
	"kristiansund.no",
	"krodsherad.no",
	"krødsherad.no",
	"kvalsund.no",
	"rahkkeravju.no",
	"ráhkkerávju.no",
	"kvam.no",
	"kvinesdal.no",
	"kvinnherad.no",
	"kviteseid.no",
	"kvitsoy.no",
	"kvitsøy.no",
	"kvafjord.no",
	"kvæfjord.no",
	"giehtavuoatna.no",
	"kvanangen.no",
	"kvænangen.no",
	"navuotna.no",
	"návuotna.no",
	"kafjord.no",
	"kåfjord.no",
	"gaivuotna.no",
	"gáivuotna.no",
	"larvik.no",
	"lavangen.no",
	"lavagis.no",
	"loabat.no",
	"loabát.no",
	"lebesby.no",
	"davvesiida.no",
	"leikanger.no",
	"leirfjord.no",
	"leka.no",
	"leksvik.no",
	"lenvik.no",
	"leangaviika.no",
	"leaŋgaviika.no",
	"lesja.no",
	"levanger.no",
	"lier.no",
	"lierne.no",
	"lillehammer.no",
	"lillesand.no",
	"lindesnes.no",
	"lindas.no",
	"lindås.no",
	"lom.no",
	"loppa.no",
	"lahppi.no",
	"láhppi.no",
	"lund.no",
	"lunner.no",
	"luroy.no",
	"lurøy.no",
	"luster.no",
	"lyngdal.no",
	"lyngen.no",
	"ivgu.no",
	"lardal.no",
	"lerdal.no",
	"lærdal.no",
	"lodingen.no",
	"lødingen.no",
	"lorenskog.no",
	"lørenskog.no",
	"loten.no",
	"løten.no",
	"malvik.no",
	"masoy.no",
	"måsøy.no",
	"muosat.no",
	"muosát.no",
	"mandal.no",
	"marker.no",
	"marnardal.no",
	"masfjorden.no",
	"meland.no",
	"meldal.no",
	"melhus.no",
	"meloy.no",
	"meløy.no",
	"meraker.no",
	"meråker.no",
	"moareke.no",
	"moåreke.no",
	"midsund.no",
	"midtre-gauldal.no",
	"modalen.no",
	"modum.no",
	"molde.no",
	"moskenes.no",
	"moss.no",
	"mosvik.no",
	"malselv.no",
	"målselv.no",
	"malatvuopmi.no",
	"málatvuopmi.no",
	"namdalseid.no",
	"aejrie.no",
	"namsos.no",
	"namsskogan.no",
	"naamesjevuemie.no",
	"nååmesjevuemie.no",
	"laakesvuemie.no",
	"nannestad.no",
	"narvik.no",
	"narviika.no",
	"naustdal.no",
	"nedre-eiker.no",
	"nes.akershus.no",
	"nes.buskerud.no",
	"nesna.no",
	"nesodden.no",
	"nesseby.no",
	"unjarga.no",
	"unjárga.no",
	"nesset.no",
	"nissedal.no",
	"nittedal.no",
	"nord-aurdal.no",
	"nord-fron.no",
	"nord-odal.no",
	"norddal.no",
	"nordkapp.no",
	"davvenjarga.no",
	"davvenjárga.no",
	"nordre-land.no",
	"nordreisa.no",
	"raisa.no",
	"ráisa.no",
	"nore-og-uvdal.no",
	"notodden.no",
	"naroy.no",
	"nærøy.no",
	"notteroy.no",
	"nøtterøy.no",
	"odda.no",
	"oksnes.no",
	"øksnes.no",
	"oppdal.no",
	"oppegard.no",
	"oppegård.no",
	"orkdal.no",
	"orland.no",
	"ørland.no",
	"orskog.no",
	"ørskog.no",
	"orsta.no",
	"ørsta.no",
	"os.hedmark.no",
	"os.hordaland.no",
	"osen.no",
	"osteroy.no",
	"osterøy.no",
	"ostre-toten.no",
	"østre-toten.no",
	"overhalla.no",
	"ovre-eiker.no",
	"øvre-eiker.no",
	"oyer.no",
	"øyer.no",
	"oygarden.no",
	"øygarden.no",
	"oystre-slidre.no",
	"øystre-slidre.no",
	"porsanger.no",
	"porsangu.no",
	"porsáŋgu.no",
	"porsgrunn.no",
	"radoy.no",
	"radøy.no",
	"rakkestad.no",
	"rana.no",
	"ruovat.no",
	"randaberg.no",
	"rauma.no",
	"rendalen.no",
	"rennebu.no",
	"rennesoy.no",
	"rennesøy.no",
	"rindal.no",
	"ringebu.no",
	"ringerike.no",
	"ringsaker.no",
	"rissa.no",
	"risor.no",
	"risør.no",
	"roan.no",
	"rollag.no",
	"rygge.no",
	"ralingen.no",
	"rælingen.no",
	"rodoy.no",
	"rødøy.no",
	"romskog.no",
	"rømskog.no",
	"roros.no",
	"røros.no",
	"rost.no",
	"røst.no",
	"royken.no",
	"røyken.no",
	"royrvik.no",
	"røyrvik.no",
	"rade.no",
	"råde.no",
	"salangen.no",
	"siellak.no",
	"saltdal.no",
	"salat.no",
	"sálát.no",
	"sálat.no",
	"samnanger.no",
	"sande.more-og-romsdal.no",
	"sande.møre-og-romsdal.no",
	"sande.vestfold.no",
	"sandefjord.no",
	"sandnes.no",
	"sandoy.no",
	"sandøy.no",
	"sarpsborg.no",
	"sauda.no",
	"sauherad.no",
	"sel.no",
	"selbu.no",
	"selje.no",
	"seljord.no",
	"sigdal.no",
	"siljan.no",
	"sirdal.no",
	"skaun.no",
	"skedsmo.no",
	"ski.no",
	"skien.no",
	"skiptvet.no",
	"skjervoy.no",
	"skjervøy.no",
	"skierva.no",
	"skiervá.no",
	"skjak.no",
	"skjåk.no",
	"skodje.no",
	"skanland.no",
	"skånland.no",
	"skanit.no",
	"skánit.no",
	"smola.no",
	"smøla.no",
	"snillfjord.no",
	"snasa.no",
	"snåsa.no",
	"snoasa.no",
	"snaase.no",
	"snåase.no",
	"sogndal.no",
	"sokndal.no",
	"sola.no",
	"solund.no",
	"songdalen.no",
	"sortland.no",
	"spydeberg.no",
	"stange.no",
	"stavanger.no",
	"steigen.no",
	"steinkjer.no",
	"stjordal.no",
	"stjørdal.no",
	"stokke.no",
	"stor-elvdal.no",
	"stord.no",
	"stordal.no",
	"storfjord.no",
	"omasvuotna.no",
	"strand.no",
	"stranda.no",
	"stryn.no",
	"sula.no",
	"suldal.no",
	"sund.no",
	"sunndal.no",
	"surnadal.no",
	"sveio.no",
	"svelvik.no",
	"sykkylven.no",
	"sogne.no",
	"søgne.no",
	"somna.no",
	"sømna.no",
	"sondre-land.no",
	"søndre-land.no",
	"sor-aurdal.no",
	"sør-aurdal.no",
	"sor-fron.no",
	"sør-fron.no",
	"sor-odal.no",
	"sør-odal.no",
	"sor-varanger.no",
	"sør-varanger.no",
	"matta-varjjat.no",
	"mátta-várjjat.no",
	"sorfold.no",
	"sørfold.no",
	"sorreisa.no",
	"sørreisa.no",
	"sorum.no",
	"sørum.no",
	"tana.no",
	"deatnu.no",
	"time.no",
	"tingvoll.no",
	"tinn.no",
	"tjeldsund.no",
	"dielddanuorri.no",
	"tjome.no",
	"tjøme.no",
	"tokke.no",
	"tolga.no",
	"torsken.no",
	"tranoy.no",
	"tranøy.no",
	"tromso.no",
	"tromsø.no",
	"tromsa.no",
	"romsa.no",
	"trondheim.no",
	"troandin.no",
	"trysil.no",
	"trana.no",
	"træna.no",
	"trogstad.no",
	"trøgstad.no",
	"tvedestrand.no",
	"tydal.no",
	"tynset.no",
	"tysfjord.no",
	"divtasvuodna.no",
	"divttasvuotna.no",
	"tysnes.no",
	"tysvar.no",
	"tysvær.no",
	"tonsberg.no",
	"tønsberg.no",
	"ullensaker.no",
	"ullensvang.no",
	"ulvik.no",
	"utsira.no",
	"vadso.no",
	"vadsø.no",
	"cahcesuolo.no",
	"čáhcesuolo.no",
	"vaksdal.no",
	"valle.no",
	"vang.no",
	"vanylven.no",
	"vardo.no",
	"vardø.no",
	"varggat.no",
	"várggát.no",
	"vefsn.no",
	"vaapste.no",
	"vega.no",
	"vegarshei.no",
	"vegårshei.no",
	"vennesla.no",
	"verdal.no",
	"verran.no",
	"vestby.no",
	"vestnes.no",
	"vestre-slidre.no",
	"vestre-toten.no",
	"vestvagoy.no",
	"vestvågøy.no",
	"vevelstad.no",
	"vik.no",
	"vikna.no",
	"vindafjord.no",
	"volda.no",
	"voss.no",
	"varoy.no",
	"værøy.no",
	"vagan.no",
	"vågan.no",
	"voagat.no",
	"vagsoy.no",
	"vågsøy.no",
	"vaga.no",
	"vågå.no",
	"valer.ostfold.no",
	"våler.østfold.no",
	"valer.hedmark.no",
	"våler.hedmark.no",
	"*.np",
	"nr",
	"biz.nr",
	"info.nr",
	"gov.nr",
	"edu.nr",
	"org.nr",
	"net.nr",
	"com.nr",
	"nu",
	"nz",
	"ac.nz",
	"co.nz",
	"cri.nz",
	"geek.nz",
	"gen.nz",
	"govt.nz",
	"health.nz",
	"iwi.nz",
	"kiwi.nz",
	"maori.nz",
	"mil.nz",
	"māori.nz",
	"net.nz",
	"org.nz",
	"parliament.nz",
	"school.nz",
	"om",
	"co.om",
	"com.om",
	"edu.om",
	"gov.om",
	"med.om",
	"museum.om",
	"net.om",
	"org.om",
	"pro.om",
	"onion",
	"org",
	"pa",
	"ac.pa",
	"gob.pa",
	"com.pa",
	"org.pa",
	"sld.pa",
	"edu.pa",
	"net.pa",
	"ing.pa",
	"abo.pa",
	"med.pa",
	"nom.pa",
	"pe",
	"edu.pe",
	"gob.pe",
	"nom.pe",
	"mil.pe",
	"org.pe",
	"com.pe",
	"net.pe",
	"pf",
	"com.pf",
	"org.pf",
	"edu.pf",
	"*.pg",
	"ph",
	"com.ph",
	"net.ph",
	"org.ph",
	"gov.ph",
	"edu.ph",
	"ngo.ph",
	"mil.ph",
	"i.ph",
	"pk",
	"com.pk",
	"net.pk",
	"edu.pk",
	"org.pk",
	"fam.pk",
	"biz.pk",
	"web.pk",
	"gov.pk",
	"gob.pk",
	"gok.pk",
	"gon.pk",
	"gop.pk",
	"gos.pk",
	"info.pk",
	"pl",
	"com.pl",
	"net.pl",
	"org.pl",
	"aid.pl",
	"agro.pl",
	"atm.pl",
	"auto.pl",
	"biz.pl",
	"edu.pl",
	"gmina.pl",
	"gsm.pl",
	"info.pl",
	"mail.pl",
	"miasta.pl",
	"media.pl",
	"mil.pl",
	"nieruchomosci.pl",
	"nom.pl",
	"pc.pl",
	"powiat.pl",
	"priv.pl",
	"realestate.pl",
	"rel.pl",
	"sex.pl",
	"shop.pl",
	"sklep.pl",
	"sos.pl",
	"szkola.pl",
	"targi.pl",
	"tm.pl",
	"tourism.pl",
	"travel.pl",
	"turystyka.pl",
	"gov.pl",
	"ap.gov.pl",
	"ic.gov.pl",
	"is.gov.pl",
	"us.gov.pl",
	"kmpsp.gov.pl",
	"kppsp.gov.pl",
	"kwpsp.gov.pl",
	"psp.gov.pl",
	"wskr.gov.pl",
	"kwp.gov.pl",
	"mw.gov.pl",
	"ug.gov.pl",
	"um.gov.pl",
	"umig.gov.pl",
	"ugim.gov.pl",
	"upow.gov.pl",
	"uw.gov.pl",
	"starostwo.gov.pl",
	"pa.gov.pl",
	"po.gov.pl",
	"psse.gov.pl",
	"pup.gov.pl",
	"rzgw.gov.pl",
	"sa.gov.pl",
	"so.gov.pl",
	"sr.gov.pl",
	"wsa.gov.pl",
	"sko.gov.pl",
	"uzs.gov.pl",
	"wiih.gov.pl",
	"winb.gov.pl",
	"pinb.gov.pl",
	"wios.gov.pl",
	"witd.gov.pl",
	"wzmiuw.gov.pl",
	"piw.gov.pl",
	"wiw.gov.pl",
	"griw.gov.pl",
	"wif.gov.pl",
	"oum.gov.pl",
	"sdn.gov.pl",
	"zp.gov.pl",
	"uppo.gov.pl",
	"mup.gov.pl",
	"wuoz.gov.pl",
	"konsulat.gov.pl",
	"oirm.gov.pl",
	"augustow.pl",
	"babia-gora.pl",
	"bedzin.pl",
	"beskidy.pl",
	"bialowieza.pl",
	"bialystok.pl",
	"bielawa.pl",
	"bieszczady.pl",
	"boleslawiec.pl",
	"bydgoszcz.pl",
	"bytom.pl",
	"cieszyn.pl",
	"czeladz.pl",
	"czest.pl",
	"dlugoleka.pl",
	"elblag.pl",
	"elk.pl",
	"glogow.pl",
	"gniezno.pl",
	"gorlice.pl",
	"grajewo.pl",
	"ilawa.pl",
	"jaworzno.pl",
	"jelenia-gora.pl",
	"jgora.pl",
	"kalisz.pl",
	"kazimierz-dolny.pl",
	"karpacz.pl",
	"kartuzy.pl",
	"kaszuby.pl",
	"katowice.pl",
	"kepno.pl",
	"ketrzyn.pl",
	"klodzko.pl",
	"kobierzyce.pl",
	"kolobrzeg.pl",
	"konin.pl",
	"konskowola.pl",
	"kutno.pl",
	"lapy.pl",
	"lebork.pl",
	"legnica.pl",
	"lezajsk.pl",
	"limanowa.pl",
	"lomza.pl",
	"lowicz.pl",
	"lubin.pl",
	"lukow.pl",
	"malbork.pl",
	"malopolska.pl",
	"mazowsze.pl",
	"mazury.pl",
	"mielec.pl",
	"mielno.pl",
	"mragowo.pl",
	"naklo.pl",
	"nowaruda.pl",
	"nysa.pl",
	"olawa.pl",
	"olecko.pl",
	"olkusz.pl",
	"olsztyn.pl",
	"opoczno.pl",
	"opole.pl",
	"ostroda.pl",
	"ostroleka.pl",
	"ostrowiec.pl",
	"ostrowwlkp.pl",
	"pila.pl",
	"pisz.pl",
	"podhale.pl",
	"podlasie.pl",
	"polkowice.pl",
	"pomorze.pl",
	"pomorskie.pl",
	"prochowice.pl",
	"pruszkow.pl",
	"przeworsk.pl",
	"pulawy.pl",
	"radom.pl",
	"rawa-maz.pl",
	"rybnik.pl",
	"rzeszow.pl",
	"sanok.pl",
	"sejny.pl",
	"slask.pl",
	"slupsk.pl",
	"sosnowiec.pl",
	"stalowa-wola.pl",
	"skoczow.pl",
	"starachowice.pl",
	"stargard.pl",
	"suwalki.pl",
	"swidnica.pl",
	"swiebodzin.pl",
	"swinoujscie.pl",
	"szczecin.pl",
	"szczytno.pl",
	"tarnobrzeg.pl",
	"tgory.pl",
	"turek.pl",
	"tychy.pl",
	"ustka.pl",
	"walbrzych.pl",
	"warmia.pl",
	"warszawa.pl",
	"waw.pl",
	"wegrow.pl",
	"wielun.pl",
	"wlocl.pl",
	"wloclawek.pl",
	"wodzislaw.pl",
	"wolomin.pl",
	"wroclaw.pl",
	"zachpomor.pl",
	"zagan.pl",
	"zarow.pl",
	"zgora.pl",
	"zgorzelec.pl",
	"pm",
	"pn",
	"gov.pn",
	"co.pn",
	"org.pn",
	"edu.pn",
	"net.pn",
	"post",
	"pr",
	"com.pr",
	"net.pr",
	"org.pr",
	"gov.pr",
	"edu.pr",
	"isla.pr",
	"pro.pr",
	"biz.pr",
	"info.pr",
	"name.pr",
	"est.pr",
	"prof.pr",
	"ac.pr",
	"pro",
	"aaa.pro",
	"aca.pro",
	"acct.pro",
	"avocat.pro",
	"bar.pro",
	"cpa.pro",
	"eng.pro",
	"jur.pro",
	"law.pro",
	"med.pro",
	"recht.pro",
	"ps",
	"edu.ps",
	"gov.ps",
	"sec.ps",
	"plo.ps",
	"com.ps",
	"org.ps",
	"net.ps",
	"pt",
	"net.pt",
	"gov.pt",
	"org.pt",
	"edu.pt",
	"int.pt",
	"publ.pt",
	"com.pt",
	"nome.pt",
	"pw",
	"co.pw",
	"ne.pw",
	"or.pw",
	"ed.pw",
	"go.pw",
	"belau.pw",
	"py",
	"com.py",
	"coop.py",
	"edu.py",
	"gov.py",
	"mil.py",
	"net.py",
	"org.py",
	"qa",
	"com.qa",
	"edu.qa",
	"gov.qa",
	"mil.qa",
	"name.qa",
	"net.qa",
	"org.qa",
	"sch.qa",
	"re",
	"asso.re",
	"com.re",
	"nom.re",
	"ro",
	"arts.ro",
	"com.ro",
	"firm.ro",
	"info.ro",
	"nom.ro",
	"nt.ro",
	"org.ro",
	"rec.ro",
	"store.ro",
	"tm.ro",
	"www.ro",
	"rs",
	"ac.rs",
	"co.rs",
	"edu.rs",
	"gov.rs",
	"in.rs",
	"org.rs",
	"ru",
	"rw",
	"ac.rw",
	"co.rw",
	"coop.rw",
	"gov.rw",
	"mil.rw",
	"net.rw",
	"org.rw",
	"sa",
	"com.sa",
	"net.sa",
	"org.sa",
	"gov.sa",
	"med.sa",
	"pub.sa",
	"edu.sa",
	"sch.sa",
	"sb",
	"com.sb",
	"edu.sb",
	"gov.sb",
	"net.sb",
	"org.sb",
	"sc",
	"com.sc",
	"gov.sc",
	"net.sc",
	"org.sc",
	"edu.sc",
	"sd",
	"com.sd",
	"net.sd",
	"org.sd",
	"edu.sd",
	"med.sd",
	"tv.sd",
	"gov.sd",
	"info.sd",
	"se",
	"a.se",
	"ac.se",
	"b.se",
	"bd.se",
	"brand.se",
	"c.se",
	"d.se",
	"e.se",
	"f.se",
	"fh.se",
	"fhsk.se",
	"fhv.se",
	"g.se",
	"h.se",
	"i.se",
	"k.se",
	"komforb.se",
	"kommunalforbund.se",
	"komvux.se",
	"l.se",
	"lanbib.se",
	"m.se",
	"n.se",
	"naturbruksgymn.se",
	"o.se",
	"org.se",
	"p.se",
	"parti.se",
	"pp.se",
	"press.se",
	"r.se",
	"s.se",
	"t.se",
	"tm.se",
	"u.se",
	"w.se",
	"x.se",
	"y.se",
	"z.se",
	"sg",
	"com.sg",
	"net.sg",
	"org.sg",
	"gov.sg",
	"edu.sg",
	"per.sg",
	"sh",
	"com.sh",
	"net.sh",
	"gov.sh",
	"org.sh",
	"mil.sh",
	"si",
	"sj",
	"sk",
	"sl",
	"com.sl",
	"net.sl",
	"edu.sl",
	"gov.sl",
	"org.sl",
	"sm",
	"sn",
	"art.sn",
	"com.sn",
	"edu.sn",
	"gouv.sn",
	"org.sn",
	"perso.sn",
	"univ.sn",
	"so",
	"com.so",
	"edu.so",
	"gov.so",
	"me.so",
	"net.so",
	"org.so",
	"sr",
	"ss",
	"biz.ss",
	"com.ss",
	"edu.ss",
	"gov.ss",
	"me.ss",
	"net.ss",
	"org.ss",
	"sch.ss",
	"st",
	"co.st",
	"com.st",
	"consulado.st",
	"edu.st",
	"embaixada.st",
	"mil.st",
	"net.st",
	"org.st",
	"principe.st",
	"saotome.st",
	"store.st",
	"su",
	"sv",
	"com.sv",
	"edu.sv",
	"gob.sv",
	"org.sv",
	"red.sv",
	"sx",
	"gov.sx",
	"sy",
	"edu.sy",
	"gov.sy",
	"net.sy",
	"mil.sy",
	"com.sy",
	"org.sy",
	"sz",
	"co.sz",
	"ac.sz",
	"org.sz",
	"tc",
	"td",
	"tel",
	"tf",
	"tg",
	"th",
	"ac.th",
	"co.th",
	"go.th",
	"in.th",
	"mi.th",
	"net.th",
	"or.th",
	"tj",
	"ac.tj",
	"biz.tj",
	"co.tj",
	"com.tj",
	"edu.tj",
	"go.tj",
	"gov.tj",
	"int.tj",
	"mil.tj",
	"name.tj",
	"net.tj",
	"nic.tj",
	"org.tj",
	"test.tj",
	"web.tj",
	"tk",
	"tl",
	"gov.tl",
	"tm",
	"com.tm",
	"co.tm",
	"org.tm",
	"net.tm",
	"nom.tm",
	"gov.tm",
	"mil.tm",
	"edu.tm",
	"tn",
	"com.tn",
	"ens.tn",
	"fin.tn",
	"gov.tn",
	"ind.tn",
	"info.tn",
	"intl.tn",
	"mincom.tn",
	"nat.tn",
	"net.tn",
	"org.tn",
	"perso.tn",
	"tourism.tn",
	"to",
	"com.to",
	"gov.to",
	"net.to",
	"org.to",
	"edu.to",
	"mil.to",
	"tr",
	"av.tr",
	"bbs.tr",
	"bel.tr",
	"biz.tr",
	"com.tr",
	"dr.tr",
	"edu.tr",
	"gen.tr",
	"gov.tr",
	"info.tr",
	"mil.tr",
	"k12.tr",
	"kep.tr",
	"name.tr",
	"net.tr",
	"org.tr",
	"pol.tr",
	"tel.tr",
	"tsk.tr",
	"tv.tr",
	"web.tr",
	"nc.tr",
	"gov.nc.tr",
	"tt",
	"co.tt",
	"com.tt",
	"org.tt",
	"net.tt",
	"biz.tt",
	"info.tt",
	"pro.tt",
	"int.tt",
	"coop.tt",
	"jobs.tt",
	"mobi.tt",
	"travel.tt",
	"museum.tt",
	"aero.tt",
	"name.tt",
	"gov.tt",
	"edu.tt",
	"tv",
	"tw",
	"edu.tw",
	"gov.tw",
	"mil.tw",
	"com.tw",
	"net.tw",
	"org.tw",
	"idv.tw",
	"game.tw",
	"ebiz.tw",
	"club.tw",
	"網路.tw",
	"組織.tw",
	"商業.tw",
	"tz",
	"ac.tz",
	"co.tz",
	"go.tz",
	"hotel.tz",
	"info.tz",
	"me.tz",
	"mil.tz",
	"mobi.tz",
	"ne.tz",
	"or.tz",
	"sc.tz",
	"tv.tz",
	"ua",
	"com.ua",
	"edu.ua",
	"gov.ua",
	"in.ua",
	"net.ua",
	"org.ua",
	"cherkassy.ua",
	"cherkasy.ua",
	"chernigov.ua",
	"chernihiv.ua",
	"chernivtsi.ua",
	"chernovtsy.ua",
	"ck.ua",
	"cn.ua",
	"cr.ua",
	"crimea.ua",
	"cv.ua",
	"dn.ua",
	"dnepropetrovsk.ua",
	"dnipropetrovsk.ua",
	"donetsk.ua",
	"dp.ua",
	"if.ua",
	"ivano-frankivsk.ua",
	"kh.ua",
	"kharkiv.ua",
	"kharkov.ua",
	"kherson.ua",
	"khmelnitskiy.ua",
	"khmelnytskyi.ua",
	"kiev.ua",
	"kirovograd.ua",
	"km.ua",
	"kr.ua",
	"krym.ua",
	"ks.ua",
	"kv.ua",
	"kyiv.ua",
	"lg.ua",
	"lt.ua",
	"lugansk.ua",
	"lutsk.ua",
	"lv.ua",
	"lviv.ua",
	"mk.ua",
	"mykolaiv.ua",
	"nikolaev.ua",
	"od.ua",
	"odesa.ua",
	"odessa.ua",
	"pl.ua",
	"poltava.ua",
	"rivne.ua",
	"rovno.ua",
	"rv.ua",
	"sb.ua",
	"sebastopol.ua",
	"sevastopol.ua",
	"sm.ua",
	"sumy.ua",
	"te.ua",
	"ternopil.ua",
	"uz.ua",
	"uzhgorod.ua",
	"vinnica.ua",
	"vinnytsia.ua",
	"vn.ua",
	"volyn.ua",
	"yalta.ua",
	"zaporizhzhe.ua",
	"zaporizhzhia.ua",
	"zhitomir.ua",
	"zhytomyr.ua",
	"zp.ua",
	"zt.ua",
	"ug",
	"co.ug",
	"or.ug",
	"ac.ug",
	"sc.ug",
	"go.ug",
	"ne.ug",
	"com.ug",
	"org.ug",
	"uk",
	"ac.uk",
	"co.uk",
	"gov.uk",
	"ltd.uk",
	"me.uk",
	"net.uk",
	"nhs.uk",
	"org.uk",
	"plc.uk",
	"police.uk",
	"*.sch.uk",
	"us",
	"dni.us",
	"fed.us",
	"isa.us",
	"kids.us",
	"nsn.us",
	"ak.us",
	"al.us",
	"ar.us",
	"as.us",
	"az.us",
	"ca.us",
	"co.us",
	"ct.us",
	"dc.us",
	"de.us",
	"fl.us",
	"ga.us",
	"gu.us",
	"hi.us",
	"ia.us",
	"id.us",
	"il.us",
	"in.us",
	"ks.us",
	"ky.us",
	"la.us",
	"ma.us",
	"md.us",
	"me.us",
	"mi.us",
	"mn.us",
	"mo.us",
	"ms.us",
	"mt.us",
	"nc.us",
	"nd.us",
	"ne.us",
	"nh.us",
	"nj.us",
	"nm.us",
	"nv.us",
	"ny.us",
	"oh.us",
	"ok.us",
	"or.us",
	"pa.us",
	"pr.us",
	"ri.us",
	"sc.us",
	"sd.us",
	"tn.us",
	"tx.us",
	"ut.us",
	"vi.us",
	"vt.us",
	"va.us",
	"wa.us",
	"wi.us",
	"wv.us",
	"wy.us",
	"k12.ak.us",
	"k12.al.us",
	"k12.ar.us",
	"k12.as.us",
	"k12.az.us",
	"k12.ca.us",
	"k12.co.us",
	"k12.ct.us",
	"k12.dc.us",
	"k12.de.us",
	"k12.fl.us",
	"k12.ga.us",
	"k12.gu.us",
	"k12.ia.us",
	"k12.id.us",
	"k12.il.us",
	"k12.in.us",
	"k12.ks.us",
	"k12.ky.us",
	"k12.la.us",
	"k12.ma.us",
	"k12.md.us",
	"k12.me.us",
	"k12.mi.us",
	"k12.mn.us",
	"k12.mo.us",
	"k12.ms.us",
	"k12.mt.us",
	"k12.nc.us",
	"k12.ne.us",
	"k12.nh.us",
	"k12.nj.us",
	"k12.nm.us",
	"k12.nv.us",
	"k12.ny.us",
	"k12.oh.us",
	"k12.ok.us",
	"k12.or.us",
	"k12.pa.us",
	"k12.pr.us",
	"k12.sc.us",
	"k12.tn.us",
	"k12.tx.us",
	"k12.ut.us",
	"k12.vi.us",
	"k12.vt.us",
	"k12.va.us",
	"k12.wa.us",
	"k12.wi.us",
	"k12.wy.us",
	"cc.ak.us",
	"cc.al.us",
	"cc.ar.us",
	"cc.as.us",
	"cc.az.us",
	"cc.ca.us",
	"cc.co.us",
	"cc.ct.us",
	"cc.dc.us",
	"cc.de.us",
	"cc.fl.us",
	"cc.ga.us",
	"cc.gu.us",
	"cc.hi.us",
	"cc.ia.us",
	"cc.id.us",
	"cc.il.us",
	"cc.in.us",
	"cc.ks.us",
	"cc.ky.us",
	"cc.la.us",
	"cc.ma.us",
	"cc.md.us",
	"cc.me.us",
	"cc.mi.us",
	"cc.mn.us",
	"cc.mo.us",
	"cc.ms.us",
	"cc.mt.us",
	"cc.nc.us",
	"cc.nd.us",
	"cc.ne.us",
	"cc.nh.us",
	"cc.nj.us",
	"cc.nm.us",
	"cc.nv.us",
	"cc.ny.us",
	"cc.oh.us",
	"cc.ok.us",
	"cc.or.us",
	"cc.pa.us",
	"cc.pr.us",
	"cc.ri.us",
	"cc.sc.us",
	"cc.sd.us",
	"cc.tn.us",
	"cc.tx.us",
	"cc.ut.us",
	"cc.vi.us",
	"cc.vt.us",
	"cc.va.us",
	"cc.wa.us",
	"cc.wi.us",
	"cc.wv.us",
	"cc.wy.us",
	"lib.ak.us",
	"lib.al.us",
	"lib.ar.us",
	"lib.as.us",
	"lib.az.us",
	"lib.ca.us",
	"lib.co.us",
	"lib.ct.us",
	"lib.dc.us",
	"lib.fl.us",
	"lib.ga.us",
	"lib.gu.us",
	"lib.hi.us",
	"lib.ia.us",
	"lib.id.us",
	"lib.il.us",
	"lib.in.us",
	"lib.ks.us",
	"lib.ky.us",
	"lib.la.us",
	"lib.ma.us",
	"lib.md.us",
	"lib.me.us",
	"lib.mi.us",
	"lib.mn.us",
	"lib.mo.us",
	"lib.ms.us",
	"lib.mt.us",
	"lib.nc.us",
	"lib.nd.us",
	"lib.ne.us",
	"lib.nh.us",
	"lib.nj.us",
	"lib.nm.us",
	"lib.nv.us",
	"lib.ny.us",
	"lib.oh.us",
	"lib.ok.us",
	"lib.or.us",
	"lib.pa.us",
	"lib.pr.us",
	"lib.ri.us",
	"lib.sc.us",
	"lib.sd.us",
	"lib.tn.us",
	"lib.tx.us",
	"lib.ut.us",
	"lib.vi.us",
	"lib.vt.us",
	"lib.va.us",
	"lib.wa.us",
	"lib.wi.us",
	"lib.wy.us",
	"pvt.k12.ma.us",
	"chtr.k12.ma.us",
	"paroch.k12.ma.us",
	"ann-arbor.mi.us",
	"cog.mi.us",
	"dst.mi.us",
	"eaton.mi.us",
	"gen.mi.us",
	"mus.mi.us",
	"tec.mi.us",
	"washtenaw.mi.us",
	"uy",
	"com.uy",
	"edu.uy",
	"gub.uy",
	"mil.uy",
	"net.uy",
	"org.uy",
	"uz",
	"co.uz",
	"com.uz",
	"net.uz",
	"org.uz",
	"va",
	"vc",
	"com.vc",
	"net.vc",
	"org.vc",
	"gov.vc",
	"mil.vc",
	"edu.vc",
	"ve",
	"arts.ve",
	"bib.ve",
	"co.ve",
	"com.ve",
	"e12.ve",
	"edu.ve",
	"firm.ve",
	"gob.ve",
	"gov.ve",
	"info.ve",
	"int.ve",
	"mil.ve",
	"net.ve",
	"nom.ve",
	"org.ve",
	"rar.ve",
	"rec.ve",
	"store.ve",
	"tec.ve",
	"web.ve",
	"vg",
	"vi",
	"co.vi",
	"com.vi",
	"k12.vi",
	"net.vi",
	"org.vi",
	"vn",
	"com.vn",
	"net.vn",
	"org.vn",
	"edu.vn",
	"gov.vn",
	"int.vn",
	"ac.vn",
	"biz.vn",
	"info.vn",
	"name.vn",
	"pro.vn",
	"health.vn",
	"vu",
	"com.vu",
	"edu.vu",
	"net.vu",
	"org.vu",
	"wf",
	"ws",
	"com.ws",
	"net.ws",
	"org.ws",
	"gov.ws",
	"edu.ws",
	"yt",
	"امارات",
	"հայ",
	"বাংলা",
	"бг",
	"البحرين",
	"бел",
	"中国",
	"中國",
	"الجزائر",
	"مصر",
	"ею",
	"ευ",
	"موريتانيا",
	"გე",
	"ελ",
	"香港",
	"公司.香港",
	"教育.香港",
	"政府.香港",
	"個人.香港",
	"網絡.香港",
	"組織.香港",
	"ಭಾರತ",
	"ଭାରତ",
	"ভাৰত",
	"भारतम्",
	"भारोत",
	"ڀارت",
	"ഭാരതം",
	"भारत",
	"بارت",
	"بھارت",
	"భారత్",
	"ભારત",
	"ਭਾਰਤ",
	"ভারত",
	"இந்தியா",
	"ایران",
	"ايران",
	"عراق",
	"الاردن",
	"한국",
	"қаз",
	"ລາວ",
	"ලංකා",
	"இலங்கை",
	"المغرب",
	"мкд",
	"мон",
	"澳門",
	"澳门",
	"مليسيا",
	"عمان",
	"پاکستان",
	"پاكستان",
	"فلسطين",
	"срб",
	"пр.срб",
	"орг.срб",
	"обр.срб",
	"од.срб",
	"упр.срб",
	"ак.срб",
	"рф",
	"قطر",
	"السعودية",
	"السعودیة",
	"السعودیۃ",
	"السعوديه",
	"سودان",
	"新加坡",
	"சிங்கப்பூர்",
	"سورية",
	"سوريا",
	"ไทย",
	"ศึกษา.ไทย",
	"ธุรกิจ.ไทย",
	"รัฐบาล.ไทย",
	"ทหาร.ไทย",
	"เน็ต.ไทย",
	"องค์กร.ไทย",
	"تونس",
	"台灣",
	"台湾",
	"臺灣",
	"укр",
	"اليمن",
	"xxx",
	"ye",
	"com.ye",
	"edu.ye",
	"gov.ye",
	"net.ye",
	"mil.ye",
	"org.ye",
	"ac.za",
	"agric.za",
	"alt.za",
	"co.za",
	"edu.za",
	"gov.za",
	"grondar.za",
	"law.za",
	"mil.za",
	"net.za",
	"ngo.za",
	"nic.za",
	"nis.za",
	"nom.za",
	"org.za",
	"school.za",
	"tm.za",
	"web.za",
	"zm",
	"ac.zm",
	"biz.zm",
	"co.zm",
	"com.zm",
	"edu.zm",
	"gov.zm",
	"info.zm",
	"mil.zm",
	"net.zm",
	"org.zm",
	"sch.zm",
	"zw",
	"ac.zw",
	"co.zw",
	"gov.zw",
	"mil.zw",
	"org.zw",
	"aaa",
	"aarp",
	"abarth",
	"abb",
	"abbott",
	"abbvie",
	"abc",
	"able",
	"abogado",
	"abudhabi",
	"academy",
	"accenture",
	"accountant",
	"accountants",
	"aco",
	"actor",
	"adac",
	"ads",
	"adult",
	"aeg",
	"aetna",
	"afl",
	"africa",
	"agakhan",
	"agency",
	"aig",
	"airbus",
	"airforce",
	"airtel",
	"akdn",
	"alfaromeo",
	"alibaba",
	"alipay",
	"allfinanz",
	"allstate",
	"ally",
	"alsace",
	"alstom",
	"amazon",
	"americanexpress",
	"americanfamily",
	"amex",
	"amfam",
	"amica",
	"amsterdam",
	"analytics",
	"android",
	"anquan",
	"anz",
	"aol",
	"apartments",
	"app",
	"apple",
	"aquarelle",
	"arab",
	"aramco",
	"archi",
	"army",
	"art",
	"arte",
	"asda",
	"associates",
	"athleta",
	"attorney",
	"auction",
	"audi",
	"audible",
	"audio",
	"auspost",
	"author",
	"auto",
	"autos",
	"avianca",
	"aws",
	"axa",
	"azure",
	"baby",
	"baidu",
	"banamex",
	"bananarepublic",
	"band",
	"bank",
	"bar",
	"barcelona",
	"barclaycard",
	"barclays",
	"barefoot",
	"bargains",
	"baseball",
	"basketball",
	"bauhaus",
	"bayern",
	"bbc",
	"bbt",
	"bbva",
	"bcg",
	"bcn",
	"beats",
	"beauty",
	"beer",
	"bentley",
	"berlin",
	"best",
	"bestbuy",
	"bet",
	"bharti",
	"bible",
	"bid",
	"bike",
	"bing",
	"bingo",
	"bio",
	"black",
	"blackfriday",
	"blockbuster",
	"blog",
	"bloomberg",
	"blue",
	"bms",
	"bmw",
	"bnpparibas",
	"boats",
	"boehringer",
	"bofa",
	"bom",
	"bond",
	"boo",
	"book",
	"booking",
	"bosch",
	"bostik",
	"boston",
	"bot",
	"boutique",
	"box",
	"bradesco",
	"bridgestone",
	"broadway",
	"broker",
	"brother",
	"brussels",
	"bugatti",
	"build",
	"builders",
	"business",
	"buy",
	"buzz",
	"bzh",
	"cab",
	"cafe",
	"cal",
	"call",
	"calvinklein",
	"cam",
	"camera",
	"camp",
	"cancerresearch",
	"canon",
	"capetown",
	"capital",
	"capitalone",
	"car",
	"caravan",
	"cards",
	"care",
	"career",
	"careers",
	"cars",
	"casa",
	"case",
	"cash",
	"casino",
	"catering",
	"catholic",
	"cba",
	"cbn",
	"cbre",
	"cbs",
	"center",
	"ceo",
	"cern",
	"cfa",
	"cfd",
	"chanel",
	"channel",
	"charity",
	"chase",
	"chat",
	"cheap",
	"chintai",
	"christmas",
	"chrome",
	"church",
	"cipriani",
	"circle",
	"cisco",
	"citadel",
	"citi",
	"citic",
	"city",
	"cityeats",
	"claims",
	"cleaning",
	"click",
	"clinic",
	"clinique",
	"clothing",
	"cloud",
	"club",
	"clubmed",
	"coach",
	"codes",
	"coffee",
	"college",
	"cologne",
	"comcast",
	"commbank",
	"community",
	"company",
	"compare",
	"computer",
	"comsec",
	"condos",
	"construction",
	"consulting",
	"contact",
	"contractors",
	"cooking",
	"cookingchannel",
	"cool",
	"corsica",
	"country",
	"coupon",
	"coupons",
	"courses",
	"cpa",
	"credit",
	"creditcard",
	"creditunion",
	"cricket",
	"crown",
	"crs",
	"cruise",
	"cruises",
	"cuisinella",
	"cymru",
	"cyou",
	"dabur",
	"dad",
	"dance",
	"data",
	"date",
	"dating",
	"datsun",
	"day",
	"dclk",
	"dds",
	"deal",
	"dealer",
	"deals",
	"degree",
	"delivery",
	"dell",
	"deloitte",
	"delta",
	"democrat",
	"dental",
	"dentist",
	"desi",
	"design",
	"dev",
	"dhl",
	"diamonds",
	"diet",
	"digital",
	"direct",
	"directory",
	"discount",
	"discover",
	"dish",
	"diy",
	"dnp",
	"docs",
	"doctor",
	"dog",
	"domains",
	"dot",
	"download",
	"drive",
	"dtv",
	"dubai",
	"dunlop",
	"dupont",
	"durban",
	"dvag",
	"dvr",
	"earth",
	"eat",
	"eco",
	"edeka",
	"education",
	"email",
	"emerck",
	"energy",
	"engineer",
	"engineering",
	"enterprises",
	"epson",
	"equipment",
	"ericsson",
	"erni",
	"esq",
	"estate",
	"etisalat",
	"eurovision",
	"eus",
	"events",
	"exchange",
	"expert",
	"exposed",
	"express",
	"extraspace",
	"fage",
	"fail",
	"fairwinds",
	"faith",
	"family",
	"fan",
	"fans",
	"farm",
	"farmers",
	"fashion",
	"fast",
	"fedex",
	"feedback",
	"ferrari",
	"ferrero",
	"fiat",
	"fidelity",
	"fido",
	"film",
	"final",
	"finance",
	"financial",
	"fire",
	"firestone",
	"firmdale",
	"fish",
	"fishing",
	"fit",
	"fitness",
	"flickr",
	"flights",
	"flir",
	"florist",
	"flowers",
	"fly",
	"foo",
	"food",
	"foodnetwork",
	"football",
	"ford",
	"forex",
	"forsale",
	"forum",
	"foundation",
	"fox",
	"free",
	"fresenius",
	"frl",
	"frogans",
	"frontdoor",
	"frontier",
	"ftr",
	"fujitsu",
	"fun",
	"fund",
	"furniture",
	"futbol",
	"fyi",
	"gal",
	"gallery",
	"gallo",
	"gallup",
	"game",
	"games",
	"gap",
	"garden",
	"gay",
	"gbiz",
	"gdn",
	"gea",
	"gent",
	"genting",
	"george",
	"ggee",
	"gift",
	"gifts",
	"gives",
	"giving",
	"glass",
	"gle",
	"global",
	"globo",
	"gmail",
	"gmbh",
	"gmo",
	"gmx",
	"godaddy",
	"gold",
	"goldpoint",
	"golf",
	"goo",
	"goodyear",
	"goog",
	"google",
	"gop",
	"got",
	"grainger",
	"graphics",
	"gratis",
	"green",
	"gripe",
	"grocery",
	"group",
	"guardian",
	"gucci",
	"guge",
	"guide",
	"guitars",
	"guru",
	"hair",
	"hamburg",
	"hangout",
	"haus",
	"hbo",
	"hdfc",
	"hdfcbank",
	"health",
	"healthcare",
	"help",
	"helsinki",
	"here",
	"hermes",
	"hgtv",
	"hiphop",
	"hisamitsu",
	"hitachi",
	"hiv",
	"hkt",
	"hockey",
	"holdings",
	"holiday",
	"homedepot",
	"homegoods",
	"homes",
	"homesense",
	"honda",
	"horse",
	"hospital",
	"host",
	"hosting",
	"hot",
	"hoteles",
	"hotels",
	"hotmail",
	"house",
	"how",
	"hsbc",
	"hughes",
	"hyatt",
	"hyundai",
	"ibm",
	"icbc",
	"ice",
	"icu",
	"ieee",
	"ifm",
	"ikano",
	"imamat",
	"imdb",
	"immo",
	"immobilien",
	"inc",
	"industries",
	"infiniti",
	"ing",
	"ink",
	"institute",
	"insurance",
	"insure",
	"international",
	"intuit",
	"investments",
	"ipiranga",
	"irish",
	"ismaili",
	"ist",
	"istanbul",
	"itau",
	"itv",
	"jaguar",
	"java",
	"jcb",
	"jeep",
	"jetzt",
	"jewelry",
	"jio",
	"jll",
	"jmp",
	"jnj",
	"joburg",
	"jot",
	"joy",
	"jpmorgan",
	"jprs",
	"juegos",
	"juniper",
	"kaufen",
	"kddi",
	"kerryhotels",
	"kerrylogistics",
	"kerryproperties",
	"kfh",
	"kia",
	"kids",
	"kim",
	"kinder",
	"kindle",
	"kitchen",
	"kiwi",
	"koeln",
	"komatsu",
	"kosher",
	"kpmg",
	"kpn",
	"krd",
	"kred",
	"kuokgroup",
	"kyoto",
	"lacaixa",
	"lamborghini",
	"lamer",
	"lancaster",
	"lancia",
	"land",
	"landrover",
	"lanxess",
	"lasalle",
	"lat",
	"latino",
	"latrobe",
	"law",
	"lawyer",
	"lds",
	"lease",
	"leclerc",
	"lefrak",
	"legal",
	"lego",
	"lexus",
	"lgbt",
	"lidl",
	"life",
	"lifeinsurance",
	"lifestyle",
	"lighting",
	"like",
	"lilly",
	"limited",
	"limo",
	"lincoln",
	"linde",
	"link",
	"lipsy",
	"live",
	"living",
	"llc",
	"llp",
	"loan",
	"loans",
	"locker",
	"locus",
	"loft",
	"lol",
	"london",
	"lotte",
	"lotto",
	"love",
	"lpl",
	"lplfinancial",
	"ltd",
	"ltda",
	"lundbeck",
	"luxe",
	"luxury",
	"macys",
	"madrid",
	"maif",
	"maison",
	"makeup",
	"man",
	"management",
	"mango",
	"map",
	"market",
	"marketing",
	"markets",
	"marriott",
	"marshalls",
	"maserati",
	"mattel",
	"mba",
	"mckinsey",
	"med",
	"media",
	"meet",
	"melbourne",
	"meme",
	"memorial",
	"men",
	"menu",
	"merckmsd",
	"miami",
	"microsoft",
	"mini",
	"mint",
	"mit",
	"mitsubishi",
	"mlb",
	"mls",
	"mma",
	"mobile",
	"moda",
	"moe",
	"moi",
	"mom",
	"monash",
	"money",
	"monster",
	"mormon",
	"mortgage",
	"moscow",
	"moto",
	"motorcycles",
	"mov",
	"movie",
	"msd",
	"mtn",
	"mtr",
	"music",
	"mutual",
	"nab",
	"nagoya",
	"natura",
	"navy",
	"nba",
	"nec",
	"netbank",
	"netflix",
	"network",
	"neustar",
	"new",
	"news",
	"next",
	"nextdirect",
	"nexus",
	"nfl",
	"ngo",
	"nhk",
	"nico",
	"nike",
	"nikon",
	"ninja",
	"nissan",
	"nissay",
	"nokia",
	"northwesternmutual",
	"norton",
	"now",
	"nowruz",
	"nowtv",
	"nra",
	"nrw",
	"ntt",
	"nyc",
	"obi",
	"observer",
	"office",
	"okinawa",
	"olayan",
	"olayangroup",
	"oldnavy",
	"ollo",
	"omega",
	"one",
	"ong",
	"onl",
	"online",
	"ooo",
	"open",
	"oracle",
	"orange",
	"organic",
	"origins",
	"osaka",
	"otsuka",
	"ott",
	"ovh",
	"page",
	"panasonic",
	"paris",
	"pars",
	"partners",
	"parts",
	"party",
	"passagens",
	"pay",
	"pccw",
	"pet",
	"pfizer",
	"pharmacy",
	"phd",
	"philips",
	"phone",
	"photo",
	"photography",
	"photos",
	"physio",
	"pics",
	"pictet",
	"pictures",
	"pid",
	"pin",
	"ping",
	"pink",
	"pioneer",
	"pizza",
	"place",
	"play",
	"playstation",
	"plumbing",
	"plus",
	"pnc",
	"pohl",
	"poker",
	"politie",
	"porn",
	"pramerica",
	"praxi",
	"press",
	"prime",
	"prod",
	"productions",
	"prof",
	"progressive",
	"promo",
	"properties",
	"property",
	"protection",
	"pru",
	"prudential",
	"pub",
	"pwc",
	"qpon",
	"quebec",
	"quest",
	"racing",
	"radio",
	"read",
	"realestate",
	"realtor",
	"realty",
	"recipes",
	"red",
	"redstone",
	"redumbrella",
	"rehab",
	"reise",
	"reisen",
	"reit",
	"reliance",
	"ren",
	"rent",
	"rentals",
	"repair",
	"report",
	"republican",
	"rest",
	"restaurant",
	"review",
	"reviews",
	"rexroth",
	"rich",
	"richardli",
	"ricoh",
	"ril",
	"rio",
	"rip",
	"rocher",
	"rocks",
	"rodeo",
	"rogers",
	"room",
	"rsvp",
	"rugby",
	"ruhr",
	"run",
	"rwe",
	"ryukyu",
	"saarland",
	"safe",
	"safety",
	"sakura",
	"sale",
	"salon",
	"samsclub",
	"samsung",
	"sandvik",
	"sandvikcoromant",
	"sanofi",
	"sap",
	"sarl",
	"sas",
	"save",
	"saxo",
	"sbi",
	"sbs",
	"sca",
	"scb",
	"schaeffler",
	"schmidt",
	"scholarships",
	"school",
	"schule",
	"schwarz",
	"science",
	"scot",
	"search",
	"seat",
	"secure",
	"security",
	"seek",
	"select",
	"sener",
	"services",
	"ses",
	"seven",
	"sew",
	"sex",
	"sexy",
	"sfr",
	"shangrila",
	"sharp",
	"shaw",
	"shell",
	"shia",
	"shiksha",
	"shoes",
	"shop",
	"shopping",
	"shouji",
	"show",
	"showtime",
	"silk",
	"sina",
	"singles",
	"site",
	"ski",
	"skin",
	"sky",
	"skype",
	"sling",
	"smart",
	"smile",
	"sncf",
	"soccer",
	"social",
	"softbank",
	"software",
	"sohu",
	"solar",
	"solutions",
	"song",
	"sony",
	"soy",
	"spa",
	"space",
	"sport",
	"spot",
	"srl",
	"stada",
	"staples",
	"star",
	"statebank",
	"statefarm",
	"stc",
	"stcgroup",
	"stockholm",
	"storage",
	"store",
	"stream",
	"studio",
	"study",
	"style",
	"sucks",
	"supplies",
	"supply",
	"support",
	"surf",
	"surgery",
	"suzuki",
	"swatch",
	"swiss",
	"sydney",
	"systems",
	"tab",
	"taipei",
	"talk",
	"taobao",
	"target",
	"tatamotors",
	"tatar",
	"tattoo",
	"tax",
	"taxi",
	"tci",
	"tdk",
	"team",
	"tech",
	"technology",
	"temasek",
	"tennis",
	"teva",
	"thd",
	"theater",
	"theatre",
	"tiaa",
	"tickets",
	"tienda",
	"tiffany",
	"tips",
	"tires",
	"tirol",
	"tjmaxx",
	"tjx",
	"tkmaxx",
	"tmall",
	"today",
	"tokyo",
	"tools",
	"top",
	"toray",
	"toshiba",
	"total",
	"tours",
	"town",
	"toyota",
	"toys",
	"trade",
	"trading",
	"training",
	"travel",
	"travelchannel",
	"travelers",
	"travelersinsurance",
	"trust",
	"trv",
	"tube",
	"tui",
	"tunes",
	"tushu",
	"tvs",
	"ubank",
	"ubs",
	"unicom",
	"university",
	"uno",
	"uol",
	"ups",
	"vacations",
	"vana",
	"vanguard",
	"vegas",
	"ventures",
	"verisign",
	"versicherung",
	"vet",
	"viajes",
	"video",
	"vig",
	"viking",
	"villas",
	"vin",
	"vip",
	"virgin",
	"visa",
	"vision",
	"viva",
	"vivo",
	"vlaanderen",
	"vodka",
	"volkswagen",
	"volvo",
	"vote",
	"voting",
	"voto",
	"voyage",
	"vuelos",
	"wales",
	"walmart",
	"walter",
	"wang",
	"wanggou",
	"watch",
	"watches",
	"weather",
	"weatherchannel",
	"webcam",
	"weber",
	"website",
	"wedding",
	"weibo",
	"weir",
	"whoswho",
	"wien",
	"wiki",
	"williamhill",
	"win",
	"windows",
	"wine",
	"winners",
	"wme",
	"wolterskluwer",
	"woodside",
	"work",
	"works",
	"world",
	"wow",
	"wtc",
	"wtf",
	"xbox",
	"xerox",
	"xfinity",
	"xihuan",
	"xin",
	"कॉम",
	"セール",
	"佛山",
	"慈善",
	"集团",
	"在线",
	"点看",
	"คอม",
	"八卦",
	"موقع",
	"公益",
	"公司",
	"香格里拉",
	"网站",
	"移动",
	"我爱你",
	"москва",
	"католик",
	"онлайн",
	"сайт",
	"联通",
	"קום",
	"时尚",
	"微博",
	"淡马锡",
	"ファッション",
	"орг",
	"नेट",
	"ストア",
	"アマゾン",
	"삼성",
	"商标",
	"商店",
	"商城",
	"дети",
	"ポイント",
	"新闻",
	"家電",
	"كوم",
	"中文网",
	"中信",
	"娱乐",
	"谷歌",
	"電訊盈科",
	"购物",
	"クラウド",
	"通販",
	"网店",
	"संगठन",
	"餐厅",
	"网络",
	"ком",
	"亚马逊",
	"诺基亚",
	"食品",
	"飞利浦",
	"手机",
	"ارامكو",
	"العليان",
	"اتصالات",
	"بازار",
	"ابوظبي",
	"كاثوليك",
	"همراه",
	"닷컴",
	"政府",
	"شبكة",
	"بيتك",
	"عرب",
	"机构",
	"组织机构",
	"健康",
	"招聘",
	"рус",
	"大拿",
	"みんな",
	"グーグル",
	"世界",
	"書籍",
	"网址",
	"닷넷",
	"コム",
	"天主教",
	"游戏",
	"vermögensberater",
	"vermögensberatung",
	"企业",
	"信息",
	"嘉里大酒店",
	"嘉里",
	"广东",
	"政务",
	"xyz",
	"yachts",
	"yahoo",
	"yamaxun",
	"yandex",
	"yodobashi",
	"yoga",
	"yokohama",
	"you",
	"youtube",
	"yun",
	"zappos",
	"zara",
	"zero",
	"zip",
	"zone",
	"zuerich",
	"cc.ua",
	"inf.ua",
	"ltd.ua",
	"611.to",
	"graphox.us",
	"*.devcdnaccesso.com",
	"adobeaemcloud.com",
	"*.dev.adobeaemcloud.com",
	"hlx.live",
	"adobeaemcloud.net",
	"hlx.page",
	"hlx3.page",
	"beep.pl",
	"airkitapps.com",
	"airkitapps-au.com",
	"airkitapps.eu",
	"aivencloud.com",
	"barsy.ca",
	"*.compute.estate",
	"*.alces.network",
	"kasserver.com",
	"altervista.org",
	"alwaysdata.net",
	"cloudfront.net",
	"*.compute.amazonaws.com",
	"*.compute-1.amazonaws.com",
	"*.compute.amazonaws.com.cn",
	"us-east-1.amazonaws.com",
	"cn-north-1.eb.amazonaws.com.cn",
	"cn-northwest-1.eb.amazonaws.com.cn",
	"elasticbeanstalk.com",
	"ap-northeast-1.elasticbeanstalk.com",
	"ap-northeast-2.elasticbeanstalk.com",
	"ap-northeast-3.elasticbeanstalk.com",
	"ap-south-1.elasticbeanstalk.com",
	"ap-southeast-1.elasticbeanstalk.com",
	"ap-southeast-2.elasticbeanstalk.com",
	"ca-central-1.elasticbeanstalk.com",
	"eu-central-1.elasticbeanstalk.com",
	"eu-west-1.elasticbeanstalk.com",
	"eu-west-2.elasticbeanstalk.com",
	"eu-west-3.elasticbeanstalk.com",
	"sa-east-1.elasticbeanstalk.com",
	"us-east-1.elasticbeanstalk.com",
	"us-east-2.elasticbeanstalk.com",
	"us-gov-west-1.elasticbeanstalk.com",
	"us-west-1.elasticbeanstalk.com",
	"us-west-2.elasticbeanstalk.com",
	"*.elb.amazonaws.com",
	"*.elb.amazonaws.com.cn",
	"awsglobalaccelerator.com",
	"s3.amazonaws.com",
	"s3-ap-northeast-1.amazonaws.com",
	"s3-ap-northeast-2.amazonaws.com",
	"s3-ap-south-1.amazonaws.com",
	"s3-ap-southeast-1.amazonaws.com",
	"s3-ap-southeast-2.amazonaws.com",
	"s3-ca-central-1.amazonaws.com",
	"s3-eu-central-1.amazonaws.com",
	"s3-eu-west-1.amazonaws.com",
	"s3-eu-west-2.amazonaws.com",
	"s3-eu-west-3.amazonaws.com",
	"s3-external-1.amazonaws.com",
	"s3-fips-us-gov-west-1.amazonaws.com",
	"s3-sa-east-1.amazonaws.com",
	"s3-us-gov-west-1.amazonaws.com",
	"s3-us-east-2.amazonaws.com",
	"s3-us-west-1.amazonaws.com",
	"s3-us-west-2.amazonaws.com",
	"s3.ap-northeast-2.amazonaws.com",
	"s3.ap-south-1.amazonaws.com",
	"s3.cn-north-1.amazonaws.com.cn",
	"s3.ca-central-1.amazonaws.com",
	"s3.eu-central-1.amazonaws.com",
	"s3.eu-west-2.amazonaws.com",
	"s3.eu-west-3.amazonaws.com",
	"s3.us-east-2.amazonaws.com",
	"s3.dualstack.ap-northeast-1.amazonaws.com",
	"s3.dualstack.ap-northeast-2.amazonaws.com",
	"s3.dualstack.ap-south-1.amazonaws.com",
	"s3.dualstack.ap-southeast-1.amazonaws.com",
	"s3.dualstack.ap-southeast-2.amazonaws.com",
	"s3.dualstack.ca-central-1.amazonaws.com",
	"s3.dualstack.eu-central-1.amazonaws.com",
	"s3.dualstack.eu-west-1.amazonaws.com",
	"s3.dualstack.eu-west-2.amazonaws.com",
	"s3.dualstack.eu-west-3.amazonaws.com",
	"s3.dualstack.sa-east-1.amazonaws.com",
	"s3.dualstack.us-east-1.amazonaws.com",
	"s3.dualstack.us-east-2.amazonaws.com",
	"s3-website-us-east-1.amazonaws.com",
	"s3-website-us-west-1.amazonaws.com",
	"s3-website-us-west-2.amazonaws.com",
	"s3-website-ap-northeast-1.amazonaws.com",
	"s3-website-ap-southeast-1.amazonaws.com",
	"s3-website-ap-southeast-2.amazonaws.com",
	"s3-website-eu-west-1.amazonaws.com",
	"s3-website-sa-east-1.amazonaws.com",
	"s3-website.ap-northeast-2.amazonaws.com",
	"s3-website.ap-south-1.amazonaws.com",
	"s3-website.ca-central-1.amazonaws.com",
	"s3-website.eu-central-1.amazonaws.com",
	"s3-website.eu-west-2.amazonaws.com",
	"s3-website.eu-west-3.amazonaws.com",
	"s3-website.us-east-2.amazonaws.com",
	"t3l3p0rt.net",
	"tele.amune.org",
	"apigee.io",
	"siiites.com",
	"appspacehosted.com",
	"appspaceusercontent.com",
	"appudo.net",
	"on-aptible.com",
	"user.aseinet.ne.jp",
	"gv.vc",
	"d.gv.vc",
	"user.party.eus",
	"pimienta.org",
	"poivron.org",
	"potager.org",
	"sweetpepper.org",
	"myasustor.com",
	"cdn.prod.atlassian-dev.net",
	"translated.page",
	"myfritz.net",
	"onavstack.net",
	"*.awdev.ca",
	"*.advisor.ws",
	"ecommerce-shop.pl",
	"b-data.io",
	"backplaneapp.io",
	"balena-devices.com",
	"rs.ba",
	"*.banzai.cloud",
	"app.banzaicloud.io",
	"*.backyards.banzaicloud.io",
	"base.ec",
	"official.ec",
	"buyshop.jp",
	"fashionstore.jp",
	"handcrafted.jp",
	"kawaiishop.jp",
	"supersale.jp",
	"theshop.jp",
	"shopselect.net",
	"base.shop",
	"*.beget.app",
	"betainabox.com",
	"bnr.la",
	"bitbucket.io",
	"blackbaudcdn.net",
	"of.je",
	"bluebite.io",
	"boomla.net",
	"boutir.com",
	"boxfuse.io",
	"square7.ch",
	"bplaced.com",
	"bplaced.de",
	"square7.de",
	"bplaced.net",
	"square7.net",
	"shop.brendly.rs",
	"browsersafetymark.io",
	"uk0.bigv.io",
	"dh.bytemark.co.uk",
	"vm.bytemark.co.uk",
	"cafjs.com",
	"mycd.eu",
	"drr.ac",
	"uwu.ai",
	"carrd.co",
	"crd.co",
	"ju.mp",
	"ae.org",
	"br.com",
	"cn.com",
	"com.de",
	"com.se",
	"de.com",
	"eu.com",
	"gb.net",
	"hu.net",
	"jp.net",
	"jpn.com",
	"mex.com",
	"ru.com",
	"sa.com",
	"se.net",
	"uk.com",
	"uk.net",
	"us.com",
	"za.bz",
	"za.com",
	"ar.com",
	"hu.com",
	"kr.com",
	"no.com",
	"qc.com",
	"uy.com",
	"africa.com",
	"gr.com",
	"in.net",
	"web.in",
	"us.org",
	"co.com",
	"aus.basketball",
	"nz.basketball",
	"radio.am",
	"radio.fm",
	"c.la",
	"certmgr.org",
	"cx.ua",
	"discourse.group",
	"discourse.team",
	"cleverapps.io",
	"clerk.app",
	"clerkstage.app",
	"*.lcl.dev",
	"*.lclstage.dev",
	"*.stg.dev",
	"*.stgstage.dev",
	"clickrising.net",
	"c66.me",
	"cloud66.ws",
	"cloud66.zone",
	"jdevcloud.com",
	"wpdevcloud.com",
	"cloudaccess.host",
	"freesite.host",
	"cloudaccess.net",
	"cloudcontrolled.com",
	"cloudcontrolapp.com",
	"*.cloudera.site",
	"pages.dev",
	"trycloudflare.com",
	"workers.dev",
	"wnext.app",
	"co.ca",
	"*.otap.co",
	"co.cz",
	"c.cdn77.org",
	"cdn77-ssl.net",
	"r.cdn77.net",
	"rsc.cdn77.org",
	"ssl.origin.cdn77-secure.org",
	"cloudns.asia",
	"cloudns.biz",
	"cloudns.club",
	"cloudns.cc",
	"cloudns.eu",
	"cloudns.in",
	"cloudns.info",
	"cloudns.org",
	"cloudns.pro",
	"cloudns.pw",
	"cloudns.us",
	"cnpy.gdn",
	"codeberg.page",
	"co.nl",
	"co.no",
	"webhosting.be",
	"hosting-cluster.nl",
	"ac.ru",
	"edu.ru",
	"gov.ru",
	"int.ru",
	"mil.ru",
	"test.ru",
	"dyn.cosidns.de",
	"dynamisches-dns.de",
	"dnsupdater.de",
	"internet-dns.de",
	"l-o-g-i-n.de",
	"dynamic-dns.info",
	"feste-ip.net",
	"knx-server.net",
	"static-access.net",
	"realm.cz",
	"*.cryptonomic.net",
	"cupcake.is",
	"curv.dev",
	"*.customer-oci.com",
	"*.oci.customer-oci.com",
	"*.ocp.customer-oci.com",
	"*.ocs.customer-oci.com",
	"cyon.link",
	"cyon.site",
	"fnwk.site",
	"folionetwork.site",
	"platform0.app",
	"daplie.me",
	"localhost.daplie.me",
	"dattolocal.com",
	"dattorelay.com",
	"dattoweb.com",
	"mydatto.com",
	"dattolocal.net",
	"mydatto.net",
	"biz.dk",
	"co.dk",
	"firm.dk",
	"reg.dk",
	"store.dk",
	"dyndns.dappnode.io",
	"*.dapps.earth",
	"*.bzz.dapps.earth",
	"builtwithdark.com",
	"demo.datadetect.com",
	"instance.datadetect.com",
	"edgestack.me",
	"ddns5.com",
	"debian.net",
	"deno.dev",
	"deno-staging.dev",
	"dedyn.io",
	"deta.app",
	"deta.dev",
	"*.rss.my.id",
	"*.diher.solutions",
	"discordsays.com",
	"discordsez.com",
	"jozi.biz",
	"dnshome.de",
	"online.th",
	"shop.th",
	"drayddns.com",
	"shoparena.pl",
	"dreamhosters.com",
	"mydrobo.com",
	"drud.io",
	"drud.us",
	"duckdns.org",
	"bip.sh",
	"bitbridge.net",
	"dy.fi",
	"tunk.org",
	"dyndns-at-home.com",
	"dyndns-at-work.com",
	"dyndns-blog.com",
	"dyndns-free.com",
	"dyndns-home.com",
	"dyndns-ip.com",
	"dyndns-mail.com",
	"dyndns-office.com",
	"dyndns-pics.com",
	"dyndns-remote.com",
	"dyndns-server.com",
	"dyndns-web.com",
	"dyndns-wiki.com",
	"dyndns-work.com",
	"dyndns.biz",
	"dyndns.info",
	"dyndns.org",
	"dyndns.tv",
	"at-band-camp.net",
	"ath.cx",
	"barrel-of-knowledge.info",
	"barrell-of-knowledge.info",
	"better-than.tv",
	"blogdns.com",
	"blogdns.net",
	"blogdns.org",
	"blogsite.org",
	"boldlygoingnowhere.org",
	"broke-it.net",
	"buyshouses.net",
	"cechire.com",
	"dnsalias.com",
	"dnsalias.net",
	"dnsalias.org",
	"dnsdojo.com",
	"dnsdojo.net",
	"dnsdojo.org",
	"does-it.net",
	"doesntexist.com",
	"doesntexist.org",
	"dontexist.com",
	"dontexist.net",
	"dontexist.org",
	"doomdns.com",
	"doomdns.org",
	"dvrdns.org",
	"dyn-o-saur.com",
	"dynalias.com",
	"dynalias.net",
	"dynalias.org",
	"dynathome.net",
	"dyndns.ws",
	"endofinternet.net",
	"endofinternet.org",
	"endoftheinternet.org",
	"est-a-la-maison.com",
	"est-a-la-masion.com",
	"est-le-patron.com",
	"est-mon-blogueur.com",
	"for-better.biz",
	"for-more.biz",
	"for-our.info",
	"for-some.biz",
	"for-the.biz",
	"forgot.her.name",
	"forgot.his.name",
	"from-ak.com",
	"from-al.com",
	"from-ar.com",
	"from-az.net",
	"from-ca.com",
	"from-co.net",
	"from-ct.com",
	"from-dc.com",
	"from-de.com",
	"from-fl.com",
	"from-ga.com",
	"from-hi.com",
	"from-ia.com",
	"from-id.com",
	"from-il.com",
	"from-in.com",
	"from-ks.com",
	"from-ky.com",
	"from-la.net",
	"from-ma.com",
	"from-md.com",
	"from-me.org",
	"from-mi.com",
	"from-mn.com",
	"from-mo.com",
	"from-ms.com",
	"from-mt.com",
	"from-nc.com",
	"from-nd.com",
	"from-ne.com",
	"from-nh.com",
	"from-nj.com",
	"from-nm.com",
	"from-nv.com",
	"from-ny.net",
	"from-oh.com",
	"from-ok.com",
	"from-or.com",
	"from-pa.com",
	"from-pr.com",
	"from-ri.com",
	"from-sc.com",
	"from-sd.com",
	"from-tn.com",
	"from-tx.com",
	"from-ut.com",
	"from-va.com",
	"from-vt.com",
	"from-wa.com",
	"from-wi.com",
	"from-wv.com",
	"from-wy.com",
	"ftpaccess.cc",
	"fuettertdasnetz.de",
	"game-host.org",
	"game-server.cc",
	"getmyip.com",
	"gets-it.net",
	"go.dyndns.org",
	"gotdns.com",
	"gotdns.org",
	"groks-the.info",
	"groks-this.info",
	"ham-radio-op.net",
	"here-for-more.info",
	"hobby-site.com",
	"hobby-site.org",
	"home.dyndns.org",
	"homedns.org",
	"homeftp.net",
	"homeftp.org",
	"homeip.net",
	"homelinux.com",
	"homelinux.net",
	"homelinux.org",
	"homeunix.com",
	"homeunix.net",
	"homeunix.org",
	"iamallama.com",
	"in-the-band.net",
	"is-a-anarchist.com",
	"is-a-blogger.com",
	"is-a-bookkeeper.com",
	"is-a-bruinsfan.org",
	"is-a-bulls-fan.com",
	"is-a-candidate.org",
	"is-a-caterer.com",
	"is-a-celticsfan.org",
	"is-a-chef.com",
	"is-a-chef.net",
	"is-a-chef.org",
	"is-a-conservative.com",
	"is-a-cpa.com",
	"is-a-cubicle-slave.com",
	"is-a-democrat.com",
	"is-a-designer.com",
	"is-a-doctor.com",
	"is-a-financialadvisor.com",
	"is-a-geek.com",
	"is-a-geek.net",
	"is-a-geek.org",
	"is-a-green.com",
	"is-a-guru.com",
	"is-a-hard-worker.com",
	"is-a-hunter.com",
	"is-a-knight.org",
	"is-a-landscaper.com",
	"is-a-lawyer.com",
	"is-a-liberal.com",
	"is-a-libertarian.com",
	"is-a-linux-user.org",
	"is-a-llama.com",
	"is-a-musician.com",
	"is-a-nascarfan.com",
	"is-a-nurse.com",
	"is-a-painter.com",
	"is-a-patsfan.org",
	"is-a-personaltrainer.com",
	"is-a-photographer.com",
	"is-a-player.com",
	"is-a-republican.com",
	"is-a-rockstar.com",
	"is-a-socialist.com",
	"is-a-soxfan.org",
	"is-a-student.com",
	"is-a-teacher.com",
	"is-a-techie.com",
	"is-a-therapist.com",
	"is-an-accountant.com",
	"is-an-actor.com",
	"is-an-actress.com",
	"is-an-anarchist.com",
	"is-an-artist.com",
	"is-an-engineer.com",
	"is-an-entertainer.com",
	"is-by.us",
	"is-certified.com",
	"is-found.org",
	"is-gone.com",
	"is-into-anime.com",
	"is-into-cars.com",
	"is-into-cartoons.com",
	"is-into-games.com",
	"is-leet.com",
	"is-lost.org",
	"is-not-certified.com",
	"is-saved.org",
	"is-slick.com",
	"is-uberleet.com",
	"is-very-bad.org",
	"is-very-evil.org",
	"is-very-good.org",
	"is-very-nice.org",
	"is-very-sweet.org",
	"is-with-theband.com",
	"isa-geek.com",
	"isa-geek.net",
	"isa-geek.org",
	"isa-hockeynut.com",
	"issmarterthanyou.com",
	"isteingeek.de",
	"istmein.de",
	"kicks-ass.net",
	"kicks-ass.org",
	"knowsitall.info",
	"land-4-sale.us",
	"lebtimnetz.de",
	"leitungsen.de",
	"likes-pie.com",
	"likescandy.com",
	"merseine.nu",
	"mine.nu",
	"misconfused.org",
	"mypets.ws",
	"myphotos.cc",
	"neat-url.com",
	"office-on-the.net",
	"on-the-web.tv",
	"podzone.net",
	"podzone.org",
	"readmyblog.org",
	"saves-the-whales.com",
	"scrapper-site.net",
	"scrapping.cc",
	"selfip.biz",
	"selfip.com",
	"selfip.info",
	"selfip.net",
	"selfip.org",
	"sells-for-less.com",
	"sells-for-u.com",
	"sells-it.net",
	"sellsyourhome.org",
	"servebbs.com",
	"servebbs.net",
	"servebbs.org",
	"serveftp.net",
	"serveftp.org",
	"servegame.org",
	"shacknet.nu",
	"simple-url.com",
	"space-to-rent.com",
	"stuff-4-sale.org",
	"stuff-4-sale.us",
	"teaches-yoga.com",
	"thruhere.net",
	"traeumtgerade.de",
	"webhop.biz",
	"webhop.info",
	"webhop.net",
	"webhop.org",
	"worse-than.tv",
	"writesthisblog.com",
	"ddnss.de",
	"dyn.ddnss.de",
	"dyndns.ddnss.de",
	"dyndns1.de",
	"dyn-ip24.de",
	"home-webserver.de",
	"dyn.home-webserver.de",
	"myhome-server.de",
	"ddnss.org",
	"definima.net",
	"definima.io",
	"ondigitalocean.app",
	"*.digitaloceanspaces.com",
	"bci.dnstrace.pro",
	"ddnsfree.com",
	"ddnsgeek.com",
	"giize.com",
	"gleeze.com",
	"kozow.com",
	"loseyourip.com",
	"ooguy.com",
	"theworkpc.com",
	"casacam.net",
	"dynu.net",
	"accesscam.org",
	"camdvr.org",
	"freeddns.org",
	"mywire.org",
	"webredirect.org",
	"myddns.rocks",
	"blogsite.xyz",
	"dynv6.net",
	"e4.cz",
	"eero.online",
	"eero-stage.online",
	"elementor.cloud",
	"elementor.cool",
	"en-root.fr",
	"mytuleap.com",
	"tuleap-partners.com",
	"encr.app",
	"encoreapi.com",
	"onred.one",
	"staging.onred.one",
	"eu.encoway.cloud",
	"eu.org",
	"al.eu.org",
	"asso.eu.org",
	"at.eu.org",
	"au.eu.org",
	"be.eu.org",
	"bg.eu.org",
	"ca.eu.org",
	"cd.eu.org",
	"ch.eu.org",
	"cn.eu.org",
	"cy.eu.org",
	"cz.eu.org",
	"de.eu.org",
	"dk.eu.org",
	"edu.eu.org",
	"ee.eu.org",
	"es.eu.org",
	"fi.eu.org",
	"fr.eu.org",
	"gr.eu.org",
	"hr.eu.org",
	"hu.eu.org",
	"ie.eu.org",
	"il.eu.org",
	"in.eu.org",
	"int.eu.org",
	"is.eu.org",
	"it.eu.org",
	"jp.eu.org",
	"kr.eu.org",
	"lt.eu.org",
	"lu.eu.org",
	"lv.eu.org",
	"mc.eu.org",
	"me.eu.org",
	"mk.eu.org",
	"mt.eu.org",
	"my.eu.org",
	"net.eu.org",
	"ng.eu.org",
	"nl.eu.org",
	"no.eu.org",
	"nz.eu.org",
	"paris.eu.org",
	"pl.eu.org",
	"pt.eu.org",
	"q-a.eu.org",
	"ro.eu.org",
	"ru.eu.org",
	"se.eu.org",
	"si.eu.org",
	"sk.eu.org",
	"tr.eu.org",
	"uk.eu.org",
	"us.eu.org",
	"eurodir.ru",
	"eu-1.evennode.com",
	"eu-2.evennode.com",
	"eu-3.evennode.com",
	"eu-4.evennode.com",
	"us-1.evennode.com",
	"us-2.evennode.com",
	"us-3.evennode.com",
	"us-4.evennode.com",
	"twmail.cc",
	"twmail.net",
	"twmail.org",
	"mymailer.com.tw",
	"url.tw",
	"onfabrica.com",
	"apps.fbsbx.com",
	"ru.net",
	"adygeya.ru",
	"bashkiria.ru",
	"bir.ru",
	"cbg.ru",
	"com.ru",
	"dagestan.ru",
	"grozny.ru",
	"kalmykia.ru",
	"kustanai.ru",
	"marine.ru",
	"mordovia.ru",
	"msk.ru",
	"mytis.ru",
	"nalchik.ru",
	"nov.ru",
	"pyatigorsk.ru",
	"spb.ru",
	"vladikavkaz.ru",
	"vladimir.ru",
	"abkhazia.su",
	"adygeya.su",
	"aktyubinsk.su",
	"arkhangelsk.su",
	"armenia.su",
	"ashgabad.su",
	"azerbaijan.su",
	"balashov.su",
	"bashkiria.su",
	"bryansk.su",
	"bukhara.su",
	"chimkent.su",
	"dagestan.su",
	"east-kazakhstan.su",
	"exnet.su",
	"georgia.su",
	"grozny.su",
	"ivanovo.su",
	"jambyl.su",
	"kalmykia.su",
	"kaluga.su",
	"karacol.su",
	"karaganda.su",
	"karelia.su",
	"khakassia.su",
	"krasnodar.su",
	"kurgan.su",
	"kustanai.su",
	"lenug.su",
	"mangyshlak.su",
	"mordovia.su",
	"msk.su",
	"murmansk.su",
	"nalchik.su",
	"navoi.su",
	"north-kazakhstan.su",
	"nov.su",
	"obninsk.su",
	"penza.su",
	"pokrovsk.su",
	"sochi.su",
	"spb.su",
	"tashkent.su",
	"termez.su",
	"togliatti.su",
	"troitsk.su",
	"tselinograd.su",
	"tula.su",
	"tuva.su",
	"vladikavkaz.su",
	"vladimir.su",
	"vologda.su",
	"channelsdvr.net",
	"u.channelsdvr.net",
	"edgecompute.app",
	"fastly-terrarium.com",
	"fastlylb.net",
	"map.fastlylb.net",
	"freetls.fastly.net",
	"map.fastly.net",
	"a.prod.fastly.net",
	"global.prod.fastly.net",
	"a.ssl.fastly.net",
	"b.ssl.fastly.net",
	"global.ssl.fastly.net",
	"fastvps-server.com",
	"fastvps.host",
	"myfast.host",
	"fastvps.site",
	"myfast.space",
	"fedorainfracloud.org",
	"fedorapeople.org",
	"cloud.fedoraproject.org",
	"app.os.fedoraproject.org",
	"app.os.stg.fedoraproject.org",
	"conn.uk",
	"copro.uk",
	"hosp.uk",
	"mydobiss.com",
	"fh-muenster.io",
	"filegear.me",
	"filegear-au.me",
	"filegear-de.me",
	"filegear-gb.me",
	"filegear-ie.me",
	"filegear-jp.me",
	"filegear-sg.me",
	"firebaseapp.com",
	"fireweb.app",
	"flap.id",
	"onflashdrive.app",
	"fldrv.com",
	"fly.dev",
	"edgeapp.net",
	"shw.io",
	"flynnhosting.net",
	"forgeblocks.com",
	"id.forgerock.io",
	"framer.app",
	"framercanvas.com",
	"*.frusky.de",
	"ravpage.co.il",
	"0e.vc",
	"freebox-os.com",
	"freeboxos.com",
	"fbx-os.fr",
	"fbxos.fr",
	"freebox-os.fr",
	"freeboxos.fr",
	"freedesktop.org",
	"freemyip.com",
	"wien.funkfeuer.at",
	"*.futurecms.at",
	"*.ex.futurecms.at",
	"*.in.futurecms.at",
	"futurehosting.at",
	"futuremailing.at",
	"*.ex.ortsinfo.at",
	"*.kunden.ortsinfo.at",
	"*.statics.cloud",
	"independent-commission.uk",
	"independent-inquest.uk",
	"independent-inquiry.uk",
	"independent-panel.uk",
	"independent-review.uk",
	"public-inquiry.uk",
	"royal-commission.uk",
	"campaign.gov.uk",
	"service.gov.uk",
	"api.gov.uk",
	"gehirn.ne.jp",
	"usercontent.jp",
	"gentapps.com",
	"gentlentapis.com",
	"lab.ms",
	"cdn-edges.net",
	"ghost.io",
	"gsj.bz",
	"githubusercontent.com",
	"githubpreview.dev",
	"github.io",
	"gitlab.io",
	"gitapp.si",
	"gitpage.si",
	"glitch.me",
	"nog.community",
	"co.ro",
	"shop.ro",
	"lolipop.io",
	"angry.jp",
	"babyblue.jp",
	"babymilk.jp",
	"backdrop.jp",
	"bambina.jp",
	"bitter.jp",
	"blush.jp",
	"boo.jp",
	"boy.jp",
	"boyfriend.jp",
	"but.jp",
	"candypop.jp",
	"capoo.jp",
	"catfood.jp",
	"cheap.jp",
	"chicappa.jp",
	"chillout.jp",
	"chips.jp",
	"chowder.jp",
	"chu.jp",
	"ciao.jp",
	"cocotte.jp",
	"coolblog.jp",
	"cranky.jp",
	"cutegirl.jp",
	"daa.jp",
	"deca.jp",
	"deci.jp",
	"digick.jp",
	"egoism.jp",
	"fakefur.jp",
	"fem.jp",
	"flier.jp",
	"floppy.jp",
	"fool.jp",
	"frenchkiss.jp",
	"girlfriend.jp",
	"girly.jp",
	"gloomy.jp",
	"gonna.jp",
	"greater.jp",
	"hacca.jp",
	"heavy.jp",
	"her.jp",
	"hiho.jp",
	"hippy.jp",
	"holy.jp",
	"hungry.jp",
	"icurus.jp",
	"itigo.jp",
	"jellybean.jp",
	"kikirara.jp",
	"kill.jp",
	"kilo.jp",
	"kuron.jp",
	"littlestar.jp",
	"lolipopmc.jp",
	"lolitapunk.jp",
	"lomo.jp",
	"lovepop.jp",
	"lovesick.jp",
	"main.jp",
	"mods.jp",
	"mond.jp",
	"mongolian.jp",
	"moo.jp",
	"namaste.jp",
	"nikita.jp",
	"nobushi.jp",
	"noor.jp",
	"oops.jp",
	"parallel.jp",
	"parasite.jp",
	"pecori.jp",
	"peewee.jp",
	"penne.jp",
	"pepper.jp",
	"perma.jp",
	"pigboat.jp",
	"pinoko.jp",
	"punyu.jp",
	"pupu.jp",
	"pussycat.jp",
	"pya.jp",
	"raindrop.jp",
	"readymade.jp",
	"sadist.jp",
	"schoolbus.jp",
	"secret.jp",
	"staba.jp",
	"stripper.jp",
	"sub.jp",
	"sunnyday.jp",
	"thick.jp",
	"tonkotsu.jp",
	"under.jp",
	"upper.jp",
	"velvet.jp",
	"verse.jp",
	"versus.jp",
	"vivian.jp",
	"watson.jp",
	"weblike.jp",
	"whitesnow.jp",
	"zombie.jp",
	"heteml.net",
	"cloudapps.digital",
	"london.cloudapps.digital",
	"pymnt.uk",
	"homeoffice.gov.uk",
	"ro.im",
	"goip.de",
	"run.app",
	"a.run.app",
	"web.app",
	"*.0emm.com",
	"appspot.com",
	"*.r.appspot.com",
	"codespot.com",
	"googleapis.com",
	"googlecode.com",
	"pagespeedmobilizer.com",
	"publishproxy.com",
	"withgoogle.com",
	"withyoutube.com",
	"*.gateway.dev",
	"cloud.goog",
	"translate.goog",
	"*.usercontent.goog",
	"cloudfunctions.net",
	"blogspot.ae",
	"blogspot.al",
	"blogspot.am",
	"blogspot.ba",
	"blogspot.be",
	"blogspot.bg",
	"blogspot.bj",
	"blogspot.ca",
	"blogspot.cf",
	"blogspot.ch",
	"blogspot.cl",
	"blogspot.co.at",
	"blogspot.co.id",
	"blogspot.co.il",
	"blogspot.co.ke",
	"blogspot.co.nz",
	"blogspot.co.uk",
	"blogspot.co.za",
	"blogspot.com",
	"blogspot.com.ar",
	"blogspot.com.au",
	"blogspot.com.br",
	"blogspot.com.by",
	"blogspot.com.co",
	"blogspot.com.cy",
	"blogspot.com.ee",
	"blogspot.com.eg",
	"blogspot.com.es",
	"blogspot.com.mt",
	"blogspot.com.ng",
	"blogspot.com.tr",
	"blogspot.com.uy",
	"blogspot.cv",
	"blogspot.cz",
	"blogspot.de",
	"blogspot.dk",
	"blogspot.fi",
	"blogspot.fr",
	"blogspot.gr",
	"blogspot.hk",
	"blogspot.hr",
	"blogspot.hu",
	"blogspot.ie",
	"blogspot.in",
	"blogspot.is",
	"blogspot.it",
	"blogspot.jp",
	"blogspot.kr",
	"blogspot.li",
	"blogspot.lt",
	"blogspot.lu",
	"blogspot.md",
	"blogspot.mk",
	"blogspot.mr",
	"blogspot.mx",
	"blogspot.my",
	"blogspot.nl",
	"blogspot.no",
	"blogspot.pe",
	"blogspot.pt",
	"blogspot.qa",
	"blogspot.re",
	"blogspot.ro",
	"blogspot.rs",
	"blogspot.ru",
	"blogspot.se",
	"blogspot.sg",
	"blogspot.si",
	"blogspot.sk",
	"blogspot.sn",
	"blogspot.td",
	"blogspot.tw",
	"blogspot.ug",
	"blogspot.vn",
	"goupile.fr",
	"gov.nl",
	"awsmppl.com",
	"günstigbestellen.de",
	"günstigliefern.de",
	"fin.ci",
	"free.hr",
	"caa.li",
	"ua.rs",
	"conf.se",
	"hs.zone",
	"hs.run",
	"hashbang.sh",
	"hasura.app",
	"hasura-app.io",
	"pages.it.hs-heilbronn.de",
	"hepforge.org",
	"herokuapp.com",
	"herokussl.com",
	"ravendb.cloud",
	"myravendb.com",
	"ravendb.community",
	"ravendb.me",
	"development.run",
	"ravendb.run",
	"homesklep.pl",
	"secaas.hk",
	"hoplix.shop",
	"orx.biz",
	"biz.gl",
	"col.ng",
	"firm.ng",
	"gen.ng",
	"ltd.ng",
	"ngo.ng",
	"edu.scot",
	"sch.so",
	"hostyhosting.io",
	"häkkinen.fi",
	"*.moonscale.io",
	"moonscale.net",
	"iki.fi",
	"ibxos.it",
	"iliadboxos.it",
	"impertrixcdn.com",
	"impertrix.com",
	"smushcdn.com",
	"wphostedmail.com",
	"wpmucdn.com",
	"tempurl.host",
	"wpmudev.host",
	"dyn-berlin.de",
	"in-berlin.de",
	"in-brb.de",
	"in-butter.de",
	"in-dsl.de",
	"in-dsl.net",
	"in-dsl.org",
	"in-vpn.de",
	"in-vpn.net",
	"in-vpn.org",
	"biz.at",
	"info.at",
	"info.cx",
	"ac.leg.br",
	"al.leg.br",
	"am.leg.br",
	"ap.leg.br",
	"ba.leg.br",
	"ce.leg.br",
	"df.leg.br",
	"es.leg.br",
	"go.leg.br",
	"ma.leg.br",
	"mg.leg.br",
	"ms.leg.br",
	"mt.leg.br",
	"pa.leg.br",
	"pb.leg.br",
	"pe.leg.br",
	"pi.leg.br",
	"pr.leg.br",
	"rj.leg.br",
	"rn.leg.br",
	"ro.leg.br",
	"rr.leg.br",
	"rs.leg.br",
	"sc.leg.br",
	"se.leg.br",
	"sp.leg.br",
	"to.leg.br",
	"pixolino.com",
	"na4u.ru",
	"iopsys.se",
	"ipifony.net",
	"iservschule.de",
	"mein-iserv.de",
	"schulplattform.de",
	"schulserver.de",
	"test-iserv.de",
	"iserv.dev",
	"iobb.net",
	"mel.cloudlets.com.au",
	"cloud.interhostsolutions.be",
	"users.scale.virtualcloud.com.br",
	"mycloud.by",
	"alp1.ae.flow.ch",
	"appengine.flow.ch",
	"es-1.axarnet.cloud",
	"diadem.cloud",
	"vip.jelastic.cloud",
	"jele.cloud",
	"it1.eur.aruba.jenv-aruba.cloud",
	"it1.jenv-aruba.cloud",
	"keliweb.cloud",
	"cs.keliweb.cloud",
	"oxa.cloud",
	"tn.oxa.cloud",
	"uk.oxa.cloud",
	"primetel.cloud",
	"uk.primetel.cloud",
	"ca.reclaim.cloud",
	"uk.reclaim.cloud",
	"us.reclaim.cloud",
	"ch.trendhosting.cloud",
	"de.trendhosting.cloud",
	"jele.club",
	"amscompute.com",
	"clicketcloud.com",
	"dopaas.com",
	"hidora.com",
	"paas.hosted-by-previder.com",
	"rag-cloud.hosteur.com",
	"rag-cloud-ch.hosteur.com",
	"jcloud.ik-server.com",
	"jcloud-ver-jpc.ik-server.com",
	"demo.jelastic.com",
	"kilatiron.com",
	"paas.massivegrid.com",
	"jed.wafaicloud.com",
	"lon.wafaicloud.com",
	"ryd.wafaicloud.com",
	"j.scaleforce.com.cy",
	"jelastic.dogado.eu",
	"fi.cloudplatform.fi",
	"demo.datacenter.fi",
	"paas.datacenter.fi",
	"jele.host",
	"mircloud.host",
	"paas.beebyte.io",
	"sekd1.beebyteapp.io",
	"jele.io",
	"cloud-fr1.unispace.io",
	"jc.neen.it",
	"cloud.jelastic.open.tim.it",
	"jcloud.kz",
	"upaas.kazteleport.kz",
	"cloudjiffy.net",
	"fra1-de.cloudjiffy.net",
	"west1-us.cloudjiffy.net",
	"jls-sto1.elastx.net",
	"jls-sto2.elastx.net",
	"jls-sto3.elastx.net",
	"faststacks.net",
	"fr-1.paas.massivegrid.net",
	"lon-1.paas.massivegrid.net",
	"lon-2.paas.massivegrid.net",
	"ny-1.paas.massivegrid.net",
	"ny-2.paas.massivegrid.net",
	"sg-1.paas.massivegrid.net",
	"jelastic.saveincloud.net",
	"nordeste-idc.saveincloud.net",
	"j.scaleforce.net",
	"jelastic.tsukaeru.net",
	"sdscloud.pl",
	"unicloud.pl",
	"mircloud.ru",
	"jelastic.regruhosting.ru",
	"enscaled.sg",
	"jele.site",
	"jelastic.team",
	"orangecloud.tn",
	"j.layershift.co.uk",
	"phx.enscaled.us",
	"mircloud.us",
	"myjino.ru",
	"*.hosting.myjino.ru",
	"*.landing.myjino.ru",
	"*.spectrum.myjino.ru",
	"*.vps.myjino.ru",
	"jotelulu.cloud",
	"*.triton.zone",
	"*.cns.joyent.com",
	"js.org",
	"kaas.gg",
	"khplay.nl",
	"ktistory.com",
	"kapsi.fi",
	"keymachine.de",
	"kinghost.net",
	"uni5.net",
	"knightpoint.systems",
	"koobin.events",
	"oya.to",
	"kuleuven.cloud",
	"ezproxy.kuleuven.be",
	"co.krd",
	"edu.krd",
	"krellian.net",
	"webthings.io",
	"git-repos.de",
	"lcube-server.de",
	"svn-repos.de",
	"leadpages.co",
	"lpages.co",
	"lpusercontent.com",
	"lelux.site",
	"co.business",
	"co.education",
	"co.events",
	"co.financial",
	"co.network",
	"co.place",
	"co.technology",
	"app.lmpm.com",
	"linkyard.cloud",
	"linkyard-cloud.ch",
	"members.linode.com",
	"*.nodebalancer.linode.com",
	"*.linodeobjects.com",
	"ip.linodeusercontent.com",
	"we.bs",
	"*.user.localcert.dev",
	"localzone.xyz",
	"loginline.app",
	"loginline.dev",
	"loginline.io",
	"loginline.services",
	"loginline.site",
	"servers.run",
	"lohmus.me",
	"krasnik.pl",
	"leczna.pl",
	"lubartow.pl",
	"lublin.pl",
	"poniatowa.pl",
	"swidnik.pl",
	"glug.org.uk",
	"lug.org.uk",
	"lugs.org.uk",
	"barsy.bg",
	"barsy.co.uk",
	"barsyonline.co.uk",
	"barsycenter.com",
	"barsyonline.com",
	"barsy.club",
	"barsy.de",
	"barsy.eu",
	"barsy.in",
	"barsy.info",
	"barsy.io",
	"barsy.me",
	"barsy.menu",
	"barsy.mobi",
	"barsy.net",
	"barsy.online",
	"barsy.org",
	"barsy.pro",
	"barsy.pub",
	"barsy.ro",
	"barsy.shop",
	"barsy.site",
	"barsy.support",
	"barsy.uk",
	"*.magentosite.cloud",
	"mayfirst.info",
	"mayfirst.org",
	"hb.cldmail.ru",
	"cn.vu",
	"mazeplay.com",
	"mcpe.me",
	"mcdir.me",
	"mcdir.ru",
	"mcpre.ru",
	"vps.mcdir.ru",
	"mediatech.by",
	"mediatech.dev",
	"hra.health",
	"miniserver.com",
	"memset.net",
	"messerli.app",
	"*.cloud.metacentrum.cz",
	"custom.metacentrum.cz",
	"flt.cloud.muni.cz",
	"usr.cloud.muni.cz",
	"meteorapp.com",
	"eu.meteorapp.com",
	"co.pl",
	"*.azurecontainer.io",
	"azurewebsites.net",
	"azure-mobile.net",
	"cloudapp.net",
	"azurestaticapps.net",
	"1.azurestaticapps.net",
	"centralus.azurestaticapps.net",
	"eastasia.azurestaticapps.net",
	"eastus2.azurestaticapps.net",
	"westeurope.azurestaticapps.net",
	"westus2.azurestaticapps.net",
	"csx.cc",
	"mintere.site",
	"forte.id",
	"mozilla-iot.org",
	"bmoattachments.org",
	"net.ru",
	"org.ru",
	"pp.ru",
	"hostedpi.com",
	"customer.mythic-beasts.com",
	"caracal.mythic-beasts.com",
	"fentiger.mythic-beasts.com",
	"lynx.mythic-beasts.com",
	"ocelot.mythic-beasts.com",
	"oncilla.mythic-beasts.com",
	"onza.mythic-beasts.com",
	"sphinx.mythic-beasts.com",
	"vs.mythic-beasts.com",
	"x.mythic-beasts.com",
	"yali.mythic-beasts.com",
	"cust.retrosnub.co.uk",
	"ui.nabu.casa",
	"pony.club",
	"of.fashion",
	"in.london",
	"of.london",
	"from.marketing",
	"with.marketing",
	"for.men",
	"repair.men",
	"and.mom",
	"for.mom",
	"for.one",
	"under.one",
	"for.sale",
	"that.win",
	"from.work",
	"to.work",
	"cloud.nospamproxy.com",
	"netlify.app",
	"4u.com",
	"ngrok.io",
	"nh-serv.co.uk",
	"nfshost.com",
	"*.developer.app",
	"noop.app",
	"*.northflank.app",
	"*.build.run",
	"*.code.run",
	"*.database.run",
	"*.migration.run",
	"noticeable.news",
	"dnsking.ch",
	"mypi.co",
	"n4t.co",
	"001www.com",
	"ddnslive.com",
	"myiphost.com",
	"forumz.info",
	"16-b.it",
	"32-b.it",
	"64-b.it",
	"soundcast.me",
	"tcp4.me",
	"dnsup.net",
	"hicam.net",
	"now-dns.net",
	"ownip.net",
	"vpndns.net",
	"dynserv.org",
	"now-dns.org",
	"x443.pw",
	"now-dns.top",
	"ntdll.top",
	"freeddns.us",
	"crafting.xyz",
	"zapto.xyz",
	"nsupdate.info",
	"nerdpol.ovh",
	"blogsyte.com",
	"brasilia.me",
	"cable-modem.org",
	"ciscofreak.com",
	"collegefan.org",
	"couchpotatofries.org",
	"damnserver.com",
	"ddns.me",
	"ditchyourip.com",
	"dnsfor.me",
	"dnsiskinky.com",
	"dvrcam.info",
	"dynns.com",
	"eating-organic.net",
	"fantasyleague.cc",
	"geekgalaxy.com",
	"golffan.us",
	"health-carereform.com",
	"homesecuritymac.com",
	"homesecuritypc.com",
	"hopto.me",
	"ilovecollege.info",
	"loginto.me",
	"mlbfan.org",
	"mmafan.biz",
	"myactivedirectory.com",
	"mydissent.net",
	"myeffect.net",
	"mymediapc.net",
	"mypsx.net",
	"mysecuritycamera.com",
	"mysecuritycamera.net",
	"mysecuritycamera.org",
	"net-freaks.com",
	"nflfan.org",
	"nhlfan.net",
	"no-ip.ca",
	"no-ip.co.uk",
	"no-ip.net",
	"noip.us",
	"onthewifi.com",
	"pgafan.net",
	"point2this.com",
	"pointto.us",
	"privatizehealthinsurance.net",
	"quicksytes.com",
	"read-books.org",
	"securitytactics.com",
	"serveexchange.com",
	"servehumour.com",
	"servep2p.com",
	"servesarcasm.com",
	"stufftoread.com",
	"ufcfan.org",
	"unusualperson.com",
	"workisboring.com",
	"3utilities.com",
	"bounceme.net",
	"ddns.net",
	"ddnsking.com",
	"gotdns.ch",
	"hopto.org",
	"myftp.biz",
	"myftp.org",
	"myvnc.com",
	"no-ip.biz",
	"no-ip.info",
	"no-ip.org",
	"noip.me",
	"redirectme.net",
	"servebeer.com",
	"serveblog.net",
	"servecounterstrike.com",
	"serveftp.com",
	"servegame.com",
	"servehalflife.com",
	"servehttp.com",
	"serveirc.com",
	"serveminecraft.net",
	"servemp3.com",
	"servepics.com",
	"servequake.com",
	"sytes.net",
	"webhop.me",
	"zapto.org",
	"stage.nodeart.io",
	"pcloud.host",
	"nyc.mn",
	"static.observableusercontent.com",
	"cya.gg",
	"omg.lol",
	"cloudycluster.net",
	"omniwe.site",
	"service.one",
	"nid.io",
	"opensocial.site",
	"opencraft.hosting",
	"orsites.com",
	"operaunite.com",
	"tech.orange",
	"authgear-staging.com",
	"authgearapps.com",
	"skygearapp.com",
	"outsystemscloud.com",
	"*.webpaas.ovh.net",
	"*.hosting.ovh.net",
	"ownprovider.com",
	"own.pm",
	"*.owo.codes",
	"ox.rs",
	"oy.lc",
	"pgfog.com",
	"pagefrontapp.com",
	"pagexl.com",
	"*.paywhirl.com",
	"bar0.net",
	"bar1.net",
	"bar2.net",
	"rdv.to",
	"art.pl",
	"gliwice.pl",
	"krakow.pl",
	"poznan.pl",
	"wroc.pl",
	"zakopane.pl",
	"pantheonsite.io",
	"gotpantheon.com",
	"mypep.link",
	"perspecta.cloud",
	"lk3.ru",
	"on-web.fr",
	"bc.platform.sh",
	"ent.platform.sh",
	"eu.platform.sh",
	"us.platform.sh",
	"*.platformsh.site",
	"*.tst.site",
	"platter-app.com",
	"platter-app.dev",
	"platterp.us",
	"pdns.page",
	"plesk.page",
	"pleskns.com",
	"dyn53.io",
	"onporter.run",
	"co.bn",
	"postman-echo.com",
	"pstmn.io",
	"mock.pstmn.io",
	"httpbin.org",
	"prequalifyme.today",
	"xen.prgmr.com",
	"priv.at",
	"prvcy.page",
	"*.dweb.link",
	"protonet.io",
	"chirurgiens-dentistes-en-france.fr",
	"byen.site",
	"pubtls.org",
	"pythonanywhere.com",
	"eu.pythonanywhere.com",
	"qoto.io",
	"qualifioapp.com",
	"qbuser.com",
	"cloudsite.builders",
	"instances.spawn.cc",
	"instantcloud.cn",
	"ras.ru",
	"qa2.com",
	"qcx.io",
	"*.sys.qcx.io",
	"dev-myqnapcloud.com",
	"alpha-myqnapcloud.com",
	"myqnapcloud.com",
	"*.quipelements.com",
	"vapor.cloud",
	"vaporcloud.io",
	"rackmaze.com",
	"rackmaze.net",
	"g.vbrplsbx.io",
	"*.on-k3s.io",
	"*.on-rancher.cloud",
	"*.on-rio.io",
	"readthedocs.io",
	"rhcloud.com",
	"app.render.com",
	"onrender.com",
	"repl.co",
	"id.repl.co",
	"repl.run",
	"resindevice.io",
	"devices.resinstaging.io",
	"hzc.io",
	"wellbeingzone.eu",
	"wellbeingzone.co.uk",
	"adimo.co.uk",
	"itcouldbewor.se",
	"git-pages.rit.edu",
	"rocky.page",
	"биз.рус",
	"ком.рус",
	"крым.рус",
	"мир.рус",
	"мск.рус",
	"орг.рус",
	"самара.рус",
	"сочи.рус",
	"спб.рус",
	"я.рус",
	"*.builder.code.com",
	"*.dev-builder.code.com",
	"*.stg-builder.code.com",
	"sandcats.io",
	"logoip.de",
	"logoip.com",
	"fr-par-1.baremetal.scw.cloud",
	"fr-par-2.baremetal.scw.cloud",
	"nl-ams-1.baremetal.scw.cloud",
	"fnc.fr-par.scw.cloud",
	"functions.fnc.fr-par.scw.cloud",
	"k8s.fr-par.scw.cloud",
	"nodes.k8s.fr-par.scw.cloud",
	"s3.fr-par.scw.cloud",
	"s3-website.fr-par.scw.cloud",
	"whm.fr-par.scw.cloud",
	"priv.instances.scw.cloud",
	"pub.instances.scw.cloud",
	"k8s.scw.cloud",
	"k8s.nl-ams.scw.cloud",
	"nodes.k8s.nl-ams.scw.cloud",
	"s3.nl-ams.scw.cloud",
	"s3-website.nl-ams.scw.cloud",
	"whm.nl-ams.scw.cloud",
	"k8s.pl-waw.scw.cloud",
	"nodes.k8s.pl-waw.scw.cloud",
	"s3.pl-waw.scw.cloud",
	"s3-website.pl-waw.scw.cloud",
	"scalebook.scw.cloud",
	"smartlabeling.scw.cloud",
	"dedibox.fr",
	"schokokeks.net",
	"gov.scot",
	"service.gov.scot",
	"scrysec.com",
	"firewall-gateway.com",
	"firewall-gateway.de",
	"my-gateway.de",
	"my-router.de",
	"spdns.de",
	"spdns.eu",
	"firewall-gateway.net",
	"my-firewall.org",
	"myfirewall.org",
	"spdns.org",
	"seidat.net",
	"sellfy.store",
	"senseering.net",
	"minisite.ms",
	"magnet.page",
	"biz.ua",
	"co.ua",
	"pp.ua",
	"shiftcrypto.dev",
	"shiftcrypto.io",
	"shiftedit.io",
	"myshopblocks.com",
	"myshopify.com",
	"shopitsite.com",
	"shopware.store",
	"mo-siemens.io",
	"1kapp.com",
	"appchizi.com",
	"applinzi.com",
	"sinaapp.com",
	"vipsinaapp.com",
	"siteleaf.net",
	"bounty-full.com",
	"alpha.bounty-full.com",
	"beta.bounty-full.com",
	"small-web.org",
	"vp4.me",
	"try-snowplow.com",
	"srht.site",
	"stackhero-network.com",
	"musician.io",
	"novecore.site",
	"static.land",
	"dev.static.land",
	"sites.static.land",
	"storebase.store",
	"vps-host.net",
	"atl.jelastic.vps-host.net",
	"njs.jelastic.vps-host.net",
	"ric.jelastic.vps-host.net",
	"playstation-cloud.com",
	"apps.lair.io",
	"*.stolos.io",
	"spacekit.io",
	"customer.speedpartner.de",
	"myspreadshop.at",
	"myspreadshop.com.au",
	"myspreadshop.be",
	"myspreadshop.ca",
	"myspreadshop.ch",
	"myspreadshop.com",
	"myspreadshop.de",
	"myspreadshop.dk",
	"myspreadshop.es",
	"myspreadshop.fi",
	"myspreadshop.fr",
	"myspreadshop.ie",
	"myspreadshop.it",
	"myspreadshop.net",
	"myspreadshop.nl",
	"myspreadshop.no",
	"myspreadshop.pl",
	"myspreadshop.se",
	"myspreadshop.co.uk",
	"api.stdlib.com",
	"storj.farm",
	"utwente.io",
	"soc.srcf.net",
	"user.srcf.net",
	"temp-dns.com",
	"supabase.co",
	"supabase.in",
	"supabase.net",
	"su.paba.se",
	"*.s5y.io",
	"*.sensiosite.cloud",
	"syncloud.it",
	"dscloud.biz",
	"direct.quickconnect.cn",
	"dsmynas.com",
	"familyds.com",
	"diskstation.me",
	"dscloud.me",
	"i234.me",
	"myds.me",
	"synology.me",
	"dscloud.mobi",
	"dsmynas.net",
	"familyds.net",
	"dsmynas.org",
	"familyds.org",
	"vpnplus.to",
	"direct.quickconnect.to",
	"tabitorder.co.il",
	"taifun-dns.de",
	"beta.tailscale.net",
	"ts.net",
	"gda.pl",
	"gdansk.pl",
	"gdynia.pl",
	"med.pl",
	"sopot.pl",
	"site.tb-hosting.com",
	"edugit.io",
	"s3.teckids.org",
	"telebit.app",
	"telebit.io",
	"*.telebit.xyz",
	"gwiddle.co.uk",
	"*.firenet.ch",
	"*.svc.firenet.ch",
	"reservd.com",
	"thingdustdata.com",
	"cust.dev.thingdust.io",
	"cust.disrec.thingdust.io",
	"cust.prod.thingdust.io",
	"cust.testing.thingdust.io",
	"reservd.dev.thingdust.io",
	"reservd.disrec.thingdust.io",
	"reservd.testing.thingdust.io",
	"tickets.io",
	"arvo.network",
	"azimuth.network",
	"tlon.network",
	"torproject.net",
	"pages.torproject.net",
	"bloxcms.com",
	"townnews-staging.com",
	"tbits.me",
	"12hp.at",
	"2ix.at",
	"4lima.at",
	"lima-city.at",
	"12hp.ch",
	"2ix.ch",
	"4lima.ch",
	"lima-city.ch",
	"trafficplex.cloud",
	"de.cool",
	"12hp.de",
	"2ix.de",
	"4lima.de",
	"lima-city.de",
	"1337.pictures",
	"clan.rip",
	"lima-city.rocks",
	"webspace.rocks",
	"lima.zone",
	"*.transurl.be",
	"*.transurl.eu",
	"*.transurl.nl",
	"site.transip.me",
	"tuxfamily.org",
	"dd-dns.de",
	"diskstation.eu",
	"diskstation.org",
	"dray-dns.de",
	"draydns.de",
	"dyn-vpn.de",
	"dynvpn.de",
	"mein-vigor.de",
	"my-vigor.de",
	"my-wan.de",
	"syno-ds.de",
	"synology-diskstation.de",
	"synology-ds.de",
	"typedream.app",
	"pro.typeform.com",
	"uber.space",
	"*.uberspace.de",
	"hk.com",
	"hk.org",
	"ltd.hk",
	"inc.hk",
	"name.pm",
	"sch.tf",
	"biz.wf",
	"sch.wf",
	"org.yt",
	"virtualuser.de",
	"virtual-user.de",
	"upli.io",
	"urown.cloud",
	"dnsupdate.info",
	"lib.de.us",
	"2038.io",
	"vercel.app",
	"vercel.dev",
	"now.sh",
	"router.management",
	"v-info.info",
	"voorloper.cloud",
	"neko.am",
	"nyaa.am",
	"be.ax",
	"cat.ax",
	"es.ax",
	"eu.ax",
	"gg.ax",
	"mc.ax",
	"us.ax",
	"xy.ax",
	"nl.ci",
	"xx.gl",
	"app.gp",
	"blog.gt",
	"de.gt",
	"to.gt",
	"be.gy",
	"cc.hn",
	"blog.kg",
	"io.kg",
	"jp.kg",
	"tv.kg",
	"uk.kg",
	"us.kg",
	"de.ls",
	"at.md",
	"de.md",
	"jp.md",
	"to.md",
	"indie.porn",
	"vxl.sh",
	"ch.tc",
	"me.tc",
	"we.tc",
	"nyan.to",
	"at.vg",
	"blog.vu",
	"dev.vu",
	"me.vu",
	"v.ua",
	"*.vultrobjects.com",
	"wafflecell.com",
	"*.webhare.dev",
	"reserve-online.net",
	"reserve-online.com",
	"bookonline.app",
	"hotelwithflight.com",
	"wedeploy.io",
	"wedeploy.me",
	"wedeploy.sh",
	"remotewd.com",
	"pages.wiardweb.com",
	"wmflabs.org",
	"toolforge.org",
	"wmcloud.org",
	"panel.gg",
	"daemon.panel.gg",
	"messwithdns.com",
	"woltlab-demo.com",
	"myforum.community",
	"community-pro.de",
	"diskussionsbereich.de",
	"community-pro.net",
	"meinforum.net",
	"affinitylottery.org.uk",
	"raffleentry.org.uk",
	"weeklylottery.org.uk",
	"wpenginepowered.com",
	"js.wpenginepowered.com",
	"wixsite.com",
	"editorx.io",
	"half.host",
	"xnbay.com",
	"u2.xnbay.com",
	"u2-local.xnbay.com",
	"cistron.nl",
	"demon.nl",
	"xs4all.space",
	"yandexcloud.net",
	"storage.yandexcloud.net",
	"website.yandexcloud.net",
	"official.academy",
	"yolasite.com",
	"ybo.faith",
	"yombo.me",
	"homelink.one",
	"ybo.party",
	"ybo.review",
	"ybo.science",
	"ybo.trade",
	"ynh.fr",
	"nohost.me",
	"noho.st",
	"za.net",
	"za.org",
	"bss.design",
	"basicserver.io",
	"virtualserver.io",
	"enterprisecloud.nu"
];

/*eslint no-var:0, prefer-arrow-callback: 0, object-shorthand: 0 */

(function (exports) {


	var Punycode = require$$0$1;


	var internals = {};


	//
	// Read rules from file.
	//
	internals.rules = require$$1.map(function (rule) {

	  return {
	    rule: rule,
	    suffix: rule.replace(/^(\*\.|\!)/, ''),
	    punySuffix: -1,
	    wildcard: rule.charAt(0) === '*',
	    exception: rule.charAt(0) === '!'
	  };
	});


	//
	// Check is given string ends with `suffix`.
	//
	internals.endsWith = function (str, suffix) {

	  return str.indexOf(suffix, str.length - suffix.length) !== -1;
	};


	//
	// Find rule for a given domain.
	//
	internals.findRule = function (domain) {

	  var punyDomain = Punycode.toASCII(domain);
	  return internals.rules.reduce(function (memo, rule) {

	    if (rule.punySuffix === -1){
	      rule.punySuffix = Punycode.toASCII(rule.suffix);
	    }
	    if (!internals.endsWith(punyDomain, '.' + rule.punySuffix) && punyDomain !== rule.punySuffix) {
	      return memo;
	    }
	    // This has been commented out as it never seems to run. This is because
	    // sub tlds always appear after their parents and we never find a shorter
	    // match.
	    //if (memo) {
	    //  var memoSuffix = Punycode.toASCII(memo.suffix);
	    //  if (memoSuffix.length >= punySuffix.length) {
	    //    return memo;
	    //  }
	    //}
	    return rule;
	  }, null);
	};


	//
	// Error codes and messages.
	//
	exports.errorCodes = {
	  DOMAIN_TOO_SHORT: 'Domain name too short.',
	  DOMAIN_TOO_LONG: 'Domain name too long. It should be no more than 255 chars.',
	  LABEL_STARTS_WITH_DASH: 'Domain name label can not start with a dash.',
	  LABEL_ENDS_WITH_DASH: 'Domain name label can not end with a dash.',
	  LABEL_TOO_LONG: 'Domain name label should be at most 63 chars long.',
	  LABEL_TOO_SHORT: 'Domain name label should be at least 1 character long.',
	  LABEL_INVALID_CHARS: 'Domain name label can only contain alphanumeric characters or dashes.'
	};


	//
	// Validate domain name and throw if not valid.
	//
	// From wikipedia:
	//
	// Hostnames are composed of series of labels concatenated with dots, as are all
	// domain names. Each label must be between 1 and 63 characters long, and the
	// entire hostname (including the delimiting dots) has a maximum of 255 chars.
	//
	// Allowed chars:
	//
	// * `a-z`
	// * `0-9`
	// * `-` but not as a starting or ending character
	// * `.` as a separator for the textual portions of a domain name
	//
	// * http://en.wikipedia.org/wiki/Domain_name
	// * http://en.wikipedia.org/wiki/Hostname
	//
	internals.validate = function (input) {

	  // Before we can validate we need to take care of IDNs with unicode chars.
	  var ascii = Punycode.toASCII(input);

	  if (ascii.length < 1) {
	    return 'DOMAIN_TOO_SHORT';
	  }
	  if (ascii.length > 255) {
	    return 'DOMAIN_TOO_LONG';
	  }

	  // Check each part's length and allowed chars.
	  var labels = ascii.split('.');
	  var label;

	  for (var i = 0; i < labels.length; ++i) {
	    label = labels[i];
	    if (!label.length) {
	      return 'LABEL_TOO_SHORT';
	    }
	    if (label.length > 63) {
	      return 'LABEL_TOO_LONG';
	    }
	    if (label.charAt(0) === '-') {
	      return 'LABEL_STARTS_WITH_DASH';
	    }
	    if (label.charAt(label.length - 1) === '-') {
	      return 'LABEL_ENDS_WITH_DASH';
	    }
	    if (!/^[a-z0-9\-]+$/.test(label)) {
	      return 'LABEL_INVALID_CHARS';
	    }
	  }
	};


	//
	// Public API
	//


	//
	// Parse domain.
	//
	exports.parse = function (input) {

	  if (typeof input !== 'string') {
	    throw new TypeError('Domain name must be a string.');
	  }

	  // Force domain to lowercase.
	  var domain = input.slice(0).toLowerCase();

	  // Handle FQDN.
	  // TODO: Simply remove trailing dot?
	  if (domain.charAt(domain.length - 1) === '.') {
	    domain = domain.slice(0, domain.length - 1);
	  }

	  // Validate and sanitise input.
	  var error = internals.validate(domain);
	  if (error) {
	    return {
	      input: input,
	      error: {
	        message: exports.errorCodes[error],
	        code: error
	      }
	    };
	  }

	  var parsed = {
	    input: input,
	    tld: null,
	    sld: null,
	    domain: null,
	    subdomain: null,
	    listed: false
	  };

	  var domainParts = domain.split('.');

	  // Non-Internet TLD
	  if (domainParts[domainParts.length - 1] === 'local') {
	    return parsed;
	  }

	  var handlePunycode = function () {

	    if (!/xn--/.test(domain)) {
	      return parsed;
	    }
	    if (parsed.domain) {
	      parsed.domain = Punycode.toASCII(parsed.domain);
	    }
	    if (parsed.subdomain) {
	      parsed.subdomain = Punycode.toASCII(parsed.subdomain);
	    }
	    return parsed;
	  };

	  var rule = internals.findRule(domain);

	  // Unlisted tld.
	  if (!rule) {
	    if (domainParts.length < 2) {
	      return parsed;
	    }
	    parsed.tld = domainParts.pop();
	    parsed.sld = domainParts.pop();
	    parsed.domain = [parsed.sld, parsed.tld].join('.');
	    if (domainParts.length) {
	      parsed.subdomain = domainParts.pop();
	    }
	    return handlePunycode();
	  }

	  // At this point we know the public suffix is listed.
	  parsed.listed = true;

	  var tldParts = rule.suffix.split('.');
	  var privateParts = domainParts.slice(0, domainParts.length - tldParts.length);

	  if (rule.exception) {
	    privateParts.push(tldParts.shift());
	  }

	  parsed.tld = tldParts.join('.');

	  if (!privateParts.length) {
	    return handlePunycode();
	  }

	  if (rule.wildcard) {
	    tldParts.unshift(privateParts.pop());
	    parsed.tld = tldParts.join('.');
	  }

	  if (!privateParts.length) {
	    return handlePunycode();
	  }

	  parsed.sld = privateParts.pop();
	  parsed.domain = [parsed.sld,  parsed.tld].join('.');

	  if (privateParts.length) {
	    parsed.subdomain = privateParts.join('.');
	  }

	  return handlePunycode();
	};


	//
	// Get domain.
	//
	exports.get = function (domain) {

	  if (!domain) {
	    return null;
	  }
	  return exports.parse(domain).domain || null;
	};


	//
	// Check whether domain belongs to a known public suffix.
	//
	exports.isValid = function (domain) {

	  var parsed = exports.parse(domain);
	  return Boolean(parsed.domain && parsed.listed);
	}; 
} (psl$1));

/*!
 * Copyright (c) 2018, Salesforce.com, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of Salesforce.com nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
const psl = psl$1;

// RFC 6761
const SPECIAL_USE_DOMAINS = [
  "local",
  "example",
  "invalid",
  "localhost",
  "test"
];

const SPECIAL_TREATMENT_DOMAINS = ["localhost", "invalid"];

function getPublicSuffix(domain, options = {}) {
  const domainParts = domain.split(".");
  const topLevelDomain = domainParts[domainParts.length - 1];
  const allowSpecialUseDomain = !!options.allowSpecialUseDomain;
  const ignoreError = !!options.ignoreError;

  if (allowSpecialUseDomain && SPECIAL_USE_DOMAINS.includes(topLevelDomain)) {
    if (domainParts.length > 1) {
      const secondLevelDomain = domainParts[domainParts.length - 2];
      // In aforementioned example, the eTLD/pubSuf will be apple.localhost
      return `${secondLevelDomain}.${topLevelDomain}`;
    } else if (SPECIAL_TREATMENT_DOMAINS.includes(topLevelDomain)) {
      // For a single word special use domain, e.g. 'localhost' or 'invalid', per RFC 6761,
      // "Application software MAY recognize {localhost/invalid} names as special, or
      // MAY pass them to name resolution APIs as they would for other domain names."
      return `${topLevelDomain}`;
    }
  }

  if (!ignoreError && SPECIAL_USE_DOMAINS.includes(topLevelDomain)) {
    throw new Error(
      `Cookie has domain set to the public suffix "${topLevelDomain}" which is a special use domain. To allow this, configure your CookieJar with {allowSpecialUseDomain:true, rejectPublicSuffixes: false}.`
    );
  }

  return psl.get(domain);
}

pubsuffixPsl.getPublicSuffix = getPublicSuffix;

var store = {};

/*!
 * Copyright (c) 2015, Salesforce.com, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of Salesforce.com nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
/*jshint unused:false */

class Store$2 {
  constructor() {
    this.synchronous = false;
  }

  findCookie(domain, path, key, cb) {
    throw new Error("findCookie is not implemented");
  }

  findCookies(domain, path, allowSpecialUseDomain, cb) {
    throw new Error("findCookies is not implemented");
  }

  putCookie(cookie, cb) {
    throw new Error("putCookie is not implemented");
  }

  updateCookie(oldCookie, newCookie, cb) {
    // recommended default implementation:
    // return this.putCookie(newCookie, cb);
    throw new Error("updateCookie is not implemented");
  }

  removeCookie(domain, path, key, cb) {
    throw new Error("removeCookie is not implemented");
  }

  removeCookies(domain, path, cb) {
    throw new Error("removeCookies is not implemented");
  }

  removeAllCookies(cb) {
    throw new Error("removeAllCookies is not implemented");
  }

  getAllCookies(cb) {
    throw new Error(
      "getAllCookies is not implemented (therefore jar cannot be serialized)"
    );
  }
}

store.Store = Store$2;

var memstore = {};

var universalify = {};

universalify.fromCallback = function (fn) {
  return Object.defineProperty(function () {
    if (typeof arguments[arguments.length - 1] === 'function') fn.apply(this, arguments);
    else {
      return new Promise((resolve, reject) => {
        arguments[arguments.length] = (err, res) => {
          if (err) return reject(err)
          resolve(res);
        };
        arguments.length++;
        fn.apply(this, arguments);
      })
    }
  }, 'name', { value: fn.name })
};

universalify.fromPromise = function (fn) {
  return Object.defineProperty(function () {
    const cb = arguments[arguments.length - 1];
    if (typeof cb !== 'function') return fn.apply(this, arguments)
    else {
      delete arguments[arguments.length - 1];
      arguments.length--;
      fn.apply(this, arguments).then(r => cb(null, r), cb);
    }
  }, 'name', { value: fn.name })
};

var permuteDomain$1 = {};

/*!
 * Copyright (c) 2015, Salesforce.com, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of Salesforce.com nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

var hasRequiredPermuteDomain;

function requirePermuteDomain () {
	if (hasRequiredPermuteDomain) return permuteDomain$1;
	hasRequiredPermuteDomain = 1;
	const pubsuffix = pubsuffixPsl;

	// Gives the permutation of all possible domainMatch()es of a given domain. The
	// array is in shortest-to-longest order.  Handy for indexing.

	function permuteDomain(domain, allowSpecialUseDomain) {
	  const pubSuf = pubsuffix.getPublicSuffix(domain, {
	    allowSpecialUseDomain: allowSpecialUseDomain
	  });

	  if (!pubSuf) {
	    return null;
	  }
	  if (pubSuf == domain) {
	    return [domain];
	  }

	  // Nuke trailing dot
	  if (domain.slice(-1) == ".") {
	    domain = domain.slice(0, -1);
	  }

	  const prefix = domain.slice(0, -(pubSuf.length + 1)); // ".example.com"
	  const parts = prefix.split(".").reverse();
	  let cur = pubSuf;
	  const permutations = [cur];
	  while (parts.length) {
	    cur = `${parts.shift()}.${cur}`;
	    permutations.push(cur);
	  }
	  return permutations;
	}

	permuteDomain$1.permuteDomain = permuteDomain;
	return permuteDomain$1;
}

var pathMatch$3 = {};

/*!
 * Copyright (c) 2015, Salesforce.com, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of Salesforce.com nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
/*
 * "A request-path path-matches a given cookie-path if at least one of the
 * following conditions holds:"
 */
function pathMatch$2(reqPath, cookiePath) {
  // "o  The cookie-path and the request-path are identical."
  if (cookiePath === reqPath) {
    return true;
  }

  const idx = reqPath.indexOf(cookiePath);
  if (idx === 0) {
    // "o  The cookie-path is a prefix of the request-path, and the last
    // character of the cookie-path is %x2F ("/")."
    if (cookiePath.substr(-1) === "/") {
      return true;
    }

    // " o  The cookie-path is a prefix of the request-path, and the first
    // character of the request-path that is not included in the cookie- path
    // is a %x2F ("/") character."
    if (reqPath.substr(cookiePath.length, 1) === "/") {
      return true;
    }
  }

  return false;
}

pathMatch$3.pathMatch = pathMatch$2;

var utilHelper = {};

function requireUtil() {
  try {
    // eslint-disable-next-line no-restricted-modules
    return require("util");
  } catch (e) {
    return null;
  }
}

// for v10.12.0+
function lookupCustomInspectSymbol() {
  return Symbol.for("nodejs.util.inspect.custom");
}

// for older node environments
function tryReadingCustomSymbolFromUtilInspect(options) {
  const _requireUtil = options.requireUtil || requireUtil;
  const util = _requireUtil();
  return util ? util.inspect.custom : null;
}

utilHelper.getUtilInspect = function getUtilInspect(fallback, options = {}) {
  const _requireUtil = options.requireUtil || requireUtil;
  const util = _requireUtil();
  return function inspect(value, showHidden, depth) {
    return util ? util.inspect(value, showHidden, depth) : fallback(value);
  };
};

utilHelper.getCustomInspectSymbol = function getCustomInspectSymbol(options = {}) {
  const _lookupCustomInspectSymbol =
    options.lookupCustomInspectSymbol || lookupCustomInspectSymbol;

  // get custom inspect symbol for node environments
  return (
    _lookupCustomInspectSymbol() ||
    tryReadingCustomSymbolFromUtilInspect(options)
  );
};

/*!
 * Copyright (c) 2015, Salesforce.com, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of Salesforce.com nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
const { fromCallback: fromCallback$1 } = universalify;
const Store$1 = store.Store;
const permuteDomain = requirePermuteDomain().permuteDomain;
const pathMatch$1 = pathMatch$3.pathMatch;
const { getCustomInspectSymbol: getCustomInspectSymbol$1, getUtilInspect } = utilHelper;

class MemoryCookieStore$1 extends Store$1 {
  constructor() {
    super();
    this.synchronous = true;
    this.idx = Object.create(null);
    const customInspectSymbol = getCustomInspectSymbol$1();
    if (customInspectSymbol) {
      this[customInspectSymbol] = this.inspect;
    }
  }

  inspect() {
    const util = { inspect: getUtilInspect(inspectFallback) };
    return `{ idx: ${util.inspect(this.idx, false, 2)} }`;
  }

  findCookie(domain, path, key, cb) {
    if (!this.idx[domain]) {
      return cb(null, undefined);
    }
    if (!this.idx[domain][path]) {
      return cb(null, undefined);
    }
    return cb(null, this.idx[domain][path][key] || null);
  }
  findCookies(domain, path, allowSpecialUseDomain, cb) {
    const results = [];
    if (typeof allowSpecialUseDomain === "function") {
      cb = allowSpecialUseDomain;
      allowSpecialUseDomain = true;
    }
    if (!domain) {
      return cb(null, []);
    }

    let pathMatcher;
    if (!path) {
      // null means "all paths"
      pathMatcher = function matchAll(domainIndex) {
        for (const curPath in domainIndex) {
          const pathIndex = domainIndex[curPath];
          for (const key in pathIndex) {
            results.push(pathIndex[key]);
          }
        }
      };
    } else {
      pathMatcher = function matchRFC(domainIndex) {
        //NOTE: we should use path-match algorithm from S5.1.4 here
        //(see : https://github.com/ChromiumWebApps/chromium/blob/b3d3b4da8bb94c1b2e061600df106d590fda3620/net/cookies/canonical_cookie.cc#L299)
        Object.keys(domainIndex).forEach(cookiePath => {
          if (pathMatch$1(path, cookiePath)) {
            const pathIndex = domainIndex[cookiePath];
            for (const key in pathIndex) {
              results.push(pathIndex[key]);
            }
          }
        });
      };
    }

    const domains = permuteDomain(domain, allowSpecialUseDomain) || [domain];
    const idx = this.idx;
    domains.forEach(curDomain => {
      const domainIndex = idx[curDomain];
      if (!domainIndex) {
        return;
      }
      pathMatcher(domainIndex);
    });

    cb(null, results);
  }

  putCookie(cookie, cb) {
    if (!this.idx[cookie.domain]) {
      this.idx[cookie.domain] = Object.create(null);
    }
    if (!this.idx[cookie.domain][cookie.path]) {
      this.idx[cookie.domain][cookie.path] = Object.create(null);
    }
    this.idx[cookie.domain][cookie.path][cookie.key] = cookie;
    cb(null);
  }
  updateCookie(oldCookie, newCookie, cb) {
    // updateCookie() may avoid updating cookies that are identical.  For example,
    // lastAccessed may not be important to some stores and an equality
    // comparison could exclude that field.
    this.putCookie(newCookie, cb);
  }
  removeCookie(domain, path, key, cb) {
    if (
      this.idx[domain] &&
      this.idx[domain][path] &&
      this.idx[domain][path][key]
    ) {
      delete this.idx[domain][path][key];
    }
    cb(null);
  }
  removeCookies(domain, path, cb) {
    if (this.idx[domain]) {
      if (path) {
        delete this.idx[domain][path];
      } else {
        delete this.idx[domain];
      }
    }
    return cb(null);
  }
  removeAllCookies(cb) {
    this.idx = Object.create(null);
    return cb(null);
  }
  getAllCookies(cb) {
    const cookies = [];
    const idx = this.idx;

    const domains = Object.keys(idx);
    domains.forEach(domain => {
      const paths = Object.keys(idx[domain]);
      paths.forEach(path => {
        const keys = Object.keys(idx[domain][path]);
        keys.forEach(key => {
          if (key !== null) {
            cookies.push(idx[domain][path][key]);
          }
        });
      });
    });

    // Sort by creationIndex so deserializing retains the creation order.
    // When implementing your own store, this SHOULD retain the order too
    cookies.sort((a, b) => {
      return (a.creationIndex || 0) - (b.creationIndex || 0);
    });

    cb(null, cookies);
  }
}

[
  "findCookie",
  "findCookies",
  "putCookie",
  "updateCookie",
  "removeCookie",
  "removeCookies",
  "removeAllCookies",
  "getAllCookies"
].forEach(name => {
  MemoryCookieStore$1.prototype[name] = fromCallback$1(
    MemoryCookieStore$1.prototype[name]
  );
});

memstore.MemoryCookieStore = MemoryCookieStore$1;

function inspectFallback(val) {
  const domains = Object.keys(val);
  if (domains.length === 0) {
    return "[Object: null prototype] {}";
  }
  let result = "[Object: null prototype] {\n";
  Object.keys(val).forEach((domain, i) => {
    result += formatDomain(domain, val[domain]);
    if (i < domains.length - 1) {
      result += ",";
    }
    result += "\n";
  });
  result += "}";
  return result;
}

function formatDomain(domainName, domainValue) {
  const indent = "  ";
  let result = `${indent}'${domainName}': [Object: null prototype] {\n`;
  Object.keys(domainValue).forEach((path, i, paths) => {
    result += formatPath(path, domainValue[path]);
    if (i < paths.length - 1) {
      result += ",";
    }
    result += "\n";
  });
  result += `${indent}}`;
  return result;
}

function formatPath(pathName, pathValue) {
  const indent = "    ";
  let result = `${indent}'${pathName}': [Object: null prototype] {\n`;
  Object.keys(pathValue).forEach((cookieName, i, cookieNames) => {
    const cookie = pathValue[cookieName];
    result += `      ${cookieName}: ${cookie.inspect()}`;
    if (i < cookieNames.length - 1) {
      result += ",";
    }
    result += "\n";
  });
  result += `${indent}}`;
  return result;
}

memstore.inspectFallback = inspectFallback;

var validators$1 = {};

/* ************************************************************************************
Extracted from check-types.js
https://gitlab.com/philbooth/check-types.js

MIT License

Copyright (c) 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019 Phil Booth

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

************************************************************************************ */

/* Validation functions copied from check-types package - https://www.npmjs.com/package/check-types */
function isFunction(data) {
  return typeof data === "function";
}

function isNonEmptyString(data) {
  return isString(data) && data !== "";
}

function isDate(data) {
  return isInstanceStrict(data, Date) && isInteger(data.getTime());
}

function isEmptyString(data) {
  return data === "" || (data instanceof String && data.toString() === "");
}

function isString(data) {
  return typeof data === "string" || data instanceof String;
}

function isObject(data) {
  return toString.call(data) === "[object Object]";
}
function isInstanceStrict(data, prototype) {
  try {
    return data instanceof prototype;
  } catch (error) {
    return false;
  }
}

function isInteger(data) {
  return typeof data === "number" && data % 1 === 0;
}
/* End validation functions */

function validate(bool, cb, options) {
  if (!isFunction(cb)) {
    options = cb;
    cb = null;
  }
  if (!isObject(options)) options = { Error: "Failed Check" };
  if (!bool) {
    if (cb) {
      cb(new ParameterError(options));
    } else {
      throw new ParameterError(options);
    }
  }
}

class ParameterError extends Error {
  constructor(...params) {
    super(...params);
  }
}

validators$1.ParameterError = ParameterError;
validators$1.isFunction = isFunction;
validators$1.isNonEmptyString = isNonEmptyString;
validators$1.isDate = isDate;
validators$1.isEmptyString = isEmptyString;
validators$1.isString = isString;
validators$1.isObject = isObject;
validators$1.validate = validate;

// generated by genversion
var version = '4.1.3';

/*!
 * Copyright (c) 2015-2020, Salesforce.com, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of Salesforce.com nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
const punycode = require$$0;
const urlParse = urlParse$1;
const pubsuffix = pubsuffixPsl;
const Store = store.Store;
const MemoryCookieStore = memstore.MemoryCookieStore;
const pathMatch = pathMatch$3.pathMatch;
const validators = validators$1;
const VERSION = version;
const { fromCallback } = universalify;
const { getCustomInspectSymbol } = utilHelper;

// From RFC6265 S4.1.1
// note that it excludes \x3B ";"
const COOKIE_OCTETS = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/;

const CONTROL_CHARS = /[\x00-\x1F]/;

// From Chromium // '\r', '\n' and '\0' should be treated as a terminator in
// the "relaxed" mode, see:
// https://github.com/ChromiumWebApps/chromium/blob/b3d3b4da8bb94c1b2e061600df106d590fda3620/net/cookies/parsed_cookie.cc#L60
const TERMINATORS = ["\n", "\r", "\0"];

// RFC6265 S4.1.1 defines path value as 'any CHAR except CTLs or ";"'
// Note ';' is \x3B
const PATH_VALUE = /[\x20-\x3A\x3C-\x7E]+/;

// date-time parsing constants (RFC6265 S5.1.1)

const DATE_DELIM = /[\x09\x20-\x2F\x3B-\x40\x5B-\x60\x7B-\x7E]/;

const MONTH_TO_NUM = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

const MAX_TIME = 2147483647000; // 31-bit max
const MIN_TIME = 0; // 31-bit min
const SAME_SITE_CONTEXT_VAL_ERR =
  'Invalid sameSiteContext option for getCookies(); expected one of "strict", "lax", or "none"';

function checkSameSiteContext(value) {
  validators.validate(validators.isNonEmptyString(value), value);
  const context = String(value).toLowerCase();
  if (context === "none" || context === "lax" || context === "strict") {
    return context;
  } else {
    return null;
  }
}

const PrefixSecurityEnum = Object.freeze({
  SILENT: "silent",
  STRICT: "strict",
  DISABLED: "unsafe-disabled"
});

// Dumped from ip-regex@4.0.0, with the following changes:
// * all capturing groups converted to non-capturing -- "(?:)"
// * support for IPv6 Scoped Literal ("%eth1") removed
// * lowercase hexadecimal only
const IP_REGEX_LOWERCASE = /(?:^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$)|(?:^(?:(?:[a-f\d]{1,4}:){7}(?:[a-f\d]{1,4}|:)|(?:[a-f\d]{1,4}:){6}(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|:[a-f\d]{1,4}|:)|(?:[a-f\d]{1,4}:){5}(?::(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,2}|:)|(?:[a-f\d]{1,4}:){4}(?:(?::[a-f\d]{1,4}){0,1}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,3}|:)|(?:[a-f\d]{1,4}:){3}(?:(?::[a-f\d]{1,4}){0,2}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,4}|:)|(?:[a-f\d]{1,4}:){2}(?:(?::[a-f\d]{1,4}){0,3}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,5}|:)|(?:[a-f\d]{1,4}:){1}(?:(?::[a-f\d]{1,4}){0,4}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,6}|:)|(?::(?:(?::[a-f\d]{1,4}){0,5}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,7}|:)))$)/;
const IP_V6_REGEX = `
\\[?(?:
(?:[a-fA-F\\d]{1,4}:){7}(?:[a-fA-F\\d]{1,4}|:)|
(?:[a-fA-F\\d]{1,4}:){6}(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|:[a-fA-F\\d]{1,4}|:)|
(?:[a-fA-F\\d]{1,4}:){5}(?::(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,2}|:)|
(?:[a-fA-F\\d]{1,4}:){4}(?:(?::[a-fA-F\\d]{1,4}){0,1}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,3}|:)|
(?:[a-fA-F\\d]{1,4}:){3}(?:(?::[a-fA-F\\d]{1,4}){0,2}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,4}|:)|
(?:[a-fA-F\\d]{1,4}:){2}(?:(?::[a-fA-F\\d]{1,4}){0,3}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,5}|:)|
(?:[a-fA-F\\d]{1,4}:){1}(?:(?::[a-fA-F\\d]{1,4}){0,4}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,6}|:)|
(?::(?:(?::[a-fA-F\\d]{1,4}){0,5}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,7}|:))
)(?:%[0-9a-zA-Z]{1,})?\\]?
`
  .replace(/\s*\/\/.*$/gm, "")
  .replace(/\n/g, "")
  .trim();
const IP_V6_REGEX_OBJECT = new RegExp(`^${IP_V6_REGEX}$`);

/*
 * Parses a Natural number (i.e., non-negative integer) with either the
 *    <min>*<max>DIGIT ( non-digit *OCTET )
 * or
 *    <min>*<max>DIGIT
 * grammar (RFC6265 S5.1.1).
 *
 * The "trailingOK" boolean controls if the grammar accepts a
 * "( non-digit *OCTET )" trailer.
 */
function parseDigits(token, minDigits, maxDigits, trailingOK) {
  let count = 0;
  while (count < token.length) {
    const c = token.charCodeAt(count);
    // "non-digit = %x00-2F / %x3A-FF"
    if (c <= 0x2f || c >= 0x3a) {
      break;
    }
    count++;
  }

  // constrain to a minimum and maximum number of digits.
  if (count < minDigits || count > maxDigits) {
    return null;
  }

  if (!trailingOK && count != token.length) {
    return null;
  }

  return parseInt(token.substr(0, count), 10);
}

function parseTime(token) {
  const parts = token.split(":");
  const result = [0, 0, 0];

  /* RF6256 S5.1.1:
   *      time            = hms-time ( non-digit *OCTET )
   *      hms-time        = time-field ":" time-field ":" time-field
   *      time-field      = 1*2DIGIT
   */

  if (parts.length !== 3) {
    return null;
  }

  for (let i = 0; i < 3; i++) {
    // "time-field" must be strictly "1*2DIGIT", HOWEVER, "hms-time" can be
    // followed by "( non-digit *OCTET )" so therefore the last time-field can
    // have a trailer
    const trailingOK = i == 2;
    const num = parseDigits(parts[i], 1, 2, trailingOK);
    if (num === null) {
      return null;
    }
    result[i] = num;
  }

  return result;
}

function parseMonth(token) {
  token = String(token)
    .substr(0, 3)
    .toLowerCase();
  const num = MONTH_TO_NUM[token];
  return num >= 0 ? num : null;
}

/*
 * RFC6265 S5.1.1 date parser (see RFC for full grammar)
 */
function parseDate(str) {
  if (!str) {
    return;
  }

  /* RFC6265 S5.1.1:
   * 2. Process each date-token sequentially in the order the date-tokens
   * appear in the cookie-date
   */
  const tokens = str.split(DATE_DELIM);
  if (!tokens) {
    return;
  }

  let hour = null;
  let minute = null;
  let second = null;
  let dayOfMonth = null;
  let month = null;
  let year = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token.length) {
      continue;
    }

    let result;

    /* 2.1. If the found-time flag is not set and the token matches the time
     * production, set the found-time flag and set the hour- value,
     * minute-value, and second-value to the numbers denoted by the digits in
     * the date-token, respectively.  Skip the remaining sub-steps and continue
     * to the next date-token.
     */
    if (second === null) {
      result = parseTime(token);
      if (result) {
        hour = result[0];
        minute = result[1];
        second = result[2];
        continue;
      }
    }

    /* 2.2. If the found-day-of-month flag is not set and the date-token matches
     * the day-of-month production, set the found-day-of- month flag and set
     * the day-of-month-value to the number denoted by the date-token.  Skip
     * the remaining sub-steps and continue to the next date-token.
     */
    if (dayOfMonth === null) {
      // "day-of-month = 1*2DIGIT ( non-digit *OCTET )"
      result = parseDigits(token, 1, 2, true);
      if (result !== null) {
        dayOfMonth = result;
        continue;
      }
    }

    /* 2.3. If the found-month flag is not set and the date-token matches the
     * month production, set the found-month flag and set the month-value to
     * the month denoted by the date-token.  Skip the remaining sub-steps and
     * continue to the next date-token.
     */
    if (month === null) {
      result = parseMonth(token);
      if (result !== null) {
        month = result;
        continue;
      }
    }

    /* 2.4. If the found-year flag is not set and the date-token matches the
     * year production, set the found-year flag and set the year-value to the
     * number denoted by the date-token.  Skip the remaining sub-steps and
     * continue to the next date-token.
     */
    if (year === null) {
      // "year = 2*4DIGIT ( non-digit *OCTET )"
      result = parseDigits(token, 2, 4, true);
      if (result !== null) {
        year = result;
        /* From S5.1.1:
         * 3.  If the year-value is greater than or equal to 70 and less
         * than or equal to 99, increment the year-value by 1900.
         * 4.  If the year-value is greater than or equal to 0 and less
         * than or equal to 69, increment the year-value by 2000.
         */
        if (year >= 70 && year <= 99) {
          year += 1900;
        } else if (year >= 0 && year <= 69) {
          year += 2000;
        }
      }
    }
  }

  /* RFC 6265 S5.1.1
   * "5. Abort these steps and fail to parse the cookie-date if:
   *     *  at least one of the found-day-of-month, found-month, found-
   *        year, or found-time flags is not set,
   *     *  the day-of-month-value is less than 1 or greater than 31,
   *     *  the year-value is less than 1601,
   *     *  the hour-value is greater than 23,
   *     *  the minute-value is greater than 59, or
   *     *  the second-value is greater than 59.
   *     (Note that leap seconds cannot be represented in this syntax.)"
   *
   * So, in order as above:
   */
  if (
    dayOfMonth === null ||
    month === null ||
    year === null ||
    second === null ||
    dayOfMonth < 1 ||
    dayOfMonth > 31 ||
    year < 1601 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return;
  }

  return new Date(Date.UTC(year, month, dayOfMonth, hour, minute, second));
}

function formatDate(date) {
  validators.validate(validators.isDate(date), date);
  return date.toUTCString();
}

// S5.1.2 Canonicalized Host Names
function canonicalDomain(str) {
  if (str == null) {
    return null;
  }
  str = str.trim().replace(/^\./, ""); // S4.1.2.3 & S5.2.3: ignore leading .

  if (IP_V6_REGEX_OBJECT.test(str)) {
    str = str.replace("[", "").replace("]", "");
  }

  // convert to IDN if any non-ASCII characters
  if (punycode && /[^\u0001-\u007f]/.test(str)) {
    str = punycode.toASCII(str);
  }

  return str.toLowerCase();
}

// S5.1.3 Domain Matching
function domainMatch(str, domStr, canonicalize) {
  if (str == null || domStr == null) {
    return null;
  }
  if (canonicalize !== false) {
    str = canonicalDomain(str);
    domStr = canonicalDomain(domStr);
  }

  /*
   * S5.1.3:
   * "A string domain-matches a given domain string if at least one of the
   * following conditions hold:"
   *
   * " o The domain string and the string are identical. (Note that both the
   * domain string and the string will have been canonicalized to lower case at
   * this point)"
   */
  if (str == domStr) {
    return true;
  }

  /* " o All of the following [three] conditions hold:" */

  /* "* The domain string is a suffix of the string" */
  const idx = str.lastIndexOf(domStr);
  if (idx <= 0) {
    return false; // it's a non-match (-1) or prefix (0)
  }

  // next, check it's a proper suffix
  // e.g., "a.b.c".indexOf("b.c") === 2
  // 5 === 3+2
  if (str.length !== domStr.length + idx) {
    return false; // it's not a suffix
  }

  /* "  * The last character of the string that is not included in the
   * domain string is a %x2E (".") character." */
  if (str.substr(idx - 1, 1) !== ".") {
    return false; // doesn't align on "."
  }

  /* "  * The string is a host name (i.e., not an IP address)." */
  if (IP_REGEX_LOWERCASE.test(str)) {
    return false; // it's an IP address
  }

  return true;
}

// RFC6265 S5.1.4 Paths and Path-Match

/*
 * "The user agent MUST use an algorithm equivalent to the following algorithm
 * to compute the default-path of a cookie:"
 *
 * Assumption: the path (and not query part or absolute uri) is passed in.
 */
function defaultPath(path) {
  // "2. If the uri-path is empty or if the first character of the uri-path is not
  // a %x2F ("/") character, output %x2F ("/") and skip the remaining steps.
  if (!path || path.substr(0, 1) !== "/") {
    return "/";
  }

  // "3. If the uri-path contains no more than one %x2F ("/") character, output
  // %x2F ("/") and skip the remaining step."
  if (path === "/") {
    return path;
  }

  const rightSlash = path.lastIndexOf("/");
  if (rightSlash === 0) {
    return "/";
  }

  // "4. Output the characters of the uri-path from the first character up to,
  // but not including, the right-most %x2F ("/")."
  return path.slice(0, rightSlash);
}

function trimTerminator(str) {
  if (validators.isEmptyString(str)) return str;
  for (let t = 0; t < TERMINATORS.length; t++) {
    const terminatorIdx = str.indexOf(TERMINATORS[t]);
    if (terminatorIdx !== -1) {
      str = str.substr(0, terminatorIdx);
    }
  }

  return str;
}

function parseCookiePair(cookiePair, looseMode) {
  cookiePair = trimTerminator(cookiePair);
  validators.validate(validators.isString(cookiePair), cookiePair);

  let firstEq = cookiePair.indexOf("=");
  if (looseMode) {
    if (firstEq === 0) {
      // '=' is immediately at start
      cookiePair = cookiePair.substr(1);
      firstEq = cookiePair.indexOf("="); // might still need to split on '='
    }
  } else {
    // non-loose mode
    if (firstEq <= 0) {
      // no '=' or is at start
      return; // needs to have non-empty "cookie-name"
    }
  }

  let cookieName, cookieValue;
  if (firstEq <= 0) {
    cookieName = "";
    cookieValue = cookiePair.trim();
  } else {
    cookieName = cookiePair.substr(0, firstEq).trim();
    cookieValue = cookiePair.substr(firstEq + 1).trim();
  }

  if (CONTROL_CHARS.test(cookieName) || CONTROL_CHARS.test(cookieValue)) {
    return;
  }

  const c = new Cookie();
  c.key = cookieName;
  c.value = cookieValue;
  return c;
}

function parse(str, options) {
  if (!options || typeof options !== "object") {
    options = {};
  }

  if (validators.isEmptyString(str) || !validators.isString(str)) {
    return null;
  }

  str = str.trim();

  // We use a regex to parse the "name-value-pair" part of S5.2
  const firstSemi = str.indexOf(";"); // S5.2 step 1
  const cookiePair = firstSemi === -1 ? str : str.substr(0, firstSemi);
  const c = parseCookiePair(cookiePair, !!options.loose);
  if (!c) {
    return;
  }

  if (firstSemi === -1) {
    return c;
  }

  // S5.2.3 "unparsed-attributes consist of the remainder of the set-cookie-string
  // (including the %x3B (";") in question)." plus later on in the same section
  // "discard the first ";" and trim".
  const unparsed = str.slice(firstSemi + 1).trim();

  // "If the unparsed-attributes string is empty, skip the rest of these
  // steps."
  if (unparsed.length === 0) {
    return c;
  }

  /*
   * S5.2 says that when looping over the items "[p]rocess the attribute-name
   * and attribute-value according to the requirements in the following
   * subsections" for every item.  Plus, for many of the individual attributes
   * in S5.3 it says to use the "attribute-value of the last attribute in the
   * cookie-attribute-list".  Therefore, in this implementation, we overwrite
   * the previous value.
   */
  const cookie_avs = unparsed.split(";");
  while (cookie_avs.length) {
    const av = cookie_avs.shift().trim();
    if (av.length === 0) {
      // happens if ";;" appears
      continue;
    }
    const av_sep = av.indexOf("=");
    let av_key, av_value;

    if (av_sep === -1) {
      av_key = av;
      av_value = null;
    } else {
      av_key = av.substr(0, av_sep);
      av_value = av.substr(av_sep + 1);
    }

    av_key = av_key.trim().toLowerCase();

    if (av_value) {
      av_value = av_value.trim();
    }

    switch (av_key) {
      case "expires": // S5.2.1
        if (av_value) {
          const exp = parseDate(av_value);
          // "If the attribute-value failed to parse as a cookie date, ignore the
          // cookie-av."
          if (exp) {
            // over and underflow not realistically a concern: V8's getTime() seems to
            // store something larger than a 32-bit time_t (even with 32-bit node)
            c.expires = exp;
          }
        }
        break;

      case "max-age": // S5.2.2
        if (av_value) {
          // "If the first character of the attribute-value is not a DIGIT or a "-"
          // character ...[or]... If the remainder of attribute-value contains a
          // non-DIGIT character, ignore the cookie-av."
          if (/^-?[0-9]+$/.test(av_value)) {
            const delta = parseInt(av_value, 10);
            // "If delta-seconds is less than or equal to zero (0), let expiry-time
            // be the earliest representable date and time."
            c.setMaxAge(delta);
          }
        }
        break;

      case "domain": // S5.2.3
        // "If the attribute-value is empty, the behavior is undefined.  However,
        // the user agent SHOULD ignore the cookie-av entirely."
        if (av_value) {
          // S5.2.3 "Let cookie-domain be the attribute-value without the leading %x2E
          // (".") character."
          const domain = av_value.trim().replace(/^\./, "");
          if (domain) {
            // "Convert the cookie-domain to lower case."
            c.domain = domain.toLowerCase();
          }
        }
        break;

      case "path": // S5.2.4
        /*
         * "If the attribute-value is empty or if the first character of the
         * attribute-value is not %x2F ("/"):
         *   Let cookie-path be the default-path.
         * Otherwise:
         *   Let cookie-path be the attribute-value."
         *
         * We'll represent the default-path as null since it depends on the
         * context of the parsing.
         */
        c.path = av_value && av_value[0] === "/" ? av_value : null;
        break;

      case "secure": // S5.2.5
        /*
         * "If the attribute-name case-insensitively matches the string "Secure",
         * the user agent MUST append an attribute to the cookie-attribute-list
         * with an attribute-name of Secure and an empty attribute-value."
         */
        c.secure = true;
        break;

      case "httponly": // S5.2.6 -- effectively the same as 'secure'
        c.httpOnly = true;
        break;

      case "samesite": // RFC6265bis-02 S5.3.7
        const enforcement = av_value ? av_value.toLowerCase() : "";
        switch (enforcement) {
          case "strict":
            c.sameSite = "strict";
            break;
          case "lax":
            c.sameSite = "lax";
            break;
          case "none":
            c.sameSite = "none";
            break;
          default:
            c.sameSite = undefined;
            break;
        }
        break;

      default:
        c.extensions = c.extensions || [];
        c.extensions.push(av);
        break;
    }
  }

  return c;
}

/**
 *  If the cookie-name begins with a case-sensitive match for the
 *  string "__Secure-", abort these steps and ignore the cookie
 *  entirely unless the cookie's secure-only-flag is true.
 * @param cookie
 * @returns boolean
 */
function isSecurePrefixConditionMet(cookie) {
  validators.validate(validators.isObject(cookie), cookie);
  return !cookie.key.startsWith("__Secure-") || cookie.secure;
}

/**
 *  If the cookie-name begins with a case-sensitive match for the
 *  string "__Host-", abort these steps and ignore the cookie
 *  entirely unless the cookie meets all the following criteria:
 *    1.  The cookie's secure-only-flag is true.
 *    2.  The cookie's host-only-flag is true.
 *    3.  The cookie-attribute-list contains an attribute with an
 *        attribute-name of "Path", and the cookie's path is "/".
 * @param cookie
 * @returns boolean
 */
function isHostPrefixConditionMet(cookie) {
  validators.validate(validators.isObject(cookie));
  return (
    !cookie.key.startsWith("__Host-") ||
    (cookie.secure &&
      cookie.hostOnly &&
      cookie.path != null &&
      cookie.path === "/")
  );
}

// avoid the V8 deoptimization monster!
function jsonParse(str) {
  let obj;
  try {
    obj = JSON.parse(str);
  } catch (e) {
    return e;
  }
  return obj;
}

function fromJSON(str) {
  if (!str || validators.isEmptyString(str)) {
    return null;
  }

  let obj;
  if (typeof str === "string") {
    obj = jsonParse(str);
    if (obj instanceof Error) {
      return null;
    }
  } else {
    // assume it's an Object
    obj = str;
  }

  const c = new Cookie();
  for (let i = 0; i < Cookie.serializableProperties.length; i++) {
    const prop = Cookie.serializableProperties[i];
    if (obj[prop] === undefined || obj[prop] === cookieDefaults[prop]) {
      continue; // leave as prototype default
    }

    if (prop === "expires" || prop === "creation" || prop === "lastAccessed") {
      if (obj[prop] === null) {
        c[prop] = null;
      } else {
        c[prop] = obj[prop] == "Infinity" ? "Infinity" : new Date(obj[prop]);
      }
    } else {
      c[prop] = obj[prop];
    }
  }

  return c;
}

/* Section 5.4 part 2:
 * "*  Cookies with longer paths are listed before cookies with
 *     shorter paths.
 *
 *  *  Among cookies that have equal-length path fields, cookies with
 *     earlier creation-times are listed before cookies with later
 *     creation-times."
 */

function cookieCompare(a, b) {
  validators.validate(validators.isObject(a), a);
  validators.validate(validators.isObject(b), b);
  let cmp = 0;

  // descending for length: b CMP a
  const aPathLen = a.path ? a.path.length : 0;
  const bPathLen = b.path ? b.path.length : 0;
  cmp = bPathLen - aPathLen;
  if (cmp !== 0) {
    return cmp;
  }

  // ascending for time: a CMP b
  const aTime = a.creation ? a.creation.getTime() : MAX_TIME;
  const bTime = b.creation ? b.creation.getTime() : MAX_TIME;
  cmp = aTime - bTime;
  if (cmp !== 0) {
    return cmp;
  }

  // break ties for the same millisecond (precision of JavaScript's clock)
  cmp = a.creationIndex - b.creationIndex;

  return cmp;
}

// Gives the permutation of all possible pathMatch()es of a given path. The
// array is in longest-to-shortest order.  Handy for indexing.
function permutePath(path) {
  validators.validate(validators.isString(path));
  if (path === "/") {
    return ["/"];
  }
  const permutations = [path];
  while (path.length > 1) {
    const lindex = path.lastIndexOf("/");
    if (lindex === 0) {
      break;
    }
    path = path.substr(0, lindex);
    permutations.push(path);
  }
  permutations.push("/");
  return permutations;
}

function getCookieContext(url) {
  if (url instanceof Object) {
    return url;
  }
  // NOTE: decodeURI will throw on malformed URIs (see GH-32).
  // Therefore, we will just skip decoding for such URIs.
  try {
    url = decodeURI(url);
  } catch (err) {
    // Silently swallow error
  }

  return urlParse(url);
}

const cookieDefaults = {
  // the order in which the RFC has them:
  key: "",
  value: "",
  expires: "Infinity",
  maxAge: null,
  domain: null,
  path: null,
  secure: false,
  httpOnly: false,
  extensions: null,
  // set by the CookieJar:
  hostOnly: null,
  pathIsDefault: null,
  creation: null,
  lastAccessed: null,
  sameSite: undefined
};

class Cookie {
  constructor(options = {}) {
    const customInspectSymbol = getCustomInspectSymbol();
    if (customInspectSymbol) {
      this[customInspectSymbol] = this.inspect;
    }

    Object.assign(this, cookieDefaults, options);
    this.creation = this.creation || new Date();

    // used to break creation ties in cookieCompare():
    Object.defineProperty(this, "creationIndex", {
      configurable: false,
      enumerable: false, // important for assert.deepEqual checks
      writable: true,
      value: ++Cookie.cookiesCreated
    });
  }

  inspect() {
    const now = Date.now();
    const hostOnly = this.hostOnly != null ? this.hostOnly : "?";
    const createAge = this.creation
      ? `${now - this.creation.getTime()}ms`
      : "?";
    const accessAge = this.lastAccessed
      ? `${now - this.lastAccessed.getTime()}ms`
      : "?";
    return `Cookie="${this.toString()}; hostOnly=${hostOnly}; aAge=${accessAge}; cAge=${createAge}"`;
  }

  toJSON() {
    const obj = {};

    for (const prop of Cookie.serializableProperties) {
      if (this[prop] === cookieDefaults[prop]) {
        continue; // leave as prototype default
      }

      if (
        prop === "expires" ||
        prop === "creation" ||
        prop === "lastAccessed"
      ) {
        if (this[prop] === null) {
          obj[prop] = null;
        } else {
          obj[prop] =
            this[prop] == "Infinity" // intentionally not ===
              ? "Infinity"
              : this[prop].toISOString();
        }
      } else if (prop === "maxAge") {
        if (this[prop] !== null) {
          // again, intentionally not ===
          obj[prop] =
            this[prop] == Infinity || this[prop] == -Infinity
              ? this[prop].toString()
              : this[prop];
        }
      } else {
        if (this[prop] !== cookieDefaults[prop]) {
          obj[prop] = this[prop];
        }
      }
    }

    return obj;
  }

  clone() {
    return fromJSON(this.toJSON());
  }

  validate() {
    if (!COOKIE_OCTETS.test(this.value)) {
      return false;
    }
    if (
      this.expires != Infinity &&
      !(this.expires instanceof Date) &&
      !parseDate(this.expires)
    ) {
      return false;
    }
    if (this.maxAge != null && this.maxAge <= 0) {
      return false; // "Max-Age=" non-zero-digit *DIGIT
    }
    if (this.path != null && !PATH_VALUE.test(this.path)) {
      return false;
    }

    const cdomain = this.cdomain();
    if (cdomain) {
      if (cdomain.match(/\.$/)) {
        return false; // S4.1.2.3 suggests that this is bad. domainMatch() tests confirm this
      }
      const suffix = pubsuffix.getPublicSuffix(cdomain);
      if (suffix == null) {
        // it's a public suffix
        return false;
      }
    }
    return true;
  }

  setExpires(exp) {
    if (exp instanceof Date) {
      this.expires = exp;
    } else {
      this.expires = parseDate(exp) || "Infinity";
    }
  }

  setMaxAge(age) {
    if (age === Infinity || age === -Infinity) {
      this.maxAge = age.toString(); // so JSON.stringify() works
    } else {
      this.maxAge = age;
    }
  }

  cookieString() {
    let val = this.value;
    if (val == null) {
      val = "";
    }
    if (this.key === "") {
      return val;
    }
    return `${this.key}=${val}`;
  }

  // gives Set-Cookie header format
  toString() {
    let str = this.cookieString();

    if (this.expires != Infinity) {
      if (this.expires instanceof Date) {
        str += `; Expires=${formatDate(this.expires)}`;
      } else {
        str += `; Expires=${this.expires}`;
      }
    }

    if (this.maxAge != null && this.maxAge != Infinity) {
      str += `; Max-Age=${this.maxAge}`;
    }

    if (this.domain && !this.hostOnly) {
      str += `; Domain=${this.domain}`;
    }
    if (this.path) {
      str += `; Path=${this.path}`;
    }

    if (this.secure) {
      str += "; Secure";
    }
    if (this.httpOnly) {
      str += "; HttpOnly";
    }
    if (this.sameSite && this.sameSite !== "none") {
      const ssCanon = Cookie.sameSiteCanonical[this.sameSite.toLowerCase()];
      str += `; SameSite=${ssCanon ? ssCanon : this.sameSite}`;
    }
    if (this.extensions) {
      this.extensions.forEach(ext => {
        str += `; ${ext}`;
      });
    }

    return str;
  }

  // TTL() partially replaces the "expiry-time" parts of S5.3 step 3 (setCookie()
  // elsewhere)
  // S5.3 says to give the "latest representable date" for which we use Infinity
  // For "expired" we use 0
  TTL(now) {
    /* RFC6265 S4.1.2.2 If a cookie has both the Max-Age and the Expires
     * attribute, the Max-Age attribute has precedence and controls the
     * expiration date of the cookie.
     * (Concurs with S5.3 step 3)
     */
    if (this.maxAge != null) {
      return this.maxAge <= 0 ? 0 : this.maxAge * 1000;
    }

    let expires = this.expires;
    if (expires != Infinity) {
      if (!(expires instanceof Date)) {
        expires = parseDate(expires) || Infinity;
      }

      if (expires == Infinity) {
        return Infinity;
      }

      return expires.getTime() - (now || Date.now());
    }

    return Infinity;
  }

  // expiryTime() replaces the "expiry-time" parts of S5.3 step 3 (setCookie()
  // elsewhere)
  expiryTime(now) {
    if (this.maxAge != null) {
      const relativeTo = now || this.creation || new Date();
      const age = this.maxAge <= 0 ? -Infinity : this.maxAge * 1000;
      return relativeTo.getTime() + age;
    }

    if (this.expires == Infinity) {
      return Infinity;
    }
    return this.expires.getTime();
  }

  // expiryDate() replaces the "expiry-time" parts of S5.3 step 3 (setCookie()
  // elsewhere), except it returns a Date
  expiryDate(now) {
    const millisec = this.expiryTime(now);
    if (millisec == Infinity) {
      return new Date(MAX_TIME);
    } else if (millisec == -Infinity) {
      return new Date(MIN_TIME);
    } else {
      return new Date(millisec);
    }
  }

  // This replaces the "persistent-flag" parts of S5.3 step 3
  isPersistent() {
    return this.maxAge != null || this.expires != Infinity;
  }

  // Mostly S5.1.2 and S5.2.3:
  canonicalizedDomain() {
    if (this.domain == null) {
      return null;
    }
    return canonicalDomain(this.domain);
  }

  cdomain() {
    return this.canonicalizedDomain();
  }
}

Cookie.cookiesCreated = 0;
Cookie.parse = parse;
Cookie.fromJSON = fromJSON;
Cookie.serializableProperties = Object.keys(cookieDefaults);
Cookie.sameSiteLevel = {
  strict: 3,
  lax: 2,
  none: 1
};

Cookie.sameSiteCanonical = {
  strict: "Strict",
  lax: "Lax"
};

function getNormalizedPrefixSecurity(prefixSecurity) {
  if (prefixSecurity != null) {
    const normalizedPrefixSecurity = prefixSecurity.toLowerCase();
    /* The three supported options */
    switch (normalizedPrefixSecurity) {
      case PrefixSecurityEnum.STRICT:
      case PrefixSecurityEnum.SILENT:
      case PrefixSecurityEnum.DISABLED:
        return normalizedPrefixSecurity;
    }
  }
  /* Default is SILENT */
  return PrefixSecurityEnum.SILENT;
}

class CookieJar {
  constructor(store, options = { rejectPublicSuffixes: true }) {
    if (typeof options === "boolean") {
      options = { rejectPublicSuffixes: options };
    }
    validators.validate(validators.isObject(options), options);
    this.rejectPublicSuffixes = options.rejectPublicSuffixes;
    this.enableLooseMode = !!options.looseMode;
    this.allowSpecialUseDomain =
      typeof options.allowSpecialUseDomain === "boolean"
        ? options.allowSpecialUseDomain
        : true;
    this.store = store || new MemoryCookieStore();
    this.prefixSecurity = getNormalizedPrefixSecurity(options.prefixSecurity);
    this._cloneSync = syncWrap("clone");
    this._importCookiesSync = syncWrap("_importCookies");
    this.getCookiesSync = syncWrap("getCookies");
    this.getCookieStringSync = syncWrap("getCookieString");
    this.getSetCookieStringsSync = syncWrap("getSetCookieStrings");
    this.removeAllCookiesSync = syncWrap("removeAllCookies");
    this.setCookieSync = syncWrap("setCookie");
    this.serializeSync = syncWrap("serialize");
  }

  setCookie(cookie, url, options, cb) {
    validators.validate(validators.isNonEmptyString(url), cb, options);
    let err;

    if (validators.isFunction(url)) {
      cb = url;
      return cb(new Error("No URL was specified"));
    }

    const context = getCookieContext(url);
    if (validators.isFunction(options)) {
      cb = options;
      options = {};
    }

    validators.validate(validators.isFunction(cb), cb);

    if (
      !validators.isNonEmptyString(cookie) &&
      !validators.isObject(cookie) &&
      cookie instanceof String &&
      cookie.length == 0
    ) {
      return cb(null);
    }

    const host = canonicalDomain(context.hostname);
    const loose = options.loose || this.enableLooseMode;

    let sameSiteContext = null;
    if (options.sameSiteContext) {
      sameSiteContext = checkSameSiteContext(options.sameSiteContext);
      if (!sameSiteContext) {
        return cb(new Error(SAME_SITE_CONTEXT_VAL_ERR));
      }
    }

    // S5.3 step 1
    if (typeof cookie === "string" || cookie instanceof String) {
      cookie = Cookie.parse(cookie, { loose: loose });
      if (!cookie) {
        err = new Error("Cookie failed to parse");
        return cb(options.ignoreError ? null : err);
      }
    } else if (!(cookie instanceof Cookie)) {
      // If you're seeing this error, and are passing in a Cookie object,
      // it *might* be a Cookie object from another loaded version of tough-cookie.
      err = new Error(
        "First argument to setCookie must be a Cookie object or string"
      );
      return cb(options.ignoreError ? null : err);
    }

    // S5.3 step 2
    const now = options.now || new Date(); // will assign later to save effort in the face of errors

    // S5.3 step 3: NOOP; persistent-flag and expiry-time is handled by getCookie()

    // S5.3 step 4: NOOP; domain is null by default

    // S5.3 step 5: public suffixes
    if (this.rejectPublicSuffixes && cookie.domain) {
      const suffix = pubsuffix.getPublicSuffix(cookie.cdomain(), {
        allowSpecialUseDomain: this.allowSpecialUseDomain,
        ignoreError: options.ignoreError
      });
      if (suffix == null && !IP_V6_REGEX_OBJECT.test(cookie.domain)) {
        // e.g. "com"
        err = new Error("Cookie has domain set to a public suffix");
        return cb(options.ignoreError ? null : err);
      }
    }

    // S5.3 step 6:
    if (cookie.domain) {
      if (!domainMatch(host, cookie.cdomain(), false)) {
        err = new Error(
          `Cookie not in this host's domain. Cookie:${cookie.cdomain()} Request:${host}`
        );
        return cb(options.ignoreError ? null : err);
      }

      if (cookie.hostOnly == null) {
        // don't reset if already set
        cookie.hostOnly = false;
      }
    } else {
      cookie.hostOnly = true;
      cookie.domain = host;
    }

    //S5.2.4 If the attribute-value is empty or if the first character of the
    //attribute-value is not %x2F ("/"):
    //Let cookie-path be the default-path.
    if (!cookie.path || cookie.path[0] !== "/") {
      cookie.path = defaultPath(context.pathname);
      cookie.pathIsDefault = true;
    }

    // S5.3 step 8: NOOP; secure attribute
    // S5.3 step 9: NOOP; httpOnly attribute

    // S5.3 step 10
    if (options.http === false && cookie.httpOnly) {
      err = new Error("Cookie is HttpOnly and this isn't an HTTP API");
      return cb(options.ignoreError ? null : err);
    }

    // 6252bis-02 S5.4 Step 13 & 14:
    if (
      cookie.sameSite !== "none" &&
      cookie.sameSite !== undefined &&
      sameSiteContext
    ) {
      // "If the cookie's "same-site-flag" is not "None", and the cookie
      //  is being set from a context whose "site for cookies" is not an
      //  exact match for request-uri's host's registered domain, then
      //  abort these steps and ignore the newly created cookie entirely."
      if (sameSiteContext === "none") {
        err = new Error(
          "Cookie is SameSite but this is a cross-origin request"
        );
        return cb(options.ignoreError ? null : err);
      }
    }

    /* 6265bis-02 S5.4 Steps 15 & 16 */
    const ignoreErrorForPrefixSecurity =
      this.prefixSecurity === PrefixSecurityEnum.SILENT;
    const prefixSecurityDisabled =
      this.prefixSecurity === PrefixSecurityEnum.DISABLED;
    /* If prefix checking is not disabled ...*/
    if (!prefixSecurityDisabled) {
      let errorFound = false;
      let errorMsg;
      /* Check secure prefix condition */
      if (!isSecurePrefixConditionMet(cookie)) {
        errorFound = true;
        errorMsg = "Cookie has __Secure prefix but Secure attribute is not set";
      } else if (!isHostPrefixConditionMet(cookie)) {
        /* Check host prefix condition */
        errorFound = true;
        errorMsg =
          "Cookie has __Host prefix but either Secure or HostOnly attribute is not set or Path is not '/'";
      }
      if (errorFound) {
        return cb(
          options.ignoreError || ignoreErrorForPrefixSecurity
            ? null
            : new Error(errorMsg)
        );
      }
    }

    const store = this.store;

    if (!store.updateCookie) {
      store.updateCookie = function(oldCookie, newCookie, cb) {
        this.putCookie(newCookie, cb);
      };
    }

    function withCookie(err, oldCookie) {
      if (err) {
        return cb(err);
      }

      const next = function(err) {
        if (err) {
          return cb(err);
        } else {
          cb(null, cookie);
        }
      };

      if (oldCookie) {
        // S5.3 step 11 - "If the cookie store contains a cookie with the same name,
        // domain, and path as the newly created cookie:"
        if (options.http === false && oldCookie.httpOnly) {
          // step 11.2
          err = new Error("old Cookie is HttpOnly and this isn't an HTTP API");
          return cb(options.ignoreError ? null : err);
        }
        cookie.creation = oldCookie.creation; // step 11.3
        cookie.creationIndex = oldCookie.creationIndex; // preserve tie-breaker
        cookie.lastAccessed = now;
        // Step 11.4 (delete cookie) is implied by just setting the new one:
        store.updateCookie(oldCookie, cookie, next); // step 12
      } else {
        cookie.creation = cookie.lastAccessed = now;
        store.putCookie(cookie, next); // step 12
      }
    }

    store.findCookie(cookie.domain, cookie.path, cookie.key, withCookie);
  }

  // RFC6365 S5.4
  getCookies(url, options, cb) {
    validators.validate(validators.isNonEmptyString(url), cb, url);
    const context = getCookieContext(url);
    if (validators.isFunction(options)) {
      cb = options;
      options = {};
    }
    validators.validate(validators.isObject(options), cb, options);
    validators.validate(validators.isFunction(cb), cb);

    const host = canonicalDomain(context.hostname);
    const path = context.pathname || "/";

    let secure = options.secure;
    if (
      secure == null &&
      context.protocol &&
      (context.protocol == "https:" || context.protocol == "wss:")
    ) {
      secure = true;
    }

    let sameSiteLevel = 0;
    if (options.sameSiteContext) {
      const sameSiteContext = checkSameSiteContext(options.sameSiteContext);
      sameSiteLevel = Cookie.sameSiteLevel[sameSiteContext];
      if (!sameSiteLevel) {
        return cb(new Error(SAME_SITE_CONTEXT_VAL_ERR));
      }
    }

    let http = options.http;
    if (http == null) {
      http = true;
    }

    const now = options.now || Date.now();
    const expireCheck = options.expire !== false;
    const allPaths = !!options.allPaths;
    const store = this.store;

    function matchingCookie(c) {
      // "Either:
      //   The cookie's host-only-flag is true and the canonicalized
      //   request-host is identical to the cookie's domain.
      // Or:
      //   The cookie's host-only-flag is false and the canonicalized
      //   request-host domain-matches the cookie's domain."
      if (c.hostOnly) {
        if (c.domain != host) {
          return false;
        }
      } else {
        if (!domainMatch(host, c.domain, false)) {
          return false;
        }
      }

      // "The request-uri's path path-matches the cookie's path."
      if (!allPaths && !pathMatch(path, c.path)) {
        return false;
      }

      // "If the cookie's secure-only-flag is true, then the request-uri's
      // scheme must denote a "secure" protocol"
      if (c.secure && !secure) {
        return false;
      }

      // "If the cookie's http-only-flag is true, then exclude the cookie if the
      // cookie-string is being generated for a "non-HTTP" API"
      if (c.httpOnly && !http) {
        return false;
      }

      // RFC6265bis-02 S5.3.7
      if (sameSiteLevel) {
        const cookieLevel = Cookie.sameSiteLevel[c.sameSite || "none"];
        if (cookieLevel > sameSiteLevel) {
          // only allow cookies at or below the request level
          return false;
        }
      }

      // deferred from S5.3
      // non-RFC: allow retention of expired cookies by choice
      if (expireCheck && c.expiryTime() <= now) {
        store.removeCookie(c.domain, c.path, c.key, () => {}); // result ignored
        return false;
      }

      return true;
    }

    store.findCookies(
      host,
      allPaths ? null : path,
      this.allowSpecialUseDomain,
      (err, cookies) => {
        if (err) {
          return cb(err);
        }

        cookies = cookies.filter(matchingCookie);

        // sorting of S5.4 part 2
        if (options.sort !== false) {
          cookies = cookies.sort(cookieCompare);
        }

        // S5.4 part 3
        const now = new Date();
        for (const cookie of cookies) {
          cookie.lastAccessed = now;
        }
        // TODO persist lastAccessed

        cb(null, cookies);
      }
    );
  }

  getCookieString(...args) {
    const cb = args.pop();
    validators.validate(validators.isFunction(cb), cb);
    const next = function(err, cookies) {
      if (err) {
        cb(err);
      } else {
        cb(
          null,
          cookies
            .sort(cookieCompare)
            .map(c => c.cookieString())
            .join("; ")
        );
      }
    };
    args.push(next);
    this.getCookies.apply(this, args);
  }

  getSetCookieStrings(...args) {
    const cb = args.pop();
    validators.validate(validators.isFunction(cb), cb);
    const next = function(err, cookies) {
      if (err) {
        cb(err);
      } else {
        cb(
          null,
          cookies.map(c => {
            return c.toString();
          })
        );
      }
    };
    args.push(next);
    this.getCookies.apply(this, args);
  }

  serialize(cb) {
    validators.validate(validators.isFunction(cb), cb);
    let type = this.store.constructor.name;
    if (validators.isObject(type)) {
      type = null;
    }

    // update README.md "Serialization Format" if you change this, please!
    const serialized = {
      // The version of tough-cookie that serialized this jar. Generally a good
      // practice since future versions can make data import decisions based on
      // known past behavior. When/if this matters, use `semver`.
      version: `tough-cookie@${VERSION}`,

      // add the store type, to make humans happy:
      storeType: type,

      // CookieJar configuration:
      rejectPublicSuffixes: !!this.rejectPublicSuffixes,
      enableLooseMode: !!this.enableLooseMode,
      allowSpecialUseDomain: !!this.allowSpecialUseDomain,
      prefixSecurity: getNormalizedPrefixSecurity(this.prefixSecurity),

      // this gets filled from getAllCookies:
      cookies: []
    };

    if (
      !(
        this.store.getAllCookies &&
        typeof this.store.getAllCookies === "function"
      )
    ) {
      return cb(
        new Error(
          "store does not support getAllCookies and cannot be serialized"
        )
      );
    }

    this.store.getAllCookies((err, cookies) => {
      if (err) {
        return cb(err);
      }

      serialized.cookies = cookies.map(cookie => {
        // convert to serialized 'raw' cookies
        cookie = cookie instanceof Cookie ? cookie.toJSON() : cookie;

        // Remove the index so new ones get assigned during deserialization
        delete cookie.creationIndex;

        return cookie;
      });

      return cb(null, serialized);
    });
  }

  toJSON() {
    return this.serializeSync();
  }

  // use the class method CookieJar.deserialize instead of calling this directly
  _importCookies(serialized, cb) {
    let cookies = serialized.cookies;
    if (!cookies || !Array.isArray(cookies)) {
      return cb(new Error("serialized jar has no cookies array"));
    }
    cookies = cookies.slice(); // do not modify the original

    const putNext = err => {
      if (err) {
        return cb(err);
      }

      if (!cookies.length) {
        return cb(err, this);
      }

      let cookie;
      try {
        cookie = fromJSON(cookies.shift());
      } catch (e) {
        return cb(e);
      }

      if (cookie === null) {
        return putNext(null); // skip this cookie
      }

      this.store.putCookie(cookie, putNext);
    };

    putNext();
  }

  clone(newStore, cb) {
    if (arguments.length === 1) {
      cb = newStore;
      newStore = null;
    }

    this.serialize((err, serialized) => {
      if (err) {
        return cb(err);
      }
      CookieJar.deserialize(serialized, newStore, cb);
    });
  }

  cloneSync(newStore) {
    if (arguments.length === 0) {
      return this._cloneSync();
    }
    if (!newStore.synchronous) {
      throw new Error(
        "CookieJar clone destination store is not synchronous; use async API instead."
      );
    }
    return this._cloneSync(newStore);
  }

  removeAllCookies(cb) {
    validators.validate(validators.isFunction(cb), cb);
    const store = this.store;

    // Check that the store implements its own removeAllCookies(). The default
    // implementation in Store will immediately call the callback with a "not
    // implemented" Error.
    if (
      typeof store.removeAllCookies === "function" &&
      store.removeAllCookies !== Store.prototype.removeAllCookies
    ) {
      return store.removeAllCookies(cb);
    }

    store.getAllCookies((err, cookies) => {
      if (err) {
        return cb(err);
      }

      if (cookies.length === 0) {
        return cb(null);
      }

      let completedCount = 0;
      const removeErrors = [];

      function removeCookieCb(removeErr) {
        if (removeErr) {
          removeErrors.push(removeErr);
        }

        completedCount++;

        if (completedCount === cookies.length) {
          return cb(removeErrors.length ? removeErrors[0] : null);
        }
      }

      cookies.forEach(cookie => {
        store.removeCookie(
          cookie.domain,
          cookie.path,
          cookie.key,
          removeCookieCb
        );
      });
    });
  }

  static deserialize(strOrObj, store, cb) {
    if (arguments.length !== 3) {
      // store is optional
      cb = store;
      store = null;
    }
    validators.validate(validators.isFunction(cb), cb);

    let serialized;
    if (typeof strOrObj === "string") {
      serialized = jsonParse(strOrObj);
      if (serialized instanceof Error) {
        return cb(serialized);
      }
    } else {
      serialized = strOrObj;
    }

    const jar = new CookieJar(store, {
      rejectPublicSuffixes: serialized.rejectPublicSuffixes,
      looseMode: serialized.enableLooseMode,
      allowSpecialUseDomain: serialized.allowSpecialUseDomain,
      prefixSecurity: serialized.prefixSecurity
    });
    jar._importCookies(serialized, err => {
      if (err) {
        return cb(err);
      }
      cb(null, jar);
    });
  }

  static deserializeSync(strOrObj, store) {
    const serialized =
      typeof strOrObj === "string" ? JSON.parse(strOrObj) : strOrObj;
    const jar = new CookieJar(store, {
      rejectPublicSuffixes: serialized.rejectPublicSuffixes,
      looseMode: serialized.enableLooseMode
    });

    // catch this mistake early:
    if (!jar.store.synchronous) {
      throw new Error(
        "CookieJar store is not synchronous; use async API instead."
      );
    }

    jar._importCookiesSync(serialized);
    return jar;
  }
}
CookieJar.fromJSON = CookieJar.deserializeSync;

[
  "_importCookies",
  "clone",
  "getCookies",
  "getCookieString",
  "getSetCookieStrings",
  "removeAllCookies",
  "serialize",
  "setCookie"
].forEach(name => {
  CookieJar.prototype[name] = fromCallback(CookieJar.prototype[name]);
});
CookieJar.deserialize = fromCallback(CookieJar.deserialize);

// Use a closure to provide a true imperative API for synchronous stores.
function syncWrap(method) {
  return function(...args) {
    if (!this.store.synchronous) {
      throw new Error(
        "CookieJar store is not synchronous; use async API instead."
      );
    }

    let syncErr, syncResult;
    this[method](...args, (err, result) => {
      syncErr = err;
      syncResult = result;
    });

    if (syncErr) {
      throw syncErr;
    }
    return syncResult;
  };
}

cookie.version = VERSION;
cookie.CookieJar = CookieJar;
cookie.Cookie = Cookie;
cookie.Store = Store;
cookie.MemoryCookieStore = MemoryCookieStore;
cookie.parseDate = parseDate;
cookie.formatDate = formatDate;
cookie.parse = parse;
cookie.fromJSON = fromJSON;
cookie.domainMatch = domainMatch;
cookie.defaultPath = defaultPath;
cookie.pathMatch = pathMatch;
cookie.getPublicSuffix = pubsuffix.getPublicSuffix;
cookie.cookieCompare = cookieCompare;
cookie.permuteDomain = requirePermuteDomain().permuteDomain;
cookie.permutePath = permutePath;
cookie.canonicalDomain = canonicalDomain;
cookie.PrefixSecurityEnum = PrefixSecurityEnum;
cookie.ParameterError = validators.ParameterError;

const { promisify } = require$$1$1;
const tough = cookie;

var fetchCookie = function fetchCookieDecorator (fetch, jar, ignoreError = true) {
  fetch = fetch || window.fetch;
  jar = jar || new tough.CookieJar();

  const getCookieString = promisify(jar.getCookieString.bind(jar));
  const setCookie = promisify(jar.setCookie.bind(jar));

  async function fetchCookie (url, opts) {
    opts = opts || {};

    // Prepare request
    const cookie = await getCookieString(typeof url === 'string' ? url : url.url);

    if (url.headers && typeof url.headers.append === 'function') {
      url.headers.append('cookie', cookie);
    } else if (opts.headers && typeof opts.headers.append === 'function') {
      opts.headers.append('cookie', cookie);
    } else {
      opts.headers = Object.assign(
        opts.headers || {},
        cookie ? { cookie: cookie } : {}
      );
    }

    // Actual request
    const res = await fetch(url, opts);

    // Get cookie header
    var cookies = [];
    if (res.headers.getAll) {
      // node-fetch v1
      cookies = res.headers.getAll('set-cookie');
      // console.warn("You are using a fetch version that supports 'Headers.getAll' which is deprecated!")
      // console.warn("In the future 'fetch-cookie-v2' may discontinue supporting that fetch implementation.")
      // console.warn('Details: https://developer.mozilla.org/en-US/docs/Web/API/Headers/getAll')
    } else {
      // node-fetch v2
      const headers = res.headers.raw();
      if (headers['set-cookie'] !== undefined) {
        cookies = headers['set-cookie'];
      }
    }

    // Store all present cookies
    await Promise.all(cookies.map((cookie) => setCookie(cookie, res.url, { ignoreError })));

    return res
  }

  return fetchCookie
};

var fetchCookie$1 = /*@__PURE__*/getDefaultExportFromCjs(fetchCookie);

export { fetchCookie$1 as f };
