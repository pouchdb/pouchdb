'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.basics.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
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

    it('destroy a pouch', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        should.exist(db);
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
        should.exist(db);
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

    it('Remove doc twice with specified id', function () {
      var db = new PouchDB(dbs.name);
      return db.put({_id: 'specifiedId', test: 'somestuff'}).then(function () {
        return db.get('specifiedId');
      }).then(function (doc) {
        return db.remove(doc);
      }).then(function () {
        return db.put({
          _id: 'specifiedId',
          test: 'somestuff2'
        });
      }).then(function () {
        return db.get('specifiedId');
      }).then(function (doc) {
        return db.remove(doc);
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

    it('Delete document with many args', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (info) {
        return db.remove(doc._id, info.rev, {});
      });
    });

    it('Delete document with many args, callback style', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo'};
      db.put(doc, function (err, info) {
        should.not.exist(err);
        db.remove(doc._id, info.rev, {}, function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('Delete doc with id + rev + no opts', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (info) {
        return db.remove(doc._id, info.rev);
      });
    });

    it('Delete doc with id + rev + no opts, callback style', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo'};
      db.put(doc, function (err, info) {
        should.not.exist(err);
        db.remove(doc._id, info.rev, function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('Delete doc with doc + opts', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (info) {
        doc._rev = info.rev;
        return db.remove(doc, {});
      });
    });

    it('Delete doc with doc + opts, callback style', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo'};
      db.put(doc, function (err, info) {
        should.not.exist(err);
        doc._rev = info.rev;
        db.remove(doc, {}, function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('Delete doc with rev in opts', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo'};
      return db.put(doc).then(function (info) {
        return db.remove(doc, {rev: info.rev});
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

    it('update with invalid rev', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({test: 'somestuff'}, function (err, info) {
        should.not.exist(err);
        db.put({
          _id: info.id,
          _rev: 'undefined',
          another: 'test'
        }, function (err, info2) {
          should.exist(err);
          err.status.should.equal(PouchDB.Errors.INVALID_REV.status);
          err.message.should.equal(PouchDB.Errors.INVALID_REV.message,
                                   'correct error message returned');
          done();
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
        err.status.should.equal(PouchDB.Errors.DOC_VALIDATION.status);
        err.message.should.equal(PouchDB.Errors.DOC_VALIDATION.message +
                                 ': _zing',
                                 'correct error message returned');
        done();
      });
    });

    it('Replication fields (#2442)', function (done) {
      var doc = {
        '_replication_id': 'test',
        '_replication_state': 'triggered',
        '_replication_state_time': 1,
        '_replication_stats': {}
      };
      var db = new PouchDB(dbs.name);
      db.post(doc, function (err, resp) {
        should.not.exist(err);

        db.get(resp.id, function (err, doc2) {
          should.not.exist(err);

          doc2._replication_id.should.equal('test');
          doc2._replication_state.should.equal('triggered');
          doc2._replication_state_time.should.equal(1);
          doc2._replication_stats.should.eql({});

          done();
        });
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
        err.message.should.equal(PouchDB.Errors.INVALID_ID.message,
                                 'correct error message returned');
        done();
      });
    });

    it('Put doc without _id should fail', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({test: 'somestuff' }, function (err, info) {
        should.exist(err);
        err.message.should.equal(PouchDB.Errors.MISSING_ID.message,
                                 'correct error message returned');
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
        err.status.should.equal(PouchDB.Errors.RESERVED_ID.status);
        err.message.should.equal(PouchDB.Errors.RESERVED_ID.message,
                                 'correct error message returned');
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
      newError.status.should.equal(PouchDB.Errors.BAD_REQUEST.status);
      newError.name.should.equal(PouchDB.Errors.BAD_REQUEST.name);
      newError.message.should.equal(PouchDB.Errors.BAD_REQUEST.message,
                                    'correct error message returned');
      newError.reason.should.equal('love needs no message');
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
              db.destroy(function (err) {
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
                  should.not.exist(doc);
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

    it('Test doc with percent in ID', function () {
      var db = new PouchDB(dbs.name);
      var doc = {
        foo: 'bar',
        _id: 'foo%bar'
      };
      return db.put(doc).then(function (res) {
        res.id.should.equal('foo%bar');
        doc.foo.should.equal('bar');
        return db.get('foo%bar');
      }).then(function (doc) {
        doc._id.should.equal('foo%bar');
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        var x = res.rows[0];
        x.id.should.equal('foo%bar');
        x.doc._id.should.equal('foo%bar');
        x.key.should.equal('foo%bar');
        should.exist(x.doc._rev);
      });
    });

    it('db.info should give correct name', function (done) {
      var db = new PouchDB(dbs.name);
      db.info().then(function (info) {
        info.db_name.should.equal('testdb');
        done();
      });
    });

    it('db.info should give auto_compaction = false (#2744)', function () {
      var db = new PouchDB(dbs.name, { auto_compaction: false});
      return db.info().then(function (info) {
        info.auto_compaction.should.equal(false);
      });
    });

    it('db.info should give auto_compaction = true (#2744)', function () {
      var db = new PouchDB(dbs.name, { auto_compaction: true});
      return db.info().then(function (info) {
        // http doesn't support auto compaction
        info.auto_compaction.should.equal(db.type() !== 'http');
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

    it('putting returns {ok: true}', function () {
      // in couch, it's {ok: true} and in cloudant it's {},
      // but the http adapter smooths this out
      return new PouchDB(dbs.name).then(function (db) {
        return db.put({_id: '_local/foo'}).then(function (info) {
          true.should.equal(info.ok, 'putting local returns ok=true');
          return db.put({_id: 'quux'});
        }).then(function (info) {
          true.should.equal(info.ok, 'putting returns ok=true');
          return db.bulkDocs([ {_id: '_local/bar'}, {_id: 'baz'} ]);
        }).then(function (info) {
          info.should.have.length(2, 'correct num bulk docs');
          true.should.equal(info[0].ok, 'bulk docs says ok=true #1');
          true.should.equal(info[1].ok, 'bulk docs says ok=true #2');
          return db.post({});
        }).then(function (info) {
          true.should.equal(info.ok, 'posting returns ok=true');
        });
      });
    });
    it('putting is override-able', function (done) {
      var db = new PouchDB(dbs.name);
      var called = 0;
      var plugin = {
        initPull: function () {
          this.oldPut = this.put;
          this.put = function () {
            if (typeof arguments[arguments.length - 1] === 'function') {
              called++;
            }
            return this.oldPut.apply(this, arguments);
          };
        },
        cleanupPut: function () {
          this.put = this.oldPut;
        }
      };
      PouchDB.plugin(plugin);
      db.initPull();
      return db.put({foo: 'bar'}, 'anid').then(function (resp) {
        called.should.be.above(0, 'put was called');
        return db.get('anid');
      }).then(function (doc) {
        doc.foo.should.equal('bar', 'correct doc');
      }).then(function () {
        done();
      }, done);
    });

    it('issue 2779, deleted docs, old revs COUCHDB-292', function (done) {
      var db =  new PouchDB(dbs.name);
      var rev;

      db.put({_id: 'foo'}).then(function (resp) {
        rev = resp.rev;
        return db.remove('foo', rev);
      }).then(function () {
        return db.get('foo');
      }).catch(function (err) {
        return db.put({_id: 'foo', _rev: rev});
      }).then(function () {
        done(new Error('should never have got here'));
      }, function (err) {
        should.exist(err);
        done();
      });
    });

    it('issue 2779, correct behavior for undeleting', function () {

      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db =  new PouchDB(dbs.name);
      var rev;

      function checkNumRevisions(num) {
        return db.get('foo', {
          open_revs: 'all',
          revs: true
        }).then(function (fullDocs) {
          fullDocs[0].ok._revisions.ids.should.have.length(num);
        });
      }

      return db.put({_id: 'foo'}).then(function (resp) {
        rev = resp.rev;
        return checkNumRevisions(1);
      }).then(function () {
        return db.remove('foo', rev);
      }).then(function () {
        return checkNumRevisions(2);
      }).then(function () {
        return db.allDocs({keys: ['foo']});
      }).then(function (res) {
        rev = res.rows[0].value.rev;
        return db.put({_id: 'foo', _rev: rev});
      }).then(function () {
        return checkNumRevisions(3);
      });
    });

    it('issue 2888, successive deletes and writes', function () {
      var db = new PouchDB(dbs.name);
      var rev;

      function checkNumRevisions(num) {
        return db.get('foo', {
          open_revs: 'all',
          revs: true
        }).then(function (fullDocs) {
          fullDocs[0].ok._revisions.ids.should.have.length(num);
        });
      }
      return db.put({ _id: 'foo' }).then(function (resp) {
        rev = resp.rev;
        return checkNumRevisions(1);
      }).then(function () {
        return db.remove('foo', rev);
      }).then(function () {
        return checkNumRevisions(2);
      }).then(function () {
        return db.put({ _id: 'foo' });
      }).then(function (res) {
        rev = res.rev;
        return checkNumRevisions(3);
      }).then(function () {
        return db.remove('foo', rev);
      }).then(function () {
        return checkNumRevisions(4);
      });
    });

    it('2 invalid puts', function (done) {
      var db = new PouchDB(dbs.name);
      var called = 0;
      var cb = function() {
        if (++called === 2) {
          done();
        }
      };
      db.put({_id: 'foo', _zing: 'zing'}, cb);
      db.put({_id: 'bar', _zing: 'zing'}, cb);
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

      // this test only really makes sense for IDB
      it('should have same blob support for 2 dbs', function () {
        var db1 = new PouchDB(dbs.name);
        return db1.info().then(function () {
          var db2 = new PouchDB(dbs.name);
          return db2.info().then(function () {
            if (typeof db1._blobSupport !== 'undefined') {
              db1._blobSupport.should.equal(db2._blobSupport,
                'same blob support');
            } else {
              true.should.equal(true);
            }
          });
        });
      });
    }
  });
});
