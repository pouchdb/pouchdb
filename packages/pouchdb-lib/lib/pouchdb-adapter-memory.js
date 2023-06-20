import { i as immutable, L as LevelPouch } from './index-3d81fcba.js';
import { g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import { i as inheritsExports, c as ltgt$1 } from './readable-bcb7bff2.js';
import require$$0 from 'buffer';
import 'events';
import 'util';
import 'stream';
import 'assert';
import './pouchdb-core.js';
import 'node:events';
import './fetch-f2310cb2.js';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import './rev-48662a2a.js';
import './pouchdb-errors.js';
import 'crypto';
import './stringMd5-15f53eba.js';
import './nextTick-ea093886.js';
import './clone-7eeb6295.js';
import './functionName-706c6c65.js';
import './guardedConsole-f54e5a40.js';
import './isRemote-2533b7cb.js';
import './upsert-331b6913.js';
import './once-de8350b9.js';
import './collectConflicts-ad0b7c70.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import './pouchdb-platform.js';
import 'node:assert';
import 'node:fs';
import 'node:buffer';
import 'node:crypto';
import 'node:stream';
import 'node:http';
import 'node:url';
import 'node:https';
import 'node:zlib';
import 'node:util';
import 'node:vm';
import 'node:path';
import 'node:os';
import './findPathToLeaf-7e69c93c.js';
import 'pouchdb-utils.js';
import './pouchdb-changes-filter.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './matches-selector-87ab4d5f.js';
import './pouchdb-collate.js';
import 'vm';
import './pouchdb-utils.js';
import './flatten-994f45c6.js';
import './scopeEval-ff3a416d.js';
import './toPromise-f6e385ee.js';
import './allDocsKeysQuery-7f4fbcb9.js';
import './parseDoc-71681539.js';
import './latest-0521537f.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './binaryMd5-601b2421.js';
import './processDocs-7c802567.js';
import './merge-1e46cced.js';
import './revExists-12209d1c.js';
import './safeJsonStringify-6520e306.js';

var abstractLeveldown$1 = {};

/* Copyright (c) 2017 Rod Vagg, MIT License */

function AbstractIterator$2 (db) {
  this.db = db;
  this._ended = false;
  this._nexting = false;
}

AbstractIterator$2.prototype.next = function (callback) {
  var self = this;

  if (typeof callback != 'function')
    throw new Error('next() requires a callback argument')

  if (self._ended)
    return callback(new Error('cannot call next() after end()'))
  if (self._nexting)
    return callback(new Error('cannot call next() before previous next() has completed'))

  self._nexting = true;
  if (typeof self._next == 'function') {
    return self._next(function () {
      self._nexting = false;
      callback.apply(null, arguments);
    })
  }

  process.nextTick(function () {
    self._nexting = false;
    callback();
  });
};

AbstractIterator$2.prototype.end = function (callback) {
  if (typeof callback != 'function')
    throw new Error('end() requires a callback argument')

  if (this._ended)
    return callback(new Error('end() already called on iterator'))

  this._ended = true;

  if (typeof this._end == 'function')
    return this._end(callback)

  process.nextTick(callback);
};

var abstractIterator = AbstractIterator$2;

/* Copyright (c) 2017 Rod Vagg, MIT License */

function AbstractChainedBatch$1 (db) {
  this._db         = db;
  this._operations = [];
  this._written    = false;
}

AbstractChainedBatch$1.prototype._serializeKey = function (key) {
  return this._db._serializeKey(key)
};

AbstractChainedBatch$1.prototype._serializeValue = function (value) {
  return this._db._serializeValue(value)
};

AbstractChainedBatch$1.prototype._checkWritten = function () {
  if (this._written)
    throw new Error('write() already called on this batch')
};

AbstractChainedBatch$1.prototype.put = function (key, value) {
  this._checkWritten();

  var err = this._db._checkKey(key, 'key', this._db._isBuffer);
  if (err)
    throw err

  key = this._serializeKey(key);
  value = this._serializeValue(value);

  if (typeof this._put == 'function' )
    this._put(key, value);
  else
    this._operations.push({ type: 'put', key: key, value: value });

  return this
};

AbstractChainedBatch$1.prototype.del = function (key) {
  this._checkWritten();

  var err = this._db._checkKey(key, 'key', this._db._isBuffer);
  if (err) throw err

  key = this._serializeKey(key);

  if (typeof this._del == 'function' )
    this._del(key);
  else
    this._operations.push({ type: 'del', key: key });

  return this
};

AbstractChainedBatch$1.prototype.clear = function () {
  this._checkWritten();

  this._operations = [];

  if (typeof this._clear == 'function' )
    this._clear();

  return this
};

AbstractChainedBatch$1.prototype.write = function (options, callback) {
  this._checkWritten();

  if (typeof options == 'function')
    callback = options;
  if (typeof callback != 'function')
    throw new Error('write() requires a callback argument')
  if (typeof options != 'object')
    options = {};

  this._written = true;

  if (typeof this._write == 'function' )
    return this._write(callback)

  if (typeof this._db._batch == 'function')
    return this._db._batch(this._operations, options, callback)

  process.nextTick(callback);
};

var abstractChainedBatch = AbstractChainedBatch$1;

/* Copyright (c) 2017 Rod Vagg, MIT License */

var xtend                = immutable
  , AbstractIterator$1     = abstractIterator
  , AbstractChainedBatch = abstractChainedBatch;

function AbstractLevelDOWN$2 (location) {
  if (!arguments.length || location === undefined)
    throw new Error('constructor requires at least a location argument')

  if (typeof location != 'string')
    throw new Error('constructor requires a location string argument')

  this.location = location;
  this.status = 'new';
}

AbstractLevelDOWN$2.prototype.open = function (options, callback) {
  var self      = this
    , oldStatus = this.status;

  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('open() requires a callback argument')

  if (typeof options != 'object')
    options = {};

  options.createIfMissing = options.createIfMissing != false;
  options.errorIfExists = !!options.errorIfExists;

  if (typeof this._open == 'function') {
    this.status = 'opening';
    this._open(options, function (err) {
      if (err) {
        self.status = oldStatus;
        return callback(err)
      }
      self.status = 'open';
      callback();
    });
  } else {
    this.status = 'open';
    process.nextTick(callback);
  }
};

AbstractLevelDOWN$2.prototype.close = function (callback) {
  var self      = this
    , oldStatus = this.status;

  if (typeof callback != 'function')
    throw new Error('close() requires a callback argument')

  if (typeof this._close == 'function') {
    this.status = 'closing';
    this._close(function (err) {
      if (err) {
        self.status = oldStatus;
        return callback(err)
      }
      self.status = 'closed';
      callback();
    });
  } else {
    this.status = 'closed';
    process.nextTick(callback);
  }
};

AbstractLevelDOWN$2.prototype.get = function (key, options, callback) {
  var err;

  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('get() requires a callback argument')

  if (err = this._checkKey(key, 'key'))
    return callback(err)

  key = this._serializeKey(key);

  if (typeof options != 'object')
    options = {};

  options.asBuffer = options.asBuffer != false;

  if (typeof this._get == 'function')
    return this._get(key, options, callback)

  process.nextTick(function () { callback(new Error('NotFound')); });
};

AbstractLevelDOWN$2.prototype.put = function (key, value, options, callback) {
  var err;

  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('put() requires a callback argument')

  if (err = this._checkKey(key, 'key'))
    return callback(err)

  key = this._serializeKey(key);
  value = this._serializeValue(value);

  if (typeof options != 'object')
    options = {};

  if (typeof this._put == 'function')
    return this._put(key, value, options, callback)

  process.nextTick(callback);
};

AbstractLevelDOWN$2.prototype.del = function (key, options, callback) {
  var err;

  if (typeof options == 'function')
    callback = options;

  if (typeof callback != 'function')
    throw new Error('del() requires a callback argument')

  if (err = this._checkKey(key, 'key'))
    return callback(err)

  key = this._serializeKey(key);

  if (typeof options != 'object')
    options = {};

  if (typeof this._del == 'function')
    return this._del(key, options, callback)

  process.nextTick(callback);
};

AbstractLevelDOWN$2.prototype.batch = function (array, options, callback) {
  if (!arguments.length)
    return this._chainedBatch()

  if (typeof options == 'function')
    callback = options;

  if (typeof array == 'function')
    callback = array;

  if (typeof callback != 'function')
    throw new Error('batch(array) requires a callback argument')

  if (!Array.isArray(array))
    return callback(new Error('batch(array) requires an array argument'))

  if (!options || typeof options != 'object')
    options = {};

  var i = 0
    , l = array.length
    , e
    , err;

  for (; i < l; i++) {
    e = array[i];
    if (typeof e != 'object')
      continue

    if (err = this._checkKey(e.type, 'type'))
      return callback(err)

    if (err = this._checkKey(e.key, 'key'))
      return callback(err)
  }

  if (typeof this._batch == 'function')
    return this._batch(array, options, callback)

  process.nextTick(callback);
};

//TODO: remove from here, not a necessary primitive
AbstractLevelDOWN$2.prototype.approximateSize = function (start, end, callback) {
  if (   start == null
      || end == null
      || typeof start == 'function'
      || typeof end == 'function') {
    throw new Error('approximateSize() requires valid `start`, `end` and `callback` arguments')
  }

  if (typeof callback != 'function')
    throw new Error('approximateSize() requires a callback argument')

  start = this._serializeKey(start);
  end = this._serializeKey(end);

  if (typeof this._approximateSize == 'function')
    return this._approximateSize(start, end, callback)

  process.nextTick(function () {
    callback(null, 0);
  });
};

AbstractLevelDOWN$2.prototype._setupIteratorOptions = function (options) {
  var self = this;

  options = xtend(options)

  ;[ 'start', 'end', 'gt', 'gte', 'lt', 'lte' ].forEach(function (o) {
    if (options[o] && self._isBuffer(options[o]) && options[o].length === 0)
      delete options[o];
  });

  options.reverse = !!options.reverse;
  options.keys = options.keys != false;
  options.values = options.values != false;
  options.limit = 'limit' in options ? options.limit : -1;
  options.keyAsBuffer = options.keyAsBuffer != false;
  options.valueAsBuffer = options.valueAsBuffer != false;

  return options
};

AbstractLevelDOWN$2.prototype.iterator = function (options) {
  if (typeof options != 'object')
    options = {};

  options = this._setupIteratorOptions(options);

  if (typeof this._iterator == 'function')
    return this._iterator(options)

  return new AbstractIterator$1(this)
};

AbstractLevelDOWN$2.prototype._chainedBatch = function () {
  return new AbstractChainedBatch(this)
};

AbstractLevelDOWN$2.prototype._isBuffer = function (obj) {
  return Buffer.isBuffer(obj)
};

AbstractLevelDOWN$2.prototype._serializeKey = function (key) {
  return this._isBuffer(key)
    ? key
    : String(key)
};

AbstractLevelDOWN$2.prototype._serializeValue = function (value) {
  if (value == null) return ''
  return this._isBuffer(value) || process.browser ? value : String(value)
};

AbstractLevelDOWN$2.prototype._checkKey = function (obj, type) {
  if (obj === null || obj === undefined)
    return new Error(type + ' cannot be `null` or `undefined`')

  if (this._isBuffer(obj) && obj.length === 0)
    return new Error(type + ' cannot be an empty Buffer')
  else if (String(obj) === '')
    return new Error(type + ' cannot be an empty String')
};

var abstractLeveldown = AbstractLevelDOWN$2;

var AbstractLevelDOWN$1 = abstractLeveldown;

function isLevelDOWN (db) {
  if (!db || typeof db !== 'object')
    return false
  return Object.keys(AbstractLevelDOWN$1.prototype).filter(function (name) {
    // TODO remove approximateSize check when method is gone
    return name[0] != '_' && name != 'approximateSize'
  }).every(function (name) {
    return typeof db[name] == 'function'
  })
}

var isLeveldown = isLevelDOWN;

abstractLeveldown$1.AbstractLevelDOWN    = abstractLeveldown;
abstractLeveldown$1.AbstractIterator     = abstractIterator;
abstractLeveldown$1.AbstractChainedBatch = abstractChainedBatch;
abstractLeveldown$1.isLevelDOWN          = isLeveldown;

var rbtree = createRBTree;

var RED   = 0;
var BLACK = 1;

function RBNode(color, key, value, left, right, count) {
  this._color = color;
  this.key = key;
  this.value = value;
  this.left = left;
  this.right = right;
  this._count = count;
}

function cloneNode(node) {
  return new RBNode(node._color, node.key, node.value, node.left, node.right, node._count)
}

function repaint(color, node) {
  return new RBNode(color, node.key, node.value, node.left, node.right, node._count)
}

function recount(node) {
  node._count = 1 + (node.left ? node.left._count : 0) + (node.right ? node.right._count : 0);
}

function RedBlackTree(compare, root) {
  this._compare = compare;
  this.root = root;
}

var proto = RedBlackTree.prototype;

Object.defineProperty(proto, "keys", {
  get: function() {
    var result = [];
    this.forEach(function(k,v) {
      result.push(k);
    });
    return result
  }
});

Object.defineProperty(proto, "values", {
  get: function() {
    var result = [];
    this.forEach(function(k,v) {
      result.push(v);
    });
    return result
  }
});

//Returns the number of nodes in the tree
Object.defineProperty(proto, "length", {
  get: function() {
    if(this.root) {
      return this.root._count
    }
    return 0
  }
});

//Insert a new item into the tree
proto.insert = function(key, value) {
  var cmp = this._compare;
  //Find point to insert new node at
  var n = this.root;
  var n_stack = [];
  var d_stack = [];
  while(n) {
    var d = cmp(key, n.key);
    n_stack.push(n);
    d_stack.push(d);
    if(d <= 0) {
      n = n.left;
    } else {
      n = n.right;
    }
  }
  //Rebuild path to leaf node
  n_stack.push(new RBNode(RED, key, value, null, null, 1));
  for(var s=n_stack.length-2; s>=0; --s) {
    var n = n_stack[s];
    if(d_stack[s] <= 0) {
      n_stack[s] = new RBNode(n._color, n.key, n.value, n_stack[s+1], n.right, n._count+1);
    } else {
      n_stack[s] = new RBNode(n._color, n.key, n.value, n.left, n_stack[s+1], n._count+1);
    }
  }
  //Rebalance tree using rotations
  //console.log("start insert", key, d_stack)
  for(var s=n_stack.length-1; s>1; --s) {
    var p = n_stack[s-1];
    var n = n_stack[s];
    if(p._color === BLACK || n._color === BLACK) {
      break
    }
    var pp = n_stack[s-2];
    if(pp.left === p) {
      if(p.left === n) {
        var y = pp.right;
        if(y && y._color === RED) {
          //console.log("LLr")
          p._color = BLACK;
          pp.right = repaint(BLACK, y);
          pp._color = RED;
          s -= 1;
        } else {
          //console.log("LLb")
          pp._color = RED;
          pp.left = p.right;
          p._color = BLACK;
          p.right = pp;
          n_stack[s-2] = p;
          n_stack[s-1] = n;
          recount(pp);
          recount(p);
          if(s >= 3) {
            var ppp = n_stack[s-3];
            if(ppp.left === pp) {
              ppp.left = p;
            } else {
              ppp.right = p;
            }
          }
          break
        }
      } else {
        var y = pp.right;
        if(y && y._color === RED) {
          //console.log("LRr")
          p._color = BLACK;
          pp.right = repaint(BLACK, y);
          pp._color = RED;
          s -= 1;
        } else {
          //console.log("LRb")
          p.right = n.left;
          pp._color = RED;
          pp.left = n.right;
          n._color = BLACK;
          n.left = p;
          n.right = pp;
          n_stack[s-2] = n;
          n_stack[s-1] = p;
          recount(pp);
          recount(p);
          recount(n);
          if(s >= 3) {
            var ppp = n_stack[s-3];
            if(ppp.left === pp) {
              ppp.left = n;
            } else {
              ppp.right = n;
            }
          }
          break
        }
      }
    } else {
      if(p.right === n) {
        var y = pp.left;
        if(y && y._color === RED) {
          //console.log("RRr", y.key)
          p._color = BLACK;
          pp.left = repaint(BLACK, y);
          pp._color = RED;
          s -= 1;
        } else {
          //console.log("RRb")
          pp._color = RED;
          pp.right = p.left;
          p._color = BLACK;
          p.left = pp;
          n_stack[s-2] = p;
          n_stack[s-1] = n;
          recount(pp);
          recount(p);
          if(s >= 3) {
            var ppp = n_stack[s-3];
            if(ppp.right === pp) {
              ppp.right = p;
            } else {
              ppp.left = p;
            }
          }
          break
        }
      } else {
        var y = pp.left;
        if(y && y._color === RED) {
          //console.log("RLr")
          p._color = BLACK;
          pp.left = repaint(BLACK, y);
          pp._color = RED;
          s -= 1;
        } else {
          //console.log("RLb")
          p.left = n.right;
          pp._color = RED;
          pp.right = n.left;
          n._color = BLACK;
          n.right = p;
          n.left = pp;
          n_stack[s-2] = n;
          n_stack[s-1] = p;
          recount(pp);
          recount(p);
          recount(n);
          if(s >= 3) {
            var ppp = n_stack[s-3];
            if(ppp.right === pp) {
              ppp.right = n;
            } else {
              ppp.left = n;
            }
          }
          break
        }
      }
    }
  }
  //Return new tree
  n_stack[0]._color = BLACK;
  return new RedBlackTree(cmp, n_stack[0])
};


//Visit all nodes inorder
function doVisitFull(visit, node) {
  if(node.left) {
    var v = doVisitFull(visit, node.left);
    if(v) { return v }
  }
  var v = visit(node.key, node.value);
  if(v) { return v }
  if(node.right) {
    return doVisitFull(visit, node.right)
  }
}

//Visit half nodes in order
function doVisitHalf(lo, compare, visit, node) {
  var l = compare(lo, node.key);
  if(l <= 0) {
    if(node.left) {
      var v = doVisitHalf(lo, compare, visit, node.left);
      if(v) { return v }
    }
    var v = visit(node.key, node.value);
    if(v) { return v }
  }
  if(node.right) {
    return doVisitHalf(lo, compare, visit, node.right)
  }
}

//Visit all nodes within a range
function doVisit(lo, hi, compare, visit, node) {
  var l = compare(lo, node.key);
  var h = compare(hi, node.key);
  var v;
  if(l <= 0) {
    if(node.left) {
      v = doVisit(lo, hi, compare, visit, node.left);
      if(v) { return v }
    }
    if(h > 0) {
      v = visit(node.key, node.value);
      if(v) { return v }
    }
  }
  if(h > 0 && node.right) {
    return doVisit(lo, hi, compare, visit, node.right)
  }
}


proto.forEach = function rbTreeForEach(visit, lo, hi) {
  if(!this.root) {
    return
  }
  switch(arguments.length) {
    case 1:
      return doVisitFull(visit, this.root)

    case 2:
      return doVisitHalf(lo, this._compare, visit, this.root)

    case 3:
      if(this._compare(lo, hi) >= 0) {
        return
      }
      return doVisit(lo, hi, this._compare, visit, this.root)
  }
};

//First item in list
Object.defineProperty(proto, "begin", {
  get: function() {
    var stack = [];
    var n = this.root;
    while(n) {
      stack.push(n);
      n = n.left;
    }
    return new RedBlackTreeIterator(this, stack)
  }
});

//Last item in list
Object.defineProperty(proto, "end", {
  get: function() {
    var stack = [];
    var n = this.root;
    while(n) {
      stack.push(n);
      n = n.right;
    }
    return new RedBlackTreeIterator(this, stack)
  }
});

//Find the ith item in the tree
proto.at = function(idx) {
  if(idx < 0) {
    return new RedBlackTreeIterator(this, [])
  }
  var n = this.root;
  var stack = [];
  while(true) {
    stack.push(n);
    if(n.left) {
      if(idx < n.left._count) {
        n = n.left;
        continue
      }
      idx -= n.left._count;
    }
    if(!idx) {
      return new RedBlackTreeIterator(this, stack)
    }
    idx -= 1;
    if(n.right) {
      if(idx >= n.right._count) {
        break
      }
      n = n.right;
    } else {
      break
    }
  }
  return new RedBlackTreeIterator(this, [])
};

proto.ge = function(key) {
  var cmp = this._compare;
  var n = this.root;
  var stack = [];
  var last_ptr = 0;
  while(n) {
    var d = cmp(key, n.key);
    stack.push(n);
    if(d <= 0) {
      last_ptr = stack.length;
    }
    if(d <= 0) {
      n = n.left;
    } else {
      n = n.right;
    }
  }
  stack.length = last_ptr;
  return new RedBlackTreeIterator(this, stack)
};

proto.gt = function(key) {
  var cmp = this._compare;
  var n = this.root;
  var stack = [];
  var last_ptr = 0;
  while(n) {
    var d = cmp(key, n.key);
    stack.push(n);
    if(d < 0) {
      last_ptr = stack.length;
    }
    if(d < 0) {
      n = n.left;
    } else {
      n = n.right;
    }
  }
  stack.length = last_ptr;
  return new RedBlackTreeIterator(this, stack)
};

proto.lt = function(key) {
  var cmp = this._compare;
  var n = this.root;
  var stack = [];
  var last_ptr = 0;
  while(n) {
    var d = cmp(key, n.key);
    stack.push(n);
    if(d > 0) {
      last_ptr = stack.length;
    }
    if(d <= 0) {
      n = n.left;
    } else {
      n = n.right;
    }
  }
  stack.length = last_ptr;
  return new RedBlackTreeIterator(this, stack)
};

proto.le = function(key) {
  var cmp = this._compare;
  var n = this.root;
  var stack = [];
  var last_ptr = 0;
  while(n) {
    var d = cmp(key, n.key);
    stack.push(n);
    if(d >= 0) {
      last_ptr = stack.length;
    }
    if(d < 0) {
      n = n.left;
    } else {
      n = n.right;
    }
  }
  stack.length = last_ptr;
  return new RedBlackTreeIterator(this, stack)
};

//Finds the item with key if it exists
proto.find = function(key) {
  var cmp = this._compare;
  var n = this.root;
  var stack = [];
  while(n) {
    var d = cmp(key, n.key);
    stack.push(n);
    if(d === 0) {
      return new RedBlackTreeIterator(this, stack)
    }
    if(d <= 0) {
      n = n.left;
    } else {
      n = n.right;
    }
  }
  return new RedBlackTreeIterator(this, [])
};

//Removes item with key from tree
proto.remove = function(key) {
  var iter = this.find(key);
  if(iter) {
    return iter.remove()
  }
  return this
};

//Returns the item at `key`
proto.get = function(key) {
  var cmp = this._compare;
  var n = this.root;
  while(n) {
    var d = cmp(key, n.key);
    if(d === 0) {
      return n.value
    }
    if(d <= 0) {
      n = n.left;
    } else {
      n = n.right;
    }
  }
  return
};

//Iterator for red black tree
function RedBlackTreeIterator(tree, stack) {
  this.tree = tree;
  this._stack = stack;
}

var iproto = RedBlackTreeIterator.prototype;

//Test if iterator is valid
Object.defineProperty(iproto, "valid", {
  get: function() {
    return this._stack.length > 0
  }
});

//Node of the iterator
Object.defineProperty(iproto, "node", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1]
    }
    return null
  },
  enumerable: true
});

