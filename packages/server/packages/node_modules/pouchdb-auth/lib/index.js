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
var systemDB = require('pouchdb-system-db');
var Validation = require('pouchdb-validation');
var wrappers = require('pouchdb-wrappers');

var admins = require('./admins');
var api = require('./sessionapi');
var designDoc = require('./designdoc');
var utils = require('./utils');
var writeWrappers = require('./writewrappers');

exports.hashAdminPasswords = admins.hashPasswords;
exports.generateSecret = utils.generateSecret;

exports.useAsAuthenticationDB = function (opts, callback) {
  var args = utils.processArgs(this, opts, callback);

  // install validation
  try {
    Validation.installValidationMethods.call(args.db);
  } catch (err) {
    throw new Error("Already in use as an authentication database.");
  }

  // generate defaults for db config when not given & store them
  var info = {
    isOnlineAuthDB: isOnline(args),
    timeout: typeof args.opts.timeout === 'undefined' ? 600 : args.opts.timeout,
    iterations: utils.iterations(args),
    secret: args.opts.secret || utils.generateSecret(),
    admins: admins.parse(args.opts.admins || {})
  };

  var i = utils.dbData.dbs.push(args.db) - 1;
  utils.dbData.dataByDBIdx[i] = info;

  // add API to the db object
  for (var name in api) {
    if (!(info.isOnlineAuthDB && name.indexOf('multiUser') === 0)) {
      args.db[name] = api[name].bind(args.db);
    }
  }


  return utils.nodify(Promise.resolve().then(function () {
    // add wrappers and make system db
    if (!info.isOnlineAuthDB) {
      wrappers.installWrapperMethods(args.db, writeWrappers);
      systemDB.installSystemDBProtection(args.db);

      // store validation doc
      return args.db.put(designDoc);
    }
  }).catch(function (err) {
    /* istanbul ignore if */
    if (err.status !== 409) {
      throw err;
    }
  }).then(function () {
    /* empty success value */
  }), args.callback);
};

function isOnline(args) {
  if (typeof args.opts.isOnlineAuthDB === 'undefined') {
    return ['http', 'https'].indexOf(args.db.type()) !== -1;
  }
  return args.opts.isOnlineAuthDB;
}

exports.stopUsingAsAuthenticationDB = function () {
  var db = this;

  var i = utils.dbData.dbs.indexOf(db);
  if (i === -1) {
    throw new Error("Not an authentication database.");
  }
  utils.dbData.dbs.splice(i, 1);
  var info = utils.dbData.dataByDBIdx.splice(i, 1)[0];

  for (var name in api) {
    /* istanbul ignore else */
    if (api.hasOwnProperty(name)) {
      delete db[name];
    }
  }

  if (!info.isOnlineAuthDB) {
    systemDB.uninstallSystemDBProtection(db);
    wrappers.uninstallWrapperMethods(db, writeWrappers);
  }

  Validation.uninstallValidationMethods.call(db);
};
