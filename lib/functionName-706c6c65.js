import { g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import require$$0 from 'buffer';

var Buffer = require$$0.Buffer;

function hasFrom() {
  // Node versions 5.x below 5.10 seem to have a `from` method
  // However, it doesn't clone Buffers
  // Luckily, it reports as `false` to hasOwnProperty
  return (Buffer.hasOwnProperty('from') && typeof Buffer.from === 'function');
}

function cloneBuffer(buf) {
  if (!Buffer.isBuffer(buf)) {
    throw new Error('Can only clone Buffer.');
  }

  if (hasFrom()) {
    return Buffer.from(buf);
  }

  var copy = new Buffer(buf.length);
  buf.copy(copy);
  return copy;
}

cloneBuffer.hasFrom = hasFrom;

var cloneBuffer_1 = cloneBuffer;

var cloneBuffer$1 = /*@__PURE__*/getDefaultExportFromCjs(cloneBuffer_1);

// most of this is borrowed from lodash.isPlainObject:
// https://github.com/fis-components/lodash.isplainobject/
// blob/29c358140a74f252aeb08c9eb28bef86f2217d4a/index.js

var funcToString = Function.prototype.toString;
var objectCtorString = funcToString.call(Object);

function isPlainObject(value) {
  var proto = Object.getPrototypeOf(value);
  /* istanbul ignore if */
  if (proto === null) { // not sure when this happens, but I guess it can
    return true;
  }
  var Ctor = proto.constructor;
  return (typeof Ctor == 'function' &&
    Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString);
}

var assign;
if (process.env.COVERAGE) { // don't penalize us on code coverage for this polyfill
  assign = Object.assign;
} else {
  if (typeof Object.assign === 'function') {
    assign = Object.assign;
  } else {
    // lite Object.assign polyfill based on
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
    assign = function (target) {
      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource != null) { // Skip over if undefined or null
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }
}

var assign$1 = assign;

// shim for Function.prototype.name,
// for browsers that don't support it like IE

/* istanbul ignore next */
function f() {}

var hasName = f.name;
var res;

// We dont run coverage in IE
/* istanbul ignore else */
if (hasName) {
  res = function (fun) {
    return fun.name;
  };
} else {
  res = function (fun) {
    var match = fun.toString().match(/^\s*function\s*(?:(\S+)\s*)?\(/);
    if (match && match[1]) {
      return match[1];
    }
    else {
      return '';
    }
  };
}

var functionName = res;

export { assign$1 as a, cloneBuffer$1 as c, functionName as f, isPlainObject as i };
