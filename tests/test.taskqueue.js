
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
      Pouch.destroy(this.name);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.name);
      }
    }
  });

  var origDocs = [
    {_id:"0",a:1,b:1},
    {_id:"3",a:4,b:16},
    {_id:"1",a:2,b:4},
    {_id:"2",a:3,b:9}
  ];

  function writeDocs(db, docs, callback) {
    if (!docs.length) {
      return callback();
    }
    var doc = docs.shift();
    db.put(doc, function(err, doc) {
      ok(doc.ok, 'docwrite returned ok');
      writeDocs(db, docs, callback);
    });
  }

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
      map: function(doc) { emit(doc.key, doc); }
    };
    db.query(queryFun, { reduce: false, startkey: 'notfound' }, function (_, res) {
      console.log(db.taskqueue.queue());
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
})
