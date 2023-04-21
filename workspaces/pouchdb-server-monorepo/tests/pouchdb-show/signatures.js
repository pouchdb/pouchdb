const {setup, teardown} = require('./utils');

let db;

describe('signatures', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);
  it('show', () => {
    const promise = db.show('test/test/test', () => {});
    promise.then.should.be.ok;
    promise.catch.should.be.ok;
  });
});
