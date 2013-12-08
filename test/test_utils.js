
'use strict';

var utils = {};

if (typeof module !== 'undefined' && module.exports) {
  var PouchDB = require('../');
  module.exports = utils;
}

utils.clearDatabases = function(databases, done) {
  var count = databases.length;
  databases.forEach(function(dbName) {
    PouchDB.destroy(dbName, function() {
      if (!--count) done();
    });
  });
}
