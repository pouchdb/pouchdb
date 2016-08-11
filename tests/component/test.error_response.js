'use strict';

var nock = require('nock');
var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');

require('chai').should();

describe('test.error_response.js', function () {

  it('Test we get correct looking error', function () {

    nock('http://example.com')
      .get('/test/')
      .reply(200, {})
      .get('/test/test');

    var db = new PouchDB('http://example.com/test');
    return db.get('test').catch(function (err) {
      err.status.should.equal(404);
    });
  });

});