//Makes a copy of an iterator
iproto.clone = function() {
  return new RedBlackTreeIterator(this.tree, this._stack.slice())
};

//Swaps two nodes
function swapNode(n, v) {
  n.key = v.key;
  n.value = v.value;
  n.left = v.left;
  n.right = v.right;
  n._color = v._color;
  n._count = v._count;
}

//Fix up a double black node in a tree
function fixDoubleBlack(stack) {
  var n, p, s, z;
  for(var i=stack.length-1; i>=0; --i) {
    n = stack[i];
    if(i === 0) {
      n._color = BLACK;
      return
    }
    //console.log("visit node:", n.key, i, stack[i].key, stack[i-1].key)
    p = stack[i-1];
    if(p.left === n) {
      //console.log("left child")
      s = p.right;
      if(s.right && s.right._color === RED) {
        //console.log("case 1: right sibling child red")
        s = p.right = cloneNode(s);
        z = s.right = cloneNode(s.right);
        p.right = s.left;
        s.left = p;
        s.right = z;
        s._color = p._color;
        n._color = BLACK;
        p._color = BLACK;
        z._color = BLACK;
        recount(p);
        recount(s);
        if(i > 1) {
          var pp = stack[i-2];
          if(pp.left === p) {
            pp.left = s;
          } else {
            pp.right = s;
          }
        }
        stack[i-1] = s;
        return
      } else if(s.left && s.left._color === RED) {
        //console.log("case 1: left sibling child red")
        s = p.right = cloneNode(s);
        z = s.left = cloneNode(s.left);
        p.right = z.left;
        s.left = z.right;
        z.left = p;
        z.right = s;
        z._color = p._color;
        p._color = BLACK;
        s._color = BLACK;
        n._color = BLACK;
        recount(p);
        recount(s);
        recount(z);
        if(i > 1) {
          var pp = stack[i-2];
          if(pp.left === p) {
            pp.left = z;
          } else {
            pp.right = z;
          }
        }
        stack[i-1] = z;
        return
      }
      if(s._color === BLACK) {
        if(p._color === RED) {
          //console.log("case 2: black sibling, red parent", p.right.value)
          p._color = BLACK;
          p.right = repaint(RED, s);
          return
        } else {
          //console.log("case 2: black sibling, black parent", p.right.value)
          p.right = repaint(RED, s);
          continue  
        }
      } else {
        //console.log("case 3: red sibling")
        s = cloneNode(s);
        p.right = s.left;
        s.left = p;
        s._color = p._color;
        p._color = RED;
        recount(p);
        recount(s);
        if(i > 1) {
          var pp = stack[i-2];
          if(pp.left === p) {
            pp.left = s;
          } else {
            pp.right = s;
          }
        }
        stack[i-1] = s;
        stack[i] = p;
        if(i+1 < stack.length) {
          stack[i+1] = n;
        } else {
          stack.push(n);
        }
        i = i+2;
      }
    } else {
      //console.log("right child")
      s = p.left;
      if(s.left && s.left._color === RED) {
        //console.log("case 1: left sibling child red", p.value, p._color)
        s = p.left = cloneNode(s);
        z = s.left = cloneNode(s.left);
        p.left = s.right;
        s.right = p;
        s.left = z;
        s._color = p._color;
        n._color = BLACK;
        p._color = BLACK;
        z._color = BLACK;
        recount(p);
        recount(s);
        if(i > 1) {
          var pp = stack[i-2];
          if(pp.right === p) {
            pp.right = s;
          } else {
            pp.left = s;
          }
        }
        stack[i-1] = s;
        return
      } else if(s.right && s.right._color === RED) {
        //console.log("case 1: right sibling child red")
        s = p.left = cloneNode(s);
        z = s.right = cloneNode(s.right);
        p.left = z.right;
        s.right = z.left;
        z.right = p;
        z.left = s;
        z._color = p._color;
        p._color = BLACK;
        s._color = BLACK;
        n._color = BLACK;
        recount(p);
        recount(s);
        recount(z);
        if(i > 1) {
          var pp = stack[i-2];
          if(pp.right === p) {
            pp.right = z;
          } else {
            pp.left = z;
          }
        }
        stack[i-1] = z;
        return
      }
      if(s._color === BLACK) {
        if(p._color === RED) {
          //console.log("case 2: black sibling, red parent")
          p._color = BLACK;
          p.left = repaint(RED, s);
          return
        } else {
          //console.log("case 2: black sibling, black parent")
          p.left = repaint(RED, s);
          continue  
        }
      } else {
        //console.log("case 3: red sibling")
        s = cloneNode(s);
        p.left = s.right;
        s.right = p;
        s._color = p._color;
        p._color = RED;
        recount(p);
        recount(s);
        if(i > 1) {
          var pp = stack[i-2];
          if(pp.right === p) {
            pp.right = s;
          } else {
            pp.left = s;
          }
        }
        stack[i-1] = s;
        stack[i] = p;
        if(i+1 < stack.length) {
          stack[i+1] = n;
        } else {
          stack.push(n);
        }
        i = i+2;
      }
    }
  }
}

