'use strict';

module.exports = function (func, emit, sum, log, isArray, toJSON) {
  /*jshint evil:true,unused:false */
  return eval("(" + func.replace(/;\s*$/, "") + ");");
};
