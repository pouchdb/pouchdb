"use strict";

var utils  = require('../utils'),
    extend = require('extend');

module.exports = function (app) {
  var histories = {};

  // Replicate a database
  app.post('/_replicate', utils.jsonParser, function (req, res) {

    var source = req.body.source,
        target = req.body.target,
        opts = utils.makeOpts(req, {continuous: !!req.body.continuous});

    if (req.body.filter) {
      opts.filter = req.body.filter;
    }
    if (req.body.query_params) {
      opts.query_params = req.body.query_params;
    }

    var startDate = new Date();
    // TODO: actually use the _replicator database
    req.PouchDB.replicate(source, target, opts).then(function (response) {

      var historyObj = extend(true, {
        start_time: startDate.toJSON(),
        end_time: new Date().toJSON()
      }, response);

      var currentHistories = [];

      if (!/^https?:\/\//.test(source)) {
        histories[source] = histories[source] || [];
        currentHistories.push(histories[source]);

      }
      if (!/^https?:\/\//.test(target)) {
        histories[target] = histories[target] || [];
        currentHistories.push(histories[target]);
      }

      currentHistories.forEach(function (history) {
        // CouchDB caps history at 50 according to
        // http://guide.couchdb.org/draft/replication.html
        history.push(historyObj);
        if (history.length > 50) {
          history.splice(0, 1); // TODO: this is slow, use a stack instead
        }
      });

      response.history = histories[source] || histories[target] || [];
      if (!opts.continuous) {
        utils.sendJSON(res, 200, response);
      }
    }, function (err) {
      console.log(err);
      console.log(err.stack);
      if (!opts.continuous) {
        utils.sendError(res, err);
      }
    });

    // if continuous pull replication return 'ok' since we cannot wait
    // for callback
    if (opts.continuous) {
      utils.sendJSON(res, 200, {ok: true});
    }
  });
};
