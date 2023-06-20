//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
//

import {
  parseUri,
  uuid,
  rev,
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


import {
  createError,
  generateErrorFromResponse
} from 'pouchdb-errors';

import generateReplicationId from 'pouchdb-generate-replication-id';
import checkpointer from 'pouchdb-checkpointer';

export default {
  blob: blob,
  parseUri: parseUri,
  uuid: uuid,
  rev: rev,
  Promise: Promise,
  atob: atob,
  btoa: btoa,
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
