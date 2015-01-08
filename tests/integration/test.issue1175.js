'use strict';
function MockDatabase(statusCodeToReturn, dataToReturn) {
  this.once = this.removeListener = function () {};
  this.type = function () { return 'mock'; };
  this.id = function (callback) {
    if (callback) {
      callback(123);
    } else {
      return PouchDB.utils.Promise.resolve(123);
    }
  };
  this.get = function (id, callback) {
    return new PouchDB.utils.Promise(function (fulfill, reject) {
      setTimeout(function () {
        if (statusCodeToReturn !== 200) {
          reject({ status: statusCodeToReturn });
        } else {
          fulfill(dataToReturn);
        }
      }, 0);
    });
  };
  this.changes = function (opts) {
    if (opts.complete) {
      opts.complete(null, {results: []});
    }
    var promise = PouchDB.utils.Promise.resolve({results: []});
    promise.on = function () { return this; };
    return promise;
  };
  this.put = function () {
    return PouchDB.utils.Promise.resolve();
  };
}
function getCallback(expectError, done) {
  // returns a function which expects to be called within a certain time.
  // Fails the test otherwise
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
  it('Initial replication is ok if source and target return HTTP 200',
    function (done) {
    var source = new MockDatabase(200, {});
    var target = new MockDatabase(200, {});
    PouchDB.replicate(source, target, {}, getCallback(false, done));
  });
  it('Initial replication returns err if source returns HTTP 500',
    function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(200, {});
    PouchDB.replicate(source, target, {retry: false}, getCallback(true, done));
  });
  it('Initial replication returns err if target returns HTTP 500',
    function (done) {
    var source = new MockDatabase(200, {});
    var target = new MockDatabase(500, null);
    PouchDB.replicate(source, target, {retry: false}, getCallback(true, done));
  });
  it('Initial replication returns err if target and source return HTTP 500',
    function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(500, null);
    PouchDB.replicate(source, target, {retry: false}, getCallback(true, done));
  });
  it('Subsequent replication returns err if source return HTTP 500',
    function (done) {
    var source = new MockDatabase(500, null);
    var target = new MockDatabase(200, { last_seq: 456 });
    PouchDB.replicate(source, target, {retry: false}, getCallback(true, done));
  });
});
