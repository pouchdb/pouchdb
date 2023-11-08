import { guardedConsole, scopeEval } from 'pouchdb-utils';
import sum from './sum';

var log = guardedConsole.bind(null, 'log');
var isArray = Array.isArray;
var toJSON = JSON.parse;

function evalFunctionWithEval(func, emit) {
  return scopeEval(
    "return (" + func.replace(/;\s*$/, "") + ");",
    {
      emit,
      sum,
      log,
      isArray,
      toJSON
    }
  );
}

export default evalFunctionWithEval;
