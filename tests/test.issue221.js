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
      dbs.name = testUtils.adapterUrl(adapters[0], 'test_221');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_221_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    var doc = {_id: '0', integer: 0};

    it('Testing issue #221', function (done) {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      // Write a doc in CouchDB.
      remote.put(doc, function (err, results) {
        // Update the doc.
        doc._rev = results.rev;
        doc.integer = 1;
        remote.put(doc, function (err, results) {
          // Compact the db.
          remote.compact(function () {
            remote.get(doc._id, { revs_info: true }, function (err, data) {
              var correctRev = data._revs_info[0];
              local.replicate.from(remote, function (err, results) {
                // Check the Pouch doc.
                local.get(doc._id, function (err, results) {
                  results._rev.should.equal(correctRev.rev);
                  results.integer.should.equal(1);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Testing issue #221 again', function (done) {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      // Write a doc in CouchDB.
      remote.put(doc, function (err, results) {
        doc._rev = results.rev;
        // Second doc so we get 2 revisions from replicate.
        remote.put(doc, function (err, results) {
          doc._rev = results.rev;
          local.replicate.from(remote, function (err, results) {
            doc.integer = 1;
            // One more change
            remote.put(doc, function (err, results) {
              // Testing if second replications fails now
              local.replicate.from(remote, function (err, results) {
                local.get(doc._id, function (err, results) {
                  results.integer.should.equal(1);
                  done();
                });
              });
            });
          });
        });
      });
    });

  });
});
