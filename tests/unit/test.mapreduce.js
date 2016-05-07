'use strict';

var should = require('chai').should();
var upsert = require('../../packages/pouchdb').utils.upsert;
var utils = require('../../packages/pouchdb').utils.mapReduceUtils;
var Promise = require('../../packages/pouchdb').utils.Promise;

describe('test.mapreduce.js-upsert', function () {
  it('should throw an error with no doc id', function () {
    return upsert().should.be.rejected;
  });
  it('should throw an error if the doc errors', function () {
    return upsert({
      get: function (foo, cb) {
        cb(new Error('a fake error!'));
      }
    }, 'foo').should.be.rejected;
  });
  it('should fulfill if the diff returns false', function () {
    return upsert({
      get: function (foo, cb) {
        cb(null, 'lalala');
      }
    }, 'foo', function () {
      return false;
    }).should.be.fulfilled;
  });
  it('should error if it can\'t put', function () {
    return upsert({
      get: function (foo, cb) {
        cb(null, 'lalala');
      },
      put: function () {
        return Promise.reject(new Error('falala'));
      }
    }, 'foo', function () {
      return true;
    }).should.be.rejected;
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
      return {};
    }).should.be.fullfilled;
  });
  it('fin should work without returning a function and it rejects',
    function () {
    return utils.fin(Promise.reject(), function () {
      return {};
    }).should.be.rejected;
  });
});
