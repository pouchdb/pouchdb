import vm from 'vm';
import 'node:events';
import './functionName-706c6c65.js';
import './pouchdb-errors.js';
import 'crypto';
import { BuiltInError, NotFoundError } from './pouchdb-mapreduce-utils.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import { s as scopeEval } from './scopeEval-ff3a416d.js';
import createAbstractMapReduce from './pouchdb-abstract-mapreduce.js';
import './_commonjsHelpers-24198af3.js';
import 'buffer';
import './nextTick-ea093886.js';
import './flatten-994f45c6.js';
import './isRemote-2533b7cb.js';
import './base64StringToBlobOrBuffer-3fd03be6.js';
import './typedBuffer-a8220a49.js';
import './pouchdb-collate.js';
import './fetch-f2310cb2.js';
import 'stream';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import 'util';
import './upsert-331b6913.js';
import './pouchdb-crypto.js';

function createBuiltInError(name) {
  var message = 'builtin ' + name +
    ' function requires map values to be numbers' +
    ' or number arrays';
  return new BuiltInError(message);
}

function sum(values) {
  var result = 0;
  for (var i = 0, len = values.length; i < len; i++) {
    var num = values[i];
    if (typeof num !== 'number') {
      if (Array.isArray(num)) {
        // lists of numbers are also allowed, sum them separately
        result = typeof result === 'number' ? [result] : result;
        for (var j = 0, jLen = num.length; j < jLen; j++) {
          var jNum = num[j];
          if (typeof jNum !== 'number') {
            throw createBuiltInError('_sum');
          } else if (typeof result[j] === 'undefined') {
            result.push(jNum);
          } else {
            result[j] += jNum;
          }
        }
      } else { // not array/number
        throw createBuiltInError('_sum');
      }
    } else if (typeof result === 'number') {
      result += num;
    } else { // add number to array
      result[0] += num;
    }
  }
  return result;
}

// Inside of 'vm' for Node, we need a way to translate a pseudo-error
// back into a real error once it's out of the VM.
function createBuiltInErrorInVm(name) {
  return {
    builtInError: true,
    name: name
  };
}

function convertToTrueError(err) {
  return createBuiltInError(err.name);
}

function isBuiltInError(obj) {
  return obj && obj.builtInError;
}

// All of this vm hullaballoo is to be able to run arbitrary code in a sandbox
// for security reasons.
function evalFunctionInVm(func, emit) {
  return function (arg1, arg2, arg3) {
    var code = '(function() {"use strict";' +
      'var createBuiltInError = ' + createBuiltInErrorInVm.toString() + ';' +
      'var sum = ' + sum.toString() + ';' +
      'var log = function () {};' +
      'var isArray = Array.isArray;' +
      'var toJSON = JSON.parse;' +
      'var __emitteds__ = [];' +
      'var emit = function (key, value) {__emitteds__.push([key, value]);};' +
      'var __result__ = (' +
      func.replace(/;\s*$/, '') + ')' + '(' +
      JSON.stringify(arg1) + ',' +
      JSON.stringify(arg2) + ',' +
      JSON.stringify(arg3) + ');' +
      'return {result: __result__, emitteds: __emitteds__};' +
      '})()';

    var output = vm.runInNewContext(code);

    output.emitteds.forEach(function (emitted) {
      emit(emitted[0], emitted[1]);
    });
    if (isBuiltInError(output.result)) {
      output.result = convertToTrueError(output.result);
    }
    return output.result;
  };
}

var log = guardedConsole.bind(null, 'log');
var isArray = Array.isArray;
var toJSON = JSON.parse;

function evalFunctionWithEval(func, emit) {
  return scopeEval(
    "return (" + func.replace(/;\s*$/, "") + ");",
    {
      emit: emit,
      sum: sum,
      log: log,
      isArray: isArray,
      toJSON: toJSON
    }
  );
}

// The "stringify, then execute in a VM" strategy totally breaks Istanbul due
// to missing __coverage global objects. As a solution, export different
// code during coverage testing and during regular execution.
// Note that this doesn't get shipped to consumers because Rollup replaces it
// with rollup-plugin-replace, so process.env.COVERAGE is replaced with `false`
var evalFunc;
/* istanbul ignore else */
if (process.env.COVERAGE) {
  evalFunc = evalFunctionWithEval;
} else {
  evalFunc = evalFunctionInVm;
}

var evalFunction = evalFunc;

var builtInReduce = {
  _sum: function (keys, values) {
    return sum(values);
  },

  _count: function (keys, values) {
    return values.length;
  },

  _stats: function (keys, values) {
    // no need to implement rereduce=true, because Pouch
    // will never call it
    function sumsqr(values) {
      var _sumsqr = 0;
      for (var i = 0, len = values.length; i < len; i++) {
        var num = values[i];
        _sumsqr += (num * num);
      }
      return _sumsqr;
    }
    return {
      sum     : sum(values),
      min     : Math.min.apply(null, values),
      max     : Math.max.apply(null, values),
      count   : values.length,
      sumsqr : sumsqr(values)
    };
  }
};

function getBuiltIn(reduceFunString) {
  if (/^_sum/.test(reduceFunString)) {
    return builtInReduce._sum;
  } else if (/^_count/.test(reduceFunString)) {
    return builtInReduce._count;
  } else if (/^_stats/.test(reduceFunString)) {
    return builtInReduce._stats;
  } else if (/^_/.test(reduceFunString)) {
    throw new Error(reduceFunString + ' is not a supported reduce function.');
  }
}

function mapper(mapFun, emit) {
  // for temp_views one can use emit(doc, emit), see #38
  if (typeof mapFun === "function" && mapFun.length === 2) {
    var origMap = mapFun;
    return function (doc) {
      return origMap(doc, emit);
    };
  } else {
    return evalFunction(mapFun.toString(), emit);
  }
}

function reducer(reduceFun) {
  var reduceFunString = reduceFun.toString();
  var builtIn = getBuiltIn(reduceFunString);
  if (builtIn) {
    return builtIn;
  } else {
    return evalFunction(reduceFunString);
  }
}

function ddocValidator(ddoc, viewName) {
  var fun = ddoc.views && ddoc.views[viewName];
  if (typeof fun.map !== 'string') {
    throw new NotFoundError('ddoc ' + ddoc._id + ' has no string view named ' +
      viewName + ', instead found object of type: ' + typeof fun.map);
  }
}

var localDocName = 'mrviews';
var abstract = createAbstractMapReduce(localDocName, mapper, reducer, ddocValidator);

function query(fun, opts, callback) {
  return abstract.query.call(this, fun, opts, callback);
}

function viewCleanup(callback) {
  return abstract.viewCleanup.call(this, callback);
}

var mapreduce = {
  query: query,
  viewCleanup: viewCleanup
};

export { mapreduce as default };
