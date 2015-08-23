'use strict';

var RECURSIVE_JSON_LIMIT = 10000;

var vuvuzela = require('vuvuzela');

// isolate in its own function because it will be deoptimized
function tryCatchJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return vuvuzela.parse(str);
  }
}

exports.safeJsonParse = function safeJsonParse(str) {
  // if a string is below a certain size, it is unlikely to throw
  // a "call stack size exceeded" error, so avoid the deoptimized
  // try-catch function as a perf boost
  if (str.length < RECURSIVE_JSON_LIMIT) {
    return JSON.parse(str);
  }
  return tryCatchJsonParse(str);
};

exports.safeJsonStringify = function safeJsonStringify(json) {
  try {
    return JSON.stringify(json);
  } catch (e) {
    return vuvuzela.stringify(json);
  }
};