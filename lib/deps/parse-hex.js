'use strict';

var CHUNK_SIZE = 32768;

function decodeUtf8(str) {
  return decodeURIComponent(window.escape(str));
}

function dehex(charCode) {
  return charCode < 65 ? (charCode - 48) : (charCode - 55);
}

function parseHexCoreUtf8(str, start, end) {
  var result = '';
  while (start < end) {
    result += String.fromCharCode(
      (dehex(str.charCodeAt(start++)) << 4) |
       dehex(str.charCodeAt(start++)));
  }
  return result;
}

function parseHexCoreUtf16(str, start, end) {
  var result = '';
  while (start < end) {
    // UTF-16, twiddle the bits
    result += String.fromCharCode(
        (dehex(str.charCodeAt(start + 2)) << 12) |
        (dehex(str.charCodeAt(start + 3)) << 8) |
        (dehex(str.charCodeAt(start)) << 4) |
        dehex(str.charCodeAt(start + 1)));
    start += 4;
  }
  return result;
}

/**
 * Parse a hex-encoded string asynchronously, to avoid blocking the DOM
 */
function parseHexString(str, encoding, callback) {
  var utf8 = encoding === 'UTF-8';
  var parseHexCore = utf8 ? parseHexCoreUtf8 : parseHexCoreUtf16;
  var charsRead = 0;
  var len = str.length;
  var result = '';

  function next() {
    if (charsRead === len) {
      result = utf8 ? decodeUtf8(result) : result;
      return callback(result);
    }

    process.nextTick(function () {
      var readUntil = Math.min(charsRead + CHUNK_SIZE, len);
      result += parseHexCore(str, charsRead, readUntil);
      charsRead = readUntil;
      next();
    });
  }

  next();
}

/**
 * Same thing, but synchronous for those cases where we need it
 */
function parseHexStringSync(str, encoding) {
  if (encoding === 'UTF-8') {
    return decodeUtf8(parseHexCoreUtf8(str, 0, str.length));
  } else {
    return parseHexCoreUtf16(str, 0, str.length);
  }
}

module.exports = {
  sync: parseHexStringSync,
  async: parseHexString
};