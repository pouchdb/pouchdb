/*globals PouchAdapter: true, extend: true */

"use strict";

var Pouch = function Pouch(name, opts, callback) {

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
    callback = function() {};
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

  var adapter = new PouchAdapter(opts, function(err, db) {
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
};

Pouch.DEBUG = false;
Pouch.openReqList = {};
Pouch.adapters = {};
Pouch.plugins = {};

Pouch.prefix = '_pouch_';

Pouch.parseAdapter = function(name) {
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

Pouch.destroy = function(name, callback) {
  var opts = Pouch.parseAdapter(name);
  var cb = function(err, response) {
    if (err) {
      callback(err);
      return;
    }

    for (var plugin in Pouch.plugins) {
      Pouch.plugins[plugin]._delete(name);
    }
    if (Pouch.DEBUG) {
      console.log(name + ': Delete Database');
    }

    // call destroy method of the particular adaptor
    Pouch.adapters[opts.adapter].destroy(opts.name, callback);
  };

  // remove Pouch from allDBs
  Pouch.removeFromAllDbs(opts, cb);
};

Pouch.removeFromAllDbs = function(opts, callback) {
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
  new Pouch(Pouch.allDBName(opts.adapter), function(err, db) {
    if (err) {
      // don't fail when allDbs fail
      console.error(err);
      callback();
      return;
    }
    // check if db has been registered in Pouch.ALL_DBS
    var dbname = Pouch.dbName(opts.adapter, opts.name);
    db.get(dbname, function(err, doc) {
      if (err) {
        callback();
      } else {
        db.remove(doc, function(err, response) {
          if (err) {
            console.error(err);
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

Pouch.plugin = function(id, obj) {
  Pouch.plugins[id] = obj;
};

// flag to toggle allDbs (off by default)
Pouch.enableAllDbs = false;

// name of database used to keep track of databases
Pouch.ALL_DBS = "_allDbs";
Pouch.dbName = function(adapter, name) {
  return [adapter, "-", name].join('');
};
Pouch.realDBName = function(adapter, name) {
  return [adapter, "://", name].join('');
};
Pouch.allDBName = function(adapter) {
  return [adapter, "://", Pouch.prefix + Pouch.ALL_DBS].join('');
};

Pouch.open = function(opts, callback) {
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

  new Pouch(Pouch.allDBName(adapter), function(err, db) {
    if (err) {
      // don't fail when allDb registration fails
      console.error(err);
      callback();
      return;
    }

    // check if db has been registered in Pouch.ALL_DBS
    var dbname = Pouch.dbName(adapter, opts.name);
    db.get(dbname, function(err, response) {
      if (err && err.status === 404) {
        db.put({
          _id: dbname,
          dbname: opts.originalName
        }, function(err) {
            if (err) {
                console.error(err);
            }

            callback();
        });
      } else {
        callback();
      }
    });
  });
};

Pouch.allDbs = function(callback) {
  var accumulate = function(adapters, all_dbs) {
    if (adapters.length === 0) {
      // remove duplicates
      var result = [];
      all_dbs.forEach(function(doc) {
        var exists = result.some(function(db) {
          return db.id === doc.id;
        });

        if (!exists) {
          result.push(doc);
        }
      });

      // return an array of dbname
      callback(null, result.map(function(row) {
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

    new Pouch(Pouch.allDBName(adapter), function(err, db) {
      if (err) {
        callback(err);
        return;
      }
      db.allDocs({include_docs: true}, function(err, response) {
        if (err) {
          callback(err);
          return;
        }

        // append from current adapter rows
        all_dbs.unshift.apply(all_dbs, response.rows);

        // code to clear allDbs.
        // response.rows.forEach(function(row) {
        //   db.remove(row.doc, function() {
        //     console.log(arguments);
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

/*
  Examples:

  >>> Pouch.uuids()
  "92329D39-6F5C-4520-ABFC-AAB64544E172"]

  >>> Pouch.uuids(10, {length: 32, radix: 5})
  [ '04422200002240221333300140323100',
    '02304411022101001312440440020110',
    '41432430322114143303343433433030',
    '21234330022303431304443100330401',
    '23044133434242034101422131301213',
    '43142032223224403322031032232041',
    '41121132424023141101403324200330',
    '00341042023103204342124004122342',
    '01001141433040113422403034004214',
    '30221232324132303123433131020020' ]
 */
Pouch.uuids = function (count, options) {
  if (typeof(options) !== 'object') {
    options = {};
  }

  var length = options.length;
  var radix = options.radix;

  var uuids = [];

  while (uuids.push(Math.uuid(length, radix)) < count) {
  }

  return uuids;
};

// Give back one UUID
Pouch.uuid = function (options) {
  return Pouch.uuids(1, options)[0];
};

// Enumerate errors, add the status code so we can reflect the HTTP api
// in future
Pouch.Errors = {
  MISSING_BULK_DOCS: {
    status: 400,
    error: 'bad_request',
    reason: "Missing JSON list of 'docs'"
  },
  MISSING_DOC: {
    status: 404,
    error: 'not_found',
    reason: 'missing'
  },
  REV_CONFLICT: {
    status: 409,
    error: 'conflict',
    reason: 'Document update conflict'
  },
  INVALID_ID: {
    status: 400,
    error: 'invalid_id',
    reason: '_id field must contain a string'
  },
  MISSING_ID: {
    status: 412,
    error: 'missing_id',
    reason: '_id is required for puts'
  },
  RESERVED_ID: {
    status: 400,
    error: 'bad_request',
    reason: 'Only reserved document ids may start with underscore.'
  },
  NOT_OPEN: {
    status: 412,
    error: 'precondition_failed',
    reason: 'Database not open so cannot close'
  },
  UNKNOWN_ERROR: {
    status: 500,
    error: 'unknown_error',
    reason: 'Database encountered an unknown error'
  },
  BAD_ARG: {
    status: 500,
    error: 'badarg',
    reason: 'Some query argument is invalid'
  },
  INVALID_REQUEST: {
    status: 400,
    error: 'invalid_request',
    reason: 'Request was invalid'
  },
  QUERY_PARSE_ERROR: {
    status: 400,
    error: 'query_parse_error',
    reason: 'Some query parameter is invalid'
  },
  DOC_VALIDATION: {
    status: 500,
    error: 'doc_validation',
    reason: 'Bad special document member'
  },
  BAD_REQUEST: {
    status: 400,
    error: 'bad_request',
    reason: 'Something wrong with the request'
  },
  NOT_AN_OBJECT: {
    status: 400,
    error: 'bad_request',
    reason: 'Document must be a JSON object'
  }
};
Pouch.error = function(error, reason){
 return extend({}, error, {reason: reason});
};
if (typeof module !== 'undefined' && module.exports) {
  global.Pouch = Pouch;
  global.PouchDB = Pouch;
  Pouch.merge = require('./pouch.merge.js').merge;
  Pouch.collate = require('./pouch.collate.js').collate;
  Pouch.replicate = require('./pouch.replicate.js').replicate;
  Pouch.utils = require('./pouch.utils.js');
  extend = Pouch.utils.extend;
  module.exports = Pouch;
  var PouchAdapter = require('./pouch.adapter.js');
  //load adapters known to work under node
  var adapters = ['leveldb', 'http'];
  adapters.map(function(adapter) {
    var adapter_path = './adapters/pouch.'+adapter+'.js';
    require(adapter_path);
  });
  require('./plugins/pouchdb.mapreduce.js');
  require('./deps/uuid.js');
} else {
  window.Pouch = Pouch;
  window.PouchDB = Pouch;
}
