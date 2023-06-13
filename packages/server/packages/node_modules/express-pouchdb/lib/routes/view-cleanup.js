"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // View Cleanup
  app.post('/:db/_view_cleanup', utils.jsonParser, function (req, res) {
    req.db.viewCleanup(utils.makeOpts(req), utils.sendCallback(res));
  });
};
