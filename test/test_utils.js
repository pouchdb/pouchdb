
'use strict';

var utils = {};

utils.COUCH_HOST = 'http://127.0.0.1:5985';

utils.clearDatabases = function(databases, done) {
  var count = databases.length;
  databases.forEach(function(dbName) {
    PouchDB.destroy(dbName, function() {
      if (!--count) done();
    });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  var PouchDB = require('../');
  module.exports = utils;
}
