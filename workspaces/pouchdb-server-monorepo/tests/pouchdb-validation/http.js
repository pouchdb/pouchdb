const {setupHTTP, teardown, shouldThrowError, onlyTestValidationDoc} = require('./utils');

let db;
function before() {
  db = setupHTTP();
}

describe('signature http tests', () => {
  beforeEach(before);
  afterEach(teardown);

  it('should work with post', () => {
    // Tests one special validation case to complete JS coverage
    return db.validatingPost({});
  });
});

describe('http tests', () => {
  beforeEach(before);
  afterEach(teardown);
  //FIXME: re-enable (related to bug report)
  it.skip('should work', () => {
    return db.put(onlyTestValidationDoc)

    .then(() => {
      return shouldThrowError(() => {
        return db.validatingPost({});
      });
    })

    .then((error) => {
      error.status.should.equal(403);
      error.name.should.equal('forbidden');
      error.message.should.equal("only a document named 'test' is allowed.");

      return db.validatingPut({_id: 'test'});
    })

    .then((response) => {
      response.ok.should.be.ok;
    });
  });
});
