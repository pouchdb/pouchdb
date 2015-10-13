// shim for Function.prototype.name,
// for browsers that don't support it like IE

// We dont run coverage in IE
/* istanbul ignore else */
if ((function f() {}).name) {
  export default  function (fun) {
    return fun.name;
  };
} else {
  export default  function (fun) {
    return fun.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];
  };
}
