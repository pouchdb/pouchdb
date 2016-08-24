'use strict';

describe('constructor errors', function () {

  it('should error on an undefined name', function (done) {
    try {
      new PouchDB();
      done('Should have thrown');
    } catch (err) {
      should.equal(err instanceof Error, true, 'should be an error');
      done();
    }
  });

  it('should error on an undefined adapter', function (done) {
    try {
      new PouchDB('foo', {adapter : 'myFakeAdapter'});
      done('Should have thrown');
    } catch (err) {
      should.equal(err instanceof Error, true, 'should be an error');
      err.message.should
        .equal('Invalid Adapter: myFakeAdapter',
               'should give the correct error message');
      done();
    }
  });

  it('should error on a null name', function (done) {
    try {
      new PouchDB(null);
      done('Should have thrown');
    } catch (err) {
      should.equal(err instanceof Error, true, 'should be an error');
      done();
    }
  });

});
