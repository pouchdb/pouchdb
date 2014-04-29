'use strict';

var fs = require('fs');
var ncp = require('ncp').ncp;

ncp.limit = 16;

describe('migration', function () {
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
