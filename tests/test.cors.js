/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, utils: true, extend: true */
/*globals ajax: true */
/*globals cleanupTestDatabases: false, strictEqual: false */
/*globals openTestDB: true, putAfter: false */

'use strict';

var adapter = 'http-1';
var qunit = module;


if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js');
  var HTTPPouch = require('../src/adapters/pouch.http.js');
  var LevelPouch = require('../src/adapters/pouch.leveldb.js');
  var utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit('CORS http-adapter:', {
  setup: function() {
    this.name = generateAdapterUrl(adapter);
  },
  teardown: function() {
    if (!PERSIST_DATABASES) {
      stop();
      Pouch.destroy(this.name, function(err, info) {start();});
    }
  }
});


//----------Util functions----------//
var call = function(fun) {
  var args = Array.prototype.slice.call(arguments, 1);
  if (typeof fun === typeof Function) {
    fun.apply(this, args);
  }
};

//enable CORS on server
function enableCORS(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/httpd/enable_cors', json: false,
    method: 'PUT', body: '"true"'}, function(err, resBody, req) {
      ajax({url: host + '_config/cors/origins', json: false,
        method: 'PUT', body: '"http://127.0.0.1:8000"'}, function(err, resBody, req) {
          call(callback, err, req);
      });
  });
}

//enable CORS Credentials on server
function enableCORSCredentials(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/cors/credentials',
    method: 'PUT', body: '"true"', json: false}, function(err, resBody, req) {
      call(callback, err, req);
  });
}

//disable CORS
function disableCORS(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/cors/origins', json: false,
    method: 'PUT', body: '"*"'}, function(err, resBody, req) {
      ajax({url: host + '_config/httpd/enable_cors', json: false,
        method: 'PUT', body: '"false"'}, function(err, resBody, req) {
          call(callback, err, req);
      });
  });
}

//disable CORS Credentials
function disableCORSCredentials(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/cors/credentials',
    method: 'PUT', body: '"false"', json: false}, function(err, resBody, req) {
      call(callback, err, req);
  });
}

//create admin user and member user
function setupAdminAndMemberConfig(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_users/org.couchdb.user:TestUser',
    method: 'PUT', body: {_id: 'org.couchdb.user:TestUser', name: 'TestUser',
    password: 'user', roles: [], type: 'user'}}, function(err, resBody, req) {
      ajax({url: host + '_config/admins/TestAdmin', json: false,
        method: 'PUT', body: '"admin"'}, function(err, resBody, req) {
          call(callback, err, req);
      });
  });
}

//delete admin and member user
function tearDownAdminAndMemberConfig(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/admins/TestAdmin',
    method: 'DELETE', auth: {username: 'TestAdmin', password: 'admin'}, json: false}, function(err, resBody, req) {
      ajax({url: host + '_users/org.couchdb.user:TestUser',
        method: 'GET', body: '"admin"', json: false}, function(err, resBody, req) {

          if (resBody) {
            ajax({url: host + '_users/org.couchdb.user:TestUser?rev=' + resBody['_rev'],
              method: 'DELETE', json: false}, function(err, resBody, req) {
                call(callback, err, req);
            });
          } else {
            call(callback, err, req);
          }
      });
  });
}

function initCORSTestDB(name, opts, callback) {
  // ignore errors, the database might not exist
  Pouch.destroy(name, function(err) {
    if (err && err.status !== 404 &&
      err.statusText !== 'timeout' && err.status !== 401) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
    openTestDB(name, opts, callback);
  });
}

function initCorsRemoteDB(remote, opts, localDB, callback) {
  var local = localDB;
  if (remote.split('/')[0] === 'http:' || remote.split('/')[0] === 'https:') {
    if (opts.remoteWithCORS) {
      enableCORS(remote, function(err, res) {
        remote = remote.replace('2020', '5984');
        if (opts.remoteWithCORSCredentials) {
            enableCORSCredentials(remote, function(err, res) {
              if (opts.remoteWithCookieAuth) {
                setupAdminAndMemberConfig(remote, function(err, res) {
                  initCORSTestDB(remote, {withCredentials: true, cookieAuth: {username: 'TestAdmin', password: 'admin'}}, function(err, remoteDb) {
                    callback(local, remoteDb);
                  });
                });
              } else {
                initCORSTestDB(remote, {withCredentials: true}, function(err, remoteDb) {
                  callback(local, remoteDb);
                });
              }
            });
        } else {
          initCORSTestDB(remote, function(err, remoteDb) {
            callback(local, remoteDb);
          });
        }
      });
    } else {
      initCORSTestDB(remote, function(err, remoteDb) {
        callback(local, remoteDb);
      });
    }
  } else {
    initCORSTestDB(remote, function(err, remoteDb) {
      callback(local, remoteDb);
    });
  }
}

function initCorsDBPair(local, remote, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  var defaultOpts = {
    localWithCORS: false,
    remoteWithCORS: false,
    localWithCORSCredentials: false,
    remoteWithCORSCredentials: false,
    localWithCookieAuth: false,
    remoteWithCookieAuth: false
    };
  opts = extend(true, defaultOpts, opts);

  if (local.split('/')[0] === 'http:' || local.split('/')[0] === 'https:') {
    if (opts.localWithCORS) {
      enableCORS(local, function(err, res) {
        local = local.replace('2020', '5984');
        if (opts.localWithCORSCredentials) {
            enableCORSCredentials(local, function(err, res) {
              if (opts.localWithCookieAuth) {
                setupAdminAndMemberConfig(local, function(err, res) {
                  initCORSTestDB(local, {withCredentials: true,
                    cookieAuth: {username: 'TestAdmin', password: 'admin'}}, function(err, localDb) {
                    initCorsRemoteDB(remote, opts, localDb, callback);
                  });
                });
              } else {
                initCORSTestDB(local, {withCredentials: true}, function(err, localDb) {
                  initCorsRemoteDB(remote, opts, localDb, callback);
                });
              }
            });
        } else {
          initCORSTestDB(local, function(err, localDb) {
            initCorsRemoteDB(remote, opts, localDb, callback);
          });
        }
      });
    } else {
      initCORSTestDB(local, function(err, localDb) {
        initCorsRemoteDB(remote, opts, localDb, callback);
      });
    }
  } else {
    initCORSTestDB(local, function(err, localDb) {
      initCorsRemoteDB(remote, opts, localDb, callback);
    });
  }
}

