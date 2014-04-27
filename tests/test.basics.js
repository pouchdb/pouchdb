'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.basics.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_basics');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    it('Create a pouch', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        should.not.exist(err);
        db.should.be.an.instanceof(PouchDB);
        done();
      });
    });

    it('Create a pouch with a promise', function (done) {
      new PouchDB(dbs.name).then(function (db) {
        db.should.be.an.instanceof(PouchDB);
        done();
      }, done);
    });

    it('Catch an error when creating a pouch with a promise', function (done) {
      new PouchDB().catch(function (err) {
        should.exist(err);
        done();
      });
    });

    it('Remove a pouch', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        PouchDB.destroy(dbs, function (err, info) {
          should.not.exist(err);
          should.exist(info);
          info.ok.should.equal(true);
          done();
        });
      });
    });

    it('Remove a pouch, with a promise', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        PouchDB.destroy(dbs).then(function (info) {
          should.exist(info);
          info.ok.should.equal(true);
          done();
        }, done);
      });
    });

    it('destroy a pouch', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        db.destroy(function (err, info) {
          should.not.exist(err);
          should.exist(info);
          info.ok.should.equal(true);
          done();
        });
      });
    });

    it('destroy a pouch, with a promise', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        db.destroy().then(function (info) {
          should.exist(info);
          info.ok.should.equal(true);
          done();
        }, done);
      });
    });

    it('Add a doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({test: 'somestuff'}, function (err, info) {
        should.not.exist(err);
        done();
      });
    });

    it('Add a doc with a promise', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({test: 'somestuff'}).then(function (info) {
        done();
      }, done);
    });

    it('Modify a doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({test: 'somestuff'}, function (err, info) {
        db.put({
          _id: info.id,
          _rev: info.rev,
          another: 'test'
        }, function (err, info2) {
          should.not.exist(err);
          info.rev.should.not.equal(info2.rev);
          done();
        });
      });
    });

    it('Modify a doc with sugar syntax', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({test: 'somestuff'}, function (err, info) {
        db.put({another: 'test'}, info.id, info.rev, function (err, info2) {
          info.rev.should.not.equal(info2.rev);
          db.put({yet_another: 'test'}, 'yet_another', function (err, info3) {
            info3.id.should.equal('yet_another');
            info.rev.should.not.equal(info2.rev);
            done();
          });
        });
      });
    });

    it('Modify a doc with sugar syntax and omit the _id', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({test: 'somestuff'}, function (err, info) {
        db.put({another: 'test', _id: info.id}, info.rev,
          function (err, info2) {
          info.rev.should.not.equal(info2.rev);
          db.put({yet_another: 'test'}, 'yet_another', function (err, info3) {
            info3.id.should.equal('yet_another');
            info.rev.should.not.equal(info2.rev);
            done();
          });
        });
      });
    });

    it('Modify a doc with a promise', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({test: 'promisestuff'}).then(function (info) {
        return db.put({
          _id: info.id,
          _rev: info.rev,
          another: 'test'
        }).then(function (info2) {
          info.rev.should.not.equal(info2.rev);
        });
      }).catch(done).then(function () {
        done();
      });
    });

    it('Read db id', function (done) {
      var db = new PouchDB(dbs.name);
      db.id(function (err, id) {
        id.should.be.a('string');
        done(err);
      });
    });

    it('Read db id with promise', function (done) {
      var db = new PouchDB(dbs.name);
      db.id().then(function (id) {
        id.should.be.a('string');
        done();
      });
    });

    it('Close db', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        db.close(done);
      });
    });

    it('Close db with a promise', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        db.close().then(done, done);
      });
    });

    it('Read db id after closing Close', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        db.close(function (error) {
          db = new PouchDB(dbs.name);
          db.id(function (err, id) {
            id.should.be.a('string');
            done();
          });
        });
      });
    });

    it('Modify a doc with incorrect rev', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        var nDoc = {
          _id: info.id,
          _rev: info.rev + 'broken',
          another: 'test'
        };
        db.put(nDoc, function (err, info2) {
          should.exist(err);
          done();
        });
      });
    });

    it('Remove doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        db.remove({
          test: 'somestuff',
          _id: info.id,
          _rev: info.rev
        }, function (doc) {
          db.get(info.id, function (err) {
            should.exist(err.error);
            done();
          });
        });
      });
    });

    it('Remove doc with a promise', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({test: 'someotherstuff'}).then(function (info) {
        return db.remove({
          test: 'someotherstuff',
          _id: info.id,
          _rev: info.rev
        }).then(function () {
          return db.get(info.id).then(function (doc) {
            done(true);
          }, function (err) {
            should.exist(err.error);
            done();
          });
        });
      });
    });

    it('Remove doc with new syntax', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        db.remove(info.id, info.rev, function (err) {
          should.not.exist(err);
          db.get(info.id, function (err) {
            should.exist(err);
            done();
          });
        });
      });
    });

    it('Remove doc with new syntax and a promise', function (done) {
      var db = new PouchDB(dbs.name);
      var id;
      db.post({test: 'someotherstuff'}).then(function (info) {
        id = info.id;
        return db.remove(info.id, info.rev);
      }).then(function () {
        return db.get(id);
      }).then(function (doc) {
        done(true);
      }, function (err) {
        should.exist(err.error);
        done();
      });
    });

    it('Doc removal leaves only stub', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo', value: 'test'}, function (err, res) {
        db.get('foo', function (err, doc) {
          db.remove(doc, function (err, res) {
            db.get('foo', { rev: res.rev }, function (err, doc) {
              doc.should.deep.equal({
                _id: res.id,
                _rev: res.rev,
                _deleted: true
              });
              done();
            });
          });
        });
      });
    });

    it('Remove doc twice with specified id', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'specifiedId', test: 'somestuff'}, function (err, info) {
        db.get('specifiedId', function (err, doc) {
          db.remove(doc, function (err, response) {
            db.put({
              _id: 'specifiedId',
              test: 'somestuff2'
            }, function (err, info) {
              db.get('specifiedId', function (err, doc) {
                db.remove(doc, function (err, response) {
                  should.not.exist(err);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Remove doc, no callback', function (done) {
      var db = new PouchDB(dbs.name);
      var changes = db.changes({
        live: true,
        include_docs: true,
        onChange: function (change) {
          if (change.doc._deleted) {
            changes.cancel();
          }
        },
        complete: function (err, result) {
          result.status.should.equal('cancelled');
          done();
        }
      });
      db.post({ _id: 'somestuff' }, function (err, res) {
        db.remove({
          _id: res.id,
          _rev: res.rev
        });
      });
    });

    it('Delete document without id', function (done) {
      var db = new PouchDB(dbs.name);
      db.remove({test: 'ing'}, function (err) {
        should.exist(err);
        done();
      });
    });

    it('Bulk docs', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { test: 'somestuff' },
          { test: 'another' }
        ]
      }, function (err, infos) {
        infos.length.should.equal(2);
        infos[0].ok.should.equal(true);
        infos[1].ok.should.equal(true);
        done();
      });
    });

    it('Bulk docs with a promise', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { test: 'somestuff' },
          { test: 'another' }
        ]
      }).then(function (infos) {
        infos.length.should.equal(2);
        infos[0].ok.should.equal(true);
        infos[1].ok.should.equal(true);
        done();
      }).catch(done);
    });

    it('Basic checks', function (done) {
      var db = new PouchDB(dbs.name);
      db.info(function (err, info) {
        var updateSeq = info.update_seq;
        var doc = {_id: '0', a: 1, b: 1};
        info.doc_count.should.equal(0);
        db.put(doc, function (err, res) {
          res.ok.should.equal(true);
          res.should.have.property('id');
          res.should.have.property('rev');
          db.info(function (err, info) {
            info.doc_count.should.equal(1);
            info.update_seq.should.not.equal(updateSeq);
            db.get(doc._id, function (err, doc) {
              doc._id.should.equal(res.id);
              doc._rev.should.equal(res.rev);
              db.get(doc._id, { revs_info: true }, function (err, doc) {
                doc._revs_info[0].status.should.equal('available');
                done();
              });
            });
          });
        });
      });
    });

    it('Doc validation', function (done) {
      var bad_docs = [
        {'_zing': 4},
        {'_zoom': 'hello'},
        {'zane': 'goldfish',
         '_fan': 'something smells delicious'},
        {'_bing': {'wha?': 'soda can'}}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: bad_docs }, function (err, res) {
        err.status.should.equal(500);
        err.name.should.equal('doc_validation');
        done();
      });
    });

    it('Testing issue #48', function (done) {
      var docs = [
        {'id': '0'}, {'id': '1'}, {'id': '2'},
        {'id': '3'}, {'id': '4'}, {'id': '5'}
      ];
      var TO_SEND = 5;
      var sent = 0;
      var complete = 0;
      var timer;

      var db = new PouchDB(dbs.name);

      var bulkCallback = function (err, res) {
        should.not.exist(err);
        if (++complete === TO_SEND) {
          done();
        }
      };

      var save = function () {
        if (++sent === TO_SEND) {
          clearInterval(timer);
        }
        db.bulkDocs({docs: docs}, bulkCallback);
      };

      timer = setInterval(save, 10);
    });

    it('Testing valid id', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({
        '_id': 123,
        test: 'somestuff'
      }, function (err, info) {
        should.exist(err);
        done();
      });
    });

    it('Put doc without _id should fail', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({test: 'somestuff' }, function (err, info) {
        should.exist(err);
        done();
      });
    });

    it('Put doc with bad reserved id should fail', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({
        _id: '_i_test',
        test: 'somestuff'
      }, function (err, info) {
        should.exist(err);
        err.name.should.equal('bad_request');
        done();
      });
    });

    it('update_seq persists', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        new PouchDB(dbs.name, function (err, db) {
          db.info(function (err, info) {
            info.update_seq.should.not.equal(0);
            info.doc_count.should.equal(1);
            done();
          });
        });
      });
    });

    it('deletions persists', function (done) {

      var db = new PouchDB(dbs.name);
      var doc = {_id: 'staticId', contents: 'stuff'};

      function writeAndDelete(cb) {
        db.put(doc, function (err, info) {
          db.remove({
            _id: info.id,
            _rev: info.rev
          }, function (doc) {
            cb();
          });
        });
      }

      writeAndDelete(function () {
        writeAndDelete(function () {
          db.put(doc, function () {
            db.get(doc._id, { conflicts: true }, function (err, details) {
              details.should.not.have.property('_conflicts');
              done();
            });
          });
        });
      });
    });

    it('Error when document is not an object', function (done) {
      var db = new PouchDB(dbs.name);
      var doc1 = [{ _id: 'foo' }, { _id: 'bar' }];
      var doc2 = 'this is not an object';
      var count = 5;
      var callback = function (err, resp) {
        should.exist(err);
        count--;
        if (count === 0) {
          done();
        }
      };
      db.post(doc1, callback);
      db.post(doc2, callback);
      db.put(doc1, callback);
      db.put(doc2, callback);
      db.bulkDocs({docs: [doc1, doc2]}, callback);
    });

    it('Test instance update_seq updates correctly', function (done) {
      new PouchDB(dbs.name, function (err, db1) {
        var db2 = new PouchDB(dbs.name);
        db1.post({ a: 'doc' }, function () {
          db1.info(function (err, db1Info) {
            db2.info(function (err, db2Info) {
              db1Info.update_seq.should.not.equal(0);
              db2Info.update_seq.should.not.equal(0);
              done();
            });
          });
        });
      });
    });

    it('Error works', function () {
      var newError = PouchDB.Errors
        .error(PouchDB.Errors.BAD_REQUEST, 'love needs no message');
      newError.status.should.equal(400);
      newError.name.should.equal('bad_request');
      newError.message.should.equal('love needs no message');
    });

    it('Fail to fetch a doc after db was deleted', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var db2 = new PouchDB(dbs.name);
        var doc = { _id: 'foodoc' };
        var doc2 = { _id: 'foodoc2' };
        db.put(doc, function () {
          db2.put(doc2, function () {
            db.allDocs(function (err, docs) {
              docs.total_rows.should.equal(2);
              PouchDB.destroy(dbs.name, function (err) {
                should.not.exist(err);
                db2 = new PouchDB(dbs.name);
                db2.get(doc._id, function (err, doc) {
                  err.status.should.equal(404);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Fail to fetch a doc after db was deleted', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var db2 = new PouchDB(dbs.name);
        var doc = { _id: 'foodoc' };
        var doc2 = { _id: 'foodoc2' };
        db.put(doc, function () {
          db2.put(doc2, function () {
            db.allDocs(function (err, docs) {
              docs.total_rows.should.equal(2);
              db.destroy().then(function () {
                db2 = new PouchDB(dbs.name);
                db2.get(doc._id, function (err, doc) {
                  err.status.should.equal(404);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Cant add docs with empty ids', function (done) {
      var docs = [
        {},
        { _id: null },
        { _id: undefined },
        { _id: '' },
        { _id: {} },
        { _id: '_underscored_id' }
      ];
      var num = docs.length;
      var db = new PouchDB(dbs.name);
      docs.forEach(function (doc) {
        db.put(doc, function (err, info) {
          should.exist(err);
          if (!--num) {
            done();
          }
        });
      });
    });

    it('db.info should give correct name', function (done) {
      var db = new PouchDB(dbs.name);
      db.info().then(function (info) {
        info.db_name.should.equal('test_basics');
        done();
      });
    });

    it('db.info should give correct doc_count', function (done) {
      new PouchDB(dbs.name).then(function (db) {
        db.info().then(function (info) {
          info.doc_count.should.equal(0);
          return db.bulkDocs({docs : [{_id : '1'}, {_id : '2'}, {_id : '3'}]});
        }).then(function () {
          return db.info();
        }).then(function (info) {
          info.doc_count.should.equal(3);
          return db.get('1');
        }).then(function (doc) {
          return db.remove(doc);
        }).then(function () {
          return db.info();
        }).then(function (info) {
          info.doc_count.should.equal(2);
          done();
        }, done);
      }, done);
    });

    if (adapter === 'local') {
      // TODO: this test fails in the http adapter in Chrome
      it('should allow unicode doc ids', function (done) {
        var db = new PouchDB(dbs.name);
        var ids = [
          // "PouchDB is awesome" in Japanese, contains 1-3 byte chars
          '\u30d1\u30a6\u30c1\u30e5DB\u306f\u6700\u9ad8\u3060',
          '\u03B2', // 2-byte utf-8 char: 3b2
          '\uD843\uDF2D', // exotic 4-byte utf-8 char: 20f2d
          '\u0000foo\u0000bar\u0001baz\u0002quux', // like mapreduce
          '\u0000',
          '\u30d1'
        ];
        var numDone = 0;
        ids.forEach(function (id) {
          var doc = {_id : id, foo : 'bar'};
          db.put(doc).then(function (info) {
            doc._rev = info.rev;
            return db.put(doc);
          }).then(function () {
            return db.get(id);
          }).then(function (resp) {
            resp._id.should.equal(id);
            if (++numDone === ids.length) {
              done();
            }
          }, done);
        });
      });
    }
  });
});
