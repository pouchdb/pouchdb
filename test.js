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

asyncTest("Modify doc", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {
        ok(couch);  
        couch.post({"test":"somestuff"}, {success:function (info) {
          ok(info);
          couch.post({ _id:info.id, _rev:info.rev, 'another':'test'},
                     { success:function (info2) {ok(info2.seq == (info.seq + 1), info.seq+' '+info2.seq); start();}
                     , error: function (err) {ok(!err, err); start();}
                     })
        }})
    }
    , error: function (error) {ok(!error, error); start();}
  })
})

asyncTest("All changes", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {
        ok(couch);  
        couch.post({"test":"somestuff"}, {success:function (info) {
          ok(info);
          couch.changes({onChange:function (change) {
            if (change.seq == info.seq) start();
          }})
        }})
    }
    , error: function (error) {ok(!error, error); start();}
  })
})


module("cleanup.")

asyncTest("remove couch",function(){
  removeCouch( { name:"test" 
                , success:function () { ok(true); start(); }
                , error: function (error) {ok(!error, error); start();}
                } );
})