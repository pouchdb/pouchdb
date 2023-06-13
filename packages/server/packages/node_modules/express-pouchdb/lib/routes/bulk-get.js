"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Bulk docs operations
  app.post('/:db/_bulk_get', utils.jsonParser, function (req, res) {

    var opts = req.body || {};

    if (Array.isArray(req.body)) {
      return utils.sendJSON(res, 400, {
        error: "bad_request",
        reason: "Request body must be a JSON object"
      });
    }
    if (!req.body.docs) {
      return utils.sendJSON(res, 400, {
        error: "bad_request",
        reason: "Missing JSON list of 'docs'"
      });
    }

    if (typeof req.db.bulkGet !== 'function') {
      return utils.sendJSON(res, 400, {
        error: "bad_request",
        reason: "bulkGet not supported by this version of PouchDB"
      });
    }

    // some options can be specified via query, e.g. ?revs=true
    Object.keys(req.query).forEach(function (param) {
      opts[param] = req.query[param];
    });

    req.db.bulkGet(opts, function (err, response) {
      if (err) {
        return utils.sendError(res, err);
      }
      var httpResults = response.results.map(function (docInfo) {
        return {
          id: docInfo.id,
          docs: docInfo.docs.map(function (info) {
            if (info.error) {
              return {
                error: info.name,
                reason: info.message
              };
            }
            return info;
          })
        };
      });
      utils.sendJSON(res, 200, { results: httpResults });
    });
  });
};
