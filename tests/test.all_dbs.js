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
  callback = callback || function() {};

  if (!functions.length) {
    return callback();
  }

  var completed = 0;
  var cb = function() {
    completed++;
    if (completed === functions.length) {
      callback.call(callback);
    }
  };

  var error;
  functions.forEach(function(fn) {
    if (!error) {
      fn.call(fn, function(err) {
        if (err) {
          error = err;
          callback(err);
          return;
        }
        cb();
      });
    }
  });
}

// Loop through all availible adapters
Object.keys(Pouch.adapters).forEach(function(adapter) {
  // _all_dbs method only works for local adapters
  if (adapter === "http" || adapter === "https") {
    return;
  }

  qunit('all_dbs: ' + adapter, {
    setup: function() {
        // DummyDB Names
        this.pouchNames = [];

        var pouchName;
        var pouchNameInAllDbs;
        for (var i = 0; i < 5; i++) {
          pouchName = 'testdb_' + uuid();
          pouchNameInAllDbs = adapter + "-" + pouchName;
          this.pouchNames.push({
            pouchName: [adapter, "://", pouchName].join(''),
            pouchNameInAllDbs: pouchNameInAllDbs
          });
        }
    },
    teardown: function() {
    }
  });

  asyncTest("new Pouch registered in _all_dbs", 2, function() {
    var pouchName = this.pouchNames[0].pouchName;
    var pouchNameInAllDbs = this.pouchNames[0].pouchNameInAllDbs;

    // create db
    new Pouch(pouchName, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      Pouch._all_dbs(function(err, docs) {
        if (err) {
          console.error(err);
          ok(false, err);
          return start();
        }

        // check if pouchName exists in _all_db
        var exists = docs.some(function(doc) {
          return doc.id === pouchNameInAllDbs;
        });
        ok(exists, "pouch exists in _all_dbs database");

        // remove db
        Pouch.destroy(pouchName, function(err, info) {
          ok(!err, "pouch destroyed");
          start();
        });
      });
    });
  });

  asyncTest("Pouch.destroy removes pouch from _all_dbs", 3, function() {
    var pouchName = this.pouchNames[0].pouchName;
    var pouchNameInAllDbs = this.pouchNames[0].pouchNameInAllDbs;

    // create db
    new Pouch(pouchName, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      Pouch._all_dbs(function(err, docs) {
        if (err) {
          console.error(err);
          ok(false, err);
          return start();
        }

        // check if pouchName exists in _all_db
        var exists = docs.some(function(doc) {
          return doc.id === pouchNameInAllDbs;
        });
        ok(exists, "pouch exists in _all_dbs database");

        // remove db
        Pouch.destroy(pouchName, function(err, info) {
          ok(!err, "pouch destroyed");
          Pouch._all_dbs(function(err, docs) {
            if (err) {
              console.error(err);
              ok(false, err);
              return start();
            }

            // check if pouchName still exists in _all_db
            var exists = docs.some(function(doc) {
              return doc.id === pouchNameInAllDbs;
            });
            ok(!exists, "pouch no longer exists in _all_dbs database");
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
          new Pouch(pouch.pouchName, callback);
        };
      }),
      function(err) {
        if (err) {
          console.error(err);
          ok(false, 'failed to open database');
          return start();
        }

        Pouch._all_dbs(function(err, docs) {
          if (err) {
            console.error(err);
            ok(false, err);
            return start();
          }

          pouchNames.forEach(function(pouch) {
            // check if pouchName exists in _all_db
            var exists = docs.some(function(doc) {
              return doc.id === pouch.pouchNameInAllDbs;
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
                Pouch.destroy(pouch.pouchName, callback);
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
          new Pouch(pouch.pouchName, callback);
        };
      }),
      function(err) {
        if (err) {
          console.error(err);
          ok(false, 'failed to open database');
          return start();
        }

        Pouch._all_dbs(function(err, docs) {
          if (err) {
            console.error(err);
            ok(false, err);
            return start();
          }

          // check if pouchName exists in _all_db
          pouchNames.forEach(function(pouch) {
            var exists = docs.some(function(doc) {
              return doc.id === pouch.pouchNameInAllDbs;
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
                return Pouch.destroy(pouch.pouchName, callback);
              };
            }),
            function(err) {
              if (err) {
                console.error(err);
                ok(false, 'failed to open database');
                return start();
              }

              Pouch._all_dbs(function(err, docs) {
                if (err) {
                  console.error(err);
                  ok(false, err);
                  return start();
                }

                // check if pouchName exists in _all_db
                pouchNames.forEach(function(pouch) {
                  var exists = docs.some(function(doc) {
                    return doc.id === pouch.pouchNameInAllDbs;
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
