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

    beforeEach(function () {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
    });

    afterEach(function (done) {
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
          console.log('test.issue3179, doc:', doc);
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
      console.log(1, '> #3179 conflicts synced, live sync');
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      console.log(2, '> #3179 conflicts synced, live sync, local, remote', local, remote);
      var sync = local.sync(remote, { live: true });
      console.log(3, '> #3179 conflicts synced, live sync, started sync');
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
              // we can get caught in an infinite loop here when using adapters based
              // on microtasks, e.g. memdown, so use setTimeout() to get a macrotask
              return new testUtils.Promise(function (resolve) {
                setTimeout(resolve, 0);
              }).then(waitForUptodate);
            }
          });
        });
      }

      function waitForConflictsResolved() {
        return new testUtils.Promise(function (resolve) {
          var changes = remote.changes({
            live: true,
            include_docs: true,
            conflicts: true
          }).on('change', function (change) {
            if (!('_conflicts' in change.doc)) {
              changes.cancel();
            }
          });
          changes.on('complete', resolve);
        });
      }

      function cleanup() {
        return new testUtils.Promise(function (resolve, reject) {
          sync.on('complete', resolve);
          sync.on('error', reject);
          sync.cancel();
          sync = null;
        });
      }

      return local.put({ _id: '1'}).then(function () {
        console.log(4, '> #3179 conflicts synced, live sync, put doc _id:"1"');
        return waitForUptodate();
      }).then(function () {
        console.log(5, '> #3179 conflicts synced, live sync, waited, cancel sync');
        sync.cancel();
        return waitForUptodate();
      }).then(function () {
        console.log(6, '> #3179 conflicts synced, live sync, waited, get doc 1');
        return local.get('1').then(function (doc) {
          console.log(1, '> #3179 conflicts synced, live sync, waited, got doc 1', doc);
          doc.foo = Math.random();
          return local.put(doc);
        });
      }).then(function () {
        console.log(7, '> #3179 conflicts synced, live sync, did put new doc 1');
        return remote.get('1').then(function (doc) {
          console.log(8, '> #3179 conflicts synced, live sync, got doc 1', doc);
          doc.foo = Math.random();
          return remote.put(doc);
        });
      }).then(function () {
        console.log(9, '> #3179 conflicts synced, live sync, did put new new doc 1');
        sync = local.sync(remote, { live: true });
        return waitForUptodate();
      }).then(function () {
        console.log(10, '> #3179 conflicts synced, live sync, waited, get doc 1 with conflicts');
        return local.get('1', {conflicts: true}).then(function (doc) {
          console.log(11, '> #3179 conflicts synced, live sync, waited, got doc 1 with conflicts', doc);
          return local.remove(doc._id, doc._conflicts[0]);
        });
      }).then(function () {
        console.log(12, '> #3179 conflicts synced, live sync, removed conflicts[0]');
        return waitForConflictsResolved();
      }).then(function () {
        console.log(13, '> #3179 conflicts synced, live sync, waited for conflict resolved');
        return local.get('1', {conflicts: true, revs: true});
      }).then(function (localDoc) {
        console.log(14, '> #3179 conflicts synced, live sync, get local doc 1 with conflicts and revs', localDoc);
        return remote.get('1', {
          conflicts: true,
          revs: true
        }).then(function (remoteDoc) {
          console.log(15, '> #3179 conflicts synced, live sync, get remote doc 1 with conflicts and revs', remoteDoc);
          remoteDoc.should.deep.equal(localDoc);
        });
      }).then(function () {
        console.log(16, ' do cleanup ');
        return cleanup();
      }, function (err) {
        console.log(100, ' err ', err);
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

      function waitForConflictsResolved() {
        return new testUtils.Promise(function (resolve) {
          var changes = remote.changes({
            live: true,
            include_docs: true,
            conflicts: true
          }).on('change', function (change) {
            if (!('_conflicts' in change.doc)) {
              changes.cancel();
            }
          });
          changes.on('complete', resolve);
        });
      }

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
              // we can get caught in an infinite loop here when using adapters based
              // on microtasks, e.g. memdown, so use setTimeout() to get a macrotask
              return new testUtils.Promise(function (resolve) {
                setTimeout(resolve, 0);
              }).then(waitForUptodate);
            }
          });
        });
      }

      function cleanup() {
        return new testUtils.Promise(function (resolve, reject) {
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
        return waitForConflictsResolved();
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
