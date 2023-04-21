"use strict";

/*globals before */

var buildApp = require('../../packages/node_modules/express-pouchdb'),
    PouchDB  = require('pouchdb'),
    express  = require('express'),
    request  = require('supertest'),
    Promise  = require('bluebird'),
    fse      = Promise.promisifyAll(require('fs-extra')),
    memdown  = require('memdown'),
    assert   = require('assert');

var TEST_DATA = __dirname + '/testdata/';
var LARGE_TIMEOUT = 5000;

var expressApp, expressApp2;

var customApp = buildApp(PouchDB.defaults({
  db: memdown,
  prefix: 'c'
}), {
  mode: 'custom',
  overrideMode: {
    include: ['routes/404']
  }
});

var coreApp = buildApp(PouchDB.defaults({
  db: memdown,
  prefix: 'd'
}), {
  mode: 'minimumForPouchDB',
  overrideMode: {
    include: ['routes/fauxton']
  }
});

var inMemoryConfigApp = buildApp(PouchDB.defaults({
  db: memdown,
  prefix: 'e'
}), {
  inMemoryConfig: true
});

before(function (done) {
  this.timeout(LARGE_TIMEOUT);
  cleanUp().then(function () {
    return fse.mkdirsAsync(TEST_DATA + 'a');
  }).then(function () {
    return fse.mkdirsAsync(TEST_DATA + 'b');
  }).then(function () {
    expressApp = buildApp(PouchDB.defaults({
      prefix: TEST_DATA + 'a/'
    }));
    expressApp2 = buildApp(PouchDB.defaults({
      prefix: TEST_DATA + 'b/',
    }), {
      configPath: TEST_DATA + 'b-config.json',
      logPath: TEST_DATA + 'b-log.txt'
    });
    done();
  }).catch(done);
});

after(function (done) {
  cleanUp().then(function () {
    done();
  }).catch(done);
});

function cleanUp() {
  return Promise.all([
    fse.removeAsync(TEST_DATA),
    fse.removeAsync('./config.json'),
    fse.removeAsync('./log.txt')
  ]);
}

describe('config', function () {
  it('should not create empty config file', function (done) {
    fse.exists('./config.json', function (exists) {
      if (exists) {
        return done(new Error("config.json should not have been created!"));
      }
      done();
    });
  });
  it('should support in memory config', function (done) {
    // make sure the file is written to disk.
    inMemoryConfigApp.couchConfig.set('demo', 'demo', true, function () {
      fse.exists('./config.json', function (exists) {
        if (exists) {
          return done(new Error("config.json exists!"));
        }
        done();
      });
    });
  });
  it('should have ./config.json as default config path', function (done) {
    expressApp.couchConfig.set('demo', 'demo', true, function () {
      fse.exists('./config.json', function (exists) {
        if (!exists) {
          return done(new Error("config.json doesn't exist!"));
        }
        done();
      });
    });
  });
  it('should support setting admins', function (done) {
    var cleanUpTest = function () {
      return fse.removeAsync(TEST_DATA + 'one-shot');
    };
    fse.mkdirsAsync(TEST_DATA + 'one-shot').then(function () {
      // Creates a single usage app.
      var oneShotExpressApp = buildApp(PouchDB.defaults({
        prefix: TEST_DATA + 'one-shot/',
      }), {
        configPath: TEST_DATA + 'one-shot/config.json',
        logPath: TEST_DATA + 'one-shot/log.txt'
      });
      // Set up an admin.
      return new Promise(function (resolve, reject) {
        oneShotExpressApp.couchConfig.set('admins', 'admin', 'pass', function (err) {
          if (err) { reject(err); }
          resolve();
        });
      });
    }).then(function () {
      // Read the config file.
      return fse.readFile(TEST_DATA + 'one-shot/config.json');
    }).then(function (data) {
      var config = JSON.parse(data.toString());
      if (!config.admins['admin']) {
        // Make sure the admin has been created.
        throw new Error("Admin does not exist");
      } else if (config.admins['admin'] === 'pass') {
        // Also make sure the password has been hashed.
        throw new Error("Admin's password is not hashed");
      }
    }).then(
      // Whatever happened, clean up.
      function () {
        return cleanUpTest().then(done);
      },
      function (err) {
        return cleanUpTest().then(function () {
          throw err;
        });
      }
    );
  });
  it('should support setting a different config path', function (done) {
    // make sure the file is written to disk.
    expressApp2.couchConfig.set('demo', 'demo', true, function () {
      fse.exists(TEST_DATA + 'b-config.json', function (exists) {
        if (!exists) {
          return done(new Error("b-config.json doesn't exist!"));
        }
        done();
      });
    });
  });
  it('should support setting a different log path', function (done) {
    // make sure the file is written to disk.
    expressApp2.couchConfig.set('demo', 'demo', true, function () {
      fse.exists(TEST_DATA + 'b-log.txt', function (exists) {
        if (!exists) {
          return done(new Error("b-log.txt doesn't exist!"));
        }
        done();
      });
    });
  });
  it('should support externally adding a default', function () {
    expressApp.couchConfig.registerDefault('a', 'b', 'c');
    return request(expressApp)
      .get('/_config')
      .expect(200)
      .then(function (res) {
        var a = JSON.parse(res.text).a;
        if (!(typeof a === "object" && a.b === "c")) {
          throw new Error("Default not shown");
        }
      });
  });
  it('should support externally getting a config value', function (done) {
    request(expressApp)
      .put('/_config/test/a')
      .send('"b"')
      .expect(200)
      .end(function () {
        if (expressApp.couchConfig.get('test', 'a') !== 'b') {
          return done(new Error("Can't read setting that's just been set"));
        }
        done();
      });
  });
  it('should support external listeners to a config change', function () {
    var changed = false;
    expressApp.couchConfig.on('test2.a', function () {
      changed = true;
    });
    return request(expressApp)
      .put('/_config/test2/a')
      .send('"b"')
      .expect(200)
      .then(function () {
        if (!changed) {
          throw new Error("Didn't get notice of the setting change");
        }
      });
  });
});

