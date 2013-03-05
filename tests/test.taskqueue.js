
"use strict"

var adapters = ['http-1', 'local-1']

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

adapters.map(function(adapter) {

  qunit("taskqueue: " + adapter, {
    setup: function() {
      this.name = generateAdapterUrl(adapter);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        stop();
        Pouch.destroy(this.name, function() { start(); });
      }
    }
  });

  asyncTest("Add a doc", 1, function() {
    var db = openTestAsyncDB(this.name);
    db.post({test:"somestuff"}, function (err, info) {
      ok(!err, 'saved a doc with post');
      start();
    });
  });

  asyncTest("Query", 1, function() {
    var db = openTestAsyncDB(this.name);
    var queryFun = {
      map: function(doc) { }
    };
    db.query(queryFun, { reduce: false }, function (_, res) {
      equal(res.rows.length, 0);
      start();
    });
  });

  asyncTest("Bulk docs", 2, function() {
    var db = openTestAsyncDB(this.name);

    db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
      ok(!infos[0].error);
      ok(!infos[1].error);
      start();
    });
  });

  asyncTest("Get", 1, function() {
    var db = openTestAsyncDB(this.name);

    db.get('0', function(err, res) {
      ok(err);
      start();
    });
  });

  asyncTest("Info", 2, function() {
    var db = openTestAsyncDB(this.name);

    db.info(function(err, info) {
      ok(info.doc_count === 0);
      ok(info.update_seq === 0);
      start();
    });
  });
});
