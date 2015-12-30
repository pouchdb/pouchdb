'use strict';

require('chai').should();
var parseUri = require('../../lib_unit/deps/parseUri').default;

describe('test.parse-uri.js', function () {

  it('parses a basic uri', function () {
    var parsed = parseUri('http://foobar.com');
    parsed.host.should.equal('foobar.com');
    parsed.protocol.should.equal('http');
  });

  it('parses a complex uri', function () {
    var parsed = parseUri('http://user:pass@foo.com/baz/bar/index.html?hey=yo');
    parsed.should.deep.equal({
        anchor: '',
      query: 'hey=yo',
      file: 'index.html',
      directory: '/baz/bar/',
      path: '/baz/bar/index.html',
      relative: '/baz/bar/index.html?hey=yo',
      port: '',
      host: 'foo.com',
      password: 'pass',
      user: 'user',
      userInfo: 'user:pass',
      authority: 'user:pass@foo.com',
      protocol: 'http',
      source: 'http://user:pass@foo.com/baz/bar/index.html?hey=yo',
      queryKey: { hey: 'yo' } }
    );
  });

});