var prefixes = ['/', '/db/'];

prefixes.forEach(function (prefix) {
  describe('basics for ' + prefix, function () {
    it('GET / should respond with a welcome page', function (done) {
      var app = express();
      app.use(prefix, expressApp);

      testWelcome(app, done, prefix);
    });
    it('GET / should respond with adapters', function () {
      var app = express();
      app.use(prefix, expressApp);
      return request(app)
        .get(prefix)
        .expect(200)
        .then(function (res) {
          var json = JSON.parse(res.text);
          assert.deepEqual(json['pouchdb-adapters'], ['leveldb']);
        });
    });
  });
});

function testWelcome(app, done, path) {
  request(app)
    .get(path)
    .expect(200)
    .then((res) => {
      if (!/Welcome!/.test(res.text)) {
        throw new Error("No 'Welcome!' in response");
      }
    })
    .then(done, done);
}

describe('modes', function () {
  it('should always return a 404 in our custom configuration', function () {
    return request(customApp)
      .get('/')
      .expect(404)
      .then(function (res) {
        if (JSON.parse(res.text).error !== 'not_found') {
          throw new Error("Wrong response body");
        }
      });
  });
  it('should generate a functioning core app', function (done) {
    testWelcome(coreApp, done, '/');
  });
  it('should throw an error when given an invalid mode', function () {
    assertException(function () {
      buildApp(PouchDB, {mode: 'unexisting-mode'});
    }, /Unknown mode: unexisting-mode/);
  });
  it('should throw an error when a not included part is excluded', function () {
    assertException(function () {
      buildApp(PouchDB, {overrideMode: {exclude: ['abc']}});
    }, /exclude contains the not included part 'abc'/);
  });
  it('should throw an error when an unknown part is included', function () {
    assertException(function () {
      buildApp(PouchDB, {overrideMode: {include: ['abc']}});
    }, /include contains the unknown part 'abc'/);
  });
});

describe('redirects', function () {
  it('GET /_utils should redirect to /_utils/', function (done) {
    request(coreApp)
      .get('/_utils')
      .expect(301)
      .end(done);
  });
  it('GET /_utils/ should return fauxton', function () {
    return request(coreApp)
      .get('/_utils/')
      .expect(200)
      .then(function (res) {
        if (!/<p>Fauxton <strong>requires<\/strong> JavaScript to be enabled.<\/p>/.test(res.text)) {
          throw new Error('No "<p>Fauxton <strong>requires</strong> JavaScript to be enabled.</p>" in response');
        }
      });
  });
});