//Removes item at iterator from tree
iproto.remove = function() {
  var stack = this._stack;
  if(stack.length === 0) {
    return this.tree
  }
  //First copy path to node
  var cstack = new Array(stack.length);
  var n = stack[stack.length-1];
  cstack[cstack.length-1] = new RBNode(n._color, n.key, n.value, n.left, n.right, n._count);
  for(var i=stack.length-2; i>=0; --i) {
    var n = stack[i];
    if(n.left === stack[i+1]) {
      cstack[i] = new RBNode(n._color, n.key, n.value, cstack[i+1], n.right, n._count);
    } else {
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count);
    }
  }

  //Get node
  n = cstack[cstack.length-1];
  //console.log("start remove: ", n.value)

  //If not leaf, then swap with previous node
  if(n.left && n.right) {
    //console.log("moving to leaf")

    //First walk to previous leaf
    var split = cstack.length;
    n = n.left;
    while(n.right) {
      cstack.push(n);
      n = n.right;
    }
    //Copy path to leaf
    var v = cstack[split-1];
    cstack.push(new RBNode(n._color, v.key, v.value, n.left, n.right, n._count));
    cstack[split-1].key = n.key;
    cstack[split-1].value = n.value;

    //Fix up stack
    for(var i=cstack.length-2; i>=split; --i) {
      n = cstack[i];
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count);
    }
    cstack[split-1].left = cstack[split];
  }
  //console.log("stack=", cstack.map(function(v) { return v.value }))

  //Remove leaf node
  n = cstack[cstack.length-1];
  if(n._color === RED) {
    //Easy case: removing red leaf
    //console.log("RED leaf")
    var p = cstack[cstack.length-2];
    if(p.left === n) {
      p.left = null;
    } else if(p.right === n) {
      p.right = null;
    }
    cstack.pop();
    for(var i=0; i<cstack.length; ++i) {
      cstack[i]._count--;
    }
    return new RedBlackTree(this.tree._compare, cstack[0])
  } else {
    if(n.left || n.right) {
      //Second easy case:  Single child black parent
      //console.log("BLACK single child")
      if(n.left) {
        swapNode(n, n.left);
      } else if(n.right) {
        swapNode(n, n.right);
      }
      //Child must be red, so repaint it black to balance color
      n._color = BLACK;
      for(var i=0; i<cstack.length-1; ++i) {
        cstack[i]._count--;
      }
      return new RedBlackTree(this.tree._compare, cstack[0])
    } else if(cstack.length === 1) {
      //Third easy case: root
      //console.log("ROOT")
      return new RedBlackTree(this.tree._compare, null)
    } else {
      //Hard case: Repaint n, and then do some nasty stuff
      //console.log("BLACK leaf no children")
      for(var i=0; i<cstack.length; ++i) {
        cstack[i]._count--;
      }
      var parent = cstack[cstack.length-2];
      fixDoubleBlack(cstack);
      //Fix up links
      if(parent.left === n) {
        parent.left = null;
      } else {
        parent.right = null;
      }
    }
  }
  return new RedBlackTree(this.tree._compare, cstack[0])
};

