'use strict';

var adapters = [
  ['local', 'http'],
  ['http', 'local']
];

adapters.forEach(function (adapters) {
  if (typeof process === 'undefined' || process.browser) {
    var suiteName = 'browser.retry-offline.js-' +
      adapters[0] + '-' + adapters[1];
    describe(suiteName, function () {

      var dbs = {};

      beforeEach(function (done) {
        console.log('before');
        dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
        dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
        testUtils.cleanup([dbs.name, dbs.remote], done);
      });

      after(function (done) {
        console.log('after');
        testUtils.cleanup([dbs.name, dbs.remote], done);
      });

      var offline = false;

      function goOffline() {
        offline = true;

        function FakeXMLHttpRequest() {
        }

        FakeXMLHttpRequest.prototype.send = function send() {
          var self = this;
          self.readyState = 4;
          self.status = 0;
          self.response = '';
          self.responseText = '';
          setTimeout(self.onreadystatechange);
        };
        function noop() {
        }

        FakeXMLHttpRequest.prototype.open = noop;
        FakeXMLHttpRequest.prototype.abort = noop;
        FakeXMLHttpRequest.prototype.setRequestHeader = noop;
        window.PouchXMLHttpRequest = FakeXMLHttpRequest;

        setTimeout(function () {
          delete window.PouchXMLHttpRequest;
          offline = false;
        }, 1000);
      }

      it('retry while truly offline', function () {

        var db = new PouchDB(dbs.name);
        var remote = new PouchDB(dbs.remote);
        var Promise = PouchDB.utils.Promise;

        var rep = db.replicate.from(remote, {
          live: true,
          retry: true,
          back_off_function: function () {
            return 100;
          }
        });

        var numDocsToWrite = 5;

        var active = 0;
        var paused = 0;
        return remote.post({}).then(function () {

          goOffline();

          var posted = 0;

          return new Promise(function (resolve, reject) {

            var error;

            function cleanup(err) {
              if (err) {
                error = err;
              }
              rep.cancel();
            }

            function finish() {
              if (error) {
                return reject(error);
              }
              resolve();
            }

            rep.on('active', function () {
              active++;
            }).on('paused', function () {
              paused++;
            }).on('complete', finish).on('error', cleanup);
            rep.on('change', function () {
              if (++posted < numDocsToWrite) {
                remote.post({}).catch(cleanup);
              } else {
                db.info().then(function (info) {
                  if (info.doc_count === numDocsToWrite) {
                    cleanup();
                  }
                }).catch(cleanup);
              }
            });
          });
        }).then(function () {
          active.should.be.above(1);
          paused.should.be.above(1);
          offline.should.equal(false);
        });
      });
    });
  }
});