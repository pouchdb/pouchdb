const {setup, teardown, listDocument, shouldThrowError, should} = require('./utils');

let db;

describe('Async list tests', () => {
  beforeEach(() => {
    db = setup();
    return db.put(listDocument).then(() => {
      return db.put({_id: 'testdoc'});
    });
  });
  afterEach(teardown);

  it('args', done => {
    db.list('test/args/ids', {query: {a: 'b'}}, (error, resp) => {
      const [head, req] = JSON.parse(resp.body).args;
      head.offset.should.equal(0);
      should.equal(req.id, null);
      req.query.a.should.equal('b');

      done(error);
    });
  });
});

describe('Sync list tests with empty design docs', () => {
  beforeEach(() => {
    db = setup();
    return db.put({_id: '_design/test'});
  });
  afterEach(teardown);

  it('test', () => {
    return shouldThrowError(() => {
      return db.list('test/test/test');
    })

    .then((error) => {
      error.status.should.equal(404);
      error.name.should.equal('not_found');
    });
  });
});

describe('Sync list tests', () => {
  beforeEach(() => {
    db = setup();
    return db.put(listDocument).then(() => db.put({_id: 'testdoc'}));
  });
  afterEach(teardown);

  it('couch eval', () => {
    return db.list('test/test-coucheval/ids')

    .then((resp) => {
      resp.code.should.equal(200);
      resp.body.should.equal('6 - Hello World!');
    });
  });

  it('args', () => {
    return db.list('test/args/ids', {query: {a: 'b'}})

    .then((resp) => {
      const [head, req] = JSON.parse(resp.body).args;
      head.offset.should.equal(0);
      head.total_rows.should.equal(1);

      should.equal(req.id, null);
      req.raw_path.should.equal('/test/_design/test/_list/args/ids?a=b');
      req.requested_path.should.eql(['test', '_design', 'test', '_list', 'args', 'ids?a=b']);
      req.path.should.eql(['test', '_design', 'test', '_list', 'args', 'ids']);
      // and one at random, to check if the rest (shared with show) is still ok.
      req.peer.should.equal('127.0.0.1');
    });
  });

  it('unexisting design doc', () => {
    return shouldThrowError(() => {
      return db.list('unexisting/args/ids');
    })

    .then((error) => {
      error.name.should.equal('not_found');
    });
  });

  it('unexisting list function', () => {
    return shouldThrowError(() => {
      return db.list('test/unexisting/ids');
    })

    .then((error) => {
      error.toString().should.be.ok;
      error.name.should.equal('not_found');
      error.message.should.equal('missing list function unexisting on design doc _design/test');
    });
  });

  it('unexisting view', () => {
    return shouldThrowError(() => {
      return db.list('test/args/unexisting');
    })

    .then((error) => {
      error.name.should.equal('not_found');
    });
  });

  it('list api', () => {
    return db.list('test/use-list-api/ids')

    .then((resp) => {
      resp.headers['Transfer-Encoding'].should.equal('chunked');
      resp.code.should.equal(500);
      const [row1, row2] = resp.body.split('\n');
      JSON.parse(row1).should.eql({id: 'testdoc', key: 'testdoc', value: 'value'});
      row2.should.equal('testHello World!');
    });
  });

  it('wrong content type', () => {
    // CouchDB only supports application/json here. It's a CouchDB restriction:
    // probably best to emulate it...

    return shouldThrowError(() => {
      return db.list('test/args/ids', {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'hello=world'
      });
    })

    .then((error) => {
      error.status.should.equal(400);
      error.name.should.equal('bad_request');
      error.message.should.equal('invalid_json');
    });
  });
});
