"use strict";

var utils = require('../utils');
var REGEX = /\/([^\/]*)\/_design\/([^\/]*)\/_rewrite\/([^?]*)/;
var cleanFilename = require('../clean-filename');

module.exports = function (app) {
  utils.requires(app, 'routes/db');
  utils.requires(app, 'config-infrastructure');
  utils.requires(app, 'logging-infrastructure');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-rewrite'));
    }
  });
  app.couchConfig.registerDefault('httpd', 'rewrite_limit', 100);

  function rewriteMiddleware(req, res, next, rewritesSoFar) {
    // Prefers regex over setting the first argument of app.use(), because
    // the last makes req.url relative, which in turn makes most rewrites
    // impossible.

    var match = REGEX.exec(req.url);
    if (!match) {
      return next();
    }
    if (rewritesSoFar >= app.couchConfig.get('httpd', 'rewrite_limit')) {
      return utils.sendJSON(res, 400, {
        error: 'bad_request',
        reason: "Exceeded rewrite recursion limit"
      });
    }

    var dbName = cleanFilename(decodeURIComponent(match[1]));
    utils.setDBOnReq(dbName, app.dbWrapper, req, res, function () {
      var query = match[2] + "/" + match[3];
      var opts = utils.expressReqToCouchDBReq(req);
      // We don't know opts.path yet - that's the point.
      delete opts.path;
      req.db.rewriteResultRequestObject(query, opts, function (err, resp) {
        if (err) {
          return utils.sendError(res, err);
        }

        req.rawBody = resp.body;
        req.cookies = resp.cookie;
        req.headers = resp.headers;
        req.method = resp.method;
        req.url = "/" + resp.path.join("/");
        req.query = resp.query;

        app.couchLogger.debug('rewrite to "' + req.url + '"');
        // Handle the newly generated request.
        rewriteMiddleware(req, res, next, rewritesSoFar + 1);
      });
    });
  }

  // Query design document rewrite handler
  app.use(function (req, res, next) {
    rewriteMiddleware(req, res, next, 0);
  });
};
