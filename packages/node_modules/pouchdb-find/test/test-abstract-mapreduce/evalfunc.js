'use strict';

// eslint-disable-next-line no-unused-vars
module.exports = function (func, emit, sum, log, isArray, toJSON) {
  return eval("'use strict'; (" + func.replace(/;\s*$/, "") + ");");
};
