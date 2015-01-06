'use strict';

var adapters = ['http', 'local'];
var autoCompactionAdapters = ['local'];

adapters.forEach(function (adapter) {
  describe('test.compaction.js-' + adapter, function () {
    if (testUtils.isCouchMaster()) {
      return true;
    }

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });
    
    it('#3350 compact should return {ok: true}', function (done) {
      var db = new PouchDB(dbs.name);
      db.compact(function (err, result) {
        should.not.exist(err);
        result.should.eql({ok: true});

        done();
      });
    });

    it('#2913 massively parallel compaction', function () {
      var db = new PouchDB(dbs.name);
      var tasks = [];
      for (var i = 0; i < 30; i++) {
        tasks.push(i);
      }

      return PouchDB.utils.Promise.all(tasks.map(function (i) {
        var doc = {_id: 'doc_' + i};
        return db.put(doc).then(function () {
          return db.compact();
        }).then(function () {
          return db.get('doc_' + i);
        }).then(function (doc) {
          return db.put(doc);
        }).then(function () {
          return db.compact();
        });
      }));
    });

    it('Compaction document with no revisions to remove', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo', value: 'bar'};
      db.put(doc, function (err, res) {
        db.compact(function () {
          db.get('foo', function (err, doc) {
            done(err);
          });
        });
      });
    });

    it('Compation on empty db', function (done) {
      var db = new PouchDB(dbs.name);
      db.compact(function () {
        done();
      });
    });

    it('Compation on empty db with interval option', function (done) {
      var db = new PouchDB(dbs.name);
      db.compact({ interval: 199 }, function () {
        done();
      });
    });

    it('Simple compation test', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {
        _id: 'foo',
        value: 'bar'
      };
      db.post(doc, function (err, res) {
        var rev1 = res.rev;
        doc._rev = rev1;
        doc.value = 'baz';
        db.post(doc, function (err, res) {
          var rev2 = res.rev;
          db.compact(function () {
            db.get('foo', { rev: rev1 }, function (err, doc) {
              err.status.should.equal(404);
              err.name.should.equal(
                'not_found', 'compacted document is missing'
              );
              db.get('foo', { rev: rev2 }, function (err, doc) {
                done(err);
              });
            });
          });
        });
      });
    });

    var checkBranch = function (db, docs, callback) {
      function check(i) {
        var doc = docs[i];
        db.get(doc._id, { rev: doc._rev }, function (err) {
          if (i < docs.length - 1) {
            should.exist(err, 'should be compacted: ' + doc._rev);
            err.status.should.equal(404, 'compacted!');
            check(i + 1);
          } else {
            should.not.exist(err, 'should not be compacted: ' + doc._rev);
            callback();
          }
        });
      }
      check(0);
    };

    var checkTree = function (db, tree, callback) {
      function check(i) {
        checkBranch(db, tree[i], function () {
          if (i < tree.length - 1) {
            check(i + 1);
          } else {
            callback();
          }
        });
      }
      check(0);
    };

    var exampleTree = [
      [{_id: 'foo', _rev: '1-a', value: 'foo a'},
       {_id: 'foo', _rev: '2-b', value: 'foo b'},
       {_id: 'foo', _rev: '3-c', value: 'foo c'}
      ],
      [{_id: 'foo', _rev: '1-a', value: 'foo a'},
       {_id: 'foo', _rev: '2-d', value: 'foo d'},
       {_id: 'foo', _rev: '3-e', value: 'foo e'},
       {_id: 'foo', _rev: '4-f', value: 'foo f'}
      ],
      [{_id: 'foo', _rev: '1-a', value: 'foo a'},
       {_id: 'foo', _rev: '2-g', value: 'foo g'},
       {_id: 'foo', _rev: '3-h', value: 'foo h'},
       {_id: 'foo', _rev: '4-i', value: 'foo i'},
       {_id: 'foo', _rev: '5-j', _deleted: true, value: 'foo j'}
      ]
    ];

    var exampleTree2 = [
      [{_id: 'bar', _rev: '1-m', value: 'bar m'},
       {_id: 'bar', _rev: '2-n', value: 'bar n'},
       {_id: 'bar', _rev: '3-o', _deleted: true, value: 'foo o'}
      ],
      [{_id: 'bar', _rev: '2-n', value: 'bar n'},
       {_id: 'bar', _rev: '3-p', value: 'bar p'},
       {_id: 'bar', _rev: '4-r', value: 'bar r'},
       {_id: 'bar', _rev: '5-s', value: 'bar s'}
      ],
      [{_id: 'bar', _rev: '3-p', value: 'bar p'},
       {_id: 'bar', _rev: '4-t', value: 'bar t'},
       {_id: 'bar', _rev: '5-u', value: 'bar u'}
      ]
    ];

    it('Compact more complicated tree', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        testUtils.putTree(db, exampleTree, function () {
          db.compact(function () {
            checkTree(db, exampleTree, function () {
              done();
            });
          });
        });
      });
    });

    it('Compact two times more complicated tree', function (done) {
      var db = new PouchDB(dbs.name);
      testUtils.putTree(db, exampleTree, function () {
        db.compact(function () {
          db.compact(function () {
            checkTree(db, exampleTree, function () {
              done();
            });
          });
        });
      });
    });

    it('Compact database with at least two documents', function (done) {
      var db = new PouchDB(dbs.name);
      testUtils.putTree(db, exampleTree, function () {
        testUtils.putTree(db, exampleTree2, function () {
          db.compact(function () {
            checkTree(db, exampleTree, function () {
              checkTree(db, exampleTree2, function () {
                done();
              });
            });
          });
        });
      });
    });

    it('Compact deleted document', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function (err, res) {
        var firstRev = res.rev;
        db.remove({
          _id: 'foo',
          _rev: firstRev
        }, function (err, res) {
          db.compact(function () {
            db.get('foo', { rev: firstRev }, function (err, res) {
              should.exist(err, 'got error');
              err.status.should.equal(PouchDB.Errors.MISSING_DOC.status,
                                      'correct error status returned');
              err.message.should.equal(PouchDB.Errors.MISSING_DOC.message,
                                   'correct error message returned');
              done();
            });
          });
        });
      });
    });

    it('Compact db with sql-injecty doc id', function (done) {
      var db = new PouchDB(dbs.name);
      var id = '\'sql_injection_here';
      db.put({ _id: id }, function (err, res) {
        var firstRev = res.rev;
        db.remove({
          _id: id,
          _rev: firstRev
        }, function (err, res) {
          db.compact(function () {
            db.get(id, { rev: firstRev }, function (err, res) {
              should.exist(err, 'got error');
              err.status.should.equal(PouchDB.Errors.MISSING_DOC.status,
                                      'correct error status returned');
              err.message.should.equal(PouchDB.Errors.MISSING_DOC.message,
                                   'correct error message returned');
              done();
            });
          });
        });
      });
    });


    function getRevisions(db, docId) {
      return db.get(docId, {
        revs: true,
        open_revs: 'all'
      }).then(function (docs) {
        var combinedResult = [];
        return PouchDB.utils.Promise.all(docs.map(function (doc) {
          doc = doc.ok;
          // convert revision IDs into full _rev hashes
          var start = doc._revisions.start;
          return PouchDB.utils.Promise.all(
            doc._revisions.ids.map(function (id, i) {
              var rev = (start - i) + '-' + id;
              return db.get(docId, {rev: rev}).then(function (doc) {
                return { rev: rev, doc: doc };
              }).catch(function (err) {
                if (err.status !== 404) {
                  throw err;
                }
                return { rev: rev };
              });
            })).then(function (docsAndRevs) {
              combinedResult = combinedResult.concat(docsAndRevs);
            });
        })).then(function () {
          return combinedResult;
        });
      });
    }

    it('Compaction removes non-leaf revs (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(1);
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(2);
        should.exist(docsAndRevs[0].doc);
        should.exist(docsAndRevs[1].doc);
        return db.compact();
      }).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(2);
        should.exist(docsAndRevs[0].doc);
        should.not.exist(docsAndRevs[1].doc);
      });
    });

    it('Compaction removes non-leaf revs pt 2 (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(3);
        should.exist(docsAndRevs[0].doc);
        should.not.exist(docsAndRevs[1].doc);
        should.not.exist(docsAndRevs[2].doc);
      });
    });

    it('Compaction removes non-leaf revs pt 3 (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});

      var docs = [
        {
          _id: 'foo',
          _rev: '1-a1',
          _revisions: { start: 1, ids: [ 'a1' ] }
        }, {
          _id: 'foo',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'foo',
          _deleted: true,
          _rev: '3-a3',
          _revisions: { start: 3, ids: [ 'a3', 'a2', 'a1' ] }
        }, {
          _id: 'foo',
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }
      ];

      return db.bulkDocs(docs, {new_edits: false}).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(4);
        should.exist(docsAndRevs[0].doc);
        should.exist(docsAndRevs[1].doc);
        should.exist(docsAndRevs[2].doc);
        should.exist(docsAndRevs[3].doc);
        return db.compact();
      }).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(4);
        var asMap = {};
        docsAndRevs.forEach(function (docAndRev) {
          asMap[docAndRev.rev] = docAndRev.doc;
        });
        // only leafs remain
        should.not.exist(asMap['1-a1']);
        should.not.exist(asMap['2-a2']);
        should.exist(asMap['3-a3']);
        should.exist(asMap['1-b1']);
      });
    });

    it('Compaction removes non-leaf revs pt 4 (#2807)', function () {
      if (testUtils.isCouchMaster()) {
        return true;
      }
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        doc._deleted = true;
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        delete doc._deleted;
        return db.put(doc);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(3);
        should.exist(docsAndRevs[0].doc);
        should.not.exist(docsAndRevs[1].doc);
        should.not.exist(docsAndRevs[2].doc);
      });
    });

    it('Compaction removes non-leaf revs pt 5 (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        doc._deleted = true;
        return db.put(doc);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(3);
        should.exist(docsAndRevs[0].doc);
        should.not.exist(docsAndRevs[1].doc);
        should.not.exist(docsAndRevs[2].doc);
      });
    });

    it('#2931 - synchronous putAttachment + compact', function () {

      var db = new PouchDB(dbs.name);
      var queue = db.put({_id: 'doc'});

      var otherPromises = [];

      for (var i = 0; i < 50; i++) {
        /* jshint loopfunc:true */
        queue = queue.then(function () {
          return db.get('doc').then(function (doc) {
            doc._attachments = doc._attachments || {};
            var blob = testUtils.makeBlob(
              PouchDB.utils.btoa(Math.random().toString()),
              'text/plain');
            return db.putAttachment(doc._id, 'att.txt', doc._rev, blob,
              'text/plain');
          });
        });
        queue.then(function () {
          var promise = PouchDB.utils.Promise.all([
            db.compact(),
            db.compact(),
            db.compact(),
            db.compact(),
            db.compact()
          ]);
          otherPromises.push(promise);
          return promise;
        });
      }
      return queue.then(function () {
        return PouchDB.utils.Promise.all(otherPromises);
      });
    });

    it('#2931 - synchronous putAttachment + compact 2', function () {

      var db = new PouchDB(dbs.name);
      var queue = db.put({_id: 'doc'});

      var compactQueue = PouchDB.utils.Promise.resolve();

      for (var i = 0; i < 50; i++) {
        /* jshint loopfunc:true */
        queue = queue.then(function () {
          return db.get('doc').then(function (doc) {
            doc._attachments = doc._attachments || {};
            var blob = testUtils.makeBlob(
              PouchDB.utils.btoa(Math.random().toString()),
              'text/plain');
            return db.putAttachment(doc._id, 'att.txt', doc._rev, blob,
              'text/plain');
          });
        });
        queue.then(function () {
          compactQueue = compactQueue.then(function () {
            return PouchDB.utils.Promise.all([
              db.compact(),
              db.compact(),
              db.compact(),
              db.compact(),
              db.compact()
            ]);
          });
        });
      }
      return queue.then(function () {
        return compactQueue;
      });
    });

    //
    // NO MORE HTTP TESTS AFTER THIS POINT!
    //
    // We're testing some very local-specific functionality
    //


    if (autoCompactionAdapters.indexOf(adapter) === -1) {
      return;
    }

    //
    // Tests for issue #2818 follow, which make some assumptions
    // about how binary data is stored, so they don't pass in
    // CouchDB. Namely, PouchDB dedups attachments based on
    // md5sum, whereas CouchDB does not.
    //

    // per https://en.wikipedia.org/wiki/MD5,
    // these two should have colliding md5sums
    var att1 = '0THdAsXm7sRpPZoGmK/5XC/KtQcSRn6r' +
      'QARYPrj7f4lVrTQGCfSzAoPkiIMl8UFaCFEl6PfNyZ/Z' +
      'Hb1ygDc8W9iCPjFWNI9brm2s1DbJGcbdU+I0h9oD/' +
      'QI5YwbSSM2g6Z8zQg9XfujOVLZwgCgNHsaY' +
      'Iby2qIOTlvllq2/3KnA=';
    var att2 = '0THdAsXm7sRpPZoGmK/5XC/KtYcSRn6r' +
      'QARYPrj7f4lVrTQGCfSzAoPkiIMlcUFaCFEl6PfNyZ/Z' +
      'Hb3ygDc8W9iCPjFWNI9brm2s1DbJGcbdU+K0h9oD/' +
      'QI5YwbSSM2g6Z8zQg9XfujOVLZwgKgNHsaY' +
      'Iby2qIOTlvllK2/3KnA=';

    it('#2818 md5 collision (sanity check)', function () {
      //
      // CouchDB will throw!
      //
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc1 = {
        _id: 'doc1',
        _attachments: {
          'att.txt': {
            data: att1,
            content_type: 'application/octet-stream'
          }
        }
      };
      var doc2 = {
        _id: 'doc2',
        _attachments: {
          'att.txt': {
            data: att2,
            content_type: 'application/octet-stream'
          }
        }
      };
      var doc3 = {
        _id: 'doc3',
        _attachments: {
          'att.txt': {
            data: '1' + att2.substring(1), // distractor
            content_type: 'application/octet-stream'
          }
        }
      };
      return db.put(doc1).then(function () {
        return db.put(doc2);
      }).then(function () {
        return db.put(doc3);
      }).then(function () {
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        var md1 = res.rows[0].doc._attachments['att.txt'].digest;
        var md2 = res.rows[1].doc._attachments['att.txt'].digest;
        var md3 = res.rows[2].doc._attachments['att.txt'].digest;
        md1.should.not.equal(md3, 'md5 sums should not collide');
        md2.should.not.equal(md3, 'md5 sums should not collide');
        md1.should.equal(md2,
          'md5 sums should collide. if not, other #2818 tests will fail');
      }).then(function () {
        return PouchDB.utils.Promise.all(['doc1', 'doc2'].map(function (id) {
          return db.get(id, {attachments: true});
        })).then(function (docs) {
          var data1 = docs[0]._attachments['att.txt'].data;
          var data2 = docs[1]._attachments['att.txt'].data;
          data1.should.equal(data2,
            'yay, we are vulnerable to md5sum collision (1)');
          att1.should.equal(data2,
              'att1 is the final one, not att2');
        });
      });
    });

    it('#2818 md5 collision between revs (sanity check)', function () {
      //
      // CouchDB will throw!
      //
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc1 = {
        _id: 'doc1',
        _attachments: {
          'att.txt': {
            data: att1,
            content_type: 'application/octet-stream'
          }
        }
      };
      var rev1;
      var rev2;
      return db.put(doc1).then(function (res) {
        rev1 = doc1._rev = res.rev;
        doc1._attachments['att.txt'].data = att2;
        return db.put(doc1);
      }).then(function (res) {
        rev2 = res.rev;
        return PouchDB.utils.Promise.all([rev1, rev2].map(function (rev) {
          return db.get('doc1', {rev: rev, attachments: true});
        }));
      }).then(function (docs) {
        var data1 = docs[0]._attachments['att.txt'].data;
        var data2 = docs[1]._attachments['att.txt'].data;
        data1.should.equal(data2,
          'yay, we are vulnerable to md5sum collision');
      });
    });

    it('#2818 doesn\'t throw 412, thanks to digest', function () {
      //
      // CouchDB will throw!
      //
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc1 = {
        _id: 'doc1',
        _attachments: {
          'att.txt': {
            data: 'Zm9vYmFy', // 'foobar'
            content_type: 'text/plain'
          }
        }
      };

      return db.put(doc1).then(function (res) {
        return db.get('doc1');
      }).then(function (doc1) {
        var doc2 = {
          _id: 'doc2',
          _attachments: {
            'att.txt': {
              stub: true,
              digest: doc1._attachments['att.txt'].digest,
              content_type: 'text/plain'
            }
          }
        };
        return db.put(doc2);
      });
    });

    it('#2818 Compaction removes attachments', function () {
      // now that we've established no 412s thanks to digests,
      // we can use that to detect true attachment deletion
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {
        _id: 'doc1',
        _attachments: {
          'deleteme.txt': {
            data: 'Zm9vYmFy', // 'foobar'
            content_type: 'text/plain'
          }
        }
      };
      var digest;
      return db.put(doc).then(function () {
        return db.get('doc1');
      }).then(function (doc) {
        digest = doc._attachments['deleteme.txt'].digest;
        delete doc._attachments['deleteme.txt'];
        doc._attachments['retainme.txt'] = {
          data: 'dG90bw==', // 'toto'
          content_type: 'text/plain'
        };
        return db.put(doc);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return db.get('doc1');
      }).then(function (doc) {
        doc._attachments['newatt.txt'] = {
          content_type: "text/plain",
          digest: digest,
          stub: true
        };
        return db.put(doc).then(function () {
          throw new Error('shouldn\'t have gotten here');
        }, function (err) {
          err.status.should.equal(412);
        });
      });
    });

    it('#2818 Compaction removes attachments given conflicts', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});

      var docs = [
        {
          _id: 'fubar',
          _rev: '1-a1',
          _revisions: { start: 1, ids: [ 'a1' ] },
          _attachments: {
            'att.txt': {
              data: 'Zm9vYmFy', // 'foobar'
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] },
          _attachments: {
            'att.txt': {
              data: 'dG90bw==', // 'toto'
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'fubar',
          _rev: '3-a3',
          _revisions: { start: 3, ids: [ 'a3', 'a2', 'a1' ] },
          _attachments: {
            'att.txt': {
              data: 'Ym9uZ28=', // 'bongo'
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'fubar',
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] },
          _attachments: {
            'att.txt': {
              data: 'enV6dQ==', // 'zuzu'
              content_type: 'text/plain'
            }
          }
        }
      ];

      var allDigests = [];
      var digestsToForget = [];
      var digestsToRemember = [];
      return db.bulkDocs({
        docs: docs,
        new_edits: false
      }).then(function () {
        return PouchDB.utils.Promise.all([
          '1-a1', '2-a2', '3-a3', '1-b1'
        ].map(function (rev) {
          return db.get('fubar', {rev: rev, attachments: true});
        }));
      }).then(function (docs) {
        digestsToForget.push(docs[0]._attachments['att.txt'].digest);
        digestsToForget.push(docs[1]._attachments['att.txt'].digest);
        digestsToRemember.push(docs[2]._attachments['att.txt'].digest);
        digestsToRemember.push(docs[3]._attachments['att.txt'].digest);

        allDigests = allDigests.concat(digestsToForget).concat(
          digestsToRemember);

        return PouchDB.utils.Promise.all(allDigests.map(function (digest) {
          var doc = {
            _attachments: {
              'newatt.txt': {
                content_type: "text/plain",
                digest: digest,
                stub: true
              }
            }
          };
          return db.post(doc).then(function (res) {
            return db.remove(res.id, res.rev);
          });
        }));
      }).then(function () {
        return db.compact();
      }).then(function () {
        return PouchDB.utils.Promise.all(digestsToForget.map(
            function (digest) {
          var doc = {
            _attachments: {
              'newatt.txt': {
                content_type: "text/plain",
                digest: digest,
                stub: true
              }
            }
          };
          return db.post(doc).then(function () {
            throw new Error('shouldn\'t have gotten here');
          }, function (err) {
            err.status.should.equal(412);
          });
        }));
      }).then(function () {
        return PouchDB.utils.Promise.all(digestsToRemember.map(
            function (digest) {
          var doc = {
            _attachments: {
              'newatt.txt': {
                content_type: "text/plain",
                digest: digest,
                stub: true
              }
            }
          };
          return db.post(doc);
        }));
      });
    });

    it('#2818 Compaction retains attachments if unorphaned', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {
        _id: 'doc1',
        _attachments: {
          'deleteme.txt': {
            data: 'Zm9vYmFy', // 'foobar'
            content_type: 'text/plain'
          }
        }
      };
      var digest;
      return db.put(doc).then(function () {
        return db.get('doc1');
      }).then(function (doc) {
        digest = doc._attachments['deleteme.txt'].digest;
        delete doc._attachments['deleteme.txt'];
        doc._attachments['retainme.txt'] = {
          data: 'dG90bw==', // 'toto'
          content_type: 'text/plain'
        };
        return db.put(doc);
      }).then(function () {
        return db.put({
          _id: 'doc2',
          _attachments: {
            'nodontdeleteme.txt': {
              data: 'Zm9vYmFy', // 'foobar'
              content_type: 'text/plain'
            }
          }
        });
      }).then(function () {
        return db.compact();
      }).then(function () {
        return db.get('doc1');
      }).then(function (doc) {
        doc._attachments['newatt.txt'] = {
          content_type: "text/plain",
          digest: digest,
          stub: true
        };
        return db.put(doc);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        // ok, now let's really delete them
        var docs = [
          {
            _id: 'doc1',
            _rev: res.rows[0].value.rev
          },
          {
            _id: 'doc2',
            _rev: res.rows[1].value.rev
          }
        ];
        return db.bulkDocs(docs);
      }).then(function () {
        return db.compact();
      }).then(function () {
        var doc = {
          _attachments: {
            'foo.txt': {
              content_type: "text/plain",
              digest: digest,
              stub: true
            }
          }
        };
        return db.post(doc).then(function () {
          throw new Error('shouldn\'t have gotten here');
        }, function (err) {
          err.status.should.equal(412);
        });
      });
    });

    it('#2818 successive new_edits okay with attachments', function () {
      var db = new PouchDB(dbs.name);
      var docs = [{
        '_id': 'foo',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        },
        _attachments: {
          'att.txt': {
            data: 'Zm9vYmFy', // 'foobar'
            content_type: 'text/plain'
          }
        }
      }];
      var digest;
      return db.bulkDocs({docs: docs, new_edits: false}).then(function () {
        return db.bulkDocs({docs: docs, new_edits: false});
      }).then(function () {
        return db.get('foo', {attachments: true});
      }).then(function (doc) {
        doc._rev.should.equal('1-x');
        digest = doc._attachments['att.txt'].digest;
      }).then(function () {
        var doc = {
          _attachments: {
            'foo.txt': {
              content_type: "text/plain",
              digest: digest,
              stub: true
            }
          }
        };
        return db.post(doc);
      });
    });

    it('#2818 Compaction really replaces attachments', function () {
      // now that we've established md5sum collisions,
      // we can use that to detect true attachment replacement
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      return db.put({
        _id: 'doc1',
        _attachments: {
          'att.txt': {
            data: att1,
            content_type: 'application/octet-stream'
          }
        }
      }).then(function () {
        return db.get('doc1', {attachments: true});
      }).then(function (doc1) {
        doc1._attachments['att.txt'].data.should.equal(att1, 'doc1');
        return db.put({
          _id: 'doc2',
          _attachments: {
            'att.txt': {
              data: att2,
              content_type: 'application/octet-stream'
            }
          }
        });
      }).then(function () {
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        res.rows[0].doc._attachments['att.txt'].digest.should.equal(
          res.rows[1].doc._attachments['att.txt'].digest,
          'digests collide'
        );
        return db.get('doc1', {attachments: true});
      }).then(function (doc1) {
        doc1._attachments['att.txt'].data.should.equal(att1,
          'doc1 has original att, indicating we didn\'t overwrite it');
        return db.get('doc2', {attachments: true});
      }).then(function (doc2) {
        doc2._attachments['att.txt'].data.should.equal(att1,
          'doc2 also has original att');
        return db.remove(doc2);
      }).then(function () {
        return db.get('doc1');
      }).then(function (doc1) {
        return db.remove(doc1);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return db.put({
          _id: 'doc3',
          _attachments: {
            'att.txt': {
              data: att2,
              content_type: 'application/octet-stream'
            }
          }
        });
      }).then(function () {
        return db.put({
          _id: 'doc4',
          _attachments: {
            'att.txt': {
              data: att1,
              content_type: 'application/octet-stream'
            }
          }
        });
      }).then(function () {
        return db.get('doc3', {attachments: true});
      }).then(function (doc3) {
        doc3._attachments['att.txt'].data.should.equal(att2,
          'md5-colliding content was really replaced');
        return db.get('doc4', {attachments: true});
      }).then(function (doc4) {
        doc4._attachments['att.txt'].data.should.equal(att2,
          'md5-colliding content was really replaced');
      });
    });

    it('#2818 Many orphaned attachments', function () {
      // now that we've established md5sum collisions,
      // we can use that to detect true attachment replacement
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var docs = [
        {
          _id: 'doc1',
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            },
            'att2.txt': {
              data: PouchDB.utils.btoa('2'),
              content_type: 'text/plain'
            },
            'att3.txt': {
              data: PouchDB.utils.btoa('3'),
              content_type: 'text/plain'
            },
            'att4.txt': {
              data: PouchDB.utils.btoa('4'),
              content_type: 'text/plain'
            },
            'att5.txt': {
              data: PouchDB.utils.btoa('5'),
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'doc2',
          _attachments: {
            'att3.txt': {
              data: PouchDB.utils.btoa('3'),
              content_type: 'text/plain'
            },
            'att4.txt': {
              data: PouchDB.utils.btoa('4'),
              content_type: 'text/plain'
            },
            'att5.txt': {
              data: PouchDB.utils.btoa('5'),
              content_type: 'text/plain'
            },
            'att6.txt': {
              data: PouchDB.utils.btoa('6'),
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'doc3',
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            },
            'att6.txt': {
              data: PouchDB.utils.btoa('6'),
              content_type: 'text/plain'
            },
            'att7.txt': {
              data: PouchDB.utils.btoa('7'),
              content_type: 'text/plain'
            }
          }
        }
      ];

      var digestsToForget;
      var digestsToRemember;
      return db.bulkDocs(docs).then(function () {
        return db.compact();
      }).then(function () {
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        var allAtts = {};
        res.rows.forEach(function (row) {
          Object.keys(row.doc._attachments).forEach(function (attName) {
            var att = row.doc._attachments[attName];
            allAtts[attName] = att.digest;
          });
        });
        digestsToForget = [
          allAtts['att2.txt'],
          allAtts['att3.txt'],
          allAtts['att4.txt'],
          allAtts['att5.txt']
        ];
        digestsToRemember = [
          allAtts['att1.txt'],
          allAtts['att6.txt'],
          allAtts['att7.txt']
        ];
        return db.get('doc1');
      }).then(function (doc1) {
        return db.remove(doc1);
      }).then(function () {
        return db.get('doc2');
      }).then(function (doc2) {
        return db.remove(doc2);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return PouchDB.utils.Promise.all(
            digestsToRemember.map(function (digest) {
          return db.post({
            _attachments: {
              'baz.txt' : {
                stub: true,
                digest: digest,
                content_type: 'text/plain'
              }
            }
          });
        }));
      }).then(function () {
        return PouchDB.utils.Promise.all(
            digestsToForget.map(function (digest) {
          return db.post({
            _attachments: {
              'baz.txt' : {
                stub: true,
                digest: digest,
                content_type: 'text/plain'
              }
            }
          }).then(function () {
            throw new Error('shouldn\'t have gotten here');
          }, function (err) {
            err.status.should.equal(412);
          });
        }));
      });
    });

    it('#3092 atts should be ignored when _deleted - bulkDocs', function () {
      // now that we've established md5sum collisions,
      // we can use that to detect true attachment replacement
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = { _id: 'doc1',};
      return db.put(doc).then(function (info) {
        doc._rev = info.rev;
        doc._deleted = true;
        doc._attachments = {
          'att1.txt': {
            data: PouchDB.utils.btoa('1'),
            content_type: 'application/octet-stream'
          }
        };
        return db.bulkDocs([doc]);
      }).then(function () {
        return db.post({
          _attachments: {
            'baz.txt' : {
              stub: true,
              digest: 'md5-xMpCOKC5I4INzFCab3WEmw==',
              content_type: 'application/octet-stream'
            }
          }
        }).then(function () {
          throw new Error('shouldn\'t have gotten here');
        }, function (err) {
          err.status.should.equal(412);
        });
      });
    });

    it('#3091 atts should be ignored when _deleted - put', function () {
      // now that we've established md5sum collisions,
      // we can use that to detect true attachment replacement
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = { _id: 'doc1'};
      return db.put(doc).then(function (info) {
        doc._rev = info.rev;
        doc._deleted = true;
        doc._attachments = {
          'att1.txt': {
            data: PouchDB.utils.btoa('1'),
            content_type: 'application/octet-stream'
          }
        };
        return db.put(doc);
      }).then(function () {
        return db.post({
          _attachments: {
            'baz.txt' : {
              stub: true,
              digest: 'md5-xMpCOKC5I4INzFCab3WEmw==',
              content_type: 'application/octet-stream'
            }
          }
        }).then(function () {
          throw new Error('shouldn\'t have gotten here');
        }, function (err) {
          err.status.should.equal(412);
        });
      });
    });

    it('#3089 Many orphaned atts w/ parallel compaction', function () {
      // now that we've established md5sum collisions,
      // we can use that to detect true attachment replacement
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var docs = [
        {
          _id: 'doc1',
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            },
            'att2.txt': {
              data: PouchDB.utils.btoa('2'),
              content_type: 'text/plain'
            },
            'att3.txt': {
              data: PouchDB.utils.btoa('3'),
              content_type: 'text/plain'
            },
            'att4.txt': {
              data: PouchDB.utils.btoa('4'),
              content_type: 'text/plain'
            },
            'att5.txt': {
              data: PouchDB.utils.btoa('5'),
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'doc2',
          _attachments: {
            'att3.txt': {
              data: PouchDB.utils.btoa('3'),
              content_type: 'text/plain'
            },
            'att4.txt': {
              data: PouchDB.utils.btoa('4'),
              content_type: 'text/plain'
            },
            'att5.txt': {
              data: PouchDB.utils.btoa('5'),
              content_type: 'text/plain'
            },
            'att6.txt': {
              data: PouchDB.utils.btoa('6'),
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'doc3',
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            },
            'att6.txt': {
              data: PouchDB.utils.btoa('6'),
              content_type: 'text/plain'
            },
            'att7.txt': {
              data: PouchDB.utils.btoa('7'),
              content_type: 'text/plain'
            }
          }
        }
      ];

      var digestsToForget;
      var digestsToRemember;
      return db.bulkDocs(docs).then(function () {
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        var allAtts = {};
        res.rows.forEach(function (row) {
          Object.keys(row.doc._attachments).forEach(function (attName) {
            var att = row.doc._attachments[attName];
            allAtts[attName] = att.digest;
          });
        });
        digestsToForget = [
          allAtts['att2.txt'],
          allAtts['att3.txt'],
          allAtts['att4.txt'],
          allAtts['att5.txt']
        ];
        digestsToRemember = [
          allAtts['att1.txt'],
          allAtts['att6.txt'],
          allAtts['att7.txt']
        ];
        return db.allDocs({keys: ['doc1', 'doc2']});
      }).then(function (res) {
        var docs = res.rows.map(function (row) {
          return {
            _deleted: true,
            _id: row.id,
            _rev: row.value.rev
          };
        });
        return db.bulkDocs(docs);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return PouchDB.utils.Promise.all(
          digestsToRemember.map(function (digest) {
            return db.post({
              _attachments: {
                'baz.txt' : {
                  stub: true,
                  digest: digest,
                  content_type: 'text/plain'
                }
              }
            });
          }));
      }).then(function () {
        return PouchDB.utils.Promise.all(
          digestsToForget.map(function (digest) {
            return db.post({
              _attachments: {
                'baz.txt' : {
                  stub: true,
                  digest: digest,
                  content_type: 'text/plain'
                }
              }
            }).then(function () {
              throw new Error('shouldn\'t have gotten here');
            }, function (err) {
              err.status.should.equal(412);
            });
          }));
      });
    });

    it('#3089 Same att orphaned by many documents', function () {
      // In this test, a single attachment is shared by many docs,
      // which are all deleted in a single bulkDocs. This is to
      // hunt down race conditions in our orphan compaction.

      var db = new PouchDB(dbs.name, {auto_compaction: false});

      var docs = [];
      for (var i = 0; i < 100; i++) {
        docs.push({
          _id: i.toString(),
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            }
          }
        });
      }

      return db.bulkDocs(docs).then(function (results) {
        results.forEach(function (res, i) {
          docs[i]._rev = res.rev;
        });
        return db.get(docs[0]._id);
      }).then(function (doc) {
        var digest = doc._attachments['att1.txt'].digest;
        docs.forEach(function (doc) {
          doc._deleted = true;
        });
        return db.bulkDocs(docs).then(function () {
          return db.compact();
        }).then(function () {
          return db.post({
            _attachments: {
              'baz.txt' : {
                stub: true,
                digest: digest,
                content_type: 'text/plain'
              }
            }
          }).then(function () {
            throw new Error('shouldn\'t have gotten here');
          }, function (err) {
            err.status.should.equal(412);
          });
        });
      });
    });

    //
    // AUTO-COMPACTION TESTS FOLLOW
    // http adapters need not apply!
    //

    it('Auto-compaction test', function (done) {
      var db = new PouchDB(dbs.name, {auto_compaction: true});
      var doc = {_id: 'doc', val: '1'};
      db.post(doc, function (err, res) {
        var rev1 = res.rev;
        doc._rev = rev1;
        doc.val = '2';
        db.post(doc, function (err, res) {
          var rev2 = res.rev;
          doc._rev = rev2;
          doc.val = '3';
          db.post(doc, function (err, res) {
            var rev3 = res.rev;
            db.get('doc', { rev: rev1 }, function (err, doc) {
              err.status.should.equal(404, 'rev-1 should be missing');
              err.name.should.equal(
                'not_found', 'rev-1 should be missing'
              );
              db.get('doc', { rev: rev2 }, function (err, doc) {
                err.status.should.equal(404, 'rev-2 should be missing');
                err.name.should.equal(
                  'not_found', 'rev-2 should be missing'
                );
                db.get('doc', { rev: rev3 }, function (err, doc) {
                  done(err);
                });
              });
            });
          });
        });
      });
    });

    it('#3251 massively parallel autocompaction while getting', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});

      var doc = {_id: 'foo'};

      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
      }).then(function () {

        var updatePromise = PouchDB.utils.Promise.resolve();

        for (var i  = 0; i < 20; i++) {
          /* jshint loopfunc: true */
          updatePromise = updatePromise.then(function () {
            return db.put(doc).then(function (res) {
              doc._rev = res.rev;
            });
          });
        }

        var tasks = [updatePromise];
        for (var ii = 0; ii < 300; ii++) {
          /* jshint loopfunc: true */
          var task = db.get('foo');
          for (var j =0; j < 10; j++) {
            task = task.then(function () {
              return new PouchDB.utils.Promise(function (resolve) {
                setTimeout(resolve, Math.floor(Math.random() * 10));
              });
            }).then(function () {
              return db.get('foo');
            });
          }
          tasks.push(task);
        }
        return PouchDB.utils.Promise.all(tasks);
      });
    });

    it('#3251 massively parallel autocompaction while allDocsing', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});

      var doc = {_id: 'foo'};

      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
      }).then(function () {

        var updatePromise = PouchDB.utils.Promise.resolve();

        for (var i  = 0; i < 20; i++) {
          /* jshint loopfunc: true */
          updatePromise = updatePromise.then(function () {
            return db.put(doc).then(function (res) {
              doc._rev = res.rev;
            });
          });
        }

        var tasks = [updatePromise];
        for (var ii = 0; ii < 300; ii++) {
          /* jshint loopfunc: true */
          var task = db.allDocs({key: 'foo', include_docs: true});
          for (var j =0; j < 10; j++) {
            task = task.then(function () {
              return new PouchDB.utils.Promise(function (resolve) {
                setTimeout(resolve, Math.floor(Math.random() * 10));
              });
            }).then(function () {
              return db.allDocs({key: 'foo', include_docs: true});
            });
          }
          tasks.push(task);
        }
        return PouchDB.utils.Promise.all(tasks);
      });
    });

    it('#3251 massively parallel autocompaction while changesing', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});

      var doc = {_id: 'foo'};

      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
      }).then(function () {

        var updatePromise = PouchDB.utils.Promise.resolve();

        for (var i  = 0; i < 20; i++) {
          /* jshint loopfunc: true */
          updatePromise = updatePromise.then(function () {
            return db.put(doc).then(function (res) {
              doc._rev = res.rev;
            });
          });
        }

        var tasks = [updatePromise];
        for (var ii = 0; ii < 300; ii++) {
          /* jshint loopfunc: true */
          var task = db.changes({include_docs: true});
          for (var j =0; j < 10; j++) {
            task = task.then(function () {
              return new PouchDB.utils.Promise(function (resolve) {
                setTimeout(resolve, Math.floor(Math.random() * 10));
              });
            }).then(function () {
              return db.changes({include_docs: true});
            });
          }
          tasks.push(task);
        }
        return PouchDB.utils.Promise.all(tasks);
      });
    });

    it('#3089 Many orphaned attachments w/ auto-compaction', function () {
      // now that we've established md5sum collisions,
      // we can use that to detect true attachment replacement
      var db = new PouchDB(dbs.name, {auto_compaction: true});
      var docs = [
        {
          _id: 'doc1',
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            },
            'att2.txt': {
              data: PouchDB.utils.btoa('2'),
              content_type: 'text/plain'
            },
            'att3.txt': {
              data: PouchDB.utils.btoa('3'),
              content_type: 'text/plain'
            },
            'att4.txt': {
              data: PouchDB.utils.btoa('4'),
              content_type: 'text/plain'
            },
            'att5.txt': {
              data: PouchDB.utils.btoa('5'),
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'doc2',
          _attachments: {
            'att3.txt': {
              data: PouchDB.utils.btoa('3'),
              content_type: 'text/plain'
            },
            'att4.txt': {
              data: PouchDB.utils.btoa('4'),
              content_type: 'text/plain'
            },
            'att5.txt': {
              data: PouchDB.utils.btoa('5'),
              content_type: 'text/plain'
            },
            'att6.txt': {
              data: PouchDB.utils.btoa('6'),
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'doc3',
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            },
            'att6.txt': {
              data: PouchDB.utils.btoa('6'),
              content_type: 'text/plain'
            },
            'att7.txt': {
              data: PouchDB.utils.btoa('7'),
              content_type: 'text/plain'
            }
          }
        }
      ];

      var digestsToForget;
      var digestsToRemember;
      return db.bulkDocs(docs).then(function () {
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        var allAtts = {};
        res.rows.forEach(function (row) {
          Object.keys(row.doc._attachments).forEach(function (attName) {
            var att = row.doc._attachments[attName];
            allAtts[attName] = att.digest;
          });
        });
        digestsToForget = [
          allAtts['att2.txt'],
          allAtts['att3.txt'],
          allAtts['att4.txt'],
          allAtts['att5.txt']
        ];
        digestsToRemember = [
          allAtts['att1.txt'],
          allAtts['att6.txt'],
          allAtts['att7.txt']
        ];
        return db.get('doc1');
      }).then(function (doc1) {
        return db.remove(doc1);
      }).then(function () {
        return db.get('doc2');
      }).then(function (doc2) {
        return db.remove(doc2);
      }).then(function () {
        return PouchDB.utils.Promise.all(
          digestsToRemember.map(function (digest) {
            return db.post({
              _attachments: {
                'baz.txt' : {
                  stub: true,
                  digest: digest,
                  content_type: 'text/plain'
                }
              }
            });
          }));
      }).then(function () {
        return PouchDB.utils.Promise.all(
          digestsToForget.map(function (digest) {
            return db.post({
              _attachments: {
                'baz.txt' : {
                  stub: true,
                  digest: digest,
                  content_type: 'text/plain'
                }
              }
            }).then(function () {
              throw new Error('shouldn\'t have gotten here');
            }, function (err) {
              err.status.should.equal(412);
            });
          }));
      });
    });

    it('#3089 Many orphaned atts w/ parallel auto-compaction', function () {
      // now that we've established md5sum collisions,
      // we can use that to detect true attachment replacement
      var db = new PouchDB(dbs.name, {auto_compaction: true});
      var docs = [
        {
          _id: 'doc1',
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            },
            'att2.txt': {
              data: PouchDB.utils.btoa('2'),
              content_type: 'text/plain'
            },
            'att3.txt': {
              data: PouchDB.utils.btoa('3'),
              content_type: 'text/plain'
            },
            'att4.txt': {
              data: PouchDB.utils.btoa('4'),
              content_type: 'text/plain'
            },
            'att5.txt': {
              data: PouchDB.utils.btoa('5'),
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'doc2',
          _attachments: {
            'att3.txt': {
              data: PouchDB.utils.btoa('3'),
              content_type: 'text/plain'
            },
            'att4.txt': {
              data: PouchDB.utils.btoa('4'),
              content_type: 'text/plain'
            },
            'att5.txt': {
              data: PouchDB.utils.btoa('5'),
              content_type: 'text/plain'
            },
            'att6.txt': {
              data: PouchDB.utils.btoa('6'),
              content_type: 'text/plain'
            }
          }
        }, {
          _id: 'doc3',
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            },
            'att6.txt': {
              data: PouchDB.utils.btoa('6'),
              content_type: 'text/plain'
            },
            'att7.txt': {
              data: PouchDB.utils.btoa('7'),
              content_type: 'text/plain'
            }
          }
        }
      ];

      var digestsToForget;
      var digestsToRemember;
      return db.bulkDocs(docs).then(function () {
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        var allAtts = {};
        res.rows.forEach(function (row) {
          Object.keys(row.doc._attachments).forEach(function (attName) {
            var att = row.doc._attachments[attName];
            allAtts[attName] = att.digest;
          });
        });
        digestsToForget = [
          allAtts['att2.txt'],
          allAtts['att3.txt'],
          allAtts['att4.txt'],
          allAtts['att5.txt']
        ];
        digestsToRemember = [
          allAtts['att1.txt'],
          allAtts['att6.txt'],
          allAtts['att7.txt']
        ];
        return db.allDocs({keys: ['doc1', 'doc2']});
      }).then(function (res) {
        var docs = res.rows.map(function (row) {
          return {
            _deleted: true,
            _id: row.id,
            _rev: row.value.rev
          };
        });
        return db.bulkDocs(docs);
      }).then(function () {
        return PouchDB.utils.Promise.all(
          digestsToRemember.map(function (digest) {
            return db.post({
              _attachments: {
                'baz.txt' : {
                  stub: true,
                  digest: digest,
                  content_type: 'text/plain'
                }
              }
            });
          }));
      }).then(function () {
        return PouchDB.utils.Promise.all(
          digestsToForget.map(function (digest) {
            return db.post({
              _attachments: {
                'baz.txt' : {
                  stub: true,
                  digest: digest,
                  content_type: 'text/plain'
                }
              }
            }).then(function () {
              throw new Error('shouldn\'t have gotten here');
            }, function (err) {
              err.status.should.equal(412);
            });
          }));
      });
    });

    it('#3089 Auto-compaction retains atts if unorphaned', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});
      var doc = {
        _id: 'doc1',
        _attachments: {
          'deleteme.txt': {
            data: 'Zm9vYmFy', // 'foobar'
            content_type: 'text/plain'
          }
        }
      };
      var digest;
      return db.put(doc).then(function () {
        return db.get('doc1');
      }).then(function (doc) {
        digest = doc._attachments['deleteme.txt'].digest;
        delete doc._attachments['deleteme.txt'];
        doc._attachments['retainme.txt'] = {
          data: 'dG90bw==', // 'toto'
          content_type: 'text/plain'
        };
        return db.put(doc);
      }).then(function () {
        return db.put({
          _id: 'doc2',
          _attachments: {
            'nodontdeleteme.txt': {
              data: 'Zm9vYmFy', // 'foobar'
              content_type: 'text/plain'
            }
          }
        });
      }).then(function () {
        return db.get('doc1');
      }).then(function (doc) {
        doc._attachments['newatt.txt'] = {
          content_type: "text/plain",
          digest: digest,
          stub: true
        };
        return db.put(doc);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        // ok, now let's really delete them
        var docs = [
          {
            _id: 'doc1',
            _rev: res.rows[0].value.rev
          },
          {
            _id: 'doc2',
            _rev: res.rows[1].value.rev
          }
        ];
        return db.bulkDocs(docs);
      }).then(function () {
        var doc = {
          _attachments: {
            'foo.txt': {
              content_type: "text/plain",
              digest: digest,
              stub: true
            }
          }
        };
        return db.post(doc).then(function () {
          throw new Error('shouldn\'t have gotten here');
        }, function (err) {
          err.status.should.equal(412);
        });
      });
    });

    it('#2818 successive new_edits okay with attachments', function () {
      var db = new PouchDB(dbs.name);
      var docs = [{
        '_id': 'foo',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        },
        _attachments: {
          'att.txt': {
            data: 'Zm9vYmFy', // 'foobar'
            content_type: 'text/plain'
          }
        }
      }];
      var digest;
      return db.bulkDocs({docs: docs, new_edits: false}).then(function () {
        return db.bulkDocs({docs: docs, new_edits: false});
      }).then(function () {
        return db.get('foo', {attachments: true});
      }).then(function (doc) {
        doc._rev.should.equal('1-x');
        digest = doc._attachments['att.txt'].digest;
      }).then(function () {
        var doc = {
          _attachments: {
            'foo.txt': {
              content_type: "text/plain",
              digest: digest,
              stub: true
            }
          }
        };
        return db.post(doc);
      });
    });

    it('Auto-compaction removes non-leaf revs (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(1);
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(2);
        should.exist(docsAndRevs[0].doc);
        should.not.exist(docsAndRevs[1].doc);
      });
    });

    it('Auto-compaction removes non-leaf revs pt 2 (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(3);
        should.exist(docsAndRevs[0].doc);
        should.not.exist(docsAndRevs[1].doc);
        should.not.exist(docsAndRevs[2].doc);
      });
    });

    it('Auto-compaction removes non-leaf revs pt 3 (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});

      var docs = [
        {
          _id: 'foo',
          _rev: '1-a1',
          _revisions: { start: 1, ids: [ 'a1' ] }
        }, {
          _id: 'foo',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'foo',
          _deleted: true,
          _rev: '3-a3',
          _revisions: { start: 3, ids: [ 'a3', 'a2', 'a1' ] }
        }, {
          _id: 'foo',
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }
      ];

      return db.bulkDocs(docs, {new_edits: false}).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(4);
        var asMap = {};
        docsAndRevs.forEach(function (docAndRev) {
          asMap[docAndRev.rev] = docAndRev.doc;
        });
        // only leafs remain
        should.not.exist(asMap['1-a1']);
        should.not.exist(asMap['2-a2']);
        should.exist(asMap['3-a3']);
        should.exist(asMap['1-b1']);
      });
    });

    it('Auto-compaction removes non-leaf revs pt 4 (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        doc._deleted = true;
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        delete doc._deleted;
        return db.put(doc);
      }).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(3);
        should.exist(docsAndRevs[0].doc);
        should.not.exist(docsAndRevs[1].doc);
        should.not.exist(docsAndRevs[2].doc);
      });
    });

    it('Auto-compaction removes non-leaf revs pt 5 (#2807)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: true});
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        doc._deleted = true;
        return db.put(doc);
      }).then(function () {
        return getRevisions(db, 'foo');
      }).then(function (docsAndRevs) {
        docsAndRevs.should.have.length(3);
        should.exist(docsAndRevs[0].doc);
        should.not.exist(docsAndRevs[1].doc);
        should.not.exist(docsAndRevs[2].doc);
      });
    });

    it('#3089 Same att orphaned by many docs, auto-compact', function () {
      // In this test, a single attachment is shared by many docs,
      // which are all deleted in a single bulkDocs. This is to
      // hunt down race conditions in our orphan compaction.

      var db = new PouchDB(dbs.name, {auto_compaction: true});

      var docs = [];
      for (var i = 0; i < 100; i++) {
        docs.push({
          _id: i.toString(),
          _attachments: {
            'att1.txt': {
              data: PouchDB.utils.btoa('1'),
              content_type: 'text/plain'
            }
          }
        });
      }

      return db.bulkDocs(docs).then(function (results) {
        results.forEach(function (res, i) {
          docs[i]._rev = res.rev;
        });
        return db.get(docs[0]._id);
      }).then(function (doc) {
        var digest = doc._attachments['att1.txt'].digest;
        docs.forEach(function (doc) {
          doc._deleted = true;
        });
        return db.bulkDocs(docs).then(function () {
          return db.post({
            _attachments: {
              'baz.txt' : {
                stub: true,
                digest: digest,
                content_type: 'text/plain'
              }
            }
          }).then(function () {
            throw new Error('shouldn\'t have gotten here');
          }, function (err) {
            err.status.should.equal(412);
          });
        });
      });
    });

  });
});
