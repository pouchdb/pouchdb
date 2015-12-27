// shim for Function.prototype.name,
// for browsers that don't support it like IE

// We dont run coverage in IE
/* istanbul ignore else */
var res;
if ((function f() {}).name) {
  res = function (fun) {
    return fun.name;
  };
} else {
  res = function (fun) {
    return fun.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];
  };
}

export default res;
