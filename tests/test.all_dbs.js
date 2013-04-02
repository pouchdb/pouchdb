/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */
/*globals Pouch: true, QUnit, uuid, asyncTest, ok, start*/
"use strict";

var qunit = module;
var LevelPouch;

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

// Remove old allDbs to prevent DOM exception
Object.keys(Pouch.adapters).forEach(function(adapter) {
  if (adapter === "http" || adapter === "https") {
    return;
  }

  Pouch.destroy(Pouch.allDBName(adapter), function(){});
});

// Loop through all availible adapters
Object.keys(Pouch.adapters).forEach(function(adapter) {
  // allDbs method only works for local adapters
  if (adapter === "http" || adapter === "https") {
    return;
  }

  qunit('allDbs: ' + adapter, {
    setup: function() {
      // enable allDbs
      Pouch.enableAllDbs = true;

      // DummyDB Names
      this.pouchNames = [];

      var pouchName;
      for (var i = 0; i < 5; i++) {
        pouchName = 'testdb_' + uuid();
        this.pouchNames.push([adapter, "://", pouchName].join(''));
      }
    },
    teardown: function() {
      Pouch.enableAllDbs = false;
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
              ok(false, "pouch name not found in allDbs");
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
              ok(true, "all pouches created registered in allDbs");
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
              ok(false, "pouch name not found in allDbs");
              return start();
            }
          });

          ok(true, "all pouches created registered in allDbs");

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
                    ok(false, "pouch name found in allDbs after its destroyed");
                    return start();
                  }
                });

                ok(true, "all pouches destroyed no longer registered in allDbs");
                start();
              });
            }
          );
        });
      }
    );
  });
});

// Test for return value of allDbs
// The format should follow the following rules:
// 1. if an adapter is specified upon Pouch creation, the dbname will include the adapter prefix
//   - eg. "idb://testdb"
// 2. Otherwise, the dbname will just contain the dbname (without the adapter prefix)
qunit("allDbs return value", {
  setup: function() {
    // enable allDbs
    Pouch.enableAllDbs = true;

    // DummyDB Names
    var pouchNames = [];

    // Create some pouches with adapter prefix
    var pouchName;
    Object.keys(Pouch.adapters).forEach(function(adapter) {
      // allDbs method only works for local adapters
      if (adapter === "http" || adapter === "https") {
        return;
      }

      pouchName = 'testdb_' + uuid();
      pouchNames.push([adapter, "://", pouchName].join(''));
    });

    // Create some pouches without adapter prefix
    for (var i = 0; i < 3; i++) {
      pouchName = 'testdb_' + uuid();
      pouchNames.push(pouchName);
    }

    this.pouchNames = pouchNames;
  },
  teardown: function() {
    Pouch.enableAllDbs = false;
  }
});

asyncTest("Create and Destroy Pouches with and without adapter prefixes", 2, function() {
  var pouchNames = this.pouchNames;
  async(
    // Create Pouches from pouchNames array
    pouchNames.map(function(name) {
      return function(callback) {
        new Pouch(name, callback);
      };
    }), function(err) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      // check allDbs output
      Pouch.allDbs(function(err, dbs) {
        if (err) {
          console.error(err);
          ok(false, err);
          return start();
        }

        pouchNames.forEach(function(pouch) {
          // check if pouchName exists in allDbs
          var exists = dbs.some(function(dbname) {
            return dbname === pouch;
          });

          if (!exists) {
            ok(false, "pouch name not found in allDbs");
            return start();
          }
        });

        ok(true, "All pouches registered in allDbs in the correct format");

        // destroy pouches
        async(
          pouchNames.map(function(db) {
            return function(callback) {
              Pouch.destroy(db, callback);
            };
          }),
          function(err) {
            if (err) {
              console.error(err);
              ok(false, err);
              return start();
            }

            // Check that pouches no longer exist in allDbs
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
                  ok(false, "pouch name found in allDbs after its destroyed");
                  return start();
                }
              });

              ok(true, "all pouches destroyed no longer registered in allDbs");
              start();
            });
          }
        );
      });
    });
});
