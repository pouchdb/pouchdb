"use strict";

var utils = require('../utils');
var Promise = require('pouchdb-promise');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Put a document attachment
  function putAttachment(db, name, req, res) {
    utils.parseRawBody(req, res, function () {
      var attachment = req.params.attachment,
          rev = req.query.rev,
          type = req.get('Content-Type') || 'application/octet-stream',
          body = new Buffer(req.rawBody || '', 'binary'),
          opts = utils.makeOpts(req);

      function cb(err, response) {
        if (err) {
          return utils.sendError(res, err);
        }
        res.set('ETag', JSON.stringify(response.rev));
        var attachmentURI = encodeURIComponent(attachment);
        utils.setLocation(res, db + '/' + name + '/' + attachmentURI);
        utils.sendJSON(res, 201, response);
      }
      req.db.putAttachment(name, attachment, rev, body, type, opts, cb);
    });
  }

  app.put('/:db/_design/:id/:attachment(*)', function (req, res) {
    putAttachment(req.params.db, '_design/' + req.params.id, req, res);
  });

  app.put('/:db/:id/:attachment(*)', function (req, res, next) {
    // Be careful not to catch normal design docs or local docs
    if (req.params.id === '_design' || req.params.id === '_local') {
      return next();
    }
    putAttachment(req.params.db, req.params.id, req, res);
  });

  // Retrieve a document attachment
  function getAttachment(name, req, res) {
    var attachment = req.params.attachment;
    var opts = utils.makeOpts(req, req.query);

    return Promise.all([
      req.db.get(name, opts),
      req.db.getAttachment(name, attachment, opts)
    ]).then(function (results) {
      var doc = results[0];
      var att = results[1];

      var attInfo = doc._attachments && doc._attachments[attachment];

      if (!attInfo) {
        return utils.sendJSON(res, 404, {
          error: 'not_found',
          reason: 'missing'
        });
      }

      var type = attInfo.content_type;
      var md5 = attInfo.digest.slice(4);

      res.set('ETag', JSON.stringify(md5));
      res.setHeader('Content-Type', type);
      // attachments can be Blobs
      if (typeof Blob !== 'undefined' && att instanceof Blob) {
        var reader = new FileReader();
        reader.onload = function() {
          res.status(200).send(new Buffer(reader.result));
        };
        reader.onerror = function () {
          utils.sendError(res, reader.error);
        };
        reader.readAsArrayBuffer(att);
      // or Buffers
      } else {
        res.status(200).send(att);
      }
    }).catch(function (err) {
      utils.sendError(res, err);
    });
  }

  app.get('/:db/_design/:id/:attachment(*)', function (req, res) {
    getAttachment('_design/' + req.params.id, req, res);
  });

  app.get('/:db/:id/:attachment(*)', function (req, res, next) {
    // Be careful not to catch normal design docs or local docs
    if (req.params.id === '_design' || req.params.id === '_local') {
      return next();
    }
    getAttachment(req.params.id, req, res);
  });

  // Delete a document attachment
  function deleteAttachment(name, req, res) {
    var attachment = req.params.attachment,
        rev = req.query.rev,
        opts = utils.makeOpts(req);

    function cb(err, response) {
      if (err) {
        return utils.sendError(res, err);
      }
      utils.sendJSON(res, 200, response);
    }
    req.db.removeAttachment(name, attachment, rev, opts, cb);
  }

  app.delete('/:db/_design/:id/:attachment(*)', function (req, res) {
    deleteAttachment('_design/' + req.params.id, req, res);
  });

  app.delete('/:db/:id/:attachment(*)', function (req, res, next) {
    // Be careful not to catch normal design docs or local docs
    if (req.params.id === '_design' || req.params.id === '_local') {
      return next();
    }
    deleteAttachment(req.params.id, req, res);
  });
};
