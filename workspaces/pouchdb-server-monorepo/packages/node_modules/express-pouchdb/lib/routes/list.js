"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-list'));
    }
  });

  // Query design document list handler
  function handler(req, res) {
    var queryParts = [req.params.id, req.params.func];
    if ('id2' in req.params) {
      queryParts.push(req.params.id2);
    }
    queryParts.push(req.params.view);
    var query = queryParts.join("/");
    var cb = utils.sendCouchDBResp.bind(null, res);
    req.db.list(query, req.couchDBReq, cb);
  }
  app.all('/:db/_design/:id/_list/:func/:view',
    utils.couchDBReqMiddleware, handler
  );
  app.all('/:db/_design/:id/_list/:func/:id2/:view',
    utils.couchDBReqMiddleware, handler
  );
};
