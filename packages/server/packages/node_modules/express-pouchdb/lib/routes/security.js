"use strict";

var Security = require('pouchdb-security');
var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(Security);
      Security.installStaticSecurityMethods(PouchDB);
    }
  });

  app.dbWrapper.registerWrapper(function (name, db, next) {
    db.installSecurityMethods();
    return next();
  });

  // Routing
  ['/:db/*', '/:db'].forEach(function (url) {
    app.use(url, function (req, res, next) {
      req.db.getSecurity().then(function (secObj) {
        req.couchSecurityObj = secObj;

        next();
      });
    });
  });

  app.get('/:db/_security', function (req, res) {
    req.db.getSecurity(utils.makeOpts(req), utils.sendCallback(res));
  });

  app.put('/:db/_security', utils.jsonParser, function (req, res) {
    var cb = utils.sendCallback(res);
    req.db.putSecurity(req.body || {}, utils.makeOpts(req), cb);
  });
};
