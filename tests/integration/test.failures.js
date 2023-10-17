'use strict';

if (!process.env.LEVEL_ADAPTER &&
  !process.env.LEVEL_PREFIX &&
  !process.env.AUTO_COMPACTION &&
  !process.env.ADAPTERS) {
  // these tests don't make sense for anything other than default leveldown

  describe('test.failures.js', function () {

    describe('invalid path', function () {

      var invalidPath = 'C:\\/path/to/thing/that/doesnt/exist\\with\\backslashes\\too';

      it('fails gracefully in first API call', function () {
        var db = new PouchDB(invalidPath);
        return db.info().then(function () {
          throw new Error('expected an error here');
        }, function (err) {
          should.exist(err);
        });
      });

      it('fails gracefully in first changes() call', function () {
        var db = new PouchDB(invalidPath);
        return db.changes().then(function () {
          throw new Error('expected an error here');
        }, function (err) {
          should.exist(err);
        });
      });

      it('fails for all API calls', function () {
        var db = new PouchDB(invalidPath);

        function expectError(promise) {
          return promise.then(function () {
            throw new Error('expected an error here');
          }, function (err) {
            should.exist(err);
          });
        }

        return expectError(db.changes()).then(function () {
          return expectError(db.info());
        }).then(function () {
          return expectError(db.get('foo'));
        });
      });

    });

    describe('error stack', function () {
      var dbs = {};

      beforeEach(function () {
        dbs.name = testUtils.adapterUrl('local', 'testdb');
      });

      afterEach(function (done) {
        testUtils.cleanup([dbs.name], done);
      });

      it('INVALID_ID error stack', function (done) {
        var db = new PouchDB(dbs.name);
        db.get(1234, function (err) {
          try {
            err.stack.should.be.a('string');
            err.status.should.equal(testUtils.errors.INVALID_ID.status,
                                    'correct error status returned');
            err.name.should.equal(testUtils.errors.INVALID_ID.name,
                                  'correct error name returned');
            err.message.should.equal(testUtils.errors.INVALID_ID.message,
                                     'correct error message returned');
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });

  });

}
