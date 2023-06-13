const {setup, teardown} = require('./utils');

describe('callback usage', () => {
  it('should allow passing in a callback', () => {
    const db = setup();
    return db.validatingPost({}, () => {}).then(teardown);
  });
});
