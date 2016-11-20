'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.get.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    var origDocs = [
      {_id: '0', a: 1, b: 1},
      {_id: '3', a: 4, b: 16},
      {_id: '1', a: 2, b: 4},
      {_id: '2', a: 3, b: 9}
    ];

    it('Get doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        db.get(info.id, function (err, doc) {
          doc.should.have.property('test');
          db.get(info.id + 'asdf', function (err) {
            err.status.should.equal(testUtils.errors.MISSING_DOC.status,
                                    'correct error status returned');
            err.name.should.equal(testUtils.errors.MISSING_DOC.name,
                                  'correct error name returned');
            err.message.should.equal(testUtils.errors.MISSING_DOC.message,
                                    'correct error message returned');
            // todo: does not work in pouchdb-server.
            // err.reason.should.equal(testUtils.errors.MISSING_DOC.reason,
            //                           'correct error reason returned');
            done();
          });
        });
      });
    });

    it('Get design doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({
        _id: '_design/someid',
        test: 'somestuff'
      }, function (err, info) {
        db.get(info.id, function () {
          db.get(info.id + 'asdf', function (err) {
            err.status.should.equal(testUtils.errors.MISSING_DOC.status,
                                    'correct error status returned');
            err.name.should.equal(testUtils.errors.MISSING_DOC.name,
                                  'correct error name returned');
            err.message.should.equal(testUtils.errors.MISSING_DOC.message,
                                    'correct error message returned');
            // todo: does not work in pouchdb-server.
            // err.reason.should.equal(testUtils.errors.MISSING_DOC.reason,
            //                           'correct error reason returned');
            done();
          });
        });
      });
    });

    it('Check error of deleted document', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        db.remove({
          _id: info.id,
          _rev: info.rev
        }, function () {
          db.get(info.id, function (err) {
            err.status.should.equal(testUtils.errors.MISSING_DOC.status,
                                      'correct error status returned');
            err.name.should.equal(testUtils.errors.MISSING_DOC.name,
                                      'correct error name returned');
            done();
          });
        });
      });
    });

    it('Get revisions of removed doc', function (done) {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      db.post({ test: 'somestuff' }, function (err, info) {
        var rev = info.rev;
        db.remove({
          test: 'somestuff',
          _id: info.id,
          _rev: info.rev
        }, function () {
          db.get(info.id, { rev: rev }, function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('Testing get with rev', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = JSON.parse(JSON.stringify(origDocs));
      testUtils.writeDocs(db, docs, function () {
        db.get('3', function (err, parent) {
          // add conflicts
          var pRevId = parent._rev.split('-')[1];
          var conflicts = [
            {
              _id: '3',
              _rev: '2-aaa',
              value: 'x',
              _revisions: {
                start: 2,
                ids: [
                  'aaa',
                  pRevId
                ]
              }
            },
            {
              _id: '3',
              _rev: '3-bbb',
              value: 'y',
              _deleted: true,
              _revisions: {
                start: 3,
                ids: [
                  'bbb',
                  'some',
                  pRevId
                ]
              }
            },
            {
              _id: '3',
              _rev: '4-ccc',
              value: 'z',
              _revisions: {
                start: 4,
                ids: [
                  'ccc',
                  'even',
                  'more',
                  pRevId
                ]
              }
            }
          ];
          db.put(conflicts[0], { new_edits: false }, function () {
            db.put(conflicts[1], { new_edits: false }, function () {
              db.put(conflicts[2], { new_edits: false }, function () {
                db.get('3', { rev: '2-aaa' }, function (err, doc) {
                  doc._rev.should.equal('2-aaa');
                  doc.value.should.equal('x');
                  db.get('3', { rev: '3-bbb' }, function (err, doc) {
                    doc._rev.should.equal('3-bbb');
                    doc.value.should.equal('y');
                    db.get('3', { rev: '4-ccc' }, function (err, doc) {
                      doc._rev.should.equal('4-ccc');
                      doc.value.should.equal('z');
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

    it('Testing rev format', function (done) {
      var revs = [];
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        revs.unshift(info.rev.split('-')[1]);
        db.put({
          _id: info.id,
          _rev: info.rev,
          another: 'test1'
        }, function (err, info2) {
          revs.unshift(info2.rev.split('-')[1]);
          db.put({
            _id: info.id,
            _rev: info2.rev,
            last: 'test2'
          }, function (err, info3) {
            revs.unshift(info3.rev.split('-')[1]);
            db.get(info.id, { revs: true }, function (err, doc) {
              doc._revisions.start.should.equal(3);
              revs.should.deep.equal(doc._revisions.ids);
              done();
            });
          });
        });
      });
    });

    it('Test opts.revs=true with rev other than winning', function (done) {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var docs = [
        {_id: 'foo', _rev: '1-a', value: 'foo a'},
        {_id: 'foo', _rev: '2-b', value: 'foo b'},
        {_id: 'foo', _rev: '3-c', value: 'foo c'},
        {_id: 'foo', _rev: '4-d', value: 'foo d'}
      ];
      testUtils.putBranch(db, docs, function () {
        db.get('foo', {
          rev: '3-c',
          revs: true
        }, function (err, doc) {
          doc._revisions.ids.length.should.equal(3, 'correct revisions length');
          doc._revisions.start.should.equal(3, 'correct revisions start');
          doc._revisions.ids[0].should.equal('c', 'correct rev');
          doc._revisions.ids[1].should.equal('b', 'correct rev');
          doc._revisions.ids[2].should.equal('a', 'correct rev');
          done();
        });
      });
    });

    it('Test opts.revs=true return only winning branch', function (done) {
      var db = new PouchDB(dbs.name);
      var simpleTree = [
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-b', value: 'foo b'},
         {_id: 'foo', _rev: '3-c', value: 'foo c'}],
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-d', value: 'foo d'},
         {_id: 'foo', _rev: '3-e', value: 'foo e'},
         {_id: 'foo', _rev: '4-f', value: 'foo f'}
        ]
      ];
      testUtils.putTree(db, simpleTree, function () {
        db.get('foo', { revs: true }, function (err, doc) {
          doc._revisions.ids.length.should.equal(4, 'correct revisions length');
          doc._revisions.start.should.equal(4, 'correct revisions start');
          doc._revisions.ids[0].should.equal('f', 'correct rev');
          doc._revisions.ids[1].should.equal('e', 'correct rev');
          doc._revisions.ids[2].should.equal('d', 'correct rev');
          doc._revisions.ids[3].should.equal('a', 'correct rev');
          done();
        });
      });
    });

    it('Test get with simple revs_info', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        db.put({
          _id: info.id,
          _rev: info.rev,
          another: 'test'
        }, function (err, info) {
          db.put({
            _id: info.id,
            _rev: info.rev,
            a: 'change'
          }, function () {
            db.get(info.id, { revs_info: true }, function (err, doc) {
              doc._revs_info.length.should.equal(3, 'updated a doc with put');
              done();
            });
          });
        });
      });
    });

    it('Test get with revs_info on tree', function (done) {
      var db = new PouchDB(dbs.name);
      var simpleTree = [
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-b', value: 'foo b'},
         {_id: 'foo', _rev: '3-c', value: 'foo c'}],
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-d', value: 'foo d'},
         {_id: 'foo', _rev: '3-e', _deleted: true}]
      ];
      testUtils.putTree(db, simpleTree, function () {
        db.get('foo', { revs_info: true }, function (err, doc) {
          var revs = doc._revs_info;
          revs.length.should.equal(3, 'correct number of revs');
          revs[0].rev.should.equal('3-c', 'rev ok');
          revs[1].rev.should.equal('2-b', 'rev ok');
          revs[2].rev.should.equal('1-a', 'rev ok');
          done();
        });
      });
    });

    it('Test get with revs_info on compacted tree', function (done) {
      // _compact endpoint is not exposed in CouchDB 2.0
      // (it's exposed via a private port). Skip
      // this test for now
      if (testUtils.isCouchMaster()) {
        return done();
      }

      var db = new PouchDB(dbs.name);
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
            value: 'foo d'
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
            _deleted: true
          }
        ]
      ];
      testUtils.putTree(db, simpleTree, function () {
        db.compact(function () {
          db.get('foo', { revs_info: true }, function (err, doc) {
            var revs = doc._revs_info;
            revs.length.should.equal(3, 'correct number of revs');
            revs[0].rev.should.equal('3-c', 'rev ok');
            revs[0].status.should.equal('available', 'not compacted');
            revs[1].rev.should.equal('2-b', 'rev ok');
            revs[1].status.should.equal('missing', 'compacted');
            revs[2].rev.should.equal('1-a', 'rev ok');
            revs[2].status.should.equal('missing', 'compacted');
            done();
          });
        });
      });
    });

    it('#2951 Parallelized gets with 409s/404s', function () {
      var db = new PouchDB(dbs.name);

      var numSimultaneous = 20;
      var numDups = 3;

      var tasks = [];

      for (var i = 0; i < numSimultaneous; i++) {
        var key = Math.random().toString();
        for (var j = 0; j < numDups; j++) {
          tasks.push(key);
        }
      }

      function getDocWithDefault(db, id, defaultDoc) {
        return db.get(id).catch(function (err) {
          /* istanbul ignore if */
          if (err.status !== 404) {
            throw err;
          }
          defaultDoc._id = id;
          return db.put(defaultDoc).catch(function (err) {
            /* istanbul ignore if */
            if (err.status !== 409) { // conflict
              throw err;
            }
          }).then(function () {
            return db.get(id);
          });
        });
      }

      return testUtils.Promise.all(tasks.map(function (task) {
        return getDocWithDefault(db, task, {foo: 'bar'});
      }));
    });

    it('#2951 Parallelized _local gets with 409s/404s', function () {
      var db = new PouchDB(dbs.name);

      var numSimultaneous = 20;
      var numDups = 3;

      var tasks = [];

      for (var i = 0; i < numSimultaneous; i++) {
        var key = Math.random().toString();
        for (var j = 0; j < numDups; j++) {
          tasks.push('_local/' + key);
        }
      }

      function getDocWithDefault(db, id, defaultDoc) {
        return db.get(id).catch(function (err) {
          /* istanbul ignore if */
          if (err.status !== 404) {
            throw err;
          }
          defaultDoc._id = id;
          return db.put(defaultDoc).catch(function (err) {
            /* istanbul ignore if */
            if (err.status !== 409) { // conflict
              throw err;
            }
          }).then(function () {
            return db.get(id);
          });
        });
      }

      return testUtils.Promise.all(tasks.map(function (task) {
        return getDocWithDefault(db, task, {foo: 'bar'});
      }));
    });

    it('Test get with conflicts', function (done) {
      var db = new PouchDB(dbs.name);
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
            _rev: '2-c',
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
            value: 'foo d',
            _deleted: true
          }
        ]
      ];
      testUtils.putTree(db, simpleTree, function () {
        db.get('foo', { conflicts: true }, function (err, doc) {
          doc._rev.should.equal('2-c', 'correct rev');
          doc._conflicts.length.should.equal(1, 'just one conflict');
          doc._conflicts[0].should.equal('2-b', 'just one conflict');
          done();
        });
      });
    });

    it('Retrieve old revision', function (done) {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      db.post({ version: 'first' }, function (err, info) {
        db.put({
          _id: info.id,
          _rev: info.rev,
          version: 'second'
        }, function (err) {
          should.not.exist(err);
          db.get(info.id, { rev: info.rev }, function (err, oldRev) {
            oldRev.version.should.equal('first', 'Fetched old revision');
            db.get(info.id, { rev: '1-nonexistentRev' }, function (err) {
              should.exist(err, 'Non existent row error correctly reported');
              done();
            });
          });
        });
      });
    });

    it('Testing get open_revs="all"', function (done) {
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)),
        function () {
        db.get('3', function (err, parent) {
          // add conflicts
          var previd = parent._rev.split('-')[1];
          var conflicts = [
            {
              _id: '3',
              _rev: '2-aaa',
              value: 'x',
              _revisions: {
                start: 2,
                ids: [
                  'aaa',
                  previd
                ]
              }
            },
            {
              _id: '3',
              _rev: '3-bbb',
              value: 'y',
              _deleted: true,
              _revisions: {
                start: 3,
                ids: [
                  'bbb',
                  'some',
                  previd
                ]
              }
            },
            {
              _id: '3',
              _rev: '4-ccc',
              value: 'z',
              _revisions: {
                start: 4,
                ids: [
                  'ccc',
                  'even',
                  'more',
                  previd
                ]
              }
            }
          ];
          db.put(conflicts[0], { new_edits: false }, function () {
            db.put(conflicts[1], { new_edits: false }, function () {
              db.put(conflicts[2], { new_edits: false }, function () {
                db.get('3', { open_revs: 'all' }, function (err, res) {
                  var i;
                  res = res.map(function (row) {
                    return row.ok;
                  });
                  res.sort(function (a, b) {
                    return a._rev === b._rev ? 0 : a._rev < b._rev ? -1 : 1;
                  });
                  res.length.should.equal(conflicts.length);
                  for (i = 0; i < conflicts.length; i++) {
                    conflicts[i]._rev.should.equal(res[i]._rev, 'correct rev');
                  }
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Testing get with some open_revs', function (done) {
      // TODO: CouchDB master fails, needs investigation
      if (testUtils.isCouchMaster()) {
        return done();
      }
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)),
        function () {
        db.get('3', function (err, parent) {
          // add conflicts
          var previd = parent._rev.split('-')[1];
          var conflicts = [
            {
              _id: '3',
              _rev: '2-aaa',
              value: 'x',
              _revisions: {
                start: 2,
                ids: [
                  'aaa',
                  previd
                ]
              }
            },
            {
              _id: '3',
              _rev: '3-bbb',
              value: 'y',
              _deleted: true,
              _revisions: {
                start: 3,
                ids: [
                  'bbb',
                  'some',
                  previd
                ]
              }
            },
            {
              _id: '3',
              _rev: '4-ccc',
              value: 'z',
              _revisions: {
                start: 4,
                ids: [
                  'ccc',
                  'even',
                  'more',
                  previd
                ]
              }
            }
          ];
          db.put(conflicts[0], { new_edits: false }, function () {
            db.put(conflicts[1], { new_edits: false }, function () {
              db.put(conflicts[2], { new_edits: false }, function () {
                db.get('3', {
                  open_revs: [
                    '2-aaa',
                    '5-nonexistent',
                    '3-bbb'
                  ]
                }, function (err, res) {
                  res.sort(function (a, b) {
                    if (a.ok) {
                      if (b.ok) {
                        var x = a.ok._rev, y = b.ok._rev;
                        return x === y ? 0 : x < y ? -1 : 1;
                      } else {
                        return -1;
                      }
                    }
                    return 1;
                  });
                  res.length.should.equal(3, 'correct number of open_revs');
                  res[0].ok._rev.should.equal('2-aaa', 'ok');
                  res[1].ok._rev.should.equal('3-bbb', 'ok');
                  res[2].missing.should.equal('5-nonexistent', 'ok');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Testing get with open_revs and revs', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-b', value: 'foo b'}
        ],
        [{_id: 'foo', _rev: '1-a', value: 'foo a'},
         {_id: 'foo', _rev: '2-c', value: 'foo c'}]
      ];
      testUtils.putTree(db, docs, function () {
        db.get('foo', {
          open_revs: ['2-b'],
          revs: true
        }, function (err, res) {
          var doc = res[0].ok;
          doc._revisions.ids.length.should.equal(2, 'got two revs');
          doc._revisions.ids[0].should.equal('b', 'got correct rev');
          done();
        });
      });
    });

    it('Testing get with open_revs on nonexistent doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.get('nonexistent', { open_revs: ['2-whatever'] }, function (err, res) {
        res.length.should.equal(1, 'just one result');
        res[0].missing.should.equal('2-whatever', 'just one result');
        db.get('nonexistent', { open_revs: 'all' }, function (err) {
          // CouchDB 1.X doesn't handle this situation correctly
          // CouchDB 2.0 fixes it (see COUCHDB-2517)
          testUtils.isCouchDB(function (isCouchDB) {
            if (isCouchDB && !testUtils.isCouchMaster()) {
              return done();
            }

            err.status.should.equal(404);
            done();
          });
        });
      });
    });

    it('Testing get with open_revs with wrong params', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function () {
        db.get('foo', {
          open_revs: {
            'whatever': 'which is',
            'not an array': 'or all string'
          }
        }, function (err) {
          var acceptable_errors = ['unknown_error', 'bad_request'];
          acceptable_errors.indexOf(err.name)
            .should.not.equal(-1, 'correct error');
          // unfortunately!
          db.get('foo', {
            open_revs: [
              '1-almost',
              '2-correct',
              'keys'
            ]
          }, function (err) {
            err.name.should.equal('bad_request', 'correct error');
            done();
          });
        });
      });
    });

    it('#5883 Testing with duplicate rev hash', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs([
          {
            "_id": "foo",
            "_rev": "3-deleted",
            "_deleted": true,
            "_revisions": {
                "start": 3,
                "ids": ["deleted", "0a21b4bd4399b51e144a06b126031edc", "created"]
            }
          },
          {
            "_id": "foo",
            "_rev": "3-0a21b4bd4399b51e144a06b126031edc",
            "_revisions": {
                "start": 3,
                "ids": ["0a21b4bd4399b51e144a06b126031edc", "updated", "created"]
            }
          }
        ], { new_edits: false
      }).then(function () {
        return db.get('foo', { revs: true });
      }).then(function (doc) {
        doc._revisions.start.should.equal(3);
        doc._revisions.ids.should.eql(["0a21b4bd4399b51e144a06b126031edc", "updated", "created"]);
        done();
      }).catch(done);
    });


  });
});
