'use strict';

var PouchDB = require('./pouchdb');

// Some tests explicitly override this; also it's useful to have
// it attached to utils for the custom builds, although it's a little awkward.
PouchDB.ajax = PouchDB.utils.ajax = require('../lib/deps/ajax/prequest');

var httpAdapter = require('../lib/adapters/http');
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);