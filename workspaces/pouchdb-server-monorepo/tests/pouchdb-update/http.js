const {setupHTTP, teardown, updateDocument, should} = require('./utils');

let db;

describe('http tests', () => {
  beforeEach(() => {
    db = setupHTTP();
    return db.put(updateDocument);
  });
  afterEach(teardown);

  it('update', () => {
    return db.update('test/args/my-id')

    .then((result) => {
      const [doc, req] = JSON.parse(result.body);
      should.not.exist(doc);
      req.id.should.equal('my-id');
    });
  });
});
