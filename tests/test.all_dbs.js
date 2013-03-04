/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */
/*globals Pouch, QUnit, asyncTest, ok, start*/
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

// Loop through all availible adapters
Object.keys(Pouch.adapters).forEach(function(adapter) {
  // _all_dbs method only works for local adapters
  if (adapter === "http" || adapter === "https") {
    return;
  }

  // DummyDB Names
  // to allow use to remove then in teardown.
  var pouchNames = [];
  var pouchName;
  var pouchNameInAllDbs;
  for (var i = 0; i < 5; i++) {
    pouchName = 'testdb_' + uuid();
    pouchNameInAllDbs = adapter + "-" + pouchName;
    pouchNames.push({
      pouchName: pouchName,
      pouchNameInAllDbs: pouchNameInAllDbs
    });
  }

  qunit('all_dbs: ' + adapter, {
    setup: function() {

    },
    teardown: function() {
      // destroy any left over pouches
      pouchNames.forEach(function(pouch) {
        Pouch.destroy(pouch.pouchName);
      });
    }
  });

  asyncTest("new Pouch registered in _all_dbs", 2, function() {
    // create db
    new Pouch(adapter + "://" + pouchName, function(err, db) {
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
    // create db
    new Pouch(adapter + "://" + pouchName, function(err, db) {
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
    var acks = 0;
    var callback = function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      // increment acks
      acks = acks + 1;
      // only trigger callback when all pouches have been created.
      if (acks === pouchNames.length) {
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
          ok(true, "all pouches created registered in all_dbs");
          start();
        });
      }
    };

    pouchNames.forEach(function(pouch) {
      new Pouch(adapter + "://" + pouch.pouchName, callback);
    });
  });

  asyncTest("Create and Destroy Multiple Pouches", 2, function() {
    var acks2 = 0;
    var callback2 = function(err, info) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      // increment acks
      acks2 = acks2 + 1;
      // only trigger callback when all pouches have been created.
      if (acks2 === pouchNames.length) {
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

            if (exists) {
              ok(false, "pouch name found in all_dbs after its destroyed");
              return start();
            }
          });
          ok(true, "all pouches destroyed no longer registered in all_dbs");
          start();
        });
      }
    };

    var acks = 0;
    var callback = function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }

      // increment acks
      acks = acks + 1;
      // only trigger callback when all pouches have been created.
      if (acks === pouchNames.length) {
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
          ok(true, "all pouches created registered in all_dbs");

          pouchNames.forEach(function(pouch) {
            Pouch.destroy(pouch.pouchName, callback2);
          });
        });
      }
    };

    pouchNames.forEach(function(pouch) {
      new Pouch(adapter + "://" + pouch.pouchName, callback);
    });
  });
});
