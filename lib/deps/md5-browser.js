'use strict';

var toPromise = require('./toPromise');
var base64 = require('./binary/base64');
var Md5 = require('spark-md5');
var setImmediateShim = global.setImmediate || global.setTimeout;
var MD5_CHUNK_SIZE = 32768;

// convert a 64-bit int to a binary string
function intToString(int) {
  return String.fromCharCode(int & 0xff) +
    String.fromCharCode((int >>> 8) & 0xff) +
    String.fromCharCode((int >>> 16) & 0xff) +
    String.fromCharCode((int >>> 24) & 0xff);
}

// convert an array of 64-bit ints into
// a base64-encoded string
function rawToBase64(raw) {
  var res = '';
  for (var i = 0, len = raw.length; i < len; i++) {
    res += intToString(raw[i]);
  }
  return base64.btoa(res);
}

function appendBuffer(buffer, data, start, end) {
  if (start > 0 || end < data.byteLength) {
    // only create a subarray if we really need to
    data = new Uint8Array(data, start,
      Math.min(end, data.byteLength) - start);
  }
  buffer.append(data);
}

function appendString(buffer, data, start, end) {
  if (start > 0 || end < data.length) {
    // only create a substring if we really need to
    data = data.substring(start, end);
  }
  buffer.appendBinary(data);
}

module.exports = toPromise(function (data, callback) {
  var inputIsString = typeof data === 'string';
  var len = inputIsString ? data.length : data.byteLength;
  var chunkSize = Math.min(MD5_CHUNK_SIZE, len);
  var chunks = Math.ceil(len / chunkSize);
  var currentChunk = 0;
  var buffer = inputIsString ? new Md5() : new Md5.ArrayBuffer();

  var append = inputIsString ? appendString : appendBuffer;

  function loadNextChunk() {
    var start = currentChunk * chunkSize;
    var end = start + chunkSize;
    currentChunk++;
    if (currentChunk < chunks) {
      append(buffer, data, start, end);
      setImmediateShim(loadNextChunk);
    } else {
      append(buffer, data, start, end);
      var raw = buffer.end(true);
      var base64 = rawToBase64(raw);
      callback(null, base64);
      buffer.destroy();
    }
  }
  loadNextChunk();
});
