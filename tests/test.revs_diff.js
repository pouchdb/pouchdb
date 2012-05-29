['idb-1', 'http-1'].map(function(adapter) {

  module("revs diff:" + adapter, {
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