//Returns key
Object.defineProperty(iproto, "key", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1].key
    }
    return
  },
  enumerable: true
});

//Returns value
Object.defineProperty(iproto, "value", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1].value
    }
    return
  },
  enumerable: true
});


//Returns the position of this iterator in the sorted list
Object.defineProperty(iproto, "index", {
  get: function() {
    var idx = 0;
    var stack = this._stack;
    if(stack.length === 0) {
      var r = this.tree.root;
      if(r) {
        return r._count
      }
      return 0
    } else if(stack[stack.length-1].left) {
      idx = stack[stack.length-1].left._count;
    }
    for(var s=stack.length-2; s>=0; --s) {
      if(stack[s+1] === stack[s].right) {
        ++idx;
        if(stack[s].left) {
          idx += stack[s].left._count;
        }
      }
    }
    return idx
  },
  enumerable: true
});

//Advances iterator to next element in list
iproto.next = function() {
  var stack = this._stack;
  if(stack.length === 0) {
    return
  }
  var n = stack[stack.length-1];
  if(n.right) {
    n = n.right;
    while(n) {
      stack.push(n);
      n = n.left;
    }
  } else {
    stack.pop();
    while(stack.length > 0 && stack[stack.length-1].right === n) {
      n = stack[stack.length-1];
      stack.pop();
    }
  }
};

