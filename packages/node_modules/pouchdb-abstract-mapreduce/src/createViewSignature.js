function stringify(input) {
  if (!input) {
    return 'undefined'; // backwards compat for empty reduce
  }
  // for backwards compat with mapreduce, functions/strings are stringified
  // as-is. everything else is JSON-stringified.
  switch (typeof input) {
    case 'function':
      // e.g. a mapreduce map
      return input.toString();
    case 'string':
      // e.g. a mapreduce built-in _reduce function
      return input.toString();
    default:
      // e.g. a JSON object in the case of mango queries
      return JSON.stringify(input);
  }
}

/* create a string signature for a view so we can cache it and uniq it */
function createViewSignature(mapFun, reduceFun) {
  // the "undefined" part is for backwards compatibility
  return stringify(mapFun) + stringify(reduceFun) + 'undefined';
}

export default createViewSignature;
