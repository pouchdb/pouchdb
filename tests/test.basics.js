/*globals initTestDB, openTestDB, emit, generateAdapterUrl, cleanupTestDatabases */
/*globals PERSIST_DATABASES, initDBPair, ajax, strictEqual */
/*globals utils: true, LevelPouch: true */

"use strict";

var adapters = ['http-1', 'local-1'];
var qunit = module;
var LevelPouch;
var PouchDB;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  PouchDB = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapter) {

  qunit("basics: " + adapter, {
    setup: function() {
      this.name = generateAdapterUrl(adapter);
      Pouch.enableAllDbs = false;
    },
    teardown: cleanupTestDatabases
  });

  asyncTest("Create a pouch", 1, function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'created a pouch');
      start();
    });
  });

  asyncTest("Remove a pouch", 1, function() {
    var name = this.name;
    initTestDB(name, function(err, db) {
      Pouch.destroy(name, function(err, db) {
        ok(!err);
        start();
      });
    });
  });

  asyncTest("Add a doc", 2, function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({test:"somestuff"}, function (err, info) {
        ok(!err, 'saved a doc with post');
        start();
      });
    });
  });

  asyncTest("Modify a doc", 3, function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({test: "somestuff"}, function (err, info) {
        ok(!err, 'saved a doc with post');
        db.put({_id: info.id, _rev: info.rev, another: 'test'}, function(err, info2) {
          ok(!err && info2.rev !== info._rev, 'updated a doc with put');
          start();
        });
      });
    });
  });

  asyncTest("Read db id", function() {
    initTestDB(this.name, function(err, db) {
      ok(typeof(db.id()) === 'string' && db.id() !== '', "got id");
      start();
    });
  });

  asyncTest("Close db", function() {
    initTestDB(this.name, function(err, db) {
      db.close(function(error){
        ok(!err, 'close called back with an error');
        start();
      });
    });
  });

  asyncTest("Read db id after closing", function() {
    var dbName = this.name;
    initTestDB(dbName, function(err, db) {
      db.close(function(error){
        ok(!err, 'close called back with an error');
        openTestDB(dbName, function(err, db){
          ok(typeof(db.id()) === 'string' && db.id() !== '', "got id");
          start();
        });
      });
    });
  });

  asyncTest("Modify a doc with incorrect rev", 3, function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({test: "somestuff"}, function (err, info) {
        ok(!err, 'saved a doc with post');
        var nDoc = {_id: info.id, _rev: info.rev + 'broken', another: 'test'};
        db.put(nDoc, function(err, info2) {
          ok(err, 'put was denied');
          start();
        });
      });
    });
  });

  asyncTest("Add a doc with leading underscore in id", function() {
    initTestDB(this.name, function(err, db) {
      db.post({_id: '_testing', value: 42}, function(err, info) {
        ok(err);
        start();
      });
    });
  });

  asyncTest("Remove doc", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function(err, info) {
        db.remove({test:"somestuff", _id:info.id, _rev:info.rev}, function(doc) {
          db.get(info.id, function(err) {
            ok(err.error);
            start();
          });
        });
      });
    });
  });

  asyncTest("Doc removal leaves only stub", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.put({_id: "foo", value: "test"}, function(err, res) {
        db.get("foo", function(err, doc) {
          db.remove(doc, function(err, res) {
            db.get("foo", {rev: res.rev}, function(err, doc) {
              deepEqual(doc, {_id: res.id, _rev: res.rev, _deleted: true}, "removal left only stub");
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Remove doc twice with specified id", 4, function() {
    initTestDB(this.name, function(err, db) {
      db.put({_id:"specifiedId", test:"somestuff"}, function(err, info) {
        db.get("specifiedId", function(err, doc) {
          ok(doc.test, "Put and got doc");
          db.remove(doc, function(err, response) {
            ok(!err, "Removed doc");
            db.put({_id:"specifiedId", test:"somestuff2"}, function(err, info) {
              db.get("specifiedId", function(err, doc){
                ok(doc, "Put and got doc again");
                db.remove(doc, function(err, response) {
                  ok(!err, "Removed doc again");
                  start();
                });
              });
            });
          });
        });
      });
    });
  });

  asyncTest("Remove doc, no callback", 2, function() {
    initTestDB(this.name, function(err, db) {
      var changes = db.changes({
        continuous: true,
        include_docs: true,
        onChange: function(change){
          if (change.seq === 2){
            ok(change.doc._deleted, 'Doc deleted properly');
            changes.cancel();
            start();
          }
        }
      });
      db.post({_id:"somestuff"}, function (err, res) {
        ok(!err, 'save a doc with post');
        db.remove({_id: res.id, _rev: res.rev});
      });
    });
  });

  asyncTest("Delete document without id", 1, function () {
    initTestDB(this.name, function(err, db) {
      db.remove({test:'ing'}, function(err) {
        ok(err, 'failed to delete');
        start();
      });
    });
  });

  asyncTest("Bulk docs", 3, function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
        ok(!infos[0].error);
        ok(!infos[1].error);
        start();
      });
    });
  });

  /*
  asyncTest("Sync a doc", 6, function() {
    var couch = generateAdapterUrl('http-2');
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      initTestDB(couch, function(err, db2) {
        ok(!err, 'opened the couch');
        db.put({_id:"adoc", test:"somestuff"}, function (err, info) {
          ok(!err, 'saved a doc with post');
          db.replicate.to(couch, function(err, info) {
            ok(!err, 'replicated pouch to couch');
            db.replicate.from(couch, function(err, info) {
              ok(!err, 'replicated couch back to pouch');
              db.get("adoc", {conflicts:true}, function(err, doc) {
                ok(!doc._conflicts, 'doc has no conflicts');
                start();
              });
            });
          });
        });
      })
    });
  });
  */

  // From here we are copying over tests from CouchDB
  // https://github.com/apache/couchdb/blob/master/share/www/script/test/basics.js
  /*
  asyncTest("Check database with slashes", 1, function() {
    initTestDB('idb://test_suite_db%2Fwith_slashes', function(err, db) {
      ok(!err, 'opened');
      start();
    });
  });
  */

  asyncTest("Basic checks", 8, function() {
    initTestDB(this.name, function(err, db) {
      db.info(function(err, info) {
        var updateSeq = info.update_seq;
        var doc = {_id: '0', a: 1, b:1};
        ok(info.doc_count === 0);
        db.put(doc, function(err, res) {
          ok(res.ok === true);
          ok(res.id);
          ok(res.rev);
          db.info(function(err, info) {
            ok(info.doc_count === 1);
            equal(info.update_seq, updateSeq + 1, 'update seq incremented');
            db.get(doc._id, function(err, doc) {
              ok(doc._id === res.id && doc._rev === res.rev);
              db.get(doc._id, {revs_info: true}, function(err, doc) {
                ok(doc._revs_info[0].status === 'available');
                start();
              });
            });
          });
        });
      });
    });
  });

  asyncTest("Doc validation", function() {
    var bad_docs = [
      {"_zing": 4},
      {"_zoom": "hello"},
      {"zane": "goldfish", "_fan": "something smells delicious"},
      {"_bing": {"wha?": "soda can"}}
    ];

    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: bad_docs}, function(err, res) {
        strictEqual(err.status, 500);
        strictEqual(err.error, 'doc_validation');
        start();
      });
    });

  });

  asyncTest("Testing issue #48", 1, function() {

    var docs = [{"id":"0"}, {"id":"1"}, {"id":"2"}, {"id":"3"}, {"id":"4"}, {"id":"5"}];
    var x = 0;
    var timer;

    initTestDB(this.name, function(err, db) {
      var save = function() {
        db.bulkDocs({docs: docs}, function(err, res) {
          if (++x === 10) {
            ok(true, 'all updated succedded');
            clearInterval(timer);
            start();
          }
        });
      };
      timer = setInterval(save, 50);
    });
  });

  asyncTest("Testing valid id", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.post({'_id': 123, test: "somestuff"}, function (err, info) {
        ok(err, 'id must be a string');
        start();
      });
    });
  });

  asyncTest("Put doc without _id should fail", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.put({test:"somestuff"}, function(err, info) {
        ok(err, '_id is required');
        start();
      });
    });
  });

  asyncTest('update_seq persists', 2, function() {
    var name = this.name;
    initTestDB(name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        new PouchDB(name, function(err, db) {
          db.info(function(err, info) {
            equal(info.update_seq, 1, 'Update seq persisted');
            equal(info.doc_count, 1, 'Doc Count persists');
            start();
          });
        });
      });
    });
  });

  asyncTest('deletions persists', 1, function() {
    var doc = {_id: 'staticId', contents: 'stuff'};
    function writeAndDelete(db, cb) {
      db.put(doc, function(err, info) {
        db.remove({_id:info.id, _rev:info.rev}, function(doc) {
          cb();
        });
      });
    }
    initTestDB(this.name, function(err, db) {
      writeAndDelete(db, function() {
        writeAndDelete(db, function() {
          db.put(doc, function() {
            db.get(doc._id, {conflicts: true}, function(err, details) {
              equal(false, '_conflicts' in details, 'Should not have conflicts');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Error when document is not an object', 5, function() {
    initTestDB(this.name, function(err, db) {
      var doc1 = [{_id: 'foo'}, {_id: 'bar'}];
      var doc2 = "this is not an object";

      var count = 5;
      var callback = function(err, resp) {
        ok(err, 'doc must be an object');
        count--;
        if (count === 0) {
          start();
        }
      };

      db.post(doc1, callback);
      db.post(doc2, callback);
      db.put(doc1, callback);
      db.put(doc2, callback);
      db.bulkDocs({docs: [doc1, doc2]}, callback);
   });
  });

  asyncTest('Test instance update_seq updates correctly', function() {
    var db1 = new PouchDB(this.name);
    var db2 = new PouchDB(this.name);
    db1.post({a:'doc'}, function() {
      db1.info(function(err, db1Info) {
        db2.info(function(err, db2Info) {
          notEqual(db1Info.update_seq, 0, 'Update seqs arent 0');
          equal(db1Info.update_seq, db2Info.update_seq, 'Update seqs match');
          start();
        });
      });
    });
  });

  test('Error works', 1, function() {
    deepEqual(Pouch.error(Pouch.Errors.BAD_REQUEST, "love needs no reason"),
      {status: 400, error: "bad_request", reason: "love needs no reason"},
      "should be the same");
  });
});
