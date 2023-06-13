// 'use strict'; is default when ESM

var PouchDB = require('pouchdb');

var app = require('../packages/node_modules/express-pouchdb')(PouchDB, {
  mode: 'minimumForPouchDB',
  // Interim overrides until the pouchdb test suite properly detects
  // the distinction between the fullCouchDB/minimumForPouchDB modes.
  overrideMode: {
    'include': [
      'validation',
      'routes/replicate'
    ]
  }
});
app.listen(6984);
