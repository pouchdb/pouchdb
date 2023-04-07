"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // 404 handler
  app.use(function (req, res) {
    utils.sendJSON(res, 404, {
      error: "not_found",
      reason: "missing"
    });
  });
};
