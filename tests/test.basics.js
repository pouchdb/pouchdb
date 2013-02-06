"use strict";

var adapters = ['http-1', 'local-1'];
var qunit = module;

if (typeof module !== undefined && module.exports) {
  this.Pouch = require('../src/pouch.js');
  this.LevelPouch = require('../src/adapters/pouch.leveldb.js');
  this.utils = require('./test.utils.js');

  for (var k in this.utils) {
    global[k] = global[k] || this.utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapter) {

  qunit("basics: " + adapter, {
    setup: function() {
      this.name = generateAdapterUrl(adapter);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.name);
      }
    }
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
    console.info('testing: Modify a doc');
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

  asyncTest("Get doc", 2, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function(err, info) {
        db.get(info.id, function(err, doc) {
          ok(doc.test);
          db.get(info.id+'asdf', function(err) {
            ok(err.error);
            start();
          });
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

  asyncTest("Get revisions of removed doc", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function(err, info) {
        var rev = info.rev;
        db.remove({test:"somestuff", _id:info.id, _rev:info.rev}, function(doc) {
          db.get(info.id, {rev: rev}, function(err, doc) {
            ok(!err, 'Recieved deleted doc with rev');
            start();
          });
        });
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

  asyncTest("Get design doc", 2, function() {
    initTestDB(this.name, function(err, db) {
      db.put({_id: '_design/someid', test:"somestuff"}, function(err, info) {
        db.get(info.id, function(err, doc) {
          ok(doc.test);
          db.get(info.id+'asdf', function(err) {
            ok(err.error);
            start();
          });
        });
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

  asyncTest("Check revisions", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test: "somestuff"}, function (err, info) {
        db.put({_id: info.id, _rev: info.rev, another: 'test'}, function(err, info) {
          db.put({_id: info.id, _rev: info.rev, a: 'change'}, function(err, info2) {
            db.get(info.id, {revs_info:true}, function(err, doc) {
              ok(doc._revs_info.length === 3, 'updated a doc with put');
              start();
            });
          });
        });
      });
    });
  });

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

  asyncTest("Testing Rev format", 2, function() {
    console.info('testing: Rev format');
    var revs = [];
    initTestDB(this.name, function(err, db) {
      db.post({test: "somestuff"}, function (err, info) {
        revs.unshift(info.rev.split('-')[1]);
        db.put({_id: info.id, _rev: info.rev, another: 'test1'}, function(err, info2) {
          revs.unshift(info2.rev.split('-')[1]);
          db.put({_id: info.id, _rev: info2.rev, last: 'test2'}, function(err, info3) {
            revs.unshift(info3.rev.split('-')[1]);
            db.get(info.id, {revs:true}, function(err, doc) {
              ok(doc._revisions.start === 3, 'correct starting position');
              deepEqual(revs, doc._revisions.ids, 'correct revs returned');
              start();
            });
          });
        });
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

  asyncTest("Retrieve old revision", function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({version: "first"}, function (err, info) {
        var firstrev = info.rev;
        ok(!err, 'saved a doc with post');
        db.put({_id: info.id, _rev: info.rev, version: 'second'}, function(err, info2) {
          ok(!err && info2.rev !== info._rev, 'updated a doc with put');
          db.get(info.id, {rev: info.rev}, function(err, oldRev) {
            equal(oldRev.version, 'first', 'Fetched old revision');
            start();
          });
        });
      });
    });
  });

  asyncTest('update_seq persists', 2, function() {
    var name = this.name;
    initTestDB(name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        Pouch(name, function(err, db) {
          db.info(function(err, info) {
            equal(info.update_seq, 1, 'Update seq persisted');
            equal(info.doc_count, 1, 'Doc Count persists');
            start();
          });
        });
      });
    });
  });
});
