asyncTest("create a couch", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {ok(couch); start(); }
    , error: function (error) {ok(!error); start();}
  })
})

asyncTest("Add doc", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {ok(couch); start(); }
    , error: function (error) {ok(!error); start();}
  })
})