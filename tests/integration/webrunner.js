/* global mocha: true */
(function () {
  'use strict';
  // use query parameter pluginFile if present,
  // eg: test.html?pluginFile=memory.pouchdb.js
  var plugins = window.location.search.match(/[?&]plugins=([^&]+)/);
  var adapters = window.location.search.match(/[?&]adapters=([^&]+)/);
  var pouchdbSrc = window.location.search.match(/[?&]src=([^&]+)/);
  if (pouchdbSrc) {
    pouchdbSrc = decodeURIComponent(pouchdbSrc[1]);
  } else {
    pouchdbSrc = '../../packages/node_modules/pouchdb/dist/pouchdb.js';
  }
  var scriptsToLoad = [pouchdbSrc];
  if (adapters) {
    adapters = adapters[1].split(',');
    adapters.forEach(function (adapter) {
      if (adapter !== 'websql' && adapter !== 'idb') {
        // load from plugin
        scriptsToLoad.push(
          '../../packages/node_modules/pouchdb/dist/pouchdb.' + adapter + '.js');
      }
    });
  }
  if (plugins) {
    plugins[1].split(',').forEach(function (plugin) {
      plugin = plugin.replace(/^pouchdb-/, '');
      scriptsToLoad.push(
        '../../packages/node_modules/pouchdb/dist/pouchdb.' + plugin + '.js');
    });
  }

// Thanks to http://engineeredweb.com/blog/simple-async-javascript-loader/
  function asyncLoadScript(url, callback) {

    // Create a new script and setup the basics.
    var script = document.createElement("script"),
      firstScript = document.getElementsByTagName('script')[0];

    script.async = true;
    script.src = url;

    // Handle the case where an optional callback was passed in.
    if ("function" === typeof (callback)) {
      script.onload = function () {
        callback();

        // Clear it out to avoid getting called more than once or any
        // memory leaks.
        script.onload = script.onreadystatechange = undefined;
      };
      script.onreadystatechange = function () {
        if ("loaded" === script.readyState || "complete" === script.readyState) {
          script.onload();
        }
      };
    }

    // Attach the script tag to the page (before the first script) so the
    //magic can happen.
    firstScript.parentNode.insertBefore(script, firstScript);
  }

  function modifyGlobals() {
    if (adapters) {
      window.PouchDB.preferredAdapters = adapters;
    }
    if (window.location.search.indexOf('autoCompaction') !== -1) {
      window.PouchDB = window.PouchDB.defaults({ auto_compaction: true });
    }
  }

  function startTests() {

    function loadNext() {
      if (scriptsToLoad.length) {
        var script = scriptsToLoad.shift();
        asyncLoadScript(script, loadNext);
      } else {
        onReady();
      }
    }

    function onReady() {
      modifyGlobals();

      var runner = mocha.run();

      // Capture logs for selenium output
      var logs = [];


      (function () {

        var oldLog = console.log;
        console.log = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift('log');
          logs.push(args);
          oldLog.apply(console, arguments);
        };

        var oldError = console.error;
        console.error = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift('error');
          logs.push(args);
          oldError.apply(console, arguments);
        };

      })();

      window.results = {
        browser: navigator.userAgent,
        lastPassed: '',
        passed: 0,
        failed: 0,
        failures: []
      };

      runner.on('pass', function (e) {
        window.results.lastPassed = e.title;
        window.results.passed++;
      });

      runner.on('fail', function (e) {
        window.results.logs = logs;
        window.results.failed++;
        window.results.failures.push({
          title: e.title,
          message: e.err.message,
          stack: e.err.stack
        });
      });

      runner.on('end', function () {
        window.results.logs = logs;
        window.results.completed = true;
        window.results.passed++;
      });
    }

    loadNext();
  }

  startTests();

})();