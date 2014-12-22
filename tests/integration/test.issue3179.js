'use strict';

var adapters = [
  ['local', 'http'],
  ['http', 'local']
];

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

    var doc = {_id: '0', integer: 0};

    it('Testing issue #3179', function (done) {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      
      local.put(doc, function () {
        remote.put(doc, function () {
          local.sync(remote, function () {
            local.get(doc._id, {
              conflicts: true
            }, function (err, localDoc) {
              remote.get(doc._id, {
                conflicts: true
              }, function (err, remoteDoc) {
                localDoc.should.deep.equal(remoteDoc);
                
                local.remove(doc._id, localDoc._conflicts[0], function () {
                  local.sync(remote, function () {
                    local.get(doc._id, {
                      conflicts: true
                    }, function (err, localDoc) {
                      remote.get(doc._id, {
                        conflicts: true
                      }, function (err, remoteDoc) {
                        localDoc.should.deep.equal(remoteDoc);
                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
