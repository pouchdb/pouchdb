import events from 'events';
import { NotFoundError } from './errors';

var EventEmitter = events.EventEmitter;
var version = "6.5.4";

var sublevel = function (nut, prefix, createStream, options) {
  var emitter = new EventEmitter();
  emitter.sublevels = {};
  emitter.options = options;

  emitter.version = version;

  emitter.methods = {};
  prefix = prefix || [];

  function errback(err) {
    if (err) {
      emitter.emit('error', err);
    }
  }

  function mergeOpts(opts) {
    var o = {};
    var k;
    if (options) {
      for (k in options) {
        if (typeof options[k] !== 'undefined') {
          o[k] = options[k];
        }
      }
    }
    if (opts) {
      for (k in opts) {
        if (typeof opts[k] !== 'undefined') {
          o[k] = opts[k];
        }
      }
    }
    return o;
  }

  emitter.put = function (key, value, opts, cb) {
    if ('function' === typeof opts) {
      cb = opts;
      opts = {};
    }
    if (!cb) {
      cb = errback;
    }

    nut.apply([{
      key: key, value: value,
      prefix: prefix.slice(), type: 'put'
    }], mergeOpts(opts), function (err) {
      if (!err) {
        emitter.emit('put', key, value);
        cb(null);
      }
      if (err) {
        return cb(err);
      }
    });
  };

  emitter.prefix = function () {
    return prefix.slice();
  };

  emitter.del = function (key, opts, cb) {
    if ('function' === typeof opts) {
      cb = opts;
      opts = {};
    }
    if (!cb) {
      cb = errback;
    }

    nut.apply([{
      key: key,
      prefix: prefix.slice(), type: 'del'
    }], mergeOpts(opts), function (err) {
      if (!err) {
        emitter.emit('del', key);
        cb(null);
      }
      if (err) {
        return cb(err);
      }
    });
  };

  emitter.batch = function (ops, opts, cb) {
    if ('function' === typeof opts) {
      cb = opts;
      opts = {};
    }
    if (!cb) {
      cb = errback;
    }

    ops = ops.map(function (op) {
      return {
        key: op.key,
        value: op.value,
        prefix: op.prefix || prefix,
        keyEncoding: op.keyEncoding,    // *
        valueEncoding: op.valueEncoding,  // * (TODO: encodings on sublevel)
        type: op.type
      };
    });

    nut.apply(ops, mergeOpts(opts), function (err) {
      if (!err) {
        emitter.emit('batch', ops);
        cb(null);
      }
      if (err) {
        return cb(err);
      }
    });
  };

  emitter.get = function (key, opts, cb) {
    if ('function' === typeof opts) {
      cb = opts;
      opts = {};
    }
    nut.get(key, prefix, mergeOpts(opts), function (err, value) {
      if (err) {
        cb(new NotFoundError('Key not found in database', err));
      }
      else {
        cb(null, value);
      }
    });
  };

  emitter.clone = function (opts) {
    return sublevel(nut, prefix, createStream, mergeOpts(opts));
  };

  emitter.sublevel = function (name, opts) {
    return emitter.sublevels[name] =
      emitter.sublevels[name] || sublevel(nut, prefix.concat(name), createStream, mergeOpts(opts));
  };

  emitter.readStream = emitter.createReadStream = function (opts) {
    opts = mergeOpts(opts);
    opts.prefix = prefix;
    var stream;
    var it = nut.iterator(opts, function (err, it) {
      stream.setIterator(it);
    });

    stream = createStream(opts, nut.createDecoder(opts));
    if (it) {
      stream.setIterator(it);
    }

    return stream;
  };

  emitter.valueStream =
    emitter.createValueStream = function (opts) {
      opts = opts || {};
      opts.values = true;
      opts.keys = false;
      return emitter.createReadStream(opts);
    };

  emitter.keyStream =
    emitter.createKeyStream = function (opts) {
      opts = opts || {};
      opts.values = false;
      opts.keys = true;
      return emitter.createReadStream(opts);
    };

  emitter.close = function (cb) {
    //TODO: deregister all hooks
    cb = cb || function () {
      };
    if (!prefix.length) {
      nut.close(cb);
    } else {
      process.nextTick(cb);
    }
  };

  emitter.isOpen = nut.isOpen;
  emitter.isClosed = nut.isClosed;

  return emitter;
};

export default sublevel;