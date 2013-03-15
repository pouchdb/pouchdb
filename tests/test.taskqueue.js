
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
        Pouch.destroy(this.name);
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

  asyncTest("Bulk docs", 2, function() {
    var db = openTestAsyncDB(this.name);

    db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
      ok(!infos[0].error);
      ok(!infos[1].error);
      start();
    });
  });

  asyncTest("Bulk docs", 2, function() {
    var db = openTestAsyncDB(this.name);

    db.info(function(err, info) {
      ok(info.doc_count === 0);
      ok(info.updateSeq === 0);
      start();
    });
  });
})
