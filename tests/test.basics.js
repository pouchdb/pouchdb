module("basics", {
  setup : function () {
    this.name = 'test_suite_db';
  }
});

asyncTest("Create a pouch", function() {
  initTestDB(this.name, function(err, db) {
    ok(!err, 'created a pouch');
    start();
  });
});

asyncTest("Remove a pouch",function() {
  pouch.deleteDatabase("test", function(err) {
    ok(!err);
    start();
  });
});

asyncTest("Add a doc", function() {
  initTestDB(this.name, function(err, db) {
    ok(!err, 'opened the pouch');
    db.post({test:"somestuff"}, function (err, info) {
      ok(!err, 'saved a doc with post');
      start();
    });
  });
});

asyncTest("Modify a doc", function() {
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

asyncTest("Modify a doc with incorrect rev", function() {
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

asyncTest("Get doc", function() {
  initTestDB(this.name, function(err, db) {
    db.post({test:"somestuff"}, function(err, info) {
      db.get(info.id, function(err, doc) {
        ok(!doc._junk, 'We shouldnt expose our junk');
        ok(doc.test);
        db.get(info.id+'asdf', function(err) {
          ok(err.error);
          start();
        });
      });
    });
  });
});

asyncTest("Remove doc", function() {
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

asyncTest("Delete document without id", function () {
  initTestDB(this.name, function(err, db) {
    db.remove({test:'ing'}, function(err) {
      ok(err, 'failed to delete');
      start();
    });
  });
});


asyncTest("Bulk docs", function() {
  initTestDB(this.name, function(err, db) {
    ok(!err, 'opened the pouch');
    db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
      ok(!infos[0].error);
      ok(!infos[1].error);
      start();
    });
  });
});

asyncTest("Check revisions", function() {
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

asyncTest("Check database with slashes", function() {
  initTestDB('test_suite_db%2Fwith_slashes', function(err, db) {
    ok(!err, 'opened');
    start();
  });
});


asyncTest("Basic checks", function() {
  initTestDB('test_suite_db', function(err, db) {
    db.info(function(err, info) {
      ok(info.db_name === 'test_suite_db');
      ok(info.doc_count === 0);
      var doc = {_id: '0', a: 1, b:1};
      db.put(doc, function(err, res) {
        ok(res.ok === true);
        ok(res.id);
        ok(res.rev);
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
