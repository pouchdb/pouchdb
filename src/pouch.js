var Pouch = this.Pouch = function Pouch(name, opts, callback) {

  if (!(this instanceof Pouch)) {
    return new Pouch(name, opts, callback);
  }

  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  var backend = Pouch.parseAdapter(opts.name || name);
  opts.name = backend.name;
  opts.adapter = opts.adapter || backend.adapter;

  if (!Pouch.adapters[backend.adapter]) {
    throw 'Adapter is missing';
  }

  if (!Pouch.adapters[backend.adapter].valid()) {
    throw 'Invalid Adapter';
  }

  var adapter = Pouch.adapters[backend.adapter](opts, callback);
  for (var j in adapter) {
    this[j] = adapter[j];
  }
}

Pouch.log = function() {
  var args = Array.prototype.slice.call(arguments)
  console[args[0]].call(console, args.slice(1, args.length))
}

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

  // the name didnt specify which adapter to use, so we just pick the first
  // valid one, we will probably add some bias to this (ie http should be last
  // fallback)
  for (var i in Pouch.adapters) {
    if (Pouch.adapters[i].valid()) {
      return {name: name, adapter: i};
    }
  }
  throw 'No Valid Adapter.';
}


Pouch.destroy = function(name, callback) {
  var opts = Pouch.parseAdapter(name);
  Pouch.adapters[opts.adapter].destroy(opts.name, callback);
};


Pouch.adapters = {};

Pouch.adapter = function (id, obj) {
  Pouch.adapters[id] = obj;
}


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
  RESERVED_ID: {
    status: 400,
    error: 'bad_request',
    reason: 'Only reserved document ids may start with underscore.'
  },
  UNKNOWN_ERROR: {
    status: 500,
    error: 'unknown_error',
    reason: 'Database encountered an unknown error'
  }
};

if (typeof module !== 'undefined' && module.exports) {
  global['Pouch'] = Pouch;
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
}
