/* global mocha: true */
(function () {
  'use strict';
  // use query parameter pluginFile if present,
  // eg: test.html?pluginFile=memory.pouchdb.js

  var params = testUtils.params();
  var plugins = ('plugins' in params) ? params.plugins.split(',') : [];
  var adapters = ('adapters' in params) ? params.adapters.split(',') : [];
  var scriptPath = '../../packages/node_modules/pouchdb/dist';
  var pouchdbSrc = params.src || scriptPath + '/pouchdb.js';

  var scriptsToLoad = [pouchdbSrc];
  var pluginAdapters = ['localstorage', 'memory'];

  adapters.forEach(function (adapter) {
    if (pluginAdapters.includes(adapter)) {
      plugins.push(adapter);
    }
  });
  plugins.forEach(function (plugin) {
    plugin = plugin.replace(/^pouchdb-/, '');
    scriptsToLoad.push(scriptPath + '/pouchdb.' + plugin + '.js');
  });

  var remote = params.remote === '1';

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
    if (adapters.length > 0) {
      window.PouchDB.preferredAdapters = adapters;
    }
    if ('autoCompaction' in params) {
      window.PouchDB = window.PouchDB.defaults({ auto_compaction: true });
    }
  }

  function loadScripts() {

    function loadNext() {
      if (scriptsToLoad.length) {
        var script = scriptsToLoad.shift();
        asyncLoadScript(script, loadNext);
      } else {
        if (document.readyState === 'complete') {
          startTests();
        } else {
          window.addEventListener("load", startTests);
        }
      }
    }

    function startTests() {
      window.removeEventListener("load", startTests);

      modifyGlobals();

      if (remote) {
        // Capture logs for selenium output
        var logs = [];

        (function () {

          function serializeLogItem(obj, filter, space) {
            if (typeof obj === 'string') {
              return obj;
            } else if (obj instanceof Error) {
              return obj.stack;
            } else {
              return JSON.stringify(obj, filter, space);
            }
          }

          function wrappedLog(oldLog, type) {
            return function () {
              var args = Array.prototype.slice.call(arguments);
              logs.push({
                type: type,
                content: args.map(function (arg) {
                  return serializeLogItem(arg);
                }).join(' ')
              });
              oldLog.apply(console, arguments);
            };
          }

          console.log = wrappedLog(console.log, 'log');
          console.error = wrappedLog(console.error, 'error');

        })();

        // Capture test events for selenium output
        var testEventsBuffer = [];

        window.testEvents = function () {
          var events = testEventsBuffer;
          testEventsBuffer = [];
          return events;
        };

        mocha.reporter(function (runner) {
          var eventNames = ['start', 'end', 'suite', 'suite end', 'pass', 'pending', 'fail'];
          eventNames.forEach(function (name) {
            runner.on(name, function (obj, err) {
              testEventsBuffer.push({
                name: name,
                obj: obj && {
                  root: obj.root,
                  title: obj.title,
                  duration: obj.duration,
                  slow: typeof obj.slow === 'function' ? obj.slow() : undefined,
                  fullTitle: typeof obj.fullTitle === 'function' ? obj.fullTitle() : undefined
                },
                err: err && {
                  actual: err.actual,
                  expected: err.expected,
                  showDiff: err.showDiff,
                  message: err.message,
                  stack: err.stack,
                  uncaught: err.uncaught
                },
                logs: logs
              });
              logs = [];
            });
          });
        });
      }

      mocha.run();
    }

    loadNext();
  }

  loadScripts();

})();
