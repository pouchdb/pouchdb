'use strict';

if (!process.env.LEVEL_ADAPTER &&
  !process.env.LEVEL_PREFIX &&
  !process.env.AUTO_COMPACTION &&
  !process.env.ADAPTER) {
  // these tests don't make sense for anything other than default leveldown

  describe('test.failures.js', function () {

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

}