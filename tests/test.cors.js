/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, utils: true, extend: true */
/*globals ajax: true, strictEqual: false, Pouch: true */
/*globals cleanupTestDatabases: false, openTestDB: true, putAfter: false */
/*globals setupAdminAndMemberConfig:false, tearDownAdminAndMemberConfig:false */
/*globals cleanUpDB:false, enableCORS:false, enableCORSCredentials:false, call:false */
/*globals disableCORS: false, disableCORSCredentials: false */

'use strict';

var adapter = 'cors-1';
var qunit = module;
var CorsPouch;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  CorsPouch = require('../src/adapters/pouch.cors.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit('cors-adapter:', {
  setup: function () {
    stop();
    var self = this;
    generateAdapterUrl(adapter, function (name) {
      self.name = name;
      start();
    });
  },
  teardown: function () {
    stop();
    cleanUpDB(this.name, function () {
      cleanupTestDatabases();
    });
  }
});

//-------Cookie Auth Tests-----------//
asyncTest('Cookie Authentication with Admin.', function () {
  var name = this.name;

  //--Do Test Prep
  //setup security for db
  var testDB = new Pouch(name);
  testDB.put({
    _id: '_security',
    'admins': {
      'names': ['TestAdmin'],
      'roles': []
    },
    'members': {
      'names': ['TestUser'],
      'roles': []
    }
  }, function (err, res) {

    //add an admin and user
    setupAdminAndMemberConfig(name, function (err, info) {

      //--Run tests (NOTE: because of how this is run, COR's credentials must be sent so that the server receives the auth cookie)
      var instantDB = new Pouch(name, {
        cookieAuth: {
          username: 'TestAdmin',
          password: 'admin'
        }
      }, function (err, db) {
        ok(err === null, 'Cookie authentication.');
        db.post({
          _id: '_design/testdesign',
          views: {
            test_view: {
              map: 'function(doc){emit(doc._id,doc._rev);}'
            }
          }
        }, function (err, info) { //add design doc (only admins can do this)
          ok(err === null, 'Design Doc inserted.');

          //get rid of cookie used for auth
          Pouch.deleteCookieAuth(name, function (err, ret, res) {
            //get rid of admin and user
            if (typeof module !== undefined && module.exports) {
              tearDownAdminAndMemberConfig(name, function (err, info) {
                start();
              });
            } else {
              tearDownAdminAndMemberConfig(name.replace('5984','2020'), function (err, info) {
                start();
              });
            }
          });
        });
      });
    });
  });
});

asyncTest('Cookie Authentication with User.', 3, function () {
  var name = this.name;

  //--Do Test Prep
  //setup security for db first
  var testDB = new Pouch(name);
  testDB.put({
    _id: '_security',
    'admins': {
      'names': ['TestAdmin'],
      'roles': []
    },
    'members': {
      'names': ['TestUser'],
      'roles': []
    }
  }, function (err, res) {
    //add an admin and user
    setupAdminAndMemberConfig(name, function (err, info) {

      //--Run tests (NOTE: because of how this is run, COR's credentials must be sent so that the server recieves the auth cookie)
      var instantDB = new Pouch(name, {
        cookieAuth: {
          username: 'TestUser',
          password: 'user'
        }
      }, function (err, db) {
        ok(err === null, 'Cookie authentication.');
        db.post({
          _id: '_design/testdesign',
          views: {
            test_view: {
              map: 'function(doc){emit(doc._id,doc._rev);}'
            }
          }
        }, function (err, info) { //add design doc (only admins can do this)
          ok(err && err.error === 'unauthorized', 'Design Doc failed to be inserted because we are not a db admin.');
        });
        db.post({
          test: 'abc'
        }, function (err, info) {
          ok(err === null, 'Doc inserted.');

          //--Do Reset
          //get rid of cookie used for auth
          Pouch.deleteCookieAuth(name, function (err, ret, res) {
            //get rid of admin and user
            if (typeof module !== undefined && module.exports) {
              tearDownAdminAndMemberConfig(name, function (err, info) {
                start();
              });
            } else {
              tearDownAdminAndMemberConfig(name.replace('5984','2020'), function (err, info) {
                start();
              });
            }
          });
        });
      });
    });
  });
});

