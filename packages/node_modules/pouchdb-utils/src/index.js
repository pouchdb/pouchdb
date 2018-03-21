import uuidV4 from 'uuid';

import adapterFun from './adapterFun';
import bulkGetShim from './bulkGetShim';
import changesHandler from './changesHandler';
import clone from './clone';
import guardedConsole from './guardedConsole';
import defaultBackOff from './defaultBackOff';
import explainError from './explainError';
import assign from './assign';
import filterChange from './filterChange';
import flatten from './flatten';
import functionName from './functionName';
import hasLocalStorage from './env/hasLocalStorage';
import invalidIdError from './invalidIdError';
import isRemote from './isRemote';
import listenerCount from './listenerCount';
import nextTick from './nextTick';
import normalizeDdocFunctionName from './normalizeDdocFunctionName';
import once from './once';
import parseDdocFunctionName from './parseDdocFunctionName';
import parseUri from './parseUri';
import pick from './pick';
import scopeEval from './scopeEval';
import toPromise from './toPromise';
import upsert from './upsert';
import rev from './rev';

var uuid = uuidV4.v4;

export {
  adapterFun,
  assign,
  bulkGetShim,
  changesHandler,
  clone,
  defaultBackOff,
  explainError,
  filterChange,
  flatten,
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
  parseUri,
  pick,
  rev,
  scopeEval,
  toPromise,
  upsert,
  uuid
};
