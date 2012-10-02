
# Soda

Selenium Node Adapter. A light-weight Selenium RC client for [NodeJS](http://nodejs.org), with additional [Sauce Labs](http://saucelabs.com) integration for acceptance testing in the cloud.

## Installation

via npm:

    $ npm install soda

## Authors

  - TJ Holowaychuk ([visionmedia](http://github.com/visionmedia))
  - Adam Christian ([admc](http://github.com/admc))
  - Daniel Shaw ([dshaw](http://github.com/dshaw))

## Running Examples

The examples provided in _./examples_ are intended to be run against Selenium RC, which can be downloaded [here](http://seleniumhq.org/projects/remote-control/). Once installed simply execute the following command to start the selenium server:

    $ java -jar selenium-server.jar

Then choose an example to run using soda:

    $ node examples/google.js

## Actions

"Selenese" actions include commands such as _open_ and _type_. Every action has a corresponding `Client` method which accept a variable number of arguments followed by a callback `Function` which receives any potential `err`, the response `body`, and `response` object itself. 

    browser.session(function(err){
      browser.open('/', function(err, body, res){
        browser.type('q', 'Hello World', function(err, body, res){
          browser.testComplete(function(){
            
          });
        });
      });
    });

Because nested callbacks can quickly become overwhelming, Soda has optional chaining support by simply utilizing the `.chain` getter as shown below. If an exception is thrown in a callback, or a command fails then it will be passed to `end(err)`. The `.chain` getter should only be used once, activating the chaining api.

    browser
      .chain
      .session()
      .open('/')
      .type('q', 'Hello World')
      .end(function(err){
        browser.testComplete(function() {
          console.log('done');
          if(err) throw err;
        });
      });

When chaining successful commands may receive a callback, which is useful for custom assertions:

    browser
      .chain
      .session()
      .open('/')
      .getTitle(function(title){
        assert.equal('Hello World', title);
      })
      .end(function(err){
        browser.testComplete(function() {
          console.log('done');
          if(err) throw err;
        });
      })

With the `.and()` method you can add additional commands to the queue. The callback accepts the client instance, which is also the value of "this".

For example you may want to authenticate a user, note we do _not_ use `.chain` or `.end()` again, this simply extends the current queue.

    function login(user, pass) {
      return function(browser) {
        browser
          .open('/login')
          .type('username', name)
          .type('password', pass)
          .clickAndWait('login');
      }
    }

With this helper function we can now re-use this logic in several places, an express the tests in a more logical manor.

    browser
      .chain
      .session()
      .open('/')
      .assertTitle('Something')
      .and(login('foo', 'bar'))
      .assertTitle('Foobar')
      .and(login('someone', 'else'))
      .assertTitle('Someone else')
      .end(function(err){
        browser.testComplete(function() {
          console.log('done');
          if(err) throw err;
        });
      });

## Sauce Labs Videos &amp; Logs

When a job is complete, you can request the log or flv video from Sauce Labs. To access the url for these resources you may use `SauceClient#videoUrl` or `SauceClient#logUrl`, for example:

    ...
    .end(function(err){
      console.log(this.jobUrl)
      console.log(this.videoUrl)
      console.log(this.logUrl)
    })

Sauce Labs also provides a script that you may embed in your CI server to display the video, accessible via `SauceClient#video`, which will yield something similar to:

    <script src="http://saucelabs.com/video-embed/<job-id>.js?username=<username>&access_key=<access-key>"/>

## Selenium RC Example

    var soda = require('soda')
      , assert = require('assert');

    var browser = soda.createClient({
        host: 'localhost'
      , port: 4444
      , url: 'http://www.google.com'
      , browser: 'firefox'
    });

    browser
      .chain
      .session()
      .open('/')
      .type('q', 'Hello World')
      .clickAndWait('btnG')
      .getTitle(function(title){
        assert.ok(~title.indexOf('Hello World'))
      })
      .end(function(err){
        browser.testComplete(function() {
          console.log('done');
          if(err) throw err;
        });
      });


## Sauce Labs Example

    var soda = require('soda')
      , assert = require('assert');

    var browser = soda.createSauceClient({
        'url': 'http://sirrobertborden.ca.app.learnboost.com/'
      , 'username': '<your username>'
      , 'access-key': '<your api key>'
      , 'os': 'Linux'
      , 'browser': 'firefox'
      , 'browser-version': '3.'
      , 'max-duration': 300 // 5 minutes
    });

    // Log commands as they are fired
    browser.on('command', function(cmd, args){
      console.log(' \x1b[33m%s\x1b[0m: %s', cmd, args.join(', '));
    });

    browser
      .chain
      .session()
      .setTimeout(8000)
      .open('/')
      .waitForPageToLoad(5000)
      .clickAndWait('//input[@value="Submit"]')
      .clickAndWait('link=Settings')
      .type('user[name][first]', 'TJ')
      .clickAndWait('//input[@value="Save"]')
      .assertTextPresent('Account info updated')
      .clickAndWait('link=Log out')
      .testComplete()
      .end(function(err){
        browser.setContext('sauce:job-info={"passed": ' + (err === null) + '}', function(){
          browser.testComplete(function(){
            console.log(browser.jobUrl);
            if (err) throw err;
          });
        });
      });  

## Creating Helpers

Keep in mind you can extend the prototype as needed for your test. An example of this which we frequently use is `waitForDialog()`. Since the exports of `require('soda')` is the `Client` itself we can extend it as shown below, in our case waiting for an element with the class of ".dialog" to be present.

    soda.prototype.waitForDialog = function() {
      return this.waitForElementPresent('css=.dialog');
    };

## Running The Test Suite

 First we need to start Selenium RC:
 
     $ java -jar selenium-server.jar

 Then run:
 
     $ make test

## More Information

  - Sauce Labs  [Supported Browsers](http://saucelabs.com/docs/ondemand/browsers/env/js/se1/mac)
  - Introduction to [Selenese](http://seleniumhq.org/docs/02_selenium_basics.html)
  - Selenium [Command Reference](http://release.seleniumhq.org/selenium-core/1.0.1/reference.html).


## License 

(The MIT License)

Copyright (c) 2010 LearnBoost &lt;dev@learnboost.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
