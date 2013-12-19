"use strict";

console.log('wtf');

var dbname = location.search.match(/[?&]dbname=([^&]+)/);
var db1 = dbname && decodeURIComponent(dbname[1]);

module("misc");

asyncTest("Add a doc", 2, function() {

  new PouchDB(db1, function(err, db) {
    ok(!err, 'opened the pouch');
    db.post({test:"somestuff"}, function (err, info) {
      ok(!err, 'saved a doc with post');
      start();
    });
  });
});
