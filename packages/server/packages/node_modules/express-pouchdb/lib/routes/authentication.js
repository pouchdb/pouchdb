"use strict";

var cookieParser = require('cookie-parser'),
    basicAuth    = require('basic-auth'),
    utils        = require('../utils'),
    Promise      = require('pouchdb-promise'),
    Auth         = require('pouchdb-auth');

var SECTION = 'couch_httpd_auth';

module.exports = function (app) {
  var usersDBPromise, refreshUsersDBImpl;

  utils.requires(app, 'config-infrastructure');
  utils.requires(app, 'logging-infrastructure');

  app.couchConfig.registerDefault(SECTION, 'authentication_db', '_users');
  app.couchConfig.registerDefault(SECTION, 'timeout', 600);
  app.couchConfig.registerDefault(SECTION, 'secret', Auth.generateSecret());
  app.couchConfig.registerDefault(SECTION, 'iterations', 10);
  app.couchConfig.registerDefault(SECTION, 'allow_persistent_cookies', false);

  // explain how to activate the auth db logic.
  app.dbWrapper.registerWrapper(function (name, db, next) {
    if (name === getUsersDBName()) {
      return db.useAsAuthenticationDB({
        isOnlineAuthDB: false,
        timeout: app.couchConfig.get(SECTION, 'timeout'),
        secret: app.couchConfig.get(SECTION, 'secret'),
        iterations: app.couchConfig.get(SECTION, 'iterations'),
        admins: app.couchConfig.getSection('admins')
      });
    }
    return next();
  });

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(Auth);

      refreshUsersDBImpl = function () {
        usersDBPromise = utils.getUsersDB(app, PouchDB);
      };
      refreshUsersDB();
      PouchDB.on('destroyed', onDestroyed);
    },
    stop: function (PouchDB) {
      PouchDB.removeListener('destroyed', onDestroyed);
    }
  });

  // utils
  var getUsersDBName = utils.getUsersDBName.bind(null, app);

  function getUsersDB() {
    // calls itself until usersDBPromise is a available
    if (!usersDBPromise) {
      return new Promise(function (resolve) {
        setImmediate(function () {
          resolve(getUsersDB());
        });
      });
    }
    return usersDBPromise;
  }

  function onDestroyed(dbName) {
    // if the users db was removed, it should re-appear.
    if (dbName === getUsersDBName()) {
      refreshUsersDB();
    }
  }

  function refreshUsersDB() {
    // Just as getUsersDB, calls itself until refreshUsersDBImpl is available.
    return refreshUsersDBImpl
      ? refreshUsersDBImpl()
      : new Promise(setImmediate).then(refreshUsersDB);
  }

  // ensure there's always a users db
  app.couchConfig.on(SECTION + '.authentication_db', refreshUsersDB);
  app.couchConfig.on(SECTION + '.timeout', refreshUsersDB);
  app.couchConfig.on(SECTION + '.secret', refreshUsersDB);
  app.couchConfig.on(SECTION + '.iterations', refreshUsersDB);
  app.couchConfig.on(SECTION + '.allow_persistent_cookies', refreshUsersDB);
  app.couchConfig.on('admins', refreshUsersDB);

  // routing
  app.use(cookieParser());

  app.use(function (req, res, next) {
    // TODO: TIMING ATTACK
    Promise.resolve().then(function () {
      return buildCookieSession(req, res);
    }).catch(function () {
      return buildBasicAuthSession(req);
    }).then(function (result) {
      req.couchSession = result;
      req.couchSession.info.authentication_handlers = ['cookie', 'default'];
      next();
    }).catch(function (err) {
      utils.sendError(res, err);
    });
  });

  function buildCookieSession(req, res) {
    var sessionID = (req.cookies || {}).AuthSession;
    if (!sessionID) {
      throw new Error("No cookie, so no cookie auth.");
    }
    return getUsersDB().then(function (db) {
      return db.multiUserSession(sessionID);
    }).then(function (session) {
      if (session.info.authenticated) {
        var cookieOptions = {httpOnly: true};
        if (app.couchConfig.get(SECTION, 'allow_persistent_cookies') === true) {
          cookieOptions['maxAge'] = app.couchConfig.get(SECTION, 'timeout');
        }
        res.cookie('AuthSession', session.sessionID, cookieOptions);
        delete session.sessionID;
        session.info.authenticated = 'cookie';
        logSuccess('cookie', session);
      }
      return session;
    });
  }

  function logSuccess(type, session) {
    var msg = 'Successful ' + type + ' auth as: "' + session.userCtx.name + '"';
    app.couchLogger.debug(msg);
  }

  function buildBasicAuthSession(req) {
    var userInfo = basicAuth(req);
    var db;
    var initializingDone = getUsersDB().then(function (theDB) {
      db = theDB;
    });
    if (userInfo) {
      initializingDone = initializingDone.then(function () {
        return db.multiUserLogIn(userInfo.name, userInfo.pass);
      });
    }
    return initializingDone.then(function (info) {
      return db.multiUserSession((info || {}).sessionID);
    }).then(function (session) {
      delete session.sessionID;

      if (session.info.authenticated) {
        session.info.authenticated = 'default';
        logSuccess('http basic', session);
      }
      return session;
    });
  }
};
