'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.local_docs.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('local docs - put then get', function () {
      var db = new PouchDB(dbs.name);
      return db.put({_id: '_local/foo'}).then(function (res) {
        res.id.should.equal('_local/foo');
        res.rev.should.be.a('string');
        res.ok.should.equal(true);
        return db.get('_local/foo');
      });
    });

    it('local docs - put then get w/ revisions', function () {
      var db = new PouchDB(dbs.name);
      var doc = {
        _id: '_local/foo'
      };
      return db.put(doc).then(function (res) {
        res.id.should.equal('_local/foo');
        res.rev.should.be.a('string');
        res.ok.should.equal(true);
        return db.get('_local/foo');
      }).then(function (doc) {
        should.not.exist(doc._revisions);
        doc._revisions = {start: 0, ids: ['1']};
        return db.put(doc);
      }).then(function () {
        return db.get('_local/foo');
      }).then(function (doc) {
        should.not.exist(doc._revisions);
      });
    });

    it('local docs - put then remove then get', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.remove(doc);
      }).then(function (res) {
        res.id.should.equal('_local/foo');
        res.rev.should.equal('0-0');
        res.ok.should.equal(true);
        return db.get('_local/foo').then(function (doc) {
          should.not.exist(doc);
        }).catch(function (err) {
          err.name.should.equal('not_found');
        });
      });
    });

    it('local docs - put after remove', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.remove(doc);
      }).then(function (res) {
        res.id.should.equal('_local/foo');
        res.rev.should.equal('0-0');
        res.ok.should.equal(true);
        delete doc._rev;
        return db.put(doc);
      });
    });

    it('local docs - put after remove, check return vals', function () {
      // as long as it starts with 0-, couch
      // treats it as a new local doc
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/quux'};
      return db.put(doc).then(function (res) {
        res.rev.should.equal('0-1');
        res.ok.should.equal(true);
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function (res) {
        res.rev.should.equal('0-2');
        res.ok.should.equal(true);
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function (res) {
        res.rev.should.equal('0-3');
        res.ok.should.equal(true);
      });
    });

    it('local docs - remove missing', function () {
      var db = new PouchDB(dbs.name);
      return db.remove({
        _id: '_local/foo',
        _rev: '1-fake'
      }).then(function () {
        throw new Error('should not be here');
      }, function (err) {
        err.name.should.be.a('string');
      });
    });

    it('local docs - put after put w/ deleted:true', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        doc._deleted = true;
        return db.put(doc);
      }).then(function (res) {
        res.id.should.equal('_local/foo');
        res.rev.should.equal('0-0');
        res.ok.should.equal(true);
        delete doc._deleted;
        delete doc._rev;
        return db.put(doc);
      });
    });

    it('local docs - put after remove with a rev', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.remove(doc);
      }).then(function (res) {
        res.id.should.equal('_local/foo');
        res.ok.should.equal(true);
        res.rev.should.equal('0-0');
        delete doc._rev;
        return db.put(doc);
      });
    });

    it('local docs - multiple removes', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        return db.remove(doc);
      }).then(function (res) {
        res.rev.should.equal('0-0');
        delete doc._rev;
        return db.put(doc);
      }).then(function (res) {
        doc._rev = res.rev;
        return db.remove(doc);
      }).then(function (res) {
        res.rev.should.equal('0-0');
      });
    });

    it('local docs - get unknown', function () {
      var db = new PouchDB(dbs.name);
      return db.get('_local/foo').then(function (doc) {
        should.not.exist(doc);
      }).catch(function (err) {
        err.name.should.equal('not_found');
      });
    });

    it('local docs - put unknown', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/foo', _rev: '1-fake'};
      return db.put(doc).then(function (res) {
        should.not.exist(res);
      }).catch(function (err) {
        err.name.should.be.a('string');
      });
    });

    it('local docs - put new and conflicting', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/foo'};
      return db.put(doc).then(function () {
        return db.put(doc);
      }).then(function (res) {
        should.not.exist(res);
      }).catch(function (err) {
        err.name.should.be.a('string');
      });
    });

    it('local docs - put modified and conflicting', function () {
      var db = new PouchDB(dbs.name);
      var doc = {_id: '_local/foo'};
      return db.put(doc).then(function (res) {
        doc._rev = res.rev;
        return db.put(doc);
      }).then(function () {
        return db.put(doc);
      }).then(function (res) {
        should.not.exist(res);
      }).catch(function (err) {
        err.name.should.be.a('string');
      });
    });
  });
});
