'use strict';

exports.safeJsonParse = function safeJsonParse(str) {
  return JSON.parse(str);
};

exports.safeJsonStringify = function safeJsonStringify(json) {
  return JSON.stringify(json);
};
