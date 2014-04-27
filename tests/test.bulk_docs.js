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
      dbs.name = testUtils.adapterUrl(adapter, 'test_bulk_docs');
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

    it('Test errors on invalid doc id', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [{
        '_id': '_invalid',
        foo: 'bar'
      }];
      db.bulkDocs({ docs: docs }, function (err, info) {
        err.name.should.equal('bad_request', 'correct error returned');
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
        err.name.should.equal('bad_request', 'correct error returned');
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
        err.name.should.equal('bad_request');
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
          done();
        });
      });
    });


    it('Bulk with new_edits=false in req body', function (done) {
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
        err.name.should.equal('bad_request');
        err.message.should.equal('Missing JSON list of \'docs\'');
        done();
      });
    });

    it('Bulk docs not an object', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: ['foo'] }, function (err, res) {
        should.exist(err, 'error reported');
        err.status.should.equal(400);
        err.name.should.equal('bad_request');
        err.message.should.equal('Document must be a JSON object');
      });
      db.bulkDocs({ docs: [[]] }, function (err, res) {
        should.exist(err, 'error reported');
        err.status.should.equal(400);
        err.name.should.equal('bad_request');
        err.message.should.equal('Document must be a JSON object');
        done();
      });
    });

  });
});
