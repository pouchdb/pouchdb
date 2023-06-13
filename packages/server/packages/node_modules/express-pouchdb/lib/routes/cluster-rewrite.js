'use strict';

module.exports = function (app) {
  app.use(function (req, res, next) {
    // magical route for "clustering" to support new Fauxton UI
    var regex = /^\/_node\/node1@127.0.0.1/;
    req.url = req.url.replace(regex, '');
    next();
  });
};
