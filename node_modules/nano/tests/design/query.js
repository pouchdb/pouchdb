var specify  = require('specify')
  , async    = require('async')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "design/query")
  , db   = nano.use("design_query")
  ;

specify("design_query:setup", timeout, function (assert) {
  nano.db.create("design_query", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert(
    { "views": 
      { "by_name_and_city": 
        { "map": function(doc) { emit([doc.name, doc.city], doc._id); } } 
      }
    }, '_design/people', function (error, response) {
      assert.equal(error, undefined, "Failed to create views");
      assert.equal(response.ok, true, "Response should be ok");
      async.parallel(
        [ function(cb) { db.insert(
            { name: "Derek", city: "San Francisco" }, "p_derek", cb); }
        , function(cb) { db.insert(
            { name: "Randall", city: "San Francisco" }, "p_randall", cb); }
        , function(cb) { db.insert(
            { name: "Nuno", city: "New York" }, "p_nuno", cb); }
        ]
      , function(error, results) {
        assert.equal(error, undefined, "Should have stored docs");
      });
    });
  });
});

specify("design_query:test", timeout, function (assert) {
  db.view('people','by_name_and_city', 
  {key: ["Derek","San Francisco"]}, function (error, view) {
    assert.equal(error, undefined, "View didn't respond");
    assert.equal(view.rows.length,1);
    assert.equal(view.rows.length,1);
    assert.equal(view.rows[0].id,'p_derek');
    assert.equal(view.rows[0].key[0],'Derek');
    assert.equal(view.rows[0].key[1],'San Francisco');
  });
});

specify("design_query:teardown", timeout, function (assert) {
  nano.db.destroy("design_query", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));