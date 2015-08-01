
'use strict';

var should = require('chai').should();
var normalizeDdocFunctionName =
  require('../../lib/deps/docs/normalizeDdocFunctionName');
var parseDdocFunctionName =
  require('../../lib/deps/docs/parseDdocFunctionName');

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
});
