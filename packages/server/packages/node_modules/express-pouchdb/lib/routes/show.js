"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-show'));
    }
  });

  // Query design document show handler
  function handler(req, res) {
    var queryBase = [req.params.id, req.params.func].join("/");
    var query = queryBase + req.params[0];
    var cb = utils.sendCouchDBResp.bind(null, res);
    req.db.show(query, req.couchDBReq, cb);
  }
  app.all('/:db/_design/:id/_show/:func*',
    utils.couchDBReqMiddleware, handler
  );
};
