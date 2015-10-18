/*jshint expr:true */
'use strict';

var Mapreduce = require('./mapreduce');

module.exports = function (dbName, dbType, Pouch) {

  Pouch.plugin(Mapreduce);

  var viewTypes = ['persisted', 'temp'];
  viewTypes.forEach(function (viewType) {
    var testSuiteName = 'abstract-mapreduce: ' + dbType + ' with ' +
      viewType + ' views:';
    describe(testSuiteName, function () {
      this.timeout(120000);
      tests(dbName, dbType, viewType);
    });
  });

  function tests(dbName, dbType, viewType) {
    require('./test.custom.js')(dbName, dbType, viewType, Pouch);
    require('./test.mapreduce.js')(dbName, dbType, viewType, Pouch);
    if (viewType === 'persisted') {
      require('./test.persisted.js')(dbName, dbType, viewType, Pouch);
    }
  }
};
