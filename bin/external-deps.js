'use strict';

// When building with Rollup, there are some core CommonJS deps
// that we always want to ignore. This list should be updated when
// we add new deps to the sub-modules' package.json.

module.exports = [
  // main deps
  'argsarray', 'debug', 'double-ended-queue', 'es3ify', 'fruitdown',
  'inherits', 'js-extend', 'level-write-stream', 'levelup', 'lie',
  'localstorage-down', 'memdown', 'pouchdb-collate', 'pouchdb-collections',
  'request', 'scope-eval', 'spark-md5', 'sublevel-pouchdb', 'through2',
  'vuvuzela', 'leveldown', 'websql',
  // core node deps
  'fs', 'crypto', 'events', 'path',
  // pouchdb itself ( for the levelalt adapters )
  'pouchdb'
];