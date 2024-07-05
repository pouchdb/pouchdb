import vm from 'vm';
import createBuiltInError from './createBuiltInError';
import sum from './sum';

// Inside of 'vm' for Node, we need a way to translate a pseudo-error
// back into a real error once it's out of the VM.
function createBuiltInErrorInVm(name) {
  return {
    builtInError: true,
    name
  };
}

function convertToTrueError(err) {
  return createBuiltInError(err.name);
}

function isBuiltInError(obj) {
  return obj && obj.builtInError;
}

// All of this vm hullaballoo is to be able to run arbitrary code in a sandbox
// for security reasons.
function evalFunctionInVm(func, emit) {
  return function (arg1, arg2, arg3) {
    var code = '(function() {"use strict";' +
      'var createBuiltInError = ' + createBuiltInErrorInVm.toString() + ';' +
      'var sum = ' + sum.toString() + ';' +
      'var log = function () {};' +
      'var isArray = Array.isArray;' +
      'var toJSON = JSON.parse;' +
      'var __emitteds__ = [];' +
      'var emit = function (key, value) {__emitteds__.push([key, value]);};' +
      'var __result__ = (' +
      func.replace(/;\s*$/, '') + ')' + '(' +
      JSON.stringify(arg1) + ',' +
      JSON.stringify(arg2) + ',' +
      JSON.stringify(arg3) + ');' +
      'return {result: __result__, emitteds: __emitteds__};' +
      '})()';

    var output = vm.runInNewContext(code);

    output.emitteds.forEach(function (emitted) {
      emit(emitted[0], emitted[1]);
    });
    if (isBuiltInError(output.result)) {
      output.result = convertToTrueError(output.result);
    }
    return output.result;
  };
}

export default evalFunctionInVm;
