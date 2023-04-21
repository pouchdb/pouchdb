import {  scopeEval } from '../../pouchdb-utils';
import sum from './sum';

const { log } = console;

const isArray = Array.isArray;
const toJSON = JSON.parse;

function evalFunctionWithEval(func, emit) {
  return scopeEval(
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

export default evalFunctionWithEval;
