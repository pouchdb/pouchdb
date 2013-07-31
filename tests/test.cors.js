/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, utils: true, extend: true */
/*globals ajax: true, strictEqual: false, Pouch: true */
/*globals cleanupTestDatabases: false, openTestDB: true, putAfter: false */
/*globals setupAdminAndMemberConfig:false, tearDownAdminAndMemberConfig:false */
/*globals cleanUpCors:false, enableCORS:false, enableCORSCredentials:false, call:false */
/*globals disableCORS: false, disableCORSCredentials: false, deleteCookieAuth:false */

'use strict';

var adapter = 'http-1';
var qunit = module;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit('cors-adapter:', {
  setup: function () {
    this.name = generateAdapterUrl(adapter);
  },
  teardown: function () {
    if (!PERSIST_DATABASES) {
      stop();
      var name = this.name;
      //get rid of cookie used for auth
      deleteCookieAuth(name, function (err, ret, res) {
        //get rid of admin and user
        if (typeof module !== undefined && module.exports) {
          tearDownAdminAndMemberConfig(name, function (err, info) {
            cleanUpCors(name, function () {
              cleanupTestDatabases(true);
            });
          });
        } else {
          tearDownAdminAndMemberConfig(name.replace('5984','2020'), function (err, info) {
            cleanUpCors(name, function () {
              cleanupTestDatabases(true);
            });
          });
        }
      });
    }
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
      var host = 'http://' + name.split('/')[2] + '/';
      ajax({
        method: 'POST',
        url: host + '_session',
        json: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'name=TestAdmin&password=admin',
        withCredentials: true
      }, function(err, ret, res) {
        var instantDB = new Pouch(name, function (err, db) {
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
            start();
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
      var host = 'http://' + name.split('/')[2] + '/';
      ajax({
        method: 'POST',
        url: host + '_session',
        json: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'name=TestUser&password=user',
        withCredentials: true
      }, function(err, ret, res) {
        var instantDB = new Pouch(name, function (err, db) {
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
            start();
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
    start();
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
      start();
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
      start();
    });
  });
});


//-------CORS Credentials Enabled Tests----------//
asyncTest('Create DB as Admin with CORS Credentials.', 2, function () {
  var name = this.name; //saved for prep and cleanup

  setupAdminAndMemberConfig(this.name, function (err, info) {
    //--Run tests
    var host = 'http://' + name.split('/')[2] + '/';
      ajax({
        method: 'POST',
        url: host + '_session',
        json: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'name=TestAdmin&password=admin',
        withCredentials: true
      }, function(err, ret, res) {
      var instantDB = new Pouch(name, function (err, db) {
        ok(err === null, 'DB Created.');
        db.info(function (err, info) {
          ok(err === null, 'DB Get Info.');
          start();
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
    var host = 'http://' + name.split('/')[2] + '/';
      ajax({
        method: 'POST',
        url: host + '_session',
        json: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'name=TestAdmin&password=admin',
        withCredentials: true
      }, function(err, ret, res) {
      var instantDB = new Pouch(name, function (err, db) {
        ok(err === null, 'DB Created.');
        db.post({
          test: 'abc'
        }, function (err, info) {
          ok(err === null, 'Doc Inserted.');
          start();
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
    var host = 'http://' + name.split('/')[2] + '/';
      ajax({
        method: 'POST',
        url: host + '_session',
        json: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'name=TestAdmin&password=admin',
        withCredentials: true
      }, function(err, ret, res) {
      var instantDB = new Pouch(name, function (err, db) {
        ok(err === null, 'DB Created.');
        db.post({
          test: 'abc'
        }, function (err, res) {
          ok(err === null, 'Doc Inserted.');

          Pouch.destroy(name, function (err, res) {
            ok(err === null, 'DB Deleted.');
            start();
          });
        });
      });
    });
  });
});