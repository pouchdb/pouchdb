"use strict";

var utils = require('../utils'),
    uuids = require('../uuids');

module.exports = function (app) {
  utils.requires(app, 'config-infrastructure');

  app.couchConfig.registerDefault('uuids', 'max_count', 1000);

  // Generate UUIDs
  app.all('/_uuids', utils.restrictMethods(["GET"]), function (req, res) {
    res.set({
      "Cache-Control": "must-revalidate, no-cache",
      "Pragma": "no-cache"
    });
    var count = typeof req.query.count === 'number' ? req.query.count : 1;
    if (count > app.couchConfig.get('uuids', 'max_count')) {
      return utils.sendJSON(res, 403, {
        error: "forbidden",
        reason: "count parameter too large"
      });
    }
    utils.sendJSON(res, 200, {
      uuids: uuids(count)
    });
  });
};
