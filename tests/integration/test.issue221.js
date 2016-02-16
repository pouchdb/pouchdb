'use strict';

var adapters = [
  ['local', 'http'],
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'local']
];

adapters.forEach(function (adapters) {
  describe('test.issue221.js-' + adapters[0] + '-' + adapters[1], function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });


    it('Testing issue #221', function () {
      var doc = {_id: '0', integer: 0};
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      // Write a doc in CouchDB.
      return remote.put(doc).then(function (results) {
        // Update the doc.
        doc._rev = results.rev;
        doc.integer = 1;
        return remote.put(doc);
      }).then(function () {
        // Compact the db.
        return remote.compact();
      }).then(function () {
       return remote.get(doc._id, { revs_info: true });
      }).then(function (data) {
        var correctRev = data._revs_info[0];
        return local.replicate.from(remote).then(function () {
          // Check the Pouch doc.
          return local.get(doc._id, function (err, results) {
            results._rev.should.equal(correctRev.rev);
            results.integer.should.equal(1);
          });
        });
      });
    });

    it('Testing issue #221 again', function () {
      if (testUtils.isCouchMaster()) {
        return;
      }
      var doc = {_id: '0', integer: 0};
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      // Write a doc in CouchDB.
      return remote.put(doc).then(function (results) {
        doc._rev = results.rev;
        // Second doc so we get 2 revisions from replicate.
        return remote.put(doc);
      }).then(function (results) {
        doc._rev = results.rev;
        return local.replicate.from(remote);
      }).then(function () {
        doc.integer = 1;
        // One more change
        return remote.put(doc);
      }).then(function () {
        // Testing if second replications fails now
        return local.replicate.from(remote);
      }).then(function () {
        return local.get(doc._id);
      }).then(function (results) {
        results.integer.should.equal(1);
      });
    });

  });
});
