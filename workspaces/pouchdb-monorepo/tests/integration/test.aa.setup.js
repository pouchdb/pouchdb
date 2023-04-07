'use strict';

describe('DB Setup', function () {

  it('PouchDB has a version', function () {
    PouchDB.version.should.be.a('string');
    PouchDB.version.should.match(/\d+\.\d+\.\d+/);
  });

  if (typeof process !== 'undefined' && !process.browser) {
    it('PouchDB version matches package.json', function () {
      var pkg = require('../../packages/node_modules/pouchdb/package.json');
      PouchDB.version.should.equal(pkg.version);
    });
  }

});
