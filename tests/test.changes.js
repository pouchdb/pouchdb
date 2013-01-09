"use strict";

var adapters = ['http-1', 'local-1'];
var qunit = module;

if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js')
    , LevelPouch = require('../src/adapters/pouch.leveldb.js')
    , utils = require('./test.utils.js')

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  adapters = ['leveldb-1', 'http-1']
  qunit = QUnit.module;
}

adapters.map(function(adapter) {

  QUnit.module("changes: " + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.name);
      }
    }
  });

  asyncTest("All changes", function () {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        db.changes({
          onChange: function (change) {
            ok(!change.doc, 'If we dont include docs, dont include docs');
            ok(change.seq, 'Received a sequence number');
            start();
          },
          error: function() {
            ok(false);
            start();
          }
        });
      });
    });
  });

  asyncTest("Changes doc", function () {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        db.changes({
          include_docs: true,
          onChange: function (change) {
            ok(change.doc);
            equal(change.doc._id, change.id);
            equal(change.doc._rev, change.changes[change.changes.length - 1].rev);
            start();
          },
          error: function() {
            ok(false);
            start();
          }
        });
      });
    });
  });

  asyncTest("Continuous changes", function() {
    initTestDB(this.name, function(err, db) {
      var count = 0;
      var changes = db.changes({
        onChange: function(change) {
          count += 1;
          ok(!change.doc, 'If we dont include docs, dont include docs');
          equal(count, 1, 'Only recieve a single change');
          changes.cancel();
          start();
        },
        continuous: true
      });
      db.post({test:"adoc"});
    });
  });

  // asyncTest("Continuous changes across windows", function() {
  //   var search = window.location.search
  //     .replace(/[?&]testFiles=[^&]+/, '')
  //     .replace(/[?&]dbname=[^&]+/, '')
  //     + '&testFiles=postTest.js&dbname=' + encodeURIComponent(this.name);
  //   initTestDB(this.name, function(err, db) {
  //     var count = 0;
  //     var tab;
  //     var changes = db.changes({
  //       onChange: function(change) {
  //         count += 1;
  //         equal(count, 1, 'Recieved a single change');
  //         changes.cancel();
  //         tab && tab.close();
  //         start();
  //       },
  //       continuous: true
  //     });
  //     tab = window.open('test.html?' + search.replace(/^[?&]+/, ''));
  //   });
  // });

  asyncTest("Continuous changes doc", function() {
    initTestDB(this.name, function(err, db) {
      var changes = db.changes({
        onChange: function(change) {
          ok(change.doc, 'doc included');
          ok(change.doc._rev, 'rev included');
          changes.cancel();
          start();
        },
        continuous: true,
        include_docs: true
      });
      db.post({test:"adoc"});
    });
  });

  asyncTest("Cancel changes", function() {
    initTestDB(this.name, function(err, db) {
      var count = 0;
      var changes = db.changes({
        onChange: function(change) {
          count += 1;
          if (count === 1) {
            changes.cancel();
            db.post({test:"another doc"}, function(err, info) {
              // This setTimeout ensures that once we cancel a change we dont recieve
              // subsequent callbacks, so it is needed
              setTimeout(function() {
                equal(count, 1);
                start();
              }, 200);
            });
          }
        },
        continuous: true
      });
      db.post({test:"adoc"});
    });
  });

  asyncTest("Changes filter", function() {

    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    var docs2 = [
      {_id: "4", integer: 4},
      {_id: "5", integer: 5},
      {_id: "6", integer: 6},
      {_id: "7", integer: 7}
    ];

    initTestDB(this.name, function(err, db) {
      var count = 0;
      db.bulkDocs({docs: docs1}, function(err, info) {
        var changes = db.changes({
          filter: function(doc) { return doc.integer % 2 === 0; },
          onChange: function(change) {
            count += 1;
            if (count === 4) {
              ok(true, 'We got all the docs');
              changes.cancel();
              start();
            }
          },
          continuous: true
        });
        db.bulkDocs({docs: docs2});
      });
    });
  });

});
