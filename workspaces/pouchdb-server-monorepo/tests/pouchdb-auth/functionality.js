const {setup, teardown, should, shouldThrowError} = require('./utils');
const extend = require('extend');

let db;

function shouldBeAdminParty(session) {
  session.info.should.eql({
    "authentication_handlers": ["api"],
    "authentication_db": "test"
  });
  session.userCtx.should.eql({
    "name": null,
    "roles": ["_admin"]
  });
  session.ok.should.be.ok;
}

function shouldNotBeLoggedIn(session) {
  session.info.should.eql({
    authentication_handlers: ["api"],
    authentication_db: "test"
  });
  session.userCtx.should.eql({
    name: null,
    roles: []
  });
  session.ok.should.be.ok;
}

function shouldBeSuccesfulLogIn(data, roles) {
  var copy = extend({}, data);
  // irrelevant
  delete copy.sessionID;
  copy.should.eql({
    "ok": true,
    "name": "username",
    "roles": roles
  });
}

function shouldBeLoggedIn(session, roles) {
  session.userCtx.should.eql({
    "name": "username",
    "roles": roles
  });
  session.info.authenticated.should.equal("api");
}

describe('SyncAuthTests', () => {
  beforeEach((done) => {
    db = setup();
    db.useAsAuthenticationDB({isOnlineAuthDB: false})

    .then(done);
  });
  afterEach(teardown);

  it('should test the daemon', () => {
    // handled by beforeEach and afterEach
  });

  it('should not allow stopping usage as an auth db twice', () => {
    let error;
    db.stopUsingAsAuthenticationDB();

    try {
      db.stopUsingAsAuthenticationDB();
    } catch (error_) {
      error = error_;
    }

    should.exist(error);
    error.message.should.match(/Not an authentication database/i);
  });

  it('should not allow using a db as an auth db twice', () => {
    let error;

    try {
      db.useAsAuthenticationDB();
    } catch (error_) {
      error = error_;
    }

    should.exist(error);
    error.message.should.match(/Already in use as an authentication database/i);
  });

  it('should have working db methods', () => {
    return db.signUp("username", "password", {roles: ["test"]})

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
      shouldBeAdminParty(session);

      return db.logIn("username", "password");
    })

    .then((logInData) => {
      shouldBeSuccesfulLogIn(logInData, ["test"]);

      return db.session();
    })

    .then((session2) => {
      shouldBeLoggedIn(session2, ["test"]);

      return db.multiUserSession();
    })

    .then((session3) => {
      shouldBeAdminParty(session3);

      return db.logOut();
    })

    .then((logOutData) => {
      logOutData.ok.should.be.ok;

      return db.session();
    })

    .then((session4) => {
      shouldBeAdminParty(session4);

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
    });
  });

  it('should support sign up without roles', () => {
    return db.signUp("username", "password")

    .then((result) => {
      result.ok.should.be.ok;

      return db.get("org.couchdb.user:username");
    })

    .then((resp2) => {
      resp2.roles.should.eql([]);
    });
  });

  it('should validate docs', () => {
    return shouldThrowError(() => db.post({}))

    .then((error) => {
      error.status.should.equal(403);

      return db.bulkDocs([{}]);
    })

    .then((resp) => {
      resp[0].status.should.equal(403);
    });
  });

  it('should handle conflicting logins', () => {
    const doc1 = {
      _id: "org.couchdb.user:test",
      _rev: "1-blabla",
      type: "user",
      name: "test",
      roles: []
    };
    const doc2 = extend({}, doc1);
    doc2._rev = "2-something";

    //generate conflict
    return db.bulkDocs([doc1, doc2], {new_edits: false})

    .then(() => {
      return shouldThrowError(() => db.logIn("test", "unimportant"));
    })

    .then((error) => {
      error.status.should.equal(401);
      error.name.should.equal("unauthorized");
      error.message.should.contain("conflict");
    });
  });

  it('should not accept invalid session ids', () => {
    shouldThrowError(() => db.multiUserSession('invalid-session-id'))

    .then((error) => {
      error.status.should.equal(400);
      error.name.should.equal('bad_request');
      error.message.should.contain('Malformed');
    });
  });

  it('should hash plain-text passwords in bulkDocs', () => {
    // https://github.com/pouchdb/express-pouchdb/issues/297
    db.bulkDocs({docs: [{
      _id: "org.couchdb.user:testuser",
      name:"testuser",
      password:"test",
      type:"user",
      roles:[]
    }]})

    .then((response) => {
      return db.get(response[0].id);
    })

    .then((doc) => {
      should.not.exist(doc.password);
    });
  });
});

describe('AsyncAuthTests', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);
  it('should suport the basics', (done) => {
    function cb(error) {
      db.stopUsingAsAuthenticationDB();
      done(error);
    }
    db.useAsAuthenticationDB(cb);
  });
});

