"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // Query design document info
  app.get('/:db/_design/:id/_info', function (req, res) {
    // TODO: Dummy data for Fauxton - when implementing fully also take into
    // account req.couchSessionObj - this needs at least db view rights it
    // seems.
    //
    // Also, if the implementation uses req.db, don't forget to add
    // utils.requires(app, 'routes/db') at the top of the main function
    // of this file.
    utils.sendJSON(res, 200, {
      'name': req.query.id,
      'view_index': 'Not implemented.'
    });
  });
};
