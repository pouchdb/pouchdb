
'use strict';

var should = require('chai').should();
var utils = require('../../lib/utils.js');

describe('test.utils.js', function () {
  describe('the design doc function name normalizer', function () {
    it('normalizes foo to foo/foo', function () {
      utils.normalizeDesignDocFunctionName('foo').should.be.eql('foo/foo');
    });
    it('normalizes foo/bar to foo/bar', function () {
      utils.normalizeDesignDocFunctionName('foo/bar').should.be.eql('foo/bar');
    });
    it('normalizes null to a non existing value', function () {
      should.not.exist(utils.normalizeDesignDocFunctionName(null));
    });
  });
  describe('ddoc function name parser', function () {
    it('parses foo/bar as [foo,bar]', function () {
      utils.parseDesignDocFunctionName('foo/bar').should.be.eql(['foo', 'bar']);
    });
    it('parses foo as [foo,foo]', function () {
      utils.parseDesignDocFunctionName('foo').should.be.eql(['foo', 'foo']);
    });
    it('throws if it can\'t parse the function name', function () {
      should.not.exist(utils.parseDesignDocFunctionName(null));
      should.not.exist(utils.parseDesignDocFunctionName('foo/bar/baz'));
    });
  });
});
