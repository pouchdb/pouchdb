
'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {

  describe('test.changes.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_changes');
      dbs.remote = testUtils.adapterUrl(adapter, 'test_changes_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('All changes', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        var promise = db.changes({
          onChange: function (change) {
            change.should.not.have.property('doc');
            change.should.have.property('seq');
            done();
          }
        });
        should.exist(promise);
        promise.cancel.should.be.a('function');
      });
    });

    it('Changes Since', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {_id: '6', integer: 6},
        {_id: '7', integer: 7},
        {_id: '8', integer: 9},
        {_id: '9', integer: 9},
        {_id: '10', integer: 10},
        {_id: '11', integer: 11},
        {_id: '12', integer: 12},
        {_id: '13', integer: 13}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, function (err, info) {
        var promise = db.changes({
          since: 12,
          complete: function (err, results) {
            results.results.length.should.equal(2);
            done();
          }
        });
        should.exist(promise);
        promise.cancel.should.be.a('function');
      });
    });

    it('Changes Since and limit', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, function (err, info) {
        db.changes({
          since: 2,
          limit: 1,
          complete: function (err, results) {
            results.results.length.should.equal(1);
            done();
          }
        });
      });
    });

    it('Changes limit', function (done) {
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
      var db = new PouchDB(dbs.name);
      // we use writeDocs since bulkDocs looks to have undefined
      // order of doing insertions
      testUtils.writeDocs(db, docs1, function (err, info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;
        db.put(docs2[0], function (err, info) {
          db.put(docs2[1], function (err, info) {
            db.changes({
              limit: 2,
              since: 2,
              include_docs: true,
              complete: function (err, results) {
                results.last_seq.should.equal(6);
                results = results.results;
                results.length.should.equal(2);
                results[0].id.should.equal('2');
                results[0].seq.should.equal(5);
                results[0].doc.integer.should.equal(11);
                results[1].id.should.equal('3');
                results[1].seq.should.equal(6);
                results[1].doc.integer.should.equal(12);
                done();
              }
            });
          });
        });
      });
    });

    it('Changes with filter not present in ddoc', function (done) {
      this.timeout(15000);
      var docs = [
        {_id: '1', integer: 1},
        { _id: '_design/foo',
          integer: 4,
          filters: { even: 'function (doc) { return doc.integer % 2 === 1; }' }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function (err, info) {
        db.changes({
          filter: 'foo/odd',
          limit: 2,
          include_docs: true,
          complete: function (err, results) {
            err.status.should.equal(404);
            err.message.should.equal('missing json key: odd');
            should.not.exist(results);
            done();
          }
        });
      });
    });

    it('Changes with `filters` key not present in ddoc', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {
          _id: '_design/foo',
          integer: 4,
          views: {
            even: {
              map: 'function (doc) { if (doc.integer % 2 === 1)' +
               ' { emit(doc._id, null) }; }'
            }
          }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function (err, info) {
        db.changes({
          filter: 'foo/even',
          limit: 2,
          include_docs: true,
          complete: function (err, results) {
            err.status.should.equal(404);
            err.message.should.equal('missing json key: filters');
            should.not.exist(results);
            done();
          }
        });
      });
    });

    it('Changes limit and filter', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {
          _id: '_design/foo',
          integer: 4,
          filters: { even: 'function (doc) { return doc.integer % 2 === 1; }' }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function (err, info) {
        var promise = db.changes({
          filter: 'foo/even',
          limit: 2,
          since: 2,
          include_docs: true,
          complete: function (err, results) {
            results.results.length.should.equal(2);
            results.results[0].id.should.equal('3');
            results.results[0].seq.should.equal(4);
            results.results[0].doc.integer.should.equal(3);
            results.results[1].id.should.equal('5');
            results.results[1].seq.should.equal(6);
            results.results[1].doc.integer.should.equal(5);
            done();
          }
        });
        should.exist(promise);
        promise.cancel.should.be.a('function');
      });
    });

    it('Changes with filter from nonexistent ddoc', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function (err, info) {
        db.changes({
          filter: 'foobar/odd',
          complete: function (err, results) {
            err.status.should.equal(404);
            err.message.should.equal('missing');
            should.not.exist(results);
            done();
          }
        });
      });
    });

    it('Changes with view not present in ddoc', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {
          _id: '_design/foo',
          integer: 4,
          views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) { ' +
                           'emit(doc._id, null) }; }' } }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function (err, info) {
        db.changes({
          filter: '_view',
          view: 'foo/odd',
          complete: function (err, results) {
            err.status.should.equal(404);
            err.message.should.equal('missing json key: odd');
            should.not.exist(results);
            done();
          }
        });
      });
    });

    it('Changes with `views` key not present in ddoc', function (done) {
      var docs = [
        {_id: '1', integer: 1},
        {
          _id: '_design/foo',
          integer: 4,
          filters: { even: 'function (doc) { return doc.integer % 2 === 1; }' }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function (err, info) {
        db.changes({
          filter: '_view',
          view: 'foo/even',
          complete: function (err, results) {
            err.status.should.equal(404);
            err.message.should.equal('missing json key: views');
            should.not.exist(results);
            done();
          }
        });
      });
    });

    it('Changes with missing param `view` in request', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {
          _id: '_design/foo',
          integer: 4,
          views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) ' +
                           '{ emit(doc._id, null) }; }' } }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function (err, info) {
        db.changes({
          filter: '_view',
          complete: function (err, results) {
            err.status.should.equal(400);
            err.message.should.equal('`view` filter parameter is not provided.');
            should.not.exist(results);
            done();
          }
        });
      });
    });

    it('Changes limit and view instead of filter', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {
          _id: '_design/foo',
          integer: 4,
          views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) ' +
                           '{ emit(doc._id, null) }; }' } }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function (err, info) {
        db.changes({
          filter: '_view',
          view: 'foo/even',
          limit: 2,
          since: 2,
          include_docs: true,
          complete: function (err, results) {
            results.results.length.should.equal(2);
            results.results[0].id.should.equal('3');
            results.results[0].seq.should.equal(4);
            results.results[0].doc.integer.should.equal(3);
            results.results[1].id.should.equal('5');
            results.results[1].seq.should.equal(6);
            results.results[1].doc.integer.should.equal(5);
            done();
          }
        });
      });
    });


    it('Changes last_seq', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
        {
          _id: '_design/foo',
          integer: 4,
          filters: { even: 'function (doc) { return doc.integer % 2 === 1; }' }
        }
      ];
      var db = new PouchDB(dbs.name);
      db.changes({
        complete: function (err, results) {
          results.last_seq.should.equal(0);
          db.bulkDocs({ docs: docs }, function (err, info) {
            db.changes({
              complete: function (err, results) {
                results.last_seq.should.equal(5);
                db.changes({
                  filter: 'foo/even',
                  complete: function (err, results) {
                    results.last_seq.should.equal(5);
                    results.results.length.should.equal(2);
                    done();
                  }
                });
              }
            });
          });
        }
      });
    });

    it('Changes last_seq with view instead of filter', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
        {
          _id: '_design/foo',
          integer: 4,
          views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) { ' +
                           'emit(doc._id, null) }; }' } }
        }
      ];
      var db = new PouchDB(dbs.name);
      db.changes({
        complete: function (err, results) {
          results.last_seq.should.equal(0);
          db.bulkDocs({ docs: docs }, function (err, info) {
            db.changes({
              complete: function (err, results) {
                results.last_seq.should.equal(5);
                db.changes({
                  filter: '_view',
                  view: 'foo/even',
                  complete: function (err, results) {
                    results.last_seq.should.equal(5);
                    results.results.length.should.equal(2);
                    done();
                  }
                });
              }
            });
          });
        }
      });
    });

    it('Changes with style = all_docs', function (done) {
      var simpleTree = [
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-b', value: 'foo b'},
         {_id: 'foo', _rev: '3-c', value: 'foo c'}],
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-d', value: 'foo d'},
         {_id: 'foo', _rev: '3-e', value: 'foo e'},
         {_id: 'foo', _rev: '4-f', value: 'foo f'}],
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-g', value: 'foo g', _deleted: true}]
      ];
      var db = new PouchDB(dbs.name);
      testUtils.putTree(db, simpleTree, function () {
        db.changes({
          complete: function (err, res) {
            res.results[0].changes.length.should.equal(1);
            res.results[0].changes[0].rev.should.equal('4-f');
            db.changes({
              style: 'all_docs',
              complete: function (err, res) {
                res.results[0].changes.length.should.equal(3);
                var changes = res.results[0].changes;
                changes.sort(function (a, b) {
                  return a.rev < b.rev;
                });
                changes[0].rev.should.equal('4-f');
                changes[1].rev.should.equal('3-c');
                changes[2].rev.should.equal('2-g');
                done();
              }
            });
          }
        });
      });
    });

    it('Changes limit = 0', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, function (err, info) {
        db.changes({
          limit: 0,
          complete: function (err, results) {
            results.results.length.should.equal(1);
            done();
          }
        });
      });
    });

    // Note for the following test that CouchDB's implementation of /_changes
    // with `descending=true` ignores any `since` parameter.
    it('Descending changes', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({_id: '0', test: 'ing'}, function (err, res) {
        db.post({_id: '1', test: 'ing'}, function (err, res) {
          db.post({_id: '2', test: 'ing'}, function (err, res) {
            db.changes({
              descending: true,
              since: 1,
              complete: function (err, results) {
                results.results.length.should.equal(3);
                var ids = ['2', '1', '0'];
                results.results.forEach(function (row, i) {
                  row.id.should.equal(ids[i]);
                });
                done();
              }
            });
          });
        });
      });
    });

    it('Changes doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        db.changes({
          include_docs: true,
          onChange: function (change) {
            change.doc._id.should.equal(change.id);
            change.doc._rev.should
              .equal(change.changes[change.changes.length - 1].rev);
            done();
          }
        });
      });
    });

    // Note for the following test that CouchDB's implementation of /_changes
    // with `descending=true` ignores any `since` parameter.
    it('Descending many changes', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [];
      var num = 100;
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      var changes = 0;
      db.bulkDocs({ docs: docs }, function (err, info) {
        if (err) {
          return done(err);
        }
        db.changes({
          descending: true,
          onChange: function (change) {
            changes++;
          },
          complete: function (err, results) {
            if (err) {
              return done(err);
            }
            changes.should.equal(num, 'correct number of changes');
            done();
          }
        });
      });
    });

    it('live-changes', function (done) {
      var db = new PouchDB(dbs.name);
      var count = 0;
      var changes = db.changes({
        complete: function () {
          count.should.equal(1);
          done();
        },
        onChange: function (change) {
          count += 1;
          change.should.not.have.property('doc');
          count.should.equal(1);
          changes.cancel();
        },
        live: true
      });
      db.post({ test: 'adoc' });
    });

    it('Multiple watchers', function (done) {
      var db = new PouchDB(dbs.name);
      var count = 0;
      var changes1Complete = false;
      var changes2Complete = false;
      function checkCount() {
        if (changes1Complete && changes2Complete) {
          count.should.equal(2);
          done();
        }
      }
      var changes1 = db.changes({
        complete: function () {
          changes1Complete = true;
          checkCount();
        },
        onChange: function (change) {
          count += 1;
          changes1.cancel();
          changes1 = null;
        },
        live: true
      });
      var changes2 = db.changes({
        complete: function () {
          changes2Complete = true;
          checkCount();
        },
        onChange: function (change) {
          count += 1;
          changes2.cancel();
          changes2 = null;
        },
        live: true
      });
      db.post({test: 'adoc'});
    });

    it('Continuous changes doc', function (done) {
      var db = new PouchDB(dbs.name);
      var changes = db.changes({
        complete: function (err, result) {
          result.status.should.equal('cancelled');
          done();
        },
        onChange: function (change) {
          change.should.have.property('doc');
          change.doc.should.have.property('_rev');
          changes.cancel();
        },
        live: true,
        include_docs: true
      });
      db.post({ test: 'adoc' });
    });

    it('Cancel changes', function (done) {
      var db = new PouchDB(dbs.name);
      var count = 0;
      var interval;
      var docPosted = false;

      // We want to wait for a period of time after the final
      // document was posted to ensure we didnt see another
      // change
      function waitForDocPosted() {
        if (!docPosted) {
          return;
        }
        clearInterval(interval);
        setTimeout(function () {
          count.should.equal(1);
          done();
        }, 200);
      }

      var changes = db.changes({
        complete: function (err, result) {
          result.status.should.equal('cancelled');
          // This setTimeout ensures that once we cancel a change we dont recieve
          // subsequent callbacks, so it is needed
          interval = setInterval(waitForDocPosted, 100);
        },
        onChange: function (change) {
          count += 1;
          if (count === 1) {
            changes.cancel();
            db.post({ test: 'another doc' }, function (err, res) {
              if (err) {
                return done(err);
              }
              docPosted = true;
            });
          }
        },
        live: true
      });
      db.post({ test: 'adoc' });
    });

    // TODO: https://github.com/daleharvey/pouchdb/issues/1460
    it.skip('Kill database while listening to live changes', function (done) {
      var db = new PouchDB(dbs.name);
      var count = 0;
      db.changes({
        complete: function (err, result) {
          done();
        },
        onChange: function (change) {
          count += 1;
          if (count === 1) {
            PouchDB.destroy(dbs.name);
          }
        },
        live: true
      });
      db.post({ test: 'adoc' });
    });

    it('changes-filter', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
      ];
      var docs2 = [
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {_id: '6', integer: 6},
        {_id: '7', integer: 7},
      ];
      var db = new PouchDB(dbs.name);
      var count = 0;
      db.bulkDocs({ docs: docs1 }, function (err, info) {
        var changes = db.changes({
          complete: function (err, result) {
            result.status.should.equal('cancelled');
            done();
          },
          filter: function (doc) {
            return doc.integer % 2 === 0;
          },
          onChange: function (change) {
            count += 1;
            if (count === 4) {
              changes.cancel();
            }
          },
          live: true
        });
        db.bulkDocs({ docs: docs2 });
      });
    });

    it('changes-filter with query params', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
      ];
      var docs2 = [
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {_id: '6', integer: 6},
        {_id: '7', integer: 7},
      ];
      var params = { 'abc': true };
      var db = new PouchDB(dbs.name);
      var count = 0;
      db.bulkDocs({ docs: docs1 }, function (err, info) {
        var changes = db.changes({
          complete: function (err, result) {
            result.status.should.equal('cancelled');
            done();
          },
          filter: function (doc, req) {
            if (req.query.abc) {
              return doc.integer % 2 === 0;
            }
          },
          query_params: params,
          onChange: function (change) {
            count += 1;
            if (count === 4) {
              changes.cancel();
            }
          },
          live: true
        });
        db.bulkDocs({ docs: docs2 });
      });
    });

    it('Non-live changes filter', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function (err, info) {
        db.changes({
          filter: function (doc) {
            return doc.integer % 2 === 0;
          },
          complete: function (err, changes) {
            // Should get docs 0 and 2 if the filter has been applied correctly.
            changes.results.length.should.equal(2);
            done();
          }
        });
      });
    });

    it('Changes to same doc are grouped', function (done) {
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
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function (err, info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;
        db.put(docs2[0], function (err, info) {
          db.put(docs2[1], function (err, info) {
            db.changes({
              include_docs: true,
              complete: function (err, changes) {
                changes.results.length.should.equal(4);
                changes.results[2].seq.should.equal(5);
                changes.results[2].id.should.equal('2');
                changes.results[2].changes.length.should.equal(1);
                changes.results[2].doc.integer.should.equal(11);
                done();
              }
            });
          });
        });
      });
    });

    it('Changes with conflicts are handled correctly', function (testDone) {
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

      new PouchDB(dbs.name, function (err, localdb) {
        var remotedb = new PouchDB(dbs.remote);
        localdb.bulkDocs({ docs: docs1 }, function (err, info) {
          docs2[0]._rev = info[2].rev;
          docs2[1]._rev = info[3].rev;
          localdb.put(docs2[0], function (err, info) {
            localdb.put(docs2[1], function (err, info) {
              var rev2 = info.rev;
              PouchDB.replicate(localdb, remotedb, function (err, done) {
                // update remote once, local twice, then replicate from
                // remote to local so the remote losing conflict is later in the tree
                localdb.put({
                  _id: '3',
                  _rev: rev2,
                  integer: 20
                }, function (err, resp) {
                  var rev3Doc = {
                    _id: '3',
                    _rev: resp.rev,
                    integer: 30
                  };
                  localdb.put(rev3Doc, function (err, resp) {
                    var rev4local = resp.rev;
                    var rev4Doc = {
                      _id: '3',
                      _rev: rev2,
                      integer: 100
                    };
                    remotedb.put(rev4Doc, function (err, resp) {
                      var remoterev = resp.rev;
                      PouchDB.replicate(remotedb, localdb, function (err, done) {
                        localdb.changes({
                          include_docs: true,
                          style: 'all_docs',
                          conflicts: true,
                          complete: function (err, changes) {
                            changes.results.length.should.equal(4);
                            var ch = changes.results[3];
                            ch.id.should.equal('3');
                            ch.changes.length.should.equal(2);
                            ch.doc.integer.should.equal(30);
                            ch.doc._rev.should.equal(rev4local);
                            ch.changes.should.deep.equal([
                              { rev: rev4local },
                              { rev: remoterev }
                            ]);
                            ch.doc.should.have.property('_conflicts');
                            ch.doc._conflicts.length.should.equal(1);
                            ch.doc._conflicts[0].should.equal(remoterev);
                            testDone();
                          }
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

    it('Change entry for a deleted doc', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function (err, info) {
        var rev = info[3].rev;
        db.remove({
          _id: '3',
          _rev: rev
        }, function (err, info) {
          db.changes({
            include_docs: true,
            complete: function (err, changes) {
              changes.results.length.should.equal(4);
              var ch = changes.results[3];
              ch.id.should.equal('3');
              ch.seq.should.equal(5);
              ch.deleted.should.equal(true);
              done();
            }
          });
        });
      });
    });

    it('changes large number of docs', function (done) {
      var docs = [];
      var num = 30;
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, function (err, info) {
        db.changes({
          complete: function (err, res) {
            res.results.length.should.equal(num);
            done();
          }
        });
      });
    });

    it('Calling db.changes({since: \'latest\'})', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: [{ foo: 'bar' }] }, function (err, data) {
        db.info(function (err, info) {
          var api = db.changes({
            since: 'latest',
            complete: function (err, res) {
              should.not.exist(err);
              res.last_seq.should.equal(info.update_seq);
              done();
            }
          });
          api.should.be.an('object');
          api.cancel.should.be.an('function');
        });
      });
    });

    it('Closing db does not cause a crash if changes cancelled', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: [{ foo: 'bar' }] }, function (err, data) {
        var changes = db.changes({
          live: true,
          onChange: function () { },
          complete: function (err, result) {
            result.status.should.equal('cancelled');
            done();
          }
        });
        should.exist(changes);
        changes.cancel.should.be.a('function');
        changes.cancel();
        db.close(function (error) {
          should.not.exist(error);
        });
      });
    });

    it('fire-complete-on-cancel', function (done) {
      var db = new PouchDB(dbs.name);
      var cancelled = false;
      var changes = db.changes({
        live: true,
        complete: function (err, result) {
          cancelled.should.equal(true);
          should.not.exist(err);
          should.exist(result);
          if (result) {
            result.status.should.equal('cancelled');
          }
          done();
        }
      });
      should.exist(changes);
      changes.cancel.should.be.a('function');
      setTimeout(function () {
        cancelled = true;
        changes.cancel();
      }, 100);
    });

    it('changes are not duplicated', function (done) {
      var db = new PouchDB(dbs.name);
      var called = 0;
      var changes = db.changes({
        live: true,
        onChange: function () {
          called++;
          if (called === 1) {
            setTimeout(function () {
              changes.cancel();
            }, 1000);
          }
        },
        complete: function (err) {
          called.should.equal(1);
          done();
        }
      });
      db.post({key: 'value'});
    });

  });
});

describe('changes-standalone', function () {

  it('Changes reports errors', function (done) {
    this.timeout(2000);
    var db = new PouchDB('http://infiniterequest.com', { skipSetup: true });
    db.changes({
      timeout: 1000,
      complete: function (err, changes) {
        should.exist(err);
        done();
      }
    });
  });

});
