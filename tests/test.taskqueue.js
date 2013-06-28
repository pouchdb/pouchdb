/*globals openTestAsyncDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */
/*globals Pouch: true, QUnit, uuid, asyncTest, ok, start*/
/*globals cleanupTestDatabases: false, cleanUpDB:false */

"use strict";

var adapters = ['http-1', 'local-1', 'cors-1'];
var qunit = module;
var LevelPouch;
var HttpPouch;
var CorsPouch;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  HttpPouch = require('../src/adapters/pouch.http.js');
  CorsPouch = require('../src/adapters/pouch.cors.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapter) {

  qunit("taskqueue: " + adapter, {
    setup: function() {
      stop();
      var self = this;
      generateAdapterUrl(adapter, function(name) {
        self.name = name;
        Pouch.enableAllDbs = true;
        start();
      });
    },
    teardown: function() {
      stop();
      cleanUpDB(this.name, function(){
        cleanupTestDatabases();
      });
    }
  });

  asyncTest("Add a doc", 1, function() {
    var name = this.name;
    Pouch.destroy(name, function() {
      var db = openTestAsyncDB(name);
      db.post({test:"somestuff"}, function (err, info) {
        ok(!err, 'saved a doc with post');
        start();
      });
    });
  });

  asyncTest("Query", 1, function() {
    var name = this.name;
    Pouch.destroy(name, function() {
      var db = openTestAsyncDB(name);
      var queryFun = {
        map: function(doc) { }
      };
      db.query(queryFun, { reduce: false }, function (_, res) {
        equal(res.rows.length, 0);
        start();
      });
    });
  });

  asyncTest("Bulk docs", 2, function() {
    var name = this.name;
    Pouch.destroy(name, function() {
      var db = openTestAsyncDB(name);

      db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
        ok(!infos[0].error);
        ok(!infos[1].error);
        start();
      });
    });
  });

  asyncTest("Get", 1, function() {
    var name = this.name;
    Pouch.destroy(name, function() {
      var db = openTestAsyncDB(name);

      db.get('0', function(err, res) {
        ok(err);
        start();
      });
    });
  });

  asyncTest("Info", 2, function() {
    var name = this.name;
    Pouch.destroy(name, function() {
      var db = openTestAsyncDB(name);

      db.info(function(err, info) {
        ok(info.doc_count === 0);
        ok(info.update_seq === 0);
        start();
      });
    });
  });
});
