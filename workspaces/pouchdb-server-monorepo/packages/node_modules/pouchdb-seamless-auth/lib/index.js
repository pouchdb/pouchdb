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

var Auth = require('pouchdb-auth');
var extend = require('extend');
var Promise = require('pouchdb-promise');
var nodify = require('promise-nodify');

var PouchDB, local, remote;
var cacheInvalidated;
var cache;

module.exports = function (thePouchDB) {
  PouchDB = thePouchDB;
  local = new PouchDB('_users');

  return Auth.useAsAuthenticationDB.call(local)
    .then(invalidateCache)
    .then(function () {
      extend(PouchDB, api);
    });
};

function invalidateCache(passthrough) {
  cacheInvalidated = true;

  return passthrough;
}

var api = {};
api.setSeamlessAuthLocalDB = function (localDB, callback) {
  local = localDB;

  var promise = Auth.useAsAuthenticationDB.call(local)
    .then(invalidateCache);

  nodify(promise, callback);
  return promise;
};

api.unsetSeamlessAuthLocalDB = function () {
  local = undefined;
  invalidateCache();
};

api.setSeamlessAuthRemoteDB = function (remoteName, remoteOptions, callback) {
  remote = new PouchDB(remoteName, remoteOptions);

  var promise = Auth.useAsAuthenticationDB.call(remote)
    .then(invalidateCache);

  nodify(promise, callback);
  return promise;
};

api.unsetSeamlessAuthRemoteDB = function () {
  remote = undefined;
  invalidateCache();
};

api.invalidateSeamlessAuthCache = function () {
  invalidateCache();
};

api.seamlessSession = function (opts, callback) {
  // Getting the session is something that can happen quite often in a row. HTTP
  // is slow (and _session is not HTTP cached), so a manual cache is implemented
  // here.
  var args = parseArgs(opts, callback);
  if (cacheInvalidated) {
    cache = callFromAvailableSource('session', args.opts)
      .then(function (info) {
        if (info.resp.userCtx.name !== null) {
          return startReplication(info.resp.userCtx.name, info);
        } else {
          return info;
        }
      })
      .then(returnResp);
    cacheInvalidated = false;
  }
  nodify(cache, args.callback);
  return cache;
};

api.seamlessLogIn = function (username, password, opts, callback) {
  var args = parseArgs(opts, callback);
  var promise = callFromAvailableSource('logIn', username, password, args.opts)
    .then(startReplication.bind(null, username))
    .then(invalidateCache)
    .then(returnResp);
  nodify(promise, args.callback);
  return promise;
};

api.seamlessLogOut = function (opts, callback) {
  var args = parseArgs(opts, callback);
  var promise = callFromAvailableSource('logOut', args.opts)
    .then(invalidateCache)
    .then(returnResp);
  nodify(promise, args.callback);
  return promise;
};

api.seamlessSignUp = function (username, password, opts, callback) {
  var args = parseArgs(opts, callback);
  var promise = callFromAvailableSource('signUp', username, password, args.opts)
    .then(startReplication.bind(null, username))
    .then(invalidateCache)
    .then(returnResp);
  nodify(promise, args.callback);
  return promise;
};

function callFromAvailableSource(name/*, arg1, ...*/) {
  var args = Array.prototype.slice.call(arguments, 1);
  return Promise.resolve()
    .then(function () {
      // promisifies the 'undefined has no attribute apply' error too when in a
      // then-function instead of on top.
      return remote[name].apply(remote, args);
    })
    .then(function (resp) {
      return {
        type: 'remote',
        resp: resp
      };
    })
    .catch(function () {
      return local[name].apply(local, args)
        .then(function (resp) {
          return {
            type: 'local',
            resp: resp
          };
        });
    });
}

function returnResp(info) {
  return info.resp;
}

function parseArgs(opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return {
    callback: callback,
    opts: opts
  };
}

function startReplication(username, info) {
  // can't use real replication because the changes feed of _users isn't
  // publicly accessable for non-admins.
  if (info.type === 'remote') {
    // can only 'replicate' when the remote db is available.
    var getRemote = remote.get('org.couchdb.user:' + username, {revs: true})
      .catch(useEmptyDoc);
    var getLocal = local.get('org.couchdb.user:' + username, {revs: true})
      .catch(useEmptyDoc);
    Promise.all([getRemote, getLocal])
      .then(Function.prototype.apply.bind(function (remoteDoc, localDoc) {
        if (remoteDoc._rev > localDoc._rev) {
          local.bulkDocs([remoteDoc], {new_edits: false});
        } else if (remoteDoc._rev < localDoc._rev) {
          remote.bulkDocs([localDoc], {new_edits: false});
        } else {
          // both were up-to-date already. Prevent cache invalidation by
          // returning directly.
          return;
        }
        invalidateCache();
      }, null));
  }
  return info;
}

function useEmptyDoc() {
  return {_rev: '0'};
}