describe('endpoints', function () {
  it("should be on the 'secured' whitelist (pouchdb/pouchdb-server#290)", function () {
    // https://stackoverflow.com/a/14934933
    var unguardedRoutes = inMemoryConfigApp._router.stack.filter(function (layer) {
      if (layer.route) {
        return typeof {
          // A lookup that maps [a route we know is never exposed to a user
          // without proper authorization] to [the file, module or other reason
          // that the route is secured (the value of which is given here only
          // for human convenience)].
          //
          // Before adding to this list, make sure of the following:
          // - the security document is respected
          // - validation documents are respected
          // - extra system database restrictions (_users & _replicator) are
          //   handled correctly
          //
          '/_config': 'routes/authorization.js',
          '/_config/:section': 'routes/authorization.js',
          '/_config/:section/:key': 'routes/authorization.js',
          '/_log': 'routes/authorization.js',
          '/_active_tasks': 'routes/authorization.js',
          '/_db_updates': 'routes/authorization.js',
          '/_restart': 'routes/authorization.js',
          '/': 'publicly accessible API',
          '/_session': 'publicly accessable API',
          '/_utils': 'publicly accessable API',
          '/_membership': 'publicly accessable API',
          '/_cluster_setup': 'publically accessable API',
          '/_uuids': 'publically accessable API',
          '/_all_dbs': 'publically accessable API',
          '/_replicate': 'publically accessable API',
          '/_stats': 'publically accessable API',
          '/:db': 'pouchdb-security',
          '/:db/*': 'pouchdb-security + pouchdb-system-db + pouchdb-validation',
          '/:db/_ensure_full_commit': 'db.js: for now at least',
          '/:db/_bulk_docs': 'pouchdb-security + pouchdb-validation',
          '/:db/_all_docs': 'pouchdb-security + pouchdb-system-db',
          '/:db/_bulk_get': 'pouchdb-security + pouchdb-system-db',
          '/:db/_changes': 'pouchdb-security + pouchdb-system-db',
          '/:db/_compact': 'pouchdb-security',
          '/:db/_revs_diff': 'pouchdb-security + pouchdb-system-db',
          '/:db/_security': 'pouchdb-security',
          '/:db/_query': 'pouchdb-security + pouchdb-system-db',
          '/:db/_view_cleanup': 'pouhdb-security',
          '/:db/_temp_view': 'pouchdb-security + pouchdb-system-db',
          '/:db/:id(*)': 'pouchdb-security + pouchdb-validation',
          '/:db/:id': 'pouchdb-security + pouchdb-validation + pouchdb-system-db',
          '/:db/_index': 'pouchdb-security + pouchdb-system-db',
          '/:db/_index/:ddoc/:type/:name': 'pouchdb-security',
          '/:db/_find': 'pouchdb-security + pouchdb-system-db',
          '/:db/_explain': 'pouchdb-security + pouchdb-system-db',
          '/:db/_design/:id/_view/:view': 'pouchdb-security + pouchdb-system-db',
          '/:db/_design/:id/_info': 'ddoc-info.js itself (at least for now)',
          '/:db/_design/:id/_show/:func*': 'pouchdb-security + pouchdb-system-db',
          '/:db/_design/:id/_list/:func/:view': 'pouchdb-security + pouchdb-system-db',
          '/:db/_design/:id/_list/:func/:id2/:view': 'pouchdb-security + pouchdb-system-db',
          '/:db/_design/:id/_update/:func*': 'pouchdb-security + pouchdb-validation',
          '/:db/_design/:id/:attachment(*)': 'pouchdb-security + pouchdb-validation + pouchdb-system-db',
          '/:db/:id/:attachment(*)': 'pouchdb-security + pouchdb-validation + pouchdb-system-db',
        }[layer.route.path] === 'undefined';
      }
    }).map(function (layer) {
      return layer.route.path;
    });
    var msg = "Not on the whitelist:\n\n" + unguardedRoutes.join('\n');
    assert.equal(unguardedRoutes.length, 0, msg);
  });
});

function assertException(func, re) {
  var e;
  try {
    func();
  } catch (err) {
    if (re.test(err.toString())) {
      return;
    }
    e = err;
  }
  throw (e || new Error('no error was thrown'));
}
