import { g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';

var argsarray = argsArray;

function argsArray(fun) {
  return function () {
    var len = arguments.length;
    if (len) {
      var args = [];
      var i = -1;
      while (++i < len) {
        args[i] = arguments[i];
      }
      return fun.call(this, args);
    } else {
      return fun.call(this, []);
    }
  };
}

var argsarray$1 = /*@__PURE__*/getDefaultExportFromCjs(argsarray);

export { argsarray$1 as a, argsarray as b };
