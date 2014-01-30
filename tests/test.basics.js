"use strict";

var adapters = ['http-1', 'local-1'];

if (typeof module !== 'undefined' && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

adapters.map(function(adapter) {

  QUnit.module("basics: " + adapter, {
    setup: function() {
      this.name = testUtils.generateAdapterUrl(adapter);
      PouchDB.enableAllDbs = false;
    },
    teardown: testUtils.cleanupTestDatabases
  });

  asyncTest("Create a pouch", 1, function() {
    testUtils.initTestDB(this.name, function(err, db) {
      ok(!err, 'created a pouch');
      start();
    });
  });

  asyncTest("Remove a pouch", 1, function() {
    var name = this.name;
    testUtils.initTestDB(name, function(err, db) {
      PouchDB.destroy(name, function(err, db) {
        ok(!err);
        start();
      });
    });
  });

  asyncTest("Add a doc", 2, function() {
    testUtils.initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({test:"somestuff"}, function (err, info) {
        ok(!err, 'saved a doc with post');
        start();
      });
    });
  });
  asyncTest("Add a doc with a promise", 1, function() {
    testUtils.initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({test:"somestuff"}).then(function (info) {
        start();
      },function(err){
        ok(!err, 'saved a doc with post');
        start();
      });
    });
  });

  asyncTest("Modify a doc", 3, function() {
    testUtils.initTestDB(this.name, function(err, db) {
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

  asyncTest("Modify a doc with sugar syntax", 4, function() {
    testUtils.initTestDB(this.name, function (err, db) {
      ok(!err, 'opened the pouch');
      db.post({test: "somestuff"}, function (err, info) {
        ok(!err, 'saved a doc with post');
        db.put({another: 'test'}, info.id, info.rev, function (err, info2) {
          ok(!err && info2.rev !== info._rev, 'updated a doc with put');
          db.put({yet_another : 'test'}, 'yet_another', function (err, info3) {
            ok(!err && info3.rev && info3.id === 'yet_another', 'created a doc with put');
            start();
          });
        });
      });
    });
  });

  asyncTest("Modify a doc with a promise", 2, function() {
    testUtils.initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({test: "promisestuff"}).then(function(info){
        return db.put({_id: info.id, _rev: info.rev, another: 'test'}).then(function(info2){
          ok(info2.rev !== info._rev, 'updated a doc with put');
        });
      }).catch(function(err){
        ok(!err);
      }).then(function(){
        start();
      });
    });
  });
  asyncTest("Read db id", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      ok(typeof(db.id()) === 'string' && db.id() !== '', "got id");
      start();
    });
  });

  asyncTest("Close db", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.close(function(error){
        ok(!err, 'close called back with an error');
        start();
      });
    });
  });
  asyncTest("Close db with a promise", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.close().then(function(){
        ok(true)
        start();
      },function(error){
        ok(!err, 'close called back with an error');
        start();
      });
    });
  });

  asyncTest("Read db id after closing", function() {
    var dbName = this.name;
    testUtils.initTestDB(dbName, function(err, db) {
      db.close(function(error){
        ok(!err, 'close called back with an error');
        testUtils.openTestDB(dbName, function(err, db){
          ok(typeof(db.id()) === 'string' && db.id() !== '', "got id");
          start();
        });
      });
    });
  });

  asyncTest("Modify a doc with incorrect rev", 3, function() {
    testUtils.initTestDB(this.name, function(err, db) {
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

  asyncTest("Remove doc", 1, function() {
    testUtils.initTestDB(this.name, function(err, db) {
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

    asyncTest("Remove doc with a promise", 1, function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.post({test:"someotherstuff"}).then(function(info) {
        return db.remove({test:"someotherstuff", _id:info.id, _rev:info.rev})
          .then(function() {
            return db.get(info.id).then(function(doc){
              ok(false);
              start();
            },function(err) {
              ok(err.error);
              start();
            });
          });
      });
    });
  });

  asyncTest("Doc removal leaves only stub", 1, function() {
    testUtils.initTestDB(this.name, function(err, db) {
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
    testUtils.initTestDB(this.name, function(err, db) {
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
    testUtils.initTestDB(this.name, function(err, db) {
      var changesCount = 2;
      var changes = db.changes({
        continuous: true,
        include_docs: true,
        onChange: function(change) {
          if (change.doc._deleted) {
            ok(true, 'doc deleted');
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
    testUtils.initTestDB(this.name, function(err, db) {
      db.remove({test:'ing'}, function(err) {
        ok(err, 'failed to delete');
        start();
      });
    });
  });

  asyncTest("Bulk docs", 3, function() {
    testUtils.initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
        ok(!infos[0].error);
        ok(!infos[1].error);
        start();
      });
    });
  });
  asyncTest("Bulk docs with a promise", 3, function() {
    testUtils.initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}).then(function(infos) {
        ok(!infos[0].error);
        ok(!infos[1].error);
        start();
      }).catch(start);
    });
  });

  asyncTest("Basic checks", 8, function() {
    testUtils.initTestDB(this.name, function(err, db) {
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
            notEqual(info.update_seq, updateSeq , 'update seq changed');
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

    testUtils.initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: bad_docs}, function(err, res) {
        strictEqual(err.status, 500);
        strictEqual(err.name, 'doc_validation');
        start();
      });
    });

  });

  asyncTest("Testing issue #48", 1, function() {

    var docs = [{"id":"0"}, {"id":"1"}, {"id":"2"},
                {"id":"3"}, {"id":"4"}, {"id":"5"}];
    var x = 0;
    var timer;

    testUtils.initTestDB(this.name, function(err, db) {
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
    testUtils.initTestDB(this.name, function(err, db) {
      db.post({'_id': 123, test: "somestuff"}, function (err, info) {
        ok(err, 'id must be a string');
        start();
      });
    });
  });

  asyncTest("Put doc without _id should fail", 1, function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.put({test:"somestuff"}, function(err, info) {
        ok(err, '_id is required');
        start();
      });
    });
  });

  asyncTest('update_seq persists', 2, function() {
    var name = this.name;
    testUtils.initTestDB(name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        new PouchDB(name, function(err, db) {
          db.info(function(err, info) {
            notEqual(info.update_seq, 0, 'Update seq persisted');
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
    testUtils.initTestDB(this.name, function(err, db) {
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
    testUtils.initTestDB(this.name, function(err, db) {
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
          notEqual(db2Info.update_seq, 0, 'Update seqs arent 0');
          start();
        });
      });
    });
  });

  test('Error works', 3, function() {
    var newError = PouchDB.Errors.error(PouchDB.Errors.BAD_REQUEST, "love needs no message");
    ok(newError.status === 400);
    ok(newError.name === 'bad_request');
    ok(newError.message === "love needs no message");
  });


  asyncTest('Fail to fetch a doc after db was deleted', 2, function() {
    var name = this.name;
    testUtils.initTestDB(name, function(err, db) {
      var doc = {_id: 'foodoc'};
      var doc2 = {_id: 'foodoc2'};
      var db2 = new PouchDB({name: name});
      db.put(doc, function() {
        db2.put(doc2, function() {
          db.allDocs(function(err, docs) {
            equal(docs.total_rows, 2, 'Wrote 2 documents');
            PouchDB.destroy({name: name}, function() {
              db2 = new PouchDB(name);
              db2.get(doc._id, function(err, doc) {
                equal(err.status, 404, 'doc is missing');
                start();
              });
            });
          });
        });
      });
    });
  });

  asyncTest("Can't add docs with empty ids", function(done) {
    var docs = [{}, {_id : null}, {_id : undefined}, {_id : ''},
                {_id : {}}, {_id : '_underscored_id'}];
    var num = docs.length;
    testUtils.initTestDB(this.name, function(err, db) {
      docs.forEach(function(doc) {
        db.put(doc, function (err, info) {
          ok(err, "didn't get an error for doc: " + JSON.stringify(doc) +
             '; response was ' + JSON.stringify(info));
          if(!(--num)){
            done();
          }
        });
      });
    });
  });
});