'use strict';

var testUtils = require('./utils');
var PouchDB = testUtils.PouchDB;
var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.bulk_get.js-' + adapter, function () {

    var dbs = {};
    beforeEach(function (done) {
      dbs = {name: testUtils.adapterUrl(adapter, 'testdb')};
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('test bulk get with rev specified', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function (response) {
        var rev = response.rev;
        db.bulkGet({
          docs: [
            {id: 'foo', rev: rev}
          ]
        }).then(function (response) {
          var result = response.results[0];
          result.id.should.equal("foo");
          result.docs[0].ok._rev.should.equal(rev);
          done();
        });
      });
    });

    it('test bulk get with no rev specified', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function (response) {
        var rev = response.rev;
        db.bulkGet({
          docs: [
            {id: 'foo'}
          ]
        }).then(function (response) {
          var result = response.results[0];
          result.id.should.equal("foo");
          result.docs[0].ok._rev.should.equal(rev);
          done();
        });
      });
    });

    it('_revisions is not returned by default', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function (response) {
        var rev = response.rev;
        db.bulkGet({
          docs: [
            {id: 'foo', rev: rev}
          ]
        }).then(function (response) {
          var result = response.results[0];
          should.not.exist(result.docs[0].ok._revisions);
          done();
        });
      });
    });

    it('_revisions is returned when specified', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function (response) {
        var rev = response.rev;
        db.bulkGet({
          docs: [
            {id: 'foo', rev: rev}
          ],
          revs: true
        }).then(function (response) {
          var result = response.results[0];
          result.docs[0].ok._revisions.ids[0].should.equal(rev.substring(2));
          done();
        });
      });
    });

    it('_revisions is returned when specified, using implicit rev',
    function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function (response) {
        var rev = response.rev;
        db.bulkGet({
          docs: [
            {id: 'foo'}
          ],
          revs: true
        }).then(function (response) {
          var result = response.results[0];
          result.docs[0].ok._revisions.ids[0].should.equal(rev.substring(2));
          done();
        });
      });
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

    it('attachments are included when specified', function (done) {
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
          ],
          attachments: true
        }).then(function (response) {
          var result = response.results[0];
          result.docs[0].ok._attachments['foo.txt'].data
            .should.equal("VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ=");
          done();
        });
      });
    });

    it('attachments are included when specified, using implicit rev',
    function (done) {
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
        db.bulkGet({
          docs: [
            {id: 'foo'}
          ],
          attachments: true
        }).then(function (response) {
          var result = response.results[0];
          result.docs[0].ok._attachments['foo.txt'].data
            .should.equal("VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ=");
          done();
        });
      });
    });
  });
});
