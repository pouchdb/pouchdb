asyncTest("All changes", function () {
  pouch.open({
    name: "test",
    success: function (couch) {
      ok(couch);
      couch.post({test:"somestuff"}, {success:function (info) {
        ok(info);
        couch.changes({
          onChange:function (change) {
            if (change.seq == info.seq) {
              start();
            }
          },
          error:function() {
            ok(false); start();}
        });
      }});
    },
    error: function (error) {ok(!error, error); start();}
  });
});

asyncTest("Continuous changes", function () {
  pouch.open({
    name: "test",
    success: function (couch) {
      ok(couch);
      var count = 0;
      couch.changes({
        onChange : function (change) { count += 1; },
        continuous : true,
        seq : couch.seq + 1,
        complete : function () {
          equal(count, 0);
          couch.post({test:"another"}, {
            success : function (info) {
              setTimeout(function () {equal(count, 1); start();}, 50);
            },
            error : function (error) {ok(!error, error); start();}
          });
        }
      });
    },
    error: function (error) {ok(!error, error); start();}
  });
});

module('replicate');

asyncTest("replicate from",function() {
  pouch.open({
    name: "test",
    success: function (couch) {
      ok(couch);
      couch.replicate.from({
        url:'/'+window.location.pathname.split('/')[1],
        success: function (changes) {
          //
        },
        error: function (e) {
          //
        }
      });
    }
  });
});
