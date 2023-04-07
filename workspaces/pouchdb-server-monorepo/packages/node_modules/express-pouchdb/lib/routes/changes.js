"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Monitor database changes
  function changes(req, res) {

    utils.setJsonOrPlaintext(res);

    if (req.query.limit < 1) {
      req.query.limit = 1;
    }

    // api.changes expects a property `query_params`
    // This is a pretty inefficient way to do it.. Revisit?
    req.query.query_params = JSON.parse(JSON.stringify(req.query));

    req.query = utils.makeOpts(req, req.query);

    if (req.body && req.body.doc_ids) {
      req.query.doc_ids = req.body.doc_ids;
    }

    if (req.query.feed === 'continuous' || req.query.feed === 'longpoll') {
      var heartbeatInterval;
      // 60000 is the CouchDB default
      // TODO: figure out if we can make this default less aggressive
      var heartbeat = (typeof req.query.heartbeat === 'number') ?
        req.query.heartbeat : 6000;
      var written = false;
      heartbeatInterval = setInterval(function () {
        written = true;
        res.write('\n');
      }, heartbeat);

      var cleanup = function () {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      };

      if (req.query.feed === 'continuous') {
        req.query.live = req.query.continuous = true;
        req.db.changes(req.query).on('change', function (change) {
          written = true;
          utils.writeJSON(res, change);
        }).on('error', function (err) {
          if (!written) {
            utils.sendError(res, err);
          } else {
            res.end();
          }
          cleanup();
        });
      } else { // longpoll
        // first check if there are >0. if so, return them immediately
        req.query.live = req.query.continuous = false;
        req.db.changes(req.query).then(function (complete) {
          if (complete.results.length) {
            utils.writeJSON(res, complete);
            res.end();
            cleanup();
          } else { // do the longpolling
            // mimicking CouchDB, start sending the JSON immediately
            res.write('{"results":[\n');
            req.query.live = req.query.continuous = true;
            var changes = req.db.changes(req.query)
              .on('change', function (change) {
                utils.writeJSON(res, change);
                res.write('],\n"last_seq":' + change.seq + '}\n');
                res.end();
                changes.cancel();
                cleanup();
                req.connection.removeListener('close', cancelChanges);
              }).on('error', function (err) {
                // shouldn't happen
                console.log(err);
                res.end();
                cleanup();
                req.connection.removeListener('close', cancelChanges);
              }).on('complete', function () {
                cleanup();
                req.connection.removeListener('close', cancelChanges);
              });

            var cancelChanges = function () {
              changes.cancel();
            }

            req.connection.on('close', cancelChanges);
          }
        }, function (err) {
          if (!written) {
            utils.sendError(res, err);
          }
          cleanup();
        });
      }
    } else { // straight shot, not continuous
      req.db.changes(req.query).then(function (response) {
        utils.sendJSON(res, 200, response);
      }).catch(function (err) {
        utils.sendError(res, err);
      });
    }
  }
  app.get('/:db/_changes', changes);
  app.post('/:db/_changes', utils.jsonParser, changes);
};