//Checks if iterator is at end of tree
Object.defineProperty(iproto, "hasNext", {
  get: function() {
    var stack = this._stack;
    if(stack.length === 0) {
      return false
    }
    if(stack[stack.length-1].right) {
      return true
    }
    for(var s=stack.length-1; s>0; --s) {
      if(stack[s-1].left === stack[s]) {
        return true
      }
    }
    return false
  }
});

//Update value
iproto.update = function(value) {
  var stack = this._stack;
  if(stack.length === 0) {
    throw new Error("Can't update empty node!")
  }
  var cstack = new Array(stack.length);
  var n = stack[stack.length-1];
  cstack[cstack.length-1] = new RBNode(n._color, n.key, value, n.left, n.right, n._count);
  for(var i=stack.length-2; i>=0; --i) {
    n = stack[i];
    if(n.left === stack[i+1]) {
      cstack[i] = new RBNode(n._color, n.key, n.value, cstack[i+1], n.right, n._count);
    } else {
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count);
    }
  }
  return new RedBlackTree(this.tree._compare, cstack[0])
};

//Moves iterator backward one element
iproto.prev = function() {
  var stack = this._stack;
  if(stack.length === 0) {
    return
  }
  var n = stack[stack.length-1];
  if(n.left) {
    n = n.left;
    while(n) {
      stack.push(n);
      n = n.right;
    }
  } else {
    stack.pop();
    while(stack.length > 0 && stack[stack.length-1].left === n) {
      n = stack[stack.length-1];
      stack.pop();
    }
  }
};

