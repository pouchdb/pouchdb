const {setup, teardown} = require('./utils');

describe('signature tests', () => {
  let db;
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  it('update', () => {
    const promise = db.update('test/test/test', () => {});
    promise.then.should.be.ok;
    promise.catch.should.be.ok;
  });
});
