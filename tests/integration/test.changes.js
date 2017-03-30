
'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {

  describe('test.changes.js-' + adapter, function () {

    var dbs = {};

    // if it exists, return the single element
    // which has the specific id. Else retun null.
    // useful for finding elements within a _changes feed
    function findById(array, id) {
      var result = array.filter(function (i) {
        return i.id === id;
      });

      //
      if (result.length === 1) {
        return result[0];
      }
    }

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      dbs.remote = testUtils.adapterUrl(adapter, 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('All changes', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function () {
        var promise = db.changes({
          }).on('change', function (change) {
            change.should.not.have.property('doc');
            change.should.have.property('seq');
            done();
          });
        should.exist(promise);
        promise.cancel.should.be.a('function');
      });
    });

    it('Promise resolved when changes cancelled', function (done) {
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
        {_id: '10', integer: 10}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, function () {
        var changeCount = 0;
        var promise = db.changes().on('change', function handler() {
          changeCount++;
          if (changeCount === 5) {
            promise.cancel();
            promise.removeListener('change', handler);
          }
        });
        should.exist(promise);
        should.exist(promise.then);
        promise.then.should.be.a('function');
        promise.then(
        function (result) {
          changeCount.should.equal(5, 'changeCount');
          should.exist(result);
          result.should.deep.equal({status: 'cancelled'});
          done();
        }, function (err) {
          changeCount.should.equal(5, 'changeCount');
          should.exist(err);
          done();
        });
      });
    });

    it('Changes Since', function (done) {
      var docs1 = [
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
        {_id: '11', integer: 11}
      ];
      var db = new PouchDB(dbs.name);

      db.bulkDocs({ docs: docs1 }, function () {
        db.info(function (err, info) {
          var update_seq = info.update_seq;

          var docs2 = [
            {_id: '12', integer: 12},
            {_id: '13', integer: 13}
          ];

          db.bulkDocs({ docs: docs2 }, function () {
            var promise = db.changes({
              since: update_seq
            }).on('complete', function (results) {
              results.results.length.should.be.at.least(2);
              done();
            });
            should.exist(promise);
            promise.cancel.should.be.a('function');
          });
        });
      });
    });

    it('Changes Since and limit limit 1', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function () {
        db.info(function (err, info) {
          var update_seq = info.update_seq;

          var docs2 = [
            {_id: '3', integer: 3},
            {_id: '4', integer: 4}
          ];

          db.bulkDocs({ docs: docs2 }, function () {
            db.changes({
              since: update_seq,
              limit: 1
            }).on('complete', function (results) {
              results.results.length.should.equal(1);
              done();
            });
          });
        });
      });
    });

    it('Changes Since and limit limit 0', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function () {
        db.info(function (err, info) {
          var update_seq = info.update_seq;

          var docs2 = [
            {_id: '3', integer: 3},
            {_id: '4', integer: 4}
          ];

          db.bulkDocs({ docs: docs2 }, function () {
            db.changes({
              since: update_seq,
              limit: 0
            }).on('complete', function (results) {
              results.results.length.should.equal(1);
              done();
            });
          });
        });
      });
    });

    it('Changes limit', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var docs2 = [
        {_id: '2', integer: 11},
        {_id: '3', integer: 12}
      ];
      var db = new PouchDB(dbs.name);
      // we use writeDocs since bulkDocs looks to have undefined
      // order of doing insertions
      testUtils.writeDocs(db, docs1, function (err, info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;

        db.info(function (err, info) {
          var update_seq = info.update_seq;

          db.put(docs2[0], function (err, info) {
            docs2[0]._rev = info.rev;
            db.put(docs2[1], function (err, info) {
              docs2[1]._rev = info.rev;
              db.changes({
                limit: 2,
                since: update_seq,
                include_docs: true
              }).on('complete', function (results) {
                results = results.results;
                results.length.should.equal(2);

                // order is not guaranteed
                var first = results[0];
                var second = results[1];
                if (first.id === '3') {
                  second = first;
                  first = results[1];
                }
                first.id.should.equal('2');
                first.doc.integer.should.equal(docs2[0].integer);
                first.doc._rev.should.equal(docs2[0]._rev);
                second.id.should.equal('3');
                second.doc.integer.should.equal(docs2[1].integer);
                second.doc._rev.should.equal(docs2[1]._rev);
                done();
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
        { _id: '_design/foo',
          integer: 4,
          filters: { even: 'function (doc) { return doc.integer % 2 === 1; }' }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function () {
        db.changes({
          filter: 'foo/odd',
          limit: 2,
          include_docs: true
        }).on('error', function (err) {
          err.name.should.equal('not_found');
          err.status.should.equal(testUtils.errors.MISSING_DOC.status,
                                  'correct error status returned');
          done();
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
      testUtils.writeDocs(db, docs, function () {
        db.changes({
          filter: 'foo/even',
          limit: 2,
          include_docs: true
        }).on('error', function (err) {
          err.status.should.equal(testUtils.errors.MISSING_DOC.status,
                                  'correct error status returned');
          err.name.should.equal('not_found');
          done();
        });
      });
    });

    it('Changes limit and filter', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2}
      ];
      var db = new PouchDB(dbs.name);

      var docs2 = [
        {_id: '3', integer: 3},
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {
          _id: '_design/foo',
          integer: 4,
          filters: { even: 'function (doc) { return doc.integer % 2 === 1; }' }
        }
      ];

      db.bulkDocs({ docs: docs1 }, function () {
        db.info(function (err, info) {
          var update_seq = info.update_seq;

          testUtils.writeDocs(db, docs2, function () {
            var promise = db.changes({
              filter: 'foo/even',
              limit: 2,
              since: update_seq,
              include_docs: true
            }).on('complete', function (results) {
              results.results.length.should.equal(2);
              var three = findById(results.results, '3');
              three.doc.integer.should.equal(3);
              var five = findById(results.results, '5');
              five.doc.integer.should.equal(5);
              done();
            }).on('error', done);
            should.exist(promise);
            promise.cancel.should.be.a('function');
          });
        });
      });
    });

    it('Changes with shorthand function name', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {
          _id: '_design/even',
          integer: 3,
          filters: { even: 'function (doc) { return doc.integer % 2 === 0; }' }
        }
      ];
      var db = new PouchDB(dbs.name);

      db.bulkDocs({ docs: docs }, function () {
        var promise = db.changes({
          filter: 'even',
          include_docs: true
        }).on('complete', function (results) {
          results.results.length.should.equal(2);
          var zero = findById(results.results, '0');
          zero.doc.integer.should.equal(0);
          var two = findById(results.results, '2');
          two.doc.integer.should.equal(2);
          done();
        }).on('error', done);
        should.exist(promise);
        promise.cancel.should.be.a('function');
      });
    });

    it('Changes with filter from nonexistent ddoc', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1}
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function () {
        db.changes({
          filter: 'foobar/odd'
        }).on('error', function (err) {
          should.exist(err);
          done();
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
          views:
            { even:
              { map: 'function (doc) { if (doc.integer % 2 === 1) { ' +
                     'emit(doc._id, null) }; }' } }
        }
      ];
      var db = new PouchDB(dbs.name);
      testUtils.writeDocs(db, docs, function () {
        db.changes({
          filter: '_view',
          view: 'foo/odd'
        }).on('error', function (err) {
          err.status.should.equal(testUtils.errors.MISSING_DOC.status,
                                  'correct error status returned');
          err.name.should.equal('not_found');
          done();
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
      testUtils.writeDocs(db, docs, function () {
        db.changes({
          filter: '_view',
          view: 'foo/even'
        }).on('error', function (err) {
          err.status.should.equal(testUtils.errors.MISSING_DOC.status,
                                  'correct error status returned');
          err.name.should.equal('not_found');
          done();
        });
      });
    });

    it('#4451 Changes with invalid view filter', function (done) {
      var docs = [
        {_id: '1', integer: 1},
        {
          _id: '_design/foo',
          filters: { even: 'function (doc) { return doc.integer % 2 === 1; }' }
        }
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs(docs).then(function () {
        db.changes({filter: 'a/b/c'}).on('error', function () {
          done('should not be called');
        }).on('complete', function () {
          done();
        });
      });
    });

    it('3356 throw inside a filter', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({
        _id: "_design/test",
        filters: {
          test: function () {
            throw new Error(); // syntaxerrors can't be caught either.
          }.toString()
        }
      }).should.eventually.be.fulfilled.then(function () {
        return db.changes({filter: 'test/test'}).should.eventually.be.rejected;
      }).then(function () {
        done();
      }).catch(function (err) {
        done('We had an error - ' + err);
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
      testUtils.writeDocs(db, docs, function () {
        db.changes({
          filter: '_view'
        }).on('error', function (err) {
          err.status.should.equal(testUtils.errors.BAD_REQUEST.status,
                                  'correct error status returned');
          err.name.should.equal('bad_request');
          done();
        });
      });
    });

    it('Changes limit and view instead of filter', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function () {
        db.info(function (err, info) {
          var update_seq = info.update_seq;

          var docs2 = [
            {_id: '3', integer: 3},
            {_id: '4', integer: 4},
            {_id: '5', integer: 5},
            {
              _id: '_design/foo',
              integer: 4,
              views: { even: { map: 'function (doc) ' +
                '{ if (doc.integer % 2 === 1) ' +
                '{ emit(doc._id, null) }; }'
                }
              }
            }
          ];

          db.bulkDocs({ docs: docs2 }, function () {

            db.changes({
              filter: '_view',
              view: 'foo/even',
              limit: 2,
              since: update_seq,
              include_docs: true
            }).on('complete', function (results) {
              var changes = results.results;
              changes.length.should.equal(2);

              findById(changes, '3')
                .doc.integer.should.equal(3);

              findById(changes, '5')
                .doc.integer.should.equal(5);

              done();
            }).on('error', done);
          });
        });
      });
    });

    it('#3609 view option implies filter: _view', function () {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '_design/foo', integer: 3,
         views: {
           even: {
             map: 'function (doc) { if (doc.integer % 2 === 1) ' +
               '{ emit(doc._id, null) }; }'
           }
         }
        }
      ];

      var db = new PouchDB(dbs.name);
      return db.bulkDocs(docs).then(function () {
        return db.changes({view: 'foo/even'});
      }).then(function (changes) {
        changes.results.length.should.equal(2);
      });
    });

    it('Changes last_seq', function (done) {
      // this test doesn't really make sense for clustered
      // CouchDB because changes is unordered and last_seq might
      // not equal the last seq in the _changes feed (although it
      // should evaluate to the same thing on the server).
      if (testUtils.isCouchMaster()) {
        return done();
      }

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
      db.changes().on('complete', function (results) {
        results.last_seq.should.equal(0);
        db.bulkDocs({ docs: docs }, function () {
          db.changes().on('complete', function (results) {
            results.last_seq.should.equal(5);
            db.changes({
              filter: 'foo/even'
            }).on('complete', function (results) {
              results.last_seq.should.equal(5);
              results.results.length.should.equal(2);
              done();
            }).on('error', done);
          }).on('error', done);
        });
      }).on('error', done);
    });

    it('Immediately cancel changes', function () {
      // fixes code coverage by ensuring the changes() listener
      // emits 'complete' even if the db's task queue isn't
      // ready yet
      return new testUtils.Promise(function (resolve, reject) {
        var db = new PouchDB(dbs.name);
        var changes = db.changes({live: true});
        changes.on('error', reject);
        changes.on('complete', resolve);
        changes.cancel();
      });
    });

    it('Changes with invalid ddoc view name', function () {
      return new testUtils.Promise(function (resolve, reject) {
        var db = new PouchDB(dbs.name);
        db.post({});
        var changes = db.changes({live: true, filter: '_view', view: ''});
        changes.on('error', resolve);
        changes.on('change', reject);
      });
    });

    it('Changes with invalid ddoc view name 2', function () {
      return new testUtils.Promise(function (resolve, reject) {
        var db = new PouchDB(dbs.name);
        db.post({});
        var changes = db.changes({live: true, filter: '_view', view: 'a/b/c'});
        changes.on('error', resolve);
        changes.on('change', reject);
      });
    });

    if (adapter === 'local') {
      // This test crashes due to an invalid JSON response from CouchDB:
      // https://issues.apache.org/jira/browse/COUCHDB-2765
      // We could remove the "if" check and put a try/catch in our
      // JSON parsing, but since this is a super-rare bug it may not be
      // worth our time. This test does increase code coverage for our
      // own local code, though.
      it('Changes with invalid ddoc with no map function', function () {
        // CouchDB 2.X does not allow saving of invalid design docs,
        // so this test is not valid
        if (testUtils.isCouchMaster()) {
          return testUtils.Promise.resolve();
        }

        var db = new PouchDB(dbs.name);
        return db.put({
          _id: '_design/name',
          views: {
            name: {
              empty: 'sad face'
            }
          }
        }).then(function () {
          return new testUtils.Promise(function (resolve, reject) {
            var changes = db.changes({
              live: true,
              filter: '_view',
              view: 'name/name'
            });
            changes.on('error', resolve);
            changes.on('change', reject);
          });
        });
      });
    }

    it('Changes with invalid ddoc with no filter function', function () {
      // CouchDB 2.X does not allow saving of invalid design docs,
      // so this test is not valid
      if (testUtils.isCouchMaster()) {
        return testUtils.Promise.resolve();
      }

      var db = new PouchDB(dbs.name);
      return db.put({
        _id: '_design/name',
        views: {
          name: {
            empty: 'sad face'
          }
        }
      }).then(function () {
        return new testUtils.Promise(function (resolve, reject) {
          var changes = db.changes({
            live: true,
            filter: 'name/name'
          });
          changes.on('error', resolve);
          changes.on('change', reject);
        });
      });
    });

    it('Changes last_seq with view instead of filter', function (done) {
      // this test doesn't really make sense for clustered
      // CouchDB because changes is unordered and last_seq might
      // not equal the last seq in the _changes feed (although it
      // should evaluate to the same thing on the server).
      if (testUtils.isCouchMaster()) {
        return done();
      }

      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
        {
          _id: '_design/foo',
          integer: 4,
          views:
            { even:
              { map: 'function (doc) { if (doc.integer % 2 === 1) { ' +
                     'emit(doc._id, null) }; }' } }
        }
      ];
      var db = new PouchDB(dbs.name);
      db.changes().on('complete', function (results) {
        results.last_seq.should.equal(0);
        db.bulkDocs({ docs: docs }, function () {
          db.changes().on('complete', function (results) {
            results.last_seq.should.equal(5);
            db.changes({
              filter: '_view',
              view: 'foo/even'
            }).on('complete', function (results) {
              results.last_seq.should.equal(5);
              results.results.length.should.equal(2);
              done();
            }).on('error', done);
          }).on('error', done);
        });
      }).on('error', done);
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
        db.changes().on('complete', function (res) {
          res.results[0].changes.length.should.equal(1);
          res.results[0].changes[0].rev.should.equal('4-f');
          db.changes({
            style: 'all_docs'
          }).on('complete', function (res) {
            res.results[0].changes.length.should.equal(3);
            var changes = res.results[0].changes;
            changes.sort(function (a, b) {
              return a.rev < b.rev;
            });
            changes[0].rev.should.equal('4-f');
            changes[1].rev.should.equal('3-c');
            changes[2].rev.should.equal('2-g');
            done();
          }).on('error', done);
        }).on('error', done);
      });
    });

    it('Changes with style = all_docs and a callback for complete',
      function (done) {
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
        db.changes(function (err, res) {
          res.results[0].changes.length.should.equal(1);
          res.results[0].changes[0].rev.should.equal('4-f');
          db.changes({
            style: 'all_docs'
          }, function (err, res) {
            should.not.exist(err);
            res.results[0].changes.length.should.equal(3);
            var changes = res.results[0].changes;
            changes.sort(function (a, b) {
              return a.rev < b.rev;
            });
            changes[0].rev.should.equal('4-f');
            changes[1].rev.should.equal('3-c');
            changes[2].rev.should.equal('2-g');
            done();
          });
        });
      });
    });

    it('Changes limit = 0', function (done) {
      var docs = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, function () {
        db.changes({
          limit: 0
        }).on('complete', function (results) {
          results.results.length.should.equal(1);
          done();
        }).on('error', done);
      });
    });

    // Note for the following test that CouchDB's implementation of /_changes
    // with `descending=true` ignores any `since` parameter.
    it('Descending changes', function (done) {
      // _changes in CouchDB 2.0 does not guarantee order
      // so skip this test
      if (testUtils.isCouchMaster()) {
        return done();
      }
      var db = new PouchDB(dbs.name);
      db.post({_id: '0', test: 'ing'}, function () {
        db.post({_id: '1', test: 'ing'}, function () {
          db.post({_id: '2', test: 'ing'}, function () {
            db.changes({
              descending: true,
              since: 1
            }).on('complete', function (results) {
              results.results.length.should.equal(3);
              var ids = ['2', '1', '0'];
              results.results.forEach(function (row, i) {
                row.id.should.equal(ids[i]);
              });
              done();
            }).on('error', done);
          });
        });
      });
    });

    it('Changes doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function () {
        db.changes({
          include_docs: true
        }).on('change', function (change) {
          change.doc._id.should.equal(change.id);
          change.doc._rev.should
            .equal(change.changes[change.changes.length - 1].rev);
          done();
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
      db.bulkDocs({ docs: docs }, function (err) {
        if (err) {
          return done(err);
        }
        db.changes({
          descending: true
        }).on('change', function () {
          changes++;
        }).on('complete', function () {
          changes.should.equal(num, 'correct number of changes');
          done();
        }).on('error', function (err) {
          done(err);
        });
      });
    });

    it('changes w/ many modifications of same doc', function () {
      // this test depends on the order of changes
      // so fails against CouchDB 2 when multiple shards are present
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);
      var promise = testUtils.Promise.resolve();
      var doc = {_id: '1'};
      function modifyDoc() {
        return db.put(doc).then(function (res) {
          doc._rev = res.rev;
        });
      }
      for (var i  = 0; i < 5; i++) {
        promise = promise.then(modifyDoc);
      }
      return promise.then(function () {
        return db.bulkDocs([
          {_id: '2'},
          {_id: '3'},
          {_id: '4'},
          {_id: '5'}
        ]);
      }).then(function () {
        return db.changes({since: 0, limit: 3}).then(function (res) {
          res.results.map(function (x) {
            delete x.changes;
            delete x.seq;
            return x;
          }).should.deep.equal([
            { "id": "1" },
            { "id": "2" },
            { "id": "3" }
          ]);
        });
      });
    });

    it('live-changes', function (done) {
      var db = new PouchDB(dbs.name);
      var count = 0;
      var changes = db.changes({
        live: true
      }).on('complete', function () {
        count.should.equal(1);
        done();
      }).on('change', function (change) {
        count += 1;
        change.should.not.have.property('doc');
        count.should.equal(1);
        changes.cancel();
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
        live: true
      }).on('complete', function () {
        changes1Complete = true;
        checkCount();
      }).on('change', function () {
        count += 1;
        changes1.cancel();
        changes1 = null;
      }).on('error', done);
      var changes2 = db.changes({
        live: true
      }).on('complete', function () {
        changes2Complete = true;
        checkCount();
      }).on('change', function () {
        count += 1;
        changes2.cancel();
        changes2 = null;
      }).on('error', done);
      db.post({test: 'adoc'});
    });

    it('Continuous changes doc', function (done) {
      var db = new PouchDB(dbs.name);
      var changes = db.changes({
        live: true,
        include_docs: true
      }).on('complete', function (result) {
        result.status.should.equal('cancelled');
        done();
      }).on('change', function (change) {
        change.should.have.property('doc');
        change.doc.should.have.property('_rev');
        changes.cancel();
      }).on('error', done);
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
        live: true
      }).on('complete', function (result) {
        result.status.should.equal('cancelled');
        // This setTimeout ensures that once we cancel a change we dont recieve
        // subsequent callbacks, so it is needed
        interval = setInterval(waitForDocPosted, 100);
      }).on('change', function () {
        count += 1;
        if (count === 1) {
          changes.cancel();
          db.post({ test: 'another doc' }, function (err) {
            if (err) {
              return done(err);
            }
            docPosted = true;
          });
        }
      });
      db.post({ test: 'adoc' });
    });


    it("#3579 changes firing 1 too many times", function () {
      var db = new PouchDB(dbs.name);
      var Promise = testUtils.Promise;
      return db.bulkDocs([{}, {}, {}]).then(function () {
        var changes = db.changes({
          since: 'now',
          live: true,
          include_docs: true
        });
        return Promise.all([
          new Promise(function (resolve, reject) {
            changes.on('error', reject);
            changes.on('change', function (change) {
              changes.cancel();
              resolve(change);
            });
          }),
          new Promise(function (resolve) {
            setTimeout(resolve, 50);
          }).then(function () {
              return db.put({_id: 'foobar'});
            })
        ]);
      }).then(function (result) {
        var change = result[0];
        change.id.should.equal('foobar');
        change.doc._id.should.equal('foobar');
      });
    });

    it('Kill database while listening to live changes', function (done) {
      var db = new PouchDB(dbs.name);

      db.changes({live: true})
        .on('error', function () { done(); })
        .on('complete', function () { done(); })
        .on('change', function () { db.destroy().catch(done); });

      db.post({ test: 'adoc' });
    });

    it('#3136 style=all_docs', function () {

      var db = new PouchDB(dbs.name);

      var chain = testUtils.Promise.resolve();

      var docIds = ['b', 'c', 'a', 'z', 'd', 'e'];

      docIds.forEach(function (docId) {
        chain = chain.then(function () {
          return db.put({_id: docId});
        });
      });

      return chain.then(function () {
        return db.changes({style: 'all_docs'});
      }).then(function (res) {
        var ids = res.results.map(function (x) {
          return x.id;
        });
        ids.should.include.members(docIds);
      });
    });

    it('#4191 revs_diff causes endless loop', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      return db.bulkDocs({
        "new_edits": false,
        "docs": [{"_id": "799","_rev":"1-d22"}
        ]}).then(function () {
        return db.bulkDocs({
          "new_edits": false,
          "docs": [{"_id": "3E1", "_rev": "1-ab5"}]
        });
      }).then(function () {
        return db.bulkDocs(
          { new_edits: false,
            docs:
              [ { _id: 'FB3', _rev: '1-363' },
                { _id: '27C', _rev: '1-4c3' },
                { _id: 'BD6', _rev: '1-de0' },
                { _id: '1E9', _rev: '1-451' } ] }
        );
      }).then(function () {
        return db.changes({style: 'all_docs', limit: 100});
      }).then(function (res) {
        var lastSeq = res.last_seq;
        return db.changes({since: lastSeq, style: 'all_docs', limit: 100});
      }).then(function (res) {
        res.results.should.have.length(0);
      });
    });

    it('#3136 style=all_docs & include_docs', function () {

      var db = new PouchDB(dbs.name);

      var chain = testUtils.Promise.resolve();

      var docIds = ['b', 'c', 'a', 'z', 'd', 'e'];

      docIds.forEach(function (docId) {
        chain = chain.then(function () {
          return db.put({_id: docId});
        });
      });

      return chain.then(function () {
        return db.changes({
          style: 'all_docs',
          include_docs: true
        });
      }).then(function (res) {
        var ids = res.results.map(function (x) {
          return x.id;
        });
        ids.should.include.members(docIds);
      });
    });

    it('#3136 tricky changes, limit/descending', function () {
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);

      var docs = [
        {
          _id: 'alpha',
          _rev: '1-a',
          _revisions: {
            start: 1,
            ids: ['a']
          }
        }, {
          _id: 'beta',
          _rev: '1-b',
          _revisions: {
            start: 1,
            ids: ['b']
          }
        }, {
          _id: 'gamma',
          _rev: '1-b',
          _revisions: {
            start: 1,
            ids: ['b']
          }
        }, {
          _id: 'alpha',
          _rev: '2-d',
          _revisions: {
            start: 2,
            ids: ['d', 'a']
          }
        }, {
          _id: 'beta',
          _rev: '2-e',
          _revisions: {
            start: 2,
            ids: ['e', 'b']
          }
        }, {
          _id: 'beta',
          _rev: '3-f',
          _deleted: true,
          _revisions: {
            start: 3,
            ids: ['f', 'e', 'b']
          }
        }
      ];

      var chain = testUtils.Promise.resolve();
      var seqs = [];

      docs.forEach(function (doc) {
        chain = chain.then(function () {
          return db.bulkDocs([doc], {new_edits: false}).then(function () {
            return db.changes({doc_ids: [doc._id]});
          }).then(function (res) {
            seqs.push(res.results[0].seq);
          });
        });
      });

      function normalizeResult(result) {
        // order of changes doesn't matter
        result.results.forEach(function (ch) {
          ch.changes = ch.changes.sort(function (a, b) {
            return a.rev < b.rev ? -1 : 1;
          });
        });
      }

      return chain.then(function () {
        return db.changes();
      }).then(function (result) {
        normalizeResult(result);
        result.should.deep.equal({
          "results": [
            {
              "seq": seqs[2],
              "id": "gamma",
              "changes": [{ "rev": "1-b"}
              ]
            },
            {
              "seq": seqs[3],
              "id": "alpha",
              "changes": [{ "rev": "2-d"}
              ]
            },
            {
              "seq": seqs[5],
              "id": "beta",
              "deleted": true,
              "changes": [{ "rev": "3-f"}
              ]
            }
          ],
          "last_seq": seqs[5]
        });
        return db.changes({limit: 0});
      }).then(function (result) {
        normalizeResult(result);
        result.should.deep.equal({
          "results": [{
            "seq": seqs[2],
            "id": "gamma",
            "changes": [{"rev": "1-b"}]
          }],
          "last_seq": seqs[2]
        }, '1:' + JSON.stringify(result));
        return db.changes({limit: 1});
      }).then(function (result) {
        normalizeResult(result);
        result.should.deep.equal({
          "results": [{
            "seq": seqs[2],
            "id": "gamma",
            "changes": [{"rev": "1-b"}]
          }],
          "last_seq": seqs[2]
        }, '2:' + JSON.stringify(result));
        return db.changes({limit: 2});
      }).then(function (result) {
        normalizeResult(result);
        result.should.deep.equal({
          "results": [{
            "seq": seqs[2],
            "id": "gamma",
            "changes": [{"rev": "1-b"}]
          }, {"seq": seqs[3], "id": "alpha", "changes": [{"rev": "2-d"}]}],
          "last_seq": seqs[3]
        }, '3:' + JSON.stringify(result));
        return db.changes({limit: 1, descending: true});
      }).then(function (result) {
        normalizeResult(result);
        result.should.deep.equal({
          "results": [{
            "seq": seqs[5],
            "id": "beta",
            "changes": [{"rev": "3-f"}],
            "deleted": true
          }],
          "last_seq": seqs[5]
        }, '4:' + JSON.stringify(result));
        return db.changes({limit: 2, descending: true});
      }).then(function (result) {
        normalizeResult(result);
        var expected = {
          "results": [{
            "seq": seqs[5],
            "id": "beta",
            "changes": [{"rev": "3-f"}],
            "deleted": true
          }, {"seq": seqs[3], "id": "alpha", "changes": [{"rev": "2-d"}]}],
          "last_seq": seqs[3]
        };
        result.should.deep.equal(expected, '5:' + JSON.stringify(result) +
        ', shoulda got: ' + JSON.stringify(expected));
        return db.changes({descending: true});
      }).then(function (result) {
        normalizeResult(result);
        var expected = {
          "results": [{
            "seq": seqs[5],
            "id": "beta",
            "changes": [{"rev": "3-f"}],
            "deleted": true
          }, {"seq": seqs[3], "id": "alpha", "changes": [{"rev": "2-d"}]}, {
            "seq": seqs[2],
            "id": "gamma",
            "changes": [{"rev": "1-b"}]
          }],
          "last_seq": seqs[2]
        };
        result.should.deep.equal(expected, '6:' + JSON.stringify(result) +
        ', shoulda got: ' + JSON.stringify(expected));
      });
    });

    it('#3176 winningRev has a lower seq, descending', function () {
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);
      var tree = [
        [
          {
            _id: 'foo',
            _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}
          },
          {
            _id: 'foo',
            _rev: '2-e',
            _deleted: true,
            _revisions: {start: 2, ids: ['e', 'a']}
          },
          {
            _id: 'foo',
            _rev: '3-g',
            _revisions: {start: 3, ids: ['g', 'e', 'a']}
          }
        ],
        [
          {
            _id: 'foo',
            _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}
          },
          {
            _id: 'foo',
            _rev: '2-b',
            _revisions: {start: 2, ids: ['b', 'a']}
          },
          {
            _id: 'foo',
            _rev: '3-c',
            _revisions: {start: 3, ids: ['c', 'b', 'a']}
          }
        ]
      ];

      var chain = testUtils.Promise.resolve();
      var seqs = [0];

      function getExpected(i) {
        var expecteds = [
          {
            "results": [
              {
                "seq": seqs[1],
                "id": "foo",
                "changes": [{"rev": "3-g"}]
              }
            ],
            "last_seq" : seqs[1]
          },
          {
            "results": [
              {
                "seq": seqs[2],
                "id": "foo",
                "changes": [{"rev": "3-g"}]
              }
            ],
            "last_seq" : seqs[2]
          }
        ];
        return expecteds[i];
      }

      function normalizeResult(result) {
        // order of changes doesn't matter
        result.results.forEach(function (ch) {
          ch.changes = ch.changes.sort(function (a, b) {
            return a.rev < b.rev ? -1 : 1;
          });
        });
      }

      tree.forEach(function (docs, i) {
        chain = chain.then(function () {
          return db.bulkDocs(docs, {new_edits: false}).then(function () {
            return db.changes({
              descending: true
            });
          }).then(function (result) {
            seqs.push(result.last_seq);
            var expected = getExpected(i);
            normalizeResult(result);
            result.should.deep.equal(expected,
            i + ': should get: ' + JSON.stringify(expected) +
            ', but got: ' + JSON.stringify(result));
          });
        });
      });
      return chain;
    });

    it('#3136 winningRev has a lower seq, style=all_docs', function () {
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);
      var tree = [
        [
          {
            _id: 'foo',
            _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}
          },
          {
            _id: 'foo',
            _rev: '2-e',
            _deleted: true,
            _revisions: {start: 2, ids: ['e', 'a']}
          },
          {
            _id: 'foo',
            _rev: '3-g',
            _revisions: {start: 3, ids: ['g', 'e', 'a']}
          }
        ],
        [
          {
            _id: 'foo',
            _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}
          },
          {
            _id: 'foo',
            _rev: '2-b',
            _revisions: {start: 2, ids: ['b', 'a']}
          },
          {
            _id: 'foo',
            _rev: '3-c',
            _revisions: {start: 3, ids: ['c', 'b', 'a']}
          }
        ],
        [
          {
            _id: 'foo',
            _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}
          },
          {
            _id: 'foo',
            _rev: '2-d',
            _revisions: {start: 2, ids: ['d', 'a']}
          },
          {
            _id: 'foo',
            _rev: '3-h',
            _revisions: {start: 3, ids: ['h', 'd', 'a']}
          },
          {
            _id: 'foo',
            _rev: '4-f',
            _revisions: {start: 4, ids: ['f', 'h', 'd', 'a']}
          }
        ]
      ];

      var chain = testUtils.Promise.resolve();
      var seqs = [0];

      function getExpected(i) {
        var expecteds = [
          {
            "results": [
              {
                "seq": seqs[1],
                "id": "foo",
                "changes": [{"rev": "3-g"}],
                "doc": {"_id": "foo", "_rev": "3-g"}
              }
            ],
            "last_seq" : seqs[1]
          },
          {
            "results": [
              {
                "seq": seqs[2],
                "id": "foo",
                "changes": [{"rev": "3-c"}, {"rev": "3-g"}],
                "doc": {"_id": "foo", "_rev": "3-g"}
              }
            ],
            "last_seq" : seqs[2]
          },
          {
            "results": [
              {
                "seq": seqs[3],
                "id": "foo",
                "changes": [{"rev": "3-c"}, {"rev": "3-g"}, {"rev": "4-f"}],
                "doc": {"_id": "foo", "_rev": "4-f"}
              }
            ],
            "last_seq" : seqs[3]
          }
        ];
        return expecteds[i];
      }

      function normalizeResult(result) {
        // order of changes doesn't matter
        result.results.forEach(function (ch) {
          ch.changes = ch.changes.sort(function (a, b) {
            return a.rev < b.rev ? -1 : 1;
          });
        });
      }

      tree.forEach(function (docs, i) {
        chain = chain.then(function () {
          return db.bulkDocs(docs, {new_edits: false}).then(function () {
            return db.changes({
              style: 'all_docs',
              since: seqs[seqs.length - 1],
              include_docs: true
            });
          }).then(function (result) {
            seqs.push(result.last_seq);
            var expected = getExpected(i);
            normalizeResult(result);
            result.should.deep.equal(expected,
            i + ': should get: ' + JSON.stringify(expected) +
            ', but got: ' + JSON.stringify(result));
          });
        });
      });
      return chain;
    });

    it('#3136 winningRev has a lower seq, style=all_docs 2', function () {
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);
      var tree = [
        [
          {
            _id: 'foo',
            _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}
          },
          {
            _id: 'foo',
            _rev: '2-e',
            _deleted: true,
            _revisions: {start: 2, ids: ['e', 'a']}
          },
          {
            _id: 'foo',
            _rev: '3-g',
            _revisions: {start: 3, ids: ['g', 'e', 'a']}
          }
        ], [
          {
            _id: 'foo',
            _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}
          },
          {
            _id: 'foo',
            _rev: '2-b',
            _revisions: {start: 2, ids: ['b', 'a']}
          },
          {
            _id: 'foo',
            _rev: '3-c',
            _revisions: {start: 3, ids: ['c', 'b', 'a']}
          }
        ], [
          {
            _id: 'bar',
            _rev: '1-z',
            _revisions: {start: 1, ids: ['z']}
          }
        ]
      ];

      var chain = testUtils.Promise.resolve();
      var seqs = [0];

      tree.forEach(function (docs) {
        chain = chain.then(function () {
          return db.bulkDocs(docs, {new_edits: false}).then(function () {
            return db.changes();
          }).then(function (result) {
            seqs.push(result.last_seq);
          });
        });
      });

      return chain.then(function () {

        var expecteds = [
          {
            "results": [{
              "seq": seqs[2],
              "id": "foo",
              "changes": [{"rev": "3-c"}, {"rev": "3-g"}]
            }, {"seq": seqs[3], "id": "bar", "changes": [{"rev": "1-z"}]}],
            "last_seq": seqs[3]
          },
          {
            "results": [{
              "seq": seqs[2],
              "id": "foo",
              "changes": [{"rev": "3-c"}, {"rev": "3-g"}]
            }, {"seq": seqs[3], "id": "bar", "changes": [{"rev": "1-z"}]}],
            "last_seq": seqs[3]
          },
          {
            "results": [{"seq": seqs[3], "id": "bar",
              "changes": [{"rev": "1-z"}]}],
            "last_seq": seqs[3]
          },
          {"results": [], "last_seq": seqs[3]}
        ];

        var chain2 = testUtils.Promise.resolve();

        function normalizeResult(result) {
          // order of changes doesn't matter
          result.results.forEach(function (ch) {
            ch.changes = ch.changes.sort(function (a, b) {
              return a.rev < b.rev ? -1 : 1;
            });
          });
        }

        seqs.forEach(function (seq, i) {
          chain2 = chain2.then(function () {
            return db.changes({
              since: seq,
              style: 'all_docs'
            }).then(function (res) {
              normalizeResult(res);
              res.should.deep.equal(expecteds[i], 'since=' + seq +
              ': got: ' +
              JSON.stringify(res) +
              ', shoulda got: ' +
              JSON.stringify(expecteds[i]));
            });
          });
        });
        return chain2;
      });
    });

    it('#3136 winningRev has a higher seq, using limit', function () {
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);
      var tree = [
        [
          {
            _id: 'foo',
            _rev: '1-a',
            _revisions: {start: 1, ids: ['a']}
          }
        ], [
          {
            _id: 'foo',
            _rev: '2-b',
            _revisions: {start: 2, ids: ['b', 'a']}
          }
        ], [
          {
            _id: 'bar',
            _rev: '1-x',
            _revisions: {start: 1, ids: ['x']}
          }
        ], [
          {
            _id: 'foo',
            _rev: '2-c',
            _deleted: true,
            _revisions: {start: 2, ids: ['c', 'a']}
          }
        ]
      ];

      var chain = testUtils.Promise.resolve();
      var seqs = [0];

      tree.forEach(function (docs) {
        chain = chain.then(function () {
          return db.bulkDocs(docs, {new_edits: false}).then(function () {
            return db.changes().then(function (result) {
              seqs.push(result.last_seq);
            });
          });
        });
      });

      return chain.then(function () {

        var expecteds = [{
          "results": [{
            "seq": seqs[3],
            "id": "bar",
            "changes": [{"rev": "1-x"}],
            "doc": {"_id": "bar", "_rev": "1-x"}
          }],
          "last_seq": seqs[3]
        },
          {
            "results": [{
              "seq": seqs[3],
              "id": "bar",
              "changes": [{"rev": "1-x"}],
              "doc": {"_id": "bar", "_rev": "1-x"}
            }],
            "last_seq": seqs[3]
          },
          {
            "results": [{
              "seq": seqs[3],
              "id": "bar",
              "changes": [{"rev": "1-x"}],
              "doc": {"_id": "bar", "_rev": "1-x"}
            }],
            "last_seq": seqs[3]
          },
          {
            "results": [{
              "seq": seqs[4],
              "id": "foo",
              "changes": [{"rev": "2-b"}, {"rev": "2-c"}],
              "doc": {"_id": "foo", "_rev": "2-b"}
            }],
            "last_seq": seqs[4]
          },
          {"results": [], "last_seq": seqs[4]}
        ];

        var chain2 = testUtils.Promise.resolve();

        function normalizeResult(result) {
          // order of changes doesn't matter
          result.results.forEach(function (ch) {
            ch.changes = ch.changes.sort(function (a, b) {
              return a.rev < b.rev ? -1 : 1;
            });
          });
        }

        seqs.forEach(function (seq, i) {
          chain2 = chain2.then(function () {
            return db.changes({
              style: 'all_docs',
              since: seq,
              limit: 1,
              include_docs: true
            });
          }).then(function (result) {
            normalizeResult(result);
            result.should.deep.equal(expecteds[i],
              i + ': got: ' + JSON.stringify(result) +
              ', shoulda got: ' + JSON.stringify(expecteds[i]));
          });
        });
        return chain2;
      });
    });

    it('changes-filter', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var docs2 = [
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {_id: '6', integer: 6},
        {_id: '7', integer: 7}
      ];
      var db = new PouchDB(dbs.name);
      var count = 0;
      db.bulkDocs({ docs: docs1 }, function () {
        var changes = db.changes({
          filter: function (doc) {
            return doc.integer % 2 === 0;
          },
          live: true
        }).on('complete', function (result) {
          result.status.should.equal('cancelled');
          done();
        }).on('change', function () {
          count += 1;
          if (count === 4) {
            changes.cancel();
          }
        }).on('error', done);
        db.bulkDocs({ docs: docs2 });
      });
    });

    it('changes-filter with query params', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var docs2 = [
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {_id: '6', integer: 6},
        {_id: '7', integer: 7}
      ];
      var params = { 'abc': true };
      var db = new PouchDB(dbs.name);
      var count = 0;
      db.bulkDocs({ docs: docs1 }, function () {
        var changes = db.changes({
          filter: function (doc, req) {
            if (req.query.abc) {
              return doc.integer % 2 === 0;
            }
          },
          query_params: params,
          live: true
        }).on('complete', function (result) {
          result.status.should.equal('cancelled');
          done();
        }).on('change', function () {
          count += 1;
          if (count === 4) {
            changes.cancel();
          }
        }).on('error', done);
        db.bulkDocs({ docs: docs2 });
      });
    });

    it('Non-live changes filter', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function () {
        db.changes().on('complete', function (allChanges) {
          db.changes({
            filter: function (doc) {
              return doc.integer % 2 === 0;
            }
          }).on('complete', function (filteredChanges) {
            // Should get docs 0 and 2 if the filter
            // has been applied correctly.
            filteredChanges.results.length.should.equal(2);
            filteredChanges.last_seq.should.deep.equal(allChanges.last_seq);
            done();
          }).on('error', done);
        }).on('error', done);
      });
    });

    it('Non-live changes filter, descending', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function () {
        db.changes({
          descending: true
        }).on('complete', function (allChanges) {
          db.changes({
            descending: true,
            filter: function (doc) {
              return doc.integer > 2;
            }
          }).on('complete', function (filteredChanges) {
            // Should get docs 2 and 3 if the filter
            // has been applied correctly.
            filteredChanges.results.length.should.equal(1);
            filteredChanges.last_seq.should.deep.equal(allChanges.last_seq);
            done();
          }).on('error', done);
        }).on('error', done);
      });
    });

    it('#2569 Non-live doc_ids filter', function () {
      var docs = [
        {_id: '0'},
        {_id: '1'},
        {_id: '2'},
        {_id: '3'}
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs(docs).then(function () {
        return db.changes({
          doc_ids: ['1', '3']
        });
      }).then(function (changes) {
        var ids = changes.results.map(function (x) {
          return x.id;
        });
        ids.sort().should.deep.equal(['1', '3']);
      });
    });

    it('#2569 Big non-live doc_ids filter', function () {
      var docs = [];
      for (var i = 0; i < 5; i++) {
        var id = '';
        for (var j = 0; j < 50; j++) {
          // make a huge id
          id += testUtils.btoa(Math.random().toString());
        }
        docs.push({_id: id});
      }
      var db = new PouchDB(dbs.name);
      return db.bulkDocs(docs).then(function () {
        return db.changes({
          doc_ids: [docs[1]._id, docs[3]._id]
        });
      }).then(function (changes) {
        var ids = changes.results.map(function (x) {
          return x.id;
        });
        var expectedIds = [docs[1]._id, docs[3]._id];
        ids.sort().should.deep.equal(expectedIds.sort());
      });
    });

    it('#2569 Live doc_ids filter', function () {
      var docs = [
        {_id: '0'},
        {_id: '1'},
        {_id: '2'},
        {_id: '3'}
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs(docs).then(function () {
        return new testUtils.Promise(function (resolve, reject) {
          var retChanges = [];
          var changes = db.changes({
            doc_ids: ['1', '3'],
            live: true
          }).on('change', function (change) {
            retChanges.push(change);
            if (retChanges.length === 2) {
              changes.cancel();
              resolve(retChanges);
            }
          }).on('error', reject);
        });
      }).then(function (changes) {
        var ids = changes.map(function (x) {
          return x.id;
        });
        var expectedIds = ['1', '3'];
        ids.sort().should.deep.equal(expectedIds);
      });
    });

    it('#2569 Big live doc_ids filter', function () {
      var docs = [];
      for (var i = 0; i < 5; i++) {
        var id = '';
        for (var j = 0; j < 50; j++) {
          // make a huge id
          id += testUtils.btoa(Math.random().toString());
        }
        docs.push({_id: id});
      }
      var db = new PouchDB(dbs.name);
      return db.bulkDocs(docs).then(function () {
        return new testUtils.Promise(function (resolve, reject) {
          var retChanges = [];
          var changes = db.changes({
            doc_ids: [docs[1]._id, docs[3]._id],
            live: true
          }).on('change', function (change) {
            retChanges.push(change);
            if (retChanges.length === 2) {
              changes.cancel();
              resolve(retChanges);
            }
          }).on('error', reject);
        });
      }).then(function (changes) {
        var ids = changes.map(function (x) {
          return x.id;
        });
        var expectedIds = [docs[1]._id, docs[3]._id];
        ids.sort().should.deep.equal(expectedIds.sort());
      });
    });

    it('#2569 Non-live doc_ids filter with filter=_doc_ids', function () {
      var docs = [
        {_id: '0'},
        {_id: '1'},
        {_id: '2'},
        {_id: '3'}
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs(docs).then(function () {
        return db.changes({
          filter: '_doc_ids',
          doc_ids: ['1', '3']
        });
      }).then(function (changes) {
        var ids = changes.results.map(function (x) {
          return x.id;
        });
        ids.sort().should.deep.equal(['1', '3']);
      });
    });

    it('#2569 Live doc_ids filter with filter=_doc_ids', function () {
      var docs = [
        {_id: '0'},
        {_id: '1'},
        {_id: '2'},
        {_id: '3'}
      ];
      var db = new PouchDB(dbs.name);
      return db.bulkDocs(docs).then(function () {
        return db.changes({
          filter: '_doc_ids',
          doc_ids: ['1', '3']
        });
      }).then(function (changes) {
        var ids = changes.results.map(function (x) {
          return x.id;
        });
        ids.sort().should.deep.equal(['1', '3']);
      });
    });

    it('Changes to same doc are grouped', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var docs2 = [
        {_id: '2', integer: 11},
        {_id: '3', integer: 12}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function (err, info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;
        db.put(docs2[0], function () {
          db.put(docs2[1], function () {
            db.changes({
              include_docs: true
            }).on('complete', function (changes) {
              changes.results.length.should.equal(4);

              var second = findById(changes.results, '2');
              second.changes.length.should.equal(1);
              second.doc.integer.should.equal(11);
              done();
            }).on('error', done);
          });
        });
      });
    });

    it('Changes with conflicts are handled correctly', function (testDone) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var docs2 = [
        {_id: '2', integer: 11},
        {_id: '3', integer: 12}
      ];
      var localdb = new PouchDB(dbs.name);
      var remotedb = new PouchDB(dbs.remote);
      localdb.bulkDocs({ docs: docs1 }).then(function (info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;
        return localdb.put(docs2[0]).then(function () {
          return localdb.put(docs2[1]).then(function (info) {
            var rev2 = info.rev;
            return PouchDB.replicate(localdb, remotedb).then(function () {
              // update remote once, local twice, then replicate from
              // remote to local so the remote losing conflict is later in
              // the tree
              return localdb.put({
                _id: '3',
                _rev: rev2,
                integer: 20
              }).then(function (resp) {
                var rev3Doc = {
                  _id: '3',
                  _rev: resp.rev,
                  integer: 30
                };
                return localdb.put(rev3Doc).then(function (resp) {
                  var rev4local = resp.rev;
                  var rev4Doc = {
                    _id: '3',
                    _rev: rev2,
                    integer: 100
                  };
                  return remotedb.put(rev4Doc).then(function (resp) {
                    var remoterev = resp.rev;
                    return PouchDB.replicate(remotedb, localdb).then(
                      function () {
                        return localdb.changes({
                          include_docs: true,
                          style: 'all_docs',
                          conflicts: true
                        }).on('error', testDone)
                          .then(function (changes) {
                            changes.results.length.should.equal(4);
                            var ch = findById(changes.results, '3');
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
                          });
                      });
                  });
                });
              });
            });
          });
        }).then(function () {
          testDone();
        }, testDone);
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
        }, function () {
          db.changes({
            include_docs: true
          }).on('complete', function (changes) {
            changes.results.length.should.equal(4);
            var ch = findById(changes.results, '3');
            // sequence numbers are not incremental in CouchDB 2.0
            if (!testUtils.isCouchMaster()) {
              ch.seq.should.equal(5);
            }
            ch.deleted.should.equal(true);
            done();
          }).on('error', done);
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
      db.bulkDocs({ docs: docs }, function () {
        db.changes().on('complete', function (res) {
          res.results.length.should.equal(num);
          done();
        }).on('error', done);
      });
    });

    it('Calling db.changes({since: \'now\'})', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: [{ foo: 'bar' }] }, function () {
        db.info(function (err, info) {
          var api = db.changes({
            since: 'now'
          }).on('complete', function (res) {
            // last_seq and update_seq might be encoded differently
            // in clustered CouchDB - they cannot be reliably compared.
            if (!testUtils.isCouchMaster()) {
              res.last_seq.should.equal(info.update_seq);
            }
            done();
          }).on('error', done);
          api.should.be.an('object');
          api.cancel.should.be.an('function');
        });
      });
    });

    //Duplicate to make sure both api options work.
    it('Calling db.changes({since: \'latest\'})', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: [{ foo: 'bar' }] }, function () {
        db.info(function (err, info) {
          var api = db.changes({
            since: 'latest'
          }).on('complete', function (res) {
            // last_seq and update_seq might be encoded differently
            // in clustered CouchDB - they cannot be reliably compared.
            if (!testUtils.isCouchMaster()) {
              res.last_seq.should.equal(info.update_seq);
            }
            done();
          }).on('error', done);
          api.should.be.an('object');
          api.cancel.should.be.an('function');
        });
      });
    });

    it('Closing db does not cause a crash if changes cancelled',
      function (done) {
      var db = new PouchDB(dbs.name);
      var called = 0;
      function checkDone() {
        called++;
        if (called === 2) {
          done();
        }
      }
      db.bulkDocs({ docs: [{ foo: 'bar' }] }, function () {
        var changes = db.changes({
          live: true
        }).on('complete', function (result) {
          result.status.should.equal('cancelled');
          checkDone();
        });
        should.exist(changes);
        changes.cancel.should.be.a('function');
        changes.cancel();
        db.close(function (error) {
          should.not.exist(error);
          checkDone();
        });
      });
    });

    it('fire-complete-on-cancel', function (done) {
      var db = new PouchDB(dbs.name);
      var cancelled = false;
      var changes = db.changes({
        live: true
      }).on('complete', function (result) {
        cancelled.should.equal(true);
        should.exist(result);
        if (result) {
          result.status.should.equal('cancelled');
        }
        done();
      }).on('error', done);
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
        live: true
      }).on('change', function () {
        called++;
        if (called === 1) {
          setTimeout(function () {
            changes.cancel();
          }, 1000);
        }
      }).on('complete', function () {
        called.should.equal(1);
        done();
      });
      db.post({key: 'value'});
    });

    it('supports return_docs=false', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [];
      var num = 10;
      for (var i = 0; i < num; i++) {
        docs.push({ _id: 'doc_' + i});
      }
      var changes = 0;
      db.bulkDocs({ docs: docs }, function (err) {
        if (err) {
          return done(err);
        }
        db.changes({
          descending: true,
          return_docs: false
        }).on('change', function () {
          changes++;
        }).on('complete', function (results) {
          results.results.should.have.length(0, '0 results returned');
          changes.should.equal(num, 'correct number of changes');
          done();
        }).on('error', function (err) {
          done(err);
        });
      });
    });

    // TODO: Remove 'returnDocs' in favor of 'return_docs' in a future release
    it('supports returnDocs=false', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [];
      var num = 10;
      for (var i = 0; i < num; i++) {
        docs.push({ _id: 'doc_' + i});
      }
      var changes = 0;
      db.bulkDocs({ docs: docs }, function (err) {
        if (err) {
          return done(err);
        }
        db.changes({
          descending: true,
          returnDocs: false
        }).on('change', function () {
          changes++;
        }).on('complete', function (results) {
          results.results.should.have.length(0, '0 results returned');
          changes.should.equal(num, 'correct number of changes');
          done();
        }).on('error', function (err) {
          done(err);
        });
      });
    });

    it('should respects limit', function (done) {
      var docs1 = [
        {_id: '_local/foo'},
        {_id: 'a', integer: 0},
        {_id: 'b', integer: 1},
        {_id: 'c', integer: 2},
        {_id: 'd', integer: 3}
      ];
      var called = 0;
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function () {
        db.changes({
          limit: 1
        }).on('change', function () {
          (called++).should.equal(0);
        }).on('complete', function () {
          setTimeout(function () {
            done();
          }, 50);
        });
      });
    });

    it('doesn\'t throw if opts.complete is undefined', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({_id: 'foo'}).then(function () {
        db.changes().on('change', function () {
          done();
        }).on('error', function (err) {
          done(err);
        });
      }, done);
    });

    it('it handles a bunch of individual changes in live replication',
      function (done) {
      var db = new PouchDB(dbs.name);
      var len = 80;
      var called = 0;
      var changesDone = false;
      var changesWritten = 0;
      var changes = db.changes({live: true});

      changes.on('change', function () {
        called++;
        if (called === len) {
          changes.cancel();
        }
      }).on('error', done).on('complete', function () {
        changesDone = true;
        maybeDone();
      });

      var i = -1;

      function maybeDone() {
        if (changesDone && changesWritten === len) {
          done();
        }
      }

      function after() {
        changesWritten++;
        db.listeners('destroyed').should.have.length.lessThan(5);
        maybeDone();
      }

      while (++i < len) {
        db.post({}).then(after).catch(done);
      }

    });

    it('changes-filter without filter', function (done) {
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var docs2 = [
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {_id: '6', integer: 6},
        {_id: '7', integer: 7}
      ];
      var db = new PouchDB(dbs.name);
      var count = 0;
      db.bulkDocs({ docs: docs1 }, function () {
        var changes = db.changes({
          live: true
        }).on('complete', function (result) {
          result.status.should.equal('cancelled');
          done();
        }).on('change', function () {
          count += 1;
          if (count === 8) {
            changes.cancel();
          }
        }).on('error', done);
        db.bulkDocs({ docs: docs2 });
      });
    });


    it('#3539 - Exception in changes is fine', function (done) {

      var db = new PouchDB(dbs.name);
      var count = 0;

      var changes = db.changes({live: true});

      changes.on('change', function () {
        ++count;
        if (count === 1) {
          throw new Error('an error');
        } else if (count === 3) {
          changes.cancel();
        }
      });

      changes.on('complete', function () {
        done();
      });

      db.post({ test: 'some stuff' }).then(function () {
        return db.post({ test: 'more stuff' });
      }).then(function () {
        db.post({ test: 'and more stuff' });
      });
    });

    it('Changes with selector', function (done) {
      if (!testUtils.isCouchMaster() && adapter === 'http') {
        return done();
      }

      var docs = [
        {_id: '0', user: 'foo'},
        {_id: '1', user: 'bar'},
        {_id: '2', user: 'foo'}
      ];
      var db = new PouchDB(dbs.name);

      db.bulkDocs({ docs: docs }, function () {
        db.changes({
          selector: {"user": "foo"},
          include_docs: true
        }).on('complete', function (results) {
          results.results.length.should.equal(2);
          var first = findById(results.results, '0');
          first.doc.user.should.equal('foo');
          var second = findById(results.results, '2');
          second.doc.user.should.equal('foo');
          done();
        }).on('error', done);
      });
    });

    it('Changes with selector, explicit filter', function (done) {
      if (!testUtils.isCouchMaster() && adapter === 'http') {
        return done();
      }

      var docs = [
        {_id: '0', user: 'foo'},
        {_id: '1', user: 'bar'},
        {_id: '2', user: 'foo'}
      ];
      var db = new PouchDB(dbs.name);

      db.bulkDocs({ docs: docs }, function () {
        db.changes({
          selector: {"user": "foo"},
          filter: '_selector',
          include_docs: true
        }).on('complete', function (results) {
          results.results.length.should.equal(2);
          var first = findById(results.results, '0');
          first.doc.user.should.equal('foo');
          var second = findById(results.results, '2');
          second.doc.user.should.equal('foo');
          done();
        }).on('error', done);
      });
    });

    it('Changes with selector and mismatched filter', function (done) {
      var db = new PouchDB(dbs.name);

      db.changes({
        selector: {"user": "foo"},
        filter: function () { return false; }
      }).on('complete', function () {
        done('expected failure');
      }).on('error', function (err) {
        err.message.should.equal('selector invalid for filter "function"');
        done();
      });
    });

    it('Changes with limit and selector', function (done) {
      if (!testUtils.isCouchMaster() && adapter === 'http') {
        return done();
      }

      var docs = [
        {_id: '0', user: 'foo'},
        {_id: '1', user: 'bar'},
        {_id: '2', user: 'foo'}
      ];
      var db = new PouchDB(dbs.name);

      db.bulkDocs({ docs: docs }, function () {
        return db.changes({
          limit: 1,
          selector: {"user": "foo"},
          include_docs: true
        }).on('complete', function (results) {
          results.results.length.should.equal(1);
          var first = results.results[0].doc;
          var last_seq = results.last_seq;

          return db.changes({
            limit: 1,
            selector: {"user": "foo"},
            include_docs: true,
            since: last_seq
          }).on('complete', function (results) {
            results.results.length.should.equal(1);
            var second = results.results[0].doc;

            first._id.should.not.equal(second._id);
            first.user.should.equal('foo');
            second.user.should.equal('foo');
            done();
          }).on('error', done)
          .catch(done);
        }).on('error', done);
      }).catch(done);
    });

  });
});

describe('changes-standalone', function () {

  it('Changes reports errors', function (done) {
    this.timeout(2000);
    var db = new PouchDB('http://infiniterequest.com', { skipSetup: true });
    db.changes({
      timeout: 1000
    }).on('error', function (err) {
      should.exist(err);
      done();
    });
  });

});
