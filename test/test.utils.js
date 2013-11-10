'use strict';

var PouchDB = require('../');

module.exports.setupDb = function() {

  var dbs = Array.prototype.slice.call(arguments);

  var deleteDatabases = function(t) {
    t.plan(dbs.length)

    var done = function(err) {
      t.ok(!(err && err.status !== 404), 'Deleting database');
    };

    dbs.forEach(function(db) {
      PouchDB.destroy(db, done);
    });
  };

  // We delete databases once the tests have completed, but we also
  // need to do it during setup in case of test crashes
  return {
    setup: deleteDatabases,
    teardown: deleteDatabases
  };

};

