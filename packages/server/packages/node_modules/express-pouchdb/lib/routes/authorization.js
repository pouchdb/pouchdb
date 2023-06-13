"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/authentication');

  // routes that need server admin protection
  app.get('/_config', requiresServerAdmin);
  app.get('/_config/:section', requiresServerAdmin);
  app.get('/_config/:section/:key', requiresServerAdmin);
  app.put('/_config/:section/:key', requiresServerAdmin);
  app.delete('/_config/:section/:key', requiresServerAdmin);

  app.get('/_log', requiresServerAdmin);
  app.get('/_active_tasks', requiresServerAdmin);
  app.get('/_db_updates', requiresServerAdmin);
  app.post('/_restart', requiresServerAdmin);

  function requiresServerAdmin(req, res, next) {
    if (req.couchSession.userCtx.roles.indexOf('_admin') !== -1) {
      return next();
    }
    utils.sendJSON(res, 401, {
      error: 'unauthorized',
      reason: "You are not a server admin."
    });
  }
};
