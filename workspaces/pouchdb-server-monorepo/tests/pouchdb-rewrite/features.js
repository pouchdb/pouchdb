const {setup, rewriteDocument, teardown, shouldThrowError, checkUuid} = require('./utils');

let db;

describe('Async rewrite tests', () => {
  beforeEach(done => {
    db = setup();
    db.put(rewriteDocument, done);
  });
  afterEach(teardown);

  it('basic url', done => {
    db.rewriteResultRequestObject('test/test/all', {query: {'k': 'v'}}, (err, req) => {
      req.raw_path.should.equal('/test/_design/test/_list/test/ids?k=v');
      done(err);
    });
  });

  it('basic response', done => {
    db.rewrite('test/test/all', err => {
      err.status.should.equal(404);
      err.name.should.equal('not_found');
      err.message.should.contain('view named ids');

      done();
    });
  });
});

describe('sync rewrite tests', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  function putRewrites(rewrites) {
    return db.put({
      _id: '_design/test',
      rewrites: rewrites
    });
  }

  it('empty from rewrite', () => {
    return putRewrites([
      {
        to: '_show/redirect',
        from: ''
      },
      {
        to: '_show/page/*',
        from: '/page/*'
      }
    ])

    .then(() => {
      return db.rewriteResultRequestObject('test/page/index');
    })

    .then(({path}) => {
      path.should.eql(['test', '_design', 'test', '_show', 'page', 'index']);
    });
  });

  it('missing from rewrite', () => {
    return putRewrites([
       {
         to: '1234mytest'
       }
    ])

    .then(() => {
      return db.rewriteResultRequestObject('test/abc');
    })

    .then(({path}) => {
      path.should.eql(['test', '_design', 'test', '1234mytest']);

      return shouldThrowError(() => {
        return db.rewrite('test');
      });
    })

    .then((error) => {
      error.status.should.equal(404);
    });
  });

  it('high up path', () => {
    return putRewrites([{
      from: '/highup',
      // should be sufficiently high up.
      to: '../../../../../..'
    }])

    .then(() => {
      return shouldThrowError(() => {
        return db.rewrite('test/highup');
      });
    })

    .then((error) => {
      error.status.should.equal(404);
      error.message.should.equal('missing');
    });
  });

  it('bad path', () => {
    return putRewrites([{from: '/badpath', to: '../../a/b/c'}])

    .then(() => {
      return shouldThrowError(() => {
        return db.rewrite('test/badpath');
      });
    })

    .then((error) => {
      error.status.should.equal(404);
    });
  });

  it('attachment rewrite', () => {
    return putRewrites([{from: '/attachment', to: '/attachment'}])

    .then((ddocResp) => {
      return db.rewrite('test/attachment/', {
        method: 'PUT',
        withValidation: true,
        body: new Buffer('Hello World', 'ascii'),
        headers: {'Content-Type': 'text/plain'},
        query: {rev: ddocResp.rev}
      });
    })

    .then((response) => {
      response.ok.should.be.ok;

      return db.rewrite('test/attachment', {
        method: 'DELETE',
        withValidation: false,
        query: {rev: response.rev}
      });
    })

    .then((response2) => {
      response2.ok.should.be.ok;

      return shouldThrowError(() => {
        return db.rewrite('test/attachment', {
          method: 'POST',
          // not sure if it would be required. Playing safe here.
          // Not that it should ever reach the rev check.
          query: {rev: response2.rev}
        });
      });
    })

    .then((error) => {
      error.status.should.equal(405);
      error.name.should.equal('method_not_allowed');
      error.message.should.contain('POST');
    });
  });

  it('local doc rewrite', () => {
    return putRewrites([{from: '/doc', to: '.././../_local/test'}])

    .then(() => {
      return db.rewrite('test/doc', {
        method: 'PUT',
        body: '{"_id": "test"}',
        withValidation: true
      });
    })

    .then((response) => {
      response.ok.should.be.ok;
    });
  });

  it('all dbs rewrite', () => {
    return putRewrites([{from: '/alldbs', to: '../../../_all_dbs'}])

    .then(() => {
      return db.rewrite('test/alldbs');
    })

    .then((response) => {
      response.should.be.instanceof(Array);

      return db.rewriteResultRequestObject('test/alldbs');
    })

    .then((response2) => {
      response2.path.should.eql(['_all_dbs']);
    });
  });

  it('post doc rewrite', () => {
    return putRewrites([{from: 'postdoc', to: '../../', method: 'POST'}])

    .then(() => {
      return db.rewrite('test/postdoc', {body:'{}', method:'POST'});
    })

    .then((response) => {
      checkUuid(response.id);
      response.rev.indexOf('1-').should.equal(0);
      response.ok.should.be.ok;

      return db.rewrite('test/postdoc', {body:'{}', method:'POST', withValidation: true});
    })

    .then((response2) => {
      checkUuid(response2.id);
      response2.rev.indexOf('1-').should.equal(0);
      response2.ok.should.be.ok;
    });
  });

  it('post doc using double rewrite', () => {
    return putRewrites([
      {from: 'rewrite1', to: '_rewrite/rewrite2'},
      // POST to an existing doc -> 405
      {from: 'rewrite2', to: '../../test', method: 'POST'}
    ])

    .then(() => {
      return shouldThrowError(() => {
        return db.rewrite('test/rewrite1', {body: '{}'});
      });
    })

    .then((error) => {
      error.status.should.equal(405);
    });
  });

  it('session rewrite', () => {
    return putRewrites([{from: 'session', to: '../../../_session'}])

    .then(() => {
      return shouldThrowError(() => {
        return db.rewrite('test/session', {
          body: 'username=test&password=test',
          method: 'POST'
        });
      });
    })

    .then((error) => {
      error.status.should.equal(401);

      return shouldThrowError(() => {
        return db.rewrite('test/session', {method: 'PUT'});
      });
    })

    .then((error2) => {
      error2.status.should.equal(405);
    });
  });

  it('security rewrite', () => {
    return putRewrites([{from: 'security', to: '../../_security'}])

    .then(() => {
      return db.rewrite('test/security');
    })

    .then((response) => {
      response.should.eql({});

      return shouldThrowError(() => {
        return db.rewrite('test/security', {method: 'DELETE'});
      });
    })

    .then((err) => {
      err.status.should.equal(405);
    });
  });

  it('replicate rewrite', () => {
    return putRewrites([{from: 'replicate', to: '../../../_replicate'}])

    .then(() => {
      return db.rewrite('test/replicate', {
        body: '{"source": "a", "target": "b"}'
      });
    })

    .then((response) => {
      response.ok.should.be.ok;
      response.status.should.equal('complete');
    });
  });
});

