const {setup, setupWithDoc, setupWithDocAndAttachment, teardown, should, shouldThrowError, onlyTestValidationDoc} = require('./utils');

describe('basic validation tests', () => {
  let db;

  beforeEach(() => {
    db = setup();
    return db.put(onlyTestValidationDoc);
  });

  afterEach(teardown);

  it('should allow put', () => {
    return db.validatingPut({_id: 'test'})

    .then((doc) => {
      doc.ok.should.be.ok;
    });
  });
  it('should allow post', () => {
    return db.validatingPost({_id: 'test'})

    .then((doc) => {
      doc.ok.should.be.ok;
    });
  });
  it('should allow remove', () => {
    return db.put({_id: 'test'})

    .then((info) => {
      return db.validatingRemove({
        _id: 'test',
        _rev: info.rev
      });
    })

    .then((rmInfo) => {
      rmInfo.ok.should.be.ok;
    });
  });
  it('should allow bulkDocs', () => {
    return db.validatingBulkDocs([
      {
        _id: 'test'
      }
    ])

    .then((resp) => {
      resp[0].should.be.ok;
    });
  });
  it('should allow putAttachment', (cb) => {
    function getCb(resp) {
      resp.toString('ascii').should.equal('Hello world!');
      cb();
    }
    function putCb(err, resp) {
      resp.ok.should.be.ok;
      db.getAttachment('test', 'test').then(getCb);
    }
    const blob = new Buffer('Hello world!', 'ascii');
    db.validatingPutAttachment('test', 'test', blob, "text/plain", putCb);
  });
  it('should fail', () => {
    //setup - put an attachment
    const blob = new Buffer('Hello world!', 'ascii');
    return db.putAttachment('mytest', 'test', blob, 'text/plain')

    .then((resp) => {
      return shouldThrowError(() => {
        return db.validatingRemoveAttachment('mytest', 'test', resp.rev);
      });
    })

    .then((error) => {
      error.status.should.equal(403);
      error.name.should.equal('forbidden');
    });
  });
});

