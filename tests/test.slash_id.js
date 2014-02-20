'use strict';
var adapters = [
    'local-1',
    'http-1'
  ];
var repl_adapters = [
    [
      'local-1',
      'http-1'
    ],
    [
      'http-1',
      'http-2'
    ],
    [
      'http-1',
      'local-1'
    ],
    [
      'local-1',
      'local-2'
    ]
  ];
var testHelpers = {};
describe('slash ids', function () {
  describe('functions with / in _id', function () {
    adapters.map(function (adapter) {
      describe(adapter, function () {
        beforeEach(function () {
          testHelpers.name = testUtils.generateAdapterUrl(adapter);
        });
        afterEach(testUtils.cleanupTestDatabases);
        it('Insert a doc, putAttachment and allDocs', function (done) {
          testUtils.initTestDB(testHelpers.name, function (err, db) {
            should.not.exist(err, 'opened the pouch');
            var docId = 'doc/with/slashes';
            var attachmentId = 'attachment/with/slashes';
            var blobData = 'attachment content';
            var blob = testUtils.makeBlob(blobData);
            var doc = {
                _id: docId,
                test: true
              };
            db.put(doc, function (err, info) {
              should.not.exist(err, 'saved doc');
              info.id.should.equal('doc/with/slashes', 'id is the same as inserted');
              db.putAttachment(docId, attachmentId, info.rev, blob, 'text/plain', function (err, res) {
                db.getAttachment(docId, attachmentId, function (err, res) {
                  testUtils.readBlob(res, function (data) {
                    db.get(docId, function (err, res) {
                      res._id.should.equal(docId);
                      res._attachments.should.include.keys(attachmentId);
                      done();
                    });
                  });
                });
              });
            });
          });
        });
        it('BulkDocs and changes', function (done) {
          testUtils.initTestDB(testHelpers.name, function (err, db) {
            var docs = [
                {
                  _id: 'part/doc1',
                  int: 1
                },
                {
                  _id: 'part/doc2',
                  int: 2,
                  _attachments: {
                    'attachment/with/slash': {
                      content_type: 'text/plain',
                      data: 'c29tZSBkYXRh'
                    }
                  }
                },
                {
                  _id: 'part/doc3',
                  int: 3
                }
              ];
            db.bulkDocs({ docs: docs }, function (err, res) {
              for (var i = 0; i < 3; i++) {
                res[i].ok.should.equal(true, 'correctly inserted ' + docs[i]._id);
              }
              db.allDocs({
                include_docs: true,
                attachments: true
              }, function (err, res) {
                res.rows.sort(function (a, b) {
                  return a.doc.int - b.doc.int;
                });
                for (var i = 0; i < 3; i++) {
                  res.rows[i].doc._id.should.equal(docs[i]._id, '(allDocs) correctly inserted ' + docs[i]._id);
                }
                res.rows[1].doc._attachments.should.include.keys('attachment/with/slash');
                db.changes({
                  complete: function (err, res) {
                    res.results.sort(function (a, b) {
                      return a.id.localeCompare(b.id);
                    });
                    for (var i = 0; i < 3; i++) {
                      res.results[i].id.should.equal(docs[i]._id, '(changes) correctly inserted ' + docs[i]._id);
                    }
                    done();
                  }
                });
              });
            });
          });
        });
      });
    });
  });
  describe('replication with / in _id', function () {
    repl_adapters.map(function (adapters) {
      describe(adapters[0] + ':' + adapters[1], function () {
        beforeEach(function () {
          testHelpers.name = testUtils.generateAdapterUrl(adapters[0]);
          testHelpers.remote = testUtils.generateAdapterUrl(adapters[1]);
        });
        it('Attachments replicate', function (done) {
          var binAttDoc = {
              _id: 'bin_doc/with/slash',
              _attachments: {
                'foo/with/slash.txt': {
                  content_type: 'text/plain',
                  data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ='
                }
              }
            };
          var docs1 = [
              binAttDoc,
              {
                _id: '0',
                integer: 0
              },
              {
                _id: '1',
                integer: 1
              },
              {
                _id: '2',
                integer: 2
              },
              {
                _id: '3',
                integer: 3
              }
            ];
          testUtils.initDBPair(testHelpers.name, testHelpers.remote, function (db, remote) {
            remote.bulkDocs({ docs: docs1 }, function (err, info) {
              db.replicate.from(remote, function () {
                db.get('bin_doc/with/slash', { attachments: true }, function (err, doc) {
                  binAttDoc._attachments['foo/with/slash.txt'].data.should.equal(doc._attachments['foo/with/slash.txt'].data);
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
