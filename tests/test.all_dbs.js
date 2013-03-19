/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */
/*globals Pouch: true, QUnit, uuid, asyncTest, ok, start*/
"use strict";

var qunit = module;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

// async method takes an array of functions of signature:
// `function(cb) {}`
// each function is called and `callback` is called when all functions are done.
// each function calls `cb` to signal completion
// cb is called with error as the first arguments (if any)
// Once all functions are completed (or upon err)
// callback is called `callback(err)`
function async(functions, callback) {
  function series(functions) {
    callback = callback || function() {};

    if (!functions.length) {
      return callback();
    }

    var fn = functions.shift();
    fn.call(fn, function(err) {
      if (err) {
        callback(err);
        return;
      }

      series(functions);
    });
  }

  series(functions);
}

// Loop through all availible adapters
Object.keys(Pouch.adapters).forEach(function(adapter) {
  // allDbs method only works for local adapters
  if (adapter === "http" || adapter === "https") {
    return;
  }

  qunit('allDbs: ' + adapter, {
    setup: function() {
        // DummyDB Names
        this.pouchNames = [];

        var pouchName;
        for (var i = 0; i < 5; i++) {
          pouchName = 'testdb_' + uuid();
          this.pouchNames.push([adapter, "://", pouchName].join(''));
        }
    },
    teardown: function() {
    }
  });

  asyncTest("new Pouch registered in allDbs", 2, function() {
    var pouchName = this.pouchNames[0];

    // create db
    new Pouch(pouchName, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      Pouch.allDbs(function(err, dbs) {
        if (err) {
          console.error(err);
          ok(false, err);
          return start();
        }

        // check if pouchName exists in _all_db
        var exists = dbs.some(function(dbname) {
          return dbname === pouchName;
        });
        ok(exists, "pouch exists in allDbs database");

        // remove db
        Pouch.destroy(pouchName, function(err, info) {
          ok(!err, "pouch destroyed");
          start();
        });
      });
    });
  });

  asyncTest("Pouch.destroy removes pouch from allDbs", 3, function() {
    var pouchName = this.pouchNames[0];

    // create db
    new Pouch(pouchName, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      Pouch.allDbs(function(err, dbs) {
        if (err) {
          console.error(err);
          ok(false, err);
          return start();
        }

        // check if pouchName exists in _all_db
        var exists = dbs.some(function(dbname) {
          return dbname === pouchName;
        });
        ok(exists, "pouch exists in allDbs database");

        // remove db
        Pouch.destroy(pouchName, function(err, info) {
          ok(!err, "pouch destroyed");
          Pouch.allDbs(function(err, dbs) {
            if (err) {
              console.error(err);
              ok(false, err);
              return start();
            }

            // check if pouchName still exists in _all_db
            var exists = dbs.some(function(dbname) {
              return dbname === pouchName;
            });
            ok(!exists, "pouch no longer exists in allDbs database");
            start();
          });
        });
      });
    });
  });

  asyncTest("Create Multiple Pouches", 1, function() {
    var pouchNames = this.pouchNames;
    async(
      pouchNames.map(function(pouch) {
        return function(callback) {
          new Pouch(pouch, callback);
        };
      }),
      function(err) {
        if (err) {
          console.error(err);
          ok(false, 'failed to open database');
          return start();
        }

        Pouch.allDbs(function(err, dbs) {
          if (err) {
            console.error(err);
            ok(false, err);
            return start();
          }

          pouchNames.forEach(function(pouch) {
            // check if pouchName exists in _all_db
            var exists = dbs.some(function(dbname) {
              return dbname === pouch;
            });

            if (!exists) {
              ok(false, "pouch name not found in all_dbs");
              return start();
            }
          });

          // destroy remaining pouches
          async(
            pouchNames.map(function(pouch) {
              return function(callback) {
                Pouch.destroy(pouch, callback);
              };
            }),
            function(err) {
              ok(true, "all pouches created registered in all_dbs");
              start();
            }
          );

        });
      }
    );
  });

  asyncTest("Create and Destroy Multiple Pouches", 2, function() {
    var pouchNames = this.pouchNames;

    async(
      //
      // Create Multiple Pouches
      //
      pouchNames.map(function(pouch) {
        return function(callback) {
          new Pouch(pouch, callback);
        };
      }),
      function(err) {
        if (err) {
          console.error(err);
          ok(false, 'failed to open database');
          return start();
        }

        Pouch.allDbs(function(err, dbs) {
          if (err) {
            console.error(err);
            ok(false, err);
            return start();
          }

          // check if pouchName exists in _all_db
          pouchNames.forEach(function(pouch) {
            var exists = dbs.some(function(dbname) {
              return dbname === pouch;
            });

            if (!exists) {
              ok(false, "pouch name not found in all_dbs");
              return start();
            }
          });

          ok(true, "all pouches created registered in all_dbs");

          //
          // Destroy all Pouches
          //
          async(
            pouchNames.map(function(pouch) {
              return function(callback) {
                return Pouch.destroy(pouch, callback);
              };
            }),
            function(err) {
              if (err) {
                console.error(err);
                ok(false, 'failed to open database');
                return start();
              }

              Pouch.allDbs(function(err, dbs) {
                if (err) {
                  console.error(err);
                  ok(false, err);
                  return start();
                }

                // check if pouchName exists in _all_db
                pouchNames.forEach(function(pouch) {
                  var exists = dbs.some(function(dbname) {
                    return dbname === pouch;
                  });

                  if (exists) {
                    ok(false, "pouch name found in all_dbs after its destroyed");
                    return start();
                  }
                });

                ok(true, "all pouches destroyed no longer registered in all_dbs");
                start();
              });
            }
          );
        });
      }
    );
  });
});
