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

  var backend = Pouch.parseAdapter(opts.name || name);
  opts.name = opts.name || backend.name;
  opts.adapter = opts.adapter || backend.adapter;

  if (!Pouch.adapters[opts.adapter]) {
    throw 'Adapter is missing';
  }

  if (!Pouch.adapters[opts.adapter].valid()) {
    throw 'Invalid Adapter';
  }

  var that = this;
  var cb = function(err) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return;
    }

    var adapter = Pouch.adapters[opts.adapter](opts, function(err, db) {
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
      callback(null, db);
    });
    for (var j in adapter) {
      that[j] = adapter[j];
    }
  };

  // Don't call Pouch.open for ALL_DBS
  // Pouch.open saves the db's name into ALL_DBS
  if (name === Pouch.allDBName(opts.adapter)) {
    cb();
  } else {
    Pouch.open(opts.adapter, opts.name, cb);
  }
};

Pouch.DEBUG = false;

Pouch.adapters = {};
Pouch.plugins = {};

Pouch.parseAdapter = function(name) {

  var match = name.match(/([a-z\-]*):\/\/(.*)/);
  if (match) {
    // the http adapter expects the fully qualified name
    name = /http(s?)/.test(match[1]) ? match[1] + '://' + match[2] : match[2];
    var adapter = match[1];
    if (!Pouch.adapters[adapter].valid()) {
      throw 'Invalid adapter';
    }
    return {name: name, adapter: match[1]};
  }

  var rank = {'idb': 1, 'leveldb': 2, 'websql': 3, 'http': 4, 'https': 4};
  var rankedAdapter = Object.keys(Pouch.adapters).sort(function(a, b) {
    return rank[a] - rank[b];
  })[0];

  return {
    name: name,
    adapter: rankedAdapter
  };

  throw 'No Valid Adapter.';
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

  // skip http and https adaptors for _all_dbs
  var adapter = opts.adapter;
  if (adapter === "http" || adapter === "https") {
    cb();
    return;
  }

  // remove db from Pouch.ALL_DBS
  new Pouch(Pouch.allDBName(opts.adapter), function(err, db) {
    if (err) {
      callback(err);
      return;
    }
    // check if db has been registered in Pouch.ALL_DBS
    var map = function(doc) {
      emit(doc.name, doc);
    };
    db.query({map: map},{
      key: opts.name,
      reduce: false
    }, function(err, response) {
      if (err) {
        callback(err);
        return;
      }

      if (response.rows.length === 0) {
        cb();
      } else {
        var doc = response.rows[0].value;
        db.remove(doc, cb);
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

// name of database used to keep track of databases
Pouch.ALL_DBS = "_all_dbs";
Pouch.allDBName = function(adapter) {
  return [adapter, "://", Pouch.ALL_DBS].join('');
};

Pouch.open = function(adapter, name, callback) {
  // skip http and https adaptors for _all_dbs
  if (adapter === "http" || adapter === "https") {
    callback();
    return;
  }

  new Pouch(Pouch.allDBName(adapter), function(err, db) {
    if (err) {
      callback(err);
      return;
    }

    // check if db has been registered in Pouch.ALL_DBS
    var map = function(doc) {
      emit(doc.name, doc);
    };
    db.query({map: map},{
      key: name,
      reduce: false
    }, function(err, response) {
      if (err) {
        callback(err);
        return;
      }

      if (response.rows.length === 0) {
        db.post({
          name: name
        }, callback);
      } else {
          callback();
      }
    });
  });
};

Pouch._all_dbs = function(callback) {
  var accumulate = function(adapters, all_dbs) {
    if (adapters.length === 0) {
      callback(null, all_dbs);
      return;
    }

    var adapter = adapters.shift();

    // skip http and https adaptors for _all_dbs
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
  }
};

if (typeof module !== 'undefined' && module.exports) {
  global.Pouch = Pouch;
  Pouch.merge = require('./pouch.merge.js').merge;
  Pouch.collate = require('./pouch.collate.js').collate;
  Pouch.replicate = require('./pouch.replicate.js').replicate;
  Pouch.utils = require('./pouch.utils.js');
  module.exports = Pouch;

  // load adapters known to work under node
  var adapters = ['leveldb', 'http'];
  adapters.map(function(adapter) {
    var adapter_path = './adapters/pouch.'+adapter+'.js';
    require(adapter_path);
  });
  require('./plugins/pouchdb.mapreduce.js');
} else {
  this.Pouch = Pouch;
}
