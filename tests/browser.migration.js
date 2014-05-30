/* global PouchDBVersion110,PouchDBVersion200,PouchDBVersion220,PouchDB */
'use strict';

var scenarios = [
  'PouchDB v1.1.0',
  'PouchDB v2.0.0',
  'PouchDB v2.2.0',
  'websql'
];

describe('migration', function () {

  function usingDefaultPreferredAdapters() {
    var defaults = ['idb', 'websql'];
    return !(PouchDB.preferredAdapters < defaults ||
      PouchDB.preferredAdapters > defaults);
  }

  scenarios.forEach(function (scenario) {

    describe('migrate from ' + scenario, function () {

      var dbs = {};
      var constructors = {};
      var skip = false;

      beforeEach(function (done) {

        if (!usingDefaultPreferredAdapters() || window.msIndexedDB) {
          skip = true;
          done();
          return;
        }

        constructors = {
          'PouchDB v1.1.0': PouchDBVersion110,
          'PouchDB v2.0.0': PouchDBVersion200,
          'PouchDB v2.2.0': PouchDBVersion220,
          PouchDB: PouchDB
        };

        // need actual unique db names for these tests
        var localName = testUtils.adapterUrl('local', 'test_migration_local');
        var remoteName = testUtils.adapterUrl('http', 'test_migration_remote');

        dbs.first = {
          pouch : constructors[scenario] || PouchDB,
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
        if (skip) {
          done();
          return;
        }
        testUtils.cleanup([dbs.first.local, dbs.second.local], done);
      });

      var origDocs = [
        {_id: '0', a: 1, b: 1},
        {_id: '3', a: 4, b: 16},
        {_id: '1', a: 2, b: 4},
        {_id: '2', a: 3, b: 9}
      ];

      it('Testing basic migration integrity', function (done) {
        if (skip) { return done(); }
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
          oldPouch.remove(removedDoc, function (err, res) {
            oldPouch.close(function (err) {
              should.not.exist(err, 'got error: ' + JSON.stringify(err));
              var newPouch = new dbs.second.pouch(dbs.second.local);
              newPouch.then(function (newPouch) {
                return newPouch.allDocs({key: '2'});
              }).then(function (res) {
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
        if (skip) { return done(); }
        var docs = [
          {_id: "0", integer: 0, string: '0'},
          {_id: "1", integer: 1, string: '1'},
          {_id: "2", integer: 2, string: '2'},
          {_id: "3", integer: 3, string: '3', _deleted : true},
          {_id: "4", integer: 4, string: '4', _deleted : true}
        ];

        new dbs.first.pouch(dbs.first.remote, function (err, oldPouch) {
          should.not.exist(err, 'got error in constructor: ' +
            JSON.stringify(err));
          if (err) {
            done();
          }
          oldPouch.bulkDocs({docs: docs}, {}, function (err, res) {
            should.not.exist(err, 'got error in bulkDocs: ' +
              JSON.stringify(err));
            new dbs.first.pouch(dbs.first.local, dbs.first.localOpts,
              function (err, oldLocalPouch) {
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
                    new dbs.second.pouch(dbs.second.local,
                      function (err, newPouch) {
                      should.not.exist(err, 'got error in 2nd constructor: ' +
                        JSON.stringify(err));
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
          });
        });
      });

      if (scenario === 'PouchDB v2.2.0' && !skip) {
        it("Test persistent views don't require update", function (done) {
          if (scenario !== 'PouchDB v2.2.0' || skip) { return done(); }
          var oldPouch =
            new dbs.first.pouch(dbs.first.local, dbs.first.localOpts,
              function (err) {
                should.not.exist(err, 'got error: ' + JSON.stringify(err));
                if (err) {
                  done();
                }
              });
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
          oldPouch.bulkDocs({docs: docs}, function (err, res) {
            should.not.exist(err, 'bulkDocs');
            oldPouch.query('myview', function (err, res) {
              should.not.exist(err, 'query');
              res.rows.should.deep.equal(expectedRows);
              oldPouch.close(function (err) {
                should.not.exist(err, 'close');
                var newPouch = new dbs.second.pouch(dbs.second.local);
                newPouch.then(function (newPouch) {
                  return newPouch.query('myview', {stale: 'ok'});
                }).then(function (res) {
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
          if (skip) { return done(); }
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
      }
    });
  });
});