//-------CORS Enabled Tests----------//
asyncTest('Create a pouchDB with CORS', 1, function () {
  var name = this.name;

  //--Run Tests
  var instantDB = new Pouch(this.name, function (err, info) {
    ok(err === null, 'DB created.');

    //--Do Reset
    disableCORS(name, function (err, res) {
      start();
    });
  });
});

asyncTest('Add a doc using CORS', 2, function () {
  var name = this.name;

  //--Run Tests
  var instantDB = new Pouch(this.name, function (err, db) {
    ok(err === null, 'DB created.');
    db.post({
      test: 'abc'
    }, function (err, info) {
      ok(err === null, 'Doc inserted.');

      //--Do Reset
      disableCORS(name, function (err, res) {
        start();
      });
    });
  });
});

asyncTest('Delete a DB using CORS', 2, function () {
  var name = this.name;

  //--Run Tests
  var instantDB = new Pouch(this.name, function (err, db) {
    ok(err === null, 'DB created.');
    Pouch.destroy(name, function (err, db) {
      ok(err === null, 'DB destroyed.');

      //--Do Reset
      disableCORS(name, function (err, res) {
        start();
      });
    });
  });
});


//-------CORS Credentials Enabled Tests----------//
asyncTest('Create DB as Admin with CORS Credentials.', 2, function () {
  var name = this.name; //saved for prep and cleanup

  setupAdminAndMemberConfig(this.name, function (err, info) {
    //--Run tests
    var instantDB = new Pouch(name, {
      cookieAuth: {
        username: 'TestAdmin',
        password: 'admin'
      }
    }, function (err, db) {
      ok(err === null, 'DB Created.');
      db.info(function (err, info) {
        ok(err === null, 'DB Get Info.');

        //--Do Reset
        Pouch.deleteCookieAuth(name, function (err, ret, res) {
          if (typeof module !== undefined && module.exports) {
            tearDownAdminAndMemberConfig(name, function (err, info) {
              start();
            });
          } else {
            tearDownAdminAndMemberConfig(name.replace('5984','2020'), function (err, info) {
              start();
            });
          }
        });
      });
    });
  });
});

asyncTest('Add Doc to DB as User with CORS Credentials.', 2, function () {
  var name = this.name; //saved for prep and cleanup

  //--Do Test Prep
  //add an admin and user
  setupAdminAndMemberConfig(name, function (err, info) {

    //--Run tests
    var instantDB = new Pouch(name, {
      cookieAuth: {
        username: 'TestAdmin',
        password: 'admin'
      }
    }, function (err, db) {
      ok(err === null, 'DB Created.');
      db.post({
        test: 'abc'
      }, function (err, info) {
        ok(err === null, 'Doc Inserted.');

        //--Do Reset
        Pouch.deleteCookieAuth(name, function (err, ret, res) {
          if (typeof module !== undefined && module.exports) {
            tearDownAdminAndMemberConfig(name, function (err, info) {
              start();
            });
          } else {
            tearDownAdminAndMemberConfig(name.replace('5984','2020'), function (err, info) {
              start();
            });
          }
        });
      });
    });
  });
});

asyncTest('Delete DB as Admin with CORS Credentials.', 3, function () {
  var name = this.name; //saved for prep and cleanup

  //--Do Test Prep
  //add an admin and user
  setupAdminAndMemberConfig(name, function (err, info) {

    //--Run tests
    var instantDB = new Pouch(name, {
      cookieAuth: {
        username: 'TestAdmin',
        password: 'admin'
      }
    }, function (err, db) {
      ok(err === null, 'DB Created.');
      db.post({
        test: 'abc'
      }, function (err, res) {
        ok(err === null, 'Doc Inserted.');

        Pouch.destroy(name, {
          cookieAuth: {
            username: 'TestAdmin',
            password: 'admin'
          }
        }, function (err, res) {
          ok(err === null, 'DB Deleted.');

          //--Do Reset
          Pouch.deleteCookieAuth(name, function (err, ret, res) {
            if (typeof module !== undefined && module.exports) {
              tearDownAdminAndMemberConfig(name, function (err, info) {
                start();
              });
            } else {
              tearDownAdminAndMemberConfig(name.replace('5984','2020'), function (err, info) {
                start();
              });
            }
          });
        });
      });
    });
  });
});