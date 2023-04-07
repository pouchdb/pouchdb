"use strict";

module.exports = function enableDiskSize(app) {
  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-size'));
    }
  });
  app.dbWrapper.registerWrapper(function (name, db, next) {
    db.installSizeWrapper();
    return next();
  });
};
