'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.bulk_get.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function () {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('attachments are not included by default', function (done) {
      var db = new PouchDB(dbs.name);

      db.put({
        _id: 'foo',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ='
          }
        }
      }).then(function (response) {
        var rev = response.rev;

        db.bulkGet({
          docs: [
            {id: 'foo', rev: rev}
          ]
        }).then(function (response) {
          var result = response.results[0];
          result.docs[0].ok._attachments['foo.txt'].stub.should.equal(true);
          done();
        });
      });
    });
  });
});