// //-------Cookie Auth Tests-----------//
asyncTest('Cookie Authentication with Admin.', function() {
  var name = this.name;

  //--Do Test Prep
  //setup security for db
  var testDB = new Pouch(name);
  testDB.put({_id: '_security', 'admins': {'names': ['TestAdmin'], 'roles': []}, 'members': {'names': ['TestUser'], 'roles': []}},
    function(err, res) {

      //add an admin and user
      setupAdminAndMemberConfig(name, function(err, info) {

        //--Run tests (NOTE: because of how this is run, COR's credentials must be sent so that the server recieves the auth cookie)
        var instantDB = new Pouch(name, {cookieAuth: {username: 'TestAdmin', password: 'admin'}, withCredentials: true}, function(err, info) {
          ok(err === null, 'Cookie authentication.');
        });
        instantDB.post({_id: '_design/testdesign', views: {test_view: {map: 'function(doc){emit(doc._id,doc._rev);}'}}}, function(err, info) { //add design doc (only admins can do this)
          ok(err === null, 'Design Doc inserted.');

          //get rid of cookie used for auth
          Pouch.deleteCookieAuth(name, function(err, ret, res) {
            //get rid of admin and user
            tearDownAdminAndMemberConfig(name, function(err, info) {start();});
          });
        });
      });
    });
});

asyncTest('Cookie Authentication with User.', 3, function() {
  var name = this.name;

  //--Do Test Prep
  //setup security for db first
  var testDB = new Pouch(name);
  testDB.put({_id: '_security', 'admins': {'names': ['TestAdmin'], 'roles': []}, 'members': {'names': ['TestUser'], 'roles': []}},
    function(err, res) {
      //add an admin and user
      setupAdminAndMemberConfig(name, function(err, info) {

        //--Run tests (NOTE: because of how this is run, COR's credentials must be sent so that the server recieves the auth cookie)
        var instantDB = new Pouch(name, {cookieAuth: {username: 'TestUser', password: 'user'}, withCredentials: true}, function(err, info) {
          ok(err === null, 'Cookie authentication.');
        });
        instantDB.post({_id: '_design/testdesign', views: {test_view: {map: 'function(doc){emit(doc._id,doc._rev);}'}}}, function(err, info) { //add design doc (only admins can do this)
          ok(err && err.error === 'unauthorized', 'Design Doc failed to be inserted because we are not a db admin.');
        });
        instantDB.post({test: 'abc'}, function(err, info) {
          ok(err === null, 'Doc inserted.');

          //--Do Reset
          //get rid of cookie used for auth
          Pouch.deleteCookieAuth(name, function(err, ret, res) {
            //get rid of admin and user
            tearDownAdminAndMemberConfig(name, function(err, info) {start();});
          });
        });
      });
    });
});


//-------CORS Enabled Tests----------//
asyncTest('Create a pouchDB with CORS', 1, function() {
  var old_name = this.name;
  var name = this.name.replace('2020', '5984');  //change ports simulating non-same host

  //--Do Test Prep
  enableCORS(this.name, function(err, res) {

    //--Run Tests
    var instantDB = new Pouch(name, function(err, info) {
      ok(err === null, 'DB created.');

      //--Do Reset
      disableCORS(old_name, function(err, res) {start();});
    });
  });
});

asyncTest('Add a doc using CORS', 2, function() {
  var old_name = this.name;
  var name = this.name.replace('2020', '5984');  //change ports simulating non-same host

  //--Do Test Prep
  enableCORS(this.name, function(err, res) {

    //--Run Tests
    var instantDB = new Pouch(name, function(err, info) {
      ok(err === null, 'DB created.');
    });
    instantDB.post({test: 'abc'}, function(err, info) {
      ok(err === null, 'Doc inserted.');

      //--Do Reset
      disableCORS(old_name, function(err, res) {start();});
    });
  });
});

asyncTest('Delete a DB using CORS', 2, function() {
  var old_name = this.name;
  var name = this.name.replace('2020', '5984');  //change ports simulating non-same host

  //--Do Test Prep
  enableCORS(this.name, function(err, res) {

    //--Run Tests
    var instantDB = new Pouch(name, function(err, info) {
      ok(err === null, 'DB created.');
      Pouch.destroy(name, function(err, info) {
        ok(err === null, 'DB destroyed.');

        //--Do Reset
        disableCORS(old_name, function(err, res) {start();});
      });
    });
  });
});


//-------CORS Credentials Enabled Tests----------//
asyncTest('Create DB as Admin with CORS Credentials.', 2, function() {
  var old_name = this.name; //saved for prep and cleanup
  var name = this.name.replace('2020', '5984');  //simulates a CORS request

  //--Do Test Prep
  enableCORS(old_name, function(err, res) {
    enableCORSCredentials(old_name, function(err, res) {
      //add an admin and user
      setupAdminAndMemberConfig(old_name, function(err, info) {

        //--Run tests
        var instantDB = new Pouch(name, {cookieAuth: {username: 'TestAdmin', password: 'admin'}, withCredentials: true}, function(err, info) {
          ok(err === null, 'DB Created.');
        });
        instantDB.info(function(err, info) {
          ok(err === null, 'DB Get Info.');

          //--Do Reset
          Pouch.deleteCookieAuth(old_name, function(err, ret, res) {
            tearDownAdminAndMemberConfig(old_name, function(err, info) {
              disableCORSCredentials(old_name, function(err, res) {
                disableCORS(old_name, function(err, res) {
                  start();
                });
              });
            });
          });
        });
      });
    });
  });
});

asyncTest('Add Doc to DB as User with CORS Credentials.', 2, function() {
  var old_name = this.name; //saved for prep and cleanup
  var name = this.name.replace('2020', '5984');  //simulates a CORS request

  //--Do Test Prep
  enableCORS(old_name, function(err, res) {
    enableCORSCredentials(old_name, function(err, res) {
      //add an admin and user
      setupAdminAndMemberConfig(old_name, function(err, info) {

        //--Run tests
        var instantDB = new Pouch(name, {cookieAuth: {username: 'TestAdmin', password: 'admin'}, withCredentials: true}, function(err, info) {
          ok(err === null, 'DB Created.');
        });
        instantDB.post({test: 'abc'}, function(err, info) {
          ok(err === null, 'Doc Inserted.');

          //--Do Reset
          Pouch.deleteCookieAuth(old_name, {withCredentials: true}, function(err, ret, res) {
            tearDownAdminAndMemberConfig(old_name, function(err, info) {
              disableCORSCredentials(old_name, function(err, res) {
                disableCORS(old_name, function(err, res) {
                  start();
                });
              });
            });
          });
        });
      });
    });
  });
});

