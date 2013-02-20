/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true, makeDocs: false */

"use strict";

var remote = {
  host: 'localhost:2020'
};
var local = 'test_suite_db';
var qunit = module;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');
  ajax = Pouch.utils.ajax;

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit('auth_replication', {
  setup: function () {
    this.name = local;
    this.remote = 'http://' + remote.host + '/test_suite_db/';
  },
  teardown: function() {
    if (!PERSIST_DATABASES) {
      Pouch.destroy(this.name);
      Pouch.destroy(this.remote);
    }
  }
});

function login(username, password, callback) {
  ajax({
    type: 'POST',
    url: 'http://' + remote.host + '/_session',
    data: {name: username, password: password},
    beforeSend: function(xhr) {
      xhr.setRequestHeader('Accept', 'application/json');
    },
    success: function () {
      callback();
    },
    error: function (err) {
      callback(err);
    }
  });
}

function logout(callback) {
  ajax({
    type: 'DELETE',
    url: 'http://' + remote.host + '/_session',
    success: function () {
      callback();
    },
    error: function (err) {
      callback(err);
    }
  });
}

function createAdminUser(callback) {
  // create admin user
  var adminuser = {
    _id: 'org.couchdb.user:adminuser',
    name: 'adminuser',
    type: 'user',
    password: 'password',
    roles: []
  };

  ajax({
    url: 'http://' + remote.host + '/_config/admins/adminuser',
    type: 'PUT',
    data: JSON.stringify(adminuser.password),
    contentType: 'application/json',
    success: function () {
      setTimeout(function() {
        login('adminuser', 'password', function (err) {
          if (err) {
            return callback(err);
          }
          ajax({
            url: 'http://' + remote.host + '/_users/' +
              'org.couchdb.user%3Aadminuser',
            type: 'PUT',
            data: JSON.stringify(adminuser),
            contentType: 'application/json',
            dataType: 'json',
            success: function (data) {
              logout(function (err) {
                if (err) {
                  return callback(err);
                }
                callback(null, adminuser);
              });
            },
            error: function (err) {
              callback(null, adminuser);
            }
          });
        });
      }, 500);
    },
    error: function (err) {
      callback(err);
    }
  });
}

function deleteAdminUser(adminuser, callback) {
  ajax({
    type: 'DELETE',
    beforeSend: function (xhr) {
      var token = btoa('adminuser:password');
      xhr.setRequestHeader("Authorization", "Basic " + token);
    },
    url: 'http://' + remote.host + '/_config/admins/adminuser',
    contentType: 'application/json',
    success: function () {
      var adminUrl = 'http://' + remote.host + '/_users/' +
        'org.couchdb.user%3Aadminuser';
      ajax({
        type: 'GET',
        url: adminUrl,
        dataType: 'json',
        success: function(doc) {
          ajax({
            type: 'DELETE',
            url: 'http://' + remote.host + '/_users/' +
              'org.couchdb.user%3Aadminuser?rev=' + doc._rev,
            contentType: 'application/json',
            success: function () {
              callback();
            },
            error: function (err) {
              callback();
            }
          });
        },
        error: function() {
          callback();
        }
      });
    },
    error: function (err) {
      callback(err);
    }
  });
}

asyncTest("Replicate from DB as non-admin user", function() {
  // SEE: https://github.com/apache/couchdb/blob/master/share/www/script/couch_test_runner.js
  // - create new DB
  // - push docs to new DB
  // - add new admin user
  // - login as new admin user
  // - add new user (non admin)
  // - login as new user
  // - replicate from new DB
  // - login as admin user
  // - delete users and return to admin party
  // - delete original DB

  var self = this;

  var docs = [
    {_id: 'one', count: 1},
    {_id: 'two', count: 2}
  ];

  function cleanup() {
    deleteAdminUser(self.adminuser, function (err) {
      if (err) {
        console.error(err);
      }
      logout(function (err) {
        if (err) { 
          console.error(err);
        }
        start();
      });
    });
  }

  initDBPair(self.name, self.remote, function(db, remote) {

  // add user
  createAdminUser(function (err, adminuser) {
    if (err) {
      ok(false, 'unable to create admin user');
      console.error(err);
      return cleanup();
    }

    self.adminuser = adminuser;

    login('adminuser', 'password', function (err) {
      if (err) { 
        console.error(err);
      }
        remote.bulkDocs({docs: docs}, {}, function(err, results) {
          Pouch.replicate(self.remote, self.name, {}, function(err, result) {
            db.allDocs(function(err, result) {
              ok(result.rows.length === docs.length, 'correct # docs exist');
              cleanup();
            });
          });
        });
      });
    });
  });

});
