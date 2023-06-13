const {PouchDB, Security, setup, teardown} = require('./utils');

let db;

describe('Security tests', () => {

  beforeEach(() => {
    db = setup();
  });

  afterEach(teardown);

  it('get when unset', () => {
    return db.getSecurity()
    .then(resp => {
      resp.should.eql({});
    });
  });

  it('put', () => {
    const secObj = {members: {roles: 'test'}};
    return db.putSecurity(secObj)
    .then(resp => {
      resp.should.eql({ok: true});
      return db.getSecurity();
    })
    .then(resp => {
      resp.should.eql(secObj);
    });
  });
});

describe('Installed security tests', () => {
  const rightlessUser = {name: null, roles: []};
  const before = () =>  {
    db = setup();
    db.installSecurityMethods();
    return db.putSecurity({
      admins: {
        names: ['admin'],
        roles: ['admin']
      },
      members: {
        names: ['member'],
        roles: ['member']
      }
    });
  };

  beforeEach(before);

  afterEach(() => {
    db.uninstallSecurityMethods();
    return teardown();
  });

  it('basic', () => {
    // lets setUp() and tearDown() do all the work...
  });

  it('double install', () => {
    //1 install: setUp()
		//2 install:
    (()=> db.installSecurityMethods()).should.throw(Error);
  });

  it('double uninstall', () => {
    //1 remove:
		db.uninstallSecurityMethods();
		//2 remove:
		(() => db.uninstallSecurityMethods()).should.throw(Error);
		//recover for tearDown()
		db.installSecurityMethods();
  });

  it('all docs', () => {
    return db.allDocs({userCtx: {
			name: 'admin',
			roles: []
		}}).then(resp => {
      resp.total_rows.should.equal(0);
      return db.allDocs({userCtx: {
        'name': 'unknown',
        'roles': []
        }});
    }).catch(err => {
      err.status.should.equal(401);
      err.name.should.equal('unauthorized');
      err.message.should.equal('You are not authorized to access this db.');
    });
  });

  it('query', () => {
    const userCtx = {
			name: null,
			roles: ['member']
		};
    return db.query({map: null}, {userCtx: userCtx})
    .catch(err => {
      err.status.should.equal(401);
      return db.query('unexisting-view-func', {userCtx: userCtx});
    })
    .catch(err2 => {
      err2.status.should.equal(404);
    });
  });

  it('compact', () => {
    //member may not compact
    return db.compact({userCtx: {
      name: 'member',
      roles: []
		}})
    .catch(err => {
      err.status.should.equal(401);
      return db.compact({userCtx: {
        name: 'admin',
        roles: []
      }});
    })
    .then(resp => {
      resp.ok.should.be.ok;
      return db.compact();
    })
    .then(resp => {
      //admin may compact
      //server admin (admin party = default) may compact
      resp.ok.should.be.ok;
    });

  });

  it('doc modifications', () => {
    return db.post({}, {userCtx: rightlessUser})
    .catch(err => {
      err.status.should.equal(401);
      return db.post({});
    })
    .then(resp => {
      return db.put({}, resp.id, resp.rev);

    })
    .then(resp2 => {
      resp2.rev.indexOf('2-').should.equal(0);
      return db.remove(resp2.id, resp2.rev);
    })
    .then(resp => {
      resp.ok.should.be.ok;
      return db.bulkDocs([{}, {_id: '_design/test'}], {userCtx:{
        name: null,
        roles: ['a', 'member']
      }});
    })
    .then(resp3 => {
      let errorSeen = false;
      let successSeen = false;
      resp3.forEach(result => {
        if (result.status === 401) {
          errorSeen = true;
        }
        if ((result.rev || '').indexOf('1-') === 0) {
          successSeen = true;
        }
      });
      errorSeen.should.be.ok;
      successSeen.should.be.ok;
    });
  });

  it('post without login', () => {
    return db.putSecurity({})
    .then(resp => {
      resp.ok.should.be.ok;
      return db.post({}, {userCtx: rightlessUser});
    })
    .then(resp => {
      resp.ok.should.be.ok;
    });
  });

  it('revs diff', () => {
    return db.revsDiff({})
    .then(resp => {
      resp.should.eql({});
    });
  });

  it('attachment', () => {
    const buf = new Buffer('');
    let resp;
    return db.putAttachment('docId', 'attachmentId', buf, 'text/plain')
    .then(resp1 => {
      resp = resp1;
      resp.ok.should.be.ok;
      return db.getAttachment('docId', 'attachmentId');
    })
    .then(resp2 => {
      resp2.type.should.equal('text/plain');
      return db.putAttachment('docId', 'attachmentId', buf, 'text/plain', {userCtx: rightlessUser});
    })
    .catch(err => {
      err.status.should.equal(401);
      return db.removeAttachment(resp.id, 'attachmentId', resp.rev, {userCtx: rightlessUser});
    })
    .catch(err2 => {
      err2.status.should.equal(401);
    });
  });

  it('view cleanup', () => {
    return db.viewCleanup({userCtx: rightlessUser})
    .catch(err => {
      err.status.should.equal(401);
    });
  });

  it('get security', () => {
    return db.getSecurity({userCtx: {name: 'member', roles: []}})
    .then(resp => {
      resp.should.have.property('admins');
    });
  });

  it('replicate', () => {
    return db.replicate.to('testb')
    .then(resp => {
      resp.ok.should.be.ok;
    });
  });

  it('remove alternative signature', () => {
    return db.remove('id', 'rev', {userCtx: rightlessUser})
    .catch(err => {
      err.status.should.equal(401);
    });
  });

  it('show', () => {
    return db.show('some/non-existing/values', {secObj: {
      admins: {'names': ['unknown']}
    }, userCtx: {
      name: 'unknown',
      roles: []
    }})
    .catch(err => {
      err.status.should.equal(404); // not 401!
    });
  });

  it('destroy', () => {
    return db.destroy()
    .then(resp => {
      resp.ok.should.be.ok;
      return before();
    })
    .then(() => {
      return db.destroy({userCtx: rightlessUser});
    })
    .catch(err => {
      err.status.should.equal(401);
    });
  });

  it('changes', () => {
    const result = db.changes({live: true, userCtx: {
      name: 'marten',
      roles: ['member']
    }});
    result.on('change', () => {});
    result.cancel();
  });
});

