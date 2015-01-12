'use strict';

var adapters = ['local', 'http'];

function makeDocs(start, end, templateDoc) {
  var templateDocSrc = templateDoc ? JSON.stringify(templateDoc) : '{}';
  if (end === undefined) {
    end = start;
    start = 0;
  }
  var docs = [];
  for (var i = start; i < end; i++) {
    /*jshint evil:true */
    var newDoc = eval('(' + templateDocSrc + ')');
    newDoc._id = i.toString();
    newDoc.integer = i;
    newDoc.string = i.toString();
    docs.push(newDoc);
  }
  return docs;
}

adapters.forEach(function (adapter) {
  describe('test.bulk_docs.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    var authors = [
      {name: 'Dale Harvey', commits: 253},
      {name: 'Mikeal Rogers', commits: 42},
      {name: 'Johannes J. Schmidt', commits: 13},
      {name: 'Randall Leeds', commits: 9}
    ];

    it('Testing bulk docs', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = makeDocs(5);
      db.bulkDocs({ docs: docs }, function (err, results) {
        results.should.have.length(5, 'results length matches');
        for (var i = 0; i < 5; i++) {
          results[i].id.should.equal(docs[i]._id, 'id matches');
          should.exist(results[i].rev, 'rev is set');
          // Update the doc
          docs[i]._rev = results[i].rev;
          docs[i].string = docs[i].string + '.00';
        }
        db.bulkDocs({ docs: docs }, function (err, results) {
          results.should.have.length(5, 'results length matches');
          for (i = 0; i < 5; i++) {
            results[i].id.should.equal(i.toString(), 'id matches again');
            // set the delete flag to delete the docs in the next step
            docs[i]._rev = results[i].rev;
            docs[i]._deleted = true;
          }
          db.put(docs[0], function (err, doc) {
            db.bulkDocs({ docs: docs }, function (err, results) {
              results[0].name.should.equal(
                'conflict', 'First doc should be in conflict');
              should.not.exist(results[0].rev, 'no rev in conflict');
              for (i = 1; i < 5; i++) {
                results[i].id.should.equal(i.toString());
                should.exist(results[i].rev);
              }
              done();
            });
          });
        });
      });
    });

    it('No id in bulk docs', function (done) {
      var db = new PouchDB(dbs.name);
      var newdoc = {
        '_id': 'foobar',
        'body': 'baz'
      };
      db.put(newdoc, function (err, doc) {
        should.exist(doc.ok);
        var docs = [
          {
            '_id': newdoc._id,
            '_rev': newdoc._rev,
            'body': 'blam'
          },
          {
            '_id': newdoc._id,
            '_rev': newdoc._rev,
            '_deleted': true
          }
        ];
        db.bulkDocs({ docs: docs }, function (err, results) {
          results[0].should.have.property('name', 'conflict');
          results[1].should.have.property('name', 'conflict');
          done();
        });
      });
    });

    it('No _rev and new_edits=false', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [{
        _id: 'foo',
        integer: 1
      }];
      db.bulkDocs({ docs: docs }, { new_edits: false }, function (err, res) {
        should.exist(err, 'error reported');
        done();
      });
    });

    it('Test empty bulkDocs', function () {
      var db = new PouchDB(dbs.name);
      return db.bulkDocs([]);
    });

    it('Test many bulkDocs', function () {
      var db = new PouchDB(dbs.name);
      var docs = [];
      for (var i = 0; i < 201; i++) {
        docs.push({_id: i.toString()});
      }
      return db.bulkDocs(docs);
    });

    it('Test errors on invalid doc id', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [{
        '_id': '_invalid',
        foo: 'bar'
      }];
      db.bulkDocs({ docs: docs }, function (err, info) {
        err.status.should.equal(PouchDB.Errors.RESERVED_ID.status,
                                'correct error status returned');
        err.message.should.equal(PouchDB.Errors.RESERVED_ID.message,
                                 'correct error message returned');
        should.not.exist(info, 'info is empty');
        done();
      });
    });

    it('Test two errors on invalid doc id', function (done) {
      var docs = [
        {'_id': '_invalid', foo: 'bar'},
        {'_id': 123, foo: 'bar'}
      ];

      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, function (err, info) {
        err.status.should.equal(PouchDB.Errors.RESERVED_ID.status,
                                'correct error returned');
        err.message.should.equal(PouchDB.Errors.RESERVED_ID.message,
                                 'correct error message returned');
        should.not.exist(info, 'info is empty');
        done();
      });
    });

    it('No docs', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ 'doc': [{ 'foo': 'bar' }] }, function (err, result) {
        err.status.should.equal(PouchDB.Errors.MISSING_BULK_DOCS.status,
                                'correct error returned');
        err.message.should.equal(PouchDB.Errors.MISSING_BULK_DOCS.message,
                                 'correct error message returned');
        done();
      });
    });

    it('Jira 911', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [
        {'_id': '0', 'a': 0},
        {'_id': '1', 'a': 1},
        {'_id': '1', 'a': 1},
        {'_id': '3', 'a': 3}
      ];
      db.bulkDocs({ docs: docs }, function (err, results) {
        results[1].id.should.equal('1', 'check ordering');
        should.not.exist(results[1].name, 'first id succeded');
        results[2].name.should.equal('conflict', 'second conflicted');
        results.should.have.length(4, 'got right amount of results');
        done();
      });
    });

    it('Test multiple bulkdocs', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: authors }, function (err, res) {
        db.bulkDocs({ docs: authors }, function (err, res) {
          db.allDocs(function (err, result) {
            result.total_rows.should.equal(8, 'correct number of results');
            done();
          });
        });
      });
    });

    it('#2935 new_edits=false correct number', function () {
      var docs = [
        {
          "_id": "EE35E",
          "_rev": "4-70b26",
          "_deleted": true,
          "_revisions": {
            "start": 4,
            "ids": ["70b26", "9f454", "914bf", "7fdf8"]
          }
        }, {
          "_id": "EE35E",
          "_rev": "3-f6d28",
          "_revisions": {"start": 3, "ids": ["f6d28", "914bf", "7fdf8"]}
        }
      ];

      var db = new PouchDB(dbs.name);

      return db.bulkDocs({docs: docs, new_edits: false}).then(function (res) {
        res.should.deep.equal([]);
        return db.allDocs();
      }).then(function (res) {
        res.total_rows.should.equal(1);
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1);
      });
    });

    it('#2935 new_edits=false correct number 2', function () {
      var docs = [
        {
          "_id": "EE35E",
          "_rev": "3-f6d28",
          "_revisions": {"start": 3, "ids": ["f6d28", "914bf", "7fdf8"]}
        }, {
          "_id": "EE35E",
          "_rev": "4-70b26",
          "_deleted": true,
          "_revisions": {
            "start": 4,
            "ids": ["70b26", "9f454", "914bf", "7fdf8"]
          }
        }
      ];

      var db = new PouchDB(dbs.name);

      return db.bulkDocs({docs: docs, new_edits: false}).then(function (res) {
        res.should.deep.equal([]);
        return db.allDocs();
      }).then(function (res) {
        res.total_rows.should.equal(1);
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(1);
      });
    });

    it('#2935 new_edits=false with single unauthorized', function (done) {

      testUtils.isCouchDB(function (isCouchDB) {
        if (adapter !== 'http' || !isCouchDB) {
          return done();
        }

        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo === undefined) {
              throw {unauthorized: 'Document must have a foo.'};
            }
          }.toString()
        };

        var db = new PouchDB(dbs.name);

        db.put(ddoc).then(function () {
          return db.bulkDocs({
            docs: [
              {
                '_id': 'doc0',
                '_rev': '1-x',
                'foo': 'bar',
                '_revisions': {
                  'start': 1,
                  'ids': ['x']
                }
              }, {
                '_id': 'doc1',
                '_rev': '1-x',
                '_revisions': {
                  'start': 1,
                  'ids': ['x']
                }
              }, {
                '_id': 'doc2',
                '_rev': '1-x',
                'foo': 'bar',
                '_revisions': {
                  'start': 1,
                  'ids': ['x']
                }
              }
            ]
          }, {new_edits: false});
        }).then(function (res) {
          res.should.have.length(1);
          should.exist(res[0].error);
          res[0].id.should.equal('doc1');
        }).then(done);
      });
    });

    it('Bulk with new_edits=false', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [{
        '_id': 'foo',
        '_rev': '2-x',
        '_revisions': {
          'start': 2,
          'ids': ['x', 'a']
        }
      }, {
        '_id': 'foo',
        '_rev': '2-y',
        '_revisions': {
          'start': 2,
          'ids': ['y', 'a']
        }
      }];
      db.bulkDocs({docs: docs}, {new_edits: false}, function (err, res) {
        db.get('foo', {open_revs: 'all'}, function (err, res) {
          res.sort(function (a, b) {
            return a.ok._rev < b.ok._rev ? -1 :
              a.ok._rev > b.ok._rev ? 1 : 0;
          });
          res.length.should.equal(2);
          res[0].ok._rev.should.equal('2-x', 'doc1 ok');
          res[1].ok._rev.should.equal('2-y', 'doc2 ok');
          done();
        });
      });
    });

    it('Testing successive new_edits to the same doc', function (done) {

      var db = new PouchDB(dbs.name);
      var docs = [{
        '_id': 'foo',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      }];

      db.bulkDocs({docs: docs, new_edits: false}, function (err, result) {
        should.not.exist(err);
        db.bulkDocs({docs: docs, new_edits: false}, function (err, result) {
          should.not.exist(err);
          db.get('foo', function (err, res) {
            res._rev.should.equal('1-x');
            done();
          });
        });
      });
    });

    it('#3062 bulkDocs with staggered seqs', function () {
      return new PouchDB(dbs.name).then(function (db) {
        var docs = [];
        for (var i = 10; i <= 20; i++) {
          docs.push({ _id: 'doc-' + i});
        }
        return db.bulkDocs({docs: docs}).then(function (infos) {
          docs.forEach(function (doc, i) {
            doc._rev = infos[i].rev;
          });
          var docsToUpdate = docs.filter(function (doc, i) {
            return i % 2 === 1;
          });
          docsToUpdate.reverse();
          return db.bulkDocs({docs: docsToUpdate});
        }).then(function (infos) {
          infos.map(function (x) {
            return {id: x.id, error: !!x.error, rev: (typeof x.rev)};
          }).should.deep.equal([
            { error: false, id: 'doc-19', rev: 'string'},
            { error: false, id: 'doc-17', rev: 'string'},
            { error: false, id: 'doc-15', rev: 'string'},
            { error: false, id: 'doc-13', rev: 'string'},
            { error: false, id: 'doc-11', rev: 'string'}
          ]);
        });
      });
    });

    it('Testing successive new_edits to the same doc, different content',
      function (done) {

      var db = new PouchDB(dbs.name);
      var docsA = [{
        '_id': 'foo',
        '_rev': '1-x',
        'bar' : 'baz',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      }, {
        '_id' : 'fee',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      }];

      var docsB = [{
        '_id': 'foo',
        '_rev': '1-x',
        'bar' : 'zam', // this update should be rejected
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      }, {
        '_id' : 'faa',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      }];

      db.bulkDocs({docs: docsA, new_edits: false}, function (err, result) {
        should.not.exist(err);
        db.changes({complete: function (err, result) {
          var ids = result.results.map(function (row) {
            return row.id;
          });
          ids.should.include("foo");
          ids.should.include("fee");
          ids.should.not.include("faa");

          var update_seq = result.last_seq;
          db.bulkDocs({docs: docsB, new_edits: false}, function (err, result) {
            should.not.exist(err);
            db.changes({
              since : update_seq,
              complete: function (err, result) {
                var ids = result.results.map(function (row) {
                  return row.id;
                });
                ids.should.not.include("foo");
                ids.should.not.include("fee");
                ids.should.include("faa");

                db.get('foo', function (err, res) {
                  res._rev.should.equal('1-x');
                  res.bar.should.equal("baz");
                  db.info(function (err, info) {
                    info.doc_count.should.equal(3);
                    done();
                  });
                });
              }
            });
          });
        }});
      });
    });

    it('Testing successive new_edits to two doc', function () {

      var db = new PouchDB(dbs.name);
      var doc1 = {
        '_id': 'foo',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      };
      var doc2 = {
        '_id': 'bar',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      };

      return db.put(doc1, {new_edits: false}).then(function () {
        return db.put(doc2, {new_edits: false});
      }).then(function () {
        return db.put(doc1, {new_edits: false});
      }).then(function () {
        return db.get('foo');
      }).then(function () {
        return db.get('bar');
      });
    });

    it('Deletion with new_edits=false', function () {

      var db = new PouchDB(dbs.name);
      var doc1 = {
        '_id': 'foo',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      };
      var doc2 = {
        '_deleted': true,
        '_id': 'foo',
        '_rev': '2-y',
        '_revisions': {
          'start': 2,
          'ids': ['y', 'x']
        }
      };

      return db.put(doc1, {new_edits: false}).then(function () {
        return db.put(doc2, {new_edits: false});
      }).then(function () {
        return db.allDocs({keys: ['foo']});
      }).then(function (res) {
        res.rows[0].value.rev.should.equal('2-y');
        res.rows[0].value.deleted.should.equal(true);
      });
    });

    it('Deletion with new_edits=false, no history', function () {

      var db = new PouchDB(dbs.name);
      var doc1 = {
        '_id': 'foo',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      };
      var doc2 = {
        '_deleted': true,
        '_id': 'foo',
        '_rev': '2-y'
      };

      return db.put(doc1, {new_edits: false}).then(function () {
        return db.put(doc2, {new_edits: false});
      }).then(function () {
        return db.allDocs({keys: ['foo']});
      }).then(function (res) {
        res.rows[0].value.rev.should.equal('1-x');
        should.equal(!!res.rows[0].value.deleted, false);
      });
    });

    it('Modification with new_edits=false, no history', function () {

      var db = new PouchDB(dbs.name);
      var doc1 = {
        '_id': 'foo',
        '_rev': '1-x',
        '_revisions': {
          'start': 1,
          'ids': ['x']
        }
      };
      var doc2 = {
        '_id': 'foo',
        '_rev': '2-y'
      };

      return db.put(doc1, {new_edits: false}).then(function () {
        return db.put(doc2, {new_edits: false});
      }).then(function () {
        return db.allDocs({keys: ['foo']});
      }).then(function (res) {
        res.rows[0].value.rev.should.equal('2-y');
      });
    });

    it('Deletion with new_edits=false, no history, no revisions', function () {

      var db = new PouchDB(dbs.name);
      var doc = {
        '_deleted': true,
        '_id': 'foo',
        '_rev': '2-y'
      };

      return db.put(doc, {new_edits: false}).then(function () {
        return db.allDocs({keys: ['foo']});
      }).then(function (res) {
        res.rows[0].value.rev.should.equal('2-y');
        res.rows[0].value.deleted.should.equal(true);
      });
    });

    it('Testing new_edits=false in req body', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [{
        '_id': 'foo',
        '_rev': '2-x',
        '_revisions': {
          'start': 2,
          'ids': ['x', 'a']
        }
      }, {
        '_id': 'foo',
        '_rev': '2-y',
        '_revisions': {
          'start': 2,
          'ids': ['y', 'a']
        }
      }];
      db.bulkDocs({docs: docs, new_edits: false}, function (err, res) {
        db.get('foo', {open_revs: 'all'}, function (err, res) {
          res.sort(function (a, b) {
            return a.ok._rev < b.ok._rev ? -1 :
              a.ok._rev > b.ok._rev ? 1 : 0;
          });
          res.length.should.equal(2);
          res[0].ok._rev.should.equal('2-x', 'doc1 ok');
          res[1].ok._rev.should.equal('2-y', 'doc2 ok');
          done();
        });
      });
    });

    it('656 regression in handling deleted docs', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [{
          _id: 'foo',
          _rev: '1-a',
          _deleted: true
        }]
      }, { new_edits: false }, function (err, res) {
        db.get('foo', function (err, res) {
          should.exist(err, 'deleted');
          err.status.should.equal(PouchDB.Errors.MISSING_DOC.status,
                                   'correct error status returned');
          err.message.should.equal(PouchDB.Errors.MISSING_DOC.message,
                                   'correct error message returned');
          // todo: does not work in pouchdb-server.
          // err.reason.should.equal('deleted',
          //                          'correct error reason returned');
          done();
        });
      });
    });

    it('Test quotes in doc ids', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [{ _id: '\'your_sql_injection_script_here\'' }];
      db.bulkDocs({docs: docs}, function (err, res) {
        should.not.exist(err, 'got error: ' + JSON.stringify(err));
        db.get('foo', function (err, res) {
          should.exist(err, 'deleted');
          done();
        });
      });
    });

    it('Bulk docs empty list', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: [] }, function (err, res) {
        done(err);
      });
    });

    it('handles simultaneous writes', function (done) {
      var db1 = new PouchDB(dbs.name);
      var db2 = new PouchDB(dbs.name);
      var id = 'fooId';
      var errorNames = [];
      var ids = [];
      var numDone = 0;
      function callback(err, res) {
        should.not.exist(err);
        if (res[0].error) {
          errorNames.push(res[0].name);
        } else {
          ids.push(res[0].id);
        }
        if (++numDone === 2) {
          errorNames.should.deep.equal(['conflict']);
          ids.should.deep.equal([id]);
          done();
        }
      }
      db1.bulkDocs({docs : [{_id : id}]}, callback);
      db2.bulkDocs({docs : [{_id : id}]}, callback);
    });

    it('bulk docs input by array', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = makeDocs(5);
      db.bulkDocs(docs, function (err, results) {
        results.should.have.length(5, 'results length matches');
        for (var i = 0; i < 5; i++) {
          results[i].id.should.equal(docs[i]._id, 'id matches');
          should.exist(results[i].rev, 'rev is set');
          // Update the doc
          docs[i]._rev = results[i].rev;
          docs[i].string = docs[i].string + '.00';
        }
        db.bulkDocs(docs, function (err, results) {
          results.should.have.length(5, 'results length matches');
          for (i = 0; i < 5; i++) {
            results[i].id.should.equal(i.toString(), 'id matches again');
            // set the delete flag to delete the docs in the next step
            docs[i]._rev = results[i].rev;
            docs[i]._deleted = true;
          }
          db.put(docs[0], function (err, doc) {
            db.bulkDocs(docs, function (err, results) {
              results[0].name.should.equal(
                'conflict', 'First doc should be in conflict');
              should.not.exist(results[0].rev, 'no rev in conflict');
              for (i = 1; i < 5; i++) {
                results[i].id.should.equal(i.toString());
                should.exist(results[i].rev);
              }
              done();
            });
          });
        });
      });
    });

    it('Bulk empty list', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs([], function (err, res) {
        done(err);
      });
    });

    it('Bulk docs not an array', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: 'foo' }, function (err, res) {
        should.exist(err, 'error reported');
        err.status.should.equal(PouchDB.Errors.MISSING_BULK_DOCS.status,
                                'correct error status returned');
        err.message.should.equal(PouchDB.Errors.MISSING_BULK_DOCS.message,
                                 'correct error message returned');
        done();
      });
    });

    it('Bulk docs not an object', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: ['foo'] }, function (err, res) {
        should.exist(err, 'error reported');
        err.status.should.equal(PouchDB.Errors.NOT_AN_OBJECT.status,
                                'correct error status returned');
        err.message.should.equal(PouchDB.Errors.NOT_AN_OBJECT.message,
                                 'correct error message returned');
      });
      db.bulkDocs({ docs: [[]] }, function (err, res) {
        should.exist(err, 'error reported');
        err.status.should.equal(PouchDB.Errors.NOT_AN_OBJECT.status,
                                'correct error status returned');
        err.message.should.equal(PouchDB.Errors.NOT_AN_OBJECT.message,
                                 'correct error message returned');
        done();
      });
    });

    it('Bulk docs two different revisions to same document id', function(done) {
      var db = new PouchDB(dbs.name);
      var docid = "mydoc";

      function uuid() {
          return PouchDB.utils.uuid(32, 16).toLowerCase();
      }

      // create a few of rando, good revisions
      var numRevs = 3;
      var uuids = [];
      for (var i = 0; i < numRevs - 1; i++) {
          uuids.push(uuid());
      }

      // branch 1
      var a_conflict = uuid();
      var a_doc = {
        _id: docid,
        _rev: numRevs + '-' + a_conflict,
        _revisions: {
          start: numRevs,
          ids: [ a_conflict ].concat(uuids)
        }
      };

      // branch 2
      var b_conflict = uuid();
      var b_doc = {
        _id: docid,
        _rev: numRevs + '-' + b_conflict,
        _revisions: {
          start: numRevs,
          ids: [ b_conflict ].concat(uuids)
        }
      };

      // push the conflicted documents
      return db.bulkDocs([ a_doc, b_doc ], { new_edits: false })

      .then(function() {
        return db.get(docid, { open_revs: "all" }).then(function(resp) {
          resp.length.should.equal(2, 'correct number of open revisions');
          resp[0].ok._id.should.equal(docid, 'rev 1, correct document id');
          resp[1].ok._id.should.equal(docid, 'rev 2, correct document id');
          
          // order of revisions is not specified
          ((resp[0].ok._rev === a_doc._rev &&
            resp[1].ok._rev === b_doc._rev) ||
          (resp[0].ok._rev === b_doc._rev &&
            resp[1].ok._rev === a_doc._rev)).should.equal(true);
        });
      })

      .then(function() { done(); }, done);
    });

  });
});
