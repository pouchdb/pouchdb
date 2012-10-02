var soda = require('soda')
,   assert = require('assert')
,   nano = require('nano');

var browser = soda.createSauceClient({
  'url': 'http://saucelabs.com/'
, 'username': 'pouchdb'
, 'access-key': '97de9ee0-2712-49f0-9b17-4b9751d79073'
    , 'os': 'Windows 2003'
    , 'browser': 'googlechrome'
    , 'browser-version': ''
    , 'name': 'Pouch-Chrome/Win2003'
});

browser.on('command', function(cmd, args){
  console.log(' \x1b[33m%s\x1b[0m: %s', cmd, args.join(', '));
});

var url = 'http://127.0.0.1:8000/tests/test.html';
if(process.argv[2]) {
    git_hash = process.argv[2];
    url += '#' + git_hash;
}

var couch = nano('http://127.0.0.1:5984');
var couch_proxy = nano('http://127.0.0.1:2020');
// just prove that we can hit these dbs on both ports
couch.db.list(function(err, body) {
    console.log('couch 5984', err, body);
});
couch_proxy.db.list(function(err, body) {
    console.log('couch proxy', err, body);
});


browser
  .chain
  .session()
  .open(url)
  .setTimeout(1000000)
  .waitForTextPresent('Tests completed in')
  .waitForTextPresent('Storing Results Complete.')
  .end(function(err){
    this.queue = null;
    var sauce_details = {
        jobUrl : this.jobUrl,
        videoUrl : this.videoUrl,
        logUrl : this.logUrl
    }

    replicate_test_results(sauce_details, couch, function(err, doc){
        var passed = true;
        if (err || doc.report.results.failed > 0) passed = false;
        setTestPassed(browser, passed, function(err){
            closeTest(browser, function(err){

            });
        })
    });
  });


function replicate_test_results(sauce_details, couch, callback) {
   var db = couch.db.use('test_suite_db110');
   db.list({include_docs: true}, function(err, res){
       if (err) return callback('could not find stored results')
       if (!res || !res.rows || res.rows.length == 0 || !res.rows[0].doc) return callback('No stored results');
       var doc = res.rows[0].doc;
       doc.sauce = sauce_details;
       var failed = false;
       if (!doc.report || !doc.report.results || doc.report.results.failed > 0) failed = true;
       db.insert(doc, doc._id, function(err){
           if (err) callback('could not store test results');
           couch.replicate('test_suite_db110', 'http://reupholster.iriscouch.com/pouch_tests', callback);
           callback(null, doc);
       });
   });
}


function setTestPassed(browser, pass, callback) {
    browser.setContext('sauce:job-info={"passed": ' + pass + '}', callback);
}


function closeTest(browser, callback) {
    browser.testComplete(callback);
}
