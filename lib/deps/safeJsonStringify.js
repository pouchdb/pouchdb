'use strict';

var vuvuzela = require('vuvuzela');

module.exports = function safeJsonStringify(json) {
  try {
    return JSON.stringify(json);
  } catch (e) {
    /* istanbul ignore next */
    return vuvuzela.stringify(json);
  }
};