const {setup, teardown} = require('./utils');

let db;

describe('signatures', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);
  it('rewrite', () => {
    const promise = db.rewrite('test/test/test', () => {});
    promise.then.should.be.ok;
    promise.catch.should.be.ok;
  });
});
