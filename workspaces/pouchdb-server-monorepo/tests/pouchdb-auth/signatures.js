const {setup, teardown, Auth} = require('./utils');

describe('hashAdminPasswords', () => {
  it('should return a promise', () => {
    return Auth.hashAdminPasswords({})

    .then((response) => {
      response.should.eql({});
    });
  });
  it('should return a promise and accept a callback', () => {
    const cb = () => {};

    return Auth.hashAdminPasswords({}, cb)

    .then((response) => {
      response.should.eql({});
    });
  });
});

describe('workflow', () => {
  let db;
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  it('should not throw and methods should return promises', () => {
    return db.useAsAuthenticationDB()

    .then(() => {
      return db.session(() => {});
    })

    .then(() => {
      db.stopUsingAsAuthenticationDB();
    });
  });
});
