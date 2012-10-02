var specify  = require('specify')
  , async    = require('async')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "design/multiple")
  , db   = nano.use("design_multiple")
  ;

specify("design_multiple:setup", timeout, function (assert) {
  nano.db.create("design_multiple", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert(
    { "views": 
      { "by_id": 
        { "map": function(doc) { emit(doc._id, doc); } } 
      }
    }, '_design/alice', function (error, response) {
      assert.equal(error, undefined, "Failed to create views");
      assert.equal(response.ok, true, "Response should be ok");
      async.parallel(
        [ function(cb) { db.insert({"foo": "bar"}, "foobar", cb); }
        , function(cb) { db.insert({"bar": "foo"}, "barfoo", cb); }
        , function(cb) { db.insert({"foo": "baz"}, "foobaz", cb); }
        ]
      , function(error, results) {
        assert.equal(error, undefined, "Should have stored docs");
      });
    });
  });
});

specify("design_multiple:test", timeout, function (assert) {
  db.view('alice','by_id', 
  { keys: ['foobar', 'barfoo'], include_docs: true }, function (err, view) {
    assert.equal(err, undefined, "View didn't respond");
    assert.equal(view.rows.length, 2, 'Has more or less than two rows');
    assert.equal(view.rows[0].id, 'foobar', 'Foo is not the first id');
    assert.equal(view.rows[1].id, 'barfoo', 'Bar is not the second id');
  });
});

specify("design_multiple:teardown", timeout, function (assert) {
  nano.db.destroy("design_multiple", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));