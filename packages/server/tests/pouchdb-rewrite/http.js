const {setupHTTP, teardown, rewriteDocument, shouldThrowError} = require('./utils');

let db;

describe('http', () => {
  beforeEach(() => {
    db = setupHTTP();
    return db.put(rewriteDocument);
  });
  afterEach(teardown);

  it('rewrite', () => {
    return shouldThrowError(() => {
      return db.rewrite('test/test/all');
    })

    .then((error) => {
      error.status.should.equal(404);
      error.name.should.equal('not_found');
    });
  });
});
