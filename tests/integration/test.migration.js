'use strict';
if (!process.env.LEVEL_ADAPTER &&
    !process.env.LEVEL_PREFIX && !process.env.AUTO_COMPACTION) {
  // these tests don't make sense for anything other than default leveldown
  var fs = require('fs');
  var ncp = require('ncp').ncp;

  ncp.limit = 16;

  describe('migration one', function () {
    beforeEach(function (done) {
      var input =
        fs.createReadStream('./tests/integration/leveldb/oldStyle.uuid');
      input.on('end', function () {
        ncp('./tests/integration/leveldb/oldStyle',
            './tmp/_pouch_oldStyle', done);
      });
      input.pipe(fs.createWriteStream('./tmp/_pouch_oldStyle.uuid'));
    });
    it('should work', function () {
      return new PouchDB('oldStyle').then(function (db) {
        return db.get('doc').then(function (doc) {
          doc.something.should.equal('awesome');
          return db.destroy();
        });
      });
    });
  });
  describe('migration two', function () {
    beforeEach(function (done) {
      ncp('./tests/integration/leveldb/middleStyle',
          './tmp/_pouch_middleStyle', done);
    });
    it('should work', function () {
      return new PouchDB('middleStyle').then(function (db) {
        db.id().then(function (id) {
          id.should.equal('8E049E64-784A-3209-8DD6-97C29D7A5868');
          return db.get('_local/foo');
        }).then(function (resp) {
          resp.something.should.equal('else');
          return db.allDocs();
        }).then(function (resp) {
          resp.total_rows.should.equal(1);
          resp.rows[0].id.should.equal('_design/foo');
          return db.destroy();
        });
      });
    });
  });

  // sanity check to ensure we don't actually need to migrate
  // attachments for #2818
  describe('#2818 no migration needed for attachments', function () {
    beforeEach(function (done) {
      ncp('./tests/integration/leveldb/lateStyle',
          './tmp/_pouch_lateStyle', done);
    });
    it('should work', function () {
      return new PouchDB('lateStyle', {
        auto_compaction: false
      }).then(function (db) {
        return db.put({
          _id: 'doc_b',
          _attachments: {
            'att.txt': {
              data: 'Zm9v', // 'foo'
              content_type: 'text/plain'
            }
          }
        }).then(function () {
          return db.get('doc_b');
        }).then(function (doc) {
          return db.remove(doc);
        }).then(function () {
          return db.compact();
        }).then(function () {
          return db.get('doc_a', {attachments: true});
        }).then(function (doc) {
          doc._attachments['att.txt'].data.should.equal('Zm9vYmFy');
          doc._attachments['att2.txt'].data.should.equal('Zm9vYmFy');
          doc._attachments['att3.txt'].data.should.equal('Zm9v');
          return db.destroy();
        });
      });
    });
  });

  // Sanity check for the fix in 3136 that guards against successive
  // new_edits to the same rev, ensuring it ignores duplicates.
  //
  // In the olden days, <=3.2.0, if you bulk-pushed with new_edits=false
  // the same rev multiple times, LevelDB would keep incrementing the seq
  // and keep writing new revs. This was fixed, but when we do _changes,
  // we have to guard against these duplicate seqs for backwards compat.
  //
  // This test is very similar to the test.bulk_docs.js test:
  // 'Testing successive new_edits to the same doc, different content'

  describe('#3136 no migration needed for overwritten revs', function () {
    beforeEach(function (done) {
      ncp('./tests/integration/leveldb/laterStyle',
        './tmp/_pouch_laterStyle', done);
    });
    it('should work', function () {
      var db = new PouchDB('laterStyle');

      // basically this a db where I did a very pathological thing:
      //var docsA = [{
      //  '_id': 'foo',
      //  '_rev': '1-x',
      //  'bar' : 'baz',
      //  '_revisions': {
      //    'start': 1,
      //    'ids': ['x']
      //  }
      //}, {
      //  '_id' : 'fee',
      //  '_rev': '1-x',
      //  '_revisions': {
      //    'start': 1,
      //    'ids': ['x']
      //  }
      //}];
      //var docsB = [{
      //  '_id': 'foo',
      //  '_rev': '1-x',
      //  'bar' : 'zam', // this update should be rejected
      //  '_revisions': {
      //    'start': 1,
      //    'ids': ['x']
      //  }
      //}];
      //
      //db.bulkDocs(docsA, {new_edits: false});
      //db.bulkDocs(docsB, {new_edits: false});


      return db.changes({include_docs: true}).then(function (result) {
        // the important thing is that 'zam' is ignored. see
        // the other test in test.bulk_docs.js for details
        var expected = {
          "results": [{
            "id": "fee",
            "changes": [{"rev": "1-x"}],
            "doc": {"_id": "fee", "_rev": "1-x"},
            "seq": 1
          }, {
            "id": "foo",
            "changes": [{"rev": "1-x"}],
            "doc": {"bar": "baz", "_id": "foo", "_rev": "1-x"},
            "seq": 2
          }],
          "last_seq": 2
        };
        result.should.deep.equal(expected);
        return db.destroy();
      });
    });
  });
}
