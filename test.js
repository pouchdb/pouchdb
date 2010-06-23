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
        couch.post({test:"somestuff"}, {success:function (info) {
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
        couch.post({test:"somestuff"}, {success:function (info) {
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
        couch.post({test:"somestuff"}, {success:function (info) {
          ok(info);
          couch.changes({onChange:function (change) {
            if (change.seq == info.seq) start();
          }, error:function() {ok(false); start();}})
        }})
        
    }
    , error: function (error) {ok(!error, error); start();}
  })
})

asyncTest("Continuous changes", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {
        ok(couch);  
        var count = 0;
        couch.changes({ onChange : function (change) { count += 1; } 
                      , continuous : true
                      , seq : couch.seq + 1
                      , complete : function () {
                          equal(count, 0);
                          couch.post({test:"another"}, {
                            success : function (info) {
                              setTimeout(function () {equal(count, 1); start();}, 50)
                            }
                            , error : function (error) {ok(!error, error); start();}
                          })
                      }
                     });
    }
    , error: function (error) {ok(!error, error); start();}
  })
})

asyncTest("Bulk docs", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {
        ok(couch);  
        couch.bulk([{test:"somestuff"}, {test:"another"}], {success:function (infos) {
          ok(!infos[0].error);
          ok(!infos[1].error);
          start();
        }})
    }
    , error: function (error) {ok(!error, error); start();}
  })
})

asyncTest("Get doc", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {
        ok(couch);  
        couch.post({test:"somestuff"}, {success:function (info) {
          ok(info);
          couch.get(info.id, {success:function (doc) {
            equal(info.id, doc._id);
            couch.get(info.id+'asdf', {error:function(err) {
              ok(err.error);
              start();
            }})
          }})
        }})
    }
    , error: function (error) {ok(!error, error); start();}
  })
})

asyncTest("Remove doc", function () {
  createCouch( 
    { name: "test"
    , success: function (couch) {
        ok(couch);  
        couch.post({test:"somestuff"}, {success:function (info) {
          ok(info);
          var seq = couch.seq;
          couch.remove({test:"somestuff",_id:info.id,_rev:info.rev}, {success:function (doc) {
            equal(couch.seq, seq + 1)
            couch.get(info.id, {error:function(err) {
              equal(err.error, 'Document has been deleted.');
              start();
            }})
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