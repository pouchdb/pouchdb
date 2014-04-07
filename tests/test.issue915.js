'use strict';
var fs = require('fs');
describe('Remove DB', function () {
  afterEach(function (done) {
    fs.unlink('./tmp/_pouch_veryimportantfiles/something', function () {
      fs.rmdir('./tmp/_pouch_veryimportantfiles/', function () {
        done();
      });
    });
  });
  it('Put a file in the db, then destroy it', function (done) {
    new PouchDB('veryimportantfiles', function (err, db) {
      fs.writeFile('./tmp/_pouch_veryimportantfiles/something',
                   new Buffer('lalala'), function (err) {
        db.destroy(function (err) {
          if (err) {
            return done(err);
          }
          fs.readFile('./tmp/_pouch_veryimportantfiles/something',
                      {encoding: 'utf8'}, function (err, resp) {
            if (err) {
              return done(err);
            }
            resp.should
              .equal('lalala',
                     './tmp/veryimportantfiles/something was not removed');
            done();
          });
        });
      });
    });
  });
});
