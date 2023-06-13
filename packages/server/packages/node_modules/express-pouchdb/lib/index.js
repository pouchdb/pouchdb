"use strict";

var wrappers        = require('pouchdb-wrappers'),
    express         = require('express'),
    DatabaseWrapper = require('./db-wrapper'),
    DaemonManager   = require('./daemon-manager'),
    Promise         = require('pouchdb-promise'),
    utils           = require('./utils');

var modes = {};
modes.custom = [];
modes.minimumForPouchDB = [
  // sorted alphabetically
  'compression',
  'routes/404',
  'routes/all-dbs',
  'routes/all-docs',
  'routes/attachments',
  'routes/bulk-docs',
  'routes/bulk-get',
  'routes/changes',
  'routes/compact',
  'routes/db',
  'routes/documents',
  'routes/revs-diff',
  'routes/root',
  'routes/session-stub',
  'routes/temp-views',
  'routes/view-cleanup',
  'routes/views'
];

modes.fullCouchDB = [
  // sorted alphabetically
  'config-infrastructure',
  'disk-size',
  'logging-infrastructure',
  'replicator',
  'routes/active-tasks',
  'routes/authentication',
  'routes/authorization',
  'routes/cluster',
  'routes/cluster-rewrite',
  'routes/config',
  'routes/db-updates',
  'routes/ddoc-info',
  'routes/fauxton',
  'routes/find',
  'routes/http-log',
  'routes/list',
  'routes/log',
  'routes/replicate',
  'routes/rewrite',
  'routes/security',
  'routes/session',
  'routes/show',
  'routes/special-test-auth',
  'routes/stats',
  'routes/update',
  'routes/uuids',
  'routes/vhosts',
  'validation'
].concat(modes.minimumForPouchDB);

function toObject(array) {
  var result = {};
  array.forEach(function (item) {
    result[item] = true;
  });
  return result;
}

module.exports = function (startPouchDB, opts) {
  var currentPouchDB;

  // both PouchDB and opts are optional
  if (startPouchDB && !startPouchDB.defaults) {
    opts = startPouchDB;
    startPouchDB = null;
  }
  opts = opts || {};

  var app = express();
  app.enable('case sensitive routing');
  app.opts = opts;

  // determine which parts of express-pouchdb to activate
  opts.overrideMode = opts.overrideMode || {};
  opts.overrideMode.include = opts.overrideMode.include || [];
  opts.overrideMode.exclude = opts.overrideMode.exclude || [];
  opts.overrideMode.include.forEach(function (part) {
    if (modes.fullCouchDB.indexOf(part) === -1) {
      throw new Error(
        "opts.overrideMode.include contains the unknown part '" +
        part + "'."
      );
    }
  });

  var modeIncludes = modes[app.opts.mode || 'fullCouchDB'];
  if (!modeIncludes) {
    throw new Error('Unknown mode: ' + app.opts.mode);
  }
  var allIncludes = modeIncludes.concat(app.opts.overrideMode.include);
  app.includes = toObject(allIncludes);
  app.opts.overrideMode.exclude.forEach(function (part) {
    if (!app.includes[part]) {
      throw new Error(
        "opts.overrideMode.exclude contains the not included part '" +
        part + "'."
      );
    }
    delete app.includes[part];
  });

  // the daemon manager is a non-negotiable part of express-pouchdb,
  // it's needed for static method wrappers & installing
  // pouchdb-all-dbs. Both are required for nearly everything.
  app.daemonManager = new DaemonManager();
  app.setPouchDB = function (newPouchDB) {
    var oldPouchDB = currentPouchDB;
    currentPouchDB = newPouchDB;

    var stoppingDone = Promise.resolve();
    if (oldPouchDB) {
      stoppingDone = app.daemonManager.stop(oldPouchDB);
    }
    return stoppingDone.then(function () {
      return app.daemonManager.start(newPouchDB);
    });
  };

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      // add PouchDB.new() - by default it just returns 'new PouchDB()'
      // also re-adds PouchDB.destroy(), see for reasoning:
      // https://github.com/pouchdb/express-pouchdb/pull/231#issuecomment-136095649
      wrappers.installStaticWrapperMethods(PouchDB, {});

      return Promise.resolve().then(function () {
        return PouchDB.allDbs();
      }).catch(function () {
        require('pouchdb-all-dbs')(PouchDB);
      });
    }
  });

  // the dbWrapper is also a vital part of express-pouchdb which can't
  // be disabled. Some methods of dbs need to be wrapped at the very
  // least with a noop, to work around incompatible api.
  app.dbWrapper = new DatabaseWrapper();
  app.dbWrapper.registerWrapper(function (name, db, next) {
    //'fix' the PouchDB api (support opts arg everywhere)
    function noop(orig) {
      return orig();
    }
    var wrapperMethods = {};
    ['info', 'removeAttachment'].forEach(function (name) {
      wrapperMethods[name] = noop;
    });
    wrappers.installWrapperMethods(db, wrapperMethods);
    return next();
  });

  app.use(function (req, res, next) {
    var prop;

    // Normalize query string parameters for direct passing
    // into PouchDB queries.
    for (prop in req.query) {
      if (Object.prototype.hasOwnProperty.call(req.query, prop)) {
        try {
          req.query[prop] = JSON.parse(req.query[prop]);
        } catch (e) {}
      }
    }

    // Provide the request access to the current PouchDB object.
    if (!currentPouchDB) {
      var msg = "express-pouchdb needs a PouchDB object to route a request!";
      throw new Error(msg);
    }
    req.PouchDB = currentPouchDB;

    next();
  });

  // load all modular files
  [
    // order matters in this list!
    'config-infrastructure',
    'logging-infrastructure',
    'compression',
    'disk-size',
    'replicator',
    'routes/http-log',
    'routes/authentication',
    'routes/special-test-auth',
    'routes/authorization',
    'routes/vhosts',
    'routes/cluster-rewrite',
    'routes/rewrite',
    'routes/root',
    'routes/log',
    'routes/session',
    'routes/session-stub',
    'routes/fauxton',
    'routes/cluster',
    'routes/config',
    'routes/uuids',
    'routes/all-dbs',
    'routes/replicate',
    'routes/active-tasks',
    'routes/db-updates',
    'routes/stats',
    'routes/db',
    'routes/bulk-docs',
    'routes/bulk-get',
    'routes/all-docs',
    'routes/changes',
    'routes/compact',
    'routes/revs-diff',
    'routes/security',
    'routes/view-cleanup',
    'routes/temp-views',
    'routes/find',
    'routes/views',
    'routes/ddoc-info',
    'routes/show',
    'routes/list',
    'routes/update',
    'routes/attachments',
    'routes/documents',
    'validation',
    'routes/404'
  ].forEach(function (file) {
    if (app.includes[file]) {
      require('./' + file)(app);
    }
  });

  if (app.couchConfig) {
    app.couchConfig.registerDefault(
      'couchdb',
      'max_document_size',
      utils.maxDocumentSizeDefault
    );
  }

  if (startPouchDB) {
    app.setPouchDB(startPouchDB);
  }

  return app;
};
