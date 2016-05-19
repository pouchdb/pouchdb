'use strict';
describe('DB Setup', function () {
  it('we can find CouchDB with admin credentials', function (done) {
    testUtils.ajax({ url: testUtils.couchHost() + '/_session' },
      function (err, res) {
        if (err) { return done(err); }
        should.exist(res.ok, 'Found CouchDB');
        res.userCtx.roles.should.include('_admin', 'Found admin permissions');
        done();
      }
    );
  });

  it('PouchDB has a version', function () {
    PouchDB.version.should.be.a('string');
    PouchDB.version.should.match(/\d+\.\d+\.\d+/);
  });

  if (typeof process !== 'undefined' && !process.browser) {
    it('PouchDB version matches package.json', function () {
      var pkg = require('../../packages/pouchdb/package.json');
      PouchDB.version.should.equal(pkg.version);
    });
  }
});
