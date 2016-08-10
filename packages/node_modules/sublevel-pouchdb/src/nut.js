import ltgt from 'ltgt';

function isFunction(f) {
  return 'function' === typeof f;
}

function getPrefix(db) {
  if (isFunction(db.prefix)) {
    return db.prefix();
  }
  return db;
}

function clone(_obj) {
  var obj = {};
  for(var k in _obj) {
    obj[k] = _obj[k];
  }
  return obj;
}

function nut(db, precodec, codec) {
  function encodePrefix(prefix, key, opts1, opts2) {
    return precodec.encode([ prefix, codec.encodeKey(key, opts1, opts2 ) ]);
  }

  function addEncodings(op, prefix) {
    if(prefix && prefix.options) {
      op.keyEncoding =
        op.keyEncoding || prefix.options.keyEncoding;
      op.valueEncoding =
        op.valueEncoding || prefix.options.valueEncoding;
    }
    return op;
  }

  db.open(function () { /* no-op */});

  return {
    apply: function (ops, opts, cb) {
      opts = opts || {};

      var batch = [];
      var i = -1;
      var len = ops.length;

      while (++i < len) {
        var op = ops[i];
        addEncodings(op, op.prefix);
        op.prefix = getPrefix(op.prefix);
        batch.push({
          key: encodePrefix(op.prefix, op.key, opts, op),
          value: op.type !== 'del' && codec.encodeValue(op.value, opts, op),
          type: op.type
        });
      }
      db.db.batch(batch, opts, cb);
    },
    get: function (key, prefix, opts, cb) {
      opts.asBuffer = codec.valueAsBuffer(opts);
      return db.db.get(
        encodePrefix(prefix, key, opts),
        opts,
        function (err, value) {
          if (err) {
            cb(err);
          } else {
            cb(null, codec.decodeValue(value, opts));
          }
        }
      );
    },
    createDecoder: function (opts) {
      return function (key, value) {
        return {
          key: codec.decodeKey(precodec.decode(key)[1], opts),
          value: codec.decodeValue(value, opts)
        };
      };
    },
    isClosed: function isClosed() {
      return db.isClosed();
    },
    close: function close(cb) {
      return db.close(cb);
    },
    iterator: function (_opts) {
      var opts = clone(_opts || {});
      var prefix = _opts.prefix || [];

      function encodeKey(key) {
        return encodePrefix(prefix, key, opts, {});
      }

      ltgt.toLtgt(_opts, opts, encodeKey, precodec.lowerBound, precodec.upperBound);

      // if these legacy values are in the options, remove them

      opts.prefix = null;

      //************************************************
      //hard coded defaults, for now...
      //TODO: pull defaults and encoding out of levelup.
      opts.keyAsBuffer = opts.valueAsBuffer = false;
      //************************************************


      //this is vital, otherwise limit: undefined will
      //create an empty stream.
      /* istanbul ignore next */
      if ('number' !== typeof opts.limit) {
        opts.limit = -1;
      }

      opts.keyAsBuffer = precodec.buffer;
      opts.valueAsBuffer = codec.valueAsBuffer(opts);

      function wrapIterator(iterator) {
        return {
          next: function (cb) {
            return iterator.next(cb);
          },
          end: function (cb) {
            iterator.end(cb);
          }
        };
      }

      return wrapIterator(db.db.iterator(opts));
    }
  };
}

export default nut;