//Checks if iterator is at start of tree
Object.defineProperty(iproto, "hasPrev", {
  get: function() {
    var stack = this._stack;
    if(stack.length === 0) {
      return false
    }
    if(stack[stack.length-1].left) {
      return true
    }
    for(var s=stack.length-1; s>0; --s) {
      if(stack[s-1].right === stack[s]) {
        return true
      }
    }
    return false
  }
});

//Default comparison function
function defaultCompare(a, b) {
  if(a < b) {
    return -1
  }
  if(a > b) {
    return 1
  }
  return 0
}

//Build a tree
function createRBTree(compare) {
  return new RedBlackTree(compare || defaultCompare, null)
}

var safeBuffer = {exports: {}};

/* eslint-disable node/no-deprecated-api */
safeBuffer.exports;

(function (module, exports) {
	var buffer = require$$0;
	var Buffer = buffer.Buffer;

	// alternative to using Object.keys for old browsers
	function copyProps (src, dst) {
	  for (var key in src) {
	    dst[key] = src[key];
	  }
	}
	if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
	  module.exports = buffer;
	} else {
	  // Copy properties from require('buffer')
	  copyProps(buffer, exports);
	  exports.Buffer = SafeBuffer;
	}

	function SafeBuffer (arg, encodingOrOffset, length) {
	  return Buffer(arg, encodingOrOffset, length)
	}

	// Copy static methods from Buffer
	copyProps(Buffer, SafeBuffer);

	SafeBuffer.from = function (arg, encodingOrOffset, length) {
	  if (typeof arg === 'number') {
	    throw new TypeError('Argument must not be a number')
	  }
	  return Buffer(arg, encodingOrOffset, length)
	};

	SafeBuffer.alloc = function (size, fill, encoding) {
	  if (typeof size !== 'number') {
	    throw new TypeError('Argument must be a number')
	  }
	  var buf = Buffer(size);
	  if (fill !== undefined) {
	    if (typeof encoding === 'string') {
	      buf.fill(fill, encoding);
	    } else {
	      buf.fill(fill);
	    }
	  } else {
	    buf.fill(0);
	  }
	  return buf
	};

	SafeBuffer.allocUnsafe = function (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('Argument must be a number')
	  }
	  return Buffer(size)
	};

	SafeBuffer.allocUnsafeSlow = function (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('Argument must be a number')
	  }
	  return buffer.SlowBuffer(size)
	}; 
} (safeBuffer, safeBuffer.exports));

