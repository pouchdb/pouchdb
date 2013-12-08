var PouchDB = require('../');

module.exports = {};

module.exports.clearDatabases = function(databases, done) {
  var count = databases.length;
  databases.forEach(function(dbName) {
    PouchDB.destroy(dbName, function() {
      if (!--count) done();
    });
  });
}
