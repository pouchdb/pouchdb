var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "db/compact")
  , db   = nano.use("db_compact")
  ;

specify("db_compact:setup", timeout, function (assert) {
  nano.db.create("db_compact", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert({"foo": "baz"}, "foobaz", function (error, foo) {   
      assert.equal(error, undefined, "Should have stored foo");
      assert.equal(foo.ok, true, "Response should be ok");
      db.destroy("foobaz", foo.rev, function (error, response) {
        assert.equal(error, undefined, "Should have deleted foo");
        assert.equal(response.ok, true, "Response should be ok");
      });
    });
  });
});

specify("db_compact:test", timeout, function (assert) {
   db.compact(function (error) {
     assert.equal(error, undefined, "Compact didn't respond");
     db.info(function (error, info) {
       assert.equal(error, undefined, "Info didn't respond");
       assert.equal(info.doc_count, 0, "Document count is not 3");
       assert.equal(info.doc_del_count, 1, "No deleted documents");
       assert.equal(info.update_seq, 2, "seq is two");
       assert.equal(info.compact_running, true, "Compaction is running");
     });
   });
});

specify("db_compact:teardown", timeout, function (assert) {
  // you can really mess up couchdb by trying to
  // delete while a db is compacting
  (function destroy_when_compact_finished(timeout) {
    timeout = timeout || 50;
    db.info(function (error, info) {
      if(error || info && info.compact_running) {
        return setTimeout(destroy_when_compact_finished, timeout*2);
      }
      nano.db.destroy("db_compact", function (err) {
        assert.equal(err, undefined, "Failed to destroy database");
        assert.ok(mock.isDone(), "Some mocks didn't run");
      });
    });
  })();
});

specify.run(process.argv.slice(2));