/*
	Copyright 2014-2015, Marten de Vries

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

'use strict';

var Promise = require('pouchdb-promise');
var base64url = require('base64url');
var calculateSessionId = require('couchdb-calculate-session-id');
var httpQuery = require("pouchdb-req-http-query");
var PouchPluginError = require("pouchdb-plugin-error");

var utils = require('./utils');

exports.signUp = function (username, password, opts, callback) {
  //opts: roles
  var args = utils.processArgs(this, opts, callback);

  var doc = {
    _id: docId(username),
    type: 'user',
    name: username,
    password: password,
    roles: args.opts.roles || []
  };

  return utils.nodify(args.db.put(doc), args.callback);
};

function docId(username) {
  return "org.couchdb.user:" + username;
}

exports.logIn = function (username, password, callback) {
  var promise;
  var info = utils.dbDataFor(this);

  if (info.isOnlineAuthDB) {
    promise = httpQuery(this, {
      method: 'POST',
      raw_path: '/_session',
      body: JSON.stringify({
        name: username,
        password: password
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(function (resp) {
      return JSON.parse(resp.body);
    });
  } else {
    promise = exports.multiUserLogIn.call(this, username, password)
      .then(saveSessionID.bind(null, info));
  }

  return utils.nodify(promise, callback);
};

function saveSessionID(info, resp) {
  info.sessionID = resp.sessionID;
  delete resp.sessionID;

  return resp;
}

exports.logOut = function (callback) {
  var info = utils.dbDataFor(this);
  var promise;
  if (info.isOnlineAuthDB) {
    promise = httpQuery(this, {
      method: 'DELETE',
      raw_path: '/_session'
    }).then(function (resp) {
      return JSON.parse(resp.body);
    });
  } else {
    delete info.sessionID;
    promise = Promise.resolve({ok: true});
  }

  return utils.nodify(promise, callback);
};

exports.session = function (callback) {
  var info = utils.dbDataFor(this);

  var promise;
  if (info.isOnlineAuthDB) {
    promise = httpQuery(this, {
      raw_path: '/_session',
      method: 'GET'
    }).then(function (resp) {
      return JSON.parse(resp.body);
    });
  } else {
    promise = exports.multiUserSession.call(this, info.sessionID)
      .then(saveSessionID.bind(null, info));
  }

  return utils.nodify(promise, callback);
};

exports.multiUserLogIn = function (username, password, callback) {
  var db = this;
  var info = utils.dbDataFor(db);

  var userDoc;
  return utils.nodify(getUserDoc(db, username).then(function (doc) {
    userDoc = doc;
    return utils.hashPassword(password, userDoc.salt, userDoc.iterations);
  }).then(function (derived_key) {
    if (derived_key !== userDoc.derived_key) {
      throw 'invalid_password';
    }
    return {
      ok: true,
      name: userDoc.name,
      roles: userDoc.roles,
      sessionID: newSessionId(userDoc, info)
    };
  }).catch(function (err) {
    if (!(err instanceof PouchPluginError)) {
      err = new PouchPluginError({
        status: 401,
        name: 'unauthorized',
        message: "Name or password is incorrect."
      });
    }
    throw err;
  }), callback);
};

function getUserDoc(db, username) {
  var info = utils.dbDataFor(db);

  var adminDoc = info.admins[username];
  return db.get(docId(username), {conflicts: true})
    .catch(function (err) {
      if (err.name != 'not_found' || typeof adminDoc === 'undefined') {
        throw err;
      }
    })
    .then(function (userDoc) {
      if (typeof userDoc !== 'undefined') {
        if ((userDoc._conflicts || {}).length) {
          throw new PouchPluginError({
            status: 401,
            name: 'unauthorized',
            message: "User document conflicts must be resolved before" +
              "the document is used for authentication purposes."
          });
        }
        if (typeof adminDoc === 'undefined') {
          return userDoc;
        }
        adminDoc = Object.assign({}, adminDoc);
        adminDoc.roles = ['_admin'].concat(userDoc.roles);
      }
      return adminDoc;
    })
}

function newSessionId(userDoc, info) {
  return calculateSessionId(userDoc.name, userDoc.salt, info.secret, timestamp());
}

function timestamp() {
  return Math.round(Date.now() / 1000);
}

exports.multiUserSession = function (sessionID, callback) {
  var db = this;

  var info = utils.dbDataFor(db);
  var resp = {
    ok: true,
    userCtx: {
      name: null,
      roles: []
    },
    info: {
      authentication_handlers: ['api']
    }
  };
  if (Object.keys(info.admins).length === 0) {
    //admin party
    resp.userCtx.roles = ['_admin'];
  }
  var givenTimestamp;
  return utils.nodify(db.info().then(function (dbInfo) {
    resp.info.authentication_db = dbInfo.db_name;
    if (sessionID) {
      try {
        var decoded = base64url.decode(sessionID);
        var givenUsername = decoded.split(':')[0];
        givenTimestamp = parseInt(decoded.split(':')[1], 16);
        if (typeof givenUsername === 'undefined' || isNaN(givenTimestamp)) {
          throw 'invalid';
        }
      } catch (err) {
        throw new PouchPluginError({
          status: 400,
          name: 'bad_request',
          message: "Malformed session ID. If you're using a browser, try clearing your cookies."
        });
      }

      return getUserDoc(db, givenUsername);
    } else {
      throw 'no session id';
    }
  }).then(function (userDoc) {
    var expectedHash = calculateSessionId(userDoc.name, userDoc.salt, info.secret, givenTimestamp);
    if (timestamp() < givenTimestamp + info.timeout && expectedHash === sessionID) {
      resp.info.authenticated = 'api';
      resp.userCtx.name = userDoc.name;
      resp.userCtx.roles = userDoc.roles;
      resp.sessionID = newSessionId(userDoc, info);
    }
  }).catch(function (err) {
    if (err instanceof PouchPluginError) {
      throw err;
    }
    // otherwise, resp is ready to be returned.
  }).then(function () {
    return resp;
  }), callback);
};
