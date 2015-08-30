'use strict';

// shim for Function.prototype.name,
// for browsers that don't support it like IE
if ((function f() {}).name) {
  module.exports = function (fun) {
    return fun.name;
  };
} else {
  module.exports = function (fun) {
    return fun.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];
  };
}
