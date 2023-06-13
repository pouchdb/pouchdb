const {setupHTTP, teardown} = require('./utils');

describe('HTTP tests', () => {
  let db;
  beforeEach(() => {
    db = setupHTTP();
  });
  afterEach(() => {
    //restore security document so the db can be easily deleted.
    return db.putSecurity({})
    .then(teardown);
  });

  it('should function', () => {
    return db.getSecurity()
    .then(security => {
      security.should.eql({});
      return db.putSecurity({a: 1});
    })
    .then(resp => {
      resp.should.eql({ok: true});
      return db.getSecurity();
    })
    .then(security => {
      security.should.eql({a: 1});
    });
  });
});
