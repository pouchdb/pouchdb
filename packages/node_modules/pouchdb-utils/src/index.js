import { v4 } from 'uuid';

import adapterFun from './adapterFun';
import bulkGetShim from './bulkGetShim';
import changesHandler from './changesHandler';
import clone from './clone';
import guardedConsole from './guardedConsole';
import defaultBackOff from './defaultBackOff';
import explainError from './explainError';
import filterChange from './filterChange';
import functionName from './functionName';
import hasLocalStorage from './env/hasLocalStorage';
import invalidIdError from './invalidIdError';
import isRemote from './isRemote';
import listenerCount from './listenerCount';
import nextTick from './nextTick';
import normalizeDdocFunctionName from './normalizeDdocFunctionName';
import once from './once';
import parseDdocFunctionName from './parseDdocFunctionName';
import pick from './pick';
import scopeEval from './scopeEval';
import toPromise from './toPromise';
import upsert from './upsert';
import rev from './rev';

var uuid = v4; // mimic old import, only v4 is ever used elsewhere

export {
  adapterFun,
  bulkGetShim,
  changesHandler,
  clone,
  defaultBackOff,
  explainError,
  filterChange,
  functionName,
  guardedConsole,
  hasLocalStorage,
  invalidIdError,
  isRemote,
  listenerCount,
  nextTick,
  normalizeDdocFunctionName,
  once,
  parseDdocFunctionName,
  pick,
  rev,
  scopeEval,
  toPromise,
  upsert,
  uuid
};
