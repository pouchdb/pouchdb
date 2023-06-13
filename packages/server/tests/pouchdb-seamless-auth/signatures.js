const {waitUntilReady, cleanup, PouchDB} = require('./utils');

describe('signatures', () => {
  before(waitUntilReady);
  afterEach(cleanup);

  it('seamless auth', () => {
    const promise = PouchDB.seamlessSession(() => {});
    promise.then.should.be.ok;
    promise.catch.should.be.ok;
    return promise;
  });
});
