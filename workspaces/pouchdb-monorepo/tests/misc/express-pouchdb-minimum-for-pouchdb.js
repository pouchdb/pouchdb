'use strict';

var PouchDB = require('../../');

var app = require('express-pouchdb')(PouchDB, {
  mode: 'minimumForPouchDB'
});
app.listen(3000);
