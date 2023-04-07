"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // inspired by special_test_authentication_handler/1 in:
  // couchdb-couch/src/couch_httpd_auth.erl
  utils.requires(app, 'config-infrastructure');

  app.use(function (req, res, next) {
    var value = app.couchConfig.get('httpd', 'authentication_handlers') || "";
    if (value.indexOf('special_test_authentication_handler') === -1) {
      return next();
    }

    var header = req.get('WWW-Authenticate') || "";
    if (header.indexOf('X-Couch-Test-Auth ') !== 0) {
      // No X-Couch-Test-Auth credentials sent, give admin access so the
      // previous authentication can be restored after the test
      return setSession(req, {
        roles: ['_admin']
      }, next);
    }
    var namePass = header.slice('X-Couch-Test-Auth '.length);
    var name = namePass.split(':')[0];
    var pass = namePass.split(':')[1];

    var expectedPw = {
      "Jan Lehnardt": "apple",
      "Christopher Lenz": "dog food",
      "Noah Slater": "biggiesmalls endian",
      "Chris Anderson": "mp3",
      "Damien Katz": "pecan pie"
    }[name];
    if (expectedPw !== pass) {
      return utils.sendJSON(res, 401, {
        error: 'unauthorized',
        reason: "Name or password is incorrect."
      });
    }
    setSession(req, {
      name: name
    }, next);
  });
};

function setSession(req, userCtx, next) {
  if (!userCtx.roles) {
    userCtx.roles = [];
  }
  req.couchSession = {
    ok: true,
    userCtx: userCtx,
    authenticated: 'special',
  };
  next();
}
