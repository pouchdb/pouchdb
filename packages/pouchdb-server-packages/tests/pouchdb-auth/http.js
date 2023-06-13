const {BASE_URL, HTTP_AUTH, PouchDB, should, shouldThrowError} = require('./utils');

describe('SyncHTTPAuthTests', () => {
  it('should work with http dbs', () => {
    const db = new PouchDB(BASE_URL + "/_users", {auth: HTTP_AUTH});

    return db.useAsAuthenticationDB()

    .then((response) => {
      should.not.exist(response);

      return db.signUp("username", "password", {roles: ["test"]});
    })

    .then((signUpData) => {
      signUpData.rev.indexOf("1-").should.equal(0);
      signUpData.ok.should.be.ok;
      signUpData.id.should.equal("org.couchdb.user:username");

      return db.get("org.couchdb.user:username");
    })

    .then((doc) => {
      doc._rev.indexOf("1-").should.equal(0);
      doc.should.have.property("derived_key");
      doc.iterations.should.equal(10);
      doc.name.should.equal("username");
      doc.password_scheme.should.equal("pbkdf2");
      doc.roles.should.eql(["test"]);
      doc.should.have.property("salt");
      doc.type.should.equal("user");

      doc.should.not.have.property("password");

      return db.session();
    })

    .then((session) => {
      //basic auth active
      shouldBeAdmin(session);

      return db.logIn("username", "password");
    })

    .then((logInData) => {
      logInData.should.eql({
        ok: true,
        name: "username",
        roles: ["test"]
      });

      return db.session();
    })

    .then((session2) => {
      session2.userCtx.should.eql({
        name: "username",
        roles: ["test"]
      });
      session2.info.authenticated.should.equal("cookie");

      return db.logOut();
    })

    .then((logOutData) => {
      logOutData.ok.should.be.ok;

      return db.session();
    })

    .then((/*session3*/) => {
      // TODO: session is {name: "username",roles: ["test"]}, but shoudl be admin?
      // shouldBeAdmin(session3);

      return db.logOut();
    })

    .then((logOutData2) => {
      logOutData2.ok.should.be.ok;

      return shouldThrowError(() => db.logIn("username", "wrongPassword"));
    })

    .then((error) => {
      error.status.should.equal(401);
      error.name.should.equal("unauthorized");
      error.message.should.equal("Name or password is incorrect.");

      return db.get("org.couchdb.user:username");
    })

    .then((doc) => {
      return db.remove(doc);
    })

    .then((removeResponse) => {
      removeResponse.ok.should.be.ok;

      db.stopUsingAsAuthenticationDB();
    });
  });

  function shouldBeAdmin(session) {
    session.info.authentication_handlers.should.contain("cookie");
    session.info.authentication_db.should.equal("_users");
    session.userCtx.should.eql({
      name: (HTTP_AUTH || {}).username || null,
      roles: ["_admin"]
    });
    session.ok.should.be.ok;
  }
});
