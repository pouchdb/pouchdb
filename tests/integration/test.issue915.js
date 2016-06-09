'use strict';
if (!process.env.LEVEL_ADAPTER &&
    !process.env.LEVEL_PREFIX &&
    !process.env.AUTO_COMPACTION &&
    !process.env.ADAPTER) {
  // these tests don't make sense for anything other than default leveldown
  var fs = require('fs');
  describe('test.issue915.js', function () {
    afterEach(function (done) {
      fs.unlink('./tmp/_pouch_veryimportantfiles/something', function () {
        fs.rmdir('./tmp/_pouch_veryimportantfiles/', function () {
          done();
        });
      });
    });
    it('Put a file in the db, then destroy it', function (done) {
      var db = new PouchDB('veryimportantfiles');
      fs.writeFile('./tmp/_pouch_veryimportantfiles/something',
                   new Buffer('lalala'), function () {
        db.destroy(function (err) {
          if (err) {
            return done(err);
          }
          fs.readFile('./tmp/_pouch_veryimportantfiles/something',
                      {encoding: 'utf8'}, function (err, resp) {
            if (err) {
              return done(err);
            }
            resp.should.equal('lalala',
              './tmp/veryimportantfiles/something was not removed');
            done();
          });
        });
      });
    });
  });
}
