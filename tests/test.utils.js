'use strict';

var testUtils = {};

testUtils.PERSIST_DATABASES = false;

testUtils.couchHost = function() {
  if (typeof module !== 'undefined' && module.exports) {
    return process.env.COUCH_HOST || 'http://localhost:5984';
  }
  // In the browser we default to the CORS server, in future will change
  return 'http://localhost:2020';
}

testUtils.cleanupAllDbs = function() {

  var deleted = 0;
  var adapters = Object.keys(PouchDB.adapters).filter(function(adapter) {
    return adapter !== 'http' && adapter !== 'https';
  });

  function finished() {
    // Restart text execution
    start();
  }

  function dbDeleted() {
    deleted++;
    if (deleted === adapters.length) {
      finished();
    }
  }

  if (!adapters.length) {
    finished();
  }

  // Remove old allDbs to prevent DOM exception
  adapters.forEach(function(adapter) {
    if (adapter === "http" || adapter === "https") {
      return;
    }
    PouchDB.destroy(PouchDB.allDBName(adapter), dbDeleted);
  });
}

testUtils.cleanupTestDatabases = function(alreadyStopped_) {

  if (testUtils.PERSIST_DATABASES) {
    return;
  }

  // Stop the tests from executing
  if(!alreadyStopped_) {
      stop();
  }

  var dbCount;
  var deleted = 0;

  function finished() {
    testUtils.cleanupAllDbs();
  }

  function dbDeleted() {
    if (++deleted === dbCount) {
      finished();
    }
  }

  PouchDB.allDbs(function(err, dbs) {
    if (!dbs.length) {
      finished();
    }
    dbCount = dbs.length;
    dbs.forEach(function(db) {
      PouchDB.destroy(db, dbDeleted);
    });
  });
}

testUtils.uuid = function() {
  var S4 = function() {
    return Math.floor(Math.random() * 0x10000).toString(16);
  };

  return (
    S4() + S4() + "-" +
      S4() + "-" +
      S4() + "-" +
      S4() + "-" +
      S4() + S4() + S4()
  );
}

testUtils.makeBlob = function(data, type) {
  if (typeof module !== 'undefined' && module.exports) {
    return new Buffer(data);
  } else {
    return new Blob([data], {type: type});
  }
}

testUtils.readBlob = function(blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString());
  } else {
    var reader = new FileReader();
    reader.onloadend = function(e) {
      callback(this.result);
    };
    reader.readAsBinaryString(blob);
  }
}

testUtils.base64Blob = function(blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString('base64'));
  } else {
    var reader = new FileReader();
    reader.onloadend = function(e) {
      var base64 = this.result.replace(/data:.*;base64,/, '');
      callback(base64);
    };
    reader.readAsDataURL(blob);
  }
}

testUtils.openTestAsyncDB = function(name) {
  return new PouchDB(name, function(err,db) {
    if (err) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
  });
}

testUtils.openTestDB = function(name, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  new PouchDB(name, opts, function(err, db) {
    if (err) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
    callback.apply(this, arguments);
  });
}

