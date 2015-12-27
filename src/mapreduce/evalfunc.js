'use strict';

function evalfunc(func, emit, sum, log, isArray, toJSON) {
  /*jshint evil:true,unused:false */
  return eval("(" + func.replace(/;\s*$/, "") + ");");
}

export default evalfunc;