asyncTest('Delete DB as Admin with CORS Credentials.', 3, function() {
  var old_name = this.name; //saved for prep and cleanup
  var name = this.name.replace('2020', '5984');  //simulates a CORS request

  //--Do Test Prep
  enableCORS(old_name, function(err, res) {
    enableCORSCredentials(old_name, function(err, res) {
      //add an admin and user
      setupAdminAndMemberConfig(old_name, function(err, info) {

        //--Run tests
        var instantDB = new Pouch(name, {cookieAuth: {username: 'TestAdmin', password: 'admin'}, withCredentials: true}, function(err, instance)  {
          ok(err === null, 'DB Created.');
        });
        instantDB.post({test: 'abc'}, function(err, res) {
          ok(err === null, 'Doc Inserted.');

          Pouch.destroy(name, {cookieAuth: {username: 'TestAdmin', password: 'admin'}, withCredentials: true}, function(err, res) {
            ok(err === null, 'DB Deleted.');

            //--Do Reset
            Pouch.deleteCookieAuth(old_name, {withCredentials: true}, function(err, ret, res) {
              tearDownAdminAndMemberConfig(old_name, function(err, info) {
                disableCORSCredentials(old_name, function(err, res) {
                  disableCORS(old_name, function(err, res) {
                    start();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

//------CORS Replication Tests-----------//
var adapters2 = [
  ['local-1', 'http-1'],
  ['http-1', 'http-2'],
  ['http-1', 'local-1']];

var deletedDocAdapters2 = [['local-1', 'http-1']];

adapters2.map(function(adapters) {

  qunit('CORS replication: ' + adapters[0] + ':' + adapters[1], {
    setup: function() {
      this.name = generateAdapterUrl(adapters[0]);
      this.remote = generateAdapterUrl(adapters[1]);
      Pouch.enableAllDbs = true;
    },
    teardown: function() {
      var self = this;
      stop();
      if (typeof module !== undefined && !module.exports) {
        self.name = self.name.replace('5984', '2020');
        self.remote = self.remote.replace('5984', '2020');
      }
      if (adapters[0] === 'http-1' && adapters[1] === 'http-2') {
        Pouch.deleteCookieAuth(self.name, function(err, ret, res) {
          tearDownAdminAndMemberConfig(self.name, function(err, info) {
            disableCORSCredentials(self.name, function(err, res) {
              disableCORS(self.name, function(err, res) {
                Pouch.destroy(self.name, function(err, res) {
                  Pouch.deleteCookieAuth(self.remote, function(err, ret, res) {
                    tearDownAdminAndMemberConfig(self.remote, function(err, info) {
                      disableCORSCredentials(self.remote, function(err, res) {
                        disableCORS(self.remote, function(err, res) {
                          Pouch.destroy(self.remote, function(err, res) {
                            start();
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      } else if (adapters[0] === 'http-1') {
        Pouch.deleteCookieAuth(self.name, function(err, ret, res) {
          tearDownAdminAndMemberConfig(self.name, function(err, info) {
            disableCORSCredentials(self.name, function(err, res) {
              disableCORS(self.name, function(err, res) {
                Pouch.destroy(self.name, function(err, res) {
                  cleanupTestDatabases();
                  start();
                });
              });
            });
          });
        });
      } else if (adapters[1] === 'http-1') {
        Pouch.deleteCookieAuth(self.remote, function(err, ret, res) {
          tearDownAdminAndMemberConfig(self.remote, function(err, info) {
            disableCORSCredentials(self.remote, function(err, res) {
              disableCORS(self.remote, function(err, res) {
                Pouch.destroy(self.remote, function(err, res) {
                  cleanupTestDatabases();
                  start();
                });
              });
            });
          });
        });
      }
    }
  });

  var docs = [
    {_id: '0', integer: 0, string: '0'},
    {_id: '1', integer: 1, string: '1'},
    {_id: '2', integer: 2, string: '2'}
  ];

  //---------CORS Replication Tests----------//
  //These tests primarily concern turning enable_cors on, on the couchdb http server
  asyncTest('Test basic pull replication (using CORS remote)', 2, function() {
    //--Do Test Prep
    var self = this;
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        db.replicate.from(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest('Test basic pull replication plain api (using CORS local)', 2, function() {
    //--Do Test Prep
    var self = this;
    initCorsDBPair(this.name, this.remote, {localWithCORS: true}, function(db, remote) {
      self.name = self.name.replace('2020', '5984');
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        Pouch.replicate(self.remote, self.name, function(err, result) {
          ok(result.ok, 'replication was ok');
          equal(result.docs_written, docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest('Local DB contains documents (using CORS local)', 1, function() {
    //--Do Test Prep
    var self = this;
    initCorsDBPair(this.name, this.remote, {localWithCORS: true}, function(db, remote) {
      self.name = self.name.replace('2020', '5984');
      remote.bulkDocs({docs: docs}, function(err, _) {
        db.bulkDocs({docs: docs}, function(err, _) {
          //--Run tests
          db.replicate.from(self.remote, function(err, _) {
            db.allDocs(function(err, result) {
              ok(result.rows.length === docs.length, 'correct # docs exist');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Test basic push replication (using CORS local)', 2, function() {
    //--Do Test Prep
    var self = this;
    initCorsDBPair(this.name, this.remote, {localWithCORS: true}, function(db, remote) {
      self.name = self.name.replace('2020', '5984');
      db.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        db.replicate.to(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest('Test basic push replication take 2 (using CORS remote)', 1, function() {
    //--Do Test Prep
    var self = this;
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      db.bulkDocs({docs: docs}, {}, function(err, _) {
        //--Run tests
        db.replicate.to(self.remote, function(err, _) {
          remote.allDocs(function(err, result) {
            ok(result.rows.length === docs.length, 'correct # docs written');
            start();
          });
        });
      });
    });
  });

  asyncTest('Test basic push replication sequence tracking (using CORS remote)', 3, function() {
    //--Do Test Prep
    var self = this;
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      //--Run tests
      var doc1 = {_id: 'adoc', foo: 'bar'};
      db.put(doc1, function(err, result) {
        db.replicate.to(self.remote, function(err, result) {
          equal(result.docs_read, 1, 'correct # changed docs read on first replication');
          db.replicate.to(self.remote, function(err, result) {
            equal(result.docs_read, 0, 'correct # changed docs read on second replication');
            db.replicate.to(self.remote, function(err, result) {
              equal(result.docs_read, 0, 'correct # changed docs read on third replication');
              start();
            });
          });
        });
      });
    });
  });

  // CouchDB will not generate a conflict here, it uses a deteministic
  // method to generate the revision number, however we cannot copy its
  // method as it depends on erlangs internal data representation
  asyncTest('Test basic conflict (using CORS remote)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};
    var doc2 = {_id: 'adoc', bar: 'baz'};
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      db.put(doc1, function(err, localres) {
        remote.put(doc2, function(err, remoteres) {
          //--Run tests
          db.replicate.to(self.remote, function(err, _) {
            remote.get('adoc', {conflicts: true}, function(err, result) {
              ok(result._conflicts, 'result has a conflict');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Test _conflicts key locally (using CORS local)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};
    var doc2 = {_id: 'adoc', bar: 'baz'};
    initCorsDBPair(this.name, this.remote, {localWithCORS: true}, function(db, remote) {
      self.name = self.name.replace('2020', '5984');
      db.put(doc1, function(err, localres) {
        remote.put(doc2, function(err, remoteres) {
          //--Run tests
          db.replicate.to(self.remote, function(err, _) {

            var queryFun = {
              map: function(doc) {
                if (doc._conflicts) {
                  emit(doc._id, [doc._rev].concat(doc._conflicts));
                }
              }
            };

            remote.query(queryFun, {reduce: false, conflicts: true}, function(_, res) {
              equal(res.rows.length, 1, '_conflict key exists');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Test basic continous pull replication (using CORS remote)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        var count = 0;
        var rep = db.replicate.from(self.remote, {continuous: true});
        var changes = db.changes({
          onChange: function(change) {
            ++count;
            if (count === 3) {
              return remote.put(doc1);
            }
            if (count === 4) {
              ok(true, 'Got all the changes');
              rep.cancel();
              changes.cancel();
              start();
            }
          },
          continuous: true
        });
      });
    });
  });

  asyncTest('Test basic continous push replication (using CORS local)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};
    initCorsDBPair(this.name, this.remote, {localWithCORS: true}, function(db, remote) {
      self.name = self.name.replace('2020', '5984');
      db.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        var count = 0;
        var rep = remote.replicate.from(db, {continuous: true});
        var changes = remote.changes({
          onChange: function(change) {
            ++count;
            if (count === 3) {
              return db.put(doc1);
            }
            if (count === 4) {
              ok(true, 'Got all the changes');
              rep.cancel();
              changes.cancel();
              start();
            }
          },
          continuous: true
        });
      });
    });
  });

  asyncTest('Test cancel pull replication (using CORS remote)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};
    var doc2 = {_id: 'anotherdoc', foo: 'baz'};
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        var count = 0;
        var replicate = db.replicate.from(self.remote, {continuous: true});
        var changes = db.changes({
          continuous: true,
          onChange: function(change) {
            ++count;
            if (count === 3) {
              remote.put(doc1);
            }
            if (count === 4) {
              replicate.cancel();
              remote.put(doc2);
              // This setTimeout is needed to ensure no further changes come through
              setTimeout(function() {
                ok(count === 4, 'got no more docs');
                changes.cancel();
                start();
              }, 500);
            }
          }
        });
      });
    });
  });

  asyncTest('Replication filter (using CORS local)', 1, function() {
    //--Do Test Prep
    var docs1 = [
      {_id: '0', integer: 0},
      {_id: '1', integer: 1},
      {_id: '2', integer: 2},
      {_id: '3', integer: 3}
    ];

    initCorsDBPair(this.name, this.remote, {localWithCORS: true}, function(db, remote) {
      remote.bulkDocs({docs: docs1}, function(err, info) {
        //--Run tests
        var replicate = db.replicate.from(remote, {
          filter: function(doc) { return doc.integer % 2 === 0; }
        }, function() {
          db.allDocs(function(err, docs) {
            equal(docs.rows.length, 2);
            replicate.cancel();
            start();
          });
        });
      });
    });
  });

  asyncTest('Replication with different filters (using CORS remote)', 1, function() {
    //--Do Test Prep
    var more_docs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'}
    ];

    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      remote.bulkDocs({docs: docs}, function(err, info) {
        //--Run tests
        db.replicate.from(remote, {
          filter: function(doc) { return doc.integer % 2 === 0; }
        }, function(err, response) {
          remote.bulkDocs({docs: more_docs}, function(err, info) {
            db.replicate.from(remote, {}, function(err, response) {
              ok(response.docs_written === 3, 'correct # of docs replicated');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Replication doc ids (using CORS remmote)', 1, function() {
    //--Do Test Prep
    var thedocs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'},
      {_id: '5', integer: 5, string: '5'}
    ];

    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      remote.bulkDocs({docs: thedocs}, function(err, info) {
        //--Run tests
        db.replicate.from(remote, {
          doc_ids: ['3', '4']
        }, function(err, response) {
          strictEqual(response.docs_written, 1, 'correct # of docs replicated');
          start();
        });
      });
    });
  });

  asyncTest('Replication with same filters (using CORS local)', 1, function() {
    //--Do Test Prep
    var more_docs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'}
    ];

    initCorsDBPair(this.name, this.remote, {localWithCORS: true}, function(db, remote) {
      remote.bulkDocs({docs: docs}, function(err, info) {
        //--Run tests
        db.replicate.from(remote, {
          filter: function(doc) { return doc.integer % 2 === 0; }
        }, function(err, response) {
          remote.bulkDocs({docs: more_docs}, function(err, info) {
            db.replicate.from(remote, {
              filter: function(doc) { return doc.integer % 2 === 0; }
            }, function(err, response) {
              ok(response.docs_written === 1, 'correct # of docs replicated');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Replication with deleted doc (using CORS remote)', 1, function() {
    //--Do Test Prep
    var docs1 = [
      {_id: '0', integer: 0},
      {_id: '1', integer: 1},
      {_id: '2', integer: 2},
      {_id: '3', integer: 3},
      {_id: '4', integer: 4, _deleted: true}
    ];

    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      remote.bulkDocs({docs: docs1}, function(err, info) {
        //--Run tests
        var replicate = db.replicate.from(remote, function() {
          db.allDocs(function(err, res) {
            equal(res.total_rows, 4, 'Replication with deleted docs');
            start();
          });
        });
      });
    });
  });

  asyncTest('Replication notifications (using CORS remote)', function() {
    //--Do Test Prep
    var self = this;
    var changes = 0;
    var onChange = function(c) {
      changes++;
      ok(true, 'Got change notification');
      if (changes === 3) {
        ok(true, 'Got all change notification');
        start();
      }
    };
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        db.replicate.from(self.remote, {onChange: onChange});
      });
    });
  });

  asyncTest('Replication with remote conflict (using CORS remote)', 2, function() {
    //--Do Test Prep
    var doc = {_id: 'test', test: 'Remote 1'},
        winningRev;

    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      remote.post(doc, function(err, resp) {
        //--Run tests
        doc._rev = resp.rev;
        Pouch.replicate(remote, db, function(err, resp) {
          doc.test = 'Local 1';
          db.put(doc, function(err, resp) {
            doc.test = 'Remote 2';
            remote.put(doc, function(err, resp) {
              doc._rev = resp.rev;
              doc.test = 'Remote 3';
              remote.put(doc, function(err, resp) {
                winningRev = resp.rev;
                Pouch.replicate(db, remote, function(err, resp) {
                  Pouch.replicate(remote, db, function(err, resp) {
                    remote.get('test', {revs_info: true}, function(err, remotedoc) {
                      db.get('test', {revs_info: true}, function(err, localdoc) {
                        equal(localdoc._rev, winningRev, 'Local chose correct winning revision');
                        equal(remotedoc._rev, winningRev, 'Remote chose winning revision');
                        start();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  asyncTest('Replicate large number of docs (using CORS local)', 1, function() {
    //--Do Test Prep
    var docs = [];
    var num = 30;
    for (var i = 0; i < num; i++) {
      docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
    }
    initCorsDBPair(this.name, this.remote, {localWithCORS: true}, function(db, remote) {
      remote.bulkDocs({docs: docs}, function(err, info) {
        //--Run tests
        var replicate = db.replicate.from(remote, {}, function() {
          db.allDocs(function(err, res) {
            equal(res.total_rows, num, 'Replication with deleted docs');
            start();
          });
        });
      });
    });
  });

  //---------CORS with Credentials Replication Tests----------//
  //These tests primarily concern turning enable_cors on, on the couchdb http server
  //Setting the following cors settings on the couchdb http server: origins=http://127.0.0.1:8000 credentials=true
  //Note: these tests are always executed with a server admin user session
  asyncTest('Test basic pull replication (from CORS remote with Credentials)', 2, function() {
    //--Do Test Prep
    var self = this;

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        db.replicate.from(self.remote, {withCredentials: true}, function(err, result) {
          ok(result.ok, 'replication was ok');
          equal(result.docs_written, docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest('Test basic pull replication plain api (from CORS local with Credentials)', 2, function() {
    //--Do Test Prep
    var self = this;
    var opts = {localWithCORS: true, localWithCORSCredentials: true, localWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['remoteWithCORS'] = true;
      opts['remoteWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.name = self.name.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.remote = self.remote.replace('2020', '5984');
      }
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        Pouch.replicate(self.remote, self.name, {targetWithCredentials: true}, function(err, result) {
          ok(result.ok, 'replication was ok');
          equal(result.docs_written, docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest('Local DB contains documents (from CORS local with Credentials)', 1, function() {
    //--Do Test Prep
    var self = this;
    var opts = {localWithCORS: true, localWithCORSCredentials: true, localWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['remoteWithCORS'] = true;
      opts['remoteWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.name = self.name.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.remote = self.remote.replace('2020', '5984');
      }
      remote.bulkDocs({docs: docs}, function(err, _) {
        db.bulkDocs({docs: docs}, function(err, _) {
          //--Run tests
          db.replicate.from(self.remote, function(err, _) {
            db.allDocs(function(err, result) {
              ok(result.rows.length === docs.length, 'correct # docs exist');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Test basic push replication (from CORS local with Credentials)', 2, function() {
    //--Do Test Prep
    var self = this;
    var opts = {localWithCORS: true, localWithCORSCredentials: true, localWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['remoteWithCORS'] = true;
      opts['remoteWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.name = self.name.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.remote = self.remote.replace('2020', '5984');
      }
      db.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        db.replicate.to(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest('Test basic push replication take 2 (from CORS remote with Credentials)', 1, function() {
    //--Do Test Prep
    var self = this;
    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      db.bulkDocs({docs: docs}, {}, function(err, _) {
        //--Run tests
        db.replicate.to(self.remote, {withCredentials: true}, function(err, _) {
          remote.allDocs(function(err, result) {
            ok(result.rows.length === docs.length, 'correct # docs written');
            start();
          });
        });
      });
    });
  });

  asyncTest('Test basic push replication sequence tracking (from CORS remote with Credentials)', 3, function() {
    //--Do Test Prep
    var self = this;
    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      //--Run tests
      var doc1 = {_id: 'adoc', foo: 'bar'};
      db.put(doc1, function(err, result) {
        db.replicate.to(self.remote, {withCredentials: true}, function(err, result) {
          equal(result.docs_read, 1, 'correct # changed docs read on first replication');
          db.replicate.to(self.remote, {withCredentials: true}, function(err, result) {
            equal(result.docs_read, 0, 'correct # changed docs read on second replication');
            db.replicate.to(self.remote, {withCredentials: true}, function(err, result) {
              equal(result.docs_read, 0, 'correct # changed docs read on third replication');
              start();
            });
          });
        });
      });
    });
  });

  // // CouchDB will not generate a conflict here, it uses a deteministic
  // // method to generate the revision number, however we cannot copy its
  // // method as it depends on erlangs internal data representation
  asyncTest('Test basic conflict (from CORS remote with Credentials)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};
    var doc2 = {_id: 'adoc', bar: 'baz'};

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      db.put(doc1, function(err, localres) {
        remote.put(doc2, function(err, remoteres) {
          //--Run tests
          db.replicate.to(self.remote, {withCredentials: true}, function(err, _) {
            remote.get('adoc', {conflicts: true}, function(err, result) {
              ok(result._conflicts, 'result has a conflict');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Test _conflicts key local (from CORS local with Credentials)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};
    var doc2 = {_id: 'adoc', bar: 'baz'};

    var opts = {localWithCORS: true, localWithCORSCredentials: true, localWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['remoteWithCORS'] = true;
      opts['remoteWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.name = self.name.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.remote = self.remote.replace('2020', '5984');
      }
      db.put(doc1, function(err, localres) {
        remote.put(doc2, function(err, remoteres) {
          //--Run tests
          db.replicate.to(self.remote, function(err, _) {

            var queryFun = {
              map: function(doc) {
                if (doc._conflicts) {
                  emit(doc._id, [doc._rev].concat(doc._conflicts));
                }
              }
            };

            remote.query(queryFun, {reduce: false, conflicts: true}, function(_, res) {
              equal(res.rows.length, 1, '_conflict key exists');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Test basic continous pull replication (from CORS remote with Credentials)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        var count = 0;
        var rep = db.replicate.from(self.remote, {continuous: true, withCredentials: true});
        var changes = db.changes({
          onChange: function(change) {
            ++count;
            if (count === 3) {
              return remote.put(doc1);
            }
            if (count === 4) {
              ok(true, 'Got all the changes');
              rep.cancel();
              changes.cancel();
              start();
            }
          },
          continuous: true
        });
      });
    });
  });

  asyncTest('Test basic continous push replication (from CORS local with Credentials)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};

    var opts = {localWithCORS: true, localWithCORSCredentials: true, localWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['remoteWithCORS'] = true;
      opts['remoteWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.name = self.name.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.remote = self.remote.replace('2020', '5984');
      }
      db.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        var count = 0;
        var rep = remote.replicate.from(db, {continuous: true});
        var changes = remote.changes({
          onChange: function(change) {
            ++count;
            if (count === 3) {
              return db.put(doc1);
            }
            if (count === 4) {
              ok(true, 'Got all the changes');
              rep.cancel();
              changes.cancel();
              start();
            }
          },
          continuous: true
        });
      });
    });
  });

  asyncTest('Test cancel pull replication (from CORS remote with Credentials)', 1, function() {
    //--Do Test Prep
    var self = this;
    var doc1 = {_id: 'adoc', foo: 'bar'};
    var doc2 = {_id: 'anotherdoc', foo: 'baz'};

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        var count = 0;
        var replicate = db.replicate.from(self.remote, {continuous: true, withCredentials: true});
        var changes = db.changes({
          continuous: true,
          onChange: function(change) {
            ++count;
            if (count === 3) {
              remote.put(doc1);
            }
            if (count === 4) {
              replicate.cancel();
              remote.put(doc2);
              // This setTimeout is needed to ensure no further changes come through
              setTimeout(function() {
                ok(count === 4, 'got no more docs');
                changes.cancel();
                start();
              }, 500);
            }
          }
        });
      });
    });
  });

  asyncTest('Replication filter (from CORS local with Credentials)', 1, function() {
    //--Do Test Prep
    var docs1 = [
      {_id: '0', integer: 0},
      {_id: '1', integer: 1},
      {_id: '2', integer: 2},
      {_id: '3', integer: 3}
    ];

    var opts = {localWithCORS: true, localWithCORSCredentials: true, localWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['remoteWithCORS'] = true;
      opts['remoteWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      remote.bulkDocs({docs: docs1}, function(err, info) {
        //--Run tests
        var replicate = db.replicate.from(remote, {
          filter: function(doc) { return doc.integer % 2 === 0; }
        }, function() {
          db.allDocs(function(err, docs) {
            equal(docs.rows.length, 2);
            replicate.cancel();
            start();
          });
        });
      });
    });
  });

  asyncTest('Replication with different filters (from CORS remote with Credentials)', 1, function() {
    //--Do Test Prep
    var more_docs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'}
    ];

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      remote.bulkDocs({docs: docs}, function(err, info) {
        //--Run tests
        db.replicate.from(remote, {
          filter: function(doc) { return doc.integer % 2 === 0; }
        }, function(err, response) {
          remote.bulkDocs({docs: more_docs}, function(err, info) {
            db.replicate.from(remote, {}, function(err, response) {
              ok(response.docs_written === 3, 'correct # of docs replicated');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Replication doc ids (from CORS remote with Credentials)', 1, function() {
    //--Do Test Prep
    var thedocs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'},
      {_id: '5', integer: 5, string: '5'}
    ];

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      remote.bulkDocs({docs: thedocs}, function(err, info) {
        //--Run tests
        db.replicate.from(remote, {
          doc_ids: ['3', '4']
        }, function(err, response) {
          strictEqual(response.docs_written, 1, 'correct # of docs replicated');
          start();
        });
      });
    });
  });

  asyncTest('Replication with same filters (from CORS local with Credentials)', 1, function() {
    //--Do Test Prep
    var more_docs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'}
    ];

    var opts = {localWithCORS: true, localWithCORSCredentials: true, localWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['remoteWithCORS'] = true;
      opts['remoteWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      remote.bulkDocs({docs: docs}, function(err, info) {
        //--Run tests
        db.replicate.from(remote, {
          filter: function(doc) { return doc.integer % 2 === 0; }
        }, function(err, response) {
          remote.bulkDocs({docs: more_docs}, function(err, info) {
            db.replicate.from(remote, {
              filter: function(doc) { return doc.integer % 2 === 0; }
            }, function(err, response) {
              ok(response.docs_written === 1, 'correct # of docs replicated');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Replication with deleted doc (from CORS remote with Credentials)', 1, function() {
    //--Do Test Prep
    var docs1 = [
      {_id: '0', integer: 0},
      {_id: '1', integer: 1},
      {_id: '2', integer: 2},
      {_id: '3', integer: 3},
      {_id: '4', integer: 4, _deleted: true}
    ];

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      remote.bulkDocs({docs: docs1}, function(err, info) {
        //--Run tests
        var replicate = db.replicate.from(remote, function() {
          db.allDocs(function(err, res) {
            equal(res.total_rows, 4, 'Replication with deleted docs');
            start();
          });
        });
      });
    });
  });

  asyncTest('Replication notifications (from CORS remote with Credentials)', function() {
    //--Do Test Prep
    var self = this;
    var changes = 0;
    var onChange = function(c) {
      changes++;
      ok(true, 'Got change notification');
      if (changes === 3) {
        ok(true, 'Got all change notification');
        start();
      }
    };

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        //--Run tests
        db.replicate.from(self.remote, {onChange: onChange, withCredentials: true});
      });
    });
  });

  asyncTest('Replication with remote conflict (from CORS remote with Credentials)', 2, function() {
    //--Do Test Prep
    var doc = {_id: 'test', test: 'Remote 1'},
        winningRev;

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      remote.post(doc, function(err, resp) {
        //--Run tests
        doc._rev = resp.rev;
        Pouch.replicate(remote, db, function(err, resp) {
          doc.test = 'Local 1';
          db.put(doc, function(err, resp) {
            doc.test = 'Remote 2';
            remote.put(doc, function(err, resp) {
              doc._rev = resp.rev;
              doc.test = 'Remote 3';
              remote.put(doc, function(err, resp) {
                winningRev = resp.rev;
                Pouch.replicate(db, remote, function(err, resp) {
                  Pouch.replicate(remote, db, function(err, resp) {
                    remote.get('test', {revs_info: true}, function(err, remotedoc) {
                      db.get('test', {revs_info: true}, function(err, localdoc) {
                        equal(localdoc._rev, winningRev, 'Local chose correct winning revision');
                        equal(remotedoc._rev, winningRev, 'Remote chose winning revision');
                        start();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  asyncTest('Replicate large number of docs (from CORS local with Credentials)', 1, function() {
    //--Do Test Prep
    var docs = [];
    var num = 30;
    for (var i = 0; i < num; i++) {
      docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
    }
    var opts = {localWithCORS: true, localWithCORSCredentials: true, localWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['remoteWithCORS'] = true;
      opts['remoteWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      remote.bulkDocs({docs: docs}, function(err, info) {
        //--Run tests
        var replicate = db.replicate.from(remote, {}, function() {
          db.allDocs(function(err, res) {
            equal(res.total_rows, num, 'Replication with deleted docs');
            start();
          });
        });
      });
    });
  });

});

// test a basic 'initialize pouch' scenario when couch instance contains deleted revisions
// currently testing idb-http only
deletedDocAdapters2.map(function(adapters) {
  qunit('CORS replication: ' + adapters[0] + ':' + adapters[1], {
    setup: function() {
      this.name = generateAdapterUrl(adapters[0]);
      this.remote = generateAdapterUrl(adapters[1]);
    },
    teardown: function() {
      var self = this;
      stop();
      if (typeof module !== undefined && !module.exports) {
        self.name = self.name.replace('5984', '2020');
        self.remote = self.remote.replace('5984', '2020');
      }
      if (adapters[1] === 'http-1') {
        Pouch.deleteCookieAuth(self.remote, function(err, ret, res) {
          tearDownAdminAndMemberConfig(self.remote, function(err, info) {
            disableCORSCredentials(self.remote, function(err, res) {
              disableCORS(self.remote, function(err, res) {
                Pouch.destroy(self.remote, function(err, res) {
                  cleanupTestDatabases();
                  start();
                });
              });
            });
          });
        });
      }
    }
  });

  //---------CORS Replication Tests----------//
  //These tests primarily concern turning enable_cors on, on the couchdb http server
  asyncTest('doc count after multiple replications with deleted revisions (using CORS remote)', function() {
    //--Do Test Prep
    var self = this;
    var runs = 2;

    // helper. remove each document in db and bulk load docs into same
    function rebuildDocuments(db, docs, callback) {
      db.allDocs({include_docs: true}, function(err, response) {
        var count = 0;
        var limit = response.rows.length;
        if (limit === 0) {
          bulkLoad(db, docs, callback);
        }
        response.rows.forEach(function(doc) {
          db.remove(doc, function(err, response) {
            ++count;
            if (count === limit) {
              bulkLoad(db, docs, callback);
            }
          });
        });
      });
    }

    // helper.
    function bulkLoad(db, docs, callback) {
      db.bulkDocs({docs: docs}, function(err, results) {
        if (err) {
          console.error('Unable to bulk load docs.  Err: ' + JSON.stringify(err));
          return;
        }
        callback(results);
      });
    }

    // a basic map function to mimic our testing situation
    function map(doc) {
      if (doc.common === true) {
        emit(doc._id, doc.rev);
      }
    }

    // The number of workflow cycles to perform. 2+ was always failing
    // reason for this test.
    var workflow = function(name, remote, x) {

      // some documents.  note that the variable Date component,
      //thisVaries, makes a difference.
      // when the document is otherwise static, couch gets the same hash
      // when calculating revision.
      // and the revisions get messed up in pouch
      var docs = [
        {_id: '0', integer: 0, thisVaries: new Date(), common: true},
        {_id: '1', integer: 1, thisVaries: new Date(), common: true},
        {_id: '2', integer: 2, thisVaries: new Date(), common: true},
        {_id: '3', integer: 3, thisVaries: new Date(), common: true}
      ];
      //--Run tests
      openTestDB(remote, function(err, dbr) {
        rebuildDocuments(dbr, docs, function() {
          openTestDB(name, function(err, db) {
            db.replicate.from(remote, function(err, result) {
              db.query({map: map}, {reduce: false}, function(err, result) {
                equal(result.rows.length, docs.length, 'correct # docs replicated');
                if (--x) {
                  workflow(name, remote, x);
                } else {
                  start();
                }
              });
            });
          });
        });
      });
    };

    //--Do Test Prep
    // new pouch and couch
    initCorsDBPair(self.name, self.remote, {remoteWithCORS: true}, function() {
      // Rinse, repeat our workflow...
      workflow(self.name, self.remote.replace('2020', '5984'), runs);
    });
  });

  asyncTest('issue #300 rev id unique per doc (using CORS remote)', 3, function() {
    //--Do Test Prep
    var docs = [{_id: 'a'}, {_id: 'b'}];
    var self = this;
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
      remote.bulkDocs({docs: docs}, {}, function(err, _) {
        //--Run tests
        db.replicate.from(self.remote, function(err, _) {
          db.allDocs(function(err, result) {
            ok(result.rows.length === 2, 'correct number of rows');
            ok(result.rows[0].id === 'a', 'first doc ok');
            ok(result.rows[1].id === 'b', 'second doc ok');
            start();
          });
        });
      });
    });
  });

  asyncTest('issue #585 Store checkpoint on target db (using CORS remote)', 3, function() {
    //--Do Test Prep
    var docs = [{_id: 'a'}, {_id: 'b'}];
    var self = this;
    initCorsDBPair(this.name, this.remote, {remoteWithCORS: true}, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');
        db.bulkDocs({docs: docs}, {}, function(err, _) {
          //--Run tests
          db.replicate.to(self.remote, function(err, result) {
            ok(result.docs_written === docs.length, 'docs replicated ok');
            Pouch.destroy(self.remote, function(err, result) {
              ok(result.ok === true, 'remote was deleted');
              db.replicate.to(self.remote, function(err, result) {
                ok(result.docs_written === docs.length, 'docs were written again because target was deleted.');
                start();
              });
            });
          });
        });
    });
  });

  //---------CORS with Credentials Replication Tests----------//
  //These tests primarily concern turning enable_cors on, on the couchdb http server
  //Setting the folloing cors settings on the couchdb http server: origins=http://127.0.0.1:8000 credentials=true
  //Note: these tests are always executed with a server admin user session
  asyncTest('doc count after multiple replications with deleted revisions (from CORS remote with Credentials)', function() {
    //--Do Test Prep
    var self = this;
    var runs = 2;

    // helper. remove each document in db and bulk load docs into same
    function rebuildDocuments(db, docs, callback) {
      db.allDocs({include_docs: true}, function(err, response) {
        var count = 0;
        var limit = response.rows.length;
        if (limit === 0) {
          bulkLoad(db, docs, callback);
        }
        response.rows.forEach(function(doc) {
          db.remove(doc, function(err, response) {
            ++count;
            if (count === limit) {
              bulkLoad(db, docs, callback);
            }
          });

        });
      });
    }

    // helper.
    function bulkLoad(db, docs, callback) {
      db.bulkDocs({docs: docs}, function(err, results) {
        if (err) {
          console.error('Unable to bulk load docs.  Err: ' + JSON.stringify(err));
          return;
        }
        callback(results);
      });
    }

    // a basic map function to mimic our testing situation
    function map(doc) {
      if (doc.common === true) {
        emit(doc._id, doc.rev);
      }
    }

    // The number of workflow cycles to perform. 2+ was always failing
    // reason for this test.
    var workflow = function(name, remote, x) {

      // some documents.  note that the variable Date component,
      //thisVaries, makes a difference.
      // when the document is otherwise static, couch gets the same hash
      // when calculating revision.
      // and the revisions get messed up in pouch
      var docs = [
        {_id: '0', integer: 0, thisVaries: new Date(), common: true},
        {_id: '1', integer: 1, thisVaries: new Date(), common: true},
        {_id: '2', integer: 2, thisVaries: new Date(), common: true},
        {_id: '3', integer: 3, thisVaries: new Date(), common: true}
      ];
      //--Run tests
      openTestDB(remote, function(err, dbr) {
        rebuildDocuments(dbr, docs, function() {
          openTestDB(name, function(err, db) {
            db.replicate.from(remote, function(err, result) {
              db.query({map: map}, {reduce: false}, function(err, result) {
                equal(result.rows.length, docs.length, 'correct # docs replicated');
                if (--x) {
                  workflow(name, remote, x);
                } else {
                  start();
                }
              });
            });
          });
        });
      });
    };

    //--Do Test Prep
    // new pouch and couch
    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      // Rinse, repeat our workflow...
      workflow(self.name, self.remote, runs);
    });
  });

  asyncTest('issue #300 rev id unique per doc (from CORS remote with Credentials)', 3, function() {
    //--Do Test Prep
    var docs = [{_id: 'a'}, {_id: 'b'}];
    var self = this;

    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      remote.bulkDocs({docs: docs}, {}, function(err, _) {
        //--Run tests
        db.replicate.from(self.remote, {withCredentials: true}, function(err, _) {
          db.allDocs(function(err, result) {
            ok(result.rows.length === 2, 'correct number of rows');
            ok(result.rows[0].id === 'a', 'first doc ok');
            ok(result.rows[1].id === 'b', 'second doc ok');
            start();
          });
        });
      });
    });
  });

  asyncTest('issue #585 Store checkpoint on target db (from CORS remote with Credentials)', 3, function() {
    //--Do Test Prep
    var docs = [{_id: 'a'}, {_id: 'b'}];
    var self = this;
    var opts = {remoteWithCORS: true, remoteWithCORSCredentials: true, remoteWithCookieAuth: true};
    //used for http-1 to http-2 because both use the same server
    if (adapters[1] === 'http-2') {
      opts['localWithCORS'] = true;
      opts['localWithCORSCredentials'] = true;
    }

    initCorsDBPair(this.name, this.remote, opts, function(db, remote) {
      self.remote = self.remote.replace('2020', '5984');

      //used for http-1 to http-2 because both use the same server
      if (adapters[1] === 'http-2') {
        self.name = self.name.replace('2020', '5984');
      }
      db.bulkDocs({docs: docs}, {}, function(err, _) {
        //--Run tests
        db.replicate.to(self.remote, {withCredentials: true}, function(err, result) {
          ok(result.docs_written === docs.length, 'docs replicated ok');
          Pouch.destroy(self.remote, {withCredentials: true}, function(err, result) {
            ok(result.ok === true, 'remote was deleted');
            db.replicate.to(self.remote, {withCredentials: true}, function(err, result) {
              ok(result.docs_written === docs.length, 'docs were written again because target was deleted.');
              start();
            });
          });
        });
      });
    });
  });
});

