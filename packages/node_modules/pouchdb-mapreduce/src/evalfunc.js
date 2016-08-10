import scopedEval from 'scope-eval';

function evalfunc(func, emit, sum, log, isArray, toJSON) {
  return scopedEval(
    "return (" + func.replace(/;\s*$/, "") + ");",
    {
      emit: emit,
      sum: sum,
      log: log,
      isArray: isArray,
      toJSON: toJSON
    }
  );
}

export default evalfunc;
