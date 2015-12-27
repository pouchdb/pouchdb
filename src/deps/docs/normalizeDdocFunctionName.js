'use strict';

import parseDdocFunctionName from './parseDdocFunctionName';

module.exports = function normalizeDesignDocFunctionName(s) {
  var normalized = parseDdocFunctionName(s);
  return normalized ? normalized.join('/') : null;
};