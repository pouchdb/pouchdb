import './pouchdb-node.js';
import { parseUri, uuid, rev, clone, parseDdocFunctionName, normalizeDdocFunctionName, once, upsert, toPromise, defaultBackOff } from 'pouchdb-utils';
import { merge, winningRev } from 'pouchdb-merge';
import { binaryStringToBlobOrBuffer } from 'pouchdb-binary-utils';
import { uniq, sequentialize, fin, callbackify, promisedCallback } from 'pouchdb-mapreduce-utils';
import { createError, generateErrorFromResponse, UNAUTHORIZED, MISSING_BULK_DOCS, MISSING_DOC, REV_CONFLICT, INVALID_ID, MISSING_ID, RESERVED_ID, NOT_OPEN, UNKNOWN_ERROR, BAD_ARG, INVALID_REQUEST, QUERY_PARSE_ERROR, DOC_VALIDATION, BAD_REQUEST, NOT_AN_OBJECT, DB_MISSING, WSQ_ERROR, LDB_ERROR, FORBIDDEN, INVALID_REV, FILE_EXISTS, MISSING_STUB, IDB_ERROR, INVALID_URL } from 'pouchdb-errors';
import generateReplicationId from 'pouchdb-generate-replication-id';
import checkpointer from 'pouchdb-checkpointer';
import * as collate from 'pouchdb-collate';
import find from 'pouchdb-find';
import PouchDB from 'pouchdb-core';
export { default } from 'pouchdb-core';
import 'pouchdb-adapter-leveldb';
import 'pouchdb-adapter-http';
import 'pouchdb-mapreduce';
import 'pouchdb-replication';

//

var utils = {
  parseUri: parseUri,
  uuid: uuid,
  rev: rev,
  Promise: Promise,
  binaryStringToBlobOrBuffer: binaryStringToBlobOrBuffer,
  clone: clone,
  createError: createError,
  generateErrorFromResponse: generateErrorFromResponse,
  generateReplicationId: generateReplicationId,
  parseDdocFunctionName: parseDdocFunctionName,
  normalizeDdocFunctionName: normalizeDdocFunctionName,
  once: once,
  merge: merge,
  winningRev: winningRev,
  upsert: upsert,
  toPromise: toPromise,
  checkpointer: checkpointer,
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
