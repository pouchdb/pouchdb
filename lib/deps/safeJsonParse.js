'use strict';

var vuvuzela = require('vuvuzela');

module.exports = function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    /* istanbul ignore next */
    return vuvuzela.parse(str);
  }
};