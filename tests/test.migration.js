'use strict';
if (!process.env.LEVEL_ADAPTER &&
    !process.env.LEVEL_PREFIX && !process.env.AUTO_COMPACTION) {
  // these tests don't make sense for anything other than default leveldown
  var fs = require('fs');
  var ncp = require('ncp').ncp;

  ncp.limit = 16;

  describe('migration one', function () {
    beforeEach(function (done) {
      var input = fs.createReadStream('./tests/oldStyle.uuid');
      input.on('end', function () {
        ncp('./tests/oldStyle', './tmp/_pouch_oldStyle', done);
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
      ncp('./tests/middleStyle', './tmp/_pouch_middleStyle', done);
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
}
