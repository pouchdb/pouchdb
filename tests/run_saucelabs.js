var soda = require('soda')
,   assert = require('assert');

var browser = soda.createSauceClient({
  'url': 'http://saucelabs.com/'
, 'username': 'ryanramage'
, 'access-key': 'b8f74e0a-c3f7-4aeb-8497-1035cd4c2c84'
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


browser
  .chain
  .session()
  .open(url)
  .setTimeout(800000)
  .waitForTextPresent('Tests completed in')
  .click('css=button')
  .waitForTextPresent('Submission complete.')
  .end(function(err){
    this.queue = null;
    this.setContext('sauce:job-info={"passed": ' + (err === null) + '}', function(){
      browser.testComplete(function(){
        if (err) throw err;
      });
    });
  });