var safeBufferExports = safeBuffer.exports;

var immediate = setImmediate;

var inherits = inheritsExports;
var AbstractLevelDOWN = abstractLeveldown$1.AbstractLevelDOWN;
var AbstractIterator = abstractLeveldown$1.AbstractIterator;
var ltgt = ltgt$1;
var createRBT = rbtree;
var Buffer$1 = safeBufferExports.Buffer;
var globalStore = {};

// In Node, use global.setImmediate. In the browser, use a consistent
// microtask library to give consistent microtask experience to all browsers
var setImmediate$1 = immediate;

function gt (value) {
  return ltgt.compare(value, this._end) > 0
}

function gte (value) {
  return ltgt.compare(value, this._end) >= 0
}

function lt (value) {
  return ltgt.compare(value, this._end) < 0
}

function lte (value) {
  return ltgt.compare(value, this._end) <= 0
}

function MemIterator (db, options) {
  AbstractIterator.call(this, db);
  this._limit = options.limit;

  if (this._limit === -1) this._limit = Infinity;

  var tree = db._store[db._location];

  this.keyAsBuffer = options.keyAsBuffer !== false;
  this.valueAsBuffer = options.valueAsBuffer !== false;
  this._reverse = options.reverse;
  this._options = options;
  this._done = 0;

  if (!this._reverse) {
    this._incr = 'next';
    this._start = ltgt.lowerBound(options);
    this._end = ltgt.upperBound(options);

    if (typeof this._start === 'undefined') {
      this._tree = tree.begin;
    } else if (ltgt.lowerBoundInclusive(options)) {
      this._tree = tree.ge(this._start);
    } else {
      this._tree = tree.gt(this._start);
    }

    if (this._end) {
      if (ltgt.upperBoundInclusive(options)) {
        this._test = lte;
      } else {
        this._test = lt;
      }
    }
  } else {
    this._incr = 'prev';
    this._start = ltgt.upperBound(options);
    this._end = ltgt.lowerBound(options);

    if (typeof this._start === 'undefined') {
      this._tree = tree.end;
    } else if (ltgt.upperBoundInclusive(options)) {
      this._tree = tree.le(this._start);
    } else {
      this._tree = tree.lt(this._start);
    }

    if (this._end) {
      if (ltgt.lowerBoundInclusive(options)) {
        this._test = gte;
      } else {
        this._test = gt;
      }
    }
  }
}

