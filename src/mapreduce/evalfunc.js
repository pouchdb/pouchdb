function evalfunc(func, emit, sum, log, isArray, toJSON) {
  // wrap so that Rollup + minification still works well
  return (function () {
    /*jshint evil:true,unused:false */
    eval("(" + func.replace(/;\s*$/, "") + ");");
  })();
}

export default evalfunc;
