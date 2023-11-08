'use strict';

var should = require('chai').should();
var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');
var upsert = PouchDB.utils.upsert;
var utils = PouchDB.utils.mapReduceUtils;

describe('test.mapreduce.js-upsert', function () {
  it('should throw an error if the doc errors', function () {
    return upsert({
      get: function () {
        return Promise.reject(new Error('a fake error!'));
      }
    }, 'foo')
    .then(function () {
      should.fail("Expected promise to be rejected");
    })
    .catch(function (err) {
      err.message.should.equal("a fake error!");
    });
  });
  it('should fulfill if the diff returns false', function () {
    return upsert({
      get: function () {
        return Promise.resolve({ _rev: 'xyz' });
      }
    }, 'foo', function () {
      return false;
    }).then(function (res) {
      res.updated.should.equal(false);
      res.rev.should.equal('xyz');
    });
  });
  it('should put if get throws 404', function () {
    return upsert({
      get: function () {
        return Promise.reject({ status: 404 });
      },
      put: function () {
        return Promise.resolve({ rev: 'abc' });
      }
    }, 'foo', function () {
      return { difference: "something" };
    }).then(function (res) {
      res.updated.should.equal(true);
      res.rev.should.equal('abc');
    });
  });
  it('should error if it can\'t put', function () {
    return upsert({
      get: function () {
        return Promise.resolve({ _rev: 'xyz' });
      },
      put: function () {
        return Promise.reject(new Error('falala'));
      }
    }, 'foo', function () {
      return { difference: "something" };
    })
    .then(function () {
      should.fail("Expected promise to be rejected");
    })
    .catch(function (err) {
      err.message.should.equal("falala");
    });
  });
});

describe('test.mapreduce.js-utils', function () {

  it('callbackify should work with a callback', function (done) {
    function fromPromise() {
      return Promise.resolve(true);
    }
    utils.callbackify(fromPromise)(function (err, resp) {
      should.not.exist(err);
      should.exist(resp);
      done();
    });
  });

  it('fin should work without returning a function and it resolves',
    function () {
    return utils.fin(Promise.resolve(), function () {
      return Promise.resolve();
    }).should.be.fullfilled;
  });

  it('fin should work without returning a function and it rejects',
    function () {
    return utils.fin(Promise.reject(), function () {
      return Promise.resolve();
    }).should.be.rejected;
  });

});
