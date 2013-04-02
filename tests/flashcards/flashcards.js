
var CORS_PROXY_URL = "http://localhost:9292/";

var POUCH_DB_NAME  = "idb://flashcards_tests";
// my local dev instance:
//var COUCH_DB_PATH  = "127.0.0.1:5984/test_replic";
// Pouch CI test instance:
//var COUCH_DB_PATH = "127.0.0.1:2020/perf-results"

// db with documents to load into Pouch before running tests
var COUCH_DATASET = "pouchdb.iriscouch.com:80/perf-flashcards_tests";

// local and remote results db: results are persisted locally and then replicated to remote Couch
var POUCH_RESULTS_DB_NAME = "idb://flashcards_tests_results";
var COUCH_RESULTS_DB_PATH = "127.0.0.1:5984/flashcards_test_results";

var replic = function() {
  Pouch.destroy("idb://replic_test", function() {
    Pouch("idb://replic_test", function(err, db) {
      if (err) {
        console.error(err);
      }
      db.replicate.from("http://127.0.0.1:2020/perf-flashcards_tests/", function(err, result) {
        if (err) {
          console.error(err);
        }
        db.info(function(err, info) {
          if (err) {
            console.error(err);
          }
        });
      });
    });
    });
}

var replot = function() {
  // replot
  var docId = $(this).attr("class").split(" ")[1].substr(2, 50); // FIXME: !!that 50
  Pouch(POUCH_RESULTS_DB_NAME, function(err, db) {
    db.get(docId, function(err, doc) {
      var sample = doc.sample;
      var graphData = $.map(sample, function(val, idx) {
        return {x: idx, y: val};
      });

      var graph = new Rickshaw.Graph({
        element: document.querySelector("#chart"),
        renderer: "bar",
        series: [{
          data: graphData,
          color: "steelblue"
        }]
      });
      graph.render();
      var hoverDetail = new Rickshaw.Graph.HoverDetail( {
        graph: graph
      } );

      // var xAxis = new Rickshaw.Graph.Axis.Time( {
      //     graph: graph,
      //     ticksTreatment: "glow"
      // } );

      var yAxis = new Rickshaw.Graph.Axis.Y({
        graph: graph,
        timeUnit: (new Rickshaw.Fixtures.Time()).unit("second"),
        ticksTreatment: "glow"
      });
      yAxis.render();
    });
  });
};

var logMessage = function(message) {
  $("#messages>ul").append("<li>" + message + "</li>")
}

var test = function() {
  // Wipe out existing db and create a fresh one from Couch first.

  Pouch.destroy(POUCH_DB_NAME, function() {
    logMessage("local db reset");
    Pouch(POUCH_DB_NAME, function(err, db) {
    db.replicate.from(CORS_PROXY_URL + COUCH_DATASET, function(err, result) {

      if (err) {
        console.error(err);
      }

      logMessage("replicated dataset from Couch");
      logMessage("running the test suite... this can take a while");
      db.info(function(err, info) {
        console.info(info);
      });

      var doc = {"side1": "oproerpolitie", "side2": "riot police"};
      var suite = new Benchmark.Suite("pouchTestSuite", {
        async: false,
        minSamples: 5,
        maxTime: 60
      });
      suite.add("Pouchdb#post", function() {
        db.post(doc);
      }).on("complete", function() {
        var bench = this;
        var stats = bench[0].stats;

        // save results
        Pouch(POUCH_RESULTS_DB_NAME, function(err, db) {
          // TODO: Record browser info here.
          var testId = new Date().getTime();
          var doc = {
            "_id": String(testId),
            "sample": stats.sample,
            "mean": stats.mean,
            "deviation": stats.deviation
          };
          db.put(doc, function(err, resp) {
            db.replicate.to(CORS_PROXY_URL+COUCH_RESULTS_DB_PATH, function(err, results) {
              // Update body tag for CI
              document.body.attributes["data-results-id"] = testId;
              document.body.attributes["class"] = "complete";

              logMessage("replicated test result data");
              $("#pastRunsDiv").show();
              db.replicate.from(CORS_PROXY_URL+COUCH_RESULTS_DB_PATH, function(err, results) {
                db.allDocs(function(err, resp) {
                  $.each(resp.rows, function(idx, val) {
                    var $li = $("<li class='plotLink id" + val.id + "'><a href='#" + val.id + "'>" + val.id + "</a></li>");
                    $("#pastRuns").append($li);
                    $li.click(replot);
                  });
                });
              });
            });
          });
        });
      }).run();
    });
  })
  });

}
