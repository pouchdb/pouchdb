const {waitUntilReady, cleanup, PouchDB, should, BASE_URL, HTTP_AUTH} = require('./utils');

const url = BASE_URL + '/_users';

describe('sync seamless auth tests without remote', () => {
  before(waitUntilReady);
  afterEach(cleanup);

  it('test', () => {
    return PouchDB.seamlessSignUp('username', 'password')
      .then((resp) => resp.ok.should.be.ok)
    .then(() => PouchDB.seamlessSession())
      .then((resp) => {
        resp.info.authentication_db.should.equal('_users');
        should.equal(resp.userCtx.name, null);
      })
    .then(() => PouchDB.seamlessLogIn('username', 'password'))
      .then((resp) => resp.name.should.equal('username'))
    .then(() => PouchDB.seamlessLogOut())
      .then((resp) => resp.ok.should.be.ok);
  });
});

describe('sync seamless auth tests with remote', () => {
  let remoteDB, localDB;
  before(waitUntilReady);
  beforeEach(() => {
    return PouchDB.setSeamlessAuthRemoteDB(url, {auth: HTTP_AUTH})
      .then(() => {
        remoteDB = new PouchDB(url, {auth: HTTP_AUTH});
        localDB = new PouchDB('_users');
      });
  });
  afterEach(() => {
    // local
    return cleanup()
      .then(() => {
        // remote
        PouchDB.unsetSeamlessAuthRemoteDB();
        return remoteDB.get('org.couchdb.user:username')
          .then((db) => remoteDB.remove(db))
          .catch(() => { /* already not there apparently */ });
      });
  });

  it('test', () => {
    return PouchDB.seamlessSignUp('username', 'password')
      .then((resp) => {
        resp.ok.should.be.ok;

        function localGet() {
          return localDB.get(resp.id)
            // document not yet replicated
            .catch(localGet);
        }

        return localGet()
          .then((doc) => {
            // check if online session
            return PouchDB.seamlessLogIn('username', 'password')
              .then((resp) => resp.name.should.equal('username'))

            .then(() => PouchDB.seamlessSession())
              .then((resp) => resp.info.authentication_handlers.should.contain('cookie'))

            // update the local document and check if replicated back
            .then(() => {
              doc.abc = 1;
              return localDB.put(doc);
            });
          })

          // triggers the replication
          .then(() => {
            PouchDB.invalidateSeamlessAuthCache();
            return PouchDB.seamlessSession();
          })

          .then(function remoteGet() {
            return remoteDB.get(resp.id)
              .catch(remoteGet);
          })

          // test caching code
          .then(() => PouchDB.seamlessSession())
          .then(() => PouchDB.seamlessSession())

          // log out
          .then(() => PouchDB.seamlessLogOut())
            .then((resp) => resp.ok.should.be.ok);
      });
  });
});

describe('async seamless auth tests', () => {
  before(waitUntilReady);
  afterEach(cleanup);

  it('set remote db', () => {
    return PouchDB.setSeamlessAuthRemoteDB(url, {auth: HTTP_AUTH})
      .then((resp) => {
        should.not.exist(resp);
        should.not.exist(PouchDB.unsetSeamlessAuthRemoteDB());
      });
  });
});
