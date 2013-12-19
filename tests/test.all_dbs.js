"use strict";

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
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

function clearAllDbs(callback) {
  PouchDB.allDbs(function(err, dbs) {
    (function clear() {
      if (!dbs.length) {
        callback();
      } else {
        var db = dbs.shift();
        PouchDB.destroy(db);
      }
    })();
  });
}

QUnit.module('allDbs', {
  setup: function() {
    stop();
    clearAllDbs(function() {
      PouchDB.enableAllDbs = true;
      start();
    });
  },
  teardown: function() {
    stop();
    clearAllDbs(function() {
      PouchDB.enableAllDbs = false;
      start();
    });
  }
});

asyncTest("new Pouch registered in allDbs", 2, function() {

  var pouchName = 'test_alldb';

  // create db
  new PouchDB(pouchName, function(err, db) {
    if (err) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }

    PouchDB.allDbs(function(err, dbs) {
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
      PouchDB.destroy(pouchName, function(err, info) {
        ok(!err, "pouch destroyed");
        start();
      });
    });
  });
});

asyncTest("Pouch.destroy removes pouch from allDbs", 3, function() {
  var pouchName = 'test_alldb';

  // create db
  new PouchDB(pouchName, function(err, db) {
    if (err) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }

    PouchDB.allDbs(function(err, dbs) {
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
      PouchDB.destroy(pouchName, function(err, info) {
        ok(!err, "pouch destroyed");
        PouchDB.allDbs(function(err, dbs) {
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
  var pouchNames = ['testdb1', 'testdb2', 'testdb3'];
  async(
    pouchNames.map(function(pouch) {
      return function(callback) {
        new PouchDB(pouch, callback);
      };
    }),
    function(err) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      PouchDB.allDbs(function(err, dbs) {
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
              PouchDB.destroy(pouch, callback);
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
  var pouchNames = ['testdb1', 'testdb2', 'testdb3'];

  async(
    //
    // Create Multiple Pouches
    //
    pouchNames.map(function(pouch) {
      return function(callback) {
        new PouchDB(pouch, callback);
      };
    }),
    function(err) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      PouchDB.allDbs(function(err, dbs) {
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
              return PouchDB.destroy(pouch, callback);
            };
          }),
          function(err) {
            if (err) {
              console.error(err);
              ok(false, 'failed to open database');
              return start();
            }

            PouchDB.allDbs(function(err, dbs) {
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
