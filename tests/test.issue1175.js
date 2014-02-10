"use strict";


function MockDatabase(statusCodeToReturn, dataToReturn) {
  this.id = function (callback) {
    callback(123);
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

function getCallback(expectError, done) {
  // returns a function which expects to be called within a certain time. Fails the test otherwise

  var maximumTimeToWait = 50;
  var _hasBeenCalled;
  var _result;
  var _err;

  function callback(err, result) {
    _hasBeenCalled = true;
    _result = result;
    _err = err;
  };

  function timeOutCallback() {
    _hasBeenCalled.should.equal(true, 'callback has been called');
    if (!expectError) {
      should.not.exist(_err, 'error expectation fulfilled')
    }
    done();
  };

  setTimeout(timeOutCallback, maximumTimeToWait);

  return callback;
}
describe('replication-http-errors:', function () {
  it("Initial replication is ok if source returns HTTP 404", function (done) {
    var source = new MockDatabase(404, null);
    var target = new MockDatabase(200, {});
    PouchDB.replicate(source, target, {}, getCallback(false, done));
  });

  it("Initial replication is ok if target returns HTTP 404", function (done) {
    var source = new MockDatabase(200, {});
    var target = new MockDatabase(404, null);
    PouchDB.replicate(source, target, {}, getCallback(false, done));
  });

  it("Initial replication is ok if source and target return HTTP 200", function (done) {
    var source = new MockDatabase(200, {});
    var target = new MockDatabase(200, {});
    PouchDB.replicate(source, target, {}, getCallback(false, done));
  });

  it("Initial replication returns err if source returns HTTP 500", function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(200, {});
    PouchDB.replicate(source, target, {}, getCallback(true, done));
  });

  it("Initial replication returns err if target returns HTTP 500", function (done) {
    var source = new MockDatabase(200, {});
    var target = new MockDatabase(500, null);
    PouchDB.replicate(source, target, {}, getCallback(true, done));
  });

  it("Initial replication returns err if target and source return HTTP 500", function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(500, null);
    PouchDB.replicate(source, target, {}, getCallback(true, done));
  });

  it("Subsequent replication returns err if source return HTTP 500", function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(200, {last_seq: 456});
    PouchDB.replicate(source, target, {}, getCallback(true, done));
  });
});