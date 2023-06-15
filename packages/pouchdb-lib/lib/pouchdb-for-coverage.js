import './pouchdb-node.js';
import { u as uuid } from './index-f8a9e0ec.js';
import { w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { m as merge } from './merge-1e46cced.js';
import { b as binStringToBluffer } from './binaryStringToBlobOrBuffer-3ba36433.js';
import { u as uniq, s as sequentialize, f as fin, a as callbackify, p as promisedCallback } from './index-bd745a58.js';
import { c as createError, g as generateErrorFromResponse, m as UNAUTHORIZED, b as MISSING_BULK_DOCS, M as MISSING_DOC, R as REV_CONFLICT, I as INVALID_ID, j as MISSING_ID, k as RESERVED_ID, d as NOT_OPEN, U as UNKNOWN_ERROR, h as BAD_ARG, n as INVALID_REQUEST, Q as QUERY_PARSE_ERROR, D as DOC_VALIDATION, B as BAD_REQUEST, N as NOT_AN_OBJECT, o as DB_MISSING, W as WSQ_ERROR, L as LDB_ERROR, F as FORBIDDEN, a as INVALID_REV, p as FILE_EXISTS, e as MISSING_STUB, l as IDB_ERROR, q as INVALID_URL } from './functionName-97119de9.js';
import generateReplicationId from './pouchdb-generate-replication-id.js';
import Checkpointer from './pouchdb-checkpointer.js';
import { r as rev } from './rev-75d26c01.js';
import { c as clone } from './clone-9d9f421b.js';
import { p as parseDesignDocFunctionName, n as normalizeDesignDocFunctionName } from './normalizeDdocFunctionName-ea3481cf.js';
import { o as once } from './once-de8350b9.js';
import { u as upsert } from './upsert-bb51d1b8.js';
import { t as toPromise } from './toPromise-05472f25.js';
import { d as defaultBackOff } from './index-cb44dfd9.js';
import { a as collate } from './index-7f131e04.js';
import { p as plugin } from './index-b3add1a7.js';
import PouchDB from './pouchdb-core.js';
export { default } from './pouchdb-core.js';
import './pouchdb-adapter-leveldb.js';
import './index-aa99f286.js';
import './_commonjsHelpers-24198af3.js';
import 'events';
import 'util';
import 'buffer';
import './inherits-febe64f8.js';
import 'stream';
import 'assert';
import './index-977ff4f9.js';
import 'node:events';
import './allDocsKeysQuery-9ff66512.js';
import './collectConflicts-ad0b7c70.js';
import './latest-0521537f.js';
import './isLocalId-d067de54.js';
import './binaryMd5-601b2421.js';
import 'crypto';
import './processDocs-62433f84.js';
import './index-15c7260a.js';
import './revExists-12209d1c.js';
import './safeJsonStringify-6520e306.js';
import './typedBuffer-a8220a49.js';
import './nextTick-ea093886.js';
import './changesHandler-c020580c.js';
import './pick-60e95b5a.js';
import './filterChange-0090dde4.js';
import 'node:fs';
import 'node:path';
import 'fs';
import 'path';
import 'os';
import 'node:stream';
import 'http';
import 'url';
import './abort-controller-08d1ea45.js';
import 'punycode';
import 'https';
import 'zlib';
import './v4-b7ee9c0c.js';
import './guardedConsole-f54e5a40.js';
import './isRemote-2533b7cb.js';
import './findPathToLeaf-7e69c93c.js';
import 'pouchdb-utils.js';
import './pouchdb-changes-filter.js';
import './matches-selector-e1c3dac5.js';
import 'vm';
import './pouchdb-mapreduce.js';
import './flatten-994f45c6.js';
import './base64StringToBlobOrBuffer-3fd03be6.js';
import './pouchdb-crypto.js';

// originally parseUri 1.2.2, now patched by us
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
var keys = ["source", "protocol", "authority", "userInfo", "user", "password",
    "host", "port", "relative", "path", "directory", "file", "query", "anchor"];
var qName ="queryKey";
var qParser = /(?:^|&)([^&=]*)=?([^&]*)/g;

// use the "loose" parser
/* eslint no-useless-escape: 0 */
var parser = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

function parseUri(str) {
  var m = parser.exec(str);
  var uri = {};
  var i = 14;

  while (i--) {
    var key = keys[i];
    var value = m[i] || "";
    var encoded = ['user', 'password'].indexOf(key) !== -1;
    uri[key] = encoded ? decodeURIComponent(value) : value;
  }

  uri[qName] = {};
  uri[keys[12]].replace(qParser, function ($0, $1, $2) {
    if ($1) {
      uri[qName][$1] = $2;
    }
  });

  return uri;
}

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
