"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // List all databases.
  app.get('/_all_dbs', function (req, res) {
    req.PouchDB.allDbs(function (err, response) {
      if (err) {
        return utils.sendError(res, err);
      }

      response = response.filter(function (name) {
        return name !== 'pouch__auth_sessions__';
      });
      utils.sendJSON(res, 200, response);
    });
  });
};
