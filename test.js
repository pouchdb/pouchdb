module("basics", {
  setup : function () {
    var suffix = '';
    for (var i = 0 ; i < 10 ; i++ ) {
      suffix += (Math.random()*16).toFixed().toString(16);
    };
    this.name = 'test' + suffix;
  }
});

asyncTest("Create a pouch", function () {
  pouch.open(this.name, function (err, db) {
    ok(!err, 'created a pouch');
    start();
  })
})

asyncTest("Add a doc", function () {
  pouch.open(this.name, function (err, db) {
    ok(!err, 'opened the pouch');
    db.post({test:"somestuff"}, function (err, info) {
      ok(!err, 'saved a doc with post');
      start();
    })
  })
})

asyncTest("Modify a doc", function () {
  pouch.open(this.name, function (err, db) {
    ok(!err, 'opened the pouch');
    db.post({test: "somestuff"}, function (err, info) {
      ok(!err, 'saved a doc with post');
      db.put({_id: info.id, _rev: info.rev, another: 'test'}
      , function (err, info2) {
        ok(!err && info2.seq == 2, 'updated a doc with put');
        start();
      })
    })
  })
})

asyncTest("All changes", function () {
  pouch.open(
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
  pouch.open(
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
  pouch.open(
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
  pouch.open(
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
  pouch.open(
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

module('replicate')

asyncTest("replicate from",function(){
  pouch.open(
    { name: "test"
    , success: function (couch) {
        ok(couch);
        couch.replicate.from(
          { url:'/'+window.location.pathname.split('/')[1]
          , success: function (changes) {
              //
            }
          , error: function (e) {
              //
            }
          }
        );
      }
    }
  )
})

asyncTest("remove a pouch",function(){
  pouch.deleteDatabase( {
      name:"test"
    , success:function () { ok(true); start(); }
    , error: function (error) {ok(!error, error); start();}
  });
})

