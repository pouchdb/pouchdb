import require$$0 from 'buffer';
import 'events';
import 'crypto';

require$$0.Buffer;

// most of this is borrowed from lodash.isPlainObject:
// https://github.com/fis-components/lodash.isplainobject/
// blob/29c358140a74f252aeb08c9eb28bef86f2217d4a/index.js

var funcToString = Function.prototype.toString;
funcToString.call(Object);

function nextTick(fn) {
  process.nextTick(fn);
}

if (process.env.COVERAGE) ;

class PouchError extends Error {
  constructor(status, error, reason) {
    super();
    this.status = status;
    this.name = error;
    this.message = reason;
    this.error = true;
  }

  toString() {
    return JSON.stringify({
      status: this.status,
      name: this.name,
      message: this.message,
      reason: this.reason
    });
  }
}

new PouchError(401, 'unauthorized', "Name or password is incorrect.");
new PouchError(400, 'bad_request', "Missing JSON list of 'docs'");
new PouchError(404, 'not_found', 'missing');
new PouchError(409, 'conflict', 'Document update conflict');
new PouchError(400, 'bad_request', '_id field must contain a string');
new PouchError(412, 'missing_id', '_id is required for puts');
new PouchError(400, 'bad_request', 'Only reserved document ids may start with underscore.');
new PouchError(412, 'precondition_failed', 'Database not open');
new PouchError(500, 'unknown_error', 'Database encountered an unknown error');
new PouchError(500, 'badarg', 'Some query argument is invalid');
new PouchError(400, 'invalid_request', 'Request was invalid');
new PouchError(400, 'query_parse_error', 'Some query parameter is invalid');
new PouchError(500, 'doc_validation', 'Bad special document member');
new PouchError(400, 'bad_request', 'Something wrong with the request');
new PouchError(400, 'bad_request', 'Document must be a JSON object');
new PouchError(404, 'not_found', 'Database not found');
new PouchError(500, 'indexed_db_went_bad', 'unknown');
new PouchError(500, 'web_sql_went_bad', 'unknown');
new PouchError(500, 'levelDB_went_went_bad', 'unknown');
new PouchError(403, 'forbidden', 'Forbidden by design doc validate_doc_update function');
new PouchError(400, 'bad_request', 'Invalid rev format');
new PouchError(412, 'file_exists', 'The database could not be created, the file already exists.');
new PouchError(412, 'missing_stub', 'A pre-existing attachment stub wasn\'t found');
new PouchError(413, 'invalid_url', 'Provided URL is invalid');

class QueryParseError extends Error {
  constructor(message) {
    super();
    this.status = 400;
    this.name = 'query_parse_error';
    this.message = message;
    this.error = true;
    try {
      Error.captureStackTrace(this, QueryParseError);
    } catch (e) {}
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super();
    this.status = 404;
    this.name = 'not_found';
    this.message = message;
    this.error = true;
    try {
      Error.captureStackTrace(this, NotFoundError);
    } catch (e) {}
  }
}

class BuiltInError extends Error {
  constructor(message) {
    super();
    this.status = 500;
    this.name = 'invalid_value';
    this.message = message;
    this.error = true;
    try {
      Error.captureStackTrace(this, BuiltInError);
    } catch (e) {}
  }
}

function promisedCallback(promise, callback) {
  if (callback) {
    promise.then(function (res) {
      nextTick(function () {
        callback(null, res);
      });
    }, function (reason) {
      nextTick(function () {
        callback(reason);
      });
    });
  }
  return promise;
}

function callbackify(fun) {
  return function (...args) {
    var cb = args.pop();
    var promise = fun.apply(this, args);
    if (typeof cb === 'function') {
      promisedCallback(promise, cb);
    }
    return promise;
  };
}

// Promise finally util similar to Q.finally
function fin(promise, finalPromiseFactory) {
  return promise.then(function (res) {
    return finalPromiseFactory().then(function () {
      return res;
    });
  }, function (reason) {
    return finalPromiseFactory().then(function () {
      throw reason;
    });
  });
}

function sequentialize(queue, promiseFactory) {
  return function () {
    var args = arguments;
    var that = this;
    return queue.add(function () {
      return promiseFactory.apply(that, args);
    });
  };
}

// uniq an array of strings, order not guaranteed
// similar to underscore/lodash _.uniq
function uniq(arr) {
  var theSet = new Set(arr);
  var result = new Array(theSet.size);
  var index = -1;
  theSet.forEach(function (value) {
    result[++index] = value;
  });
  return result;
}

function mapToKeysArray(map) {
  var result = new Array(map.size);
  var index = -1;
  map.forEach(function (value, key) {
    result[++index] = key;
  });
  return result;
}

export { BuiltInError, NotFoundError, QueryParseError, callbackify, fin, mapToKeysArray, promisedCallback, sequentialize, uniq };
