/* export testResultsSync */
/* global jQuery,PouchDB */

'use strict';

var testResultsSync;

(function ($) {

  function uuid() {
    var S4 = function () {
      return Math.floor(Math.random() * 65536).toString(16);
    };
    return S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4();
  }

  var sessionUsername = 'testuser-' + uuid();
  var password = uuid();

  $('#personalized-report').find('a').attr('href',
    'http://pouchtest.com/pouch-test-reports/index.html#testrun=' + sessionUsername);

  var testResultsDb = new PouchDB(sessionUsername);

  function makeDoc(test) {
    var err = test.err && {
      name : test.err.name, 
      message: test.err.message, 
      path : test.err.path, 
      parent : test.err.parent, 
      sourceURL : test.err.sourceURL, 
      stack : test.err.stack
    };
    return {
      user: sessionUsername,
      session: sessionUsername,
      async: test.async,
      duration: test.duration,
      pending: test.pending,
      parent: test.parent.fullTitle(),
      title: test.title,
      type: test.type,
      speed: test.speed,
      state: test.state,
      sync: test.sync,
      err: err,
      time: new Date().getTime()
    };
  }

  var testResultsDb;
  var docQueue = [];

  var api = {};

  api.onPassOrFail = function (test) {
    if (test.type === 'test') { // not a 'hook' or something like that
      var doc = makeDoc(test);
      if (testResultsDb) {
        testResultsDb.post(doc);
      } else {
        docQueue.push(doc);
      }
    }
  };

  // sync test results to server
  var userId = 'org.couchdb.user:' + sessionUsername;
  var sessionAsUser = {
    // couchdb _user stuff
    name: sessionUsername,
    password: password,
    type: 'user',
    roles: [],
    _id: userId
  };

  $.ajax('deps/pouch-commit.txt')
    .success(function (pouchCommitVersion) {

      pouchCommitVersion = pouchCommitVersion.replace(/\s+$/, '');

      $('#pouch-commit').empty().append($('<span></span>')
        .append($('<span> (</span>'))
        .append(
          $('<a></a>')
          .attr('href', 'https://github.com/daleharvey/pouchdb/commit/' + pouchCommitVersion)
          .text(pouchCommitVersion.substring(0, 7))
        )
        .append($('<span>) </span>'))
      );

      $.ajax({
        url: window.COUCHDB_HOST.replace(/http:\/\/(.*?:.*?@)?/,
          'http://') + '/_users/' + userId.replace(':', '%3A'),
        method: 'PUT',
        data: JSON.stringify(sessionAsUser),
        contentType: 'application/json'
      }).success(function (res) {
          var session = {
            // info to save
            type: 'session',
            _id : sessionUsername,
            user: sessionUsername,
            browser: window.jQuery.ua.browser,
            device: window.jQuery.ua.device,
            engine: window.jQuery.ua.engine,
            cpu: window.jQuery.ua.cpu,
            os : window.jQuery.ua.os,
            userAgent: window.navigator.userAgent,
            pouchVersion: PouchDB.version,
            pouchCommit: pouchCommitVersion,
            time: new Date().getTime()
          };
          var testResultsUrl = window.COUCHDB_HOST.replace(/http:\/\/(.*?:.*?@)?/,
            'http://' + sessionUsername + ':' + password + '@') +
            '/test_reports';
          testResultsDb = new PouchDB(testResultsUrl);
          testResultsDb.post(session);
          while (docQueue.length) {
            testResultsDb.post(docQueue.shift());
          }
        }).error(function (err) {
          console.log(err.responseText);
        });
    });

  testResultsSync = api;


})(jQuery);
