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

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    var doc = {_id: '0', integer: 0};

    it.skip('Testing issue #3179', function (done) {

      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var localDoc;

      return local.put({_id: '0', doc: 'local'}).then(function () {
        return remote.put({_id: '0', doc: 'remote'});
      }).then(function () {
        return local.sync(remote);
      }).then(function () {
        return local.get(doc._id, {conflicts: true});
      }).then(function(res) {
        localDoc = res;
        return remote.get(doc._id, {conflicts: true});
      }).then(function (res) {
        localDoc.should.deep.equal(res);
        return local.remove(doc._id, localDoc._conflicts[0]);
      }).then(function () {
        return local.sync(remote);
      }).then(function () {
        return local.get(doc._id, {conflicts: true});
      }).then(function (res) {
        localDoc = res;
        return remote.get(doc._id, {conflicts: true});
      }).then(function (res) {
        localDoc.should.deep.equal(res);
      }).then(done);
    });
  });
});
