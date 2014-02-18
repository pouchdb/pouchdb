'use strict';

describe('constructor errors', function () {
  it('should error on an undefined name', function (done) {
    var notAName;
    new PouchDB(notAName, function (err, db) {
      should.exist(err);
      done(db);
    });
  });
  it('should error on a null name', function (done) {
    var notAName = null;
    new PouchDB(notAName).then(done, function (err) {
      should.exist(err);
      done();
    });
  });
  describe('it should always return methods', function () {
    it('put', function (done) {
      new PouchDB().put({
        _id: 'lala'
      }, function (err, resp) {
        should.exist(err);
        done(resp);
      });
    });
    it('post', function (done) {
      new PouchDB().post({
        something: 'lala'
      }).then(done, function (err) {
        should.exist(err);
        done();
      });
    });
    it('get', function (done) {
      var nothing;
      new PouchDB(nothing).get('something', function (err, resp) {
        should.exist(err);
        done(resp);
      });
    });
    it('allDocs', function (done) {
      new PouchDB().allDocs().then(done, function (err) {
        should.exist(err);
        done();
      });
    });
    it('changes', function (done) {
      new PouchDB().changes({
        complete: function (err, resp) {
            should.exist(err);
            done(resp);
          }
      });
    });
  });
});