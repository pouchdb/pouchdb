"use strict";

var corser = require('corser');

module.exports = function (config) {
  var corsMiddleware;
  function corsChanged() {
    if (config.get('httpd', 'enable_cors')) {
      var origins = config.get('cors', 'origins');
      if (origins === '*') {
        origins = undefined;
      }
      if (origins) {
        origins = origins.split(', ');
      }

      corsMiddleware = corser.create({
        methods: config.get('cors', 'methods').split(', '),
        supportsCredentials: config.get('cors', 'credentials'),
        requestHeaders: config.get('cors', 'headers').split(', '),
        origins: origins
      });
    } else {
      corsMiddleware = null;
    }
  }

  [
    ['httpd', 'enable_cors', true],
    ['cors', 'credentials', true],
    ['cors', 'methods', 'GET, HEAD, POST, PUT, DELETE, COPY'],
    ['cors', 'origins', '*'],
    ['cors', 'headers', corser.simpleRequestHeaders.concat([
      'Authorization', 'Origin', 'Referer'
    ]).join(', ')],
  ].forEach(function (info) {
    config.registerDefault.apply(config, info);
    config.on(info[0] + '.' + info[1], corsChanged);
  });
  corsChanged();

  return function (req, res, next) {
    if (!corsMiddleware) {
      return next();
    }
    corsMiddleware(req, res, next);
  };
};
