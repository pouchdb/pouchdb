module("basics", {
  setup : function () {
    var suffix = '';
    for (var i = 0 ; i < 10 ; i++ ) {
      suffix += (Math.random()*16).toFixed().toString(16);
    }
    this.name = 'test' + suffix;
  }
});

asyncTest("Create a pouch", function() {
  pouch.open(this.name, function(err, db) {
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
  pouch.open(this.name, function(err, db) {
    ok(!err, 'opened the pouch');
    db.post({test:"somestuff"}, function (err, info) {
      ok(!err, 'saved a doc with post');
      start();
    });
  });
});

asyncTest("Modify a doc", function() {
  pouch.open(this.name, function(err, db) {
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

asyncTest("Get doc", function() {
  pouch.open(this.name, function(err, db) {
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

asyncTest("Remove doc", function() {
  pouch.open(this.name, function(err, db) {
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

asyncTest("Bulk docs", function() {
  pouch.open(this.name, function(err, db) {
    ok(!err, 'opened the pouch');
    db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
      ok(!infos[0].error);
      ok(!infos[1].error);
      start();
    });
  });
});
