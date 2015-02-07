'use strict';

var adapters = [
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'http'],
  ['local', 'local']
];

if ('saucelabs' in testUtils.params()) {
  adapters = [['local', 'http'], ['http', 'local']];
}

adapters.forEach(function (adapters) {
  describe('test.issue3179.js-' + adapters[0] + '-' + adapters[1], function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('#3179 conflicts synced, non-live replication', function () {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      return local.put({ _id: '1'}).then(function () {
        return local.replicate.to(remote).then(function () {
          return remote.replicate.to(local);
        });
      }).then(function () {
        return local.get('1').then(function (doc) {
          doc.foo = Math.random();
          return local.put(doc);
        });
      }).then(function () {
        return remote.get('1').then(function (doc) {
          doc.foo = Math.random();
          return remote.put(doc);
        });
      }).then(function () {
        return local.replicate.to(remote).then(function () {
          return remote.replicate.to(local);
        });
      }).then(function () {
        return local.get('1', {conflicts: true}).then(function (doc) {
          return local.remove(doc._id, doc._conflicts[0]);
        });
      }).then(function () {
        return local.replicate.to(remote).then(function () {
          return remote.replicate.to(local);
        });
      }).then(function () {
        return local.get('1', {conflicts: true, revs: true});
      }).then(function (localDoc) {
        return remote.get('1', {
          conflicts: true,
          revs: true
        }).then(function (remoteDoc) {
          remoteDoc.should.deep.equal(localDoc);
        });
      });
    });

    it('#3179 conflicts synced, non-live sync', function () {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      return local.put({ _id: '1'}).then(function () {
        return local.sync(remote);
      }).then(function () {
        return local.get('1').then(function (doc) {
          doc.foo = Math.random();
          return local.put(doc);
        });
      }).then(function () {
        return remote.get('1').then(function (doc) {
          doc.foo = Math.random();
          return remote.put(doc);
        });
      }).then(function () {
        return local.sync(remote);
      }).then(function () {
        return local.get('1', {conflicts: true}).then(function (doc) {
          return local.remove(doc._id, doc._conflicts[0]);
        });
      }).then(function () {
        return local.sync(remote);
      }).then(function () {
        return local.get('1', {conflicts: true, revs: true});
      }).then(function (localDoc) {
        return remote.get('1', {
          conflicts: true,
          revs: true
        }).then(function (remoteDoc) {
          remoteDoc.should.deep.equal(localDoc);
        });
      });
    });

    it('#3179 conflicts synced, live sync', function () {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var sync = local.sync(remote, { live: true });

      function waitForUptodate() {

        function defaultToEmpty(promise) {
          return promise.catch(function (err) {
            if (err.status !== 404) {
              throw err;
            }
            return {_revisions: []};
          });
        }

        return defaultToEmpty(local.get('1', {
          revs: true,
          conflicts: true
        })).then(function (localDoc) {
          return defaultToEmpty(remote.get('1', {
            revs: true,
            conflicts: true
          })).then(function (remoteDoc) {
            var revsEqual = JSON.stringify(localDoc._revisions) ===
              JSON.stringify(remoteDoc._revisions);
            var conflictsEqual = JSON.stringify(localDoc._conflicts || []) ===
              JSON.stringify(remoteDoc._conflicts || []);
            if (!revsEqual || !conflictsEqual) {
              return waitForUptodate();
            }
          });
        });
      }

      function delay() {
        // prove a negative
        return new PouchDB.utils.Promise(function (resolve) {
          setTimeout(resolve, 10000);
        });
      }

      function cleanup() {
        return new PouchDB.utils.Promise(function (resolve, reject) {
          sync.on('complete', resolve);
          sync.on('error', reject);
          sync.cancel();
          sync = null;
        });
      }

      return local.put({ _id: '1'}).then(function () {
        return waitForUptodate();
      }).then(function () {
        sync.cancel();
        return waitForUptodate();
      }).then(function () {
        return local.get('1').then(function (doc) {
          doc.foo = Math.random();
          return local.put(doc);
        });
      }).then(function () {
        return remote.get('1').then(function (doc) {
          doc.foo = Math.random();
          return remote.put(doc);
        });
      }).then(function () {
        sync = local.sync(remote, { live: true });
        return waitForUptodate();
      }).then(function () {
        return local.get('1', {conflicts: true}).then(function (doc) {
          return local.remove(doc._id, doc._conflicts[0]);
        });
      }).then(function () {
        return delay();
      }).then(function () {
        return local.get('1', {conflicts: true, revs: true});
      }).then(function (localDoc) {
        return remote.get('1', {
          conflicts: true,
          revs: true
        }).then(function (remoteDoc) {
          remoteDoc.should.deep.equal(localDoc);
        });
      }).then(function () {
        return cleanup();
      }, function (err) {
        return cleanup().then(function () {
          throw err;
        });
      });
    });

    it('#3179 conflicts synced, live repl', function () {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var repl1 = local.replicate.to(remote, { live: true });
      var repl2 = local.replicate.from(remote, { live: true });

      function waitForUptodate() {

        function defaultToEmpty(promise) {
          return promise.catch(function (err) {
            if (err.status !== 404) {
              throw err;
            }
            return {_revisions: []};
          });
        }

        return defaultToEmpty(local.get('1', {
          revs: true,
          conflicts: true
        })).then(function (localDoc) {
          return defaultToEmpty(remote.get('1', {
            revs: true,
            conflicts: true
          })).then(function (remoteDoc) {
            var revsEqual = JSON.stringify(localDoc._revisions) ===
              JSON.stringify(remoteDoc._revisions);
            var conflictsEqual = JSON.stringify(localDoc._conflicts || []) ===
              JSON.stringify(remoteDoc._conflicts || []);
            if (!revsEqual || !conflictsEqual) {
              return waitForUptodate();
            }
          });
        });
      }

      function delay() {
        // prove a negative
        return new PouchDB.utils.Promise(function (resolve) {
          setTimeout(resolve, 10000);
        });
      }

      function cleanup() {
        return new PouchDB.utils.Promise(function (resolve, reject) {
          var numDone = 0;

          function checkDone() {
            if (++numDone === 2) {
              resolve();
            }
          }
          repl1.on('complete', checkDone);
          repl2.on('complete', checkDone);
          repl1.on('error', reject);
          repl2.on('error', reject);
          repl1.cancel();
          repl2.cancel();
          repl1 = null;
          repl2 = null;
        });
      }

      return local.put({ _id: '1'}).then(function () {
        return waitForUptodate();
      }).then(function () {
        repl1.cancel();
        repl2.cancel();
        return waitForUptodate();
      }).then(function () {
        return local.get('1').then(function (doc) {
          doc.foo = Math.random();
          return local.put(doc);
        });
      }).then(function () {
        return remote.get('1').then(function (doc) {
          doc.foo = Math.random();
          return remote.put(doc);
        });
      }).then(function () {
        repl1 = local.replicate.to(remote, { live: true });
        repl2 = local.replicate.from(remote, { live: true });
        return waitForUptodate();
      }).then(function () {
        return local.get('1', {conflicts: true}).then(function (doc) {
          return local.remove(doc._id, doc._conflicts[0]);
        });
      }).then(function () {
        return delay();
      }).then(function () {
        return local.get('1', {conflicts: true, revs: true});
      }).then(function (localDoc) {
        return remote.get('1', {
          conflicts: true,
          revs: true
        }).then(function (remoteDoc) {
          remoteDoc.should.deep.equal(localDoc);
        });
      }).then(function () {
        return cleanup();
      }, function (err) {
        return cleanup().then(function () {
          throw err;
        });
      });
    });
  });
});
