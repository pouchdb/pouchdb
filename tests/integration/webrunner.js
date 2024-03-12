(function () {
  'use strict';

  var params = testUtils.params();
  var remote = params.remote === '1';

  function startTests() {
    window.removeEventListener("load", startTests);

    if (remote) {
      mocha.reporter(function (runner) {
        var eventNames = ['start', 'end', 'suite', 'suite end', 'pass', 'pending', 'fail'];
        eventNames.forEach(function (name) {
          runner.on(name, function (obj, err) {
            window.postMessage({
              type: 'mocha',
              details: {
                name,
                obj: obj && {
                  root: obj.root,
                  title: obj.title,
                  duration: obj.duration,
                  slow: typeof obj.slow === 'function' ? obj.slow() : undefined,
                  fullTitle: typeof obj.fullTitle === 'function' ? obj.fullTitle() : undefined,
                  titlePath: typeof obj.titlePath === 'function' ? obj.titlePath() : undefined,
                },
                err: err && {
                  actual: err.actual,
                  expected: err.expected,
                  showDiff: err.showDiff,
                  message: err.message,
                  stack: err.stack,
                  uncaught: err.uncaught
                },
              },
            });
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
