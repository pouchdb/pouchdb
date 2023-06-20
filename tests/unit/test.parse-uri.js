'use strict';

require('chai').should();
var PouchDB = require('../../packages/pouchdb-for-coverage');
var parseUri = PouchDB.utils.parseUri;

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

  it('#2853 test uri parsing usernames/passwords', function () {
    var uri = parseUri(
      'http://u%24ern%40me:p%26%24%24w%40rd@foo.com');
    uri.password.should.equal('p&$$w@rd');
    uri.user.should.equal('u$ern@me');
    uri.host.should.equal('foo.com');
  });

});