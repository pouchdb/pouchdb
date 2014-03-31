'use strict';

var adapters = ['local', 'http'];
var repl_adapters = [
  ['local', 'http'],
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'local']
];

adapters.forEach(function (adapter) {
  describe('test.attachments.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_attach');
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    var binAttDoc = {
      _id: 'bin_doc',
      _attachments: {
        'foo.txt': {
          content_type: 'text/plain',
          data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ='
        }
      }
    };
    // empty attachment
    var binAttDoc2 = {
      _id: 'bin_doc2',
      _attachments: {
        'foo.txt': {
          content_type: 'text/plain',
          data: ''
        }
      }
    };
    // json string doc
    var jsonDoc = {
      _id: 'json_doc',
      _attachments: {
        'foo.json': {
          content_type: 'application/json',
          data: 'eyJIZWxsbyI6IndvcmxkIn0='
        }
      }
    };
    var pngAttDoc = {
      _id: 'png_doc',
      _attachments: {
        'foo.png': {
          content_type: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAMFBMVEX+9+j+9OD+7tL95rr93qT80YD7x2L6vkn6syz5qRT4ogT4nwD4ngD4nQD4nQD4nQDT2nT/AAAAcElEQVQY002OUQLEQARDw1D14f7X3TCdbfPnhQTqI5UqvGOWIz8gAIXFH9zmC63XRyTsOsCWk2A9Ga7wCXlA9m2S6G4JlVwQkpw/YmxrUgNoMoyxBwSMH/WnAzy5cnfLFu+dK2l5gMvuPGLGJd1/9AOiBQiEgkzOpgAAAABJRU5ErkJggg=='
        }
      }
    };

    it('Test some attachments', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(binAttDoc, function (err, write) {
        should.not.exist(err, 'saved doc with attachment');
        db.get('bin_doc', function (err, doc) {
          should.exist(doc._attachments, 'doc has attachments field');
          should.exist(doc._attachments['foo.txt'], 'doc has attachment');
          doc._attachments['foo.txt'].content_type.should.equal('text/plain');
          db.getAttachment('bin_doc', 'foo.txt', function (err, res) {
            testUtils.readBlob(res, function (data) {
              data.should.equal('This is a base64 encoded text');
              db.put(binAttDoc2, function (err, rev) {
                db.getAttachment('bin_doc2', 'foo.txt', function (err, res, xhr) {
                  testUtils.readBlob(res, function (data) {
                    data.should.equal('', 'Correct data returned');
                    moreTests(rev.rev);
                  });
                });
              });
            });
          });
        });
      });

      function moreTests(rev) {
        var blob = testUtils.makeBlob('This is no base64 encoded text');
        db.putAttachment('bin_doc2', 'foo2.txt', rev, blob, 'text/plain',
                         function (err, wtf) {
          db.getAttachment('bin_doc2', 'foo2.txt', function (err, res, xhr) {
            testUtils.readBlob(res, function (data) {
              should.exist(data);
              db.get('bin_doc2', { attachments: true }, function (err, res, xhr) {
                should.exist(res._attachments, 'Result has attachments field');
                should.not.exist(res._attachments['foo2.txt'].stub, 'stub is false');
                res._attachments['foo2.txt'].data.should
                  .equal('VGhpcyBpcyBubyBiYXNlNjQgZW5jb2RlZCB0ZXh0');
                res._attachments['foo2.txt'].content_type.should.equal('text/plain');
                res._attachments['foo.txt'].data.should.equal('');
                done();
              });
            });
          });
        });
      }
    });

    it('Test getAttachment', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(binAttDoc, function (err, res) {
        db.getAttachment('bin_doc', 'foo.txt', function (err, res) {
          if (err) {
            return done(err);
          }
          testUtils.readBlob(res, function (data) {
            data.should.equal('This is a base64 encoded text', 'correct data');
            done();
          });
        });
      });
    });

    it('Test attachments in allDocs/changes', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [
        { _id: 'doc0' },
        {
          _id: 'doc1',
          _attachments: {
            'att0': {
              data: 'YXR0YWNobWVudDA=',
              content_type: 'text/plain'
            }
          }
        },
        {
          _id: 'doc2',
          _attachments: {
            'att0': {
              data: 'YXR0YWNobWVudDA=',
              content_type: 'text/plain'
            },
            'att1': {
              data: 'YXR0YWNobWVudDE=',
              content_type: 'text/plain'
            }
          }
        },
        {
          _id: 'doc3',
          _attachments: {
            'att0': {
              data: 'YXR0YWNobWVudDA=',
              content_type: 'text/plain'
            }
          }
        }
      ];
      function sort(a, b) {
        return a.id.localeCompare(b.id);
      }
      db.bulkDocs({ docs: docs }, function (err, res) {
        db.allDocs({ include_docs: true }, function (err, res) {
          for (var i = 0; i < docs.length; i++) {
            var attachmentsNb = typeof docs[i]._attachments !== 'undefined' ?
              Object.keys(docs[i]._attachments).length : 0;
            for (var j = 0; j < attachmentsNb; j++) {
              res.rows[i].doc._attachments['att' + j].stub.should
                .equal(true, '(allDocs) doc' + i + ' contains att' + j + ' stub');
            }
          }
          should.not.exist(res.rows[0].doc._attachments,
                           '(allDocs) doc0 contains no attachments');
          db.changes({
            include_docs: true,
            onChange: function (change) {
              var i = +change.id.substr(3);
              if (i === 0) {
                should.not.exist(res.rows[0].doc._attachments,
                                 '(onChange) doc0 contains no attachments');
              } else {
                var attachmentsNb = typeof docs[i]._attachments !== 'undefined' ?
                  Object.keys(docs[i]._attachments).length : 0;
                for (var j = 0; j < attachmentsNb; j++) {
                  res.rows[i].doc._attachments['att' + j].stub.should
                    .equal(true, '(onChange) doc' + i + ' contains att' + j + ' stub');
                }
              }
            },
            complete: function (err, res) {
              var attachmentsNb = 0;
              res.results.sort(sort);
              for (var i = 0; i < 3; i++) {
                attachmentsNb = typeof docs[i]._attachments !== 'undefined' ?
                  Object.keys(docs[i]._attachments).length : 0;
                for (var j = 0; j < attachmentsNb; j++) {
                  res.results[i].doc._attachments['att' + j].stub.should
                    .equal(true, '(complete) doc' + i + ' contains att' + j + ' stub');
                }
              }
              should.not.exist(res.results[0].doc._attachments,
                               '(complete) doc0 contains no attachments');
              done();
            }
          });
        });
      });
    });

    it('Test getAttachment with PNG', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(pngAttDoc, function (err, res) {
        if (err) { return done(err); }
        db.getAttachment('png_doc', 'foo.png', function (err, res) {
          if (err) { return done(err); }
          testUtils.base64Blob(res, function (data) {
            data.should.equal(pngAttDoc._attachments['foo.png'].data, 'correct data');
            done();
          });
        });
      });
    });

    it('Testing with invalid docs', function (done) {
      var db = new PouchDB(dbs.name);
      var invalidDoc = {
        '_id': '_invalid',
        foo: 'bar'
      };
      db.bulkDocs({
        docs: [
          invalidDoc,
          binAttDoc
        ]
      }, function (err, info) {
        should.exist(err, 'bad request');
        done();
      });
    });

    it('Test create attachment and doc in one go', function (done) {
      var db = new PouchDB(dbs.name);
      var blob = testUtils.makeBlob('Mytext');
      db.putAttachment('anotherdoc', 'mytext', blob, 'text/plain', function (err, res) {
        should.exist(res.ok);
        done();
      });
    });

    it('Test create attachment and doc in one go without callback', function (done) {
      var db = new PouchDB(dbs.name);
      var changes = db.changes({
        complete: function (err, result) {
          result.status.should.equal('cancelled');
          done();
        },
        live: true,
        onChange: function (change) {
          if (change.seq === 1) {
            change.id.should.equal('anotherdoc2', 'Doc has been created');
            db.get(change.id, { attachments: true }, function (err, doc) {
              doc._attachments.should.be.an('object', 'doc has attachments object');
              should.exist(doc._attachments.mytext, 'doc has attachments attachment');
              doc._attachments.mytext.data.should.equal('TXl0ZXh0', 'doc has attachments attachment');
              changes.cancel();
            });
          }
        }
      });
      var blob = testUtils.makeBlob('Mytext');
      db.putAttachment('anotherdoc2', 'mytext', blob, 'text/plain');
    });

    it('Test create attachment without callback', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'anotherdoc3' }, function (err, resp) {
        should.not.exist(err, 'doc was saved');
        var changes = db.changes({
          complete: function (err, result) {
            result.status.should.equal('cancelled');
            done();
          },
          live: true,
          include_docs: true,
          onChange: function (change) {
            if (change.seq === 2) {
              change.id.should.equal('anotherdoc3', 'Doc has been created');
              db.get(change.id, { attachments: true }, function (err, doc) {
                doc._attachments.should.be.an('object', 'doc has attachments object');
                should.exist(doc._attachments.mytext);
                doc._attachments.mytext.data.should.equal('TXl0ZXh0');
                changes.cancel();
              });
            }
          }
        });
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('anotherdoc3', 'mytext', resp.rev, blob, 'text/plain');
      });
    });

    it('Test put attachment on a doc without attachments', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'mydoc' }, function (err, resp) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'mytext', resp.rev, blob, 'text/plain',
                         function (err, res) {
          should.exist(res.ok);
          done();
        });
      });
    });

    it('Testing with invalid rev', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = { _id: 'adoc' };
      db.put(doc, function (err, resp) {
        should.not.exist(err, 'Doc has been saved');
        doc._rev = resp.rev;
        doc.foo = 'bar';
        db.put(doc, function (err, resp) {
          should.not.exist(err, 'Doc has been updated');
          var blob = testUtils.makeBlob('bar');
          db.putAttachment('adoc', 'foo.txt', doc._rev, blob, 'text/plain',
                           function (err) {
            should.exist(err, 'Attachment has not been saved');
            err.name.should.equal('conflict', 'error is a conflict');
            done();
          });
        });
      });
    });

    it('Test put another attachment on a doc with attachments', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'mydoc' }, function (err, res1) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'mytext', res1.rev, blob, 'text/plain',
                         function (err, res2) {
          db.putAttachment('mydoc', 'mytext2', res2.rev, blob, 'text/plain',
                           function (err, res3) {
            should.exist(res3.ok);
            done();
          });
        });
      });
    });

    it('Test get with attachments: true if empty attachments', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({
        _id: 'foo',
        _attachments: {}
      }, function (err, resp) {
        db.get('foo', { attachments: true }, function (err, res) {
          res._id.should.equal('foo');
          done();
        });
      });
    });

    it('Test delete attachment from a doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({
        _id: 'mydoc',
        _attachments: {
          'mytext1': {
            content_type: 'text/plain',
            data: 'TXl0ZXh0MQ=='
          },
          'mytext2': {
            content_type: 'text/plain',
            data: 'TXl0ZXh0Mg=='
          }
        }
      }, function (err, res) {
        var rev = res.rev;
        db.get('mydoc', { attachments: true }, function (err, res) {
          res._attachments.should.include.keys('mytext1', 'mytext2');
          db.removeAttachment('mydoc', 'mytext1', 0, function (err, res) {
            should.exist(err, 'removal should fail due to broken rev');
            db.removeAttachment('mydoc', 'mytext1', rev, function (err, res) {
              db.get('mydoc', { attachments: true }, function (err, res) {
                res._attachments.should.not.include.keys('mytext1');
                res._attachments.should.include.keys('mytext2');
                db.removeAttachment('mydoc', 'mytext2', res._rev, function (err, res) {
                  should.not.exist(res._attachments);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Test a document with a json string attachment', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(jsonDoc, function (err, results) {
        should.not.exist(err, 'saved doc with attachment');
        db.get(results.id, function (err, doc) {
          should.not.exist(err, 'fetched doc');
          should.exist(doc._attachments, 'doc has attachments field');
          doc._attachments.should.include.keys('foo.json');
          doc._attachments['foo.json'].content_type.should
            .equal('application/json', 'doc has correct content type');
          db.getAttachment(results.id, 'foo.json', function (err, attachment) {
            testUtils.readBlob(attachment, function (data) {
              jsonDoc._attachments['foo.json'].data.should
                .equal('eyJIZWxsbyI6IndvcmxkIn0=', 'correct data');
              done();
            });
          });
        });
      });
    });

    it('Test remove doc with attachment', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'mydoc' }, function (err, resp) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'mytext', resp.rev, blob, 'text/plain',
                         function (err, res) {
          db.get('mydoc', { attachments: false }, function (err, doc) {
            db.remove(doc, function (err, resp) {
              should.exist(res.ok);
              done();
            });
          });
        });
      });
    });

    it('Try to insert a doc with unencoded attachment', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {
        _id: 'foo',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'this should have been encoded!'
          }
        }
      };
      db.put(doc, function (err, res) {
        should.exist(err);
        err.status.should.equal(500, 'correct error');
        err.name.should.equal('badarg', 'correct error');
        done();
      });
    });

    it('Try to get attachment of unexistent doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.getAttachment('unexistent', 'attachment', function (err, res) {
        should.exist(err, 'Correctly returned error');
        done();
      });
    });

    it('Test synchronous getAttachment', function (done) {
      var db = new PouchDB(dbs.name);
      db.getAttachment('unexistent', 'attachment', function (err, res) {
        should.exist(err, 'Correctly returned error');
        done();
      });
    });

    it('Test synchronous putAttachment with text data', function (done) {
      var db = new PouchDB(dbs.name);
      var blob = testUtils.makeBlob('foobaz', 'text/plain');
      db.putAttachment('a', 'foo2.txt', '', blob, 'text/plain', function (err) {
        should.not.exist(err, 'Correctly wrote attachment');
        db.get('a', { attachments: true }, function (err, doc) {
          should.not.exist(err, 'Correctly got attachment');
          doc._attachments['foo2.txt'].data.should.equal('Zm9vYmF6');
          doc._attachments['foo2.txt'].content_type.should.equal('text/plain');
          done();
        });
      });
    });

    it('Test synchronous putAttachment with no text data', function (done) {
      var db = new PouchDB(dbs.name);
      db.putAttachment('a', 'foo2.txt', '', '', 'text/plain', function (err) {
        should.not.exist(err, 'Correctly wrote attachment');
        db.get('a', { attachments: true }, function (err, doc) {
          should.not.exist(err, 'Correctly got attachment');
          doc._attachments['foo2.txt'].data.should.equal('');
          // firefox 3 appends charset=utf8
          // see http://forums.mozillazine.org/viewtopic.php?p=6318215#p6318215
          doc._attachments['foo2.txt'].content_type.indexOf('text/plain')
            .should.equal(0, 'expected content-type to start with text/plain');
          done();
        });
      });
    });

    it('Test stubs', function (done) {
      var db = new PouchDB(dbs.name);
      db.putAttachment('a', 'foo2.txt', '', '', 'text/plain', function (err) {
        db.allDocs({ include_docs: true }, function (err, docs) {
          should.not.exist(docs.rows[0].stub, 'no stub');
          done();
        });
      });
    });

    it('Try to get unexistent attachment of some doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function (err, res) {
        should.not.exist(err, 'doc inserted');
        db.getAttachment('foo', 'unexistentAttachment', function (err, res) {
          should.exist(err, 'Correctly returned error');
          done();
        });
      });
    });

    it('putAttachment and getAttachment with png data', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function (err, res) {
        db.get('foo', function (err, doc) {
          var data = pngAttDoc._attachments['foo.png'].data;
          var blob = testUtils
            .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)), 'image/png');
          db.putAttachment('foo', 'foo.png', doc._rev, blob, 'image/png',
                           function (err, info) {
            should.not.exist(err, 'attachment inserted');
            db.getAttachment('foo', 'foo.png', function (err, blob) {
              should.not.exist(err, 'attachment gotten');
              testUtils.readBlob(blob, function (returnedData) {
                PouchDB.utils.btoa(returnedData).should.equal(data);
                done();
              });
            });
          });
        });
      });
    });

  });
});

repl_adapters.forEach(function (adapters) {
  describe('test.attachments.js- ' + adapters[0] + ':' + adapters[1], function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'test_attach');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_attach_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('Attachments replicate', function (done) {
      var binAttDoc = {
        _id: 'bin_doc',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ='
          }
        }
      };
      var docs1 = [
        binAttDoc,
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      remote.bulkDocs({ docs: docs1 }, function (err, info) {
        db.replicate.from(remote, function () {
          db.get('bin_doc', { attachments: true }, function (err, doc) {
            binAttDoc._attachments['foo.txt'].data.should
              .equal(doc._attachments['foo.txt'].data);
            done();
          });
        });
      });
    });

  });
});
