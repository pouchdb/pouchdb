"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Revs Diff
  app.post('/:db/_revs_diff', utils.jsonParser, function (req, res) {
    var cb = utils.sendCallback(res);
    req.db.revsDiff(req.body || {}, utils.makeOpts(req), cb);
  });
};
