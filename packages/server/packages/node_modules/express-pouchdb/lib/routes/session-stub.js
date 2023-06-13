"use strict";

var utils = require('../utils');

// The PouchDB test suite needs some valid response at /_session. The
// full session support is quite heavy (in terms of amount of code), so
// this is a fallback that's enabled in the minimumForPouchDB profile.
module.exports = function (app) {
  if (app.includes.session) {
    // no need for the stub if the real thing is going to be used.
    return;
  }

  app.get('/_session', function (req, res) {
    utils.sendJSON(res, 200, {
      ok: true,
      userCtx: {
        name: null,
        roles: ['_admin']
      }
    });
  });
};