describe('sync CouchDB based rewrite tests', () => {
  /*
    Based on CouchDB's rewrite test suite: rewrite.js. Not every test
    has yet been ported, but a large amount has been.

    Original test source:
    https://github.com/apache/couchdb/blob/master/test/javascript/tests/rewrite.js
  */

  before(() => {
    db = setup();
    const designDoc = {
      _id: '_design/test',
      language: 'javascript',
      _attachments: {
        'foo.txt': {
          content_type: 'text/plain',
          data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ='
        }
      },
      rewrites: [
        {
          from: 'foo',
          to: 'foo.txt'
        },
        {
          from: 'foo2',
          to: 'foo.txt',
          method: 'GET'
        },
        {
          from: 'hello/:id',
          to: '_update/hello/:id',
          method: 'PUT'
        },
        {
          from: '/welcome',
          to: '_show/welcome'
        },
        {
          from: '/welcome/:name',
          to: '_show/welcome',
          query: {
            name: ':name'
          }
        },
        {
          from: '/welcome2',
          to: '_show/welcome',
          query: {
            name: 'user'
          }
        },
        {
          from: '/welcome3/:name',
          to: '_update/welcome2/:name',
          method: 'PUT'
        },
        {
          from: '/welcome3/:name',
          to: '_show/welcome2/:name',
          method: 'GET'
        },
        {
          from: '/welcome4/*',
          to : '_show/welcome3',
          query: {
            name: '*'
          }
        },
        {
          from: '/welcome5/*',
          to : '_show/*',
          query: {
            name: '*'
          }
        },
        {
          from: 'basicView',
          to: '_view/basicView'
        },
        {
          from: 'simpleForm/basicView',
          to: '_list/simpleForm/basicView'
        },
        {
          from: 'simpleForm/basicViewFixed',
          to: '_list/simpleForm/basicView',
          query: {
            startkey: 3,
            endkey: 8
          }
        },
        {
          from: 'simpleForm/basicViewPath/:start/:end',
          to: '_list/simpleForm/basicView',
          query: {
            startkey: ':start',
            endkey: ':end'
          },
          formats: {
            start: 'int',
            end: 'int'
          }
        },
        {
          from: 'simpleForm/complexView',
          to: '_list/simpleForm/complexView',
          query: {
            key: [1, 2]
          }
        },
        {
          from: 'simpleForm/complexView2',
          to: '_list/simpleForm/complexView',
          query: {
            key: ['test', {}]
          }
        },
        {
          from: 'simpleForm/complexView3',
          to: '_list/simpleForm/complexView',
          query: {
            key: ['test', ['test', 'essai']]
          }
        },
        {
          from: 'simpleForm/complexView4',
          to: '_list/simpleForm/complexView2',
          query: {
            key: {'c': 1}
          }
        },
        {
          from: 'simpleForm/complexView5/:a/:b',
          to: '_list/simpleForm/complexView3',
          query: {
            key: [':a', ':b']
          }
        },
        {
          from: 'simpleForm/complexView6',
          to: '_list/simpleForm/complexView3',
          query: {
            key: [':a', ':b']
          }
        },
        {
          from: 'simpleForm/complexView7/:a/:b',
          to: '_view/complexView3',
          query: {
            key: [':a', ':b'],
            include_docs: ':doc'
          },
          format: {
            doc: 'bool'
          }
        },
        {
          from: '/',
          to: '_view/basicView'
        },
        {
          from: '/db/*',
          to: '../../*'
        }
      ],
      lists: {
        simpleForm: `function(head, req) {
          log('simpleForm');
          send('<ul>');
          var row, row_number = 0, prevKey, firstKey = null;
          while (row = getRow()) {
            row_number += 1;
            if (!firstKey) firstKey = row.key;
            prevKey = row.key;
            send('\\n<li>Key: '+row.key
                 +' Value: '+row.value
                 +' LineNo: '+row_number+'</li>');
          }
          return '</ul><p>FirstKey: '+ firstKey + ' LastKey: '+ prevKey+'</p>';
        }`
      },
      shows: {
        welcome: `function(doc,req) {
          return 'Welcome ' + req.query['name'];
        }`,
        welcome2: `function(doc, req) {
          return 'Welcome ' + doc.name;
        }`,
        welcome3: `function(doc,req) {
          return 'Welcome ' + req.query['name'];
        }`
      },
      updates: {
        hello: `function(doc, req) {
          if (!doc) {
            if (req.id) {
              return [{
                _id : req.id
              }, 'New World']
            }
            return [null, 'Empty World'];
          }
          doc.world = 'hello';
          doc.edited_by = req.userCtx;
          return [doc, 'hello doc'];
        }`,
        welcome2: `function(doc, req) {
          if (!doc) {
            if (req.id) {
              return [{
                _id: req.id,
                name: req.id
              }, 'New World']
            }
            return [null, 'Empty World'];
          }
          return [doc, 'hello doc'];
        }`
      },
      views: {
        basicView: {
          map: `function(doc) {
            if (doc.integer) {
              emit(doc.integer, doc.string);
            }

          }`
        },
        complexView: {
          map: `function(doc) {
            if (doc.type == 'complex') {
              emit([doc.a, doc.b], doc.string);
            }
          }`
        },
        complexView2: {
          map: `function(doc) {
            if (doc.type == 'complex') {
              emit(doc.a, doc.string);
            }
          }`
        },
        complexView3: {
          map: `function(doc) {
            if (doc.type == 'complex') {
              emit(doc.b, doc.string);
            }
          }`
        }
      }
    };

    function makeDocs(start, end) {
      const docs = [];
      for (let i = start; i < end; i++) {
        docs.push({
          _id: i.toString(),
          integer: i,
          string: i.toString()
        });
      }
      return docs;
    }

    const docs1 = makeDocs(0, 10);
    const docs2 = [
      {a: 1, b: 1, string: 'doc 1', type: 'complex'},
      {a: 1, b: 2, string: 'doc 2', type: 'complex'},
      {a: 'test', b: {}, string: 'doc 3', type: 'complex'},
      {a: 'test', b: ['test', 'essai'], string: 'doc 4', type: 'complex'},
      {a: {'c': 1}, b: '', string: 'doc 5', type: 'complex'}
    ];

    return db.bulkDocs([designDoc].concat(docs1).concat(docs2));
  });
  after(teardown);

  it('simple rewriting', () => {
    // GET is the default http method
    return db.rewrite('test/foo')

    .then((response) => {
      response.toString('ascii').should.equal('This is a base64 encoded text');
      response.type.should.equal('text/plain');

      return db.rewrite('test/foo2');
    })

    .then((response2) => {
      response2.toString('ascii').should.equal('This is a base64 encoded text');
      response2.type.should.equal('text/plain');
    });
  });

  it('basic update', () => {
    // hello update world
    const doc = {word: 'plankton', name: 'Rusty'};
    let docid;

    return db.post(doc)

    .then((response) => {
      response.ok.should.be.ok;
      docid = response.id;

      return db.rewrite('test/hello/' + docid, {method: 'PUT'});
    })

    .then((response2) => {
      response2.code.should.equal(201);
      response2.body.should.equal('hello doc');
      response2.headers['Content-Type'].should.contain('charset=utf-8');

      return db.get(docid);
    })

    .then((doc2) => {
      doc2.world.should.equal('hello');
    });
  });

  it('basic show', () => {
    return db.rewrite('test/welcome', {query: {name: 'user'}})

    .then((response) => {
      response.body.should.equal('Welcome user');

      return db.rewrite('test/welcome/user');
    })

    .then((response2) => {
      response2.body.should.equal('Welcome user');

      return db.rewrite('test/welcome2');
    })

    .then((resp3) => {
      resp3.body.should.equal('Welcome user');
    });
  });

  it('welcome3/test', () => {
    return db.rewrite('test/welcome3/test', {method: 'PUT'})

    .then((response) => {
      response.code.should.equal(201);
      response.body.should.equal('New World');
      response.headers['Content-Type'].should.contain('charset=utf-8');

      return db.rewrite('test/welcome3/test');
    })

    .then((response2) => {
      response2.body.should.equal('Welcome test');
    });
  });

  it('welcome4/user', () => {
    return db.rewrite('test/welcome4/user')

    .then((response) => {
      response.body.should.equal('Welcome user');
    });
  });

  it('welcome5/welcome3', () => {
    return db.rewrite('test/welcome5/welcome3')

    .then((response) => {
      response.body.should.equal('Welcome welcome3');
    });
  });

  it('basic view', () => {
    return db.rewrite('test/basicView')

    .then((response) => {
      response.total_rows.should.equal(9);
    });
  });

  it('root rewrite', () => {
    return db.rewrite('test/')

    .then((response) => {
      response.total_rows.should.equal(9);
    });
  });

  it('simple form basic view', () => {
    return db.rewrite('test/simpleForm/basicView', {
      query: {startkey: 3, endkey: 8}
    })

    .then((response) => {
      response.code.should.equal(200);
      response.body.should.not.contain('Key: 1');
      response.body.should.contain('FirstKey: 3');
      response.body.should.contain('LastKey: 8');
    });
  });

  it('simple form basic view fixed', () => {
    return db.rewrite('test/simpleForm/basicViewFixed')

    .then((response) => {
      response.code.should.equal(200);
      response.body.should.not.contain('Key: 1');
      response.body.should.contain('FirstKey: 3');
      response.body.should.contain('LastKey: 8');
    });
  });

  it('simple form basic view fixed different query', () => {
    return db.rewrite('test/simpleForm/basicViewFixed', {
      query: {startkey: 4}
    })

    .then((response) => {
      response.code.should.equal(200);
      response.body.should.not.contain('Key: 1');
      response.body.should.contain('FirstKey: 3');
      response.body.should.contain('LastKey: 8');
    });
  });

  it('simple view basic view path', () => {
    return db.rewrite('test/simpleForm/basicViewPath/3/8')

    .then((response) => {
      response.body.should.not.contain('Key: 1');
      response.body.should.contain('FirstKey: 3');
      response.body.should.contain('LastKey: 8');
    });
  });

  it('simple form complex view', () => {
    return db.rewrite('test/simpleForm/complexView')

    .then((response) => {
      response.code.should.equal(200);
      /FirstKey: [1, 2]/.test(response.body).should.be.ok;
    });
  });

  it('simple form complex view 2', () => {
    return db.rewrite('test/simpleForm/complexView2')

    .then((response) => {
      response.code.should.equal(200);
      response.body.should.contain('Value: doc 3');
    });
  });

  it('simple form complex view 3', () => {
    return db.rewrite('test/simpleForm/complexView3')

    .then((response) => {
      response.code.should.equal(200);
      response.body.should.contain('Value: doc 4');
    });
  });

  it('simple form complex view 4', () => {
    return db.rewrite('test/simpleForm/complexView4')

    .then((response) => {
      response.code.should.equal(200);
      response.body.should.contain('Value: doc 5');
    });
  });

  it('simple form complex view 5 with args', () => {
    return db.rewrite('test/simpleForm/complexView5/test/essai')

    .then((response) => {
      response.code.should.equal(200);
      response.body.should.contain('Value: doc 4');
    });
  });

  it('complex view 6 with query', () => {
    return db.rewrite('test/simpleForm/complexView6',{
      query: {a: 'test', b: 'essai'}
    })

    .then((response) => {
      response.code.should.equal(200);
      response.body.should.contain('Value: doc 4');
    });
  });

  it('simple form complex view 7 with args and query', () => {
    return db.rewrite('test/simpleForm/complexView7/test/essai', {
      query: {doc: true}
    })

    .then((response) => {
      response.rows[0].doc.should.be.an('object');
    });
  });

  it('db with args', () => {
    // The original test suite uses the 'meta' query parameter which PouchDB
    // doesn't implement. revs_info could just be dropped in without further
    // changes, though.
    return db.rewrite('test/db/_design/test', {query: {revs_info: true}})

    .then((response) => {
      response._id.should.equal('_design/test');
      response._revs_info.should.be.instanceof(Array);
    });
  });
});

