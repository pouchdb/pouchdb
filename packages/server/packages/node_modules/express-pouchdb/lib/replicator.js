"use strict";

var Promise = require('pouchdb-promise');
var utils = require('./utils');
var getOrCreateDB = require('./create-or-delete-dbs').getOrCreateDB;

module.exports = function enableReplicator(app) {
  var db, PouchDB;

  utils.requires(app, 'config-infrastructure');

  // explain how to activate the replicator db logic.
  app.dbWrapper.registerWrapper(function (name, db, next) {
    if (name === getReplicatorDBName()) {
      return db.useAsReplicatorDB();
    }
    return next();
  });

  app.couchConfig.registerDefault('replicator', 'db', '_replicator');
  function getReplicatorDBName() {
    return app.couchConfig.get('replicator', 'db');
  }

  app.couchConfig.on('replicator.db', restartDaemon);

  function onDestroy(dbName) {
    // if the replicator db was removed, it should re-appear.
    if (dbName === getReplicatorDBName()) {
      restartDaemon();
    }
  }

  function restartDaemon() {
    return daemon.stop().then(function () {
      return daemon.start();
    });
  }

  var currentActions = Promise.resolve();
  function serialExecution(func) {
    currentActions = currentActions.then(func);
    return currentActions;
  }

  var daemon = {
    start: function (thePouchDB) {
      if (thePouchDB) {
        PouchDB = thePouchDB;

        PouchDB.plugin(require('pouchdb-replicator'));
      }
      if (PouchDB.isHTTPPouchDB) {
        return;
      }

      return serialExecution(function () {
        var name = getReplicatorDBName();
        return getOrCreateDB(PouchDB, name).then(function (db) {
          PouchDB.on('destroyed', onDestroy);
          return db.startReplicatorDaemon();
        });
      });
    },
    stop: function () {
      if (PouchDB.isHTTPPouchDB) {
        return;
      }
      return serialExecution(function () {
        PouchDB.removeListener('destroyed', onDestroy);
        // stop old replicator daemon
        return Promise.resolve().then(function () {
          return db.stopReplicatorDaemon();
        }).catch(function () {
          // no worries if stopping failed, the database is probably
          // just not there (or deleted).
        });
      });
    }
  };

  app.daemonManager.registerDaemon(daemon);
};