describe('unauthorized validation tests', () => {
  let db;
  let rev;

  beforeEach(() => {
    return setupWithDoc()

    .then((data) => {
      db = data.db;
      rev = data.rev;

      return db.put({
        _id: '_design/test',
        validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
          if (newDoc._id !== 'test') {
            throw({unauthorized: 'only a document named "test" is allowed.'});
          }
        }`
      });
    });
  });
  afterEach(teardown);

  function checkError(err) {
    err.name.should.equal('unauthorized');
    err.message.should.equal('only a document named "test" is allowed.');
  }

  it('should fail an invalid put', () => {
    return shouldThrowError(() => {
      return db.validatingPut({_id: 'test_invalid'});
    })

    .then(checkError);
  });
  it('should fail an invalid post', () => {
    return shouldThrowError(() => {
      return db.validatingPost({});
    })

    .then(checkError);
  });
  it('should fail an invalid remove', () => {
    return shouldThrowError(() => {
      return db.validatingPost({
        _id: 'mytest',
        _rev: rev
      });
    })

    .then(checkError);
  });
  it('should fail an invalid bulkDocs', () => {
    // Also tests validatingBulkDocs with docs: [] property (which is
    // deprecated, but still supported).
    return db.validatingBulkDocs({
      docs: [
        {
          _id: 'test_invalid'
        }
      ]
    })

    .then((resp) => {
      checkError(resp[0]);
    });
  });
});

describe('forbidden validation tests', () => {
  let db;
  let rev;

  beforeEach(() => {
    return setupWithDoc()

    .then((data) => {
      db = data.db;
      rev = data.rev;

      return db.put(onlyTestValidationDoc);
    });
  });
  afterEach(teardown);

  function checkError(err) {
    err.name.should.equal('forbidden');
    err.message.should.equal("only a document named 'test' is allowed.");
  }

  it('should fail an invalid put', () => {
    return shouldThrowError(() => {
      return db.validatingPut({_id: 'test_invalid'});
    })

    .then(checkError);
  });
  it('should fail an invalid post', () => {
    return shouldThrowError(() => {
      return db.validatingPost({});
    })

    .then(checkError);
  });
  it('should fail an invalid remove', () => {
    return shouldThrowError(() => {
      return db.validatingRemove({_id: 'mytest', _rev: rev});
    })

    .then(checkError);
  });
  it('should fail an invalid bulk docs', () => {
    return db.validatingBulkDocs([
      {
        _id: 'test_invalid'
      },
      {}
    ])

    .then((resp) => {
      checkError(resp[0]);
      checkError(resp[1]);
    });
  });
  it('should never fail a design doc', () => {
    // A design doc is always valid, so no matter the validate_doc_update
    // function, the stuff below should succeed.
    return db.validatingPut({
      _id: '_design/mytest'
    })

    .then((resp) => {
      resp.ok.should.be.ok;
    });
  });
  it('should never fail a local doc', () => {
    // A local doc is always valid, so no matter the validate_doc_update
    // function, the stuff below should succeed.
    return db.validatingPut({
      _id: '_local/mytest'
    });
  });
});

describe('compilation error validation tests', () => {
  let db;

  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  function checkError(err) {
    err.name.should.equal('compilation_error');
    err.message.should.contain('Expression does not eval to a function.');
  }

  it('should fail syntax error', () => {
    return db.put({
      "_id": "_design/test",
      "validate_doc_update": `function (newDoc, oldDoc, userCtx, secObj) {
        return;
      }324j3lkl;`
    })

    .then(() => {
      return shouldThrowError(() => {
        return db.validatingPut({_id: 'test'});
      });
    })

    .then(checkError);
  });

  it('should fail a non-function', () => {
    return db.put({
      _id: '_design/test',
      validate_doc_update: "'a string instead of a function'"
    })

    .then(() => {
      return shouldThrowError(() => {
        return db.validatingPut({_id: 'test'});
      });
    })

    .then(checkError);
  });
});

describe('exception validation tests', () => {
  let db;
  beforeEach(() => {
    db = setup();

    return db.put({
      _id: '_design/test',
      validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
        //reference error
        test;
      }`
    });
  });
  afterEach(teardown);

  it('should fail for put()', () => {
    return shouldThrowError(() => {
      return db.validatingPut({_id: 'test'});
    })

    .then((err) => {
      err.name.should.equal('ReferenceError');
      //'test' is the name of the missing variable.
      err.message.should.contain('test');
    });
  });
});

describe('attachment validation tests', () => {
  let db;
  let rev;
  const forbiddenDesignDoc = {
    _id: '_design/test',
    validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
      throw({forbidden: JSON.stringify(newDoc)});
    }`
  };

  beforeEach(() => {
    return setupWithDocAndAttachment()

    .then((info) => {
      db = info.db;
      rev = info.attRev;
    });
  });
  afterEach(teardown);

  it('should succesfully remove an attachment', () => {
    return db.validatingRemoveAttachment('attachment_test', 'text', rev);
  });
  it('shouldn’t remove the attachment when forbidden', () => {
    return db.put(forbiddenDesignDoc)

    .then(() => {
      return shouldThrowError(() => {
        return db.validatingRemoveAttachment('attachment_test', 'text', rev);
      });
    })

    .then((err) => {
      err.name.should.equal('forbidden');
      // checks if the newDoc argument is filled in correctly
      err.message.should.contain('"_attachments":{}');
    });
  });
  it('should succesfully put an attachment', () => {
    return db.validatingPutAttachment('attachment_test2', 'text', new Buffer('tést', 'UTF-8'), 'text/plain');
  });
  it("shouldn't put an attachment when forbidden", () => {
    return db.put(forbiddenDesignDoc)

    .then(() => {
      return shouldThrowError(() => {
        return db.validatingPutAttachment('attachment_test2', 'text', new Buffer('tést', 'UTF-8'), 'text/plain');
      });
    })

    .then((err) => {
      err.name.should.equal('forbidden');
      // checks if the newDoc argument is filled in correctly
      err.message.should.contain('text/plain');
    });
  });
});

describe('validation args tests', () => {
  let db;
  let rev;

  beforeEach(() => {
    return setupWithDoc()

    .then((info) => {
      db = info.db;
      rev = info.rev;

      return db.put({
        _id: '_design/test',
        validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
          throw({forbidden: JSON.stringify({
            newDoc: newDoc,
            oldDoc: oldDoc,
            userCtx: userCtx,
            secObj: secObj
          })});
        }`
      });
    });
  });
  afterEach(teardown);

  it.skip('should have the right args with a new doc', () => {
    const doc = {_id: 'test'};

    return shouldThrowError(() => {
      return db.validatingPut(doc);
    })

    .then((err) => {
      const i = JSON.parse(err.message);
      i.newDoc.should.eql(doc);
      should.not.exist(i.oldDoc);

      i.userCtx.should.eql({
        db: 'test',
        name: null,
        roles: ['_admin']
      });
      i.secObj.should.eql({});
    });
  });
  it('should have the right args with an existing doc', () => {
    const doc = {_id: 'mytest', _rev: rev};

    return shouldThrowError(() => {
      return db.validatingPut(doc);
    })

    .then((err) => {
      const i = JSON.parse(err.message);
      i.oldDoc.test.should.be.ok;
      i.oldDoc._revisions.should.have.property('ids');
      i.newDoc._revisions.should.have.property('ids');
    });
  });
  it('should support changing the userCtx', () => {
    const theUserCtx = {
      db: 'test',
      name: 'pypouchtest',
      roles: ['the_boss']
    };

    return shouldThrowError(() => {
      return db.validatingPost({}, {userCtx: theUserCtx});
    })

    .then((err) => {
      const i = JSON.parse(err.message);
      i.userCtx.should.eql(theUserCtx);
    });
  });
  it('should support changing the security object', () => {
    const theSecObj = {
      admins: {
        names: ['the_boss'],
        roles: []
      },
      members: {
        names: [],
        roles: []
      }
    };

    return shouldThrowError(() => {
      return db.validatingPost({}, {secObj: theSecObj});
    })

    .then((err) => {
      const i = JSON.parse(err.message);
      i.secObj.should.eql(theSecObj);
    });
  });
});

describe('install validation methods tests', () => {
  let db;

  beforeEach(() => {
    db = setup();
    return db.put(onlyTestValidationDoc);
  });
  afterEach(teardown);

  it('basics should work', () => {
    db.installValidationMethods();

    return shouldThrowError(() => {
      return db.put({_id: 'mytest'});
    })

    .then((err) => {
      err.status.should.equal(403);

      db.uninstallValidationMethods();

      return db.put({_id: 'mytest'});
    })

    .then((resp) => {
      resp.ok.should.be.ok;
    });
  });
  it('should fail when installing twice', () => {
    db.installValidationMethods();
    return shouldThrowError(() => {
      return db.installValidationMethods();
    })

    .then((err) => {
      err.name.should.equal('already_installed');
    });
  });
  it('should fail uninstalling when not installed', () => {
    return shouldThrowError(() => {
      return db.uninstallValidationMethods();
    })

    .then((err) => {
      err.name.should.equal('already_not_installed');
    });
  });
  it('should support reinstalling methods', () => {
    for (let i = 0; i < 2; i++) {
      db.installValidationMethods();
      db.uninstallValidationMethods();
    }
  });
});
