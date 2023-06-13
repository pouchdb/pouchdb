"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-update'));
    }
  });

  // Query design document update handler
  function handler(req, res) {
    var baseQuery = [req.params.id, req.params.func].join("/");
    var query = baseQuery + req.params[0];
    var cb = utils.sendCouchDBResp.bind(null, res);
    req.db.update(query, req.couchDBReq, cb);
  }
  app.all('/:db/_design/:id/_update/:func*',
    utils.couchDBReqMiddleware, handler
  );
};
