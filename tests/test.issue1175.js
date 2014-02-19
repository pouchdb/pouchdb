'use strict';
function MockDatabase(statusCodeToReturn, dataToReturn) {
  this.id = function (callback) {
    callback(123);
  };
  this.get = function (id, callback) {
    setTimeout(function () {
      if (statusCodeToReturn !== 200) {
        callback({ status: statusCodeToReturn }, dataToReturn);
      } else {
        callback(null, dataToReturn);
      }
    }, 0);
  };
  this.changes = function (opts) {
    opts.complete();
    return [];
  };
}
function getCallback(expectError, done) {
  // returns a function which expects to be called within a certain time. Fails the test otherwise
  var maximumTimeToWait = 500;
  var hasBeenCalled = false;
  var result;
  var err;
  function callback(error, resp) {
    hasBeenCalled = true;
    result = resp;
    err = error;
  }
  function timeOutCallback() {
    hasBeenCalled.should.equal(true, 'callback has been called');
    if (!expectError) {
      should.not.exist(err, 'error expectation fulfilled');
    }
    done();
  }
  setTimeout(timeOutCallback, maximumTimeToWait);
  return callback;
}
describe('replication-http-errors:', function () {
  it('Initial replication is ok if source returns HTTP 404', function (done) {
    var source = new MockDatabase(404, null);
    var target = new MockDatabase(200, {});
    PouchDB.replicate(source, target, {}, getCallback(false, done));
  });
  it('Initial replication is ok if target returns HTTP 404', function (done) {
    var source = new MockDatabase(200, {});
    var target = new MockDatabase(404, null);
    PouchDB.replicate(source, target, {}, getCallback(false, done));
  });
  it('Initial replication is ok if source and target return HTTP 200', function (done) {
    var source = new MockDatabase(200, {});
    var target = new MockDatabase(200, {});
    PouchDB.replicate(source, target, {}, getCallback(false, done));
  });
  it('Initial replication returns err if source returns HTTP 500', function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(200, {});
    PouchDB.replicate(source, target, {}, getCallback(true, done));
  });
  it('Initial replication returns err if target returns HTTP 500', function (done) {
    var source = new MockDatabase(200, {});
    var target = new MockDatabase(500, null);
    PouchDB.replicate(source, target, {}, getCallback(true, done));
  });
  it('Initial replication returns err if target and source return HTTP 500', function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(500, null);
    PouchDB.replicate(source, target, {}, getCallback(true, done));
  });
  it('Subsequent replication returns err if source return HTTP 500', function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(200, { last_seq: 456 });
    PouchDB.replicate(source, target, {}, getCallback(true, done));
  });
});