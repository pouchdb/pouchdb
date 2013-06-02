/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, HTTPPouch: true */

'use strict';

var adapter = 'http-1';
var qunit = module;
var HTTPPouch;

if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js');
  HTTPPouch = require('../src/adapters/pouch.http.js');
  var utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit('http-adapter', {
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
    method: 'PUT', body: '"true"'}, function(err, res, resBody) {
    call(callback, err, res);
  });
}

//enable CORS Credentials on server
function enableCORSCredentials(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/cors/credentials',
    method: 'PUT', body: '"true"'}, function(err, res, resBody) {
      ajax({url: host + '_config/cors/origins', json: false,
        method: 'PUT', body: '"http://127.0.0.1:8000"'}, function(err, res, resBody) {
          call(callback, err, res);
      });
  });
}

//disable CORS
function disableCORS(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/httpd/enable_cors', json: false,
    method: 'PUT', body: '"false"'}, function(err, res, resBody) {
    call(callback, err, res);
  });
}

//disable CORS Credentials
function disableCORSCredentials(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/cors/credentials',
    method: 'PUT', body: '"false"'}, function(err, res, resBody) {
      ajax({url: host + '_config/cors/origins', json: false,
        method: 'PUT', body: '"*"'}, function(err, res, resBody) {
          call(callback, err, res);
      });
  });
}

//create admin user and member user
function setupAdminAndMemberConfig(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_users/org.couchdb.user:TestUser',
    method: 'PUT', body: {_id: 'org.couchdb.user:TestUser', name: 'TestUser',
    password: 'user', roles: [], type: 'user'}}, function(err, res, resBody) {
      ajax({url: host + '_config/admins/TestAdmin', json: false,
        method: 'PUT', body: '"admin"'}, function(err, res, resBody) {
          call(callback, err, res);
      });
  });
}

//delete admin and member user
function tearDownAdminAndMemberConfig(dburl, callback) {
  var host = dburl.split('/')[0] + '//' + dburl.split('/')[2] + '/';

  ajax({url: host + '_config/admins/TestAdmin',
    method: 'DELETE', auth: {username: 'TestAdmin', password: 'admin'}}, function(err, res, resBody) {
      ajax({url: host + '_users/org.couchdb.user:TestUser',
        method: 'GET', body: '"admin"'}, function(err, res, resBody) {
          ajax({url: host + '_users/org.couchdb.user:TestUser?rev=' + resBody['_rev'],
            method: 'DELETE'}, function(err, res, resBody) {
              call(callback, err, res);
          });
      });
  });
}


asyncTest('Create a pouch without DB setup', 1, function() {
  var name = this.name;
  var instantDB;

  Pouch.destroy(name, function(err, info) {
    instantDB = new Pouch(name, {skipSetup: true});
    instantDB.post({test: 'abc'}, function(err, info) {
      ok(err && err.error === 'not_found', 'Skipped setup of database');
      start();
    });
  });
});


//-------Cookie Auth Tests-----------//
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
