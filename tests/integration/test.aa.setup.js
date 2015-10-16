'use strict';
describe('DB Setup', function () {
  it('we can find CouchDB with admin credentials', function (done) {
    PouchDB.ajax({ url: testUtils.couchHost() + '/_session' },
      function (err, res) {
        if (err) { return done(err); }
        should.exist(res.ok, 'Found CouchDB');
        res.userCtx.roles.should.include('_admin', 'Found admin permissions');
        done();
      }
    );
  });
});
