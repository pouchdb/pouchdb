module("test database.")

asyncTest("create a couch", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {ok(couch); start(); }
    , error: function (error) {ok(!error, error); start();}
  })
})

asyncTest("Add doc", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {
        ok(couch);  
        couch.post({"test":"somestuff"}, {success:function (info) {
          ok(info);
          start();
        }})
    }
    , error: function (error) {ok(!error, error); start();}
  })
})

module("cleanup.")

asyncTest("remove couch",function(){
  removeCouch( { name:"test" 
                , success:function () { start(); }
                , error: function (error) {console.log('asdfasfs');ok(!error, error); start();}
                } );
})