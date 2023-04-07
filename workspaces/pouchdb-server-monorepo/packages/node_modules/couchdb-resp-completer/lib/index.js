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

var extend = require("extend");
var isEmpty = require("is-empty");
var PouchPluginError = require("pouchdb-plugin-error");

module.exports = function completeRespObj(resp, contentType) {
  //contentType may be undefined (if unknown). Resp may be anything
  //returned by the user as response.

  if (typeof resp === "string") {
    resp = {body: resp};
  }
  if (Object.prototype.toString.call(resp) !== "[object Object]") {
    resp = {};
  }
  //check for keys that shouldn't be in the resp object
  var copy = extend({}, resp);
  delete copy.code;
  delete copy.json;
  delete copy.body;
  delete copy.base64;
  delete copy.headers;
  delete copy.stop;
  if (!isEmpty(copy)) {
    var key = Object.keys(copy)[0];
    throw new PouchPluginError({
      "status": 500,
      "name": "external_response_error",
      "message": [
        "Invalid data from external server: {<<",
        JSON.stringify(key),
        ">>,<<",
        JSON.stringify(copy[key]),
        ">>}"
      ].join("")
    });
  }
  resp.code = resp.code || 200;
  resp.headers = resp.headers || {};
  resp.headers.Vary = resp.headers.Vary || "Accept";
  //if a content type is known by now, use it.
  resp.headers["Content-Type"] = resp.headers["Content-Type"] || contentType;
  if (typeof resp.json !== 'undefined') {
    resp.body = JSON.stringify(resp.json);
    resp.headers["Content-Type"] = resp.headers["Content-Type"] || "application/json";
  }
  if (typeof resp.base64 !== 'undefined') {
    resp.headers["Content-Type"] = resp.headers["Content-Type"] || "application/binary";
  }
  //the default content type
  resp.headers["Content-Type"] = resp.headers["Content-Type"] || "text/html; charset=utf-8";

  //the user isn't allowed to set the etag header
  delete resp.headers.Etag;

  if (typeof resp.body === "undefined" && typeof resp.base64 === "undefined") {
    resp.body = "";
  }

  return resp;
};
