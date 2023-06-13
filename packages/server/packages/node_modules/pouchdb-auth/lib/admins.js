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

var utils = require('./utils');

var Promise = require('pouchdb-promise');
var IS_HASH_RE = /^-(?:pbkdf2|hashed)-/;

exports.hashPasswords = function (admins, opts, callback) {
  // opts: opts.iterations (default 10)
  // 'static' method (doesn't use the database)
  var args = utils.processArgs(null, opts, callback);

  var result = {};
  return utils.nodify(Promise.all(Object.keys(admins).map(function (key) {
    return hashAdminPassword(admins[key], utils.iterations(args))
      .then(function (hashed) {
        result[key] = hashed;
      });
  })).then(function () {
    return result;
  }), args.callback);
};

function hashAdminPassword(password, iterations) {
  if (IS_HASH_RE.test(password)) {
    return Promise.resolve(password);
  }
  var salt = utils.generateSecret();
  return utils.hashPassword(password, salt, iterations)
    .then(function (hash) {
      return '-pbkdf2-' + hash + ',' + salt + ',' + iterations;
    });
}

var ADMIN_RE = /^-pbkdf2-([\da-f]+),([\da-f]+),([0-9]+)$/;

exports.parse = function (admins) {
  var result = {};
  for (var name in admins) {
    /* istanbul ignore else */
    if (admins.hasOwnProperty(name)) {
      var info = admins[name].match(ADMIN_RE);
      if (info) {
        result[name] = {
          password_scheme: 'pbkdf2',
          derived_key: info[1],
          salt: info[2],
          iterations: parseInt(info[3], 10),
          roles: ['_admin'],
          name: name
        };
      }
    }
  }
  return result;
};
