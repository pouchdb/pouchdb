// shim for Function.prototype.name,
// for browsers that don't support it like IE

/* istanbul ignore next */
function f() {}

var hasName = f.name;
var res;

// We don't run coverage in IE
/* istanbul ignore else */
if (hasName) {
  res = function (fun) {
    return fun.name;
  };
} else {
  res = function (fun) {
    var match = fun.toString().match(/^\s*function\s*(?:(\S+)\s*)?\(/);
    if (match && match[1]) {
      return match[1];
    }
    else {
      return '';
    }
  };
}

export default res;
