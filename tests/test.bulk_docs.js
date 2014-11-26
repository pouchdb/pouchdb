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
        err.status.should.equal(400, 'correct error status returned');
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
        err.status.should.equal(400, 'correct error returned');
        err.message.should.equal(PouchDB.Errors.RESERVED_ID.message,
                                 'correct error message returned');
        should.not.exist(info, 'info is empty');
        done();
      });
    });

    it('No docs', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ 'doc': [{ 'foo': 'bar' }] }, function (err, result) {
        err.status.should.equal(400);
        err.message.should.equal('Missing JSON list of \'docs\'');
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
          result.last_seq.should.equal(2);
          db.bulkDocs({docs: docsB, new_edits: false}, function (err, result) {
            should.not.exist(err);
            db.changes({
              since : 2,
              complete: function (err, result) {
                var ids = result.results.map(function (row) {
                  return row.id;
                });
                ids.should.not.include("foo");
                ids.should.not.include("fee");
                ids.should.include("faa");
                result.last_seq.should.equal(3);
                db.get('foo', function (err, res) {
                  res._rev.should.equal('1-x');
                  res.bar.should.equal("baz");
                  db.info(function (err, info) {
                    info.doc_count.should.equal(3);
                    info.update_seq.should.equal(3);
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
        err.status.should.equal(400);
        err.message.should.equal('Missing JSON list of \'docs\'');
        done();
      });
    });

    it('Bulk docs not an object', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: ['foo'] }, function (err, res) {
        should.exist(err, 'error reported');
        err.status.should.equal(400);
        err.message.should.equal('Document must be a JSON object');
      });
      db.bulkDocs({ docs: [[]] }, function (err, res) {
        should.exist(err, 'error reported');
        err.status.should.equal(400);
        err.message.should.equal('Document must be a JSON object');
        done();
      });
    });


    it('#3054 skimdb conflict', function () {
      var docs = [
        {
          "_id": "blade",
          "_rev": "342-ecd0b",
          "name": "blade",
          "description": "Blade",
          "readme": "foo",
          "readmeFilename": "README.md",
          "_revisions": {
            "start": 342,
            "ids": [
              "ecd0b", "e75a2", "85510", "18bc9", "a5e78", "98656",
              "2a00d", "3a1c3", "28ce5", "3c64c", "96084", "876fb",
              "26965", "8f584", "1243d", "4a62e", "4405b", "661ee",
              "6e276", "1d6c5", "86117", "29f9c", "f4eaa", "63614",
              "67c94", "54f94", "016ac", "d573b", "9631c", "166d5",
              "fde30", "70027", "5737a", "4e559", "2a946", "7d53b",
              "711e5", "8744a", "09455", "e26ff", "5a0ba", "0dad7",
              "10c89", "0f8c0", "17620", "a4aa8", "426a9", "1642d",
              "b3870", "3a680", "12c29", "fce5e", "fbc97", "8695b",
              "f1739", "bad8f", "33426", "e4a7b", "f3fd8", "86e9c",
              "35072", "43da2", "61437", "b36cb", "b6741", "9bce8",
              "78d28", "13717", "7248e", "0155a", "d8ab4", "b00f4",
              "7b361", "b4a7a", "d3d7c", "7bc56", "7f53f", "b864d",
              "28ccf", "cf791", "25120", "c27ff", "16210", "bdf8a",
              "2f8e0", "86d49", "6246b", "8d763", "477c7", "087ab",
              "c3f20", "16e60", "af384", "22797", "1355f", "b7815",
              "63161", "2e58f", "e0a11", "3cf91", "e762a", "1bc57",
              "15d0f", "22374", "e4cce", "acd1c", "2bf32", "c4e9b",
              "9d6af", "28d68", "7d9d6", "355b0", "92c68", "60a87",
              "61e3d", "a9b39", "af352", "9a086", "b7b6e", "8e6b0",
              "f99a5", "56d4c", "68d5d", "5de5f", "edf41", "1d7bd",
              "9616f", "9894c", "c1b57", "892c4", "1c566", "acb0a",
              "cf986", "9e462", "92ada", "30265", "77eb2", "431aa",
              "d3344", "f5fd9", "e7324", "6d64a", "d6a7d", "71600",
              "2af3d", "bcdf3", "131a6", "0fd56", "b5029", "2d77f",
              "17e2b", "5d23e", "a80df", "6901b", "c9e5d", "d6c99",
              "28de6", "8f99c", "0e76a", "998e7", "e8f34", "beb5d",
              "b43a9", "30540", "68f3a", "a4400", "13691", "d3916",
              "d6f3f", "5b572", "323a6", "b0f6d", "58dee", "662d2",
              "167c1", "e5c82", "5d5a1", "a8dc6", "83eeb", "455c5",
              "b13ad", "3e18e", "f7a80", "0bcd4", "bfac0", "11eee",
              "0d82c", "6bd38", "207ce", "07269", "47ee5", "16822",
              "ca6ee", "906ad", "a190c", "366ee", "0729b", "93824",
              "4d727", "f0342", "cf399", "6a605", "c0b3e", "3cbb1",
              "deb07", "d6c1f", "66fbd", "66749", "2f82e", "e6fe0",
              "b1d7a", "f32da", "684db", "d5c76", "f3171", "3ab7f",
              "ae7ed", "cf9ec", "668aa", "094e3", "d28b3", "5793c",
              "49dbe", "349cc", "f532f", "73e2c", "059d9", "221c9",
              "70f55", "95ed5", "73d05", "6d7fd", "be3bf", "d43f9",
              "7837f", "71227", "1fd13", "d7754", "5d25e", "79ee4",
              "39537", "adb9a", "fb72e", "c34e9", "a4eb4", "e79a6",
              "ee92d", "b800d", "0f69e", "26791", "c99a5", "fbcbb",
              "21a0d", "a1933", "567ab", "f951a", "f63e9", "06f5c",
              "d2051", "4ec08", "05606", "2e6f5", "21988", "fb822",
              "0ab88", "75d0e", "93baf", "946da", "6b9a6", "76ccc",
              "11082", "21d63", "7f2fb", "4926a", "6aa09", "cab95",
              "b40c8", "c033c", "209aa", "1a965", "b7464", "e6faa",
              "e4285", "4b8e7", "b4d79", "7fe53", "a02cd", "6fdff",
              "e674d", "c140f", "7a18b", "30509", "4221c", "85057",
              "bf75b", "5e181", "ddf17", "fe117", "15e19", "c570e",
              "50e49", "a8ecf", "8528c", "5a75b", "52eea", "be381",
              "4d924", "9c2cb", "ef653", "732c2", "be060", "de437",
              "10f00", "b469a", "0e1b3", "cb1d4", "a1427", "01d52",
              "abb4c", "7fb24", "cab19", "fa15e", "4d55a", "7b9a2",
              "7342b", "65fc2", "d5b9f", "7a781", "7d5a0", "61d02",
              "f501e", "de74b", "aec87", "a289b", "3478e", "715a9",
              "ce5bc", "197fb", "95daa", "25a98", "bfac3", "96a35"
            ]
          }
        },
        {
          "_id": "object-walker",
          "_rev": "11-37e3f",
          "name": "object-walker",
          "description": "Walk Objects like an Acrobat",
          "readme": "foo",
          "readmeFilename": "README.md",
          "_revisions": {
            "start": 11,
            "ids": [
              "37e3f", "5670f", "c13e5",
              "363a9", "7aefb", "dd41d",
              "3f8a0", "3defa", "5228b",
              "6bb5e", "a91a6"
            ]
          }
        },
        {
          "_id": "obop",
          "_rev": "8-89191",
          "name": "obop",
          "description": "MongoDB-style",
          "readme": "foo",
          "readmeFilename": "README.md",
          "_revisions": {
            "start": 8,
            "ids": [
              "89191", "0bf84", "d872f", "f43d5", "ae532",
              "b86a2", "79dfd", "f0dc9"
            ]
          }
        }
      ];

      var origDoc = { _id: 'blade',
        _rev: '339-885c5',
        _deleted: true,
        _revisions:
        { start: 339,
          ids:
            [ '885c5', '75d77', '98656', '2a00d', '3a1c3', '28ce5',
              '3c64c', '96084', '876fb', '26965', '8f584', '1243d',
              '4a62e', '4405b', '661ee', '6e276', '1d6c5', '86117',
              '29f9c', 'f4eaa', '63614', '67c94', '54f94', '016ac',
              'd573b', '9631c', '166d5', 'fde30', '70027', '5737a',
              '4e559', '2a946', '7d53b', '711e5', '8744a', '09455',
              'e26ff', '5a0ba', '0dad7', '10c89', '0f8c0', '17620',
              'a4aa8', '426a9', '1642d', 'b3870', '3a680', '12c29',
              'fce5e', 'fbc97', '8695b', 'f1739', 'bad8f', '33426',
              'e4a7b', 'f3fd8', '86e9c', '35072', '43da2', '61437',
              'b36cb', 'b6741', '9bce8', '78d28', '13717', '7248e',
              '0155a', 'd8ab4', 'b00f4', '7b361', 'b4a7a', 'd3d7c',
              '7bc56', '7f53f', 'b864d', '28ccf', 'cf791', '25120',
              'c27ff', '16210', 'bdf8a', '2f8e0', '86d49', '6246b',
              '8d763', '477c7', '087ab', 'c3f20', '16e60', 'af384',
              '22797', '1355f', 'b7815', '63161', '2e58f', 'e0a11',
              '3cf91', 'e762a', '1bc57', '15d0f', '22374', 'e4cce',
              'acd1c', '2bf32', 'c4e9b', '9d6af', '28d68', '7d9d6',
              '355b0', '92c68', '60a87', '61e3d', 'a9b39', 'af352',
              '9a086', 'b7b6e', '8e6b0', 'f99a5', '56d4c', '68d5d',
              '5de5f', 'edf41', '1d7bd', '9616f', '9894c', 'c1b57',
              '892c4', '1c566', 'acb0a', 'cf986', '9e462', '92ada',
              '30265', '77eb2', '431aa', 'd3344', 'f5fd9', 'e7324',
              '6d64a', 'd6a7d', '71600', '2af3d', 'bcdf3', '131a6',
              '0fd56', 'b5029', '2d77f', '17e2b', '5d23e', 'a80df',
              '6901b', 'c9e5d', 'd6c99', '28de6', '8f99c', '0e76a',
              '998e7', 'e8f34', 'beb5d', 'b43a9', '30540', '68f3a',
              'a4400', '13691', 'd3916', 'd6f3f', '5b572', '323a6',
              'b0f6d', '58dee', '662d2', '167c1', 'e5c82', '5d5a1',
              'a8dc6', '83eeb', '455c5', 'b13ad', '3e18e', 'f7a80',
              '0bcd4', 'bfac0', '11eee', '0d82c', '6bd38', '207ce',
              '07269', '47ee5', '16822', 'ca6ee', '906ad', 'a190c',
              '366ee', '0729b', '93824', '4d727', 'f0342', 'cf399',
              '6a605', 'c0b3e', '3cbb1', 'deb07', 'd6c1f', '66fbd',
              '66749', '2f82e', 'e6fe0', 'b1d7a', 'f32da', '684db',
              'd5c76', 'f3171', '3ab7f', 'ae7ed', 'cf9ec', '668aa',
              '094e3', 'd28b3', '5793c', '49dbe', '349cc', 'f532f',
              '73e2c', '059d9', '221c9', '70f55', '95ed5', '73d05',
              '6d7fd', 'be3bf', 'd43f9', '7837f', '71227', '1fd13',
              'd7754', '5d25e', '79ee4', '39537', 'adb9a', 'fb72e',
              'c34e9', 'a4eb4', 'e79a6', 'ee92d', 'b800d', '0f69e',
              '26791', 'c99a5', 'fbcbb', '21a0d', 'a1933', '567ab',
              'f951a', 'f63e9', '06f5c', 'd2051', '4ec08', '05606',
              '2e6f5', '21988', 'fb822', '0ab88', '75d0e', '93baf',
              '946da', '6b9a6', '76ccc', '11082', '21d63', '7f2fb',
              '4926a', '6aa09', 'cab95', 'b40c8', 'c033c', '209aa',
              '1a965', 'b7464', 'e6faa', 'e4285', '4b8e7', 'b4d79',
              '7fe53', 'a02cd', '6fdff', 'e674d', 'c140f', '7a18b',
              '30509', '4221c', '85057', 'bf75b', '5e181', 'ddf17',
              'fe117', '15e19', 'c570e', '50e49', 'a8ecf', '8528c',
              '5a75b', '52eea', 'be381', '4d924', '9c2cb', 'ef653',
              '732c2', 'be060', 'de437', '10f00', 'b469a', '0e1b3',
              'cb1d4', 'a1427', '01d52', 'abb4c', '7fb24', 'cab19',
              'fa15e', '4d55a', '7b9a2', '7342b', '65fc2', 'd5b9f',
              '7a781', '7d5a0', '61d02', 'f501e', 'de74b', 'aec87',
              'a289b', '3478e', '715a9', 'ce5bc', '197fb', '95daa',
              '25a98', 'bfac3', '96a35' ]
        }
      };

      var db = new PouchDB(dbs.name);

      return db.bulkDocs({docs: [origDoc], new_edits: false}).then(function () {
        return db.allDocs({keys: ['blade']});
      }).then(function (res) {
        res.rows[0].value.deleted.should.equal(true);
        res.rows[0].value.rev.should.equal("339-885c5");

        return db.bulkDocs({docs: docs, new_edits: false});
      }).then(function () {
        return db.get('blade');
      }).then(function (bladeDoc) {
        bladeDoc._rev.should.equal('342-ecd0b');
      });
    });

  });
});
