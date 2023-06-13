"use strict";

var events = require('events');

module.exports = function (app) {
  // init DbUpdates
  var couchDbUpdates = new events.EventEmitter();

  function onDBCreated(dbName) {
    couchDbUpdates.emit('update', {db_name: dbName, type: 'created'});
  }
  function onDBDestroyed(dbName) {
    couchDbUpdates.emit('update', {db_name: dbName, type: 'deleted'});
  }
  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.on('created', onDBCreated);
      PouchDB.on('destroyed', onDBDestroyed);
    },
    stop: function (PouchDB) {
      PouchDB.removeListener('created', onDBCreated);
      PouchDB.removeListener('destroyed', onDBDestroyed);
    }
  });

  app.all('/_db_updates', function (req, res) {
    // TODO: implement
    res.status(400).end();
    // app.couch_db_updates.on('update', function(update) {
    //   utils.sendJSON(res, 200, update);
    // });
  });
};
