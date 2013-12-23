"use strict";

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}


QUnit.module('replication-http-errors:');

function MockDatabase(statusCodeToReturn, dataToReturn) {
  this.id = function () {
    return 123;
  };

  this.get = function (id, callback) {
    setTimeout(function () {
      if (statusCodeToReturn !== 200) {
        callback({status: statusCodeToReturn}, dataToReturn)
      } else {
        callback(null, dataToReturn)
      }
    }, 0);
  };

  this.changes = function (opts) {
    opts.complete();
    return [];
  }
}

function getCallback(expectError) {
  // returns a function which expects to be called within a certain time. Fails the test otherwise

  var maximumTimeToWait = 50;
  var _hasBeenCalled;
  var _result;
  var _err;

  var callback = function (err, result) {
    _hasBeenCalled = true;
    _result = result;
    _err = err;
  };

  var timeOutCallback = function () {
    ok(_hasBeenCalled , 'callback has been called');
    ok(expectError || !_err , 'error expectation fulfilled');
    start();
  };

  setTimeout(timeOutCallback, maximumTimeToWait);

  return callback;
}

asyncTest("Initial replication is ok if source returns HTTP 404", function () {
  var source = new MockDatabase(404, null);
  var target = new MockDatabase(200, {});
  PouchDB.replicate(source, target, {}, getCallback());
});

asyncTest("Initial replication is ok if target returns HTTP 404", function () {
  var source = new MockDatabase(200, {});
  var target = new MockDatabase(404, null);
  PouchDB.replicate(source, target, {}, getCallback());
});

asyncTest("Initial replication is ok if source and target return HTTP 200", function () {
  var source = new MockDatabase(200, {});
  var target = new MockDatabase(200, {});
  PouchDB.replicate(source, target, {}, getCallback());
});

asyncTest("Initial replication returns err if source returns HTTP 500", function () {
  var source = new MockDatabase(500, null);
  var target = new MockDatabase(200, {});
  PouchDB.replicate(source, target, {}, getCallback(true));
});

asyncTest("Initial replication returns err if target returns HTTP 500", function () {
  var source = new MockDatabase(200, {});
  var target = new MockDatabase(500, null);
  PouchDB.replicate(source, target, {}, getCallback(true));
});

asyncTest("Initial replication returns err if target and source return HTTP 500", function () {
  var source = new MockDatabase(500, null);
  var target = new MockDatabase(500, null);
  PouchDB.replicate(source, target, {}, getCallback(true));
});

asyncTest("Subsequent replication returns err if source return HTTP 500", function () {
  var source = new MockDatabase(500, null);
  var target = new MockDatabase(200, {last_seq: 456});
  PouchDB.replicate(source, target, {}, getCallback(true));
});
