"use strict";

var adapters = ['http-1', 'local-1'];
var qunit = module;

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
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

  qunit("revs diff:" + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    }
  });

  asyncTest("Test revs diff", function() {
    var revs = [];
    initTestDB(this.name, function(err, db) {
      db.post({test: "somestuff", _id: 'somestuff'}, function (err, info) {
        revs.push(info.rev);
        db.put({_id: info.id, _rev: info.rev, another: 'test'}, function(err, info2) {
          revs.push(info2.rev);
          db.revsDiff({'somestuff': revs}, function(err, results) {
            ok(!('somestuff' in results), 'werent missing any revs');
            revs.push('2-randomid');
            db.revsDiff({'somestuff': revs}, function(err, results) {
              ok('somestuff' in results, 'listed missing revs');
              ok(results.somestuff.missing.length === 1, 'listed currect number of');
              start();
            });
          });
        });
      });
    });
  });

});
