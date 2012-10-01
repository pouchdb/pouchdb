var soda = require('soda')
,   assert = require('assert');

var browser = soda.createSauceClient({
  'url': 'http://saucelabs.com/'
, 'username': 'pouchdb'
, 'access-key': '97de9ee0-2712-49f0-9b17-4b9751d79073'
, 'os': 'Mac 10.6'
, 'browser': 'googlechrome'
, 'browser-version': ''
, 'name': 'Pouch-Chrome/Win2003'
});

browser.on('command', function(cmd, args){
  console.log(' \x1b[33m%s\x1b[0m: %s', cmd, args.join(', '));
});

browser
  .chain
  .session()
  .open('http://127.0.0.1:8000/tests/test.html')
  .setTimeout(400000)
  .waitForTextPresent('Tests completed in')
  .end(function(err){
    this.queue = null;
    this.setContext('sauce:job-info={"passed": ' + (err === null) + '}', function(){
      browser.testComplete(function(){
        if (err) throw err;
      });
    });
  });
