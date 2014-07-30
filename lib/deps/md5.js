'use strict';

var crypto = require('crypto');
var Md5 = require('spark-md5');
var setImmediateShim = global.setImmediate || global.setTimeout;

function sliceShim(arrayBuffer, begin, end) {
  if (typeof arrayBuffer.slice === 'function') {
    return arrayBuffer.slice(begin, end);
  }
  //
  // shim for IE courtesy of http://stackoverflow.com/a/21440217
  //
  
  //If `begin`/`end` is unspecified, Chrome assumes 0, so we do the same
  //Chrome also converts the values to integers via flooring
  begin = Math.floor(begin || 0);
  end = Math.floor(end || 0);

  var len = arrayBuffer.byteLength;

  //If either `begin` or `end` is negative, it refers to an
  //index from the end of the array, as opposed to from the beginning.
  //The range specified by the `begin` and `end` values is clamped to the
  //valid index range for the current array.
  begin = begin < 0 ? Math.max(begin + len, 0) : Math.min(len, begin);
  end = end < 0 ? Math.max(end + len, 0) : Math.min(len, end);

  //If the computed length of the new ArrayBuffer would be negative, it
  //is clamped to zero.
  if (end - begin <= 0) {
    return new ArrayBuffer(0);
  }

  var result = new ArrayBuffer(end - begin);
  var resultBytes = new Uint8Array(result);
  var sourceBytes = new Uint8Array(arrayBuffer, begin, end - begin);

  resultBytes.set(sourceBytes);

  return result;
}

module.exports = function (data, callback) {
  if (!process.browser) {
    callback(null, crypto.createHash('md5').update(data).digest('hex'));
    return;
  }
  var chunkSize = Math.min(524288, data.length);
  var chunks = Math.ceil(data.length / chunkSize);
  var currentChunk = 0;
  var buffer = new Md5();
  function loadNextChunk() {
    var start = currentChunk * chunkSize;
    var end = start + chunkSize;
    if ((start + chunkSize) >= data.size) {
      end = data.size;
    }
    currentChunk++;
    if (currentChunk < chunks) {
      buffer.append(sliceShim(data, start, end));
      setImmediateShim(loadNextChunk);
    } else {
      buffer.append(sliceShim(data, start, end));
      callback(null, buffer.end());
      buffer.destroy();
    }
  }
  loadNextChunk();
};