describe('sync rewrite tests with invalid design doc', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  it('empty design doc', () => {
    return db.put({_id: '_design/test'})

    .then(() => {
      return shouldThrowError(() => {
        return db.rewrite('test/test/all');
      });
    })

    .then((error) => {
      error.status.should.equal(404);
      error.name.should.equal('rewrite_error');
      error.message.should.equal('Invalid path.');
    });
  });

  it('invalid rewrites', () => {
    return db.put({_id: '_design/test', rewrites: 'Hello World!'})

    .then(() => {
      return shouldThrowError(() => {
        return db.rewrite('test/test/all');
      });
    })

    .then((error) => {
      error.status.should.equal(400);
      error.name.should.equal('rewrite_error');
    });
  });

  it('missing to', () => {
    return db.put({_id: '_design/test', rewrites: [
      {from: '*'}
    ]})

    .then(() => {
      return shouldThrowError(() => {
        return db.rewrite('test/test/all');
      });
    })

    .then((error) => {
      error.status.should.equal(500);
      error.name.should.equal('error');
      error.message.should.equal('invalid_rewrite_target');
    });
  });

  it('empty rewrites', () => {
    return db.put({_id: '_design/test', rewrites: []})

    .then(() => {
      return shouldThrowError(() => {
        return db.rewrite('test/test/all');
      });
    })

    .then((error) => {
      error.status.should.equal(404);
      error.name.should.equal('not_found');
      error.message.should.equal('missing');
    });
  });
});
