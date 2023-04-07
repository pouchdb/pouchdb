"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'logging-infrastructure');

  // Log
  app.get('/_log', function (req, res) {
    var bytes = req.query.bytes || 1000;
    var offset = req.query.offset || 0;

    app.couchLogger.getLog(bytes, offset, function (err, log) {
      if (err) {
        return utils.sendError(res, err);
      }
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.set('Content-Length', log.length);
      log.stream.pipe(res);
    });
  });
};
