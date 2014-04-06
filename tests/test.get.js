'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.get.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_get');
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

    function writeDocs(db, docs, callback) {
      if (!docs.length) {
        return callback();
      }
      var doc = docs.shift();
      db.put(doc, function (err, doc) {
        should.exist(doc.ok);
        writeDocs(db, docs, callback);
      });
    }

    it('Get doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        db.get(info.id, function (err, doc) {
          doc.should.have.property('test');
          db.get(info.id + 'asdf', function (err) {
            err.should.have.property('name');
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
        db.get(info.id, function (err, doc) {
          db.get(info.id + 'asdf', function (err) {
            err.should.have.property('name');
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
        }, function (err, res) {
          db.get(info.id, function (err, res) {
            err.name.should.equal('not_found');
            err.message.should.equal('deleted');
            done();
          });
        });
      });
    });

    it('Get local_seq of document', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info1) {
        db.get(info1.id, { local_seq: true }, function (err, res) {
          res._local_seq.should.equal(1);
          db.post({ test: 'someotherstuff' }, function (err, info2) {
            db.get(info2.id, { local_seq: true }, function (err, res) {
              res._local_seq.should.equal(2);
              done();
            });
          });
        });
      });
    });

    it('Get revisions of removed doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        var rev = info.rev;
        db.remove({
          test: 'somestuff',
          _id: info.id,
          _rev: info.rev
        }, function (doc) {
          db.get(info.id, { rev: rev }, function (err, doc) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('Testing get with rev', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
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
            db.put(conflicts[0], { new_edits: false }, function (err, doc) {
              db.put(conflicts[1], { new_edits: false }, function (err, doc) {
                db.put(conflicts[2], { new_edits: false }, function (err, doc) {
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
      var db = new PouchDB(dbs.name);
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
          }, function (err, info2) {
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
        db.compact(function (err, ok) {
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
      var db = new PouchDB(dbs.name);
      db.post({ version: 'first' }, function (err, info) {
        db.put({
          _id: info.id,
          _rev: info.rev,
          version: 'second'
        }, function (err, info2) {
          should.not.exist(err);
          db.get(info.id, { rev: info.rev }, function (err, oldRev) {
            oldRev.version.should.equal('first', 'Fetched old revision');
            db.get(info.id, { rev: '1-nonexistentRev' }, function (err, doc) {
              should.exist(err, 'Non existent row error correctly reported');
              done();
            });
          });
        });
      });
    });

    it('Testing get open_revs="all"', function (done) {
      var db = new PouchDB(dbs.name);
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
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
          db.put(conflicts[0], { new_edits: false }, function (err, doc) {
            db.put(conflicts[1], { new_edits: false }, function (err, doc) {
              db.put(conflicts[2], { new_edits: false }, function (err, doc) {
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
      var db = new PouchDB(dbs.name);
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function () {
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
          db.put(conflicts[0], { new_edits: false }, function (err, doc) {
            db.put(conflicts[1], { new_edits: false }, function (err, doc) {
              db.put(conflicts[2], { new_edits: false }, function (err, doc) {
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
        db.get('nonexistent', { open_revs: 'all' }, function (err, res) {
          res.length.should.equal(0, 'no open revisions');
          done();
        });
      });
    });

    it('Testing get with open_revs with wrong params', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function (err, res) {
        db.get('foo', {
          open_revs: {
            'whatever': 'which is',
            'not an array': 'or all string'
          }
        }, function (err, res) {
          err.name.should.equal('unknown_error', 'correct error');
          // unfortunately!
          db.get('foo', {
            open_revs: [
              '1-almost',
              '2-correct',
              'keys'
            ]
          }, function (err, res) {
            err.name.should.equal('bad_request', 'correct error');
            done();
          });
        });
      });
    });

  });
});
