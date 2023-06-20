const {PouchDB} = require('./utils');

describe('signatures', function () {
  it('vhost', function () {
    const promise = PouchDB.virtualHost({raw_path: '/'}, {}, function () {});
    promise.then.should.be.ok;
    promise.catch.should.be.ok;
  });
});
