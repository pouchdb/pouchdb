'use strict';

// TODO: used by the integration tests and elsewhere, possibly
// even in the PouchDB guide and example code
var PouchDB = require('./pouchdb');
PouchDB.utils.Promise = typeof Promise === 'function' ?
  Promise : require('lie');