"use strict";

var pathResolve = require('path').resolve;
var rawBody = require('raw-body');
var Promise = require('pouchdb-promise');
var mkdirp = require('mkdirp');
var cleanFilename = require('./clean-filename');
var getOrCreateDB = require('./create-or-delete-dbs').getOrCreateDB;

//shared middleware

exports.maxDocumentSizeDefault = 4 * 1024 * 1024 * 1024;

function buildJSONParser(tolerateInvalid) {
  return function (req, res, next) {
    var limit;
    if (req.app.couchConfig) {
      limit = req.app.couchConfig.get('couchdb', 'max_document_size');
    } else {
      limit = exports.maxDocumentSizeDefault;
    }
    var jsonParser = require('body-parser').json({limit: limit});
    jsonParser(req, res, function (err) {
      if (err) {
        if (err.status === 400) {
          if (!tolerateInvalid) {
            return exports.sendJSON(res, 400, {
              error: "bad_request",
              reason: "invalid_json"
            });
          }
        } else if (err.status === 413) {
          return exports.sendJSON(res, 413, {
            error: "too_large",
            reason: "the request entity is too large"
          });
        } else {
          return exports.sendError(res, err, 500);
        }
      }
      next();
    });
  };
}

exports.jsonParser = buildJSONParser(false);
exports.urlencodedParser = require('body-parser').urlencoded({extended: false});

exports.makeOpts = function (req, startOpts) {
  // fill in opts so it can be used by authorisation logic
  var opts = startOpts || {};
  opts.userCtx = (req.couchSession || {}).userCtx;
  opts.secObj = req.couchSecurityObj;

  if (opts.userCtx) {
    // add db name to userCtx (#218)
    var dbname = req.db && req.db._db_name;
    if (dbname) {
      opts.userCtx.db = decodeURIComponent(dbname);
    }
  }

  return opts;
};

exports.setDBOnReq = function (dbName, dbWrapper, req, res, next) {
  dbName = cleanFilename(dbName);
  req.PouchDB.allDbs(function (err, dbs) {
    if (err) {
      return exports.sendError(res, err);
    }

    if (dbs.indexOf(dbName) === -1) {
      return exports.sendJSON(res, 404, {
        error: 'not_found',
        reason: 'no_db_file'
      });
    }
    getOrCreateDB(req.PouchDB, dbName).then(function (db) {
      // temporary workaround for https://github.com/pouchdb/pouchdb/issues/5668
      // see also https://github.com/pouchdb/express-pouchdb/issues/274
      if (/\//.test(dbName)) {
        var path = db.__opts.prefix ? db.__opts.prefix + dbName : dbName;
        mkdirp.sync(pathResolve(path));
      }

      dbWrapper.wrap(dbName, db).then(function () {
        req.db = db;
        next();
      });
    });
  });
};

exports.rawPath = function (req) {
  var rawPath = req.originalUrl.slice(req.baseUrl.length);
  if (rawPath[0] !== '/') {
    rawPath = '/' + rawPath;
  }
  return rawPath;
};

exports.expressReqToCouchDBReq = function (req) {
  var rawPath = exports.rawPath(req);
  return exports.makeOpts(req, {
    body: (req.rawBody ? req.rawBody.toString() : "") || "undefined",
    cookie: req.cookies || {},
    form: req.couchDBForm || {},
    json: req.couchDBJSON || {},
    headers: req.headers,
    method: req.method,
    path: splitPath(req.url.split("?")[0]),
    peer: req.ip,
    query: req.query,
    requested_path: splitPath(rawPath),
    raw_path: rawPath,
  });
};

var sloppyJSONParser = buildJSONParser(true);

exports.couchDBReqMiddleware = function (req, res, next) {
  var i = 0;
  function cb() {
    i++;
    if (i === 2) {
      req.couchDBReq = exports.expressReqToCouchDBReq(req);
      next();
    }
  }
  exports.parseRawBody(req, res, cb);

  sloppyJSONParser(req, res, function () {
    req.couchDBJSON = req.body;
    delete req.body;
    exports.urlencodedParser(req, res, function () {
      req.couchDBForm = req.body;
      delete req.body;

      cb();
    });
  }, true);
};

function splitPath(path) {
  return path.split("/").filter(function (part) {
    return part;
  });
}

