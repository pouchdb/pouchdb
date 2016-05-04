
'use strict';

var should = require('chai').should();
var PouchDB = require('../../packages/pouchdb-for-coverage');
var normalizeDdocFunctionName = PouchDB.utils.normalizeDdocFunctionName;
var parseDdocFunctionName = PouchDB.utils.parseDdocFunctionName;
var createError = PouchDB.utils.createError;
var errors = PouchDB.Errors;

describe('test.utils.js', function () {
  describe('the design doc function name normalizer', function () {
    it('normalizes foo to foo/foo', function () {
      normalizeDdocFunctionName('foo').should.be.eql('foo/foo');
    });
    it('normalizes foo/bar to foo/bar', function () {
      normalizeDdocFunctionName('foo/bar').should.be.eql('foo/bar');
    });
    it('normalizes null to a non existing value', function () {
      should.not.exist(normalizeDdocFunctionName(null));
    });
  });
  describe('ddoc function name parser', function () {
    it('parses foo/bar as [foo,bar]', function () {
      parseDdocFunctionName('foo/bar').should.be.eql(['foo', 'bar']);
    });
    it('parses foo as [foo,foo]', function () {
      parseDdocFunctionName('foo').should.be.eql(['foo', 'foo']);
    });
    it('throws if it can\'t parse the function name', function () {
      should.not.exist(parseDdocFunctionName(null));
      should.not.exist(parseDdocFunctionName('foo/bar/baz'));
    });
  });
  describe('create error', function () {
    it('Error works', function () {
      var newError = createError(
        errors.BAD_REQUEST, 'love needs no message');
      newError.status.should.equal(errors.BAD_REQUEST.status);
      newError.name.should.equal(errors.BAD_REQUEST.name);
      newError.message.should.equal(errors.BAD_REQUEST.message,
        'correct error message returned');
      newError.reason.should.equal('love needs no message');
    });
  });
});
