import PouchDB from 'pouchdb-lib/lib/pouchdb-node.js';
export { default } from 'pouchdb-lib/lib/pouchdb-node.js';
import { parseUri, uuid, defaultBackOff } from './pouchdb-utils.js';
import { w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { m as merge } from './merge-1e46cced.js';
import { b as binStringToBluffer } from './binaryStringToBlobOrBuffer-39ece35b.js';
import { uniq, sequentialize, fin, callbackify, promisedCallback } from './pouchdb-mapreduce-utils.js';
import { createError, generateErrorFromResponse, UNAUTHORIZED, MISSING_BULK_DOCS, MISSING_DOC, REV_CONFLICT, INVALID_ID, MISSING_ID, RESERVED_ID, NOT_OPEN, UNKNOWN_ERROR, BAD_ARG, INVALID_REQUEST, QUERY_PARSE_ERROR, DOC_VALIDATION, BAD_REQUEST, NOT_AN_OBJECT, DB_MISSING, WSQ_ERROR, LDB_ERROR, FORBIDDEN, INVALID_REV, FILE_EXISTS, MISSING_STUB, IDB_ERROR, INVALID_URL } from './pouchdb-errors.js';
import generateReplicationId from './pouchdb-generate-replication-id.js';
import Checkpointer from './pouchdb-checkpointer.js';
import { r as rev } from './rev-591f7bff.js';
import { c as clone } from './clone-3530a126.js';
import { p as parseDesignDocFunctionName, n as normalizeDesignDocFunctionName } from './normalizeDdocFunctionName-ea3481cf.js';
import { o as once } from './once-de8350b9.js';
import { u as upsert } from './upsert-331b6913.js';
import { t as toPromise } from './toPromise-42fa3440.js';
import * as collate from 'pouchdb-lib/lib/pouchdb-collate.js';
import find from 'pouchdb-lib/lib/pouchdb-find.js';
import './functionName-56a2e70f.js';
import 'crypto';
import 'node:events';
import './nextTick-ea093886.js';
import './guardedConsole-f54e5a40.js';
import './flatten-994f45c6.js';
import './isRemote-2533b7cb.js';
import './scopeEval-ff3a416d.js';
import './stringMd5-15f53eba.js';
import 'clone-buffer';
import './typedBuffer-a8220a49.js';
import './binaryMd5-601b2421.js';
import './pouchdb-collate.js';

//

var utils = {
  parseUri: parseUri,
  uuid: uuid,
  rev: rev,
  Promise: Promise,
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
PouchDB.plugin(find);
