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

var PouchPluginError = require("pouchdb-plugin-error");
var extend = require("extend");

exports.evaluate = function (requireContext, extraVars, program) {
  /*jshint unused: false */
  var require;
  if (requireContext) {
    require = function (libPath) {
      var requireLocals = extend({
        module: {
          id: libPath,
          //no way to fill in current and parent that I know of
          current: undefined,
          parent: undefined,
          exports: {}
        },
      }, locals);
      requireLocals.exports = requireLocals.module.exports;

      var path = libPath.split("/");
      var lib = requireContext;
      for (var i = 0; i < path.length; i += 1) {
        lib = lib[path[i]];
      }
      lib += "\nreturn module.exports;";
      return evalProgram(lib, requireLocals);
    };
  }

  //Strip trailing ';'s to make it more likely to be a valid expression
  program = program.replace(/;\s*$/, "");

  var locals = extend({
    isArray: isArray,
    toJSON: toJSON,
    log: log,
    sum: sum,
    require: require
  }, extraVars);
  var func;
  try {
    func = evalProgram("return " + program, locals);
    if (typeof func !== "function") {
      //activate the exception handling mechanism down here.
      throw "no function";
    }
  } catch (e) {
    throw new PouchPluginError({
      "name": "compilation_error",
      "status": 500,
      "message": "Expression does not eval to a function. " + program
    });
  }
  return func;
};

var isArray = Array.isArray;
var toJSON = JSON.stringify;
var log = function (message) {
  if (typeof message != "string") {
    message = JSON.stringify(message);
  }
  console.log("EVALUATED FUNCTION LOGS: " + message);
};
var sum = function (array) {
  return array.reduce(function (a, b) {
    return a + b;
  });
};

function evalProgram(program, locals) {
  /*jshint evil:true */
  var keys = Object.keys(locals);
  var values = keys.map(function (key) {
    return locals[key];
  });
  var code = (
    "(function (" + keys.join(", ") + ") {" +
      program +
    "})"
  );

  return eval(code).apply(null, values);
}

exports.wrapExecutionError = function (e) {
  return new PouchPluginError({
    name: e.name,
    message: e.toString() + "\n\n" + e.stack,
    status: 500
  });
};
