'use strict';

var adapters = [
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'http'],
  ['local', 'local']
];

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
          should.exist(doc._conflicts, 'conflicts expected, but none were found');
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
          should.exist(doc._conflicts, 'conflicts expected, but none were found');
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

    it('#3179 conflicts synced, live sync', async function () {
      const local = new PouchDB(dbs.name);
      const remote = new PouchDB(dbs.remote);
      let sync1 = local.sync(remote, { live: true });

      function defaultToEmpty(promise) {
        return promise.catch(function (err) {
          if (err.status !== 404) {
            throw err;
          }
          return { _revisions: [] };
        });
      }

      async function waitForUptodate() {
        for (let limit = 0; limit < 10; ++limit) {
          if (limit > 0) {
            // we can get caught in an infinite loop here when using adapters based
            // on microtasks, e.g. memdown, so use setTimeout() to get a macrotask
            await new Promise(function (resolve) {
              setTimeout(resolve, 100);
            });
          }

          const localDoc = await defaultToEmpty(local.get('1', {
            revs: true,
            conflicts: true
          }));
          const remoteDoc = await defaultToEmpty(remote.get('1', {
            revs: true,
            conflicts: true
          }));
          const revsEqual = JSON.stringify(localDoc._revisions) ===
            JSON.stringify(remoteDoc._revisions);
          const conflictsEqual = JSON.stringify(localDoc._conflicts || []) ===
            JSON.stringify(remoteDoc._conflicts || []);

          if (revsEqual && conflictsEqual) {
            // Everything's fine, continue with the test.
            return;
          }
        }

        // Tried 10 times, throw an error to cancel the test.
        throw new Error("retry limit reached");
      }

      async function waitForConflictsResolved() {
        const changes = remote.changes({
          live: true,
          include_docs: true,
          conflicts: true,
        });

        changes.on('change', function (change) {
          if (!('_conflicts' in change.doc)) {
            changes.cancel();
          }
        });

        return await changes;
      }

      function cleanup(sync) {
        return new Promise(function (resolve, reject) {
          sync.on('complete', resolve);
          sync.on('error', reject);
          sync.cancel();
        });
      }

      await local.put({ _id: '1' });
      await waitForUptodate();
      await cleanup(sync1);

      await waitForUptodate();
      const doc1 = await local.get('1');
      const randomNumber = Math.random();
      doc1.foo = randomNumber;
      await local.put(doc1);

      const doc2 = await remote.get('1');
      // set conflicting property `foo`
      doc2.foo = randomNumber + 1;
      await remote.put(doc2);

      const sync2 = local.sync(remote, { live: true });
      await waitForUptodate();

      const doc3 = await local.get('1', { conflicts: true });
      should.exist(doc3._conflicts, 'conflicts expected, but none were found');
      await local.remove(doc3._id, doc3._conflicts[0]);
      await waitForConflictsResolved();

      const localDoc = await local.get('1', { conflicts: true, revs: true });
      const remoteDoc = await remote.get('1', {
        conflicts: true,
        revs: true
      });

      remoteDoc.should.deep.equal(localDoc);
      await cleanup(sync2);
    });

    it('#3179 conflicts synced, live repl', function () {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var repl1 = local.replicate.to(remote, { live: true });
      var repl2 = local.replicate.from(remote, { live: true });

      function waitForConflictsResolved() {
        return new Promise(function (resolve) {
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
              return new Promise(function (resolve) {
                setTimeout(resolve, 0);
              }).then(waitForUptodate);
            }
          });
        });
      }

      function cleanup() {
        return new Promise(function (resolve, reject) {
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
          should.exist(doc._conflicts, 'conflicts expected, but none were found');
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
