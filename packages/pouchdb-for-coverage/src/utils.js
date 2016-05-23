//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
//

import ajax from 'pouchdb-ajax';

import {
  parseUri,
  uuid,
  clone,
  parseDdocFunctionName,
  normalizeDdocFunctionName,
  once,
  upsert,
  toPromise,
  defaultBackOff
} from 'pouchdb-utils';

import {
  merge,
  winningRev
} from 'pouchdb-merge';

import {
  atob,
  btoa,
  binaryStringToBlobOrBuffer,
  blob
} from 'pouchdb-binary-utils';

import {
  uniq,
  sequentialize,
  fin,
  callbackify,
  promisedCallback
} from 'pouchdb-mapreduce-utils';

import Promise from 'pouchdb-promise';

import { createError } from 'pouchdb-errors';

import { extend } from 'js-extend';

import generateReplicationId from 'pouchdb-generate-replication-id';
import checkpointer from 'pouchdb-checkpointer';

export default {
  ajax: ajax,
  blob: blob,
  parseUri: parseUri,
  uuid: uuid,
  Promise: Promise,
  atob: atob,
  btoa: btoa,
  binaryStringToBlobOrBuffer: binaryStringToBlobOrBuffer,
  clone: clone,
  extend: extend,
  createError: createError,
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
  mapReduceUtils: {
    uniq: uniq,
    sequentialize: sequentialize,
    fin: fin,
    callbackify: callbackify,
    promisedCallback: promisedCallback
  }
};