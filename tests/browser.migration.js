/* global PouchDBVersion110 */
'use strict';

var testHelpers = {};
var adapters = [['local-1', 'http-1']];
describe('migration', function () {
  adapters.map(function (adapterPair) {

    var local = adapterPair[0];
    var remote = adapterPair[1];

    describe(adapterPair, function () {
      beforeEach(function () {
        // need actual unique db names for these tests
        testHelpers.name = testUtils.adapterUrl(local,  testUtils.uuid());
        testHelpers.remote = testUtils.adapterUrl(remote, testUtils.uuid());
        PouchDB.enableAllDbs = true;

        // modify the preferredAdapters in setup.js, then
        // uncomment this line to test websql in Chrome
        // delete PouchDBVersion110.adapters.idb;
      });
      afterEach(testUtils.cleanupTestDatabases);

      var origDocs = [
        {_id: '0', a: 1, b: 1},
        {_id: '3', a: 4, b: 16},
        {_id: '1', a: 2, b: 4},
        {_id: '2', a: 3, b: 9}
      ];

      it('Testing basic migration integrity', function (done) {
        var oldPouch = new PouchDBVersion110(testHelpers.name, function (err, oldPouch) {
          should.not.exist(err, 'got error: ' + JSON.stringify(err));
          if (err) {
            done();
          }
        });
        oldPouch.bulkDocs({docs: origDocs}, function (err, res) {
          origDocs[0]._deleted = true;
          origDocs[0]._rev = res[0].rev;
          oldPouch.remove(origDocs[0], function (err, res) {
            oldPouch.close(function (err) {
              should.not.exist(err, 'got error: ' + JSON.stringify(err));
              var newPouch = new PouchDB(testHelpers.name);
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

        var docs = [
          {_id: "0", integer: 0, string: '0'},
          {_id: "1", integer: 1, string: '1'},
          {_id: "2", integer: 2, string: '2'},
          {_id: "3", integer: 3, string: '3', _deleted : true},
          {_id: "4", integer: 4, string: '4', _deleted : true}
        ];

        new PouchDBVersion110(testHelpers.remote, function (err, oldPouch) {
          should.not.exist(err, 'got error in constructor: ' + JSON.stringify(err));
          if (err) {
            done();
          }
          oldPouch.bulkDocs({docs: docs}, {}, function (err, res) {
            should.not.exist(err, 'got error in bulkDocs: ' + JSON.stringify(err));
            oldPouch.replicate.to(testHelpers.name, {}, function (err, result) {
              should.not.exist(err, 'got error in replicate: ' + JSON.stringify(err));
              if (err) {
                done();
              }
              should.exist(result.ok, 'replication was ok');
              oldPouch.close(function (err) {
                should.not.exist(err, 'got error in close: ' + JSON.stringify(err));
                if (err) {
                  done();
                }
                new PouchDBVersion110(testHelpers.name, function (err, oldLocalPouch) {
                  should.not.exist(err, 'got error: ' + JSON.stringify(err));
                  if (err) {
                    done();
                  }
                  oldLocalPouch.close(function (err) {
                    should.not.exist(err, 'got error in close: ' + JSON.stringify(err));
                    if (err) {
                      done();
                    }
                    new PouchDB(testHelpers.name, function (err, newPouch) {
                      should.not.exist(err, 'got error in 2nd constructor: ' + JSON.stringify(err));
                      if (err) {
                        done();
                      }
                      newPouch.allDocs({}, function (err, res) {
                        should.not.exist(err, 'got error in allDocs: ' + JSON.stringify(err));
                        res.rows.should.have.length(3, 'unexpected rows: ' + JSON.stringify(res.rows));
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
    });
  });
});