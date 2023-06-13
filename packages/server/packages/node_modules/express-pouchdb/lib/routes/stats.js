"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // Stats (stub for now)
  app.get('/_stats', function (req, res) {
    // TODO: implement
    utils.sendJSON(res, 200, {
      'pouchdb-server': 'has not impemented _stats yet. PRs welcome!'
    });
  });
};
