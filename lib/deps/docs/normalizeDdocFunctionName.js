'use strict';

var parseDdocFunctionName = require('./parseDdocFunctionName');

export default  function normalizeDesignDocFunctionName(s) {
  var normalized = parseDdocFunctionName(s);
  return normalized ? normalized.join('/') : null;
};