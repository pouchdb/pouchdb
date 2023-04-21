'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.conflicts.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function () {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
    });

    afterEach(function (done) {
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
              db.changes({return_docs: true}).on('complete', function (results) {
                results.results.should.have.length(1);
                doc2._rev = undefined;
                db.put(doc2, function (err) {
                  err.name.should.equal('conflict', 'Another conflict');
                  done();
                });
              }).on('error', done);
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

    it('force put ok on 1st level', function () {
      var db = new PouchDB(dbs.name);
      var docId = "docId";
      var rev1, rev2, rev3, rev2_;
      // given
      return db.put({_id: docId, update:1}).then(function (result) {
        rev1 = result.rev;
        return db.put({_id: docId, update:2.1, _rev: rev1});
      }).then(function (result) {
        rev2 = result.rev;
        return db.put({_id: docId, update:3, _rev:rev2});
      })
      // when
      .then(function (result) {
        rev3 = result.rev;
        return db.put({_id: docId, update:2.2, _rev: rev1}, {force: true});
      })
      // then
      .then(function (result) {
        rev2_ = result.rev;
        rev2_.should.not.equal(rev3);
        rev2_.substring(0, 2).should.equal('2-');
        should.exist(result.ok, 'update based on nonleaf revision');

        return db.get(docId, {conflicts: true, revs: true});
      }).then(function (doc) {
        doc._rev.should.equal(rev3);
        doc._conflicts.should.eql([rev2_]);

        return db.get(docId, {conflicts: true, revs: true, rev: rev2_});
      });
    });

    it('force put ok on 2nd level', function () {
      var db = new PouchDB(dbs.name);
      var docId = "docId";
      var rev2, rev3, rev4, rev3_;
      // given
      return db.put({_id: docId, update: 1}).then(function (result) {
        return db.put({_id: docId, update: 2, _rev: result.rev});
      }).then(function (result) {
        rev2 = result.rev;
        return db.put({_id: docId, update: 3.1, _rev: rev2});
      }).then(function (result) {
        rev3 = result.rev;
        return db.put({_id: docId, update: 4, _rev: rev3});
      })
      // when
      .then(function (result) {
        rev4 = result.rev;
        return db.put({_id: docId, update:3.2, _rev: rev2}, {force: true});
      })
      // then
      .then(function (result) {
        rev3_ = result.rev;
        rev3_.should.not.equal(rev4);
        rev3_.substring(0, 2).should.equal('3-');
        should.exist(result.ok, 'update based on nonleaf revision');

        return db.get(docId, {conflicts: true, revs: true});
      }).then(function (doc) {
        doc._rev.should.equal(rev4);
        doc._conflicts.should.eql([rev3_]);

        return db.get(docId, {conflicts: true, revs: true, rev: rev3_});
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
      }).then(function () {
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
      var chain = testUtils.Promise.resolve();

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

    it('5832 - update losing leaf returns correct rev', function () {
      // given
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
          _rev: '2-b2',
          _revisions: { start: 2, ids: [ 'b2', 'a1' ] }
        }
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({
        docs: docs, new_edits: false
      }).then(function () {
        return db.get('fubar', { conflicts: true });
      })
      .then(function (doc) {
        return db.remove(doc);
      })
      .then(function (result) {
        result.rev[0].should.equal('3');
      });
    });

  });
});
