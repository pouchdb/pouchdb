"use strict";

var startTime     = new Date().getTime(),
    utils         = require('../utils'),
    wrappers      = require('pouchdb-wrappers'),
    mkdirp        = require('mkdirp'),
    pathResolve   = require('path').resolve,
    cleanFilename = require('../clean-filename'),
    deleteDB      = require('../create-or-delete-dbs').deleteDB;

module.exports = function (app) {
  // Create a database.
  app.put('/:db', utils.jsonParser, function (req, res) {
    var name = cleanFilename(req.params.db);

    req.PouchDB.allDbs(function (err, dbs) {
      if (err) {
        return utils.sendError(res, err);
      }

      if (dbs.indexOf(name) !== -1) {
        return utils.sendJSON(res, 412, {
          'error': 'file_exists',
          'reason': 'The database could not be created.'
        });
      }

      // PouchDB.new() instead of new PouchDB() because that adds
      // authorisation logic
      var db = req.PouchDB.new(name, utils.makeOpts(req));
      db.info(function (err) {
        if (err) {
          // temoperary workaround for leveldb adapter, see
          // https://github.com/pouchdb/pouchdb/issues/5668
          // when removing this code, also remove mkdir
          // from dependencies in package.json
          if (err.name === 'OpenError') {
            var path = db.__opts.prefix ? db.__opts.prefix + name : name;

            mkdirp(pathResolve(path), function (err) {
              if (err) {
                return utils.sendError(res, err, 412);
              }

              db = req.PouchDB.new(name, utils.makeOpts(req));
              db.info(function (err) {

                if (err) {
                  return utils.sendError(res, err, 412);
                }
                utils.setLocation(res, name);
                utils.sendJSON(res, 201, {ok: true});
              });
            });
            return;
          }

          return utils.sendError(res, err, 412);
        }
        utils.setLocation(res, name);
        utils.sendJSON(res, 201, {ok: true});
      });
    });
  });

  // Delete a database
  app.delete('/:db', function (req, res) {
    if (req.query.rev) {
      return utils.sendJSON(res, 400, {
        error: 'bad_request',
        reason: (
          "You tried to DELETE a database with a ?rev= parameter. " +
          "Did you mean to DELETE a document instead?"
        )
      });
    }

    var dbName = cleanFilename(req.params.db);
    deleteDB(req.PouchDB, dbName, utils.makeOpts(req)).then(function () {
      utils.sendJSON(res, 200, {ok: true});
    }, function (err) {
      utils.sendError(res, err);
    });
  });

  // At this point, some route middleware can take care of identifying the
  // correct PouchDB instance.
  ['/:db/*', '/:db'].forEach(function (route) {
    app.all(route, function (req, res, next) {
      utils.setDBOnReq(req.params.db, app.dbWrapper, req, res, next);
    });
  });

  // Get database information
  app.get('/:db', function (req, res) {
    req.db.info(utils.makeOpts(req), function (err, info) {
      if (err) {
        return utils.sendError(res, err);
      }
      info.instance_start_time = startTime.toString();
      // TODO: data_size?
      utils.sendJSON(res, 200, info);
    });
  });

  // Ensure all commits are written to disk
  app.post('/:db/_ensure_full_commit', function (req, res) {
    // TODO: implement. Also check security then: who is allowed to
    // access this? (db & server admins?)
    utils.sendJSON(res, 201, {
      ok: true,
      instance_start_time: startTime.toString()
    });
  });

  app.dbWrapper.registerWrapper(function (name, db, next) {
    // db.info() should just return the non-uri encoded db name
    wrappers.installWrapperMethods(db, {
      info: function (orig) {
        return orig().then(function (info) {
          info.db_name = decodeURIComponent(info.db_name);
          return info;
        });
      }
    });

    return next();
  });

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      // PouchDB.allDbs() should return the non-uri encoded db name
      wrappers.installStaticWrapperMethods(PouchDB, {
        allDbs: function (orig) {
          return orig().then(function (dbs) {
            return dbs.map(decodeURIComponent);
          });
        }
      });
    }
  });
};
