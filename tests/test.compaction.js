'use strict';

var adapters = ['http', 'local'];
var autoCompactionAdapters = ['local'];

adapters.forEach(function (adapter) {
  describe('test.compaction.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_compaction');
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
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
        db.get(doc._id, { rev: doc._rev }, function (err, doc) {
          if (i < docs.length - 1) {
            should.exist(err);
            err.status.should.equal(404, 'compacted!');
            check(i + 1);
          } else {
            should.not.exist(err, 'not compacted!');
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
              err.message.should.equal('missing', 'correct reason');
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
              err.message.should.equal('missing', 'correct reason');
              done();
            });
          });
        });
      });
    });

    if (autoCompactionAdapters.indexOf(adapter) === -1) {
      return;
    }
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
              err.status.should.equal(404, 'compacted document is missing');
              err.name.should.equal(
                'not_found', 'compacted document is missing'
              );
              db.get('doc', { rev: rev2 }, function (err, doc) {
                if (err) {
                  return done(err);
                }
                db.get('doc', { rev: rev3 }, function (err, doc) {
                  done(err);
                });
              });
            });
          });
        });
      });
    });

  });
});
