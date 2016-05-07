//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
//

// TODO: only used by the unit tests
import ajax from 'pouchdb-ajax';

// TODO: only used by the integration and unit tests
import {
  parseUri,
  uuid,
  atob,
  btoa,
  binaryStringToBlobOrBuffer,
  clone,
  parseDdocFunctionName,
  normalizeDdocFunctionName,
  once,
  merge,
  winningRev,
  upsert,
  toPromise
} from 'pouchdb-utils';

// TODO: only used by the unit tests
import {
  utils as mapReduceUtils
} from 'pouchdb-mapreduce';

// TODO: used by the integration tests and elsewhere, possibly
// even in the PouchDB guide and example code
import Promise from 'pouchdb-promise';

// TODO: required by tests
import { createError } from 'pouchdb-errors';

// TODO: pretty sure these are in widespread use by Hoodie and others,
// also in the integration tests
import { extend } from 'js-extend';

// TODO: bunch of stuff only required by the coverage tests
import generateReplicationId from 'pouchdb-generate-replication-id';

export default {
  ajax: ajax,
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
  mapReduceUtils: mapReduceUtils,
  upsert: upsert,
  toPromise: toPromise
};