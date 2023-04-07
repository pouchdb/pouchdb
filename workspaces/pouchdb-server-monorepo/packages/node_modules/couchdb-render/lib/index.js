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

var coucheval = require("couchdb-eval");
var completeRespObj = require("couchdb-resp-completer");
var PouchPluginError = require("pouchdb-plugin-error");

function isObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

module.exports = function render(source, designDoc, data, req, extraVars) {
  /*jshint evil: true */
  if (!extraVars) {
    extraVars = {};
  }
  var providesCtx = buildProvidesCtx();
  extend(extraVars, providesCtx.api);
  var func = coucheval.evaluate(designDoc, extraVars, source);

  var result, contentType;
  try {
    result = func.call(designDoc, data, req);
  } catch (e) {
    throw coucheval.wrapExecutionError(e);
  }
  if (!(typeof result === "string" || isObject(result))) {
    var resp = providesCtx.getResult(req);
    result = resp[0];
    contentType = resp[1];
  }

  return completeRespObj(result, contentType);
};

function buildProvidesCtx() {
  var providesFuncs = {};
  var types = [];

  function registerType(key) {
    //signature: key, *mimes
    var mimes = Array.prototype.slice.call(arguments, 1);
    types.push([key, mimes]);
  }
  registerType("all", "*/*");
  registerType("text", "text/plain; charset=utf-8", "txt");
  registerType("html", "text/html; charset=utf-8");
  registerType("xhtml", "application/xhtml+xml", "xhtml");
  registerType("xml", "application/xml", "text/xml", "application/x-xml");
  registerType("js", "text/javascript", "application/javascript", "application/x-javascript");
  registerType("css", "text/css");
  registerType("ics", "text/calendar");
  registerType("csv", "text/csv");
  registerType("rss", "application/rss+xml");
  registerType("atom", "application/atom+xml");
  registerType("yaml", "application/x-yaml", "text/yaml");
  registerType("multipart_form", "multipart/form-data");
  registerType("url_encoded_form", "application/x-www-form-urlencoded");
  registerType("json", "application/json", "text/x-json");

  function execute(type) {
    try {
      return providesFuncs[type]();
    } catch (e) {
      throw coucheval.wrapExecutionError(e);
    }
  }

  function getRelevantTypes() {
    return types.filter(function (type) {
      return providesFuncs.hasOwnProperty(type[0]);
    });
  }

  function contentTypeFor(searchedType) {
    for (var i = 0; i < types.length; i += 1) {
      if (types[i][0] === searchedType) {
        return types[i][1][0];
      }
    }
  }

  function bestMatchForAcceptHeader(header) {
    var requestedMimes = parseAcceptHeader(header);
    var relevantTypes = getRelevantTypes();
    for (var i = 0; i < requestedMimes.length; i += 1) {
      var requestedMime = requestedMimes[i];
      var requestedParts = requestedMime.split(";")[0].trim().split("/");

      for (var j = 0; j < relevantTypes.length; j += 1) {
        var type = relevantTypes[j][0];
        var mimes = relevantTypes[j][1];

        for (var k = 0; k < mimes.length; k += 1) {
          var mime = mimes[k];

          var availableParts = mime.split(";")[0].trim().split("/");
          var match = (
            (
              //'text' in text/plain
              requestedParts[0] === availableParts[0] ||
              requestedParts[0] === "*" || availableParts[0] === "*"
            ) && (
              //'plain' in text/plain
              requestedParts[1] === availableParts[1] ||
              requestedParts[1] === "*" || availableParts[1] === "*"
            )
          );
          if (match) {
            return [type, mime];
          }
        }
      }
    }
    //no match was found
    throw new PouchPluginError({
      status: 406,
      name: "not_acceptable",
      message: [
        "Content-Type(s)",
        requestedMimes.join(", "),
        "not supported, try one of:",
        Object.keys(providesFuncs).map(contentTypeFor)
      ].join(" ")
    });
  }

  function provides(type, func) {
    providesFuncs[type] = func;
  }

  function getResult(req) {
    if (isEmpty(providesFuncs)) {
      return [""];
    }
    if (req.query.format) {
      if (!providesFuncs.hasOwnProperty(req.query.format)) {
        throw new PouchPluginError({
          status: 500,
          name: "render_error",
          message: [
            "the format option is set to '",
            req.query.format,
            //the + thing for es3ify
            "'" + ", but there's no provider registered for that format."
          ].join("")
        });
      }
      //everything fine
      return [execute(req.query.format), contentTypeFor(req.query.format)];
    }
    var chosenType = bestMatchForAcceptHeader(req.headers.Accept);
    return [execute(chosenType[0]), chosenType[1]];
  }

  return {
    api: {
      provides: provides,
      registerType: registerType
    },
    getResult: getResult
  };
}

function parseAcceptHeader(header) {
  return header.split(",").map(function (part) {
    return part.split(";")[0].trim();
  });
}
