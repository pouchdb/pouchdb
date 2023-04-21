const {setup, setupWithDoc, teardown, updateDocument, should, shouldThrowError} = require('./utils');

describe('Sync update tests', () => {
  let db;

  beforeEach(() => {
    return setupWithDoc()

    .then((result) => {
      db = result.db;
      return db.put(updateDocument);
    });
  });
  afterEach(teardown);

  it('args', () => {
    return db.update('test/args/mytest', {query: {'a': 3}})

    .then((response) => {
      const [doc, req] = JSON.parse(response.body);
      doc.test.should.be.ok;
      req.id.should.equal('mytest');
      req.raw_path.should.equal('/test/_design/test/_update/args/mytest?a=3');
    });
  });

  it('args without doc', () => {
    return db.update('test/args', {withValidation: true})

    .then((response) => {
      const [doc, req] = JSON.parse(response.body);
      should.equal(doc, null);
      req.should.not.have.property('withValidation');
    });
  });

  it('missing function', () => {
    shouldThrowError(() => {
      return db.update('test/missing/mytest');
    })

    .then((error) => {
      error.toString().should.be.ok;
      error.name.should.equal('not_found');
      error.message.should.equal('missing update function missing on design doc _design/test');
    });
  });

  it('saving', () => {
    db.update('test/save-adding-date', {body: JSON.stringify({
      _id: 'test',
      name: 'Today'
    })})

    .then((response) => {
      response.body.should.equal('Hello World!');

      return db.get('test');
    })

    .then((doc) => {
      doc.updated.should.be.ok;
      doc.name.should.equal('Today');
    });
  });
});

describe('Async update tests', () => {
  let db;

  beforeEach(() => {
    db = setup();
    return db.put(updateDocument);
  });
  afterEach(teardown);

  it('exception', () => {
    return db.update('test/exception')

    .then(() => {
      'db.update("test/exception") should not resolve'.should.equal('');
    })

    .catch((error) => {
      error.status.should.equal(500);
      error.name.should.equal('ReferenceError');
      error.message.should.contain('abc');
    });
  });
});

describe('Async update with empty design doc', () => {
  let db;

  beforeEach(() => {
    db = setup();
    return db.put({_id: '_design/test'});
  });
  afterEach(teardown);

  it('basic', () => {
    return db.update('test/missing')

    .then(() => {
      'db.update("test/missing") should not resolve'.should.equal('');
    })

    .catch((error) => {
      error.status.should.equal(404);
      error.name.should.equal('not_found');
      error.message.should.equal('missing update function missing on design doc _design/test');
    });
  });
});
