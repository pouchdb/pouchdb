"use strict";

var PouchDB = require("./constructor");

PouchDB.prototype.adapters = {};
PouchDB.prototype.plugins = {};

PouchDB.prototype.prefix = '_pouch_';

PouchDB.prototype.parseAdapter = function (name) {
  var match = name.match(/([a-z\-]*):\/\/(.*)/);
  var adapter;
  if (match) {
    // the http adapter expects the fully qualified name
    name = /http(s?)/.test(match[1]) ? match[1] + '://' + match[2] : match[2];
    adapter = match[1];
    if (!this.adapters[adapter].valid()) {
      throw 'Invalid adapter';
    }
    return {name: name, adapter: match[1]};
  }

  var preferredAdapters = ['idb', 'leveldb', 'websql'];
  for (var i = 0; i < preferredAdapters.length; ++i) {
    if (preferredAdapters[i] in this.adapters) {
      adapter = this.adapters[preferredAdapters[i]];
      var use_prefix = 'use_prefix' in adapter ? adapter.use_prefix : true;

      return {
        name: use_prefix ? PouchDB.prototype.prefix + name : name,
        adapter: preferredAdapters[i]
      };
    }
  }

  throw 'No valid adapter found';
};

PouchDB.destroy = function (name, opts, callback) {
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (typeof name === 'object') {
    opts = name;
    name = undefined;
  }

  if (typeof callback === 'undefined') {
    callback = function () {};
  }
  var backend = PouchDB.prototype.parseAdapter(opts.name || name);
  var dbName = backend.name;

  var cb = function (err, response) {
    if (err) {
      callback(err);
      return;
    }

    for (var plugin in PouchDB.prototype.plugins) {
      PouchDB.prototype.plugins[plugin]._delete(dbName);
    }
    //console.log(dbName + ': Delete Database');

    // call destroy method of the particular adaptor
    PouchDB.prototype.adapters[backend.adapter].destroy(dbName, opts, callback);
  };

  // remove PouchDB from allDBs
  PouchDB.removeFromAllDbs(backend, cb);
};

PouchDB.removeFromAllDbs = function (opts, callback) {
  // Only execute function if flag is enabled
  if (!PouchDB.enableAllDbs) {
    callback();
    return;
  }

  // skip http and https adaptors for allDbs
  var adapter = opts.adapter;
  if (adapter === "http" || adapter === "https") {
    callback();
    return;
  }

  // remove db from PouchDB.prototype.ALL_DBS
  new PouchDB(PouchDB.allDBName(opts.adapter), function (err, db) {
    if (err) {
      // don't fail when allDbs fail
      //console.error(err);
      callback();
      return;
    }
    // check if db has been registered in PouchDB.prototype.ALL_DBS
    var dbname = PouchDB.dbName(opts.adapter, opts.name);
    db.get(dbname, function (err, doc) {
      if (err) {
        callback();
      } else {
        db.remove(doc, function (err, response) {
          if (err) {
            //console.error(err);
          }
          callback();
        });
      }
    });
  });

};

PouchDB.adapter = function (id, obj) {
  if (obj.valid()) {
    PouchDB.prototype.adapters[id] = obj;
  }
};

PouchDB.plugin = function (id, obj) {
  PouchDB.prototype.plugins[id] = obj;
};

// flag to toggle allDbs (off by default)
PouchDB.enableAllDbs = false;

// name of database used to keep track of databases
PouchDB.prototype.ALL_DBS = "_allDbs";
PouchDB.dbName = function (adapter, name) {
  return [adapter, "-", name].join('');
};
PouchDB.realDBName = function (adapter, name) {
  return [adapter, "://", name].join('');
};
PouchDB.allDBName = function (adapter) {
  return [adapter, "://", PouchDB.prototype.prefix + PouchDB.prototype.ALL_DBS].join('');
};

PouchDB.prototype.open = function (opts, callback) {
  // Only register pouch with allDbs if flag is enabled
  if (!PouchDB.enableAllDbs) {
    callback();
    return;
  }

  var adapter = opts.adapter;
  // skip http and https adaptors for allDbs
  if (adapter === "http" || adapter === "https") {
    callback();
    return;
  }

  new PouchDB(PouchDB.allDBName(adapter), function (err, db) {
    if (err) {
      // don't fail when allDb registration fails
      //console.error(err);
      callback();
      return;
    }

    // check if db has been registered in PouchDB.prototype.ALL_DBS
    var dbname = PouchDB.dbName(adapter, opts.name);
    db.get(dbname, function (err, response) {
      if (err && err.status === 404) {
        db.put({
          _id: dbname,
          dbname: opts.originalName
        }, function (err) {
            if (err) {
              //console.error(err);
            }

            callback();
          });
      } else {
        callback();
      }
    });
  });
};

PouchDB.allDbs = function (callback) {
  var accumulate = function (adapters, all_dbs) {
    if (adapters.length === 0) {
      // remove duplicates
      var result = [];
      all_dbs.forEach(function (doc) {
        var exists = result.some(function (db) {
          return db.id === doc.id;
        });

        if (!exists) {
          result.push(doc);
        }
      });

      // return an array of dbname
      callback(null, result.map(function (row) {
          return row.doc.dbname;
        }));
      return;
    }

    var adapter = adapters.shift();

    // skip http and https adaptors for allDbs
    if (adapter === "http" || adapter === "https") {
      accumulate(adapters, all_dbs);
      return;
    }

    new PouchDB(PouchDB.allDBName(adapter), function (err, db) {
      if (err) {
        callback(err);
        return;
      }
      db.allDocs({include_docs: true}, function (err, response) {
        if (err) {
          callback(err);
          return;
        }

        // append from current adapter rows
        all_dbs.unshift.apply(all_dbs, response.rows);

        // code to clear allDbs.
        // response.rows.forEach(function (row) {
        //   db.remove(row.doc, function () {
        //     //console.log(arguments);
        //   });
        // });

        // recurse
        accumulate(adapters, all_dbs);
      });
    });
  };
  var adapters = Object.keys(PouchDB.prototype.adapters);
  accumulate(adapters, []);
};

module.exports = PouchDB;
