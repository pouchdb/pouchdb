'use strict';

var adapters = ['local', 'http'];

adapters.forEach(function (adapter) {
  describe('test.issue3646.js- ' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb' + (new Date()).getTime());
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('Should finish with 0 documents', function () {
      var db = new PouchDB(dbs.name);

      return db.bulkDocs(data[0], {new_edits: false}).then(function () {
        return db.bulkDocs(data[1], {new_edits: false});
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(0, 'all docs length is 0');
        res.total_rows.should.equal(0);
        return db.allDocs({keys: ['b74e3b45'], include_docs: true});
      }).then(function (res) {
        var first = res.rows[0];
        should.equal(first.value.deleted, true, 'all docs value.deleted');
        first.value.rev.should.equal('6-441f43a31c89dc68a7cc934ce5779bf8');
        res.total_rows.should.equal(0);
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(0, 'doc_count is 0');
        return db.changes({include_docs: true});
      }).then(function (changes) {
        changes.results.should.have.length(1);
        var first = changes.results[0];
        first.doc._rev.should.equal('6-441f43a31c89dc68a7cc934ce5779bf8');
        should.equal(first.deleted, true, 'changes metadata.deleted');
        should.equal(first.doc._deleted, true, 'changes doc._deleted');
      });
    });

    var data = [
      {
        "docs": [
          {
            "_revisions": {
              "start": 2,
              "ids": [
                "4e16ac64356d4358bf1bdb4857fc299f",
                "aed67b17ea5ba6b78e704ad65d3fb5db"
              ]
            },
            "_rev": "2-4e16ac64356d4358bf1bdb4857fc299f",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 2,
              "ids": [
                "3757f03a178b34284361c89303cf8c35",
                "0593f4c87b24f0f9b620526433929bb0"
              ]
            },
            "_rev": "2-3757f03a178b34284361c89303cf8c35",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 3,
              "ids": [
                "f28d17ab990dcadd20ad38860fde9f11",
                "6cf4b9e2115d7e884292b97aa8765285",
                "dcfdf66ab61873ee512a9ccf3e3731a1"
              ]
            },
            "_rev": "3-f28d17ab990dcadd20ad38860fde9f11",
            "_id": "b74e3b45"
          },
          {
            "_revisions": {
              "start": 3,
              "ids": [
                "4d93920c00a4a7269095b22ff4329b3c",
                "7190eca51acb2b302a89ed1204ac2813",
                "017eba7ef1e4f529143f463779822627"
              ]
            },
            "_rev": "3-4d93920c00a4a7269095b22ff4329b3c",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 3,
              "ids": [
                "91b47d7b889feb36eaf9336c071f00cc",
                "0e3379b8f9128e6062d13eeb98ec538e",
                "1c006ce18b663e2a031ced4669797c28"
              ]
            },
            "_rev": "3-91b47d7b889feb36eaf9336c071f00cc",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 4,
              "ids": [
                "2c3c860d421fc9f6cc82e4fb811dc8e2",
                "4473170dcffa850aca381b4f644b2947",
                "3524a871600080f5e30e59a292b02a3f",
                "89eb0b5131800963bb7caf1fc83b6242"
              ]
            },
            "_rev": "4-2c3c860d421fc9f6cc82e4fb811dc8e2",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 6,
              "ids": [
                "441f43a31c89dc68a7cc934ce5779bf8",
                "4c7f8b00508144d049d18668d17e552a",
                "e8431fb3b448f3457c5b2d77012fa8b4",
                "f2e7dc8102123e13ca792a0a05ca6235",
                "37a13a5c1e2ce5926a3ffcda7e669106",
                "78739468c87b30f76d067a2d7f373803"
              ]
            },
            "_rev": "6-441f43a31c89dc68a7cc934ce5779bf8",
            "_id": "b74e3b45",
            "_deleted": true
          }
        ]
      },
      {
        "docs": [
          {
            "_revisions": {
              "start": 2,
              "ids": [
                "3757f03a178b34284361c89303cf8c35",
                "0593f4c87b24f0f9b620526433929bb0"
              ]
            },
            "_rev": "2-3757f03a178b34284361c89303cf8c35",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 2,
              "ids": [
                "4e16ac64356d4358bf1bdb4857fc299f",
                "aed67b17ea5ba6b78e704ad65d3fb5db"
              ]
            },
            "_rev": "2-4e16ac64356d4358bf1bdb4857fc299f",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 3,
              "ids": [
                "91b47d7b889feb36eaf9336c071f00cc",
                "0e3379b8f9128e6062d13eeb98ec538e",
                "1c006ce18b663e2a031ced4669797c28"
              ]
            },
            "_rev": "3-91b47d7b889feb36eaf9336c071f00cc",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 3,
              "ids": [
                "4d93920c00a4a7269095b22ff4329b3c",
                "7190eca51acb2b302a89ed1204ac2813",
                "017eba7ef1e4f529143f463779822627"
              ]
            },
            "_rev": "3-4d93920c00a4a7269095b22ff4329b3c",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 4,
              "ids": [
                "2c3c860d421fc9f6cc82e4fb811dc8e2",
                "4473170dcffa850aca381b4f644b2947",
                "3524a871600080f5e30e59a292b02a3f",
                "89eb0b5131800963bb7caf1fc83b6242"
              ]
            },
            "_rev": "4-2c3c860d421fc9f6cc82e4fb811dc8e2",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 4,
              "ids": [
                "dbaa7e6c02381c2c0ec5259572387d7c",
                "f28d17ab990dcadd20ad38860fde9f11",
                "6cf4b9e2115d7e884292b97aa8765285",
                "dcfdf66ab61873ee512a9ccf3e3731a1"
              ]
            },
            "_rev": "4-dbaa7e6c02381c2c0ec5259572387d7c",
            "_id": "b74e3b45",
            "_deleted": true
          },
          {
            "_revisions": {
              "start": 6,
              "ids": [
                "441f43a31c89dc68a7cc934ce5779bf8",
                "4c7f8b00508144d049d18668d17e552a",
                "e8431fb3b448f3457c5b2d77012fa8b4",
                "f2e7dc8102123e13ca792a0a05ca6235",
                "37a13a5c1e2ce5926a3ffcda7e669106",
                "78739468c87b30f76d067a2d7f373803"
              ]
            },
            "_rev": "6-441f43a31c89dc68a7cc934ce5779bf8",
            "_id": "b74e3b45",
            "_deleted": true
          }
        ]
      }
    ];
  });
});
