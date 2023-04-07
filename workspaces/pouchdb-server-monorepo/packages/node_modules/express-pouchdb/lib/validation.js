"use strict";

module.exports = function enableValidation(app) {
  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-validation'));
    }
  });

  app.dbWrapper.registerWrapper(function (name, db, next) {
    db.installValidationMethods();

    next();
  });
};
