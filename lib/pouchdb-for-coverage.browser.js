import './pouchdb-browser.browser.js';
import { uuid, defaultBackOff } from './pouchdb-utils.browser.js';
import { w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { m as merge } from './merge-7299d068.js';
import { t as thisAtob, a as thisBtoa } from './base64-browser-5f7b6479.js';
import { c as createBlob, a as binStringToBluffer } from './binaryStringToBlobOrBuffer-browser-7dc25c1d.js';
import { uniq, sequentialize, fin, callbackify, promisedCallback } from './pouchdb-mapreduce-utils.browser.js';
import { createError, generateErrorFromResponse, UNAUTHORIZED, MISSING_BULK_DOCS, MISSING_DOC, REV_CONFLICT, INVALID_ID, MISSING_ID, RESERVED_ID, NOT_OPEN, UNKNOWN_ERROR, BAD_ARG, INVALID_REQUEST, QUERY_PARSE_ERROR, DOC_VALIDATION, BAD_REQUEST, NOT_AN_OBJECT, DB_MISSING, WSQ_ERROR, LDB_ERROR, FORBIDDEN, INVALID_REV, FILE_EXISTS, MISSING_STUB, IDB_ERROR, INVALID_URL } from './pouchdb-errors.browser.js';
import generateReplicationId from './pouchdb-generate-replication-id.browser.js';
import Checkpointer from './pouchdb-checkpointer.browser.js';
import { p as parseUri } from './parseUri-b061a2c5.js';
import { r as rev } from './rev-5645662a.js';
import { c as clone } from './clone-abfcddc8.js';
import { p as parseDesignDocFunctionName, n as normalizeDesignDocFunctionName } from './normalizeDdocFunctionName-ea3481cf.js';
import { o as once, t as toPromise } from './toPromise-9dada06a.js';
import { u as upsert } from './upsert-331b6913.js';
import { a as collate } from './index-3a476dad.js';
import plugin from './pouchdb-find.browser.js';
import PouchDB from './pouchdb-core.browser.js';
import './pouchdb-adapter-idb.browser.js';
import './isLocalId-d067de54.js';
import './latest-0521537f.js';
import './parseDoc-5d2a34bd.js';
import './functionName-9335a350.js';
import './_commonjsHelpers-24198af3.js';
import './__node-resolve_empty-5ffda92e.js';
import './spark-md5-2c57e5fc.js';
import './preprocessAttachments-1767f4bd.js';
import './blobOrBufferToBase64-browser-cd22f32f.js';
import './readAsBinaryString-06e911ba.js';
import './binaryMd5-browser-ad85bb67.js';
import './readAsArrayBuffer-625b2d33.js';
import './processDocs-7ad6f99c.js';
import './revExists-12209d1c.js';
import './bulkGetShim-d4877145.js';
import './base64StringToBlobOrBuffer-browser-ac90e85f.js';
import './pouchdb-json.browser.js';
import './collectConflicts-6afe46fc.js';
import './guardedConsole-f54e5a40.js';
import './pouchdb-adapter-http.browser.js';
import './pouchdb-fetch.browser.js';
import './explainError-browser-c025e6c9.js';
import './flatten-994f45c6.js';
import './pouchdb-mapreduce.browser.js';
import './scopeEval-ff3a416d.js';
import './pouchdb-abstract-mapreduce.browser.js';
import './isRemote-f9121da9.js';
import './stringMd5-browser-5aecd2bd.js';
import './pouchdb-replication.browser.js';
import 'node:events';
import './findPathToLeaf-7e69c93c.js';
import './pouchdb-changes-filter.browser.js';
import './pouchdb-selector-core.browser.js';

//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
//


var utils = {
  blob: createBlob,
  parseUri: parseUri,
  uuid: uuid,
  rev: rev,
  Promise: Promise,
  atob: thisAtob,
  btoa: thisBtoa,
  binaryStringToBlobOrBuffer: binStringToBluffer,
  clone: clone,
  createError: createError,
  generateErrorFromResponse: generateErrorFromResponse,
  generateReplicationId: generateReplicationId,
  parseDdocFunctionName: parseDesignDocFunctionName,
  normalizeDdocFunctionName: normalizeDesignDocFunctionName,
  once: once,
  merge: merge,
  winningRev: winningRev,
  upsert: upsert,
  toPromise: toPromise,
  checkpointer: Checkpointer,
  defaultBackOff: defaultBackOff,
  assign: Object.assign,
  mapReduceUtils: {
    uniq: uniq,
    sequentialize: sequentialize,
    fin: fin,
    callbackify: callbackify,
    promisedCallback: promisedCallback
  }
};

var errors = {
  UNAUTHORIZED: UNAUTHORIZED,
  MISSING_BULK_DOCS: MISSING_BULK_DOCS,
  MISSING_DOC: MISSING_DOC,
  REV_CONFLICT: REV_CONFLICT,
  INVALID_ID: INVALID_ID,
  MISSING_ID: MISSING_ID,
  RESERVED_ID: RESERVED_ID,
  NOT_OPEN: NOT_OPEN,
  UNKNOWN_ERROR: UNKNOWN_ERROR,
  BAD_ARG: BAD_ARG,
  INVALID_REQUEST: INVALID_REQUEST,
  QUERY_PARSE_ERROR: QUERY_PARSE_ERROR,
  DOC_VALIDATION: DOC_VALIDATION,
  BAD_REQUEST: BAD_REQUEST,
  NOT_AN_OBJECT: NOT_AN_OBJECT,
  DB_MISSING: DB_MISSING,
  WSQ_ERROR: WSQ_ERROR,
  LDB_ERROR: LDB_ERROR,
  FORBIDDEN: FORBIDDEN,
  INVALID_REV: INVALID_REV,
  FILE_EXISTS: FILE_EXISTS,
  MISSING_STUB: MISSING_STUB,
  IDB_ERROR: IDB_ERROR,
  INVALID_URL: INVALID_URL
};

PouchDB.utils = utils;
PouchDB.Errors = errors;
PouchDB.collate = collate;
PouchDB.plugin(plugin);

export { PouchDB as default };
