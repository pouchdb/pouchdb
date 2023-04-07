"use strict";

var fs         = require('fs'),
    multiparty = require('multiparty'),
    utils      = require('../utils'),
    uuids      = require('../uuids'),
    extend     = require('extend'),
    Promise    = require('pouchdb-promise'),
    denodeify  = require('denodeify'),
    readFile   = denodeify(fs.readFile);

function onPutOrPostResponse(req, res) {
  return function (response) {
    res.set('ETag', '"' + response.rev + '"');
    utils.setLocation(res, req.params.db + '/' + response.id);
    utils.sendJSON(res, 201, response);
  };
}

function mergeAttachments(doc, attachments) {
  if (!doc._attachments) {
    doc._attachments = {};
  }

  // don't store the "follows" key
  Object.keys(doc._attachments).forEach(function (filename) {
    delete doc._attachments[filename].follows;
  });
  // merge, since it could be a mix of stubs and non-stubs
  doc._attachments = extend(true, doc._attachments, attachments);
}

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  if (app.couchConfig) {
    app.use('/' +
      app.couchConfig.get('couch_httpd_auth', 'authentication_db') + '/:id',
      function (req, res, next) {
        var userCtx = (req.couchSession || {}).userCtx;
        if (userCtx && userCtx.name && !~userCtx.roles.indexOf('_admin')) {
          req.db.get(req.params.id, function (err, response) {
            if (!err && response.name === userCtx.name) {
              userCtx.roles.push('_admin');
            }
            next();
          });
          return;
        }
        next();
      }
    );
  }

  // Slightly unusual endpoint where you can POST an attachment to a doc.
  // Used by the Fauxton UI for uploading attachments.
  app.post('/:db/:id(*)', utils.jsonParser, function (req, res) {
    if (!/^multipart\/form-data/.test(req.headers['content-type'])) {
      return utils.sendJSON(res, 400, {
        error: "bad_request",
        reason: "only_multipart_accepted"
      });
    }

    var opts = utils.makeOpts(req, req.query);

    var promise = Promise.resolve();
    var attachments = {};
    var form = new multiparty.Form();
    var doc;
    form.on('error', function (err) {
      promise = promise.then(function () {
        throw err;
      });
    }).on('field', function (name, field) {
      if (name !== '_rev') {
        return;
      }
      promise = promise.then(function () {
        return req.db.get(req.params.id, {rev: field});
      }).then(function (theDoc) {
        doc = theDoc;
      });
    }).on('file', function (_, file) {
      var type = file.headers['content-type'];
      var filename = file.originalFilename;
      promise = promise.then(function () {
        return readFile(file.path);
      }).then(function (body) {
        attachments[filename] = {
          content_type: type,
          data: body
        };
      });
    }).on('close', function () {
      promise.then(function () {
        if (!doc) {
          var err = new Error('bad_request');
          err.reason = 'no_doc_provided';
          err.status = 400;
          throw err;
        }
        mergeAttachments(doc, attachments);
        return req.db.put(doc, opts);
      }).then(
        onPutOrPostResponse(req, res)
      ).catch(function (err) {
        utils.sendError(res, err);
      });
    });
    form.parse(req);
  });

  // Create or update document that has an ID
  app.put('/:db/:id(*)', utils.jsonParser, function (req, res) {

    var opts = utils.makeOpts(req, req.query);

    if (/^multipart\/related/.test(req.headers['content-type'])) {
      var doc;
      var promise = Promise.resolve();
      var form = new multiparty.Form();
      var attachments = {};
      form.on('error', function (err) {
        promise = promise.then(function () {
          throw err;
        });
      }).on('field', function (_, field) {
        doc = JSON.parse(field);
      }).on('file', function (_, file) {
        var type = file.headers['content-type'];
        var filename = file.originalFilename;
        promise = promise.then(function () {
          return readFile(file.path);
        }).then(function (body) {
          attachments[filename] = {
            content_type: type,
            data: body
          };
        });
      }).on('close', function () {
        promise.then(function () {
          mergeAttachments(doc, attachments);
          return req.db.put(doc, opts);
        }).then(
          onPutOrPostResponse(req, res)
        ).catch(function (err) {
          utils.sendError(res, err);
        });
      });
      form.parse(req);
    } else {
      // normal PUT
      req.body._id = req.body._id || req.query.id;
      if (!req.body._id) {
        req.body._id = (!!req.params.id && req.params.id !== 'null') ?
          req.params.id : null;
      }
      req.body._rev = getRev(req, req.body);
      req.db.put(req.body, opts).then(
        onPutOrPostResponse(req, res)
      ).catch(function (err) {
        utils.sendError(res, err);
      });
    }
  });

  function getRev(req, doc) {
    return doc._rev || req.query.rev;
  }

  // Create a document
  app.post('/:db', utils.jsonParser, function (req, res) {
    var opts = utils.makeOpts(req, req.query);

    req.body._id = req.body._id || uuids(1)[0];
    req.db.put(req.body, opts, function (err, response) {
      if (err) {
        return utils.sendError(res, err);
      }
      utils.setLocation(res, req.params.db + '/' + response.id);
      utils.sendJSON(res, 201, response);
    });
  });

  // Retrieve a document
  app.get('/:db/:id(*)', function (req, res) {
    var opts = utils.makeOpts(req, req.query);

    req.db.get(req.params.id, opts, function (err, doc) {
      if (err) {
        return utils.sendError(res, err);
      }

      utils.sendJSON(res, 200, doc);
    });
  });

  // Delete a document
  app.delete('/:db/:id(*)', function (req, res) {
    var opts = utils.makeOpts(req, req.query);
    opts.rev = getRev(req, {});

    req.db.get(req.params.id, opts, function (err, doc) {
      if (err) {
        return utils.sendError(res, err);
      }
      req.db.remove(doc, opts, function (err, response) {
        if (err) {
          return utils.sendError(res, err);
        }
        utils.sendJSON(res, 200, response);
      });
    });
  });

  // Copy a document
  app.copy('/:db/:id', function (req, res) {
    var dest = req.get('Destination');
    var rev, match;

    if (!dest) {
      return utils.sendJSON(res, 400, {
        'error': 'bad_request',
        'reason': 'Destination header is mandatory for COPY.'
      });
    }

    if (isHTTP(dest) || isHTTPS(dest)) {
      return utils.sendJSON(res, 400, {
        'error': 'bad_request',
        'reason': 'Destination URL must be relative.'
      });
    }

    if ((match = /(.+?)\?rev=(.+)/.exec(dest))) {
      dest = match[1];
      rev = match[2];
    }

    var opts = utils.makeOpts(req, req.query);

    req.db.get(req.params.id, opts, function (err, doc) {
      if (err) {
        return utils.sendError(res, err);
      }
      doc._id = dest;
      doc._rev = rev;
      req.db.put(doc, opts, function (err) {
        if (err) {
          return utils.sendError(res, err, 409);
        }
        utils.sendJSON(res, 201, {ok: true});
      });
    });
  });
};

function isHTTP(url) {
  return hasPrefix(url, 'http://');
}

function isHTTPS(url) {
  return hasPrefix(url, 'https://');
}

function hasPrefix(haystack, needle) {
  return haystack.substr(0, needle.length) === needle;
}
