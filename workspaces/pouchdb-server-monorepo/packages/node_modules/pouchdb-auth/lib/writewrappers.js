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
var createBulkDocsWrapper = require("pouchdb-bulkdocs-wrapper");

var utils = require('./utils');

exports.put = function (original, args) {
  return modifyDoc(args.base, args.doc).then(original);
};

function modifyDoc(db, doc) {
  if (!(typeof doc.password == 'undefined' || doc.password === null)) {
    doc.iterations = utils.dbDataFor(db).iterations;
    doc.password_scheme = 'pbkdf2';
    doc.salt = utils.generateSecret();

    return utils.hashPassword(doc.password, doc.salt, doc.iterations).then(function (hash) {
      delete doc.password;
      doc.derived_key = hash;
    });
  }
  return Promise.resolve();
}

exports.post = exports.put;
exports.bulkDocs = createBulkDocsWrapper(function (doc, args) {
  return modifyDoc(args.base, doc);
});