describe('Static security methdods installed', () => {
  beforeEach(() => {
    Security.installStaticSecurityMethods(PouchDB);
  });
  afterEach(() => {
    Security.uninstallStaticSecurityMethods(PouchDB);
  });

  it('basic', () => {
    // beforeEach() and afterEach()
  });
  it('installing twice', () => {
    //1: beforeEach
    //2:
    (() => {
      Security.installStaticSecurityMethods(PouchDB);
    }).should.throw(/already installed/);
  });

  it('uninstalling twice', () => {
    Security.uninstallStaticSecurityMethods(PouchDB);
    (() => {
      Security.uninstallStaticSecurityMethods(PouchDB);
    }).should.throw(/not installed/);

    // for afterEach
    Security.installStaticSecurityMethods(PouchDB);
  });

  it('destroy', () => {
    new PouchDB('test');
    return PouchDB.destroy('test', {userCtx: {name: null, roles: []}})
    .catch(err => {
      err.status.should.equal(401);
      // admin paty - should be no problem
      return PouchDB.destroy({name: 'test'});
    })
    .then(resp => {
      resp.ok.should.be.ok;
    });

  });

  it('replicate', () => {
    const db = new PouchDB('a');
    return db.putSecurity({members: {names: ['hi!']}})
    .then(() => {
      return PouchDB.replicate(new PouchDB('a'), 'b', {userCtx: {name: null, roles: []}});
    })
    .catch(err => {
      err.status.should.equal(401);
      return PouchDB.replicate('a', 'b');
    })
    .then(resp => {
      // admin party - should be no problem
      resp.ok.should.be.ok;
    });
  });

  it('new() alternate signature', () => {
    return PouchDB.new({name: 'test', userCtx: {name: null, roles: []}})
    .catch(err => {
      err.status.should.equal(401);
    });
  });
});

describe('Async security tests', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  it('basic', done => {
    const secObj = {members: {roles: 'test'}};

    db.putSecurity(secObj, (err, resp) => {
      if (err) {
        return done(err);
      }
      resp.should.eql({ok: true});

      db.getSecurity((err, resp2) => {
        resp2.should.eql(secObj);
        done(err);
      });
    });
  });

  it('put attachment', done => {
    db.installSecurityMethods();

    db.putAttachment('docId', 'attachmentId', new Buffer(''), 'text/plain', {userCtx: {
      name: null,
      roles: []
    }}, (err, resp) => {
      resp.ok.should.be.ok;
      db.uninstallSecurityMethods();
      done(err);
    });
  });
});
