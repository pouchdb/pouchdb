var couchapp = require('couchapp')
    , path = require('path');

ddoc = {
  _id: '_design/test_results'
, views: {}
}
module.exports = ddoc;



ddoc.views.errors_by_commit = {
    map : function(doc) {
        if (!doc.git_commit) return;
        var errors = {};
        for (var i = 0; i < doc.report.suites.length; i++){
            var suite = doc.report.suites[i];
            for (var j=0; j < suite.tests.length; j++) {
                var test = suite.tests[j];
                if (test.failed > 0) {
                    var details = {
                        suite : suite.name,
                        test : test.name,
                        failures : test.failures,
                        stdout: suite.stdout
                    }
                    emit(doc.git_commit, details);
                }
            }
        }
    }
}

ddoc.views.errors_by_date = {
    map : function(doc) {
        if (!doc.completed) return;
        var errors = {};
        for (var i = 0; i < doc.report.suites.length; i++){
            var suite = doc.report.suites[i];
            for (var j=0; j < suite.tests.length; j++) {
                var test = suite.tests[j];
                if (test.failed > 0) {
                    var details = {
                        suite : suite.name,
                        test : test.name,
                        failures : test.failures,
                        stdout: suite.stdout
                    }
                    emit(doc.completed, details);

                }
            }
        }
    }
}

ddoc.views.errors_by_doc = {
    map : function(doc) {
        if (!doc.completed) return;
        var errors = {};
        for (var i = 0; i < doc.report.suites.length; i++){
            var suite = doc.report.suites[i];
            for (var j=0; j < suite.tests.length; j++) {
                var test = suite.tests[j];
                if (test.failed > 0) {
                    var details = {
                        suite : suite.name,
                        test : test.name,
                        failures : test.failures,
                        stdout: suite.stdout
                    }
                    emit(doc._id, details);

                }
            }
        }
    }
}