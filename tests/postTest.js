/*globals openTestDB: false */

"use strict";

module("misc", {
  setup : function () {
    var dbname = location.search.match(/[?&]dbname=([^&]+)/);
    this.name = dbname && decodeURIComponent(dbname[1]);
  }
});

asyncTest("Add a doc", 2, function() {
  openTestDB(this.name, function(err, db) {
    ok(!err, 'opened the pouch');
    db.post({test:"somestuff"}, function (err, info) {
      ok(!err, 'saved a doc with post');
      start();
    });
  });
});
