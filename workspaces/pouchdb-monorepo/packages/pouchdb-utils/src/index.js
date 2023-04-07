import adapterFun from './adapterFun';
import bulkGetShim from './bulkGetShim';
import { ChangesHandler } from './ChangesHandler';
import clone from './clone';
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
import { default as rev, uuid } from '../../pouchdb-core/src/rev';

//var uuid = v4; // mimic old import, only v4 is ever used elsewhere
// import { v4 } from 'uuid';
export {
  adapterFun,
  assign,
  bulkGetShim,
  ChangesHandler,
  ChangesHandler as changesHandler,
  clone,
  defaultBackOff,
  explainError,
  filterChange,
  flatten,
  functionName,
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