inherits(MemIterator, AbstractIterator);

MemIterator.prototype._next = function (callback) {
  var key;
  var value;

  if (this._done++ >= this._limit) return setImmediate$1(callback)
  if (!this._tree.valid) return setImmediate$1(callback)

  key = this._tree.key;
  value = this._tree.value;

  if (!this._test(key)) return setImmediate$1(callback)

  if (this.keyAsBuffer) key = Buffer$1.from(key);
  if (this.valueAsBuffer) value = Buffer$1.from(value);

  this._tree[this._incr]();

  setImmediate$1(function callNext () {
    callback(null, key, value);
  });
};

MemIterator.prototype._test = function () {
  return true
};

function MemDOWN (location) {
  if (!(this instanceof MemDOWN)) return new MemDOWN(location)

  AbstractLevelDOWN.call(this, typeof location === 'string' ? location : '');

  this._location = this.location ? '$' + this.location : '_tree';
  this._store = this.location ? globalStore : this;
  this._store[this._location] =
    this._store[this._location] || createRBT(ltgt.compare);
}

MemDOWN.clearGlobalStore = function (strict) {
  if (strict) {
    Object.keys(globalStore).forEach(function (key) {
      delete globalStore[key];
    });
  } else {
    globalStore = {};
  }
};

inherits(MemDOWN, AbstractLevelDOWN);

MemDOWN.prototype._open = function (options, callback) {
  var self = this;
  setImmediate$1(function callNext () {
    callback(null, self);
  });
};

MemDOWN.prototype._put = function (key, value, options, callback) {
  if (typeof value === 'undefined' || value === null) value = '';

  var iter = this._store[this._location].find(key);

  if (iter.valid) {
    this._store[this._location] = iter.update(value);
  } else {
    this._store[this._location] = this._store[this._location].insert(key, value);
  }

  setImmediate$1(callback);
};

MemDOWN.prototype._get = function (key, options, callback) {
  var value = this._store[this._location].get(key);

  if (typeof value === 'undefined') {
    // 'NotFound' error, consistent with LevelDOWN API
    return setImmediate$1(function callNext () {
      callback(new Error('NotFound'));
    })
  }

  if (options.asBuffer !== false && !this._isBuffer(value)) {
    value = Buffer$1.from(String(value));
  }

  setImmediate$1(function callNext () {
    callback(null, value);
  });
};

MemDOWN.prototype._del = function (key, options, callback) {
  this._store[this._location] = this._store[this._location].remove(key);
  setImmediate$1(callback);
};

MemDOWN.prototype._batch = function (array, options, callback) {
  var i = -1;
  var key;
  var value;
  var iter;
  var len = array.length;
  var tree = this._store[this._location];

  while (++i < len) {
    if (!array[i]) continue

    key = this._isBuffer(array[i].key) ? array[i].key : String(array[i].key);
    iter = tree.find(key);

    if (array[i].type === 'put') {
      value = this._isBuffer(array[i].value)
        ? array[i].value
        : String(array[i].value);
      tree = iter.valid ? iter.update(value) : tree.insert(key, value);
    } else {
      tree = iter.remove();
    }
  }

  this._store[this._location] = tree;

  setImmediate$1(callback);
};

MemDOWN.prototype._iterator = function (options) {
  return new MemIterator(this, options)
};

MemDOWN.prototype._isBuffer = function (obj) {
  return Buffer$1.isBuffer(obj)
};

MemDOWN.destroy = function (name, callback) {
  var key = '$' + name;

  if (key in globalStore) {
    delete globalStore[key];
  }

  setImmediate$1(callback);
};

var memdown = MemDOWN.default = MemDOWN;

var memdown$1 = /*@__PURE__*/getDefaultExportFromCjs(memdown);

function MemDownPouch(opts, callback) {
  var _opts = Object.assign({
    db: memdown$1
  }, opts);

  LevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
MemDownPouch.valid = function () {
  return true;
};
MemDownPouch.use_prefix = false;

function index(PouchDB) {
  PouchDB.adapter('memory', MemDownPouch, true);
}

export { index as default };
