"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // Active tasks (stub for now)
  app.get('/_active_tasks', function (req, res) {
    // TODO: implement
    utils.sendJSON(res, 200, []);
  });
};
