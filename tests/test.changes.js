'use strict';
var adapters = [
    'http-1',
    'local-1'
  ];
var testHelpers = {};
function ok(thing, message) {
  (!!thing).should.equal(true, message);
}
function equal(thing1, thing2, message) {
  if (thing1) {
    thing1.should.equal(thing2, message);
  } else {
    should.equal(thing1, thing2, message);
  }
}
function deepEqual(thing1, thing2, message) {
  thing1.should.deep.equal(thing2, message);
}
var strictEqual = equal;
describe('changes', function () {
  adapters.map(function (adapter) {
    describe(adapter, function () {
      beforeEach(function () {
        testHelpers.name = testUtils.generateAdapterUrl(adapter);
        PouchDB.enableAllDbs = false;
      });
      afterEach(testUtils.cleanupTestDatabases);
      it('All changes', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.post({ test: 'somestuff' }, function (err, info) {
            db.changes({
              onChange: function (change) {
                ok(!change.doc, 'If we dont include docs, dont include docs');
                ok(change.seq, 'Received a sequence number');
                done();
              }
            });
          });
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: docs }, function (err, info) {
            db.changes({
              since: 12,
              complete: function (err, results) {
                equal(results.results.length, 2, 'Partial results');
                done();
              }
            });
          });
        });
      });
      it('Changes Since and limit', function (done) {
        var docs = [
          {_id: '0', integer: 0},
          {_id: '1', integer: 1},
          {_id: '2', integer: 2},
          {_id: '3', integer: 3},
        ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: docs }, function (err, info) {
            db.changes({
              since: 2,
              limit: 1,
              complete: function (err, results) {
                equal(results.results.length, 1, 'Partial results');
                done();
              }
            });
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
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
                    strictEqual(results.last_seq, 6, 'correct last_seq');
                    results = results.results;
                    strictEqual(results.length, 2, '2 results');
                    strictEqual(results[0].id, '2', 'correct first id');
                    strictEqual(results[0].seq, 5, 'correct first seq');
                    strictEqual(results[0].doc.integer, 11, 'correct first integer');
                    strictEqual(results[1].id, '3', 'correct second id');
                    strictEqual(results[1].seq, 6, 'correct second seq');
                    strictEqual(results[1].doc.integer, 12, 'correct second integer');
                    done();
                  }
                });
              });
            });
          });
        });
      });
      it('Changes with filter not present in ddoc', function (done) {
        this.timeout(15000);
        var docs = [
            {_id: '1', integer: 1},
            {
              _id: '_design/foo',
              integer: 4,
              filters: { even: 'function (doc) { return doc.integer % 2 === 1; }' }
            }
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, docs, function (err, info) {
            db.changes({
              filter: 'foo/odd',
              limit: 2,
              include_docs: true,
              complete: function (err, results) {
                equal(err.status, 404, 'correct error status');
                equal(err.message, 'missing json key: odd', 'correct error reason');
                equal(results, null, 'correct `results` object returned');
                done();
              }
            });
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
              views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) { emit(doc._id, null) }; }' } }
            }
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, docs, function (err, info) {
            db.changes({
              filter: 'foo/even',
              limit: 2,
              include_docs: true,
              complete: function (err, results) {
                equal(err.status, 404, 'correct error status');
                equal(err.message, 'missing json key: filters', 'correct error reason');
                equal(results, null, 'correct `results` object returned');
                done();
              }
            });
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, docs, function (err, info) {
            db.changes({
              filter: 'foo/even',
              limit: 2,
              since: 2,
              include_docs: true,
              complete: function (err, results) {
                strictEqual(results.results.length, 2, 'correct # results');
                strictEqual(results.results[0].id, '3', 'correct first id');
                strictEqual(results.results[0].seq, 4, 'correct first seq');
                strictEqual(results.results[0].doc.integer, 3, 'correct first integer');
                strictEqual(results.results[1].id, '5', 'correct second id');
                strictEqual(results.results[1].seq, 6, 'correct second seq');
                strictEqual(results.results[1].doc.integer, 5, 'correct second integer');
                done();
              }
            });
          });
        });
      });
      it('Changes with filter from nonexistent ddoc', function (done) {
        var docs = [
            {_id: '0', integer: 0},
            {_id: '1', integer: 1},
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, docs, function (err, info) {
            db.changes({
              filter: 'foobar/odd',
              complete: function (err, results) {
                equal(err.status, 404, 'correct error status');
                equal(err.message, 'missing', 'correct error reason');
                equal(results, null, 'correct `results` object returned');
                done();
              }
            });
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
              views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) { emit(doc._id, null) }; }' } }
            }
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, docs, function (err, info) {
            db.changes({
              filter: '_view',
              view: 'foo/odd',
              complete: function (err, results) {
                equal(err.status, 404, 'correct error status');
                equal(err.message, 'missing json key: odd', 'correct error reason');
                equal(results, null, 'correct `results` object returned');
                done();
              }
            });
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, docs, function (err, info) {
            db.changes({
              filter: '_view',
              view: 'foo/even',
              complete: function (err, results) {
                equal(err.status, 404, 'correct error status');
                equal(err.message, 'missing json key: views', 'correct error reason');
                equal(results, null, 'correct `results` object returned');
                done();
              }
            });
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
              views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) { emit(doc._id, null) }; }' } }
            }
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, docs, function (err, info) {
            db.changes({
              filter: '_view',
              complete: function (err, results) {
                equal(err.status, 400, 'correct error status');
                equal(err.message, '`view` filter parameter is not provided.', 'correct error reason');
                equal(results, null, 'correct `results` object returned');
                done();
              }
            });
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
              views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) { emit(doc._id, null) }; }' } }
            }
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, docs, function (err, info) {
            db.changes({
              filter: '_view',
              view: 'foo/even',
              limit: 2,
              since: 2,
              include_docs: true,
              complete: function (err, results) {
                strictEqual(results.results.length, 2, 'correct # results');
                strictEqual(results.results[0].id, '3', 'correct first id');
                strictEqual(results.results[0].seq, 4, 'correct first seq');
                strictEqual(results.results[0].doc.integer, 3, 'correct first integer');
                strictEqual(results.results[1].id, '5', 'correct second id');
                strictEqual(results.results[1].seq, 6, 'correct second seq');
                strictEqual(results.results[1].doc.integer, 5, 'correct second integer');
                done();
              }
            });
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.changes({
            complete: function (err, results) {
              strictEqual(results.last_seq, 0, 'correct last_seq');
              db.bulkDocs({ docs: docs }, function (err, info) {
                db.changes({
                  complete: function (err, results) {
                    strictEqual(results.last_seq, 5, 'correct last_seq');
                    db.changes({
                      filter: 'foo/even',
                      complete: function (err, results) {
                        strictEqual(results.last_seq, 5, 'filter does not change last_seq');
                        strictEqual(results.results.length, 2, 'correct # of changes');
                        done();
                      }
                    });
                  }
                });
              });
            }
          });
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
              views: { even: { map: 'function (doc) { if (doc.integer % 2 === 1) { emit(doc._id, null) }; }' } }
            }
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.changes({
            complete: function (err, results) {
              strictEqual(results.last_seq, 0, 'correct last_seq');
              db.bulkDocs({ docs: docs }, function (err, info) {
                db.changes({
                  complete: function (err, results) {
                    strictEqual(results.last_seq, 5, 'correct last_seq');
                    db.changes({
                      filter: '_view',
                      view: 'foo/even',
                      complete: function (err, results) {
                        strictEqual(results.last_seq, 5, 'filter does not change last_seq');
                        strictEqual(results.results.length, 2, 'correct # of changes');
                        done();
                      }
                    });
                  }
                });
              });
            }
          });
        });
      });
      it('Changes with style = all_docs', function (done) {
        var simpleTree = [
            [
              {
                _id: 'foo',
                _rev: '1-a',
                value: 'foo a'
              },
              {
                _id: 'foo',
                _rev: '2-b',
                value: 'foo b'
              },
              {
                _id: 'foo',
                _rev: '3-c',
                value: 'foo c'
              }
            ],
            [
              {
                _id: 'foo',
                _rev: '1-a',
                value: 'foo a'
              },
              {
                _id: 'foo',
                _rev: '2-d',
                value: 'foo d'
              },
              {
                _id: 'foo',
                _rev: '3-e',
                value: 'foo e'
              },
              {
                _id: 'foo',
                _rev: '4-f',
                value: 'foo f'
              }
            ],
            [
              {
                _id: 'foo',
                _rev: '1-a',
                value: 'foo a'
              },
              {
                _id: 'foo',
                _rev: '2-g',
                value: 'foo g',
                _deleted: true
              }
            ]
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.putTree(db, simpleTree, function () {
            db.changes({
              complete: function (err, res) {
                strictEqual(res.results[0].changes.length, 1, 'only one el in changes');
                strictEqual(res.results[0].changes[0].rev, '4-f', 'which is winning rev');
                db.changes({
                  style: 'all_docs',
                  complete: function (err, res) {
                    strictEqual(res.results[0].changes.length, 3, 'correct changes size');
                    var changes = res.results[0].changes;
                    changes.sort(function (a, b) {
                      return a.rev < b.rev;
                    });
                    deepEqual(changes[0], { rev: '4-f' }, 'correct rev');
                    deepEqual(changes[1], { rev: '3-c' }, 'correct rev');
                    deepEqual(changes[2], { rev: '2-g' }, 'correct rev');
                    done();
                  }
                });
              }
            });
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: docs }, function (err, info) {
            db.changes({
              limit: 0,
              complete: function (err, results) {
                equal(results.results.length, 1, 'Partial results');
                done();
              }
            });
          });
        });
      });
      // Note for the following test that CouchDB's implementation of /_changes
      // with `descending=true` ignores any `since` parameter.
      it('Descending changes', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.post({
            _id: '0',
            test: 'ing'
          }, function (err, res) {
            db.post({
              _id: '1',
              test: 'ing'
            }, function (err, res) {
              db.post({
                _id: '2',
                test: 'ing'
              }, function (err, res) {
                db.changes({
                  descending: true,
                  since: 1,
                  complete: function (err, results) {
                    equal(results.results.length, 3);
                    var ids = [
                        '2',
                        '1',
                        '0'
                      ];
                    results.results.forEach(function (row, i) {
                      equal(row.id, ids[i], 'All results, descending order');
                    });
                    done();
                  }
                });
              });
            });
          });
        });
      });
      it('Changes doc', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.post({ test: 'somestuff' }, function (err, info) {
            db.changes({
              include_docs: true,
              onChange: function (change) {
                ok(change.doc);
                equal(change.doc._id, change.id);
                equal(change.doc._rev, change.changes[change.changes.length - 1].rev);
                done();
              }
            });
          });
        });
      });
      // Note for the following test that CouchDB's implementation of /_changes
      // with `descending=true` ignores any `since` parameter.
      it('Descending many changes', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          if (err) {
            return done(err);
          }
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
      });
      it('Continuous changes', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var count = 0;
          var changes = db.changes({
              onChange: function (change) {
                count += 1;
                ok(!change.doc, 'If we dont include docs, dont include docs');
                equal(count, 1, 'Only receive a single change');
                changes.cancel();
                done();
              },
              continuous: true
            });
          db.post({ test: 'adoc' });
        });
      });
      it('Multiple watchers', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var count = 0;
          function checkCount() {
            equal(count, 2, 'Should have received exactly one change per listener');
            done();
          }
          var changes1 = db.changes({
              onChange: function (change) {
                count += 1;
                changes1.cancel();
                changes1 = null;
                if (!changes2) {
                  checkCount();
                }
              },
              continuous: true
            });
          var changes2 = db.changes({
              onChange: function (change) {
                count += 1;
                changes2.cancel();
                changes2 = null;
                if (!changes1) {
                  checkCount();
                }
              },
              continuous: true
            });
          db.post({ test: 'adoc' });
        });
      });
      // if (is_browser) {
      //   it("Continuous changes across windows", function (done) {
      //     var search = window.location.search
      //       .replace(/[?&]testFiles=[^&]+/, '')
      //       .replace(/[?&]testNumber=[^&]+/, '')
      //       .replace(/[?&]dbname=[^&]+/, '') +
      //         '&testFiles=postTest.js&dbname=' + encodeURIComponent(testHelpers.name);
      //     testUtils.initTestDB(testHelpers.name, function (err, db) {
      //       var count = 0;
      //       var tab;
      //       var changes = db.changes({
      //         onChange: function (change) {
      //           count += 1;
      //           equal(count, 1, 'Received a single change');
      //           changes.cancel();
      //           if (tab) {
      //             tab.close();
      //           }
      //           done();
      //         },
      //         continuous: true
      //       });
      //       var iframe = document.createElement('iframe');
      //       iframe.src = 'test.html?' + search.replace(/^[?&]+/, '');
      //       iframe.style.display = 'none';
      //       document.body.appendChild(iframe);
      //     });
      //   });
      // }
      it('Continuous changes doc', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var changes = db.changes({
              onChange: function (change) {
                ok(change.doc, 'doc included');
                ok(change.doc._rev, 'rev included');
                changes.cancel();
                done();
              },
              continuous: true,
              include_docs: true
            });
          db.post({ test: 'adoc' });
        });
      });
      it('Cancel changes', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var count = 0;
          var changes = db.changes({
              onChange: function (change) {
                count += 1;
                if (count === 1) {
                  changes.cancel();
                  db.post({ test: 'another doc' }, function (err, info) {
                    // This setTimeout ensures that once we cancel a change we dont recieve
                    // subsequent callbacks, so it is needed
                    setTimeout(function () {
                      equal(count, 1);
                      done();
                    }, 200);
                  });
                }
              },
              continuous: true
            });
          db.post({ test: 'adoc' });
        });
      });
      it('Kill database while listening to continuous changes', function (done) {
        var name = testHelpers.name;
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var count = 0;
          var changes = db.changes({
              onChange: function (change) {
                count += 1;
                if (count === 1) {
                  PouchDB.destroy(name, function (err, resp) {
                    changes.cancel();
                    ok(true);
                    done();
                  });
                }
              },
              continuous: true
            });
          db.post({ test: 'adoc' });
        });
      });
      it('Changes filter', function (done) {
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var count = 0;
          db.bulkDocs({ docs: docs1 }, function (err, info) {
            var changes = db.changes({
                filter: function (doc) {
                  return doc.integer % 2 === 0;
                },
                onChange: function (change) {
                  count += 1;
                  if (count === 4) {
                    ok(true, 'We got all the docs');
                    changes.cancel();
                    done();
                  }
                },
                continuous: true
              });
            db.bulkDocs({ docs: docs2 });
          });
        });
      });
      it('Changes filter with query params', function (done) {
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var count = 0;
          db.bulkDocs({ docs: docs1 }, function (err, info) {
            var changes = db.changes({
                filter: function (doc, req) {
                  if (req.query.abc) {
                    return doc.integer % 2 === 0;
                  }
                },
                query_params: params,
                onChange: function (change) {
                  count += 1;
                  if (count === 4) {
                    ok(true, 'We got all the docs');
                    changes.cancel();
                    done();
                  }
                },
                continuous: true
              });
            db.bulkDocs({ docs: docs2 });
          });
        });
      });
      it('Non-continuous changes filter', function (done) {
        var docs1 = [
            {_id: '0', integer: 0},
            {_id: '1', integer: 1},
            {_id: '2', integer: 2},
            {_id: '3', integer: 3},
          ];
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: docs1 }, function (err, info) {
            db.changes({
              filter: function (doc) {
                return doc.integer % 2 === 0;
              },
              complete: function (err, changes) {
                // Should get docs 0 and 2 if the filter has been applied correctly.
                equal(changes.results.length, 2, 'should only get 2 changes');
                done();
              }
            });
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: docs1 }, function (err, info) {
            docs2[0]._rev = info[2].rev;
            docs2[1]._rev = info[3].rev;
            db.put(docs2[0], function (err, info) {
              db.put(docs2[1], function (err, info) {
                db.changes({
                  include_docs: true,
                  complete: function (err, changes) {
                    ok(changes, 'got changes');
                    ok(changes.results, 'changes has results array');
                    equal(changes.results.length, 4, 'should get only 4 changes');
                    equal(changes.results[2].seq, 5, 'results have sequence number');
                    equal(changes.results[2].id, '2');
                    equal(changes.results[2].changes.length, 1, 'Should include the current revision for a doc');
                    equal(changes.results[2].doc.integer, 11, 'Includes correct revision of the doc');
                    done();
                  }
                });
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
        var localname = testHelpers.name;
        var remotename = testHelpers.name + '-remote';
        testUtils.initDBPair(localname, remotename, function (localdb, remotedb) {
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
                              ok(changes, 'got changes');
                              ok(changes.results, 'changes has results array');
                              equal(changes.results.length, 4, 'should get only 4 changes');
                              var ch = changes.results[3];
                              equal(ch.id, '3');
                              equal(ch.changes.length, 2, 'Should include both conflicting revisions');
                              equal(ch.doc.integer, 30, 'Includes correct value of the doc');
                              equal(ch.doc._rev, rev4local, 'Includes correct revision of the doc');
                              deepEqual(ch.changes, [
                                { rev: rev4local },
                                { rev: remoterev }
                              ], 'Includes correct changes array');
                              ok(ch.doc._conflicts, 'Includes conflicts');
                              equal(ch.doc._conflicts.length, 1, 'Should have 1 conflict');
                              equal(ch.doc._conflicts[0], remoterev, 'Conflict should be remote rev');
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: docs1 }, function (err, info) {
            var rev = info[3].rev;
            db.remove({
              _id: '3',
              _rev: rev
            }, function (err, info) {
              db.changes({
                include_docs: true,
                complete: function (err, changes) {
                  ok(changes, 'got Changes');
                  equal(changes.results.length, 4, 'should get only 4 changes');
                  var ch = changes.results[3];
                  equal(ch.id, '3', 'Have correct doc');
                  equal(ch.seq, 5, 'Have correct sequence');
                  equal(ch.deleted, true, 'Shows doc as deleted');
                  done();
                }
              });
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
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: docs }, function (err, info) {
            db.changes({
              complete: function (err, res) {
                equal(res.results.length, num, 'Replication with deleted docs');
                done();
              }
            });
          });
        });
      });
      it('Calling db.changes({since: \'latest\'})', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: [{ foo: 'bar' }] }, function (err, data) {
            ok(!err, 'bulkDocs passed');
            db.info(function (err, info) {
              var api = db.changes({
                  since: 'latest',
                  complete: function (err, res) {
                    ok(!err, 'completed db.changes({since: \'latest\'}): ' + JSON.stringify(res));
                    equal(res.last_seq, info.update_seq, 'db.changes({since: \'latest\'}) listens since update_seq');
                    done();
                  }
                });
              equal(typeof api, 'object', 'db.changes({since: \'latest\'}) returns object');
              equal(typeof api.cancel, 'function', 'db.changes({since: \'latest\'}) returns object with cancel function');
            });
          });
        });
      });
      it('Changes reports errors', function (done) {
        this.timeout(20000);
        var db = new PouchDB('http://infiniterequest.com', { skipSetup: true });
        db.changes({
          timeout: 10000,
          complete: function (err, changes) {
            ok(err, 'got error');
            done();
          }
        });
      });
      it('Closing db does not cause a crash if changes cancelled', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({ docs: [{ foo: 'bar' }] }, function (err, data) {
            ok(!err, 'bulked ok');
            var changes = db.changes({
                continuous: true,
                onChange: function () {
                }
              });
            changes.cancel();
            db.close(function (error) {
              ok(!error, 'closed ok');
              done();
            });
          });
        });
      });
    });
  });
});