exports.sendCouchDBResp = function (res, err, couchResp) {
  if (err) {
    return exports.sendError(res, err);
  }

  for (var header in couchResp.headers) {
    if (couchResp.headers.hasOwnProperty(header)) {
      // use setHeader instead of res.set to prevent modification of
      // headers by express.
      res.setHeader(header, couchResp.headers[header]);
    }
  }
  var body;
  if (couchResp.base64) {
    body = new Buffer(couchResp.base64, 'base64');
  } else {
    //convert to buffer so express doesn't add the ; charset=utf-8 if it
    //isn't already there by now. No performance problem: express does
    //this internally anyway.
    body = new Buffer(couchResp.body, 'utf-8');
  }
  res.status(couchResp.code).send(body);
};

exports.sendError = function (res, err, baseStatus) {
  var status = err.status || baseStatus || 500;

  // last argument is optional
  if (err.name && err.message) {
    if (err.name === 'Error' || err.name === 'TypeError') {
      if (err.message.indexOf("Bad special document member") !== -1) {
        err.name = 'doc_validation';
      // add more clauses here if the error name is too general
      } else {
        err.name = 'bad_request';
      }
    }
    err = {
      error: err.name,
      reason: err.message
    };
  }
  exports.sendJSON(res, status, err);
};

function setJsonOrPlaintext(res) {
  // Send the client application/json if they asked for it,
  // else send text/plain; charset=utf-8. This mimics CouchDB.
  var type = res.req.accepts(['text', 'json']);
  if (type === "json") {
    res.setHeader('Content-Type', 'application/json');
  } else {
    //adds ; charset=utf-8
    res.type('text/plain');
  }
}

function jsonToBuffer(body) {
  //convert to buffer so express doesn't add the ; charset=utf-8 if it
  //isn't already there by now. No performance problem: express does
  //this internally anyway.
  return new Buffer(JSON.stringify(body) + "\n", 'utf8');
}

exports.setJsonOrPlaintext = setJsonOrPlaintext;

exports.writeJSON = function (res, body) {
  res.write(jsonToBuffer(body));
};

exports.sendJSON = function (res, status, body) {
  res.status(status);
  setJsonOrPlaintext(res);
  res.send(jsonToBuffer(body));
};

exports.sendCallback = function (res, errCode, successCode) {
  return function (err, response) {
    if (err) {
      return exports.sendError(res, err, errCode);
    }
    exports.sendJSON(res, successCode || 200, response);
  };
};

exports.setLocation = function (res, path) {
  //CouchDB location headers are always non-relative.
  var loc = (
    res.req.protocol +
    '://' +
    ((res.req.hostname === '127.0.0.1') ?
      '' : res.req.subdomains.join('.') + '.') +
    res.req.hostname +
    ':' + res.req.socket.localPort +
    '/' + path
  );
  res.location(loc);
};

exports.restrictMethods = function (methods) {
  return function (req, res, next) {
    if (methods.indexOf(req.method) === -1) {
      res.set("Allow", methods.join(", "));
      return exports.sendJSON(res, 405, {
        error: 'method_not_allowed',
        reason: "Only " + methods.join(",") + " allowed"
      });
    }
    next();
  };
};

exports.parseRawBody = function (req, res, next) {
  // Custom bodyParsing because bodyParser chokes
  // on 'malformed' requests, and also because we need the
  // rawBody for attachments
  rawBody(req, {
    length: req.headers['content-length']
  }, function (err, string) {
    if (err) {
      return next(err);
    }
    req.rawBody = string;
    next();
  });
};

exports.getUsersDBName = function (app) {
  return app.couchConfig.get('couch_httpd_auth', 'authentication_db');
};

exports.getUsersDB = function (app, PouchDB) {
  var name = exports.getUsersDBName(app);
  return app.dbWrapper.wrap(name, new PouchDB(name));
};

exports.requires = function (app, part) {
  if (!app.includes[part]) {
    var msg = part + (
      " is required, but won't be active. Please adjust your " +
      "opts.profile/opts.profileDiff accordingly."
    );
    throw new Error(msg);
  }
};

exports.callAsyncRecursive = function (funcs, handleCall) {
  var i = 0;
  function next() {
    var func = funcs[i];
    if (typeof func === 'undefined') {
      return Promise.resolve();
    }
    i++;
    return handleCall(func, next);
  }
  return next();
};
