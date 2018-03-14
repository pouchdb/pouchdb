'use strict';

var adapters = ['local'];

adapters.forEach(function (adapter) {

  describe('test.deterministicrevs.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function () {
      dbs.name1 = testUtils.adapterUrl(adapter, 'testdb');
      dbs.name2 = testUtils.adapterUrl(adapter, 'testdb2');
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name1, dbs.name2], done);
    });

    it('deterministic_revs=true so revision for two docs that are the same will be equal', function () {
      var doc = {
        _id: '123-this-is-an-id',
        hello: 'world',
        'testing': 123
      };

      var db1 = PouchDB(dbs.name1);
      var db2 = PouchDB(dbs.name2);
      return Promise.all([db1.put(doc), db2.put(doc)])
      .then(function (resp) {
        var resp1 = resp[0];
        var resp2 = resp[1];
        resp1.rev.should.equal(resp2.rev);
      });
    });

    it('deterministic_revs=false so revision for two docs that are the same will be different', function () {
      var doc = {
        _id: '123-this-is-an-id',
        hello: 'world',
        'testing': 123
      };

      var db1 = PouchDB(dbs.name1, {deterministic_revs: false});
      var db2 = PouchDB(dbs.name2, {deterministic_revs: false});
      return Promise.all([db1.put(doc), db2.put(doc)])
      .then(function (resp) {
        var resp1 = resp[0];
        var resp2 = resp[1];
        resp1.rev.should.not.equal(resp2.rev);
      });
    });

    it('includes revision in md5 hash', function () {
      var doc = {
        _id: '123-this-is-an-id',
        hello: 'world',
        'testing': 123,
        '_rev': '1-63c3b22973694224bb406e470152b6e4'
      };

      var doc1 = Object.assign({}, doc);
      doc1._rev = '1-99c3b22973694224bb406e470152aaaa';

      var db1 = PouchDB(dbs.name1);
      var db2 = PouchDB(dbs.name2);

      return Promise.all([
        db1.bulkDocs([doc], {new_edits: false}),
        db2.bulkDocs([doc1], {new_edits: false})
      ])
      .then(function () {
        doc.another = 'field';
        doc1.another = 'field';

        return Promise.all([db1.put(doc), db2.put(doc1)]);
      })
      .then(function (resp) {
        resp[0].rev.should.not.equal(resp[1].rev);
      });
    });

    it('replication and then update and delete creates same rev', function (done) {
      var doc = {
        _id: '123-this-is-an-id',
        hello: 'world',
        'testing': 123
      };

      var db1 = PouchDB(dbs.name1);
      var db2 = PouchDB(dbs.name2);

      db1.put(doc)
      .then(function (resp) {
        db2.replicate.from(db1)
        .on('complete', function () {
          doc._rev = resp.rev;
          doc.newField = true;
          return Promise.all([db1.put(doc), db2.put(doc)])
          .then(function (resp) {
            doc._rev = resp[0].rev;
            return Promise.all([db1.remove(doc), db2.remove(doc)]);
          })
          .then(function (resp) {
            return Promise.all([
              db1.get(doc._id, {rev: resp[0].rev, revs_info: true}),
              db2.get(doc._id, {rev: resp[0].rev, revs_info: true})
            ]);
          })
          .then(function (resp) {
            resp[0].should.deep.equal(resp[1]);
            done();
          });
        });

      });
    });
  });
});
