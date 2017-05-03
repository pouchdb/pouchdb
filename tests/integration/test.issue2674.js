'use strict';

var adapterPairs = [
  ['local', 'local'],
  ['local', 'http'],
  ['http', 'local'],
  ['http', 'http']
];

adapterPairs.forEach(function (adapters) {
  describe('test.issue2674.js- ' +
    adapters[0] + '-' + adapters[1], function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb' + (new Date()).getTime());
      dbs.secondDB = testUtils.adapterUrl(adapters[0], 'test_repl_remote' + (new Date()).getTime());
      //
      // "test_slash_ids" is just a convenient name, b/c we re-use db
      // names to avoid the Safari popup bug in long-running tests.
      //
      // Also for this test, it's only important that the fourth DB be
      // truly remote.
      dbs.thirdDB = testUtils.adapterUrl(adapters[0], 'test_slash_ids');
      dbs.fourthDB = testUtils.adapterUrl(adapters[1], 'test_slash_ids_remote');
      testUtils.cleanup([dbs.name, dbs.secondDB, dbs.thirdDB, dbs.fourthDB],
        done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.secondDB, dbs.thirdDB, dbs.fourthDB],
        done);
    });

    it('Should correctly synchronize attachments (#2674)', function () {
// 1. So I ran client app on two browsers (let’s call them A and B).
// 2. Then on client A I created plain document (without any attachments).
// 3. After that I put two attachments one by one by using putAttachment method.
//   Let’s call them image1.jpg and image2.jpg.
// 4. In next step I synchronized local db on A with remote db (by using sync
// method without any additional options like live mode, retry, etc.).
// 5. On client B I synchronized its local db with remote db (in the same way
// like above).
// 6. On client A I removed one attachment, for example image1.jpg
// 7. On B I modified plain content of this document (without touching
// attachments) and put to local db.
// 8. Then I synchronized dbs on A as first
// 9. After that I synchronized dbs on B
// 10. I ran client app on another browser (C) where local db was empty.
// 11. Then I started the synchronization process on C and got an error (that
// image1.jpg was not found)
// 12. As the result the synchronization process failed and the data were not
// replicated at all (the local db on C was still empty)
      var doc = {_id: 'a', a: 1};

      var img1 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAMFBMVEX+9+' +
        'j+9OD+7tL95rr93qT80YD7x2L6vkn6syz5qRT4ogT4nwD4ngD4nQD4nQD4' +
        'nQDT2nT/AAAAcElEQVQY002OUQLEQARDw1D14f7X3TCdbfPnhQTqI5UqvG' +
        'OWIz8gAIXFH9zmC63XRyTsOsCWk2A9Ga7wCXlA9m2S6G4JlVwQkpw/Ymxr' +
        'UgNoMoyxBwSMH/WnAzy5cnfLFu+dK2l5gMvuPGLGJd1/9AOiBQiEgkzOpg' +
        'AAAABJRU5ErkJggg==';
      var img2 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAMFBMVEX+9+' +
        'j+9OD+7tL95rr93qT80YD7x2L6vkn6syz5qRT4ogT4nwD4ngD4nQD4nQD4' +
        'nQDT2nT/AAAAcElEQVQY002OUQLEQARDw1D14f7X3TCdbfPnhQTqI5UqvG' +
        'OWIz8gAIXFH9zmC63XRyTsOsCWk2A9Ga7wCXlA9m2S6G4JlVwQkpw/Ymxr' +
        'UgNoMoyxBwSMH/WnAzy5cnfLFu+dK2l5gMvuPGLGJd1/9AOiBQiEgkzOpg' +
        'AAAABJRU5ErkJffQ==';

      var dbA = new PouchDB(dbs.name);
      var dbB = new PouchDB(dbs.secondDB);
      var dbC = new PouchDB(dbs.thirdDB);
      var remoteDb = new PouchDB(dbs.fourthDB);

      // browser a:
      // create document, no atts
      function createDoc() {
        return dbA.put(doc)
          .then(addRev)
          .catch(handleError);
      }

      // add image1.jpg
      function addImg1() {
        return dbA.putAttachment(
          doc._id, 'image1.png', doc._rev, img1, 'image/png')
          .then(addRev)
          .catch(handleError);
      }

      // add image2.jpg
      function addImg2() {
        return dbA.putAttachment(
          doc._id, 'image2.png', doc._rev, img2, 'image/png')
          .then(addRev)
          .catch(handleError);
      }

      // sync() with remote CouchDB
      function syncWithRemote(source) {
        return new testUtils.Promise(function (resolve, reject) {
          source.sync(remoteDb).on('complete', function () {
            resolve();
          }).on('error', function (error) {
            reject(error);
          });
        });
      }

      // remove image1.jpg from doc with an extra revision
      // to guarantee conflict winning revision from dbA
      function removeImg1() {
        return dbA.get(doc._id)
          .then(function (doc) {
            return dbA.put(doc);
          })
          .then(addRev)
          .then(function () {
            return dbA.removeAttachment(doc._id, 'image1.png', doc._rev);
          })
          .catch(handleError);
      }

      // browser b:
      // sync from remote CouchDB
      // sync(updateDoc)
      // update doc json, leave attachments alone
      function updateDoc() {
        var newDoc = {
          _id: doc._id,
          _rev: revs[2],
          a: 2
        };
        return dbB.put(newDoc)
          .catch(handleError);
      }

      // utils:
      function handleError(error) {
        throw error;
      }

      var revs = [];

      function addRev(result) {
        doc._rev = result.rev;
        revs.push(result.rev);
      }

      return createDoc() // create document, no atts
        .then(addImg1) // add image1.jpg
        .then(addImg2) // add image2.jpg
        .then(syncWithRemote.bind(this, dbA))// sync() with remote CouchDB
        .then(removeImg1) // remove image1.jpg from doc
        // go to browser b
        .then(syncWithRemote.bind(this, dbB))// sync from remote CouchDB
        .then(updateDoc) // update doc json, leave attachments alone
        // go to browser a
        .then(syncWithRemote.bind(this, dbA)) // sync with remote CouchDB,
        // syncs up the delete
        // go to browser b
        .then(syncWithRemote.bind(this, dbB)) // sync with remote CouchDB,
        // syncs up the conflictin non-att-change
        // go to browser C
        .then(syncWithRemote.bind(this, dbC)) // sync from remote CouchDB
        // see replication error
        .then(function () {
          return dbC.allDocs({include_docs: true, attachments: true});
        }).then(function (res) {
          res.rows.forEach(function (row) {
            delete row.value;
            delete row.doc._rev;
            delete row.doc._attachments['image2.png'].digest;
            delete row.doc._attachments['image2.png'].revpos;
          });
          var expected = { "total_rows": 1,
            "offset": 0,
            "rows": [
              {
                "id": "a",
                "key": "a",
                "doc": {
                  "a": 1,
                  "_attachments": {
                    "image2.png": {
                      "content_type": "image/png",
                      "data": img2
                    }
                  },
                  "_id": "a"
                }
              }
            ]
          };
          res.should.deep.equal(expected);
        });
    });
  });
});
