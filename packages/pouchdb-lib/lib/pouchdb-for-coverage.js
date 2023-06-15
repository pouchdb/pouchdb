import './pouchdb-node.js';
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
import { a as collate } from './index-7f131e04.js';
import plugin from './pouchdb-find.js';
import PouchDB from './pouchdb-core.js';
export { default } from './pouchdb-core.js';
import './pouchdb-adapter-leveldb.js';
import './index-1f480111.js';
import 'levelup';
import './index-1b39f5b0.js';
import 'ltgt';
import './pouchdb-platform.js';
import 'node:assert';
import 'node:fs';
import 'node:buffer';
import 'node:events';
import 'node:crypto';
import 'node:stream';
import 'node:http';
import 'node:url';
import 'node:https';
import 'node:zlib';
import 'node:util';
import 'node:vm';
import 'node:path';
import 'node:os';
import 'level-codec';
import 'stream';
import 'events';
import 'buffer';
import 'util';
import 'double-ended-queue';
import './allDocsKeysQuery-7f4fbcb9.js';
import './parseDoc-a0994e12.js';
import './collectConflicts-ad0b7c70.js';
import './latest-0521537f.js';
import './isLocalId-d067de54.js';
import './binaryMd5-601b2421.js';
import 'crypto';
import './processDocs-2980e64a.js';
import './functionName-56a2e70f.js';
import 'clone-buffer';
import './revExists-12209d1c.js';
import './safeJsonStringify-a65d9a0c.js';
import 'vuvuzela';
import './typedBuffer-a8220a49.js';
import './nextTick-ea093886.js';
import 'level';
import 'level-write-stream';
import './fetch-ad491323.js';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import 'fetch-cookie';
import './stringMd5-15f53eba.js';
import './guardedConsole-f54e5a40.js';
import './isRemote-2533b7cb.js';
import './findPathToLeaf-7e69c93c.js';
import 'pouchdb-utils.js';
import './pouchdb-changes-filter.js';
import './matches-selector-02a28973.js';
import 'vm';
import './flatten-994f45c6.js';
import './scopeEval-ff3a416d.js';
import './pouchdb-adapter-http.js';
import './pouchdb-mapreduce.js';
import './pouchdb-abstract-mapreduce.js';
import './base64StringToBlobOrBuffer-3fd03be6.js';
import './pouchdb-crypto.js';
import './pouchdb-replication.js';

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
