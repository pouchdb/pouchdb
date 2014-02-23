'use strict';

var fs = require('fs');
var ncp = require('ncp').ncp;

ncp.limit = 16;

describe('migration', function () {
  beforeEach(function (done) {
    var input = fs.createReadStream('./tests/oldStyle.uuid');
    input.on('end', function () {
      ncp('./tests/oldStyle', './tmp/oldStyle', done);
    });
    input.pipe(fs.createWriteStream('./tmp/oldStyle.uuid'));
  });
  it('should work', function (done) {
    new PouchDB('./tmp/oldStyle').then(function (db) {
      db.get('doc').then(function (doc) {
        doc.something.should.equal('awesome');
        done();
      });
    });
  });
});