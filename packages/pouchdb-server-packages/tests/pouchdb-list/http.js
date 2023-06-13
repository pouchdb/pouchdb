const {setupHTTP, teardown, listDocument, shouldThrowError, should} = require('./utils');

let db;

describe('http', () => {
  beforeEach(() => {
    db = setupHTTP();
    return db.put(listDocument);
  });
  afterEach(teardown);

  it('list basics', () => {
    return db.list('test/args/ids', {query: {a: 'b'}})

    .then((resp) => {
      const [head, req] = JSON.parse(resp.body).args;
      head.offset.should.equal(0);
      head.total_rows.should.equal(0);

      should.equal(req.id, null);
      req.raw_path.should.equal('/pouchdb-plugin-helper-db/_design/test/_list/args/ids?a=b');
      req.requested_path.should.eql(['pouchdb-plugin-helper-db', '_design', 'test', '_list', 'args', 'ids?a=b']);
      req.path.should.eql(['pouchdb-plugin-helper-db', '_design', 'test', '_list', 'args', 'ids']);
      // and one at random, to check if the rest (shared with show) is still ok.
      req.peer.should.equal('127.0.0.1');
    });
  });

  it('wrong list content type', () => {
    // CouchDB only supports application/json here. It's a CouchDB restriction:
    // this check is here in case it ever changes. - then  PouchDB-List's
    // simulation of it can stop.

    shouldThrowError(() => {
      return db.list('test/args/ids', {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body:'value=hello'
      });
    })

    .then((error) => {
      error.status.should.equal(400);
      error.name.should.equal('bad_request');
      error.message.should.equal('invalid_json');
    });
  });
});
