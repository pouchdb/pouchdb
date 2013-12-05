"use strict";

var PouchUtils = require('./utils');
var PouchAdapter = require('./adapter')(Pouch);
function Pouch(name, opts, callback) {

  if (!(this instanceof Pouch)) {
    return new Pouch(name, opts, callback);
  }

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

  var backend = Pouch.parseAdapter(opts.name || name);
  opts.originalName = name;
  opts.name = opts.name || backend.name;
  opts.adapter = opts.adapter || backend.adapter;

  if (!Pouch.adapters[opts.adapter]) {
    throw 'Adapter is missing';
  }

  if (!Pouch.adapters[opts.adapter].valid()) {
    throw 'Invalid Adapter';
  }

  var adapter = new PouchAdapter(opts, function (err, db) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return;
    }

    for (var plugin in Pouch.plugins) {
      // In future these will likely need to be async to allow the plugin
      // to initialise
      var pluginObj = Pouch.plugins[plugin](db);
      for (var api in pluginObj) {
        // We let things like the http adapter use its own implementation
        // as it shares a lot of code
        if (!(api in db)) {
          db[api] = pluginObj[api];
        }
      }
    }
    db.taskqueue.ready(true);
    db.taskqueue.execute(db);
    callback(null, db);
  });
  for (var j in adapter) {
    this[j] = adapter[j];
  }
  for (var plugin in Pouch.plugins) {
    // In future these will likely need to be async to allow the plugin
    // to initialise
    var pluginObj = Pouch.plugins[plugin](this);
    for (var api in pluginObj) {
      // We let things like the http adapter use its own implementation
      // as it shares a lot of code
      if (!(api in this)) {
        this[api] = pluginObj[api];
      }
    }
  }
}

Pouch.adapters = {};
Pouch.plugins = {};

Pouch.prefix = '_pouch_';

Pouch.parseAdapter = function (name) {
  var match = name.match(/([a-z\-]*):\/\/(.*)/);
  var adapter;
  if (match) {
    // the http adapter expects the fully qualified name
    name = /http(s?)/.test(match[1]) ? match[1] + '://' + match[2] : match[2];
    adapter = match[1];
    if (!Pouch.adapters[adapter].valid()) {
      throw 'Invalid adapter';
    }
    return {name: name, adapter: match[1]};
  }

  var preferredAdapters = ['idb', 'leveldb', 'websql'];
  for (var i = 0; i < preferredAdapters.length; ++i) {
    if (preferredAdapters[i] in Pouch.adapters) {
      adapter = Pouch.adapters[preferredAdapters[i]];
      var use_prefix = 'use_prefix' in adapter ? adapter.use_prefix : true;

      return {
        name: use_prefix ? Pouch.prefix + name : name,
        adapter: preferredAdapters[i]
      };
    }
  }

  throw 'No valid adapter found';
};

Pouch.destroy = function (name, opts, callback) {
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
  var backend = Pouch.parseAdapter(opts.name || name);

  var cb = function (err, response) {
    if (err) {
      callback(err);
      return;
    }

    for (var plugin in Pouch.plugins) {
      Pouch.plugins[plugin]._delete(backend.name);
    }
    //console.log(backend.name + ': Delete Database');

    // call destroy method of the particular adaptor
    Pouch.adapters[backend.adapter].destroy(backend.name, opts, callback);
  };

  // remove Pouch from allDBs
  Pouch.removeFromAllDbs(backend, cb);
};

Pouch.removeFromAllDbs = function (opts, callback) {
  // Only execute function if flag is enabled
  if (!Pouch.enableAllDbs) {
    callback();
    return;
  }

  // skip http and https adaptors for allDbs
  var adapter = opts.adapter;
  if (adapter === "http" || adapter === "https") {
    callback();
    return;
  }

  // remove db from Pouch.ALL_DBS
  new Pouch(Pouch.allDBName(opts.adapter), function (err, db) {
    if (err) {
      // don't fail when allDbs fail
      //console.error(err);
      callback();
      return;
    }
    // check if db has been registered in Pouch.ALL_DBS
    var dbname = Pouch.dbName(opts.adapter, opts.name);
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

Pouch.adapter = function (id, obj) {
  if (obj.valid()) {
    Pouch.adapters[id] = obj;
  }
};

Pouch.plugin = function (id, obj) {
  Pouch.plugins[id] = obj;
};

// flag to toggle allDbs (off by default)
Pouch.enableAllDbs = false;

// name of database used to keep track of databases
Pouch.ALL_DBS = "_allDbs";
Pouch.dbName = function (adapter, name) {
  return [adapter, "-", name].join('');
};
Pouch.realDBName = function (adapter, name) {
  return [adapter, "://", name].join('');
};
Pouch.allDBName = function (adapter) {
  return [adapter, "://", Pouch.prefix + Pouch.ALL_DBS].join('');
};

Pouch.open = function (opts, callback) {
  // Only register pouch with allDbs if flag is enabled
  if (!Pouch.enableAllDbs) {
    callback();
    return;
  }

  var adapter = opts.adapter;
  // skip http and https adaptors for allDbs
  if (adapter === "http" || adapter === "https") {
    callback();
    return;
  }

  new Pouch(Pouch.allDBName(adapter), function (err, db) {
    if (err) {
      // don't fail when allDb registration fails
      //console.error(err);
      callback();
      return;
    }

    // check if db has been registered in Pouch.ALL_DBS
    var dbname = Pouch.dbName(adapter, opts.name);
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

Pouch.allDbs = function (callback) {
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

    new Pouch(Pouch.allDBName(adapter), function (err, db) {
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
  var adapters = Object.keys(Pouch.adapters);
  accumulate(adapters, []);
};

// Enumerate errors, add the status code so we can reflect the HTTP api
// in future


module.exports = Pouch;

Pouch.ajax = require('./deps/ajax');
Pouch.extend = require('./deps/extend');
Pouch.utils = PouchUtils;
Pouch.Errors = require('./deps/errors');
Pouch.replicate = require('./replicate').replicate;
Pouch.version = require('./version');
var httpAdapter = require('./adapters/http');
Pouch.adapter('http', httpAdapter);
Pouch.adapter('https', httpAdapter);

Pouch.adapter('idb', require('./adapters/idb'));
Pouch.adapter('websql', require('./adapters/websql'));
Pouch.plugin('mapreduce', require('pouchdb-mapreduce'));

if (!process.browser) {
  var ldbAdapter = require('./adapters/leveldb');
  Pouch.adapter('ldb', ldbAdapter);
  Pouch.adapter('leveldb', ldbAdapter);
}
