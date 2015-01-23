'use strict';

var adapters = [
  ['local', 'http'],
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'local']
];

if ('saucelabs' in testUtils.params()) {
  adapters = [['local', 'http'], ['http', 'local']];
}

var downAdapters = ['local'];

adapters.forEach(function (adapters) {
  describe('test.replication.js-' + adapters[0] + '-' + adapters[1],
    function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });


    var docs = [
      {_id: '0', integer: 0, string: '0'},
      {_id: '1', integer: 1, string: '1'},
      {_id: '2', integer: 2, string: '2'}
    ];

    // simplify for easier deep equality checks
    function simplifyChanges(res) {
      var changes = res.results.map(function (change) {
        return {
          id: change.id,
          deleted: change.deleted,
          changes: change.changes.map(function (x) {
            return x.rev;
          }).sort(),
          doc: change.doc
        };
      });

      // in CouchDB 2.0, changes is not guaranteed to be
      // ordered
      if (testUtils.isCouchMaster()) {
        changes.sort(function (a, b) {
          return a.id > b.id;
        });
      }

      return changes;
    }

    function verifyInfo(info, expected) {
      if (!testUtils.isCouchMaster()) {
        info.update_seq.should.equal(expected.update_seq, 'update_seq');
      }
      info.doc_count.should.equal(expected.doc_count, 'doc_count');
    }

    it('Test basic pull replication', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 3,
              doc_count: 3
            });
            done();
          });
        });
      });
    });

    it('Test basic pull replication plain api', function (done) {
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        PouchDB.replicate(dbs.remote, dbs.name, {}, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          new PouchDB(dbs.name).info(function (err, info) {
            verifyInfo(info, {
              update_seq: 3,
              doc_count: 3
            });
            done();
          });
        });
      });
    });

    it('Test basic pull replication plain api 2', function (done) {
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        PouchDB.replicate(dbs.remote, dbs.name, {
          complete: function (err, result) {
            result.ok.should.equal(true);
            result.docs_written.should.equal(docs.length);
            new PouchDB(dbs.name).info(function (err, info) {
              verifyInfo(info, {
                update_seq: 3,
                doc_count: 3
              });
              done();
            });
          }
        });
      });
    });

    it('Test pull replication with many changes', function (done) {
      var remote = new PouchDB(dbs.remote);

      var numDocs = 201;
      var docs = [];
      for (var i = 0; i < numDocs; i++) {
        docs.push({_id: i.toString()});
      }

      remote.bulkDocs({ docs: docs }, {}, function (err) {
        should.not.exist(err);
        PouchDB.replicate(dbs.remote, dbs.name, {
          complete: function (err, result) {
            result.ok.should.equal(true);
            result.docs_written.should.equal(docs.length);
            new PouchDB(dbs.name).info(function (err, info) {
              verifyInfo(info, {
                update_seq: numDocs,
                doc_count: numDocs
              });
              done();
            });
          }
        });
      });
    });

    it('Test basic pull replication with funny ids', function (done) {
      var docs = [
        {_id: '4/5', integer: 0, string: '0'},
        {_id: '3&2', integer: 1, string: '1'},
        {_id: '1>0', integer: 2, string: '2'}
      ];
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({docs: docs}, function (err, results) {
        db.replicate.from(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 3,
              doc_count: 3
            });
            done();
          });
        });
      });
    });

    it('pull replication with many changes + a conflict (#2543)', function () {
      var db = new PouchDB(dbs.remote);
      var remote = new PouchDB(dbs.remote);
      // simulate 5000 normal commits with two conflicts at the very end
      function uuid() {
        return PouchDB.utils.uuid(32, 16).toLowerCase();
      }

      var numRevs = 5000;
      var isSafari = (typeof process === 'undefined' || process.browser) &&
        /Safari/.test(window.navigator.userAgent) &&
        !/Chrome/.test(window.navigator.userAgent);
      if (isSafari) {
        numRevs = 10; // fuck safari, we've hit the storage limit again
      }

      var uuids = [];
      for (var i = 0; i < numRevs - 1; i++) {
        uuids.push(uuid());
      }
      var conflict1 = 'a' + uuid();
      var conflict2 = 'b' + uuid();

      var doc1 = {
        _id: 'doc',
        _rev: numRevs + '-' + conflict1,
        _revisions: {
          start: numRevs,
          ids: [conflict1].concat(uuids)
        }
      };
      var doc2 = {
        _id: 'doc',
        _rev: numRevs + '-' + conflict2,
        _revisions: {
          start: numRevs,
          ids: [conflict2].concat(uuids)
        }
      };
      return remote.bulkDocs([doc1], {new_edits: false}).then(function () {
        return remote.replicate.to(db);
      }).then(function (result) {
        result.ok.should.equal(true);
        result.docs_written.should.equal(0, 'correct # docs written (1)');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'doc_count');
        return db.get('doc', {open_revs: "all"});
      }).then(function (doc) {
        doc.should.deep.equal([{"ok": {"_id": "doc", "_rev": doc1._rev}}]);
        return remote.bulkDocs([doc2], {new_edits: false});
      }).then(function () {
        return remote.replicate.to(db);
      }).then(function (result) {
        result.ok.should.equal(true);
        result.docs_written.should.equal(0, 'correct # docs written (2)');
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1, 'doc_count');
        return db.get('doc', {open_revs: "all"});
      }).then(function (docs) {
        // order with open_revs is unspecified
        docs.sort(function (a, b) {
          return a.ok._rev < b.ok._rev ? -1 : 1;
        });
        docs.should.deep.equal([
          {"ok": {"_id": "doc", "_rev": doc1._rev}},
          {"ok": {"_id": "doc", "_rev": doc2._rev}}
        ]);
      });
    });

    it('issue 2779, undeletion when replicating', function () {
      if (testUtils.isCouchMaster()) {
        return true;
      }
      var db =  new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var rev;

      function checkNumRevisions(num) {
        return db.get('foo', {
          open_revs: 'all',
          revs: true
        }).then(function (fullDocs) {
          fullDocs[0].ok._revisions.ids.should.have.length(num,
            'local is correct');
        }).then(function () {
          return remote.get('foo', {
            open_revs: 'all',
            revs: true
          });
        }).then(function (fullDocs) {
          fullDocs[0].ok._revisions.ids.should.have.length(num,
            'remote is correct');
        });
      }

      return db.put({_id: 'foo'}).then(function (resp) {
        rev = resp.rev;
        return db.replicate.to(remote);
      }).then(function () {
        return checkNumRevisions(1);
      }).then(function () {
        return db.remove('foo', rev);
      }).then(function () {
        return db.replicate.to(remote);
      }).then(function () {
        return checkNumRevisions(2);
      }).then(function () {
        return db.allDocs({keys: ['foo']});
      }).then(function (res) {
        rev = res.rows[0].value.rev;
        return db.put({_id: 'foo', _rev: rev});
      }).then(function () {
        return db.replicate.to(remote);
      }).then(function () {
        return checkNumRevisions(3);
      });
    });

    it('Test pull replication with many conflicts', function (done) {
      var remote = new PouchDB(dbs.remote);

      var numRevs = 200; // repro "url too long" error with open_revs
      var docs = [];
      for (var i = 0; i < numRevs; i++) {
        var rev =  '1-' + PouchDB.utils.uuid(32, 16).toLowerCase();
        docs.push({_id: 'doc', _rev: rev});
      }

      remote.bulkDocs({ docs: docs }, {new_edits: false}, function (err) {
        should.not.exist(err);
        PouchDB.replicate(dbs.remote, dbs.name, {
          complete: function (err, result) {
            result.ok.should.equal(true);
            result.docs_written.should.equal(docs.length);
            var db = new PouchDB(dbs.name);
            db.info(function (err, info) {
              should.not.exist(err);
              info.doc_count.should.equal(1, 'doc_count');
              db.get('doc', {open_revs: "all"}, function (err, docs) {
                should.not.exist(err);
                var okDocs = docs.filter(function (doc) { return doc.ok; });
                okDocs.should.have.length(numRevs);
                done();
              });
            });
          }
        });
      });
    });

    it('Test correct # docs replicated with staggered revs', function (done) {
      // ensure we don't just process all the open_revs with
      // every replication; we should only process the current subset
      var remote = new PouchDB(dbs.remote);

      var docs = [{_id: 'doc', _rev: '1-a'}, {_id: 'doc', _rev: '1-b'}];
      remote.bulkDocs({ docs: docs }, {new_edits: false}, function (err) {
        should.not.exist(err);
        PouchDB.replicate(dbs.remote, dbs.name, {
          complete: function (err, result) {
            result.ok.should.equal(true);
            result.docs_written.should.equal(2);
            result.docs_read.should.equal(2);
            var docs = [{_id: 'doc', _rev: '1-c'}, {_id: 'doc', _rev: '1-d'}];
            remote.bulkDocs({ docs: docs }, {new_edits: false}, function (err) {
              should.not.exist(err);
              PouchDB.replicate(dbs.remote, dbs.name, {
                complete: function (err, result) {
                  result.docs_written.should.equal(2);
                  result.docs_read.should.equal(2);
                  var db = new PouchDB(dbs.name);
                  db.info(function (err, info) {
                    should.not.exist(err);
                    info.doc_count.should.equal(1, 'doc_count');
                    db.get('doc', {open_revs: "all"}, function (err, docs) {
                      should.not.exist(err);
                      var okDocs = docs.filter(function (doc) {
                        return doc.ok;
                      });
                      okDocs.should.have.length(4);
                      done();
                    });
                  });
                }
              });
            });
          }
        });
      });
    });

    it('Local DB contains documents', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, _) {
        db.bulkDocs({ docs: docs }, {}, function (err, _) {
          db.replicate.from(dbs.remote, function (err, _) {
            db.allDocs(function (err, result) {
              result.rows.length.should.equal(docs.length);
              db.info(function (err, info) {
                if (!testUtils.isCouchMaster()) {
                  info.update_seq.should.be.above(2, 'update_seq local');
                }
                info.doc_count.should.equal(3, 'doc_count local');
                remote.info(function (err, info) {
                  if (!testUtils.isCouchMaster()) {
                    info.update_seq.should.be.above(2, 'update_seq remote');
                  }
                  info.doc_count.should.equal(3, 'doc_count remote');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Test basic push replication', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.to(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 3,
              doc_count: 3
            });
            done();
          });
        });
      });
    });

    it('Test basic push replication take 2', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.bulkDocs({ docs: docs }, {}, function (err, _) {
        db.replicate.to(dbs.remote, function (err, _) {
          remote.allDocs(function (err, result) {
            result.rows.length.should.equal(docs.length);
            db.info(function (err, info) {
              verifyInfo(info, {
                update_seq: 3,
                doc_count: 3
              });
              done();
            });
          });
        });
      });
    });

    it('Test basic push replication sequence tracking', function (done) {
      var db = new PouchDB(dbs.name);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      db.put(doc1, function (err, result) {
        db.replicate.to(dbs.remote, function (err, result) {
          result.docs_read.should.equal(1);
          db.replicate.to(dbs.remote, function (err, result) {
            result.docs_read.should.equal(0);
            db.replicate.to(dbs.remote, function (err, result) {
              result.docs_read.should.equal(0);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 1,
                  doc_count: 1
                });
                done();
              });
            });
          });
        });
      });
    });

    it('Test checkpoint', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          db.replicate.from(dbs.remote, function (err, result) {
            result.ok.should.equal(true);
            result.docs_written.should.equal(0);
            result.docs_read.should.equal(0);
            db.info(function (err, info) {
              verifyInfo(info, {
                update_seq: 3,
                doc_count: 3
              });
              done();
            });
          });
        });
      });
    });

    it('Test live pull checkpoint', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        var changeCount = docs.length;
        var changes = db.changes({
          live: true,
          onChange: function (change) {
            if (--changeCount) {
              return;
            }
            replication.cancel();
            changes.cancel();
          },
          complete: function () {
            db.replicate.from(dbs.remote, {
              complete: function (err, details) {
                details.docs_read.should.equal(0);
                db.info(function (err, info) {
                  verifyInfo(info, {
                    update_seq: 3,
                    doc_count: 3
                  });
                  done();
                });
              }
            });
          }
        });
        var replication = db.replicate.from(dbs.remote, { live: true });
      });
    });

    it('Test live push checkpoint', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.bulkDocs({ docs: docs }, {}, function (err, results) {
        var changeCount = docs.length;
        var finished = 0;
        var isFinished = function () {
          if (++finished !== 2) {
            return;
          }
          db.replicate.to(dbs.remote, {
            complete: function (err, details) {
              details.docs_read.should.equal(0);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 3,
                  doc_count: 3
                });
                done();
              });
            }
          });
        };
        var changes = remote.changes({
          live: true,
          onChange: function (change) {
            if (--changeCount) {
              return;
            }
            replication.cancel();
            changes.cancel();
          },
          complete: isFinished
        });
        var replication = db.replicate.to(dbs.remote, {
          live: true,
          complete: isFinished
        });
      });
    });

    it('Test checkpoint 2', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc = {_id: '3', count: 0};
      remote.put(doc, {}, function (err, results) {
        db.replicate.from(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          doc._rev = results.rev;
          doc.count++;
          remote.put(doc, {}, function (err, results) {
            doc._rev = results.rev;
            doc.count++;
            remote.put(doc, {}, function (err, results) {
              db.replicate.from(dbs.remote, function (err, result) {
                result.ok.should.equal(true);
                result.docs_written.should.equal(1);
                db.info(function (err, info) {
                  verifyInfo(info, {
                    update_seq: 2,
                    doc_count: 1
                  });
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Test checkpoint 3 :)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc = {_id: '3', count: 0};
      db.put(doc, {}, function (err, results) {
        PouchDB.replicate(db, remote, {}, function (err, result) {
          result.ok.should.equal(true);
          doc._rev = results.rev;
          doc.count++;
          db.put(doc, {}, function (err, results) {
            doc._rev = results.rev;
            doc.count++;
            db.put(doc, {}, function (err, results) {
              PouchDB.replicate(db, remote, {}, function (err, result) {
                result.ok.should.equal(true);
                result.docs_written.should.equal(1);
                db.info(function (err, info) {
                  verifyInfo(info, {
                    update_seq: 3,
                    doc_count: 1
                  });
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('#3136 open revs returned correctly 1', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var doc = {_id: 'foo'};
      var firstRev;

      var chain = PouchDB.utils.Promise.resolve().then(function () {
        return db.put(doc).then(function (info) {
          firstRev = info.rev;
        });
      });

      function addConflict(i) {
        chain = chain.then(function () {
          return db.bulkDocs({
            docs: [{
              _id: 'foo',
              _rev: '2-' + i
            }],
            new_edits: false
          });
        });
      }

      for (var i = 0; i < 50; i++) {
        addConflict(i);
      }
      return chain.then(function () {
        var revs1;
        var revs2;
        return db.get('foo', {
          conflicts: true,
          revs: true,
          open_revs: 'all'
        }).then(function (res) {
          revs1 = res.map(function (x) {
            return x.ok._rev;
          }).sort();
          return db.replicate.to(remote);
        }).then(function () {
          return remote.get('foo', {
            conflicts: true,
            revs: true,
            open_revs: 'all'
          });
        }).then(function (res) {
          revs2 = res.map(function (x) {
            return x.ok._rev;
          }).sort();
          revs1.should.deep.equal(revs2);
        });
      });
    });

    it('#3136 open revs returned correctly 2', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var doc = {_id: 'foo'};
      var firstRev;

      var chain = PouchDB.utils.Promise.resolve().then(function () {
        return db.put(doc).then(function (info) {
          firstRev = info.rev;
        });
      });

      function addConflict(i) {
        chain = chain.then(function () {
          return db.bulkDocs({
            docs: [{
              _id: 'foo',
              _rev: '2-' + i,
              _deleted: (i % 3 === 1)
            }],
            new_edits: false
          });
        });
      }

      for (var i = 0; i < 50; i++) {
        addConflict(i);
      }
      return chain.then(function () {
        var revs1;
        var revs2;
        return db.get('foo', {
          conflicts: true,
          revs: true,
          open_revs: 'all'
        }).then(function (res) {
          revs1 = res.map(function (x) {
            return x.ok._rev;
          }).sort();
          return db.replicate.to(remote);
        }).then(function () {
          return remote.get('foo', {
            conflicts: true,
            revs: true,
            open_revs: 'all'
          });
        }).then(function (res) {
          revs2 = res.map(function (x) {
            return x.ok._rev;
          }).sort();
          revs1.should.deep.equal(revs2);
        });
      });
    });

    it('#3136 winningRev has a lower seq', function () {
      var db1 = new PouchDB(dbs.name);
      var db2 = new PouchDB(dbs.remote);
      var tree = [
        [
          {_id: 'foo', _rev: '1-a',
           _revisions: {start: 1, ids: ['a']}},
          {_id: 'foo', _rev: '2-e', _deleted: true,
           _revisions: { start: 2, ids: ['e', 'a']}},
          {_id: 'foo', _rev: '3-g',
           _revisions: { start: 3, ids: ['g', 'e', 'a']}}
        ],
        [
          {_id: 'foo', _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}},
          {_id: 'foo', _rev: '2-b',
            _revisions: {start: 2, ids: ['b', 'a']}},
          {_id: 'foo', _rev: '3-c',
            _revisions: {start: 3, ids: ['c', 'b', 'a']}}
        ],
        [
          {_id: 'foo', _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}},
          {_id: 'foo', _rev: '2-d',
            _revisions: {start: 2, ids: ['d', 'a']}},
          {_id: 'foo', _rev: '3-h',
            _revisions: {start: 3, ids: ['h', 'd', 'a']}},
          {_id: 'foo', _rev: '4-f',
            _revisions: {start: 4, ids: ['f', 'h', 'd', 'a']}}
        ]
      ];

      var chain = PouchDB.utils.Promise.resolve();
      tree.forEach(function (docs) {
        chain = chain.then(function () {
          var revs1;
          var revs2;

          return db1.bulkDocs({
            docs: docs,
            new_edits: false
          }).then(function () {
            return db1.replicate.to(db2);
          }).then(function () {
            return db1.get('foo', {
              open_revs: 'all',
              revs: true,
              conflicts: true
            });
          }).then(function (res1) {
            revs1 = res1.map(function (x) {
              return x.ok._rev;
            }).sort();

            return db2.get('foo', {
              open_revs: 'all',
              revs: true,
              conflicts: true
            });
          }).then(function (res2) {
            revs2 = res2.map(function (x) {
              return x.ok._rev;
            }).sort();
            revs1.should.deep.equal(revs2, 'same revs');
          });
        });
      });
      return chain;
    });

    it('#3136 same changes with style=all_docs', function () {
      var db1 = new PouchDB(dbs.name);
      var db2 = new PouchDB(dbs.remote);
      var tree = [
        [
          {_id: 'foo', _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}},
          {_id: 'foo', _rev: '2-e', _deleted: true,
            _revisions: { start: 2, ids: ['e', 'a']}},
          {_id: 'foo', _rev: '3-g',
            _revisions: { start: 3, ids: ['g', 'e', 'a']}}
        ],
        [
          {_id: 'foo', _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}},
          {_id: 'foo', _rev: '2-b',
            _revisions: {start: 2, ids: ['b', 'a']}},
          {_id: 'foo', _rev: '3-c',
            _revisions: {start: 3, ids: ['c', 'b', 'a']}}
        ],
        [
          {_id: 'foo', _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}},
          {_id: 'foo', _rev: '2-d',
            _revisions: {start: 2, ids: ['d', 'a']}},
          {_id: 'foo', _rev: '3-h',
            _revisions: {start: 3, ids: ['h', 'd', 'a']}},
          {_id: 'foo', _rev: '4-f',
            _revisions: {start: 4, ids: ['f', 'h', 'd', 'a']}}
        ]
      ];

      var chain = PouchDB.utils.Promise.resolve();
      tree.forEach(function (docs) {
        chain = chain.then(function () {
          var changes1;
          var changes2;

          return db1.bulkDocs({
            docs: docs,
            new_edits: false
          }).then(function () {
            return db1.replicate.to(db2);
          }).then(function () {
            return db1.changes({style: 'all_docs'});
          }).then(function (res1) {
            changes1 = simplifyChanges(res1);
            return db2.changes({style: 'all_docs'});
          }).then(function (res2) {
            changes2 = simplifyChanges(res2);

            changes1.should.deep.equal(changes2, 'same changes');
          });
        });
      });
      return chain;
    });

    it('#3136 style=all_docs with conflicts', function () {
      // blocked on COUCHDB-2518
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
      ];
      var docs2 = [
        {_id: '2', integer: 11},
        {_id: '3', integer: 12},
      ];
      var rev2;
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      return db.bulkDocs({ docs: docs1 }).then(function (info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;
        return db.put(docs2[0]);
      }).then(function () {
        return db.put(docs2[1]);
      }).then(function (info) {
        rev2 = info.rev;
        return PouchDB.replicate(db, remote);
      }).then(function () {
        // update remote once, local twice, then replicate from
        // remote to local so the remote losing conflict is later in
        // the tree
        return db.put({
          _id: '3',
          _rev: rev2,
          integer: 20
        });
      }).then(function (resp) {
        var rev3Doc = {
          _id: '3',
          _rev: resp.rev,
          integer: 30
        };
        return db.put(rev3Doc);
      }).then(function () {
        var rev4Doc = {
          _id: '3',
          _rev: rev2,
          integer: 100
        };
        return remote.put(rev4Doc).then(function () {
          return PouchDB.replicate(remote, db).then(function () {
            return PouchDB.replicate(db, remote);
          }).then(function () {
            return db.changes({
              include_docs: true,
              style: 'all_docs',
              conflicts: true
            });
          }).then(function (localChanges) {
            return remote.changes({
              include_docs: true,
              style: 'all_docs',
              conflicts: true
            }).then(function (remoteChanges) {
              localChanges = simplifyChanges(localChanges);
              remoteChanges = simplifyChanges(remoteChanges);

              localChanges.should.deep.equal(remoteChanges,
                'same changes');
            });
          });
        });
      });
    });

    it('#3136 style=all_docs with conflicts reversed', function () {
      // blocked on COUCHDB-2518
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
      ];
      var docs2 = [
        {_id: '2', integer: 11},
        {_id: '3', integer: 12},
      ];
      var rev2;
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      return db.bulkDocs({ docs: docs1 }).then(function (info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;
        return db.put(docs2[0]);
      }).then(function () {
        return db.put(docs2[1]);
      }).then(function (info) {
        rev2 = info.rev;
        return PouchDB.replicate(db, remote);
      }).then(function () {
        // update remote once, local twice, then replicate from
        // remote to local so the remote losing conflict is later in
        // the tree
        return db.put({
          _id: '3',
          _rev: rev2,
          integer: 20
        });
      }).then(function (resp) {
        var rev3Doc = {
          _id: '3',
          _rev: resp.rev,
          integer: 30
        };
        return db.put(rev3Doc);
      }).then(function () {
        var rev4Doc = {
          _id: '3',
          _rev: rev2,
          integer: 100
        };
        return remote.put(rev4Doc).then(function () {
          return PouchDB.replicate(remote, db).then(function () {
            return PouchDB.replicate(db, remote);
          }).then(function () {
            return db.changes({
              include_docs: true,
              style: 'all_docs',
              conflicts: true,
              descending: true
            });
          }).then(function (localChanges) {
            return remote.changes({
              include_docs: true,
              style: 'all_docs',
              conflicts: true,
              descending: true
            }).then(function (remoteChanges) {
              localChanges = simplifyChanges(localChanges);
              remoteChanges = simplifyChanges(remoteChanges);

              localChanges.should.deep.equal(remoteChanges,
                'same changes');
            });
          });
        });
      });
    });

    it('Test checkpoint read only 3 :)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var put = function (doc) {
        return db.bulkDocs({docs: [doc]}).then(function (resp) {
          return resp[0];
        });
      };
      var err = {
        "message": "_writer access is required for this request",
        "name": "unauthorized",
        "status": 401
      };
      db.put = function () {
        if (typeof arguments[arguments.length - 1] === 'function') {
          arguments[arguments.length - 1](err);
        } else {
          return PouchDB.utils.Promise.reject(err);
        }
      };
      var doc = {_id: '3', count: 0};
      put(doc).then(function (results) {
        return PouchDB.replicate(db, remote).then(function (result) {
          result.ok.should.equal(true);
          doc._rev = results.rev;
          doc.count++;
          return put(doc);
        });
      }).then(function (results) {
        doc._rev = results.rev;
        doc.count++;
        return put(doc);
      }).then(function () {
        return PouchDB.replicate(db, remote);
      }).then(function (result) {
        result.ok.should.equal(true);
        result.docs_written.should.equal(1);
        db.info(function (err, info) {
          verifyInfo(info, {
            update_seq: 3,
            doc_count: 1
          });
          done();
        });
      }, function (a) {
        done(JSON.stringify(a, false, 4));
      });
    });

    it('Testing allDocs with some conflicts (issue #468)', function (done) {
      var db1 = new PouchDB(dbs.name);
      var db2 = new PouchDB(dbs.remote);
      // we indeed needed replication to create failing test here!
      var doc = {_id: 'foo', _rev: '1-a', value: 'generic'};
      db1.put(doc, { new_edits: false }, function (err, res) {
        db2.put(doc, { new_edits: false }, function (err, res) {
          testUtils.putAfter(db2, {
            _id: 'foo',
            _rev: '2-b',
            value: 'db2'
          }, '1-a', function (err, res) {
            testUtils.putAfter(db1, {
              _id: 'foo',
              _rev: '2-c',
              value: 'whatever'
            }, '1-a', function (err, res) {
              testUtils.putAfter(db1, {
                _id: 'foo',
                _rev: '3-c',
                value: 'db1'
              }, '2-c', function (err, res) {
                db1.get('foo', function (err, doc) {
                  doc.value.should.equal('db1');
                  db2.get('foo', function (err, doc) {
                    doc.value.should.equal('db2');
                    PouchDB.replicate(db1, db2, function () {
                      PouchDB.replicate(db2, db1, function () {
                        db1.get('foo', function (err, doc) {
                          doc.value.should.equal('db1');
                          db2.get('foo', function (err, doc) {
                            doc.value.should.equal('db1');
                            db1.allDocs({ include_docs: true },
                              function (err, res) {
                              res.rows.should.have.length.above(0, 'first');
                              // redundant but we want to test it
                              res.rows[0].doc.value.should.equal('db1');
                              db2.allDocs({ include_docs: true },
                                function (err, res) {
                                res.rows.should.have.length.above(0, 'second');
                                res.rows[0].doc.value.should.equal('db1');
                                db1.info(function (err, info) {
                                  // if auto_compaction is enabled, will
                                  // be 5 because 2-c goes "missing" and
                                  // the other db tries to re-put it
                                  if (!testUtils.isCouchMaster()) {
                                    info.update_seq.should.be.within(4, 5);
                                  }
                                  info.doc_count.should.equal(1);
                                  db2.info(function (err, info2) {
                                    verifyInfo(info2, {
                                      update_seq: 3,
                                      doc_count: 1
                                    });
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
                });
              });
            });
          });
        });
      });
    });

    // CouchDB will not generate a conflict here, it uses a deteministic
    // method to generate the revision number, however we cannot copy its
    // method as it depends on erlangs internal data representation
    it('Test basic conflict', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      var doc2 = {_id: 'adoc', bar: 'baz'};
      db.put(doc1, function (err, localres) {
        remote.put(doc2, function (err, remoteres) {
          db.replicate.to(dbs.remote, function (err, _) {
            remote.get('adoc', { conflicts: true }, function (err, result) {
              result.should.have.property('_conflicts');
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 1,
                  doc_count: 1
                });
                done();
              });
            });
          });
        });
      });
    });

    it('Test _conflicts key', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      var doc2 = {_id: 'adoc', bar: 'baz'};
      var ddoc = {
        "_id": "_design/conflicts",
        views: {
          conflicts: {
            map: function (doc) {
              if (doc._conflicts) {
                emit(doc._id, [doc._rev].concat(doc._conflicts));
              }
            }.toString()
          }
        }
      };
      remote.put(ddoc, function (err, localres) {
        db.put(doc1, function (err, localres) {
          remote.put(doc2, function (err, remoteres) {
            db.replicate.to(dbs.remote, function (err, _) {
              remote.query('conflicts/conflicts', {
                reduce: false,
                conflicts: true
              }, function (_, res) {
                res.rows.length.should.equal(1);
                db.info(function (err, info) {
                  verifyInfo(info, {
                    update_seq: 1,
                    doc_count: 1
                  });
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Test basic live pull replication', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        var count = 0;
        var finished = 0;
        var isFinished = function () {
          if (++finished !== 2) {
            return;
          }
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 4,
              doc_count: 4
            });
            done();
          });
        };
        var rep = db.replicate.from(dbs.remote, {
          live: true,
          complete: isFinished
        });
        var changes = db.changes({
          onChange: function (change) {
            ++count;
            if (count === 3) {
              return remote.put(doc1);
            }
            if (count === 4) {
              rep.cancel();
              changes.cancel();
            }
          },
          live: true,
          complete: isFinished
        });
      });
    });

    it('Test basic live push replication', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      db.bulkDocs({ docs: docs }, {}, function (err, results) {
        var count = 0;
        var finished = 0;
        var isFinished = function () {
          if (++finished !== 2) {
            return;
          }
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 4,
              doc_count: 4
            });
            done();
          });
        };
        var rep = remote.replicate.from(db, {
          live: true,
          complete: isFinished
        });
        var changes = remote.changes({
          onChange: function (change) {
            ++count;
            if (count === 3) {
              return db.put(doc1);
            }
            if (count === 4) {
              rep.cancel();
              changes.cancel();
            }
          },
          live: true,
          complete: isFinished
        });
      });
    });

    it('test-cancel-pull-replication', function (done) {
      new PouchDB(dbs.remote, function (err, remote) {
        var db = new PouchDB(dbs.name);
        var docs = [
          {_id: '0', integer: 0, string: '0'},
          {_id: '1', integer: 1, string: '1'},
          {_id: '2', integer: 2, string: '2'}
        ];
        var doc1 = {_id: 'adoc', foo: 'bar' };
        var doc2 = {_id: 'anotherdoc', foo: 'baz'};
        remote.bulkDocs({ docs: docs }, {}, function (err, results) {
          var count = 0;
          var replicate = db.replicate.from(remote, {
            live: true,
            complete: function () {
              remote.put(doc2);
              setTimeout(function () {
                changes.cancel();
              }, 100);
            }
          });
          var changes = db.changes({
            live: true,
            complete: function (err, reason) {
              count.should.equal(4);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 4,
                  doc_count: 4
                });
                done();
              });
            },
            onChange: function (change) {
              ++count;
              if (count === 3) {
                remote.put(doc1);
              }
              if (count === 4) {
                replicate.cancel();
              }
            }
          });
        });
      });
    });

    it('Test basic events', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }).then(function () {
        db.replicate.to(dbs.remote)
        .on('complete', function (res) {
          should.exist(res);
          db.replicate.to('http://0.0.0.0:0')
          .on('error', function (res) {
            should.exist(res);
            done();
          });
        });
      });
    });

    it('Replication filter', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      remote.bulkDocs({ docs: docs1 }, function (err, info) {
        db.replicate.from(remote, {
          complete: function (err, res) {
            if (err) {
              done(err);
            }
            db.allDocs(function (err, docs) {
              if (err) { done(err); }
              docs.rows.length.should.equal(2);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 2,
                  doc_count: 2
                });
                done();
              });
            });
          },
          filter: function (doc) {
            return doc.integer % 2 === 0;
          }
        });
      });
    });

    it('Replication with different filters', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var more_docs = [
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 4, string: '4'}
      ];
      remote.bulkDocs({ docs: docs }, function (err, info) {
        db.replicate.from(remote, {
          filter: function (doc) {
            return doc.integer % 2 === 0;
          }
        }, function (err, response) {
          remote.bulkDocs({ docs: more_docs }, function (err, info) {
            db.replicate.from(remote, {}, function (err, response) {
              response.docs_written.should.equal(3);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 5,
                  doc_count: 5
                });
                done();
              });
            });
          });
        });
      });
    });

    it('Replication doc ids', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var thedocs = [
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 4, string: '4'},
        {_id: '5', integer: 5, string: '5'}
      ];
      remote.bulkDocs({ docs: thedocs }, function (err, info) {
        db.replicate.from(remote, {
          doc_ids: ['3', '4']
        }, function (err, response) {
          response.docs_written.should.equal(2);
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 2,
              doc_count: 2
            });
            done();
          });
        });
      });
    });

    it('Replication since', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs1 = [
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
        {_id: '3', integer: 3, string: '3'}
      ];
      remote.bulkDocs({ docs: docs1 }, function (err, info) {
        remote.info(function (err, info) {
          var update_seq = info.update_seq;
          var docs2 = [
            {_id: '4', integer: 4, string: '4'},
            {_id: '5', integer: 5, string: '5'}
          ];
          remote.bulkDocs({ docs: docs2 }, function (err, info) {
            db.replicate.from(remote, {
              since: update_seq,
              complete: function (err, result) {
                should.not.exist(err);
                result.docs_written.should.equal(2);
                db.replicate.from(remote, {
                  since: 0,
                  complete: function (err, result) {
                    should.not.exist(err);
                    result.docs_written.should.equal(3);
                    db.info(function (err, info) {
                      verifyInfo(info, {
                        update_seq: 5,
                        doc_count: 5
                      });
                      done();
                    });
                  }
                });
              }
            });
          });
        });
      });
    });

    it('Replication with same filters', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var more_docs = [
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 4, string: '4'}
      ];
      remote.bulkDocs({ docs: docs }, function (err, info) {
        db.replicate.from(remote, {
          filter: function (doc) {
            return doc.integer % 2 === 0;
          }
        }, function (err, response) {
          remote.bulkDocs({ docs: more_docs }, function (err, info) {
            db.replicate.from(remote, {
              filter: function (doc) {
                return doc.integer % 2 === 0;
              }
            }, function (err, response) {
              response.docs_written.should.equal(1);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 3,
                  doc_count: 3
                });
                done();
              });
            });
          });
        });
      });
    });

    it('Replication with filter that leads to some empty batches (#2689)',
       function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 1},
        {_id: '3', integer: 1},
        {_id: '4', integer: 2},
        {_id: '5', integer: 2}
      ];
      remote.bulkDocs({ docs: docs1 }, function (err, info) {
        db.replicate.from(remote, {
          batch_size: 2,
          complete: function (err, res) {
            if (err) {
              done(err);
            }
            db.allDocs(function (err, docs) {
              if (err) { done(err); }
              docs.rows.length.should.equal(3);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 3,
                  doc_count: 3
                });
                done();
              });
            });
          },
          filter: function (doc) {
            return doc.integer % 2 === 0;
          }
        });
      });
    });

    it('Replication with deleted doc', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
        {_id: '4', integer: 4, _deleted: true}
      ];
      remote.bulkDocs({ docs: docs1 }, function (err, info) {
        db.replicate.from(remote, function () {
          db.allDocs(function (err, res) {
            res.total_rows.should.equal(4);
            db.info(function (err, info) {
              verifyInfo(info, {
                update_seq: 5,
                doc_count: 4
              });
              done();
            });
          });
        });
      });
    });

    it('Replication with doc deleted twice', function (done) {
      if (testUtils.isCouchMaster()) {
        return done();
      }
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }).then(function (info) {
        return remote.get('0');
      }).then(function (doc) {
        return remote.remove(doc);
      }).then(function () {
        return db.replicate.from(remote);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.total_rows.should.equal(2);
        return remote.allDocs({ keys: [ '0' ] });
      }).then(function (res) {
        var row = res.rows[0];
        should.not.exist(row.error);
        // set rev to latest so we go at the end (otherwise new
        // rev is 1 and the subsequent remove below won't win)
        var doc = {
          _id: '0',
          integer: 10,
          string: '10',
          _rev: row.value.rev
        };
        return remote.put(doc);
      }).then(function () {
        return remote.get('0');
      }).then(function (doc) {
        return remote.remove(doc);
      }).then(function () {
        return db.replicate.from(remote);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.total_rows.should.equal(2);
        db.info(function (err, info) {
          verifyInfo(info, {
            update_seq: 4,
            doc_count: 2
          });
          done();
        });
      }).catch(function (err) {
        done(JSON.stringify(err, false, 4));
      });
    });

    it('Replication notifications', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var changes = 0;
      var onChange = function (c) {
        changes++;
        if (changes === 3) {
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 3,
              doc_count: 3
            });
            done();
          });
        }
      };
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, { onChange: onChange });
      });
    });

    it('Replication with remote conflict', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc = {_id: 'test', test: 'Remote 1'}, winningRev;
      remote.post(doc, function (err, resp) {
        doc._rev = resp.rev;
        PouchDB.replicate(remote, db, function (err, resp) {
          doc.test = 'Local 1';
          db.put(doc, function (err, resp) {
            doc.test = 'Remote 2';
            remote.put(doc, function (err, resp) {
              doc._rev = resp.rev;
              doc.test = 'Remote 3';
              remote.put(doc, function (err, resp) {
                winningRev = resp.rev;
                PouchDB.replicate(db, remote, function (err, resp) {
                  PouchDB.replicate(remote, db, function (err, resp) {
                    remote.get('test', { revs_info: true },
                      function (err, remotedoc) {
                      db.get('test', { revs_info: true },
                        function (err, localdoc) {
                        localdoc._rev.should.equal(winningRev);
                        remotedoc._rev.should.equal(winningRev);
                        db.info(function (err, info) {
                          verifyInfo(info, {
                            update_seq: 3,
                            doc_count: 1
                          });
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
      });
    });

    it('Replicate and modify three times', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var doc = {
        _id: 'foo',
        generation: 1
      };

      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.replicate.to(remote);
      }).then(function () {
        return remote.get('foo');
      }).then(function (doc) {
        doc.generation.should.equal(1);
        doc.generation = 2;
        return remote.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        return remote.replicate.to(db);
      }).then(function () {
        return db.get('foo');
      }).then(function (doc) {
        doc.generation.should.equal(2);
        doc.generation = 3;
        return db.put(doc);
      }).then(function () {
        return db.replicate.to(remote);
      }).then(function () {
        return db.get('foo', {conflicts: true});
      }).then(function (doc) {
        doc.generation.should.equal(3);
        should.not.exist(doc._conflicts);
      }).then(function () {
        return remote.get('foo', {conflicts: true});
      }).then(function (doc) {
        doc.generation.should.equal(3);
        should.not.exist(doc._conflicts);
      });
    });

    function waitForChange(db, fun) {
      return new PouchDB.utils.Promise(function (resolve) {
        var remoteChanges = db.changes({live: true, include_docs: true});
        remoteChanges.on('change', function (change) {
          if (fun(change)) {
            remoteChanges.cancel();
            resolve();
          }
        });
      });
    }

    it('Replicates deleted docs (issue #2636)', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var replication = db.replicate.to(remote, {
        live: true
      });

      return db.post({}).then(function (res) {
        var doc = {
          _id: res.id,
          _rev: res.rev
        };
        return db.remove(doc);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(0, 'deleted locally');
      }).then(function () {
        return waitForChange(remote, function (change) {
          return change.deleted === true;
        });
      }).then(function () {
        return remote.allDocs();
      }).then(function (res) {
        replication.cancel();
        res.rows.should.have.length(0, 'deleted in remote');
      });
    });

    it('Replicates deleted docs w/ delay (issue #2636)', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var replication = db.replicate.to(remote, {
        live: true
      });

      var doc;
      return db.post({}).then(function (res) {
        doc = {_id: res.id, _rev: res.rev};
        return waitForChange(remote, function () { return true; });
      }).then(function () {
        return db.remove(doc);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(0, 'deleted locally');
      }).then(function () {
        return waitForChange(remote, function (c) {
          return c.id === doc._id && c.deleted;
        });
      }).then(function () {
        return remote.allDocs();
      }).then(function (res) {
        replication.cancel();
        res.rows.should.have.length(0, 'deleted in remote');
      });
    });

    it('Replicates deleted docs w/ compaction', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var doc = {_id: 'foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.replicate.to(remote);
      }).then(function () {
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        return db.remove(doc);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(0, 'deleted locally');
      }).then(function () {
        return db.replicate.to(remote);
      }).then(function () {
        return remote.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(0, 'deleted in remote');
      });
    });

    it('Replicates modified docs (issue #2636)', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var replication = db.replicate.to(remote, {
        live: true
      });

      return db.post({}).then(function (res) {
        var doc = {
          _id: res.id,
          _rev: res.rev,
          modified: 'yep'
        };

        return db.put(doc);
      }).then(function () {
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        res.rows.should.have.length(1, 'one doc synced locally');
        res.rows[0].doc.modified.should.equal('yep', 'modified locally');
      }).then(function () {
        return waitForChange(remote, function (change) {
          return change.doc.modified === 'yep';
        });
      }).then(function () {
        return remote.allDocs({include_docs: true});
      }).then(function (res) {
        replication.cancel();
        res.rows.should.have.length(1, '1 doc in remote');
        res.rows[0].doc.modified.should.equal('yep', 'modified in remote');
      });
    });

    it('Replication of multiple remote conflicts (#789)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc = {_id: '789', _rev: '1-a', value: 'test'};
      function createConflicts(db, callback) {
        db.put(doc, { new_edits: false }, function (err, res) {
          testUtils.putAfter(db, {
            _id: '789',
            _rev: '2-a',
            value: 'v1'
          }, '1-a', function (err, res) {
            testUtils.putAfter(db, {
              _id: '789',
              _rev: '2-b',
              value: 'v2'
            }, '1-a', function (err, res) {
              testUtils.putAfter(db, {
                _id: '789',
                _rev: '2-c',
                value: 'v3'
              }, '1-a', function (err, res) {
                callback();
              });
            });
          });
        });
      }
      createConflicts(remote, function () {
        db.replicate.from(remote, function (err, result) {
          result.ok.should.equal(true);
          // in this situation, all the conflicting revisions should be read and
          // written to the target database (this is consistent with CouchDB)
          result.docs_written.should.equal(3);
          result.docs_read.should.equal(3);
          db.info(function (err, info) {
            if (!testUtils.isCouchMaster()) {
              info.update_seq.should.be.above(0);
            }
            info.doc_count.should.equal(1);
            done();
          });
        });
      });
    });

    it('Replicate large number of docs', function (done) {
      if ('saucelabs' in testUtils.params()) {
        return done();
      }
      this.timeout(15000);
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [];
      var num = 30;
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      remote.bulkDocs({ docs: docs }, function (err, info) {
        db.replicate.from(remote, {}, function () {
          db.allDocs(function (err, res) {
            res.total_rows.should.equal(num);
            db.info(function (err, info) {
              verifyInfo(info, {
                update_seq: 30,
                doc_count: 30
              });
              done();
            });
          });
        });
      });
    });

    it.skip('Changes error', function (done) {
      if ('saucelabs' in testUtils.params()) {
        return done();
      }
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [];
      var num = 80;
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      remote.bulkDocs({docs: docs}, {}, function (err, results) {
        var changes = remote.changes;
        var doc_count = 0;

        // Mock remote.get to fail writing doc_3
        remote.changes = function (opts) {
          var onChange = opts.onChange;
          opts.onChange = function () {
            doc_count++;
            onChange.apply(this, arguments);
          };
          var complete = opts.complete;
          opts.complete = function () {
            complete.apply(this, [{
              status: 500,
              error: 'mock changes error',
              reason: 'simulate and error from changes'
            }]);
          };
          changes.apply(this, arguments);
        };

        // Replicate and confirm failure
        db.replicate.from(remote, function (err, result) {
          should.exist(err);
          doc_count.should.equal(result.docs_read);
          remote.changes = changes;
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 3,
              doc_count: 3
            });
            done();
          });
        });
      });
    });

    it('Ensure checkpoint after deletion', function (done) {
      var db1name = dbs.name;
      var adoc = { '_id': 'adoc' };
      var newdoc = { '_id': 'newdoc' };
      var db1 = new PouchDB(dbs.name);
      var db2 = new PouchDB(dbs.remote);
      db1.post(adoc, function () {
        PouchDB.replicate(db1, db2, {
          complete: function () {
            db1.destroy(function () {
              var fresh = new PouchDB(db1name);
              fresh.post(newdoc, function () {
                PouchDB.replicate(fresh, db2, {
                  complete: function () {
                    db2.allDocs(function (err, docs) {
                      docs.rows.length.should.equal(2);
                      done();
                    });
                  }
                });
              });
            });
          }
        });
      });
    });

    it('issue #1001 cb as 3rd argument', function (done) {
      PouchDB.replicate('http://example.com', dbs.name, function (err, result) {
        should.exist(err);
        done();
      });
    });

    it('issue #1001 cb in options', function (done) {
      PouchDB.replicate('http://example.com', dbs.name, {
        complete: function (err, result) {
          should.exist(err);
          done();
        }
      });
    });

    it('issue #1001 cb as 4th argument', function (done) {
      PouchDB.replicate(
        'http://example.com',
        dbs.name,
        {},
        function (err, result) {
          should.exist(err);
          done();
        }
      );
    });

    it('issue #909 Filtered replication bails at paging limit',
      function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [];
      var num = 100;
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      num = 100;
      var docList = [];
      for (i = 0; i < num; i += 5) {
        docList.push('doc_' + i);
      }
      // uncomment this line to test only docs higher than paging limit
      docList = [
        'doc_33',
        'doc_60',
        'doc_90'
      ];
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, {
          live: false,
          doc_ids: docList
        }, function (err, result) {
          result.docs_written.should.equal(docList.length);
          db.info(function (err, info) {
            verifyInfo(info, {
              update_seq: 3,
              doc_count: 3
            });
            done();
          });
        });
      });
    });

    it.skip('(#1240) - get error', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      // 10 test documents
      var num = 10;
      var docs = [];
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      // Initialize remote with test documents
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        var get = remote.get;
        function first_replicate() {
          // Mock remote.get to fail writing doc_3 (fourth doc)
          remote.get = function () {
            // Simulate failure to get the document with id 'doc_4'
            // This should block the replication at seq 4
            if (arguments[0] === 'doc_4') {
              arguments[2].apply(null, [{}]);
            } else {
              get.apply(this, arguments);
            }
          };
          // Replicate and confirm failure, docs_written and target docs
          db.replicate.from(remote, function (err, result) {
            should.exist(err);
            should.exist(result);
            result.docs_written.should.equal(4);
            function check_docs(id, result) {
              if (!id) {
                second_replicate();
                return;
              }
              db.get(id, function (err, exists) {
                if (exists) {
                  should.not.exist(err);
                } else {
                  should.exist(err);
                }
                check_docs(docs.shift());
              });
            }
            var docs = [
              [
                'doc_0',
                true
              ],
              [
                'doc_1',
                true
              ],
              [
                'doc_2',
                true
              ],
              [
                'doc_3',
                false
              ],
              [
                'doc_4',
                false
              ],
              [
                'doc_5',
                false
              ],
              [
                'doc_6',
                false
              ],
              [
                'doc_7',
                false
              ],
              [
                'doc_8',
                false
              ],
              [
                'doc_9',
                false
              ]
            ];
            check_docs(docs.shift());
          });
        }
        function second_replicate() {
          // Restore remote.get to original
          remote.get = get;
          // Replicate and confirm success, docs_written and target docs
          db.replicate.from(remote, function (err, result) {
            should.not.exist(err);
            should.exist(result);
            result.docs_written.should.equal(6);
            function check_docs(id, exists) {
              if (!id) {
                db.info(function (err, info) {
                  verifyInfo(info, {
                    update_seq: 6,
                    doc_count: 6
                  });
                  done();
                });
                return;
              }
              db.get(id, function (err, result) {
                if (exists) {
                  should.not.exist(err);
                } else {
                  should.exist(err);
                }
                check_docs(docs.shift());
              });
            }
            var docs = [
              [
                'doc_0',
                true
              ],
              [
                'doc_1',
                true
              ],
              [
                'doc_2',
                true
              ],
              [
                'doc_3',
                true
              ],
              [
                'doc_4',
                true
              ],
              [
                'doc_5',
                true
              ],
              [
                'doc_6',
                true
              ],
              [
                'doc_7',
                true
              ],
              [
                'doc_8',
                true
              ],
              [
                'doc_9',
                true
              ]
            ];
            check_docs(docs.shift());
          });
        }
        // Done the test
        first_replicate();
      });
    });

    it.skip('Get error 2', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      // 10 test documents
      var num = 10;
      var docs = [];
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      // Initialize remote with test documents
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        var get = remote.get;
        function first_replicate() {
          // Mock remote.get to fail writing doc_3 (fourth doc)
          remote.get = function () {
            // Simulate failure to get the document with id 'doc_4'
            // This should block the replication at seq 4
            if (arguments[0] === 'doc_4') {
              arguments[2].apply(null, [{
                status: 500,
                error: 'mock error',
                reason: 'mock get failure'
              }]);
            } else {
              get.apply(this, arguments);
            }
          };
          // Replicate and confirm failure, docs_written and target docs
          db.replicate.from(remote, function (err, result) {
            err.status.should.equal(500);
            err.error.should.equal('Replication aborted');
            err.reason.should.equal('src.get completed with error');
            err.details.status.should.equal(500);
            err.details.error.should.equal('mock error');
            err.details.reason.should.equal('mock get failure');
            result.errors[0].status.should.equal(500);
            result.errors[0].error.should.equal('mock error');
            result.errors[0].reason.should.equal('mock get failure');
            result.docs_written.should.equal(4);
            function check_docs(id, result) {
              if (!id) {
                second_replicate();
                return;
              }
              db.get(id, function (err, exists) {
                if (exists) {
                  should.not.exist(err);
                } else {
                  should.exist(err);
                }
                check_docs(docs.shift());
              });
            }
            var docs = [
              [
                'doc_0',
                true
              ],
              [
                'doc_1',
                true
              ],
              [
                'doc_2',
                true
              ],
              [
                'doc_3',
                false
              ],
              [
                'doc_4',
                false
              ],
              [
                'doc_5',
                false
              ],
              [
                'doc_6',
                false
              ],
              [
                'doc_7',
                false
              ],
              [
                'doc_8',
                false
              ],
              [
                'doc_9',
                false
              ]
            ];
            check_docs(docs.shift());
          });
        }
        function second_replicate() {
          // Restore remote.get to original
          remote.get = get;
          // Replicate and confirm success, docs_written and target docs
          db.replicate.from(remote, function (err, result) {
            should.not.exist(err);
            should.exist(result);
            result.docs_written.should.equal(6);
            function check_docs(id, exists) {
              if (!id) {
                db.info(function (err, info) {
                  verifyInfo(info, {
                    update_seq: 6,
                    doc_count: 6
                  });
                  done();
                });
                return;
              }
              db.get(id, function (err, result) {
                if (exists) {
                  should.not.exist(err);
                } else {
                  should.exist(err);
                }
                check_docs(docs.shift());
              });
            }
            var docs = [
              [
                'doc_0',
                true
              ],
              [
                'doc_1',
                true
              ],
              [
                'doc_2',
                true
              ],
              [
                'doc_3',
                true
              ],
              [
                'doc_4',
                true
              ],
              [
                'doc_5',
                true
              ],
              [
                'doc_6',
                true
              ],
              [
                'doc_7',
                true
              ],
              [
                'doc_8',
                true
              ],
              [
                'doc_9',
                true
              ]
            ];
            check_docs(docs.shift());
          });
        }
        // Done the test
        first_replicate();
      });
    });

    it.skip("error updating checkpoint", function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({docs: docs}, {}, function (err, results) {
        var get = remote.get;
        var local_count = 0;
        // Mock remote.get to fail writing doc_3 (fourth doc)
        remote.get = function () {
          // Simulate failure to get the checkpoint
          if (arguments[0].slice(0, 6) === '_local') {
            local_count++;
            if (local_count === 2) {
              arguments[1].apply(null, [{
                status: 500,
                error: 'mock get error',
                reason: 'simulate an error updating the checkpoint'
              }]);
            } else {
              get.apply(this, arguments);
            }
          } else {
            get.apply(this, arguments);
          }
        };

        db.replicate.from(remote, {
          complete: function (err, result) {
            should.exist(err);
            db.info(function (err, info) {
              verifyInfo(info, {
                update_seq: 2,
                doc_count: 2
              });
              done();
            });
          }
        });
      });
    });

    it('(#1307) - replicate empty database', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.replicate.from(remote, function (err, result) {
        should.not.exist(err);
        should.exist(result);
        result.docs_written.should.equal(0);
        db.info(function (err, info) {
          verifyInfo(info, {
            update_seq: 0,
            doc_count: 0
          });
          done();
        });
      });
    });


    // This fails as it somehow triggers an xhr abort in the http adapter in
    // node which doesnt have xhr....
    it.skip('Syncing should stop if one replication fails (issue 838)',
      function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      var doc2 = {_id: 'anotherdoc', foo: 'baz'};
      var finished = false;
      var replications = db.replicate.sync(remote, {
        live: true,
        complete: function () {
          if (finished) {
            return;
          }
          finished = true;
          remote.put(doc2, function (err) {
            setTimeout(function () {
              db.allDocs(function (err, res) {
                res.total_rows.should.be.below(2);
                done();
              });
            }, 100);
          });
        }
      });
      db.put(doc1, function (err) {
        replications.pull.cancel();
      });
    });

    it("Reporting write failures (#942)", function (done) {
      var docs = [{_id: 'a', _rev: '1-a'}, {_id: 'b', _rev: '1-b'}];
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.bulkDocs({docs: docs}, {new_edits: false}, function (err, _) {
        var bulkDocs = remote.bulkDocs;
        var bulkDocsCallCount = 0;
        remote.bulkDocs = function (content, opts, callback) {
          return new PouchDB.utils.Promise(function (fulfill, reject) {
            if (typeof callback !== 'function') {
              callback = function (err, resp) {
                if (err) {
                  reject(err);
                } else {
                  fulfill(resp);
                }
              };
            }

            // mock a successful write for the first
            // document and a failed write for the second
            var doc = content.docs[0];
            if (bulkDocsCallCount === 0) {
              bulkDocsCallCount++;
              callback(null, [{ok: true, id: doc._id, rev: doc._rev}]);
            } else if (bulkDocsCallCount === 1) {
              bulkDocsCallCount++;
              callback(null, [{
                id: doc._id,
                error: 'internal server error',
                reason: 'test document write error'
              }]);
            } else {
              bulkDocs.apply(remote, [content, opts, callback]);
            }
          });
        };

        db.replicate.to(remote, {batch_size: 1, retry: false},
                        function (err, result) {
          should.not.exist(result);
          should.exist(err);
          err.result.docs_read.should.equal(2, 'docs_read');
          err.result.docs_written.should.equal(1, 'docs_written');
          err.result.doc_write_failures.should.equal(1, 'doc_write_failures');
          remote.bulkDocs = bulkDocs;
          db.replicate.to(remote, {batch_size: 1, retry: false},
                          function (err, result) {
            // checkpoint should not be moved past first doc
            // should continue from this point and retry second doc
            result.docs_read.should.equal(1, 'second replication, docs_read');
            result.docs_written.should
              .equal(1, 'second replication, docs_written');
            result.doc_write_failures.should
              .equal(0, 'second replication, doc_write_failures');
            db.info(function (err, info) {
              verifyInfo(info, {
                update_seq: 2,
                doc_count: 2
              });
              done();
            });
          });
        });
      });
    });

    it("Reporting write failures if whole saving fails (#942)",
      function (done) {
      var docs = [{_id: 'a', _rev: '1-a'}, {_id: 'b', _rev: '1-b'}];
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.bulkDocs({docs: docs}, {new_edits: false}, function (err, _) {
        var bulkDocs = remote.bulkDocs;
        remote.bulkDocs = function (docs, opts, callback) {
          if (typeof callback !== 'function') {
            return PouchDB.utils.Promise.reject(new Error());
          }
          callback(new Error());
        };

        db.replicate.to(remote, {batch_size: 1, retry: false},
                        function (err, result) {
          should.not.exist(result);
          should.exist(err);
          err.result.docs_read.should.equal(1, 'docs_read');
          err.result.docs_written.should.equal(0, 'docs_written');
          err.result.doc_write_failures.should.equal(1, 'doc_write_failures');
          err.result.last_seq.should.equal(0, 'last_seq');
          remote.bulkDocs = bulkDocs;
          db.replicate.to(remote, {batch_size: 1, retry: false},
                          function (err, result) {
            result.doc_write_failures.should
              .equal(0, 'second replication, doc_write_failures');
            result.docs_written.should
              .equal(2, 'second replication, docs_written');
            done();
          });
        });
      });
    });

    it('Test consecutive replications with different query_params',
      function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var myDocs = [
        {_id: '0', integer: 0, string: '0'},
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 5, string: '5'}
      ];
      remote.bulkDocs({ docs: myDocs }, {}, function (err, results) {
        var filterFun = function (doc, req) {
          if (req.query.even) {
            return doc.integer % 2 === 0;
          } else {
            return true;
          }
        };
        db.replicate.from(dbs.remote, {
          filter: filterFun,
          query_params: { 'even': true }
        }, function (err, result) {
          result.docs_written.should.equal(2);
          db.replicate.from(dbs.remote, {
            filter: filterFun,
            query_params: { 'even': false }
          }, function (err, result) {
            result.docs_written.should.equal(3);
            done();
          });
        });
      });
    });

    it('Test consecutive replications with different query_params and promises',
      function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var myDocs = [
        {_id: '0', integer: 0, string: '0'},
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 5, string: '5'}
      ];
      var filterFun;
      remote.bulkDocs({ docs: myDocs }).then(function (results) {
        filterFun = function (doc, req) {
          if (req.query.even) {
            return doc.integer % 2 === 0;
          } else {
            return true;
          }
        };
        return db.replicate.from(dbs.remote, {
          filter: filterFun,
          query_params: { 'even': true }
        });
      }).then(function (result) {
        result.docs_written.should.equal(2);
        return db.replicate.from(dbs.remote, {
          filter: filterFun,
          query_params: { 'even': false }
        });
      }).then(function (result) {
        result.docs_written.should.equal(3);
        done();
      }).catch(done);
    });

    it('Test consecutive replications with different doc_ids', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var myDocs = [
        {_id: '0', integer: 0, string: '0'},
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 5, string: '5'}
      ];
      remote.bulkDocs({ docs: myDocs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, {
          doc_ids: ['0', '4']
        }, function (err, result) {
          result.docs_written.should.equal(2);
          db.replicate.from(dbs.remote, {
            doc_ids: ['1', '2', '3']
          }, function (err, result) {
            result.docs_written.should.equal(3);
            db.replicate.from(dbs.remote, {
              doc_ids: ['5']
            }, function (err, result) {
              result.docs_written.should.equal(0);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 5,
                  doc_count: 5
                });
                done();
              });
            });
          });
        });
      });
    });

    it('doc count after multiple replications', function (done) {

      var runs = 2;
      // helper. remove each document in db and bulk load docs into same
      function rebuildDocuments(db, docs, callback) {
        db.allDocs({ include_docs: true }, function (err, response) {
          var count = 0;
          var limit = response.rows.length;
          if (limit === 0) {
            bulkLoad(db, docs, callback);
          }
          response.rows.forEach(function (doc) {
            db.remove(doc, function (err, response) {
              ++count;
              if (count === limit) {
                bulkLoad(db, docs, callback);
              }
            });
          });
        });
      }

      // helper.
      function bulkLoad(db, docs, callback) {
        db.bulkDocs({ docs: docs }, function (err, results) {
          if (err) {
            console.error('Unable to bulk load docs.  Err: ' +
                          JSON.stringify(err));
            return;
          }
          callback(results);
        });
      }

      // The number of workflow cycles to perform. 2+ was always failing
      // reason for this test.
      var workflow = function (name, remote, x) {
        // some documents.  note that the variable Date component,
        //thisVaries, makes a difference.
        // when the document is otherwise static, couch gets the same hash
        // when calculating revision.
        // and the revisions get messed up in pouch
        var docs = [
          {
            _id: '0',
            integer: 0,
            thisVaries: new Date(),
            common: true
          },
          {
            _id: '1',
            integer: 1,
            thisVaries: new Date(),
            common: true
          },
          {
            _id: '2',
            integer: 2,
            thisVaries: new Date(),
            common: true
          },
          {
            _id: '3',
            integer: 3,
            thisVaries: new Date(),
            common: true
          },
          {
            "_id": "_design/common",
            views: {
              common: {
                map: function (doc) {
                  if (doc.common) {
                    emit(doc._id, doc._rev);
                  }
                }.toString()
              }
            }
          }
        ];
        var dbr = new PouchDB(remote);
        rebuildDocuments(dbr, docs, function () {
          var db = new PouchDB(name);
          db.replicate.from(remote, function (err, result) {
            db.query('common/common', { reduce: false },
              function (err, result) {
                // -1 for the design doc
                result.rows.length.should.equal(docs.length - 1);
                if (--x) {
                  workflow(name, remote, x);
                } else {
                  db.info(function (err, info) {
                    verifyInfo(info, {
                      update_seq: 5,
                      doc_count: 5
                    });
                    done();
                  });
                }
              }
            );
          });
        });
      };

      workflow(dbs.name, dbs.remote, runs);
    });

    it('issue #300 rev id unique per doc', function (done) {
      var remote = new PouchDB(dbs.remote);
      var db = new PouchDB(dbs.name);
      var docs = [{ _id: 'a' }, { _id: 'b' }];
      remote.bulkDocs({ docs: docs }, {}, function (err, _) {
        db.replicate.from(dbs.remote, function (err, _) {
          db.allDocs(function (err, result) {
            result.rows.length.should.equal(2);
            result.rows[0].id.should.equal('a');
            result.rows[1].id.should.equal('b');
            db.info(function (err, info) {
              verifyInfo(info, {
                update_seq: 2,
                doc_count: 2
              });
              done();
            });
          });
        });
      });
    });

    it('issue #585 Store checkpoint on target db.', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [{ _id: 'a' }, { _id: 'b' }];
      db.bulkDocs({ docs: docs }, {}, function (err, _) {
        db.replicate.to(dbs.remote, function (err, result) {
          result.docs_written.should.equal(docs.length);
          remote.destroy(function (err, result) {
            db.replicate.to(dbs.remote, function (err, result) {
              result.docs_written.should.equal(docs.length);
              db.info(function (err, info) {
                verifyInfo(info, {
                  update_seq: 2,
                  doc_count: 2
                });
                done();
              });
            });
          });
        });
      });
    });
    it('should work with a read only source', function (done) {
      var src = new PouchDB(dbs.name);
      var target = new PouchDB(dbs.remote);
      var err = {
        "message": "_writer access is required for this request",
        "name": "unauthorized",
        "status": 401
      };
      src.bulkDocs({docs: [
        {_id: '0', integer: 0, string: '0'},
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
      ]}).then(function () {
        src.put = function () {
          if (typeof arguments[arguments.length - 1] === 'function') {
            arguments[arguments.length - 1](err);
          } else {
            return PouchDB.utils.Promise.reject(err);
          }
        };
        return src.replicate.to(target);
      }).then(function () {
        target.info(function (err, info) {
          verifyInfo(info, {
            update_seq: 3,
            doc_count: 3
          });
          done();
        });
      }, function (a) {
        done(JSON.stringify(a, false, 4));
      });
    });

    it('issue #2342 update_seq after replication', function (done) {
      this.timeout(30000);
      var docs = [];
      for (var i = 0; i < 10; i++) {
        docs.push({_id: i.toString()});
      }

      var remote = new PouchDB(dbs.remote);
      var db = new PouchDB(dbs.name);

      remote.bulkDocs({ docs: docs }, {}, function (err, res) {
        res.forEach(function (row, i) {
          docs[i]._rev = row.rev;
          if (i % 2 === 0) {
            docs[i]._deleted = true;
          }
        });
        remote.bulkDocs({docs: docs}, {}, function (err, res) {
          db.replicate.from(dbs.remote, function (err, _) {
            db.info(function (err, info) {
              db.changes({
                descending: true,
                limit: 1,
                onChange: function (change) {
                  change.changes.should.have.length(1);

                  // not a valid assertion in CouchDB 2.0
                  if (!testUtils.isCouchMaster()) {
                    change.seq.should.equal(info.update_seq);
                  }
                  done();
                }
              });
            });
          });
        });
      });
    });

    it('issue #2393 update_seq after new_edits + replication', function (done) {
      // the assertions below do not hold in a clustered CouchDB
      if (testUtils.isCouchMaster()) {
        return done();
      }

      var docs = [{
        '_id': 'foo',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      }];

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      remote.bulkDocs({docs: docs, new_edits: false}, function (err, result) {
        should.not.exist(err);
        remote.bulkDocs({docs: docs, new_edits: false}, function (err, result) {
          should.not.exist(err);
          db.replicate.from(dbs.remote, function (err, _) {
            db.info(function (err, info) {
              var changes = db.changes({
                descending: true,
                limit: 1,
                onChange: function (change) {
                  change.changes.should.have.length(1);
                  change.seq.should.equal(info.update_seq);
                  changes.cancel();
                },
                complete: function() {
                  remote.info(function (err, info) {
                    var rchanges = remote.changes({
                      descending: true,
                      limit: 1,
                      onChange: function (change) {
                        change.changes.should.have.length(1);
                        change.seq.should.equal(info.update_seq);
                        rchanges.cancel();
                      },
                      complete: function() {
                        done();
                      }
                    });
                  });
                }
              });
            });
          });
        });
      });
    });

    it('should cancel for live replication', function (done) {
      var remote = new PouchDB(dbs.remote);
      var db = new PouchDB(dbs.name);
      var rep = db.replicate.from(remote, {live: true});
      var called = false;
      rep.on('change', function () {
        if (called) {
          done(new Error('called too many times!'));
        } else {
          called = true;
          rep.cancel();
          remote.put({}, 'foo').then(function () {
            return remote.put({}, 'bar');
          }).then(function () {
            setTimeout(function () {
              done();
            }, 500);
          });
        }
      });
      remote.put({}, 'hazaa');
    });

    it('retry stuff', function (done) {

      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;
      var allDocs = remote.allDocs;

      // Reject attempting to write 'foo' 3 times, then let it succeed
      var i = 0;
      remote.allDocs = function (opts) {
        if (opts.keys[0] === 'foo') {
          if (++i !== 3) {
            return Promise.reject(new Error('flunking you'));
          }
        }
        return allDocs.apply(remote, arguments);
      };

      var db = new PouchDB(dbs.name);
      var rep = db.replicate.from(remote, {
        live: true,
        retry: true
      });

      var paused = 0;
      rep.on('paused', function (e) {
        ++paused;
        // The first paused event is the replication up to date
        // and waiting on changes (no error)
        if (paused === 1) {
          (typeof e).should.equal('undefined');
          return remote.put({}, 'foo').then(function () {
            return remote.put({}, 'bar');
          });
        }
        // Second paused event is due to failed writes, should
        // have an error
        if (paused === 2) {
          e.should.exist();
        }
      });

      var active = 0;
      rep.on('active', function () {
        ++active;
      });

      rep.on('complete', function() {
        active.should.equal(2);
        paused.should.be.at.least(2);
        done();
      });

      rep.catch(done);

      var numChanges = 0;
      rep.on('change', function () {
        if (++numChanges === 3) {
          rep.cancel();
        }
      });

      remote.put({}, 'hazaa');
    });


    it('#2970 should replicate remote database w/ deleted conflicted revs',
        function (done) {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docid = "mydoc";

      function uuid() {
        return PouchDB.utils.uuid(32, 16).toLowerCase();
      }

      // create a bunch of rando, good revisions
      var numRevs = 5;
      var uuids = [];
      for (var i = 0; i < numRevs - 1; i++) {
        uuids.push(uuid());
      }

      // good branch
      // this branch is one revision ahead of the conflicted branch
      var a_conflict = uuid();
      var a_burner = uuid();
      var a_latest = uuid();
      var a_rev_num = numRevs + 2;
      var a_doc = {
        _id: docid,
        _rev: a_rev_num + '-' + a_latest,
        _revisions: {
          start: a_rev_num,
          ids: [ a_latest, a_burner, a_conflict ].concat(uuids)
        }
      };

      // conflicted deleted branch
      var b_conflict = uuid();
      var b_deleted = uuid();
      var b_rev_num = numRevs + 1;
      var b_doc = {
        _id: docid,
        _rev: b_rev_num + '-' + b_deleted,
        _deleted: true,
        _revisions: {
          start: b_rev_num,
          ids: [ b_deleted, b_conflict ].concat(uuids)
        }
      };

      // push the conflicted documents
      return remote.bulkDocs([ a_doc, b_doc ], {
        new_edits: false
      }).then(function () {
        return remote.get(docid, { open_revs: 'all' }).then(function (revs) {
          revs.length.should.equal(2, 'correct number of open revisions');
          revs[0].ok._id.should.equal(docid, 'rev 1, correct document id');
          revs[1].ok._id.should.equal(docid, 'rev 2, correct document id');
          // order of revisions is not specified
          ((
            revs[0].ok._rev === a_doc._rev &&
            revs[1].ok._rev === b_doc._rev) ||
          (
            revs[0].ok._rev === b_doc._rev &&
            revs[1].ok._rev === a_doc._rev)
          ).should.equal(true);
        });
      })

      // attempt to replicate
      .then(function () {
        return local.replicate.from(remote).then(function (result) {
          result.ok.should.equal(true, 'replication result was ok');
          // # of documents is 2 because deleted
          // conflicted revision counts as one
          result.docs_written.should.equal(2,
            'replicated the correct number of documents');
        });
      })

      .then(function () { done(); }, done);
    });


    // test validate_doc_update, which is a reasonable substitute
    // for testing design doc replication of non-admin users, since we
    // always test in admin party
    it('#2268 dont stop replication if single forbidden', function (done) {

      testUtils.isCouchDB(function (isCouchDB) {
        if (adapters[1] !== 'http' || !isCouchDB) {
          return done();
        }

        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo === undefined) {
              throw {forbidden: 'Document must have a foo.'};
            }
          }.toString()
        };

        var remote = new PouchDB(dbs.remote);
        var db = new PouchDB(dbs.name);

        return remote.put(ddoc).then(function () {
          var docs = [{foo: 'bar'}, {foo: 'baz'}, {}, {foo: 'quux'}];
          return db.bulkDocs({docs: docs});
        }).then(function () {
          return db.replicate.to(dbs.remote);
        }).then(function (res) {
          res.ok.should.equal(true);
          res.docs_read.should.equal(4);
          res.docs_written.should.equal(3);
          res.doc_write_failures.should.equal(1);
          res.errors.should.have.length(1);

          return remote.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(4); // 3 plus the validate doc
          return db.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(4); // 3 plus the invalid doc
        }).then(done);
      });
    });

    it('#2268 dont stop replication if single unauth', function (done) {

      testUtils.isCouchDB(function (isCouchDB) {
        if (adapters[1] !== 'http' || !isCouchDB) {
          return done();
        }

        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo === undefined) {
              throw {unauthorized: 'Document must have a foo.'};
            }
          }.toString()
        };

        var remote = new PouchDB(dbs.remote);
        var db = new PouchDB(dbs.name);

        return remote.put(ddoc).then(function () {
          var docs = [{foo: 'bar'}, {foo: 'baz'}, {}, {foo: 'quux'}];
          return db.bulkDocs({docs: docs});
        }).then(function () {
          return db.replicate.to(dbs.remote);
        }).then(function (res) {
          res.ok.should.equal(true);
          res.docs_read.should.equal(4);
          res.docs_written.should.equal(3);
          res.doc_write_failures.should.equal(1);
          res.errors.should.have.length(1);

          return remote.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(4); // 3 plus the validate doc
          return db.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(4); // 3 plus the invalid doc
        }).then(done);
      });
    });

    it('#2268 dont stop replication if many unauth', function (done) {

      testUtils.isCouchDB(function (isCouchDB) {
        if (adapters[1] !== 'http' || !isCouchDB) {
          return done();
        }

        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo === undefined) {
              throw {unauthorized: 'Document must have a foo.'};
            }
          }.toString()
        };

        var remote = new PouchDB(dbs.remote);
        var db = new PouchDB(dbs.name);

        return remote.put(ddoc).then(function () {
          var docs = [{foo: 'bar'}, {foo: 'baz'}, {}, {foo: 'quux'}, {}, {},
                      {foo: 'toto'}, {}];
          return db.bulkDocs({docs: docs});
        }).then(function () {
          return db.replicate.to(dbs.remote);
        }).then(function (res) {
          res.ok.should.equal(true);
          res.docs_read.should.equal(8);
          res.docs_written.should.equal(4);
          res.doc_write_failures.should.equal(4);
          res.errors.should.have.length(4);

          return remote.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(5); // 4 plus the validate doc
          return db.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(8); // 4 valid and 4 invalid
        }).then(done);
      });
    });

    // Errors from validate_doc_update should have the message
    // defined in PourchDB.Errors instead of the thrown value.
    it('#3171 Forbidden validate_doc_update error message',
        function (done) {
      testUtils.isCouchDB(function (isCouchDB) {
        if (adapters[1] !== 'http' || !isCouchDB) {
          return done();
        }

        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo === 'object') {
              throw { forbidden: { foo: 'is object' } };
            } else if (newDoc.foo === 'string') {
              throw { forbidden: 'Document foo is string' };
            }
          }.toString()
        };

        var remote = new PouchDB(dbs.remote);
        var db = new PouchDB(dbs.name);

        return remote.put(ddoc).then(function () {
          var docs = [{foo: 'string'}, {}, {foo: 'object'}];
          return db.bulkDocs({docs: docs});
        }).then(function () {
          return db.replicate.to(dbs.remote);
        }).then(function (res) {
          res.ok.should.equal(true);
          res.docs_read.should.equal(3);
          res.docs_written.should.equal(1);
          res.doc_write_failures.should.equal(2);
          res.errors.should.have.length(2);
          res.errors.forEach(function (e) {
            e.status.should.equal(PouchDB.Errors.FORBIDDEN.status,
                                  'correct error status returned');
            e.name.should.equal(PouchDB.Errors.FORBIDDEN.name,
                                'correct error name returned');
            e.message.should.equal(PouchDB.Errors.FORBIDDEN.message,
                                   'correct error message returned');
          });

          return remote.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(2); // 1 plus the validate doc
          return db.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(3); // 1 valid and 2 invalid
        }).then(done);
      });
    });

    it('#3171 Unauthorized validate_doc_update error message',
        function (done) {
      testUtils.isCouchDB(function (isCouchDB) {
        if (adapters[1] !== 'http' || !isCouchDB) {
          return done();
        }

        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo === 'object') {
              throw { unauthorized: { foo: 'is object' } };
            } else if (newDoc.foo === 'string') {
              throw { unauthorized: 'Document foo is string' };
            }
          }.toString()
        };

        var remote = new PouchDB(dbs.remote);
        var db = new PouchDB(dbs.name);

        return remote.put(ddoc).then(function () {
          var docs = [{foo: 'string'}, {}, {foo: 'object'}];
          return db.bulkDocs({docs: docs});
        }).then(function () {
          return db.replicate.to(dbs.remote);
        }).then(function (res) {
          res.ok.should.equal(true);
          res.docs_read.should.equal(3);
          res.docs_written.should.equal(1);
          res.doc_write_failures.should.equal(2);
          res.errors.should.have.length(2);
          res.errors.forEach(function (e) {
            e.status.should.equal(PouchDB.Errors.UNAUTHORIZED.status,
                                  'correct error status returned');
            e.name.should.equal(PouchDB.Errors.UNAUTHORIZED.name,
                                'correct error name returned');
            e.message.should.equal(PouchDB.Errors.UNAUTHORIZED.message,
                                   'correct error message returned');
          });

          return remote.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(2); // 1 plus the validate doc
          return db.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(3); // 1 valid and 2 invalid
        }).then(done);
      });
    });

    it('#3070 Doc IDs with validate_doc_update errors',
        function (done) {
      testUtils.isCouchDB(function (isCouchDB) {
        if (adapters[1] !== 'http' || !isCouchDB) {
          return done();
        }

        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo) {
              throw { unauthorized: 'go away, no picture' };
            }
          }.toString()
        };

        var remote = new PouchDB(dbs.remote);
        var db = new PouchDB(dbs.name);

        return remote.put(ddoc).then(function () {
          var docs = [{foo: 'string'}, {}, {foo: 'object'}];
          return db.bulkDocs({docs: docs});
        }).then(function () {
          return db.replicate.to(dbs.remote);
        }).then(function (res) {
          var ids = [];
          res.ok.should.equal(true);
          res.docs_read.should.equal(3);
          res.docs_written.should.equal(1);
          res.doc_write_failures.should.equal(2);
          res.errors.should.have.length(2);
          res.errors.forEach(function (e) {
            should.exist(e.id, 'get doc id with error message');
            ids.push(e.id);
          });
          ids = ids.filter(function (id) {
            return ids.indexOf(id) === ids.lastIndexOf(id);
          });
          ids.length.should.equal(res.errors.length,
                                  'doc ids are unique');
          return remote.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(2); // 1 plus the validate doc
          return db.allDocs({limit: 0});
        }).then(function (res) {
          res.total_rows.should.equal(3); // 1 valid and 2 invalid
        }).then(done);
      });
    });

    it('#3270 triggers "denied" events', function (done) {
      testUtils.isCouchDB(function (isCouchDB) {
        if (/*adapters[1] !== 'http' || */!isCouchDB) {
          return done();
        }
        if (adapters[0] !== 'local' || adapters[1] !== 'http') {
          return done();
        }

        var deniedErrors = [];
        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo) {
              throw { unauthorized: 'go away, no picture' };
            }
          }.toString()
        };

        var remote = new PouchDB(dbs.remote);
        var db = new PouchDB(dbs.name);

        return remote.put(ddoc).then(function () {
          var docs = [
            {_id: 'foo1', foo: 'string'},
            {_id: 'nofoo'},
            {_id: 'foo2', foo: 'object'}
          ];
          return db.bulkDocs({docs: docs});
        }).then(function () {
          var replication = db.replicate.to(dbs.remote);
          replication.on('denied', function(error) {
            deniedErrors.push(error);
          });
          return replication;
        }).then(function (res) {
          deniedErrors.length.should.equal(2);
          deniedErrors[0].id.should.equal('foo1');
          deniedErrors[0].name.should.equal('unauthorized');
          deniedErrors[1].id.should.equal('foo2');
          deniedErrors[1].name.should.equal('unauthorized');
          done();
        }).catch(done);
      });
    });

    it('#3270 triggers "change" events with .docs property', function(done) {
      var replicatedDocs = [];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, {})
      .then(function(results) {
        var replication = db.replicate.to(dbs.remote);
        replication.on('change', function(change) {
          replicatedDocs = replicatedDocs.concat(change.docs);
        });
        return replication;
      })
      .then(function() {
        replicatedDocs.sort(function (a, b) {
          return a._id > b._id ? 1 : -1;
        });
        replicatedDocs.length.should.equal(3);
        replicatedDocs[0]._id.should.equal('0');
        replicatedDocs[1]._id.should.equal('1');
        replicatedDocs[2]._id.should.equal('2');
        done();
      })
      .catch(done);
    });
  });
});

// This test only needs to run for one configuration, and it slows stuff
// down
downAdapters.map(function (adapter) {

  describe('test.replication.js-down-test', function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('replicate from down server test', function (done) {
      var db = new PouchDB(dbs.name);
      db.replicate.to('http://infiniterequest.com', function (err, changes) {
        should.exist(err);
        done();
      });
    });

  });
});
