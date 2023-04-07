/*
	Copyright 2013-2014, Marten de Vries

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

var couchdb_objects = require("couchdb-objects");
var nodify = require("promise-nodify");
var coucheval = require("couchdb-eval");
var httpQuery = require("pouchdb-req-http-query");
var completeRespObj = require("couchdb-resp-completer");
var PouchPluginError = require('pouchdb-plugin-error');

exports.update = function (updatePath, options, callback) {
  if (["function", "undefined"].indexOf(typeof options) !== -1) {
    callback = options;
    options = {};
  }
  var db = this;

  //better default than GET.
  options.method = options.method || "POST";

  var designDocName = updatePath.split("/")[0];
  var updateName = updatePath.split("/")[1];
  var docId = updatePath.split("/").slice(2).join("/");

  //build request object
  var pathEnd = ["_design", designDocName, "_update", updateName];
  if (docId) {
    pathEnd.push.apply(pathEnd, docId.split("/"));
  }
  var reqPromise = couchdb_objects.buildRequestObject(db, pathEnd, options);
  var promise = reqPromise.then(function (req) {
    //the only option that isn't related to the request object.
    delete req.withValidation;

    //because we might have set method -> POST, also set a Content-Type
    //to prevent a Qt warning in case there isn't one.
    var h = req.headers;
    h["Content-Type"] = h["Content-Type"] || "application/x-www-form-urlencoded";

    if (["http", "https"].indexOf(db.type()) === -1) {
      return offlineQuery(db, designDocName, updateName, docId, req, options);
    } else {
      return httpQuery(db, req);
    }
  });
  nodify(promise, callback);
  return promise;
};

function offlineQuery(db, designDocName, updateName, docId, req, options) {
  if (req.method === "GET") {
    return Promise.reject(new PouchPluginError({
      status: 500, // should be 405, but for CouchDB compatibility...
      name: "method_not_allowed",
      message: "Update functions do not allow GET"
    }));
  }

  //get the documents involved
  var ddocPromise = db.get("_design/" + designDocName).then(function (designDoc) {
    if (!(designDoc.updates || {}).hasOwnProperty(updateName)) {
      throw new PouchPluginError({
        status: 404,
        name: "not_found",
        message: "missing update function " + updateName + " on design doc _design/" + designDocName
      });
    }
    return designDoc;
  });
  var docPromise = db.get(docId).catch(function () {
    //doc might not exist - that's ok and expected.
    return null;
  });

  return Promise.all([ddocPromise, docPromise])
    .then(Function.prototype.apply.bind(function (designDoc, doc) {
      //run update function
      var func = coucheval.evaluate(designDoc, {}, designDoc.updates[updateName]);
      var result;
      try {
        result = func.call(designDoc, doc, req);
      } catch (e) {
        throw coucheval.wrapExecutionError(e);
      }
      var code = (result[1] || {}).code;
      var couchResp = completeRespObj(result[1]);
      function setCode(proposedCode) {
        couchResp.code = code || proposedCode;
      }
      //save result[0] if necessary
      var savePromise = Promise.resolve();
      if (result[0] === null) {
        setCode(200);
      } else {
        var methodName = options.withValidation ? "validatingPut" : "put";
        savePromise = db[methodName](result[0]).then(function (resp) {
          couchResp.headers['X-Couch-Id'] = resp.id;
          couchResp.headers['X-Couch-Update-NewRev'] = resp.rev;
          setCode(201);
        });
      }
      //then return the result
      return savePromise.then(function () {
        return couchResp;
      });
    }, null));
}
