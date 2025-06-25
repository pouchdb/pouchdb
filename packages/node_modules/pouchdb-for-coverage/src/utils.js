//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
//

import {
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
  blob,
  uuid,
  rev,
  atob,
  btoa,
  binaryStringToBlobOrBuffer,
  clone,
  createError,
  generateErrorFromResponse,
  generateReplicationId,
  parseDdocFunctionName,
  normalizeDdocFunctionName,
  once,
  merge,
  winningRev,
  upsert,
  toPromise,
  checkpointer,
  defaultBackOff,
  assign: Object.assign,
  mapReduceUtils: {
    uniq,
    sequentialize,
    fin,
    callbackify,
    promisedCallback
  }
};
