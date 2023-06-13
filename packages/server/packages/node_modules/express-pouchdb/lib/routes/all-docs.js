"use strict";

var utils  = require('../utils'),
    extend = require('extend');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  var isAllowedMethod = function (method, allowedMethods) {
    return allowedMethods.indexOf(method) !== -1;
  };

  // All docs operations
  app.all('/:db/_all_docs', utils.jsonParser, function (req, res, next) {
    if (!isAllowedMethod(req.method, ['GET', 'HEAD', 'POST'])) {
      return next();
    }

    // Check that the request body, if present, is an object.
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body))) {
      return utils.sendJSON(res, 400, {
        reason: "Request body must be a JSON object",
        error: 'bad_request'
      });
    }

    var opts = utils.makeOpts(req, extend({}, req.body, req.query));
    req.db.allDocs(opts, utils.sendCallback(res, 400));
  });
};
