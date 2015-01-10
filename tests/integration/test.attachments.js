'use strict';

var repl_adapters = [
  ['local', 'local']
];

repl_adapters.forEach(function (adapters) {
  describe('test.attachments.js- ' + adapters[0] + ':' + adapters[1],
    function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_attach_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('Simple attachment replicates', function () {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var rev;

      var data = PouchDB.utils.btoa('foobar');
      var blob = testUtils
        .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)),
        'text/plain');

      var doc = {
        _id: 'foo',
        _attachments: {
          'att.txt': {
            content_type: 'text/plain',
            data: blob
          }
        }
      };
      return db.put(doc).then(function (info) {
        rev = info.rev;
        return db.replicate.to(remote);
      }).then(function () {
        return remote.get('foo', {attachments: true});
      }).then(function (doc) {
        var keys = Object.keys(doc._attachments);
        keys.sort();
        doc._attachments['att.txt'].data.should.equal(data);
      });
    });
  });
});
