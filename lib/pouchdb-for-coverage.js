import './pouchdb-node.js';
import { uuid, defaultBackOff } from './pouchdb-utils.js';
import { w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { m as merge } from './merge-7299d068.js';
import { b as binStringToBluffer } from './binaryStringToBlobOrBuffer-39ece35b.js';
import { uniq, sequentialize, fin, callbackify, promisedCallback } from './pouchdb-mapreduce-utils.js';
import { createError, generateErrorFromResponse, UNAUTHORIZED, MISSING_BULK_DOCS, MISSING_DOC, REV_CONFLICT, INVALID_ID, MISSING_ID, RESERVED_ID, NOT_OPEN, UNKNOWN_ERROR, BAD_ARG, INVALID_REQUEST, QUERY_PARSE_ERROR, DOC_VALIDATION, BAD_REQUEST, NOT_AN_OBJECT, DB_MISSING, WSQ_ERROR, LDB_ERROR, FORBIDDEN, INVALID_REV, FILE_EXISTS, MISSING_STUB, IDB_ERROR, INVALID_URL } from './pouchdb-errors.js';
import generateReplicationId from './pouchdb-generate-replication-id.js';
import Checkpointer from './pouchdb-checkpointer.js';
import { p as parseUri } from './parseUri-6d6043cb.js';
import { r as rev } from './rev-fc9bde4f.js';
import { c as clone } from './clone-7eeb6295.js';
import { p as parseDesignDocFunctionName, n as normalizeDesignDocFunctionName } from './normalizeDdocFunctionName-ea3481cf.js';
import { o as once, t as toPromise } from './toPromise-1031f2f4.js';
import { u as upsert } from './upsert-331b6913.js';
import { a as collate } from './index-3a476dad.js';
import plugin from './pouchdb-find.js';
import PouchDB from './pouchdb-core.js';
import './pouchdb-adapter-leveldb.js';
import './index-fef66c7c.js';
import './_commonjsHelpers-24198af3.js';
import 'events';
import 'util';
import 'buffer';
import './index-a12c08e4.js';
import 'node:events';
import 'stream';
import 'assert';
import './allDocsKeysQuery-9ff66512.js';
import './parseDoc-4c54e1d0.js';
import './collectConflicts-6afe46fc.js';
import './latest-0521537f.js';
import './isLocalId-d067de54.js';
import './binaryMd5-601b2421.js';
import 'crypto';
import './processDocs-3dd3facd.js';
import './functionName-706c6c65.js';
import './revExists-12209d1c.js';
import './pouchdb-json.js';
import './typedBuffer-a8220a49.js';
import './nextTick-ea093886.js';
import 'node:fs';
import 'node:path';
import 'fs';
import 'path';
import 'os';
import 'node:stream';
import './pouchdb-adapter-http.js';
import './pouchdb-crypto.js';
import './pouchdb-fetch.js';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import './bulkGetShim-df36314d.js';
import './flatten-994f45c6.js';
import './base64StringToBlobOrBuffer-3fd03be6.js';
import './blobOrBufferToBase64-e67e02aa.js';
import './pouchdb-mapreduce.js';
import 'vm';
import './guardedConsole-f54e5a40.js';
import './scopeEval-ff3a416d.js';
import './pouchdb-abstract-mapreduce.js';
import './isRemote-f9121da9.js';
import './pouchdb-replication.js';
import './stringMd5-15f53eba.js';
import './findPathToLeaf-7e69c93c.js';
import './pouchdb-changes-filter.js';
import './pouchdb-selector-core.js';

//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
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
PouchDB.plugin(plugin);

export { PouchDB as default };
