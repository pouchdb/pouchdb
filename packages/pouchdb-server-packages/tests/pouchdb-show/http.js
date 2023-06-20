const {setupHTTP, teardown, showDocument, should, BASE_URL, checkUserAgent, checkUuid} = require('./utils');

let db;

describe('http', () => {
  beforeEach(() => {
    db = setupHTTP();
    return db.put(showDocument);
  });
  afterEach(teardown);

  it('show', () => {
    return db.show('test/args', {body: 'Hello World!', headers: {'Content-Type': 'text/plain'}})
      .then((resp) => {
        resp.code.should.equal(200);
        resp.headers['Content-Type'].should.equal('text/html; charset=utf-8');

        const [doc, req] = JSON.parse(resp.body).args;

        // test doc - well, the unavailability of it...
        should.equal(doc, null);

        // test request object
        req.body.should.equal('Hello World!');
        delete req.cookie['AuthSession']; // Ignore AuthSession
        req.cookie.should.eql({});
        req.form.should.eql({});

        BASE_URL.should.contain(req.headers.Host);
        req.headers.Accept.should.equal('*/*, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
        req.headers['Content-Type'].should.equal('text/plain');
        req.headers['Accept-Language'].should.contain('en');
        req.headers['Accept-Language'].should.contain('en-us');
        checkUserAgent(req.headers['User-Agent']);

        should.equal(req.id, null);
        req.info.db_name.should.equal('pouchdb-plugin-helper-db');
        req.info.should.have.property('update_seq');
        req.method.should.equal('POST');
        req.path.should.eql(['pouchdb-plugin-helper-db', '_design', 'test', '_show', 'args']);
        req.peer.should.equal('127.0.0.1');
        req.query.should.eql({});
        req.raw_path.should.equal('/pouchdb-plugin-helper-db/_design/test/_show/args');
        req.requested_path.should.eql(['pouchdb-plugin-helper-db', '_design', 'test', '_show', 'args']);
        req.secObj.should.eql({});
        req.userCtx.db.should.equal('pouchdb-plugin-helper-db');
        req.userCtx.should.have.property('name');
        checkUuid(req.uuid);
      });
  });
});
