'use strict';

describe('constructor errors', function () {
  it('should error on an undefined name', function (done) {
    var notAName;
    new PouchDB(notAName, function (err, db) {
      should.exist(err);
      done(db);
    });
  });
  it('should error on an undefined adapter', function (done) {
    new PouchDB('foo', {adapter : 'myFakeAdapter'}, function (err, db) {
      should.exist(err);
      err.message.should
        .equal('Adapter is missing',
               'should give the correct error message');
      done(db);
    });
  });
  it('should error on a null name', function (done) {
    var notAName = null;
    new PouchDB(notAName).then(done, function (err) {
      should.exist(err);
      err.message.should
        .equal('Missing/invalid DB name',
               'should give the correct error message');
      done();
    });
  });
  describe('it should always return methods', function () {
    it('put', function (done) {
      new PouchDB().put({
        _id: 'lala'
      }, function (err, resp) {
        should.exist(err);
        err.message.should
          .equal('Missing/invalid DB name',
                 'should give the correct error message');
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

describe('default options', function () {

  it('default objects should be empty by default', function () {
    PouchDB.defaults().should.deep.equal({});
  });

  it('default should be able to be set', function () {
    var opts = { 'foo' : 'foo' };
    PouchDB.defaults(opts);
    PouchDB.defaults().should.deep.equal(opts);
    PouchDB.defaults({});
  });

  it('default options should be used when creating db', function (done) {
    var opts = { adapter : 'myFakeAdapter' };
    PouchDB.defaults(opts);
    new PouchDB('foo', function (err, db) {
      should.exist(err);
      err.message.should
        .equal('Adapter is missing',
               'should give the correct error message');
      done(db);
    });
    PouchDB.defaults({});
  });

  it('default options should be added to the options', function (done) {
    var opts = { adapter : 'myFakeAdapter' };
    PouchDB.defaults(opts);
    new PouchDB({ name: 'foo' }, function (err, db) {
      should.exist(err);
      err.message.should
        .equal('Adapter is missing',
               'should give the correct error message');
      done(db);
    });
    PouchDB.defaults({});
  });

});