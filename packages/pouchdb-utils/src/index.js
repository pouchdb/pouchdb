import adapterFun from './adapterFun';
import bulkGetShim from './bulkGetShim';
import clone from './clone';
import explainError from './explainError';
import isDeleted from './docs/isDeleted';
import isLocalId from './docs/isLocalId';
import normalizeDdocFunctionName from './docs/normalizeDdocFunctionName';
import parseDdocFunctionName from './docs/parseDdocFunctionName';
import { parseDoc, invalidIdError} from './docs/parseDoc';
import preprocessAttachments from './docs/preprocessAttachments';
import processDocs from './docs/processDocs';
import updateDoc from './docs/updateDoc';
import hasLocalStorage from './env/hasLocalStorage';
import isChromeApp from './env/isChromeApp';
import extend from './extend';
import filterChange from './filterChange';
import flatten from './flatten';
import functionName from './functionName';
import isCordova from './isCordova';
import collectConflicts from './merge/collectConflicts';
import collectLeaves from './merge/collectLeaves';
import compactTree from './merge/compactTree';
import merge from './merge/index';
import revExists from './merge/revExists';
import rootToLeaf from './merge/rootToLeaf';
import traverseRevTree from './merge/traverseRevTree';
import winningRev from './merge/winningRev';
import once from './once';
import parseUri from './parseUri';
import pick from './pick';
import toPromise from './toPromise';
import upsert from './upsert';
import uuid from './uuid';
import changesHandler from './changesHandler';
import defaultBackOff from './defaultBackOff';

export {
  adapterFun,
  bulkGetShim,
  changesHandler,
  clone,
  collectConflicts,
  collectLeaves,
  compactTree,
  defaultBackOff,
  explainError,
  extend,
  filterChange,
  flatten,
  functionName,
  hasLocalStorage,
  invalidIdError,
  isChromeApp,
  isCordova,
  isDeleted,
  isLocalId,
  merge,
  normalizeDdocFunctionName,
  once,
  parseDdocFunctionName,
  parseDoc,
  parseUri,
  pick,
  preprocessAttachments,
  processDocs,
  revExists,
  rootToLeaf,
  toPromise,
  traverseRevTree,
  updateDoc,
  upsert,
  uuid,
  winningRev
};
