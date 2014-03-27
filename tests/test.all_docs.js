
'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.all_docs.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_all_docs');
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    var origDocs = [
      {_id: '0', a: 1, b: 1},
      {_id: '3', a: 4, b: 16},
      {_id: '1', a: 2, b: 4},
      {_id: '2', a: 3, b: 9}
    ];

    it('Testing all docs', function (done) {
      var db = new PouchDB(dbs.name);
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
            var opts = {
              startkey: 'org.couchdb.user:',
              endkey: 'org.couchdb.user;'
            };
            db.allDocs(opts, function (err, raw) {
              raw.rows.should.have.length(0, 'raw collation');
              var ids = ['0', '3', '1', '2'];
              db.changes({
                complete: function (err, changes) {
                  changes.results.forEach(function (row, i) {
                    row.id.should.equal(ids[i], 'seq order');
                  });
                  db.changes({
                    descending: true,
                    complete: function (err, changes) {
                      ids = ['2', '1', '3', '0'];
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

    it('Testing allDocs opts.keys', function (done) {
      var db = new PouchDB(dbs.name);
      function keyFunc(doc) {
        return doc.key;
      }
      testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
        var keys = ['3', '1'];
        db.allDocs({ keys: keys }, function (err, result) {
          result.rows.map(keyFunc).should.deep.equal(keys);
          keys = ['2', '0', '1000'];
          db.allDocs({ keys: keys }, function (err, result) {
            result.rows.map(keyFunc).should.deep.equal(keys);
            result.rows[2].error.should.equal('not_found');
            db.allDocs({
              keys: keys,
              descending: true
            }, function (err, result) {
              result.rows.map(keyFunc).should.deep.equal(['1000', '0', '2']);
              result.rows[0].error.should.equal('not_found');
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
                    result.rows.should.have.length(0);
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

    it('Testing deleting in changes', function (done) {
      var db = new PouchDB(dbs.name);
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

    it('Testing updating in changes', function (done) {
      var db = new PouchDB(dbs.name);
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

    it('Testing include docs', function (done) {
      var db = new PouchDB(dbs.name);
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

    it('Testing conflicts', function (done) {
      var db = new PouchDB(dbs.name);
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
              winRev._rev.should.equal(conflictDoc2._rev);
              db.changes({
                include_docs: true,
                conflicts: true,
                style: 'all_docs',
                complete: function (err, changes) {
                  var result = changes.results[3];
                  result.id.should.equal('3', 'changes are ordered');
                  result.changes.should.have.length(3, 'correct number of changes');
                  result.doc._rev.should.equal(conflictDoc2._rev);
                  result.doc._id.should.equal('3', 'correct doc id');
                  winRev._rev.should.equal(result.doc._rev);
                  result.doc._conflicts.should.be.instanceof(Array);
                  result.doc._conflicts.should.have.length(2);
                  conflictDoc1._rev.should.equal(result.doc._conflicts[0]);
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
                    row.doc._conflicts.should.have.length(2);
                    conflictDoc1._rev.should.equal(res.rows[3].doc._conflicts[0]);
                    done();
                  });
                }
              });
            });
          });
        });
      });
    });

    it('test basic collation', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = {
        docs: [
          {_id: 'z', foo: 'z'},
          {_id: 'a', foo: 'a'}
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

    it('test total_rows with a variety of criteria', function (done) {
      this.timeout(20000);
      var db = new PouchDB(dbs.name);

      var docs = [
        {_id : '0'},
        {_id : '1'},
        {_id : '2'},
        {_id : '3'},
        {_id : '4'},
        {_id : '5'},
        {_id : '6'},
        {_id : '7'},
        {_id : '8'},
        {_id : '9'}
      ];
      db.bulkDocs({docs : docs}).then(function (res) {
        docs[3]._deleted = true;
        docs[7]._deleted = true;
        docs[3]._rev = res[3].rev;
        docs[7]._rev = res[7].rev;
        return db.remove(docs[3]);
      }).then(function () {
          return db.remove(docs[7]);
        }).then(function () {
          return db.allDocs();
        }).then(function (res) {
          res.rows.should.have.length(8,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '5'});
        }).then(function (res) {
          res.rows.should.have.length(4,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '5', skip : 2, limit : 10});
        }).then(function (res) {
          res.rows.should.have.length(2,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '5', limit : 0});
        }).then(function (res) {
          res.rows.should.have.length(0,  'correctly return rows, startkey w/ limit=0');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({keys : ['5'], limit : 0});
        }).then(function (res) {
          res.rows.should.have.length(0,  'correctly return rows, keys w/ limit=0');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({limit : 0});
        }).then(function (res) {
          res.rows.should.have.length(0,  'correctly return rows, limit=0');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '5', descending : true, skip : 1});
        }).then(function (res) {
          res.rows.should.have.length(4,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '5', endkey : 'z'});
        }).then(function (res) {
          res.rows.should.have.length(4,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '5', endkey : '5'});
        }).then(function (res) {
          res.rows.should.have.length(1,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '5', endkey : '4'});
        }).then(function (res) {
          res.rows.should.have.length(0,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '5', endkey : '4', descending : true});
        }).then(function (res) {
          res.rows.should.have.length(2,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '3', endkey : '7', descending : false});
        }).then(function (res) {
          res.rows.should.have.length(3,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '7', endkey : '3', descending : true});
        }).then(function (res) {
          res.rows.should.have.length(3,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({startkey : '', endkey : '0'});
        }).then(function (res) {
          res.rows.should.have.length(1,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({keys : ['0', '1', '3']});
        }).then(function (res) {
          res.rows.should.have.length(3,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({keys : ['0', '1', '0', '2', '1', '1']});
        }).then(function (res) {
          res.rows.should.have.length(6,  'correctly return rows');
          res.rows.map(function (row) { return row.key; }).should.deep.equal(
            ['0', '1', '0', '2', '1', '1']);
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({keys : []});
        }).then(function (res) {
          res.rows.should.have.length(0,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({keys : ['7']});
        }).then(function (res) {
          res.rows.should.have.length(1,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({key : '3'});
        }).then(function (res) {
          res.rows.should.have.length(0,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({key : '2'});
        }).then(function (res) {
          res.rows.should.have.length(1,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          return db.allDocs({key : 'z'});
        }).then(function (res) {
          res.rows.should.have.length(0,  'correctly return rows');
          res.total_rows.should.equal(8,  'correctly return total_rows');
          done();
        }, done);

    });

    it('test total_rows with both skip and limit', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = {
        docs: [
          {_id: "w", foo: "w"},
          {_id: "x", foo: "x"},
          {_id: "y", foo: "y"},
          {_id: "z", foo: "z"}
        ]
      };
      db.bulkDocs(docs, function (err, res) {
        db.allDocs({ startkey: 'x', limit: 1, skip : 1}, function (err, res) {
          res.total_rows.should.equal(4,  'Accurately return total_rows count');
          res.rows.should.have.length(1,  'Correctly limit the returned rows');
          res.rows[0].id.should.equal('y', 'Correctly skip 1 doc');

          db.get('x', function (err, xDoc) {
            db.remove(xDoc, function (err, res) {
              db.allDocs({ startkey: 'w', limit: 2, skip : 1}, function (err, res) {
                res.total_rows.should.equal(3,  'Accurately return total_rows count after delete');
                res.rows.should.have.length(2,  'Correctly limit the returned rows after delete');
                res.rows[0].id.should.equal('y', 'Correctly skip 1 doc after delete');
                done();
              });
            });
          });
        });
      });
    });

    it('test limit option and total_rows', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = {
        docs: [
          {_id: 'z', foo: 'z'},
          {_id: 'a', foo: 'a'}
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

    it('test escaped startkey/endkey', function (done) {
      var db = new PouchDB(dbs.name);
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

    it('test "key" option', function (done) {
      var db = new PouchDB(dbs.name);
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
            should.exist(err);
            db.allDocs({
              key: '1',
              startkey: '1'
            }, function (err, res) {
              should.not.exist(err);
              db.allDocs({
                key: '1',
                endkey: '1'
              }, function (err, res) {
                should.not.exist(err);
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
