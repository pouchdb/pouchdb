(function () {
  'use strict';

  var params = testUtils.params();
  var remote = params.remote === '1';

  function startTests() {
    window.removeEventListener("load", startTests);

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

  testUtils.loadPouchDB().then(function (PouchDB) {
    window.PouchDB = PouchDB;
    if (document.readyState === 'complete') {
      startTests();
    } else {
      window.addEventListener("load", startTests);
    }
  });

})();
