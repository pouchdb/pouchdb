"use strict";

var utils       = require('../utils'),
    extend      = require('extend'),
    evalSafely  = require('../eval-safely');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Temp Views
  app.all('/:db/_temp_view', utils.jsonParser, function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'POST' &&
        req.method !== 'HEAD') {
      return next();
    }
    // Check that the request body, if present, is an object.
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body))) {
      return utils.sendJSON(res, 400, {
        reason: "Request body must be a JSON object",
        error: 'bad_request'
      });
    }
    if (req.body.map) {
      req.body.map = evalSafely(req.body.map);
    }
    var opts = utils.makeOpts(req, extend({}, req.body, req.query));
    req.db.query(req.body, opts, utils.sendCallback(res));
  });
};
