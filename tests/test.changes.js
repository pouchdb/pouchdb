module("basics", {
  setup : function () {
    var suffix = '';
    for (var i = 0 ; i < 10 ; i++ ) {
      suffix += (Math.random()*16).toFixed().toString(16);
    }
    this.name = 'test' + suffix;
  }
});

asyncTest("All changes", function () {
  pouch.open(this.name, function(err, db) {
    db.post({test:"somestuff"}, function (err, info) {
      db.changes({
        onChange: function (change) {
          ok(change.seq);
          start();
        },
        error: function() {
          ok(false);
          start();
        }
      });
    });
  });
});

// asyncTest("Continuous changes", function () {
//   pouch.open({
//     name: "test",
//     success: function (couch) {
//       ok(couch);
//       var count = 0;
//       couch.changes({
//         onChange : function (change) { count += 1; },
//         continuous : true,
//         seq : couch.seq + 1,
//         complete : function () {
//           equal(count, 0);
//           couch.post({test:"another"}, {
//             success : function (info) {
//               setTimeout(function () {equal(count, 1); start();}, 50);
//             },
//             error : function (error) {ok(!error, error); start();}
//           });
//         }
//       });
//     },
//     error: function (error) {ok(!error, error); start();}
//   });
// });

