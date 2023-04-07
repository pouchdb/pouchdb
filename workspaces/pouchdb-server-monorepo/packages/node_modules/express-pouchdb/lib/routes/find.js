"use strict";

var utils = require('../utils');

/* endpoint authorization handled by pouchdb-security & pouchdb-system-db */

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-find'));
    }
  });

  app.get('/:db/_index', function (req, res) {
    req.db.getIndexes(utils.sendCallback(res));
  });

  app.post('/:db/_index', utils.jsonParser, function (req, res) {
    req.db.createIndex(req.body, utils.sendCallback(res, 400));
  });

  app.delete('/:db/_index/:ddoc/:type/:name', function (req, res) {
    req.db.deleteIndex({
      ddoc: req.params.ddoc,
      type: req.params.type,
      name: req.params.name
    }, utils.sendCallback(res));
  });

  app.post('/:db/_find', utils.jsonParser, function (req, res) {
    req.db.find(req.body, utils.sendCallback(res, 400));
  });

  app.post('/:db/_explain', utils.jsonParser, function (req, res) {
    req.db.explain(req.body, utils.sendCallback(res, 400));
  });
};
