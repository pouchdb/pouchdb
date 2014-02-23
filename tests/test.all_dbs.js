'use strict';

var testHelpers = {};
// async method takes an array of functions of signature:
// `function (cb) {}`
// each function is called and `callback` is called when all functions are done.
// each function calls `cb` to signal completion
// cb is called with error as the first arguments (if any)
// Once all functions are completed (or upon err)
// callback is called `callback(err)`
function async(functions, callback) {
  function series(functions) {
    callback = callback || function () {
    };
    if (!functions.length) {
      return callback();
    }
    var fn = functions.shift();
    fn.call(fn, function (err) {
      if (err) {
        callback(err);
        return;
      }
      series(functions);
    });
  }
  series(functions);
}
describe('allDbs', function () {
  // Remove old allDbs to prevent DOM exception
  Object.keys(PouchDB.adapters).forEach(function (adapter) {
    if (adapter === 'http' || adapter === 'https') {
      return;
    }
    PouchDB.destroy(PouchDB.allDBName(adapter), function () {
    });
  });
  // Loop through all availible adapters
  Object.keys(PouchDB.adapters).forEach(function (adapter) {
    // allDbs method only works for local adapters
    if (adapter === 'http' || adapter === 'https') {
      return;
    }
    describe(adapter, function () {
      beforeEach(function () {
        // enable allDbs
        PouchDB.enableAllDbs = true;
        // DummyDB Names
        testHelpers.pouchNames = [];
        var pouchName;
        for (var i = 0; i < 5; i++) {
          pouchName = testUtils.adapterUrl('local', '-' + i);
          testHelpers.pouchNames.push([
            adapter,
            '://',
            pouchName
          ].join(''));
        }
      });
      afterEach(function () {
        PouchDB.enableAllDbs = false;
      });
      it('new Pouch registered in allDbs', function (done) {
        this.timeout(15000);
        var pouchName = testHelpers.pouchNames[0];
        function after(err) {
          PouchDB.destroy(pouchName, function (er) {
            if (er) {
              done(er);
            } else {
              done(err);
            }
          });
        }
        // create db
        new PouchDB(pouchName, function (err, db) {
          if (err) {
            return after(err);
          }
          PouchDB.allDbs(function (err, dbs) {
            if (err) {
              return after(err);
            }
            // check if pouchName exists in _all_db
            dbs.some(function (dbname) {
              return dbname === pouchName;
            }).should.equal(true, 'pouch exists in allDbs database');
            after();
          });
        });
      });
      it('Pouch.destroy removes pouch from allDbs', function (done) {
        var pouchName = testHelpers.pouchNames[0];
        // create db
        new PouchDB(pouchName, function (err, db) {
          if (err) {
            return done(err);
          }
          PouchDB.allDbs(function (err, dbs) {
            if (err) {
              return done(err);
            }
            // check if pouchName exists in _all_db
            dbs.some(function (dbname) {
              return dbname === pouchName;
            }).should.equal(true, 'pouch exists in allDbs database');
            // remove db
            PouchDB.destroy(pouchName, function (err, info) {
              if (err) {
                return done(err);
              }
              PouchDB.allDbs(function (err, dbs) {
                if (err) {
                  return done(err);
                }
                // check if pouchName still exists in _all_db
                dbs.some(function (dbname) {
                  return dbname === pouchName;
                }).should.equal(false, 'pouch no longer exists in allDbs database');
                done();
              });
            });
          });
        });
      });
      it('Create Multiple Pouches', function (done) {
        var pouchNames = testHelpers.pouchNames;
        async(pouchNames.map(function (pouch) {
          return function (callback) {
            new PouchDB(pouch, callback);
          };
        }), function (err) {
          if (err) {
            return done(err);
          }
          PouchDB.allDbs(function (err, dbs) {
            if (err) {
              return done(err);
            }
            pouchNames.forEach(function (pouch) {
              // check if pouchName exists in _all_db
              dbs.some(function (dbname) {
                return dbname === pouch;
              }).should.equal(true, 'pouch name not found in allDbs');
            });
            // destroy remaining pouches
            async(pouchNames.map(function (pouch) {
              return function (callback) {
                PouchDB.destroy(pouch, callback);
              };
            }), function (err) {
              done(err);
            });
          });
        });
      });
      it('Create and Destroy Multiple Pouches', function (done) {
        var pouchNames = testHelpers.pouchNames;
        async(pouchNames.map(function (pouch) {
          return function (callback) {
            new PouchDB(pouch, callback);
          };
        }), function (err) {
          if (err) {
            return done(err);
          }
          PouchDB.allDbs(function (err, dbs) {
            if (err) {
              return done(err);
            }
            // check if pouchName exists in _all_db
            pouchNames.forEach(function (pouch) {
              dbs.some(function (dbname) {
                return dbname === pouch;
              }).should.equal(true);
            });
            //
            // Destroy all Pouches
            //
            async(pouchNames.map(function (pouch) {
              return function (callback) {
                return PouchDB.destroy(pouch, callback);
              };
            }), function (err) {
              if (err) {
                return done(err);
              }
              PouchDB.allDbs(function (err, dbs) {
                if (err) {
                  return done(err);
                }
                // check if pouchName exists in _all_db
                pouchNames.forEach(function (pouch) {
                  dbs.some(function (dbname) {
                    return dbname === pouch;
                  }).should.equal(false, 'pouch name found in allDbs after its destroyed');
                });
                done();
              });
            });
          });
        });
      });
      // Test for return value of allDbs
      // The format should follow the following rules:
      // 1. if an adapter is specified upon Pouch creation, the dbname will include the adapter prefix
      //   - eg. "idb://testdb"
      // 2. Otherwise, the dbname will just contain the dbname (without the adapter prefix)
      it('Create and Destroy Pouches with and without adapter prefixes', function (done) {
        var pouchNames = testHelpers.pouchNames;
        async(pouchNames.map(function (name) {
          return function (callback) {
            new PouchDB(name, callback);
          };
        }), function (err) {
          if (err) {
            return done(err);
          }
          // check allDbs output
          PouchDB.allDbs(function (err, dbs) {
            if (err) {
              return done(err);
            }
            pouchNames.forEach(function (pouch) {
              // check if pouchName exists in allDbs
              dbs.some(function (dbname) {
                return dbname === pouch;
              }).should.equal(true, 'pouch name not found in allDbs');
            });
            // destroy pouches
            async(pouchNames.map(function (db) {
              return function (callback) {
                PouchDB.destroy(db, callback);
              };
            }), function (err) {
              if (err) {
                return done(err);
              }
              // Check that pouches no longer exist in allDbs
              PouchDB.allDbs(function (err, dbs) {
                if (err) {
                  return done(err);
                }
                // check if pouchName exists in _all_db
                pouchNames.forEach(function (pouch) {
                  dbs.some(function (dbname) {
                    return dbname === pouch;
                  }).should.equal(false, 'pouch name found in allDbs after its destroyed');
                });
                done();
              });
            });
          });
        });
      });
    });
  });
});
