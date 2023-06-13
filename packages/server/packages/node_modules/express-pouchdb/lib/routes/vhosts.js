"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'config-infrastructure');
  utils.requires(app, 'logging-infrastructure');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      require('pouchdb-vhost')(PouchDB);
    }
  });

  // Query design document rewrite handler
  app.use(function (req, res, next) {
    var couchReq = utils.expressReqToCouchDBReq(req);
    var vhosts = app.couchConfig.getSection('vhosts');
    var newUrl = req.PouchDB.resolveVirtualHost(couchReq, vhosts);

    if (newUrl !== req.url) {
      req.url = newUrl;
      app.couchLogger.debug("Vhost Target: '\"" + newUrl + "\"'");
    }
    next();
  });
};
