'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.conflicts.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    it('Testing conflicts', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo', a: 1, b: 1};
      db.put(doc, function (err, res) {
        doc._rev = res.rev;
        should.exist(res.ok, 'Put first document');
        db.get('foo', function (err, doc2) {
          doc._id.should.equal(doc2._id);
          doc.should.have.property('_rev');
          doc2.should.have.property('_rev');
          doc.a = 2;
          doc2.a = 3;
          db.put(doc, function (err, res) {
            should.exist(res.ok, 'Put second doc');
            db.put(doc2, function (err) {
              err.name.should.equal('conflict', 'Put got a conflicts');
              db.changes({
                complete: function (err, results) {
                  results.results.should.have.length(1);
                  doc2._rev = undefined;
                  db.put(doc2, function (err) {
                    err.name.should.equal('conflict', 'Another conflict');
                    done();
                  });
                }
              });
            });
          });
        });
      });
    });

    it('Testing conflicts', function (done) {
      var doc = {_id: 'fubar', a: 1, b: 1};
      var db = new PouchDB(dbs.name);
      db.put(doc, function (err, ndoc) {
        doc._rev = ndoc.rev;
        db.remove(doc, function () {
          delete doc._rev;
          db.put(doc, function (err, ndoc) {
            if (err) {
              return done(err);
            }
            should.exist(ndoc.ok, 'written previously deleted doc without rev');
            done();
          });
        });
      });
    });

    it('#2882/#2883 last_seq for empty db', function () {
      // CouchDB 2.0 sequence numbers are not
      // incremental so skip this test
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);
      return db.changes().then(function (changes) {
        changes.last_seq.should.equal(0);
        changes.results.should.have.length(0);
        return db.info();
      }).then(function (info) {
        info.update_seq.should.equal(0);
      });
    });

    it('#2882/#2883 last_seq when putting parent before leaf', function () {
      // CouchDB 2.0 sequence numbers are not
      // incremental so skip this test
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);
      var lastSeq;
      return db.bulkDocs({
        docs: [
          {
            _id: 'fubar',
            _rev: '2-a2',
            _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
          }, {
            _id: 'fubar',
            _rev: '1-a1',
            _revisions: { start: 1, ids: [ 'a1' ] }
          }
        ],
        new_edits: false
      }).then(function () {
        return db.changes();
      }).then(function (changes) {
        lastSeq = changes.last_seq;
        changes.results[0].changes[0].rev.should.equal('2-a2');
        changes.results[0].seq.should.equal(lastSeq);
        return db.info();
      }).then(function (info) {
        info.update_seq.should.equal(lastSeq);
      });
    });

    // Each revision includes a list of previous revisions. The
    // revision with the longest revision history list becomes the
    // winning revision. If they are the same, the _rev values are
    // compared in ASCII sort order, and the highest wins. So, in our
    // example, 2-de0ea16f8621cbac506d23a0fbbde08a beats
    // 2-7c971bb974251ae8541b8fe045964219.

    it('Conflict resolution 1', function () {
      var docs = [
        {
          _id: 'fubar',
          _rev: '1-a',
          _revisions: {
            start: 1,
            ids: [ 'a' ]
          }
        }, {
          _id: 'fubar',
          _rev: '1-b',
          _revisions: {
            start: 1,
            ids: [ 'b' ]
          }
        }, {
          _id: 'fubar',
          _rev: '1-1',
          _revisions: {
            start: 1,
            ids: [ '1' ]
          }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('1-b', 'Correct revision wins');
        return db.bulkDocs({
          new_edits: false,
          docs: [{
            _id: 'fubar',
            _rev: '2-2',
            _revisions: {
              start: 2,
              ids: [ '2', '1' ]
            }
          }]
        });
      }).then(function (res) {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('2-2', 'Correct revision wins');
      });
    });

    it('Conflict resolution 2', function () {
      var docs = [
        {
          _id: 'fubar',
          _rev: '2-a',
          _revisions: {
            start: 2,
            ids: [ 'a' ]
          }
        }, {
          _id: 'fubar',
          _rev: '1-b',
          _revisions: {
            start: 1,
            ids: [ 'b' ]
          }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('2-a', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('Conflict resolution 3', function () {
      var docs = [
        {
          _id: 'fubar',
          _rev: '10-a',
          _revisions: {
            start: 10,
            ids: [ 'a' ]
          }
        }, {
          _id: 'fubar',
          _rev: '2-b',
          _revisions: {
            start: 2,
            ids: [ 'b' ]
          }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('10-a', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('Conflict resolution 4-a', function () {
      var docs = [
        {
          _id: 'fubar',
          _rev: '1-a1',
          _revisions: { start: 1, ids: [ 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _deleted: true,
          _rev: '3-a3',
          _revisions: { start: 3, ids: [ 'a3', 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('1-b1', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('Conflict resolution 4-b', function () {
      var docs = [
        {
          _id: 'fubar',
          _deleted: true,
          _rev: '3-a3',
          _revisions: { start: 3, ids: [ 'a3', 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '1-a1',
          _revisions: { start: 1, ids: [ 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('1-b1', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('Conflict resolution 4-c', function () {
      var docs = [
        {
          _id: 'fubar',
          _rev: '1-a1',
          _revisions: { start: 1, ids: [ 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }, {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _deleted: true,
          _rev: '3-a3',
          _revisions: { start: 3, ids: [ 'a3', 'a2', 'a1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
          doc._rev.should.equal('1-b1', 'Correct revision wins');
          return db.info();
        }).then(function (info) {
          info.doc_count.should.equal(1, 'Correct number of docs');
        });
    });

    it('Conflict resolution 4-d', function () {
      var docs = [
        {
          _id: 'fubar',
          _rev: '1-a1',
          _revisions: { start: 1, ids: [ 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }, {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _deleted: true,
          _rev: '3-a3',
          _revisions: { start: 3, ids: [ 'a3', 'a2', 'a1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('1-b1', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('Conflict resolution 4-e', function () {
      var docs = [
        {
          _id: 'fubar',
          _deleted: true,
          _rev: '3-a3',
          _revisions: { start: 3, ids: [ 'a3', 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }, {
          _id: 'fubar',
          _rev: '1-a1',
          _revisions: { start: 1, ids: [ 'a1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('1-b1', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('Conflict resolution 5-a', function () {
      var docs = [
        {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _deleted: true,
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }, {
          _id: 'fubar',
          _deleted: true,
          _rev: '1-c1',
          _revisions: { start: 1, ids: [ 'c1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('2-a2', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('Conflict resolution 5-b', function () {
      var docs = [
        {
          _id: 'fubar',
          _deleted: true,
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }, {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }, {
          _id: 'fubar',
          _deleted: true,
          _rev: '1-c1',
          _revisions: { start: 1, ids: [ 'c1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('2-a2', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('Conflict resolution 5-c', function () {
      var docs = [
        {
          _id: 'fubar',
          _deleted: true,
          _rev: '1-b1',
          _revisions: { start: 1, ids: [ 'b1' ] }
        }, {
          _id: 'fubar',
          _deleted: true,
          _rev: '1-c1',
          _revisions: { start: 1, ids: [ 'c1' ] }
        }, {
          _id: 'fubar',
          _rev: '2-a2',
          _revisions: { start: 2, ids: [ 'a2', 'a1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({ docs: docs, new_edits: false }).then(function () {
        return db.get('fubar');
      }).then(function (doc) {
        doc._rev.should.equal('2-a2', 'Correct revision wins');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'Correct number of docs');
      });
    });

    it('#2543 excessive recursion with merging', function () {
      var chain = PouchDB.utils.Promise.resolve();

      var db = new PouchDB(dbs.name);

      function addTask(batch) {
        return function () {
          var docs = [];
          for (var i = 0; i < 50; i++) {
            var hash = batch + 'a' +  i;
            docs.push({
              _id: 'foo',
              _rev: '2-' + hash,
              _revisions: {
                start: 2,
                ids: [hash, 'a']
              }
            });
          }
          return db.bulkDocs(docs, {new_edits: false});
        };
      }

      chain = chain.then(function () {
        return db.bulkDocs([{
          _id: 'foo',
          _rev: '1-a'
        }], {new_edits: false});
      });

      for (var i = 0; i < 10; i++) {
        chain = chain.then(addTask(i));
      }
      return chain;
    });

    it('local conflicts', function (done) {
      if (testUtils.isCouchMaster()) {
        return done();
      }
      var db = new PouchDB(dbs.name);
      return db.put({foo: 'bar'}, '_local/baz').then(function (result) {
        return db.put({foo: 'bar'}, '_local/baz', result.res);
      }).then(function () {
        return db.put({foo: 'bar'}, '_local/baz');
      }, function (e) {
        should.not.exist(e, 'shouldn\'t error yet');
        done(e);
      }).then(undefined, function (e) {
        should.exist(e, 'error when you have a conflict');
        done();
      });
    });

  });
});
