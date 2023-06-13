/*
    Copyright 2014, Marten de Vries

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

"use strict";

var Promise = require("pouchdb-promise");

module.exports = function createBulkDocsWrapper(handler) {
  return bulkDocsWrapper.bind(null, handler);
};

function bulkDocsWrapper(handler, bulkDocs, args) {
  //the ``all_or_nothing`` attribute on ``bulkDocs`` is unsupported.
  //Also, the result array might not be in the same order as
  //``bulkDocs.docs`` argument.

  var notYetDone = [];
  var done = [];

  var promises = args.docs.map(function (doc) {
    return handler(doc, args)
      .then(function () {
        notYetDone.push(doc);
      })
      .catch(function (err) {
        err.id = doc._id;
        done.push(err);
      });
  });
  return Promise.all(promises)
    .then(function () {
      args.docs = notYetDone;

      return bulkDocs();
    })
    .then(function (dbResponses) {
      return done.concat(dbResponses);
    });
}
