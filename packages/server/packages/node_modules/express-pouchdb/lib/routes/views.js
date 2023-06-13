"use strict";

var utils = require('../utils'),
    extend = require('extend');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.all('/:db/_design/:id/_view/:view', utils.jsonParser,
      function (req, res, next) {
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

    var query = req.params.id + '/' + req.params.view;
    var opts = utils.makeOpts(req, extend({}, req.body, req.query));
    req.db.query(query, opts, utils.sendCallback(res));
  });
};
