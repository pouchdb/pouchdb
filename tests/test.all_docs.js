'use strict';
var adapters = [
    'http-1',
    'local-1'
  ];
var testHelpers = {};
describe('all_docs', function () {
  adapters.map(function (adapter) {
    describe(adapter, function () {
      beforeEach(function () {
        testHelpers.name = testUtils.generateAdapterUrl(adapter);
        PouchDB.enableAllDbs = true;
      });
      afterEach(testUtils.cleanupTestDatabases);
      var origDocs = [
          {
            _id: '0',
            a: 1,
            b: 1
          },
          {
            _id: '3',
            a: 4,
            b: 16
          },
          {
            _id: '1',
            a: 2,
            b: 4
          },
          {
            _id: '2',
            a: 3,
            b: 9
          }
        ];
      it('Testing all docs', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
            db.allDocs(function (err, result) {
              var rows = result.rows;
              result.total_rows.should.equal(4, 'correct number of results');
              for (var i = 0; i < rows.length; i++) {
                rows[i].id.should.be.at.least('0');
                rows[i].id.should.be.at.most('4');
              }
              db.allDocs({
                startkey: '2',
                include_docs: true
              }, function (err, all) {
                all.rows.should.have.length(2, 'correct number when opts.startkey set');
                all.rows[0].id.should.equal('2', 'correct docs when opts.startkey set');
                // TODO: implement offset
                //ok(all.offset == 2, 'offset correctly set');
                var opts = {
                    startkey: 'org.couchdb.user:',
                    endkey: 'org.couchdb.user;'
                  };
                db.allDocs(opts, function (err, raw) {
                  raw.rows.should.have.length(0, 'raw collation');
                  var ids = [
                      '0',
                      '3',
                      '1',
                      '2'
                    ];
                  db.changes({
                    complete: function (err, changes) {
                      changes.results.forEach(function (row, i) {
                        row.id.should.equal(ids[i], 'seq order');
                      });
                      db.changes({
                        descending: true,
                        complete: function (err, changes) {
                          ids = [
                            '2',
                            '1',
                            '3',
                            '0'
                          ];
                          changes.results.forEach(function (row, i) {
                            row.id.should.equal(ids[i], 'descending=true');
                          });
                          done();
                        }
                      });
                    }
                  });
                });
              });
            });
          });
        });
      });
      it('Testing allDocs opts.keys', function (done) {
        function keyFunc(doc) {
          return doc.key;
        }
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
            var keys = [
                '3',
                '1'
              ];
            db.allDocs({ keys: keys }, function (err, result) {
              result.rows.map(keyFunc).should.deep.equal(keys);
              keys = [
                '2',
                '0',
                '1000'
              ];
              db.allDocs({ keys: keys }, function (err, result) {
                result.rows.map(keyFunc).should.deep.equal(keys);
                result.rows[2].error.should.equal('not_found', 'correct third (non-existent) row - has error field');
                db.allDocs({
                  keys: keys,
                  descending: true
                }, function (err, result) {
                  result.rows.map(keyFunc).should.deep.equal([
                    '1000',
                    '0',
                    '2'
                  ]);
                  result.rows[0].error.should.equal('not_found', 'correct third (non-existent) row - has error field (desc)');
                  db.allDocs({
                    keys: keys,
                    startkey: 'a'
                  }, function (err, result) {
                    should.exist(err);
                    db.allDocs({
                      keys: keys,
                      endkey: 'a'
                    }, function (err, result) {
                      should.exist(err);
                      db.allDocs({ keys: [] }, function (err, result) {
                        result.rows.should.have.length(0, 'correct answer if keys is empty');
                        db.get('2', function (err, doc) {
                          db.remove(doc, function (err, doc) {
                            db.allDocs({
                              keys: keys,
                              include_docs: true
                            }, function (err, result) {
                              result.rows.map(keyFunc).should.deep.equal(keys);
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
      it('Testing deleting in changes', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
            db.get('1', function (err, doc) {
              db.remove(doc, function (err, deleted) {
                should.exist(deleted.ok);
                db.changes({
                  complete: function (err, changes) {
                    changes.results.should.have.length(4);
                    changes.results[3].id.should.equal('1');
                    should.exist(changes.results[3].deleted);
                    done();
                  }
                });
              });
            });
          });
        });
      });
      it('Testing updating in changes', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
            db.get('3', function (err, doc) {
              doc.updated = 'totally';
              db.put(doc, function (err, doc) {
                db.changes({
                  complete: function (err, changes) {
                    changes.results.should.have.length(4);
                    changes.results[3].id.should.equal('3');
                    done();
                  }
                });
              });
            });
          });
        });
      });
      it('Testing include docs', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
            db.changes({
              include_docs: true,
              complete: function (err, changes) {
                changes.results[0].doc.a.should.equal(1);
                done();
              }
            });
          });
        });
      });
      it('Testing conflicts', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
            // add conflicts
            var conflictDoc1 = {
                _id: '3',
                _rev: '2-aa01552213fafa022e6167113ed01087',
                value: 'X'
              };
            var conflictDoc2 = {
                _id: '3',
                _rev: '2-ff01552213fafa022e6167113ed01087',
                value: 'Z'
              };
            db.put(conflictDoc1, { new_edits: false }, function (err, doc) {
              db.put(conflictDoc2, { new_edits: false }, function (err, doc) {
                db.get('3', function (err, winRev) {
                  winRev._rev.should.equal(conflictDoc2._rev, 'correct wining revision on get');
                  db.changes({
                    include_docs: true,
                    conflicts: true,
                    style: 'all_docs',
                    complete: function (err, changes) {
                      var result = changes.results[3];
                      result.id.should.equal('3', 'changes are ordered');
                      result.changes.should.have.length(3, 'correct number of changes');
                      result.doc._rev.should.equal(conflictDoc2._rev, 'correct winning revision');
                      result.doc._id.should.equal('3', 'correct doc id');
                      winRev._rev.should.equal(result.doc._rev, 'include doc has correct rev');
                      result.doc._conflicts.should.be.instanceof(Array, 'include docs contains conflicts');
                      result.doc._conflicts.should.have.length(2, 'correct number of changes');
                      conflictDoc1._rev.should.equal(result.doc._conflicts[0], 'correct conflict rev');
                      db.allDocs({
                        include_docs: true,
                        conflicts: true
                      }, function (err, res) {
                        var row = res.rows[3];
                        res.rows.should.have.length(4, 'correct number of changes');
                        row.key.should.equal('3', 'correct key');
                        row.id.should.equal('3', 'correct id');
                        row.value.rev.should.equal(winRev._rev, 'correct rev');
                        row.doc._rev.should.equal(winRev._rev, 'correct rev');
                        row.doc._id.should.equal('3', 'correct order');
                        row.doc._conflicts.should.be.instanceof(Array);
                        row.doc._conflicts.should.have.length(2, 'Correct number of conflicts');
                        conflictDoc1._rev.should.equal(res.rows[3].doc._conflicts[0], 'correct conflict rev');
                        done();
                      });
                    }
                  });
                });
              });
            });
          });
        });
      });
      it('test basic collation', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var docs = {
              docs: [
                {
                  _id: 'z',
                  foo: 'z'
                },
                {
                  _id: 'a',
                  foo: 'a'
                }
              ]
            };
          db.bulkDocs(docs, function (err, res) {
            db.allDocs({
              startkey: 'z',
              endkey: 'z'
            }, function (err, result) {
              result.rows.should.have.length(1, 'Exclude a result');
              done();
            });
          });
        });
      });
      it('test limit option and total_rows', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var docs = {
              docs: [
                {
                  _id: 'z',
                  foo: 'z'
                },
                {
                  _id: 'a',
                  foo: 'a'
                }
              ]
            };
          db.bulkDocs(docs, function (err, res) {
            db.allDocs({
              startkey: 'a',
              limit: 1
            }, function (err, res) {
              res.total_rows.should.equal(2, 'Accurately return total_rows count');
              res.rows.should.have.length(1, 'Correctly limit the returned rows.');
              done();
            });
          });
        });
      });
      it('test escaped startkey/endkey', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var id1 = '"crazy id!" a';
          var id2 = '"crazy id!" z';
          var docs = {
              docs: [
                {
                  _id: id1,
                  foo: 'a'
                },
                {
                  _id: id2,
                  foo: 'z'
                }
              ]
            };
          db.bulkDocs(docs, function (err, res) {
            db.allDocs({
              startkey: id1,
              endkey: id2
            }, function (err, res) {
              res.total_rows.should.equal(2, 'Accurately return total_rows count');
              done();
            });
          });
        });
      });
      it('test "key" option', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          db.bulkDocs({
            docs: [
              { _id: '0' },
              { _id: '1' },
              { _id: '2' }
            ]
          }, function (err) {
            should.not.exist(err);
            db.allDocs({ key: '1' }, function (err, res) {
              res.rows.should.have.length(1, 'key option returned 1 doc');
              db.allDocs({
                key: '1',
                keys: [
                  '1',
                  '2'
                ]
              }, function (err) {
                should.exist(err, 'error correctly reported - keys is incompatible with key');
                db.allDocs({
                  key: '1',
                  startkey: '1'
                }, function (err, res) {
                  should.not.exist(err, 'error correctly unreported - startkey is compatible with key');
                  db.allDocs({
                    key: '1',
                    endkey: '1'
                  }, function (err, res) {
                    should.not.exist(err, 'error correctly unreported - endkey is compatible with key');
                    // when mixing key/startkey or key/endkey, the results
                    // are very weird and probably undefined, so don't go beyond
                    // verifying that there's no error
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