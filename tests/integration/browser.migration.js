'use strict';

describe('migration', function () {

  function usingIdb() {
    var pref = PouchDB.preferredAdapters;
    // Firefox will have ['idb'], Chrome will have ['idb', 'websql']
    return (pref.length === 1 && pref[0] === 'idb') ||
      (pref.length === 2 && pref[0] === 'idb' && pref[1] === 'websql');
  }

  function usingIndexeddb() {
    const pref = PouchDB.preferredAdapters;
    // FUTURE: treat indexeddb adapter as the preferred option?
    return pref.length === 1 && pref[0] === 'indexeddb';
  }

  function usingDefaultPreferredAdapters() {
    return usingIdb() || usingIndexeddb();
  }

  const scenarios = [
    { scenario: 'PouchDB v1.1.0', constructorName: 'PouchDBVersion110'} ,
    { scenario: 'PouchDB v2.0.0', constructorName: 'PouchDBVersion200'} ,
    { scenario: 'PouchDB v2.2.0', constructorName: 'PouchDBVersion220'} ,
    { scenario: 'PouchDB v3.0.6', constructorName: 'PouchDBVersion306'} ,
    { scenario: 'PouchDB v3.2.0', constructorName: 'PouchDBVersion320'} ,
    { scenario: 'PouchDB v3.6.0', constructorName: 'PouchDBVersion360'} ,
    { scenario: 'PouchDB v7.3.1', constructorName: 'PouchDBVersion731'} ,
    { scenario: 'PouchDB v8.0.1', constructorName: 'PouchDBVersion801'} ,
    { scenario: 'websql',         constructorName: 'PouchDB'} ,
  ];

  var skip = false;

  before(function () {
    var isNodeWebkit = typeof window !== 'undefined' &&
      typeof process !== 'undefined';

    var skipMigration = 'SKIP_MIGRATION' in testUtils.params() &&
      testUtils.params().SKIP_MIGRATION;

    if (!usingDefaultPreferredAdapters() || window.msIndexedDB ||
      isNodeWebkit || skipMigration) {
      skip = true;
      return this.skip();
    }

    // conditionally load all legacy PouchDB scripts to avoid pulling them in
    // for test runs that don't test migrations
    return Promise.all(scenarios.map(function ({ scenario }) {
      var match = scenario.match(/PouchDB v([.\d]+)/);
      if (!match) {
        return testUtils.Promise.resolve();
      }

      const loader = testUtils.asyncLoadScript('deps/pouchdb-' + match[1] + '-postfixed.js');

      if (usingIndexeddb() && versionGte(scenario, '7.2.1')) {
        return loader
            .then(() => testUtils.asyncLoadScript('deps/pouchdb-' + match[1] + '-indexeddb-postfixed.js'));
      } else {
        return loader;
      }
    }));
  });

  after(function () {
    // free memory
    scenarios.forEach(({ constructorName }) => {
      if (constructorName !== 'PouchDB') {
        delete window[constructorName];
      }
    });
  });

  scenarios.forEach(function ({ scenario, constructorName }) {

    describe('migrate from ' + scenario, function () {

      var dbs = {};

      beforeEach(function (done) {
        if (skip) {
          return this.skip();
        }

        // need actual unique db names for these tests
        var localName = testUtils.adapterUrl('local', 'test_migration_local');
        var remoteName = testUtils.adapterUrl('http', 'test_migration_remote');

        dbs.first = {
          pouch : window[constructorName] || PouchDB,
          local : localName,
          remote : remoteName,
          localOpts : {}
        };

        dbs.second = {
          pouch : PouchDB,
          local : localName,
          remote : remoteName
        };

        if (scenario in PouchDB.adapters) {
          dbs.first.localOpts.adapter = scenario;
        }
        // else scenario might not make sense for this browser, so just use
        // same adapter for both

        testUtils.cleanup([dbs.first.local, dbs.second.local], done);

      });

      afterEach(function (done) {
        testUtils.cleanup([dbs.first.local, dbs.second.local], done);
      });

      describe('idb', () => {
        before(function () {
          if (!usingIdb()) {
            return this.skip();
          }
        });

        var origDocs = [
          {_id: '0', a: 1, b: 1},
          {_id: '3', a: 4, b: 16},
          {_id: '1', a: 2, b: 4},
          {_id: '2', a: 3, b: 9}
        ];

        it('Testing basic migration integrity', function (done) {
          var oldPouch =
            new dbs.first.pouch(dbs.first.local, dbs.first.localOpts,
            function (err) {
            should.not.exist(err, 'got error: ' + JSON.stringify(err));
            if (err) {
              done();
            }
          });
          oldPouch.bulkDocs({docs: origDocs}, function (err, res) {
            var removedDoc = {_deleted: true, _rev: res[0].rev, _id: res[0].id};
            oldPouch.remove(removedDoc, function () {
              oldPouch.close(function (err) {
                should.not.exist(err, 'got error: ' + JSON.stringify(err));
                var newPouch = new dbs.second.pouch(dbs.second.local);
                return newPouch.allDocs({key: '2'}).then(function (res) {
                  res.total_rows.should.equal(3);
                  res.rows.should.have.length(1);
                  return newPouch.allDocs({key: '0'});
                }).then(function (res) {
                  res.total_rows.should.equal(3);
                  res.rows.should.have.length(0);
                  done();
                }).catch(function (err) {
                  should.not.exist(err, 'got error: ' + JSON.stringify(err));
                  done();
                });
              });
            });
          });
        });

        it("Test basic replication with migration", function (done) {
          var docs = [
            {_id: "0", integer: 0, string: '0'},
            {_id: "1", integer: 1, string: '1'},
            {_id: "2", integer: 2, string: '2'},
            {_id: "3", integer: 3, string: '3', _deleted : true},
            {_id: "4", integer: 4, string: '4', _deleted : true}
          ];

          var oldPouch = new dbs.first.pouch(dbs.first.remote);
          oldPouch.bulkDocs({docs: docs}, {}, function (err) {
            should.not.exist(err, 'got error in bulkDocs: ' +
                             JSON.stringify(err));
            var oldLocalPouch =  new dbs.first.pouch(dbs.first.local,
                                                     dbs.first.localOpts);
            oldPouch.replicate.to(oldLocalPouch, function (err, result) {
              should.not.exist(err, 'got error in replicate: ' +
                               JSON.stringify(err));
              if (err) {
                done();
              }
              should.exist(result.ok, 'replication was ok');
              oldPouch.close(function (err) {
                should.not.exist(err, 'got error in close: ' +
                                 JSON.stringify(err));
                if (err) {
                  done();
                }
                should.not.exist(err, 'got error: ' + JSON.stringify(err));
                if (err) {
                  done();
                }
                oldLocalPouch.close(function (err) {
                  should.not.exist(err, 'got error in close: ' +
                                   JSON.stringify(err));
                  if (err) {
                    done();
                  }
                  var newPouch = new dbs.second.pouch(dbs.second.local);
                  if (err) {
                    done();
                  }
                  newPouch.allDocs({}, function (err, res) {
                    should.not.exist(err, 'got error in allDocs: ' +
                                     JSON.stringify(err));
                    res.rows.should.have.length(3, 'unexpected rows: ' +
                                                JSON.stringify(res.rows));
                    res.total_rows.should.equal(3);
                    done();
                  });
                });
              });
            });
          });
        });

        it("Test basic replication with migration + changes()", function (done) {
          var docs = [
            {_id: "0", integer: 0, string: '0'},
            {_id: "1", integer: 1, string: '1'},
            {_id: "2", integer: 2, string: '2'},
            {_id: "3", integer: 3, string: '3', _deleted : true},
            {_id: "4", integer: 4, string: '4', _deleted : true}
          ];

          var oldPouch = new dbs.first.pouch(dbs.first.remote);
          oldPouch.bulkDocs({docs: docs}, {}, function (err) {
            should.not.exist(err, 'got error in bulkDocs: ' +
                             JSON.stringify(err));
            var oldLocalPouch = new dbs.first.pouch(dbs.first.local,
                                                    dbs.first.localOpts);
            oldPouch.replicate.to(oldLocalPouch, function (err, result) {
              should.not.exist(err, 'got error in replicate: ' +
                               JSON.stringify(err));
              if (err) {
                done();
              }
              should.exist(result.ok, 'replication was ok');
              oldPouch.close(function (err) {
                should.not.exist(err, 'got error in close: ' +
                                 JSON.stringify(err));
                if (err) {
                  done();
                }
                should.not.exist(err, 'got error: ' + JSON.stringify(err));
                if (err) {
                  done();
                }
                oldLocalPouch.close(function (err) {
                  should.not.exist(err, 'got error in close: ' +
                                   JSON.stringify(err));
                  if (err) {
                    done();
                  }
                  var newPouch = new dbs.second.pouch(dbs.second.local);
                  newPouch.changes({include_docs: true, return_docs: true})
                    .on('complete', function (complete) {
                      complete.results.should.have
                        .length(5, 'no _local docs in changes()');
                      done();
                    }).on('error', done);
                });
              });
            });
          });
        });

        if (versionGte(scenario, '2.2.0')) {
          it("Test persistent views don't require update", function (done) {
            var oldPouch = new dbs.first.pouch(dbs.first.local, dbs.first.localOpts);
            var docs = origDocs.slice().concat([{
              _id: '_design/myview',
              views: {
                myview: {
                  map: function (doc) {
                    emit(doc.a);
                  }.toString()
                }
              }
            }]);
            var expectedRows = [
              { key: 1, id: '0', value: null },
              { key: 2, id: '1', value: null },
              { key: 3, id: '2', value: null },
              { key: 4, id: '3', value: null }
            ];
            oldPouch.bulkDocs({docs: docs}, function (err) {
              should.not.exist(err, 'bulkDocs');
              oldPouch.query('myview', function (err, res) {
                should.not.exist(err, 'query');
                res.rows.should.deep.equal(expectedRows);
                oldPouch.close(function (err) {
                  should.not.exist(err, 'close');
                  var newPouch = new dbs.second.pouch(dbs.second.local);
                  newPouch.query('myview', {stale: 'ok'}).then(function (res) {
                    res.rows.should.deep.equal(expectedRows);
                    done();
                  }).catch(function (err) {
                    should.not.exist(err, 'catch');
                    done();
                  });
                });
              });
            });
          });

          it("Test persistent views don't require update, with a value",
              function (done) {
            var oldPouch = new dbs.first.pouch(dbs.first.local, dbs.first.localOpts);
            var docs = origDocs.slice().concat([{
              _id: '_design/myview',
              views: {
                myview: {
                  map: function (doc) {
                    emit(doc.a, doc.b);
                  }.toString()
                }
              }
            }]);
            var expectedRows = [
              { key: 1, id: '0', value: 1 },
              { key: 2, id: '1', value: 4 },
              { key: 3, id: '2', value: 9 },
              { key: 4, id: '3', value: 16 }
            ];
            oldPouch.bulkDocs({docs: docs}, function (err) {
              should.not.exist(err, 'bulkDocs');
              oldPouch.query('myview', function (err, res) {
                should.not.exist(err, 'query');
                res.rows.should.deep.equal(expectedRows);
                oldPouch.close(function (err) {
                  should.not.exist(err, 'close');
                  var newPouch = new dbs.second.pouch(dbs.second.local);
                  newPouch.query('myview', {stale: 'ok'}).then(function (res) {
                    res.rows.should.deep.equal(expectedRows);
                    done();
                  }).catch(function (err) {
                    should.not.exist(err, 'catch');
                    done();
                  });
                });
              });
            });
          });

          it('Returns ok for viewCleanup after modifying view', function (done) {
            var oldPouch =
              new dbs.first.pouch(dbs.first.local, dbs.first.localOpts,
                function (err) {
                  should.not.exist(err, 'got error: ' + JSON.stringify(err));
                  if (err) {
                    done();
                  }
                });
            var ddoc = {
              _id: '_design/myview',
              views: {
                myview: {
                  map: function (doc) {
                    emit(doc.firstName);
                  }.toString()
                }
              }
            };
            var doc = {
              _id: 'foo',
              firstName: 'Foobar',
              lastName: 'Bazman'
            };
            oldPouch.bulkDocs({docs: [ddoc, doc]}).then(function (info) {
              ddoc._rev = info[0].rev;
              return oldPouch.query('myview');
            }).then(function (res) {
              res.rows.should.deep.equal([
                {id: 'foo', key: 'Foobar', value: null}
              ]);
              ddoc.views.myview.map = function (doc) {
                emit(doc.lastName);
              }.toString();
              return oldPouch.put(ddoc);
            }).then(function () {
              return oldPouch.query('myview');
            }).then(function (res) {
              res.rows.should.deep.equal([
                {id: 'foo', key: 'Bazman', value: null}
              ]);
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local);
              newPouch.viewCleanup().then(function () {
                done();
              }, done);
            }, done);
          });
          it('Remembers local docs', function (done) {
            var oldPouch =
              new dbs.first.pouch(dbs.first.local, dbs.first.localOpts,
                function (err) {
                  should.not.exist(err, 'got error: ' + JSON.stringify(err));
                  if (err) {
                    done();
                  }
                });
            var docs = [
              { _id: '_local/foo' },
              { _id: '_local/bar' }
            ];
            oldPouch.bulkDocs({docs: docs}).then(function () {
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local);
              newPouch.get('_local/foo').then(function () {
                return newPouch.get('_local/bar');
              }).then(function () {
                done();
              }, done);
            }, done);
          });

          it('Testing migration with weird doc ids', function (done) {
            var origDocs = [
              {_id: 'foo::bar::baz'},
              {_id: '\u0000foo\u0000'}
            ];

            var oldPouch = new dbs.first.pouch(dbs.first.local, dbs.first.localOpts);
            oldPouch.bulkDocs({docs: origDocs}, function (err) {
              should.not.exist(err, 'got error: ' + JSON.stringify(err));
              oldPouch.close(function (err) {
                should.not.exist(err, 'got error: ' + JSON.stringify(err));
                var newPouch = new dbs.second.pouch(dbs.second.local);
                newPouch.allDocs().then(function (res) {
                  res.total_rows.should.equal(2);
                  res.rows.should.have.length(2);
                  res.rows[1].id.should.equal(origDocs[0]._id);
                  res.rows[0].id.should.equal(origDocs[1]._id);
                  done();
                });
              });
            });
          });
        }

        if (versionGte(scenario, '3.0.6')) {
          // attachments didn't really work until this release
          it('#2818 Testing attachments with compaction of dups', function () {
            var docs = [
              {
                _id: 'doc1',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  }
                }
              },
              {
                _id: 'doc2',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  }
                }
              }
            ];

            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);
            return oldPouch.bulkDocs(docs).then(function () {
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.get('doc1').then(function (doc1) {
                return newPouch.remove(doc1);
              }).then(function () {
                return newPouch.compact();
              }).then(function () {
                return newPouch.get('doc2', {attachments: true});
              }).then(function (doc2) {
                doc2._attachments['att.txt'].data.should.equal('Zm9vYmFy');
              });
            });
          });

          it('#2818 Testing attachments with compaction of dups 2', function () {
            var docs = [
              {
                _id: 'doc1',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  }
                }
              }
            ];

            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);
            return oldPouch.bulkDocs(docs).then(function () {
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.put({
                _id: 'doc2',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  }
                }
              }).then(function () {
                return newPouch.get('doc2');
              }).then(function (doc2) {
                return newPouch.remove(doc2);
              }).then(function () {
                return newPouch.compact();
              }).then(function () {
                return newPouch.get('doc1', {attachments: true});
              }).then(function (doc1) {
                doc1._attachments['att.txt'].data.should.equal('Zm9vYmFy');
              });
            });
          });

          it('#2818 Testing attachments with compaction of dups 3', function () {
            var docs = [
              {
                _id: 'doc1',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  }
                }
              },
              {
                _id: 'doc_deleted',
                _deleted: true
              },
              {
                _id: 'doc_no_attachments'
              }
            ];

            for (var i = 0; i < 25; i++) {
              // test paging in the migration
              docs.push({
                _id: 'some_other_doc_' + i
              });
            }

            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);
            return oldPouch.bulkDocs(docs).then(function () {
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.put({
                _id: 'doc2',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  }
                }
              }).then(function () {
                return newPouch.get('doc2');
              }).then(function (doc2) {
                return newPouch.remove(doc2);
              }).then(function () {
                return newPouch.compact();
              }).then(function () {
                return newPouch.get('doc1', {attachments: true});
              }).then(function (doc1) {
                doc1._attachments['att.txt'].data.should.equal('Zm9vYmFy');
              });
            });
          });

          it('#2818 Testing attachments with compaction of dups 4', function () {
            var docs = [
              {
                _id: 'doc1',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  },
                  'att2.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  },
                  'att3.txt': {
                    data: 'Zm9v', // 'foo'
                    content_type: 'text/plain'
                  }
                }
              }
            ];

            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);
            return oldPouch.bulkDocs(docs).then(function () {
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.put({
                _id: 'doc2',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  }
                }
              }).then(function () {
                return newPouch.get('doc2');
              }).then(function (doc2) {
                return newPouch.remove(doc2);
              }).then(function () {
                return newPouch.compact();
              }).then(function () {
                return newPouch.get('doc1', {attachments: true});
              }).then(function (doc1) {
                doc1._attachments['att.txt'].data.should.equal('Zm9vYmFy');
                doc1._attachments['att2.txt'].data.should.equal('Zm9vYmFy');
                doc1._attachments['att3.txt'].data.should.equal('Zm9v');
              });
            });
          });

          it('#2818 Testing attachments with compaction of dups 5', function () {
            var docs = [
              {
                _id: 'doc1',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  },
                  'att2.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  },
                  'att3.txt': {
                    data: 'Zm9v', // 'foo'
                    content_type: 'text/plain'
                  }
                }
              }, {
                _id: 'doc3',
                _attachments: {
                  'att-a.txt': {
                    data: 'Zm9vYmFy', // 'foobar'
                    content_type: 'text/plain'
                  },
                  'att-b.txt': {
                    data: 'Zm9v', // 'foo'
                    content_type: 'text/plain'
                  },
                  'att-c.txt': {
                    data: 'YmFy', // 'bar'
                    content_type: 'text/plain'
                  }
                }
              }
            ];

            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);
            return oldPouch.bulkDocs(docs).then(function () {
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.put({
                _id: 'doc2',
                _attachments: {
                  'att.txt': {
                    data: 'YmFy', // 'bar'
                    content_type: 'text/plain'
                  }
                }
              }).then(function () {
                return newPouch.get('doc2');
              }).then(function (doc2) {
                return newPouch.remove(doc2);
              }).then(function () {
                return newPouch.compact();
              }).then(function () {
                return newPouch.get('doc1', {attachments: true});
              }).then(function (doc1) {
                doc1._attachments['att.txt'].data.should.equal('Zm9vYmFy');
                doc1._attachments['att2.txt'].data.should.equal('Zm9vYmFy');
                doc1._attachments['att3.txt'].data.should.equal('Zm9v');
                return newPouch.get('doc3', {attachments: true});
              }).then(function (doc3) {
                doc3._attachments['att-a.txt'].data.should.equal('Zm9vYmFy');
                doc3._attachments['att-b.txt'].data.should.equal('Zm9v');
                doc3._attachments['att-c.txt'].data.should.equal('YmFy');
              });
            });
          });

          it('#2818 Testing attachments with compaction of dups 6', function () {
            var docs = [];

            for (var i = 0; i < 40; i++) {
              docs.push({
                _id: 'doc' + i,
                _attachments: {
                  'att.txt' : {
                    data: testUtils.btoa(Math.random().toString()),
                    content_type: 'text/plain'
                  }
                }
              });
            }
            docs.push({
              _id: 'doc_a',
              _attachments: {
                'att.txt': {
                  data: 'Zm9vYmFy', // 'foobar'
                  content_type: 'text/plain'
                },
                'att2.txt': {
                  data: 'Zm9vYmFy', // 'foobar'
                  content_type: 'text/plain'
                },
                'att3.txt': {
                  data: 'Zm9v', // 'foo'
                  content_type: 'text/plain'
                }
              }
            });
            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);
            return oldPouch.bulkDocs(docs).then(function () {
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.put({
                _id: 'doc_b',
                _attachments: {
                  'att.txt': {
                    data: 'Zm9v', // 'foo'
                    content_type: 'text/plain'
                  }
                }
              }).then(function () {
                return newPouch.get('doc_b');
              }).then(function (doc) {
                return newPouch.remove(doc);
              }).then(function () {
                return newPouch.compact();
              }).then(function () {
                return newPouch.get('doc_a', {attachments: true});
              }).then(function (doc) {
                doc._attachments['att.txt'].data.should.equal('Zm9vYmFy');
                doc._attachments['att2.txt'].data.should.equal('Zm9vYmFy');
                doc._attachments['att3.txt'].data.should.equal('Zm9v');
              });
            });
          });

          it('#2818 compaction of atts after many revs', function () {
            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);

            return oldPouch.put({_id: 'foo'}).then(function (res) {
              return oldPouch.putAttachment('foo', 'att', res.rev, 'Zm9v',
                'text/plain');
            }).then(function () {
              return oldPouch.get('foo', {attachments: true});
            }).then(function (doc) {
              doc._attachments['att'].content_type.should.equal('text/plain');
              should.exist(doc._attachments['att'].data);
              return oldPouch.get('foo');
            }).then(function (doc) {
              return oldPouch.put(doc);
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.compact().then(function () {
                return newPouch.get('foo', {attachments: true});
              }).then(function (doc) {
                doc._attachments['att'].content_type.should.equal('text/plain');
                doc._attachments['att'].data.length.should.be.above(0,
                  'attachment exists');
              });
            });
          });

          it('#2890 PNG content after migration', function () {
            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);

            var transparent1x1Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HA' +
                'wCAAAAC0lEQVR4nGP6zwAAAgcBApocMXEA' +
                'AAAASUVORK5CYII=';
            var black1x1Png =
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACkl' +
                'EQVR4nGNiAAAABgADNjd8qAAA' +
                'AABJRU5ErkJggg==';

            return oldPouch.put({_id: 'foo'}).then(function (res) {
              return oldPouch.putAttachment('foo', 'att', res.rev,
                transparent1x1Png, 'image/png');
            }).then(function () {
              return oldPouch.get('foo', {attachments: true});
            }).then(function (doc) {
              doc._attachments['att'].content_type.should.equal('image/png');
              should.exist(doc._attachments['att'].data);
              return oldPouch.get('foo');
            }).then(function (doc) {
              return oldPouch.put(doc);
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.compact().then(function () {
                return newPouch.get('foo', {attachments: true});
              }).then(function (doc) {
                doc._attachments['att'].content_type.should.equal('image/png');
                doc._attachments['att'].data.should.equal(transparent1x1Png);
                return newPouch.putAttachment('bar', 'att', null,
                  black1x1Png, 'image/png');
              }).then(function () {
                return newPouch.get('bar', {attachments: true});
              }).then(function (doc) {
                doc._attachments['att'].content_type.should.equal('image/png');
                doc._attachments['att'].data.should.equal(black1x1Png);
              });
            });
          });
        }

        if (versionGte(scenario, '3.2.0')) {
          it('#3136 Testing later winningSeqs', function () {
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

            var oldPouch = new dbs.first.pouch(
              dbs.first.local, dbs.first.localOpts);
            var chain = testUtils.Promise.resolve();
            tree.forEach(function (docs) {
              chain = chain.then(function () {
                return oldPouch.bulkDocs(docs, {new_edits: false});
              });
            });

            return chain.then(function () {
              return oldPouch.close();
            }).then(function () {
              var newPouch = new dbs.second.pouch(dbs.second.local,
                {auto_compaction: false});
              return newPouch.changes({
                return_docs: true,
                include_docs: true,
                style: 'all_docs'
              });
            }).then(function (result) {
              // order don't matter
              result.results.forEach(function (ch) {
                ch.changes = ch.changes.sort(function (a, b) {
                  return a.rev < b.rev ? -1 : 1;
                });
              });
              var expected = {
                "results": [
                  {
                    "seq": 3,
                    "id": "bar",
                    "changes": [{"rev": "1-x"}],
                    "doc": {"_id": "bar", "_rev": "1-x"}
                  },
                  {
                    "seq": 4,
                    "id": "foo",
                    "changes": [{"rev": "2-b"}, {"rev": "2-c"}],
                    "doc": {"_id": "foo", "_rev": "2-b"}
                  }
                ],
                "last_seq": 4
              };
              result.should.deep.equal(expected);
            });
          });
        }

        if (versionGte(scenario, '3.6.0')) {
          it('#3646 - Should finish with 0 documents', function () {
            var data = [
              {
                "docs": [
                  {
                    "_revisions": {
                      "start": 2,
                      "ids": [
                        "4e16ac64356d4358bf1bdb4857fc299f",
                        "aed67b17ea5ba6b78e704ad65d3fb5db"
                      ]
                    },
                    "_rev": "2-4e16ac64356d4358bf1bdb4857fc299f",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 2,
                      "ids": [
                        "3757f03a178b34284361c89303cf8c35",
                        "0593f4c87b24f0f9b620526433929bb0"
                      ]
                    },
                    "_rev": "2-3757f03a178b34284361c89303cf8c35",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 3,
                      "ids": [
                        "f28d17ab990dcadd20ad38860fde9f11",
                        "6cf4b9e2115d7e884292b97aa8765285",
                        "dcfdf66ab61873ee512a9ccf3e3731a1"
                      ]
                    },
                    "_rev": "3-f28d17ab990dcadd20ad38860fde9f11",
                    "_id": "b74e3b45"
                  },
                  {
                    "_revisions": {
                      "start": 3,
                      "ids": [
                        "4d93920c00a4a7269095b22ff4329b3c",
                        "7190eca51acb2b302a89ed1204ac2813",
                        "017eba7ef1e4f529143f463779822627"
                      ]
                    },
                    "_rev": "3-4d93920c00a4a7269095b22ff4329b3c",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 3,
                      "ids": [
                        "91b47d7b889feb36eaf9336c071f00cc",
                        "0e3379b8f9128e6062d13eeb98ec538e",
                        "1c006ce18b663e2a031ced4669797c28"
                      ]
                    },
                    "_rev": "3-91b47d7b889feb36eaf9336c071f00cc",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 4,
                      "ids": [
                        "2c3c860d421fc9f6cc82e4fb811dc8e2",
                        "4473170dcffa850aca381b4f644b2947",
                        "3524a871600080f5e30e59a292b02a3f",
                        "89eb0b5131800963bb7caf1fc83b6242"
                      ]
                    },
                    "_rev": "4-2c3c860d421fc9f6cc82e4fb811dc8e2",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 6,
                      "ids": [
                        "441f43a31c89dc68a7cc934ce5779bf8",
                        "4c7f8b00508144d049d18668d17e552a",
                        "e8431fb3b448f3457c5b2d77012fa8b4",
                        "f2e7dc8102123e13ca792a0a05ca6235",
                        "37a13a5c1e2ce5926a3ffcda7e669106",
                        "78739468c87b30f76d067a2d7f373803"
                      ]
                    },
                    "_rev": "6-441f43a31c89dc68a7cc934ce5779bf8",
                    "_id": "b74e3b45",
                    "_deleted": true
                  }
                ]
              },
              {
                "docs": [
                  {
                    "_revisions": {
                      "start": 2,
                      "ids": [
                        "3757f03a178b34284361c89303cf8c35",
                        "0593f4c87b24f0f9b620526433929bb0"
                      ]
                    },
                    "_rev": "2-3757f03a178b34284361c89303cf8c35",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 2,
                      "ids": [
                        "4e16ac64356d4358bf1bdb4857fc299f",
                        "aed67b17ea5ba6b78e704ad65d3fb5db"
                      ]
                    },
                    "_rev": "2-4e16ac64356d4358bf1bdb4857fc299f",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 3,
                      "ids": [
                        "91b47d7b889feb36eaf9336c071f00cc",
                        "0e3379b8f9128e6062d13eeb98ec538e",
                        "1c006ce18b663e2a031ced4669797c28"
                      ]
                    },
                    "_rev": "3-91b47d7b889feb36eaf9336c071f00cc",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 3,
                      "ids": [
                        "4d93920c00a4a7269095b22ff4329b3c",
                        "7190eca51acb2b302a89ed1204ac2813",
                        "017eba7ef1e4f529143f463779822627"
                      ]
                    },
                    "_rev": "3-4d93920c00a4a7269095b22ff4329b3c",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 4,
                      "ids": [
                        "2c3c860d421fc9f6cc82e4fb811dc8e2",
                        "4473170dcffa850aca381b4f644b2947",
                        "3524a871600080f5e30e59a292b02a3f",
                        "89eb0b5131800963bb7caf1fc83b6242"
                      ]
                    },
                    "_rev": "4-2c3c860d421fc9f6cc82e4fb811dc8e2",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 4,
                      "ids": [
                        "dbaa7e6c02381c2c0ec5259572387d7c",
                        "f28d17ab990dcadd20ad38860fde9f11",
                        "6cf4b9e2115d7e884292b97aa8765285",
                        "dcfdf66ab61873ee512a9ccf3e3731a1"
                      ]
                    },
                    "_rev": "4-dbaa7e6c02381c2c0ec5259572387d7c",
                    "_id": "b74e3b45",
                    "_deleted": true
                  },
                  {
                    "_revisions": {
                      "start": 6,
                      "ids": [
                        "441f43a31c89dc68a7cc934ce5779bf8",
                        "4c7f8b00508144d049d18668d17e552a",
                        "e8431fb3b448f3457c5b2d77012fa8b4",
                        "f2e7dc8102123e13ca792a0a05ca6235",
                        "37a13a5c1e2ce5926a3ffcda7e669106",
                        "78739468c87b30f76d067a2d7f373803"
                      ]
                    },
                    "_rev": "6-441f43a31c89dc68a7cc934ce5779bf8",
                    "_id": "b74e3b45",
                    "_deleted": true
                  }
                ]
              }
            ];

            var oldPouch = new dbs.first.pouch(
                dbs.first.local, dbs.first.localOpts);
            var newPouch;

            return oldPouch.bulkDocs(data[0], {
              new_edits: false
            }).then(function () {
              return oldPouch.bulkDocs(data[1], {new_edits: false});
            }).then(function () {
              return oldPouch.close();
            }).then(function () {
              newPouch = new dbs.second.pouch(dbs.second.local,
                  {auto_compaction: false});
              return newPouch.allDocs();
            }).then(function (res) {
              res.rows.should.have.length(0, 'all docs length is 0');
              res.total_rows.should.equal(0);
              return newPouch.allDocs({keys: ['b74e3b45'], include_docs: true});
            }).then(function (res) {
              var first = res.rows[0];
              should.equal(first.value.deleted, true, 'all docs value.deleted');
              first.value.rev.should.equal('6-441f43a31c89dc68a7cc934ce5779bf8');
              res.total_rows.should.equal(0);
              return newPouch.info();
            }).then(function (info) {
              info.doc_count.should.equal(0, 'doc_count is 0');
              return newPouch.changes({include_docs: true, return_docs: true});
            }).then(function (changes) {
              changes.results.should.have.length(1);
              var first = changes.results[0];
              first.doc._rev.should.equal('6-441f43a31c89dc68a7cc934ce5779bf8');
              should.equal(first.deleted, true, 'changes metadata.deleted');
              should.equal(first.doc._deleted, true, 'changes doc._deleted');
            });
          });
        }
      });

      describe('indexeddb', () => {
        before(function () {
          if (!usingIndexeddb()) {
            return this.skip();
          }
        });

        if (versionGte(scenario, '7.2.1')) {
          it('Should support indexeddb->indexeddb upgrades', () => {
            const attFor = (id) => new Blob([ 'parentId:' + id ], { type: 'text/plain' });

            const oldPouch = new dbs.first.pouch(dbs.first.local, { adapter: 'indexeddb' });
            let newPouch;

            return oldPouch
              .bulkDocs([
                { _id:'_local/loc-1', some_value:1 },
                { _id:'norm-1', some_other_value:2 },
              ])

              .then(() => oldPouch.get('_local/loc-1'))
              .then((doc) => oldPouch.putAttachment('_local/loc-1', 'att.txt', doc._rev,  attFor('loc-1'),  'text/plain'))

              .then(()    => oldPouch.putAttachment('_local/loc-2', 'att.txt', undefined, attFor('loc-2'),  'text/plain'))

              .then(()    => oldPouch.get('norm-1'))
              .then((doc) => oldPouch.putAttachment('norm-1',       'att.txt', doc._rev,  attFor('norm-1'), 'text/plain'))

              .then(()    => oldPouch.putAttachment('norm-2',       'att.txt', undefined, attFor('norm-2'), 'text/plain'))

              .then(() => oldPouch.close())

              .then(() => {
                newPouch = new dbs.second.pouch(dbs.second.local, { auto_compaction: false, adapter: 'indexeddb' });
              })

              .then(() => newPouch.allDocs({ include_docs: true, attachments: true }))
              .then((res) => {
                res.rows.should.have.length(2, 'all docs length is 2');

                res.rows[0].id.should.equal('norm-1');
                res.rows[0].doc.some_other_value.should.equal(2);
                res.rows[0].doc._attachments.should.be.an('object').that.has.all.keys('att.txt');
                res.rows[0].doc._attachments['att.txt'].data.should.equal('cGFyZW50SWQ6bm9ybS0x');

                res.rows[1].id.should.equal('norm-2');
                res.rows[1].doc._attachments.should.be.an('object').that.has.all.keys('att.txt');
                res.rows[1].doc._attachments['att.txt'].data.should.equal('cGFyZW50SWQ6bm9ybS0y');
              })

              .then(() => newPouch.get('_local/loc-1', { attachments: true }))
              .then(doc => {
                doc._id.should.equal('_local/loc-1');
                doc.some_value.should.equal(1);
                doc._attachments.should.be.an('object').that.has.all.keys('att.txt');
                doc._attachments['att.txt'].data.should.equal('cGFyZW50SWQ6bG9jLTE=');
              })

              .then(() => newPouch.get('_local/loc-2', { attachments: true }))
              .then(doc => {
                doc._id.should.equal('_local/loc-2');
                doc._attachments.should.be.an('object').that.has.all.keys('att.txt');
                doc._attachments['att.txt'].data.should.equal('cGFyZW50SWQ6bG9jLTI=');
              })
              ;
          });
        }
      });
    });
  });
});

function versionGte(scenario, minimumRequired) {
  const match = scenario.match(/^PouchDB v([.\d]+)$/);
  if (!match) { return false; }
  const actual = match[1].split('.');

  const min = minimumRequired.split('.');

  for (let i=0; i<min.length; ++i) {
    if (actual[i] > min[i]) { return true; }
    if (actual[i] < min[i]) { return false; }
  }

  return true;
}
