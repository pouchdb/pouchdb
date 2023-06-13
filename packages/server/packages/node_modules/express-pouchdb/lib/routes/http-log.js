"use strict";

var onFinished      = require('on-finished'),
    utils           = require('../utils'),
    normalizeHeader = require('header-case-normalizer');

module.exports = function (app) {
  utils.requires(app, 'logging-infrastructure');

  app.use(function (req, res, next) {
    var method = req.method;
    var rawPath = utils.rawPath(req);
    var ip = req.ip;

    var str = "'{0}' {1} {1,1} from \"{2}\"\n"
      .replace('{0}', method)
      .replace('{1}', rawPath)
      .replace('{2}', ip);

    str += 'Headers: ' + formatHeaders(req.headers);
    app.couchLogger.debug(str);

    onFinished(res, function () {
      var msg = '{0} - - {1} {2} {3}'
        .replace('{0}', ip)
        .replace('{1}', method)
        .replace('{2}', rawPath)
        .replace('{3}', res.statusCode);
      app.couchLogger.info(msg);
    });
    next();
  });
};

function formatHeaders(headers) {
  var result = "[";
  var first = true;
  var keys = Object.keys(headers);
  keys.sort();
  keys.forEach(function (key) {
    if (first) {
      first = false;
    } else {
      result += ',\n          ';
    }
    var value = headers[key];

    result += "{'{0}', {1}}"
      .replace('{0}', normalizeHeader(key))
      .replace('{1}', value);
  });
  return result;
}