testUtils.initTestDB = function(name, opts, callback) {
  // ignore errors, the database might not exist
  PouchDB.destroy(name, function(err) {
    if (err && err.status !== 404 && err.statusText !== 'timeout') {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
    testUtils.openTestDB(name, opts, callback);
  });
}

testUtils.initDBPair = function(local, remote, callback) {
  testUtils.initTestDB(local, function(err, localDb) {
    testUtils.initTestDB(remote, function(err, remoteDb) {
      callback(localDb, remoteDb);
    });
  });
}

var testId = testUtils.uuid();

testUtils.generateAdapterUrl = function(id) {
  var opt = id.split('-');
  if (opt[0] === 'local') {
    return 'testdb_' + testId + '_' + opt[1];
  }
  if (opt[0] === 'http') {
    return testUtils.couchHost() + '/testdb_' + testId + '_' + opt[1];
  }
}

// Put doc after prevRev (so that doc is a child of prevDoc
// in rev_tree). Doc must have _rev. If prevRev is not specified
// just insert doc with correct _rev (new_edits=false!)
testUtils.putAfter = function(db, doc, prevRev, callback){
  var newDoc = PouchDB.extend({}, doc);
  if (!prevRev) {
    db.put(newDoc, {new_edits: false}, callback);
    return;
  }
  newDoc._revisions = {
    start: +newDoc._rev.split('-')[0],
    ids: [
      newDoc._rev.split('-')[1],
      prevRev.split('-')[1]
    ]
  };
  db.put(newDoc, {new_edits: false}, callback);
}

// docs will be inserted one after another
// starting from root
testUtils.putBranch = function(db, docs, callback) {
  function insert(i) {
    var doc = docs[i];
    var prev = i > 0 ? docs[i-1]._rev : null;
    function next() {
      if (i < docs.length - 1) {
        insert(i+1);
      } else {
        callback();
      }
    }
    db.get(doc._id, {rev: doc._rev}, function(err, ok){
      if(err){
        testUtils.putAfter(db, docs[i], prev, function(err, doc) {
          next();
        });
      }else{
        next();
      }
    });
  }
  insert(0);
};


testUtils.putTree = function(db, tree, callback) {
  function insert(i) {
    var branch = tree[i];
    testUtils.putBranch(db, branch, function() {
      if (i < tree.length - 1) {
        insert(i+1);
      } else {
        callback();
      }
    });
  }
  insert(0);
};

testUtils.writeDocs = function(db, docs, callback, res) {
  if (!res) {
    res = [];
  }
  if (!docs.length) {
    return callback(null, res);
  }
  var doc = docs.shift();
  db.put(doc, function(err, info) {
    ok(info && info.ok, 'docwrite returned ok');
    res.push(info);
    testUtils.writeDocs(db, docs, callback, res);
  });
};


// Borrowed from: http://stackoverflow.com/a/840849
testUtils.eliminateDuplicates = function(arr) {
  var i, element,
      len = arr.length,
      out = [],
      obj = {};

  for (i=0; i<len; i++) {
    obj[arr[i]]=0;
  }

  for (element in obj) {
    out.push(element);
  }

  return out;
}

// ---- CORS Specific Utils ---- //
//enable CORS on server
testUtils.enableCORS = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({url: host + '_config/httpd/enable_cors', json: false,
    method: 'PUT', body: '"true"'}, function(err, resBody, req) {
      PouchDB.ajax({url: host + '_config/cors/origins', json: false,
        method: 'PUT', body: '"http://127.0.0.1:8000"'}, function(err, resBody, req) {
          callback(err, req);
      });
  });
}

//enable CORS Credentials on server
testUtils.enableCORSCredentials = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({url: host + '_config/cors/credentials',
    method: 'PUT', body: '"true"', json: false}, function(err, resBody, req) {
      callback(err, req);
  });
}

//disable CORS
testUtils.disableCORS = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({
    url: host + '_config/cors/origins',
    json: false,
    method: 'PUT',
    body: '"*"'
  }, function (err, resBody, req) {
    PouchDB.ajax({
      url: host + '_config/httpd/enable_cors',
      json: false,
      method: 'PUT',
      body: '"false"'
    }, function (err, resBody, req) {
      callback(err, req);
    });
  });
}

//disable CORS Credentials
testUtils.disableCORSCredentials = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({
    url: host + '_config/cors/credentials',
    method: 'PUT',
    body: '"false"',
    json: false
  }, function (err, resBody, req) {
    callback(err, req);
  });
}

//create admin user and member user
testUtils.setupAdminAndMemberConfig = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({url: host + '_users/org.couchdb.user:TestUser',
    method: 'PUT', body: {_id: 'org.couchdb.user:TestUser', name: 'TestUser',
    password: 'user', roles: [], type: 'user'}}, function(err, resBody, req) {
      PouchDB.ajax({url: host + '_config/admins/TestAdmin', json: false,
        method: 'PUT', body: '"admin"'}, function(err, resBody, req) {
          callback(err, req);
      });
  });
}

//delete admin and member user
testUtils.tearDownAdminAndMemberConfig = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';
  var headers = {};
  var token = btoa('TestAdmin:admin');
  headers.Authorization = 'Basic ' + token;
  PouchDB.ajax({url: host + '_config/admins/TestAdmin',
    method: 'DELETE', headers:headers , json: false}, function(err, resBody, req) {
      PouchDB.ajax({url: host + '_users/org.couchdb.user:TestUser',
        method: 'GET', body: '"admin"'}, function(err, resBody, req) {
          if (resBody) {
            PouchDB.ajax({url: host + '_users/org.couchdb.user:TestUser?rev=' + resBody['_rev'],
              method: 'DELETE', json: false}, function(err, resBody, req) {
                callback(err, req);
            });
          } else {
            callback(err, req);
          }
      });
  });
}

testUtils.deleteCookieAuth = function(dburl, callback_) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({
    method: 'DELETE',
    url: host + '_session',
    withCredentials: true,
    json: false
  }, callback_);
}

testUtils.cleanUpCors = function(dburl, callback_) {
  if (testUtils.PERSIST_DATABASES) {
    return;
  }

  if (typeof module !== 'undefined' && module.exports) {
    disableCORS(dburl, function() {
      PouchDB.destroy(dburl, callback_);
    });
  } else {
    disableCORS(dburl.replace('5984','2020'), function() {
      PouchDB.destroy(dburl.replace('5984','2020'), callback_);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  PouchDB = require('../lib');
  module.exports = testUtils;
}
