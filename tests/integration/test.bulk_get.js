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

    it('test bulk get with latest=true', function () {
      var db = new PouchDB(dbs.name);
      var first;

      return db.post({ version: 'first' })
        .then(function (info) {
          first = info.rev;
          return db.put({
          _id: info.id,
          _rev: info.rev,
          version: 'second'
        }).then(function (info) {
          return db.bulkGet({
            docs: [
              {id: info.id, rev: first }
            ],
            latest: true
          });
        }).then(function (response) {
          var result = response.results[0];
          result.docs[0].ok.version.should.equal('second');
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

    it('test bulk get with bad revision specified', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function () {
        db.bulkGet({
          docs: [
            {id: 'foo', rev: 'BAD_REV'}
          ]
        }).then(function (resp) {
          var result = resp.results[0];
          result.id.should.equal('foo');
          if (adapter === 'local') {
            //{"id":"foo","docs":[{"error":{"status":400,"name":"bad_request","message":"Invalid rev format","error":true}}]}
            result.docs[0].error.should.have.property('name', 'bad_request');
          } else {
            //{"id":"foo","docs":[{"error":{"id":"foo","rev":"BAD_REV","error":"bad_request","reason":"Invalid rev format"}}]}
            result.docs[0].error.should.have.property('error', 'bad_request');
          }
          done();
        });
      });
    });

    it('test bulk get with bad revision specified with latest=true', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function () {
        db.bulkGet({
          docs: [
            {id: 'foo', rev: 'BAD_REV'}
          ],
          latest: true
        }).then(function (resp) {
          var result = resp.results[0];
          result.id.should.equal('foo');
          if (adapter === 'local') {
            //{"id":"foo","docs":[{"error":{"status":400,"name":"bad_request","message":"Invalid rev format","error":true}}]}
            result.docs[0].error.should.have.property('name', 'bad_request');
          } else {
            //{"id":"foo","docs":[{"error":{"id":"foo","rev":"BAD_REV","error":"bad_request","reason":"Invalid rev format"}}]}
            result.docs[0].error.should.have.property('error', 'bad_request');
          }
          done();
        });
      });
    });

    it('test bulk get with non-existing revision specified', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function (response) {
        var invalidRev = testUtils.getInvalidRev(response.rev);
        db.bulkGet({
          docs: [
            {id: 'foo', rev: invalidRev}
          ]
        }).then(function (resp) {
          var result = resp.results[0];
          result.id.should.equal('foo');
          if (adapter === 'local') {
            //{"id":"foo","docs":[{"missing":invalidRev}]
            result.docs[0].should.have.property('missing', invalidRev);
          } else {
            //{"id":"foo","docs":[{"error":{"id":"foo","rev":invalidRev,"error":"not_found","reason":"missing"}}]}
            result.docs[0].error.should.have.property('error', 'not_found');
          }
          done();
        });
      });
    });

    it('#7756 test bulk get with non-existing revision specified with latest=true', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', val: 1}).then(function (response) {
        var invalidRev = testUtils.getInvalidRev(response.rev);
        db.bulkGet({
          docs: [
            {id: 'foo', rev: invalidRev}
          ],
          latest: true
        }).then(function (resp) {
          var result = resp.results[0];
          result.id.should.equal('foo');
          if (adapter === 'local') {
            //{"id":"foo","docs":[{"missing":invalidRev}]
            result.docs[0].should.have.property('missing', invalidRev);
          } else {
            //{"id":"foo","docs":[{"error":{"id":"foo","rev":invalidRev,"error":"not_found","reason":"missing"}}]}
            result.docs[0].error.should.have.property('error', 'not_found');
          }
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

    it('#5886 bulkGet with reserved id', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'constructor', val: 1}).then(function (response) {
        var rev = response.rev;
        db.bulkGet({
          docs: [
            {id: 'constructor', rev: rev}
          ]
        }).then(function (response) {
          var result = response.results[0];
          result.docs[0].ok._id.should.equal('constructor');
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
      }).then(function () {
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
