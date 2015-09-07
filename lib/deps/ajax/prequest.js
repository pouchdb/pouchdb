'use strict';

var ajax = require('./ajaxCore');

module.exports = function(opts, callback) {
  // do nothing; all the action is in prerequest-browser.js
  return ajax(opts, callback);
};