describe('AsyncAuthTestsWithoutDaemon', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  it('should be impossible to use the various exposed methods', () => {
    should.not.exist(db.signUp);
    should.not.exist(db.session);
    should.not.exist(db.logIn);
    should.not.exist(db.logOut);
  });

  it('should hash admin passwords', () => {
    const admins = {
      test: "-pbkdf2-0abe2dcd23e0b6efc39004749e8d242ddefe46d1,16a1031881b31991f21a619112b1191fb1c41401be1f31d5,10",
      test2: "test"
    };

    return db.hashAdminPasswords(admins)

    .then((response) => {
      response.test.should.equal(admins.test);
      //10 is the default amount of iterations
      response.test2.indexOf("-pbkdf2-").should.equal(0);
      response.test2.lastIndexOf(",10").should.equal(response.test2.length - 3);
    });
  });

  it('should support changing admin passwords hash iterations', () => {
    return db.hashAdminPasswords({
      abc: "test"
    }, {iterations: 11})

    .then((response) => {
      response.abc.indexOf("-pbkdf2-").should.equal(0);
      response.abc.lastIndexOf(",11").should.equal(response.abc.length - 3);
    });
  });
});

describe('No automated test setup', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  it('should support admin logins', () => {
    const opts = {
      admins: {
        username: '-pbkdf2-37508a1f1c5c19f38779fbe029ae99ee32988293,885e6e9e9031e391d5ef12abbb6c6aef,10'
      },
      secret: db.generateSecret()
    };

    return db.useAsAuthenticationDB(opts)

    .then(() => {
      return db.multiUserSession();
    })

    .then((sessionData) => {
      shouldNotBeLoggedIn(sessionData);

      return db.multiUserLogIn('username', 'test');
    })

    .then((logInData) => {
      shouldBeSuccesfulLogIn(logInData, ['_admin']);

      db.stopUsingAsAuthenticationDB();
      return db.useAsAuthenticationDB({/* no admins */})

      .then(() => logInData.sessionID);
    })

    .then((sessionID) => {
      return db.multiUserSession(sessionID);
    })

    .then((sessionData) => {
      //if admins not supplied, there's no session (admin party!)
      shouldBeAdminParty(sessionData);

      db.stopUsingAsAuthenticationDB();
      return db.useAsAuthenticationDB(opts);
    })

    .then(() => {
      return db.multiUserLogIn('username', 'test');
    })

    .then((logInData) => {
      return db.multiUserSession(logInData.sessionID);
    })

    .then((sessionData) => {
      //otherwise there is
      shouldBeLoggedIn(sessionData, ["_admin"]);

      return db.multiUserSession();
    })

    .then((sessionData) => {
      //check if logout works (i.e. forgetting the session id.)
      shouldNotBeLoggedIn(sessionData);
    });
  });

  it('should handle invalid admins field on login', () => {
    const admins = {
      username: "-pbkdf2-37508a1f1c5c19f38779fbe029ae99ee32988293,885e6e9e9031e391d5ef12abbb6c6aef,10",
      username2: 'this-is-no-hash'
    };

    return db.useAsAuthenticationDB({admins: admins})

    .then(() => {
      return db.session();
    })

    .then((sessionData) => {
      shouldNotBeLoggedIn(sessionData);

      return shouldThrowError(() => db.logIn("username2", "test"));
    })

    .then((error) => {
      error.status.should.equal(401);

      return db.session();
    })

    .then((sessionData) => {
      shouldNotBeLoggedIn(sessionData);
    });
  });

  it('should not accept timed out sessions', () => {
    // example stolen from calculate-couchdb-session-id's test suite. That
    // session timed out quite a bit ago.

    return db.useAsAuthenticationDB({
      secret: '4ed13457964f05535fbb54c0e9f77a83',
      timeout: 3600,
      admins: {
        // password 'test'
        'jan': '-pbkdf2-2be978bc2be874f755d8899cfddad18ed78e3c09,d5513283df4f649c72757a91aa30bdde,10'
      }
    })

    .then(() => {
      const sessionID = 'amFuOjU2Njg4MkI5OkEK3-1SRseo6yNRHfk-mmk6zOxm';
      return db.multiUserSession(sessionID);
    })

    .then((sessionData) => {
      shouldNotBeLoggedIn(sessionData);
    });
  });

  it('should account for roles set in user doc even for server admins', () => {
    return db.useAsAuthenticationDB({
      admins: {
        username: '-pbkdf2-37508a1f1c5c19f38779fbe029ae99ee32988293,885e6e9e9031e391d5ef12abbb6c6aef,10'
      }
    })
      .then(() => db.logIn('username', 'test'))
      .then(() => db.session())
      .then((session) => {
        session.userCtx.name.should.equal('username');
        session.userCtx.roles.should.deep.equal(['_admin']);
      })
      .then(() => db.signUp('username', 'password', {roles: ['test']}))
      .then(() => db.session())
      .then((session) => {
        session.userCtx.name.should.equal('username');
        session.userCtx.roles.should.deep.equal(['_admin', 'test']);
      });
  });
});
