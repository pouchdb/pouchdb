import { i as immutable, L as LevelPouch } from './index-61da9795.js';
import { g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import { b as buffer, i as inherits_browserExports, l as ltgt$1 } from './index-30b6bd50.js';
import './__node-resolve_empty-5ffda92e.js';
import './functionName-9335a350.js';
import './pouchdb-core.browser.js';
import './bulkGetShim-d4877145.js';
import './toPromise-9dada06a.js';
import './clone-abfcddc8.js';
import './guardedConsole-f54e5a40.js';
import './pouchdb-errors.browser.js';
import './rev-5645662a.js';
import './spark-md5-2c57e5fc.js';
import './stringMd5-browser-5aecd2bd.js';
import './isRemote-f9121da9.js';
import './upsert-331b6913.js';
import './collectConflicts-6afe46fc.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import 'node:events';
import './findPathToLeaf-7e69c93c.js';
import './pouchdb-fetch.browser.js';
import './pouchdb-changes-filter.browser.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './pouchdb-selector-core.browser.js';
import './index-3a476dad.js';
import './scopeEval-ff3a416d.js';
import './pouchdb-utils.browser.js';
import './explainError-browser-c025e6c9.js';
import './parseUri-b061a2c5.js';
import './flatten-994f45c6.js';
import './allDocsKeysQuery-9ff66512.js';
import './parseDoc-5d2a34bd.js';
import './latest-0521537f.js';
import './base64-browser-5f7b6479.js';
import './binaryStringToBlobOrBuffer-browser-7dc25c1d.js';
import './binaryMd5-browser-ad85bb67.js';
import './readAsArrayBuffer-625b2d33.js';
import './processDocs-7ad6f99c.js';
import './merge-7299d068.js';
import './revExists-12209d1c.js';
import './pouchdb-json.browser.js';
import './readAsBinaryString-06e911ba.js';
import 'stream';

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

(function (module, exports) {
	var buffer$1 = buffer;
	var Buffer = buffer$1.Buffer;

	// alternative to using Object.keys for old browsers
	function copyProps (src, dst) {
	  for (var key in src) {
	    dst[key] = src[key];
	  }
	}
	if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
	  module.exports = buffer$1;
	} else {
	  // Copy properties from require('buffer')
	  copyProps(buffer$1, exports);
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
	  return buffer$1.SlowBuffer(size)
	}; 
} (safeBuffer, safeBuffer.exports));

var safeBufferExports = safeBuffer.exports;

var immediateBrowser;
var hasRequiredImmediateBrowser;

function requireImmediateBrowser () {
	if (hasRequiredImmediateBrowser) return immediateBrowser;
	hasRequiredImmediateBrowser = 1;
	immediateBrowser = requireImmediateBrowser();
	return immediateBrowser;
}

var inherits = inherits_browserExports;
var AbstractLevelDOWN = abstractLeveldown$1.AbstractLevelDOWN;
var AbstractIterator = abstractLeveldown$1.AbstractIterator;
var ltgt = ltgt$1;
var createRBT = rbtree;
var Buffer$1 = safeBufferExports.Buffer;
var globalStore = {};

// In Node, use global.setImmediate. In the browser, use a consistent
// microtask library to give consistent microtask experience to all browsers
var setImmediate = requireImmediateBrowser();

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

  if (this._done++ >= this._limit) return setImmediate(callback)
  if (!this._tree.valid) return setImmediate(callback)

  key = this._tree.key;
  value = this._tree.value;

  if (!this._test(key)) return setImmediate(callback)

  if (this.keyAsBuffer) key = Buffer$1.from(key);
  if (this.valueAsBuffer) value = Buffer$1.from(value);

  this._tree[this._incr]();

  setImmediate(function callNext () {
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
  setImmediate(function callNext () {
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

  setImmediate(callback);
};

MemDOWN.prototype._get = function (key, options, callback) {
  var value = this._store[this._location].get(key);

  if (typeof value === 'undefined') {
    // 'NotFound' error, consistent with LevelDOWN API
    return setImmediate(function callNext () {
      callback(new Error('NotFound'));
    })
  }

  if (options.asBuffer !== false && !this._isBuffer(value)) {
    value = Buffer$1.from(String(value));
  }

  setImmediate(function callNext () {
    callback(null, value);
  });
};

MemDOWN.prototype._del = function (key, options, callback) {
  this._store[this._location] = this._store[this._location].remove(key);
  setImmediate(callback);
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

  setImmediate(callback);
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

  setImmediate(callback);
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

function index (PouchDB) {
  PouchDB.adapter('memory', MemDownPouch, true);
}

export { index as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLW1lbW9yeS5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvbWVtZG93bi9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL2Fic3RyYWN0LWl0ZXJhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL21lbWRvd24vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1jaGFpbmVkLWJhdGNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL21lbWRvd24vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1sZXZlbGRvd24uanMiLCIuLi9ub2RlX21vZHVsZXMvbWVtZG93bi9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL2lzLWxldmVsZG93bi5qcyIsIi4uL25vZGVfbW9kdWxlcy9tZW1kb3duL25vZGVfbW9kdWxlcy9hYnN0cmFjdC1sZXZlbGRvd24vaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZnVuY3Rpb25hbC1yZWQtYmxhY2stdHJlZS9yYnRyZWUuanMiLCIuLi9ub2RlX21vZHVsZXMvbWVtZG93bi9ub2RlX21vZHVsZXMvc2FmZS1idWZmZXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvbWVtZG93bi9pbW1lZGlhdGUtYnJvd3Nlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9tZW1kb3duL21lbWRvd24uanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItbWVtb3J5L3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgKGMpIDIwMTcgUm9kIFZhZ2csIE1JVCBMaWNlbnNlICovXG5cbmZ1bmN0aW9uIEFic3RyYWN0SXRlcmF0b3IgKGRiKSB7XG4gIHRoaXMuZGIgPSBkYlxuICB0aGlzLl9lbmRlZCA9IGZhbHNlXG4gIHRoaXMuX25leHRpbmcgPSBmYWxzZVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ25leHQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAoc2VsZi5fZW5kZWQpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignY2Fubm90IGNhbGwgbmV4dCgpIGFmdGVyIGVuZCgpJykpXG4gIGlmIChzZWxmLl9uZXh0aW5nKVxuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIG5leHQoKSBiZWZvcmUgcHJldmlvdXMgbmV4dCgpIGhhcyBjb21wbGV0ZWQnKSlcblxuICBzZWxmLl9uZXh0aW5nID0gdHJ1ZVxuICBpZiAodHlwZW9mIHNlbGYuX25leHQgPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBzZWxmLl9uZXh0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX25leHRpbmcgPSBmYWxzZVxuICAgICAgY2FsbGJhY2suYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH0pXG4gIH1cblxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLl9uZXh0aW5nID0gZmFsc2VcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdlbmQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAodGhpcy5fZW5kZWQpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignZW5kKCkgYWxyZWFkeSBjYWxsZWQgb24gaXRlcmF0b3InKSlcblxuICB0aGlzLl9lbmRlZCA9IHRydWVcblxuICBpZiAodHlwZW9mIHRoaXMuX2VuZCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9lbmQoY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdEl0ZXJhdG9yXG4iLCIvKiBDb3B5cmlnaHQgKGMpIDIwMTcgUm9kIFZhZ2csIE1JVCBMaWNlbnNlICovXG5cbmZ1bmN0aW9uIEFic3RyYWN0Q2hhaW5lZEJhdGNoIChkYikge1xuICB0aGlzLl9kYiAgICAgICAgID0gZGJcbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG4gIHRoaXMuX3dyaXR0ZW4gICAgPSBmYWxzZVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX3NlcmlhbGl6ZUtleSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgcmV0dXJuIHRoaXMuX2RiLl9zZXJpYWxpemVLZXkoa2V5KVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX3NlcmlhbGl6ZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB0aGlzLl9kYi5fc2VyaWFsaXplVmFsdWUodmFsdWUpXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fY2hlY2tXcml0dGVuID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5fd3JpdHRlbilcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dyaXRlKCkgYWxyZWFkeSBjYWxsZWQgb24gdGhpcyBiYXRjaCcpXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICB0aGlzLl9jaGVja1dyaXR0ZW4oKVxuXG4gIHZhciBlcnIgPSB0aGlzLl9kYi5fY2hlY2tLZXkoa2V5LCAna2V5JywgdGhpcy5fZGIuX2lzQnVmZmVyKVxuICBpZiAoZXJyKVxuICAgIHRocm93IGVyclxuXG4gIGtleSA9IHRoaXMuX3NlcmlhbGl6ZUtleShrZXkpXG4gIHZhbHVlID0gdGhpcy5fc2VyaWFsaXplVmFsdWUodmFsdWUpXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9wdXQgPT0gJ2Z1bmN0aW9uJyApXG4gICAgdGhpcy5fcHV0KGtleSwgdmFsdWUpXG4gIGVsc2VcbiAgICB0aGlzLl9vcGVyYXRpb25zLnB1c2goeyB0eXBlOiAncHV0Jywga2V5OiBrZXksIHZhbHVlOiB2YWx1ZSB9KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgdmFyIGVyciA9IHRoaXMuX2RiLl9jaGVja0tleShrZXksICdrZXknLCB0aGlzLl9kYi5faXNCdWZmZXIpXG4gIGlmIChlcnIpIHRocm93IGVyclxuXG4gIGtleSA9IHRoaXMuX3NlcmlhbGl6ZUtleShrZXkpXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9kZWwgPT0gJ2Z1bmN0aW9uJyApXG4gICAgdGhpcy5fZGVsKGtleSlcbiAgZWxzZVxuICAgIHRoaXMuX29wZXJhdGlvbnMucHVzaCh7IHR5cGU6ICdkZWwnLCBrZXk6IGtleSB9KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB0aGlzLl9vcGVyYXRpb25zID0gW11cblxuICBpZiAodHlwZW9mIHRoaXMuX2NsZWFyID09ICdmdW5jdGlvbicgKVxuICAgIHRoaXMuX2NsZWFyKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT0gJ2Z1bmN0aW9uJylcbiAgICBjYWxsYmFjayA9IG9wdGlvbnNcbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcignd3JpdGUoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIHRoaXMuX3dyaXR0ZW4gPSB0cnVlXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl93cml0ZSA9PSAnZnVuY3Rpb24nIClcbiAgICByZXR1cm4gdGhpcy5fd3JpdGUoY2FsbGJhY2spXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9kYi5fYmF0Y2ggPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fZGIuX2JhdGNoKHRoaXMuX29wZXJhdGlvbnMsIG9wdGlvbnMsIGNhbGxiYWNrKVxuXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spXG59XG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RDaGFpbmVkQmF0Y2hcbiIsIi8qIENvcHlyaWdodCAoYykgMjAxNyBSb2QgVmFnZywgTUlUIExpY2Vuc2UgKi9cblxudmFyIHh0ZW5kICAgICAgICAgICAgICAgID0gcmVxdWlyZSgneHRlbmQnKVxuICAsIEFic3RyYWN0SXRlcmF0b3IgICAgID0gcmVxdWlyZSgnLi9hYnN0cmFjdC1pdGVyYXRvcicpXG4gICwgQWJzdHJhY3RDaGFpbmVkQmF0Y2ggPSByZXF1aXJlKCcuL2Fic3RyYWN0LWNoYWluZWQtYmF0Y2gnKVxuXG5mdW5jdGlvbiBBYnN0cmFjdExldmVsRE9XTiAobG9jYXRpb24pIHtcbiAgaWYgKCFhcmd1bWVudHMubGVuZ3RoIHx8IGxvY2F0aW9uID09PSB1bmRlZmluZWQpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjb25zdHJ1Y3RvciByZXF1aXJlcyBhdCBsZWFzdCBhIGxvY2F0aW9uIGFyZ3VtZW50JylcblxuICBpZiAodHlwZW9mIGxvY2F0aW9uICE9ICdzdHJpbmcnKVxuICAgIHRocm93IG5ldyBFcnJvcignY29uc3RydWN0b3IgcmVxdWlyZXMgYSBsb2NhdGlvbiBzdHJpbmcgYXJndW1lbnQnKVxuXG4gIHRoaXMubG9jYXRpb24gPSBsb2NhdGlvblxuICB0aGlzLnN0YXR1cyA9ICduZXcnXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmICAgICAgPSB0aGlzXG4gICAgLCBvbGRTdGF0dXMgPSB0aGlzLnN0YXR1c1xuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ29wZW4oKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgb3B0aW9ucy5jcmVhdGVJZk1pc3NpbmcgPSBvcHRpb25zLmNyZWF0ZUlmTWlzc2luZyAhPSBmYWxzZVxuICBvcHRpb25zLmVycm9ySWZFeGlzdHMgPSAhIW9wdGlvbnMuZXJyb3JJZkV4aXN0c1xuXG4gIGlmICh0eXBlb2YgdGhpcy5fb3BlbiA9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5zdGF0dXMgPSAnb3BlbmluZydcbiAgICB0aGlzLl9vcGVuKG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgc2VsZi5zdGF0dXMgPSBvbGRTdGF0dXNcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgICAgIH1cbiAgICAgIHNlbGYuc3RhdHVzID0gJ29wZW4nXG4gICAgICBjYWxsYmFjaygpXG4gICAgfSlcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnN0YXR1cyA9ICdvcGVuJ1xuICAgIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spXG4gIH1cbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmICAgICAgPSB0aGlzXG4gICAgLCBvbGRTdGF0dXMgPSB0aGlzLnN0YXR1c1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nsb3NlKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9jbG9zZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5zdGF0dXMgPSAnY2xvc2luZydcbiAgICB0aGlzLl9jbG9zZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHNlbGYuc3RhdHVzID0gb2xkU3RhdHVzXG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG4gICAgICB9XG4gICAgICBzZWxmLnN0YXR1cyA9ICdjbG9zZWQnXG4gICAgICBjYWxsYmFjaygpXG4gICAgfSlcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnN0YXR1cyA9ICdjbG9zZWQnXG4gICAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbiAgfVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIGVyclxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuXG4gIGlmIChlcnIgPSB0aGlzLl9jaGVja0tleShrZXksICdrZXknKSlcbiAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuXG4gIGtleSA9IHRoaXMuX3NlcmlhbGl6ZUtleShrZXkpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIG9wdGlvbnMuYXNCdWZmZXIgPSBvcHRpb25zLmFzQnVmZmVyICE9IGZhbHNlXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9nZXQgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fZ2V0KGtleSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7IGNhbGxiYWNrKG5ldyBFcnJvcignTm90Rm91bmQnKSkgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLnB1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICB2YXIgZXJyXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcigncHV0KCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSwgJ2tleScpKVxuICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcbiAgdmFsdWUgPSB0aGlzLl9zZXJpYWxpemVWYWx1ZSh2YWx1ZSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9wdXQgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fcHV0KGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKVxuXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICB2YXIgZXJyXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcignZGVsKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSwgJ2tleScpKVxuICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9kZWwgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fZGVsKGtleSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmJhdGNoID0gZnVuY3Rpb24gKGFycmF5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpXG4gICAgcmV0dXJuIHRoaXMuX2NoYWluZWRCYXRjaCgpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBhcnJheSA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gYXJyYXlcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdiYXRjaChhcnJheSkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICByZXR1cm4gY2FsbGJhY2sobmV3IEVycm9yKCdiYXRjaChhcnJheSkgcmVxdWlyZXMgYW4gYXJyYXkgYXJndW1lbnQnKSlcblxuICBpZiAoIW9wdGlvbnMgfHwgdHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgdmFyIGkgPSAwXG4gICAgLCBsID0gYXJyYXkubGVuZ3RoXG4gICAgLCBlXG4gICAgLCBlcnJcblxuICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgIGUgPSBhcnJheVtpXVxuICAgIGlmICh0eXBlb2YgZSAhPSAnb2JqZWN0JylcbiAgICAgIGNvbnRpbnVlXG5cbiAgICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXkoZS50eXBlLCAndHlwZScpKVxuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcblxuICAgIGlmIChlcnIgPSB0aGlzLl9jaGVja0tleShlLmtleSwgJ2tleScpKVxuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgfVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fYmF0Y2ggPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fYmF0Y2goYXJyYXksIG9wdGlvbnMsIGNhbGxiYWNrKVxuXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spXG59XG5cbi8vVE9ETzogcmVtb3ZlIGZyb20gaGVyZSwgbm90IGEgbmVjZXNzYXJ5IHByaW1pdGl2ZVxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmFwcHJveGltYXRlU2l6ZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCBjYWxsYmFjaykge1xuICBpZiAoICAgc3RhcnQgPT0gbnVsbFxuICAgICAgfHwgZW5kID09IG51bGxcbiAgICAgIHx8IHR5cGVvZiBzdGFydCA9PSAnZnVuY3Rpb24nXG4gICAgICB8fCB0eXBlb2YgZW5kID09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FwcHJveGltYXRlU2l6ZSgpIHJlcXVpcmVzIHZhbGlkIGBzdGFydGAsIGBlbmRgIGFuZCBgY2FsbGJhY2tgIGFyZ3VtZW50cycpXG4gIH1cblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdhcHByb3hpbWF0ZVNpemUoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBzdGFydCA9IHRoaXMuX3NlcmlhbGl6ZUtleShzdGFydClcbiAgZW5kID0gdGhpcy5fc2VyaWFsaXplS2V5KGVuZClcblxuICBpZiAodHlwZW9mIHRoaXMuX2FwcHJveGltYXRlU2l6ZSA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9hcHByb3hpbWF0ZVNpemUoc3RhcnQsIGVuZCwgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgMClcbiAgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9zZXR1cEl0ZXJhdG9yT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIG9wdGlvbnMgPSB4dGVuZChvcHRpb25zKVxuXG4gIDtbICdzdGFydCcsICdlbmQnLCAnZ3QnLCAnZ3RlJywgJ2x0JywgJ2x0ZScgXS5mb3JFYWNoKGZ1bmN0aW9uIChvKSB7XG4gICAgaWYgKG9wdGlvbnNbb10gJiYgc2VsZi5faXNCdWZmZXIob3B0aW9uc1tvXSkgJiYgb3B0aW9uc1tvXS5sZW5ndGggPT09IDApXG4gICAgICBkZWxldGUgb3B0aW9uc1tvXVxuICB9KVxuXG4gIG9wdGlvbnMucmV2ZXJzZSA9ICEhb3B0aW9ucy5yZXZlcnNlXG4gIG9wdGlvbnMua2V5cyA9IG9wdGlvbnMua2V5cyAhPSBmYWxzZVxuICBvcHRpb25zLnZhbHVlcyA9IG9wdGlvbnMudmFsdWVzICE9IGZhbHNlXG4gIG9wdGlvbnMubGltaXQgPSAnbGltaXQnIGluIG9wdGlvbnMgPyBvcHRpb25zLmxpbWl0IDogLTFcbiAgb3B0aW9ucy5rZXlBc0J1ZmZlciA9IG9wdGlvbnMua2V5QXNCdWZmZXIgIT0gZmFsc2VcbiAgb3B0aW9ucy52YWx1ZUFzQnVmZmVyID0gb3B0aW9ucy52YWx1ZUFzQnVmZmVyICE9IGZhbHNlXG5cbiAgcmV0dXJuIG9wdGlvbnNcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLml0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIG9wdGlvbnMgPSB0aGlzLl9zZXR1cEl0ZXJhdG9yT3B0aW9ucyhvcHRpb25zKVxuXG4gIGlmICh0eXBlb2YgdGhpcy5faXRlcmF0b3IgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5faXRlcmF0b3Iob3B0aW9ucylcblxuICByZXR1cm4gbmV3IEFic3RyYWN0SXRlcmF0b3IodGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGFpbmVkQmF0Y2ggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgQWJzdHJhY3RDaGFpbmVkQmF0Y2godGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9pc0J1ZmZlciA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihvYmopXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fc2VyaWFsaXplS2V5ID0gZnVuY3Rpb24gKGtleSkge1xuICByZXR1cm4gdGhpcy5faXNCdWZmZXIoa2V5KVxuICAgID8ga2V5XG4gICAgOiBTdHJpbmcoa2V5KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX3NlcmlhbGl6ZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gJydcbiAgcmV0dXJuIHRoaXMuX2lzQnVmZmVyKHZhbHVlKSB8fCBwcm9jZXNzLmJyb3dzZXIgPyB2YWx1ZSA6IFN0cmluZyh2YWx1ZSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGVja0tleSA9IGZ1bmN0aW9uIChvYmosIHR5cGUpIHtcbiAgaWYgKG9iaiA9PT0gbnVsbCB8fCBvYmogPT09IHVuZGVmaW5lZClcbiAgICByZXR1cm4gbmV3IEVycm9yKHR5cGUgKyAnIGNhbm5vdCBiZSBgbnVsbGAgb3IgYHVuZGVmaW5lZGAnKVxuXG4gIGlmICh0aGlzLl9pc0J1ZmZlcihvYmopICYmIG9iai5sZW5ndGggPT09IDApXG4gICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYW4gZW1wdHkgQnVmZmVyJylcbiAgZWxzZSBpZiAoU3RyaW5nKG9iaikgPT09ICcnKVxuICAgIHJldHVybiBuZXcgRXJyb3IodHlwZSArICcgY2Fubm90IGJlIGFuIGVtcHR5IFN0cmluZycpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RMZXZlbERPV05cbiIsInZhciBBYnN0cmFjdExldmVsRE9XTiA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtbGV2ZWxkb3duJylcblxuZnVuY3Rpb24gaXNMZXZlbERPV04gKGRiKSB7XG4gIGlmICghZGIgfHwgdHlwZW9mIGRiICE9PSAnb2JqZWN0JylcbiAgICByZXR1cm4gZmFsc2VcbiAgcmV0dXJuIE9iamVjdC5rZXlzKEFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZSkuZmlsdGVyKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgLy8gVE9ETyByZW1vdmUgYXBwcm94aW1hdGVTaXplIGNoZWNrIHdoZW4gbWV0aG9kIGlzIGdvbmVcbiAgICByZXR1cm4gbmFtZVswXSAhPSAnXycgJiYgbmFtZSAhPSAnYXBwcm94aW1hdGVTaXplJ1xuICB9KS5ldmVyeShmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiB0eXBlb2YgZGJbbmFtZV0gPT0gJ2Z1bmN0aW9uJ1xuICB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzTGV2ZWxET1dOXG4iLCJleHBvcnRzLkFic3RyYWN0TGV2ZWxET1dOICAgID0gcmVxdWlyZSgnLi9hYnN0cmFjdC1sZXZlbGRvd24nKVxuZXhwb3J0cy5BYnN0cmFjdEl0ZXJhdG9yICAgICA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtaXRlcmF0b3InKVxuZXhwb3J0cy5BYnN0cmFjdENoYWluZWRCYXRjaCA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaCcpXG5leHBvcnRzLmlzTGV2ZWxET1dOICAgICAgICAgID0gcmVxdWlyZSgnLi9pcy1sZXZlbGRvd24nKVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVSQlRyZWVcblxudmFyIFJFRCAgID0gMFxudmFyIEJMQUNLID0gMVxuXG5mdW5jdGlvbiBSQk5vZGUoY29sb3IsIGtleSwgdmFsdWUsIGxlZnQsIHJpZ2h0LCBjb3VudCkge1xuICB0aGlzLl9jb2xvciA9IGNvbG9yXG4gIHRoaXMua2V5ID0ga2V5XG4gIHRoaXMudmFsdWUgPSB2YWx1ZVxuICB0aGlzLmxlZnQgPSBsZWZ0XG4gIHRoaXMucmlnaHQgPSByaWdodFxuICB0aGlzLl9jb3VudCA9IGNvdW50XG59XG5cbmZ1bmN0aW9uIGNsb25lTm9kZShub2RlKSB7XG4gIHJldHVybiBuZXcgUkJOb2RlKG5vZGUuX2NvbG9yLCBub2RlLmtleSwgbm9kZS52YWx1ZSwgbm9kZS5sZWZ0LCBub2RlLnJpZ2h0LCBub2RlLl9jb3VudClcbn1cblxuZnVuY3Rpb24gcmVwYWludChjb2xvciwgbm9kZSkge1xuICByZXR1cm4gbmV3IFJCTm9kZShjb2xvciwgbm9kZS5rZXksIG5vZGUudmFsdWUsIG5vZGUubGVmdCwgbm9kZS5yaWdodCwgbm9kZS5fY291bnQpXG59XG5cbmZ1bmN0aW9uIHJlY291bnQobm9kZSkge1xuICBub2RlLl9jb3VudCA9IDEgKyAobm9kZS5sZWZ0ID8gbm9kZS5sZWZ0Ll9jb3VudCA6IDApICsgKG5vZGUucmlnaHQgPyBub2RlLnJpZ2h0Ll9jb3VudCA6IDApXG59XG5cbmZ1bmN0aW9uIFJlZEJsYWNrVHJlZShjb21wYXJlLCByb290KSB7XG4gIHRoaXMuX2NvbXBhcmUgPSBjb21wYXJlXG4gIHRoaXMucm9vdCA9IHJvb3Rcbn1cblxudmFyIHByb3RvID0gUmVkQmxhY2tUcmVlLnByb3RvdHlwZVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sIFwia2V5c1wiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGssdikge1xuICAgICAgcmVzdWx0LnB1c2goaylcbiAgICB9KVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxufSlcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCBcInZhbHVlc1wiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGssdikge1xuICAgICAgcmVzdWx0LnB1c2godilcbiAgICB9KVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxufSlcblxuLy9SZXR1cm5zIHRoZSBudW1iZXIgb2Ygbm9kZXMgaW4gdGhlIHRyZWVcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgXCJsZW5ndGhcIiwge1xuICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmKHRoaXMucm9vdCkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vdC5fY291bnRcbiAgICB9XG4gICAgcmV0dXJuIDBcbiAgfVxufSlcblxuLy9JbnNlcnQgYSBuZXcgaXRlbSBpbnRvIHRoZSB0cmVlXG5wcm90by5pbnNlcnQgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIC8vRmluZCBwb2ludCB0byBpbnNlcnQgbmV3IG5vZGUgYXRcbiAgdmFyIG4gPSB0aGlzLnJvb3RcbiAgdmFyIG5fc3RhY2sgPSBbXVxuICB2YXIgZF9zdGFjayA9IFtdXG4gIHdoaWxlKG4pIHtcbiAgICB2YXIgZCA9IGNtcChrZXksIG4ua2V5KVxuICAgIG5fc3RhY2sucHVzaChuKVxuICAgIGRfc3RhY2sucHVzaChkKVxuICAgIGlmKGQgPD0gMCkge1xuICAgICAgbiA9IG4ubGVmdFxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbi5yaWdodFxuICAgIH1cbiAgfVxuICAvL1JlYnVpbGQgcGF0aCB0byBsZWFmIG5vZGVcbiAgbl9zdGFjay5wdXNoKG5ldyBSQk5vZGUoUkVELCBrZXksIHZhbHVlLCBudWxsLCBudWxsLCAxKSlcbiAgZm9yKHZhciBzPW5fc3RhY2subGVuZ3RoLTI7IHM+PTA7IC0tcykge1xuICAgIHZhciBuID0gbl9zdGFja1tzXVxuICAgIGlmKGRfc3RhY2tbc10gPD0gMCkge1xuICAgICAgbl9zdGFja1tzXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBuX3N0YWNrW3MrMV0sIG4ucmlnaHQsIG4uX2NvdW50KzEpXG4gICAgfSBlbHNlIHtcbiAgICAgIG5fc3RhY2tbc10gPSBuZXcgUkJOb2RlKG4uX2NvbG9yLCBuLmtleSwgbi52YWx1ZSwgbi5sZWZ0LCBuX3N0YWNrW3MrMV0sIG4uX2NvdW50KzEpXG4gICAgfVxuICB9XG4gIC8vUmViYWxhbmNlIHRyZWUgdXNpbmcgcm90YXRpb25zXG4gIC8vY29uc29sZS5sb2coXCJzdGFydCBpbnNlcnRcIiwga2V5LCBkX3N0YWNrKVxuICBmb3IodmFyIHM9bl9zdGFjay5sZW5ndGgtMTsgcz4xOyAtLXMpIHtcbiAgICB2YXIgcCA9IG5fc3RhY2tbcy0xXVxuICAgIHZhciBuID0gbl9zdGFja1tzXVxuICAgIGlmKHAuX2NvbG9yID09PSBCTEFDSyB8fCBuLl9jb2xvciA9PT0gQkxBQ0spIHtcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIHZhciBwcCA9IG5fc3RhY2tbcy0yXVxuICAgIGlmKHBwLmxlZnQgPT09IHApIHtcbiAgICAgIGlmKHAubGVmdCA9PT0gbikge1xuICAgICAgICB2YXIgeSA9IHBwLnJpZ2h0XG4gICAgICAgIGlmKHkgJiYgeS5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJMTHJcIilcbiAgICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgICAgcHAucmlnaHQgPSByZXBhaW50KEJMQUNLLCB5KVxuICAgICAgICAgIHBwLl9jb2xvciA9IFJFRFxuICAgICAgICAgIHMgLT0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJMTGJcIilcbiAgICAgICAgICBwcC5fY29sb3IgPSBSRURcbiAgICAgICAgICBwcC5sZWZ0ID0gcC5yaWdodFxuICAgICAgICAgIHAuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgICBwLnJpZ2h0ID0gcHBcbiAgICAgICAgICBuX3N0YWNrW3MtMl0gPSBwXG4gICAgICAgICAgbl9zdGFja1tzLTFdID0gblxuICAgICAgICAgIHJlY291bnQocHApXG4gICAgICAgICAgcmVjb3VudChwKVxuICAgICAgICAgIGlmKHMgPj0gMykge1xuICAgICAgICAgICAgdmFyIHBwcCA9IG5fc3RhY2tbcy0zXVxuICAgICAgICAgICAgaWYocHBwLmxlZnQgPT09IHBwKSB7XG4gICAgICAgICAgICAgIHBwcC5sZWZ0ID0gcFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcHBwLnJpZ2h0ID0gcFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgeSA9IHBwLnJpZ2h0XG4gICAgICAgIGlmKHkgJiYgeS5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJMUnJcIilcbiAgICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgICAgcHAucmlnaHQgPSByZXBhaW50KEJMQUNLLCB5KVxuICAgICAgICAgIHBwLl9jb2xvciA9IFJFRFxuICAgICAgICAgIHMgLT0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJMUmJcIilcbiAgICAgICAgICBwLnJpZ2h0ID0gbi5sZWZ0XG4gICAgICAgICAgcHAuX2NvbG9yID0gUkVEXG4gICAgICAgICAgcHAubGVmdCA9IG4ucmlnaHRcbiAgICAgICAgICBuLl9jb2xvciA9IEJMQUNLXG4gICAgICAgICAgbi5sZWZ0ID0gcFxuICAgICAgICAgIG4ucmlnaHQgPSBwcFxuICAgICAgICAgIG5fc3RhY2tbcy0yXSA9IG5cbiAgICAgICAgICBuX3N0YWNrW3MtMV0gPSBwXG4gICAgICAgICAgcmVjb3VudChwcClcbiAgICAgICAgICByZWNvdW50KHApXG4gICAgICAgICAgcmVjb3VudChuKVxuICAgICAgICAgIGlmKHMgPj0gMykge1xuICAgICAgICAgICAgdmFyIHBwcCA9IG5fc3RhY2tbcy0zXVxuICAgICAgICAgICAgaWYocHBwLmxlZnQgPT09IHBwKSB7XG4gICAgICAgICAgICAgIHBwcC5sZWZ0ID0gblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcHBwLnJpZ2h0ID0gblxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmKHAucmlnaHQgPT09IG4pIHtcbiAgICAgICAgdmFyIHkgPSBwcC5sZWZ0XG4gICAgICAgIGlmKHkgJiYgeS5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJSUnJcIiwgeS5rZXkpXG4gICAgICAgICAgcC5fY29sb3IgPSBCTEFDS1xuICAgICAgICAgIHBwLmxlZnQgPSByZXBhaW50KEJMQUNLLCB5KVxuICAgICAgICAgIHBwLl9jb2xvciA9IFJFRFxuICAgICAgICAgIHMgLT0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJSUmJcIilcbiAgICAgICAgICBwcC5fY29sb3IgPSBSRURcbiAgICAgICAgICBwcC5yaWdodCA9IHAubGVmdFxuICAgICAgICAgIHAuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgICBwLmxlZnQgPSBwcFxuICAgICAgICAgIG5fc3RhY2tbcy0yXSA9IHBcbiAgICAgICAgICBuX3N0YWNrW3MtMV0gPSBuXG4gICAgICAgICAgcmVjb3VudChwcClcbiAgICAgICAgICByZWNvdW50KHApXG4gICAgICAgICAgaWYocyA+PSAzKSB7XG4gICAgICAgICAgICB2YXIgcHBwID0gbl9zdGFja1tzLTNdXG4gICAgICAgICAgICBpZihwcHAucmlnaHQgPT09IHBwKSB7XG4gICAgICAgICAgICAgIHBwcC5yaWdodCA9IHBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBwcC5sZWZ0ID0gcFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgeSA9IHBwLmxlZnRcbiAgICAgICAgaWYoeSAmJiB5Ll9jb2xvciA9PT0gUkVEKSB7XG4gICAgICAgICAgLy9jb25zb2xlLmxvZyhcIlJMclwiKVxuICAgICAgICAgIHAuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgICBwcC5sZWZ0ID0gcmVwYWludChCTEFDSywgeSlcbiAgICAgICAgICBwcC5fY29sb3IgPSBSRURcbiAgICAgICAgICBzIC09IDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiUkxiXCIpXG4gICAgICAgICAgcC5sZWZ0ID0gbi5yaWdodFxuICAgICAgICAgIHBwLl9jb2xvciA9IFJFRFxuICAgICAgICAgIHBwLnJpZ2h0ID0gbi5sZWZ0XG4gICAgICAgICAgbi5fY29sb3IgPSBCTEFDS1xuICAgICAgICAgIG4ucmlnaHQgPSBwXG4gICAgICAgICAgbi5sZWZ0ID0gcHBcbiAgICAgICAgICBuX3N0YWNrW3MtMl0gPSBuXG4gICAgICAgICAgbl9zdGFja1tzLTFdID0gcFxuICAgICAgICAgIHJlY291bnQocHApXG4gICAgICAgICAgcmVjb3VudChwKVxuICAgICAgICAgIHJlY291bnQobilcbiAgICAgICAgICBpZihzID49IDMpIHtcbiAgICAgICAgICAgIHZhciBwcHAgPSBuX3N0YWNrW3MtM11cbiAgICAgICAgICAgIGlmKHBwcC5yaWdodCA9PT0gcHApIHtcbiAgICAgICAgICAgICAgcHBwLnJpZ2h0ID0gblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcHBwLmxlZnQgPSBuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy9SZXR1cm4gbmV3IHRyZWVcbiAgbl9zdGFja1swXS5fY29sb3IgPSBCTEFDS1xuICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZShjbXAsIG5fc3RhY2tbMF0pXG59XG5cblxuLy9WaXNpdCBhbGwgbm9kZXMgaW5vcmRlclxuZnVuY3Rpb24gZG9WaXNpdEZ1bGwodmlzaXQsIG5vZGUpIHtcbiAgaWYobm9kZS5sZWZ0KSB7XG4gICAgdmFyIHYgPSBkb1Zpc2l0RnVsbCh2aXNpdCwgbm9kZS5sZWZ0KVxuICAgIGlmKHYpIHsgcmV0dXJuIHYgfVxuICB9XG4gIHZhciB2ID0gdmlzaXQobm9kZS5rZXksIG5vZGUudmFsdWUpXG4gIGlmKHYpIHsgcmV0dXJuIHYgfVxuICBpZihub2RlLnJpZ2h0KSB7XG4gICAgcmV0dXJuIGRvVmlzaXRGdWxsKHZpc2l0LCBub2RlLnJpZ2h0KVxuICB9XG59XG5cbi8vVmlzaXQgaGFsZiBub2RlcyBpbiBvcmRlclxuZnVuY3Rpb24gZG9WaXNpdEhhbGYobG8sIGNvbXBhcmUsIHZpc2l0LCBub2RlKSB7XG4gIHZhciBsID0gY29tcGFyZShsbywgbm9kZS5rZXkpXG4gIGlmKGwgPD0gMCkge1xuICAgIGlmKG5vZGUubGVmdCkge1xuICAgICAgdmFyIHYgPSBkb1Zpc2l0SGFsZihsbywgY29tcGFyZSwgdmlzaXQsIG5vZGUubGVmdClcbiAgICAgIGlmKHYpIHsgcmV0dXJuIHYgfVxuICAgIH1cbiAgICB2YXIgdiA9IHZpc2l0KG5vZGUua2V5LCBub2RlLnZhbHVlKVxuICAgIGlmKHYpIHsgcmV0dXJuIHYgfVxuICB9XG4gIGlmKG5vZGUucmlnaHQpIHtcbiAgICByZXR1cm4gZG9WaXNpdEhhbGYobG8sIGNvbXBhcmUsIHZpc2l0LCBub2RlLnJpZ2h0KVxuICB9XG59XG5cbi8vVmlzaXQgYWxsIG5vZGVzIHdpdGhpbiBhIHJhbmdlXG5mdW5jdGlvbiBkb1Zpc2l0KGxvLCBoaSwgY29tcGFyZSwgdmlzaXQsIG5vZGUpIHtcbiAgdmFyIGwgPSBjb21wYXJlKGxvLCBub2RlLmtleSlcbiAgdmFyIGggPSBjb21wYXJlKGhpLCBub2RlLmtleSlcbiAgdmFyIHZcbiAgaWYobCA8PSAwKSB7XG4gICAgaWYobm9kZS5sZWZ0KSB7XG4gICAgICB2ID0gZG9WaXNpdChsbywgaGksIGNvbXBhcmUsIHZpc2l0LCBub2RlLmxlZnQpXG4gICAgICBpZih2KSB7IHJldHVybiB2IH1cbiAgICB9XG4gICAgaWYoaCA+IDApIHtcbiAgICAgIHYgPSB2aXNpdChub2RlLmtleSwgbm9kZS52YWx1ZSlcbiAgICAgIGlmKHYpIHsgcmV0dXJuIHYgfVxuICAgIH1cbiAgfVxuICBpZihoID4gMCAmJiBub2RlLnJpZ2h0KSB7XG4gICAgcmV0dXJuIGRvVmlzaXQobG8sIGhpLCBjb21wYXJlLCB2aXNpdCwgbm9kZS5yaWdodClcbiAgfVxufVxuXG5cbnByb3RvLmZvckVhY2ggPSBmdW5jdGlvbiByYlRyZWVGb3JFYWNoKHZpc2l0LCBsbywgaGkpIHtcbiAgaWYoIXRoaXMucm9vdCkge1xuICAgIHJldHVyblxuICB9XG4gIHN3aXRjaChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIGRvVmlzaXRGdWxsKHZpc2l0LCB0aGlzLnJvb3QpXG4gICAgYnJlYWtcblxuICAgIGNhc2UgMjpcbiAgICAgIHJldHVybiBkb1Zpc2l0SGFsZihsbywgdGhpcy5fY29tcGFyZSwgdmlzaXQsIHRoaXMucm9vdClcbiAgICBicmVha1xuXG4gICAgY2FzZSAzOlxuICAgICAgaWYodGhpcy5fY29tcGFyZShsbywgaGkpID49IDApIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICByZXR1cm4gZG9WaXNpdChsbywgaGksIHRoaXMuX2NvbXBhcmUsIHZpc2l0LCB0aGlzLnJvb3QpXG4gICAgYnJlYWtcbiAgfVxufVxuXG4vL0ZpcnN0IGl0ZW0gaW4gbGlzdFxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCBcImJlZ2luXCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhY2sgPSBbXVxuICAgIHZhciBuID0gdGhpcy5yb290XG4gICAgd2hpbGUobikge1xuICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgbiA9IG4ubGVmdFxuICAgIH1cbiAgICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZUl0ZXJhdG9yKHRoaXMsIHN0YWNrKVxuICB9XG59KVxuXG4vL0xhc3QgaXRlbSBpbiBsaXN0XG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sIFwiZW5kXCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhY2sgPSBbXVxuICAgIHZhciBuID0gdGhpcy5yb290XG4gICAgd2hpbGUobikge1xuICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgbiA9IG4ucmlnaHRcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWVJdGVyYXRvcih0aGlzLCBzdGFjaylcbiAgfVxufSlcblxuLy9GaW5kIHRoZSBpdGggaXRlbSBpbiB0aGUgdHJlZVxucHJvdG8uYXQgPSBmdW5jdGlvbihpZHgpIHtcbiAgaWYoaWR4IDwgMCkge1xuICAgIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgW10pXG4gIH1cbiAgdmFyIG4gPSB0aGlzLnJvb3RcbiAgdmFyIHN0YWNrID0gW11cbiAgd2hpbGUodHJ1ZSkge1xuICAgIHN0YWNrLnB1c2gobilcbiAgICBpZihuLmxlZnQpIHtcbiAgICAgIGlmKGlkeCA8IG4ubGVmdC5fY291bnQpIHtcbiAgICAgICAgbiA9IG4ubGVmdFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgaWR4IC09IG4ubGVmdC5fY291bnRcbiAgICB9XG4gICAgaWYoIWlkeCkge1xuICAgICAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWVJdGVyYXRvcih0aGlzLCBzdGFjaylcbiAgICB9XG4gICAgaWR4IC09IDFcbiAgICBpZihuLnJpZ2h0KSB7XG4gICAgICBpZihpZHggPj0gbi5yaWdodC5fY291bnQpIHtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIG4gPSBuLnJpZ2h0XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgW10pXG59XG5cbnByb3RvLmdlID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIHZhciBuID0gdGhpcy5yb290XG4gIHZhciBzdGFjayA9IFtdXG4gIHZhciBsYXN0X3B0ciA9IDBcbiAgd2hpbGUobikge1xuICAgIHZhciBkID0gY21wKGtleSwgbi5rZXkpXG4gICAgc3RhY2sucHVzaChuKVxuICAgIGlmKGQgPD0gMCkge1xuICAgICAgbGFzdF9wdHIgPSBzdGFjay5sZW5ndGhcbiAgICB9XG4gICAgaWYoZCA8PSAwKSB7XG4gICAgICBuID0gbi5sZWZ0XG4gICAgfSBlbHNlIHtcbiAgICAgIG4gPSBuLnJpZ2h0XG4gICAgfVxuICB9XG4gIHN0YWNrLmxlbmd0aCA9IGxhc3RfcHRyXG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgc3RhY2spXG59XG5cbnByb3RvLmd0ID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIHZhciBuID0gdGhpcy5yb290XG4gIHZhciBzdGFjayA9IFtdXG4gIHZhciBsYXN0X3B0ciA9IDBcbiAgd2hpbGUobikge1xuICAgIHZhciBkID0gY21wKGtleSwgbi5rZXkpXG4gICAgc3RhY2sucHVzaChuKVxuICAgIGlmKGQgPCAwKSB7XG4gICAgICBsYXN0X3B0ciA9IHN0YWNrLmxlbmd0aFxuICAgIH1cbiAgICBpZihkIDwgMCkge1xuICAgICAgbiA9IG4ubGVmdFxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbi5yaWdodFxuICAgIH1cbiAgfVxuICBzdGFjay5sZW5ndGggPSBsYXN0X3B0clxuICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZUl0ZXJhdG9yKHRoaXMsIHN0YWNrKVxufVxuXG5wcm90by5sdCA9IGZ1bmN0aW9uKGtleSkge1xuICB2YXIgY21wID0gdGhpcy5fY29tcGFyZVxuICB2YXIgbiA9IHRoaXMucm9vdFxuICB2YXIgc3RhY2sgPSBbXVxuICB2YXIgbGFzdF9wdHIgPSAwXG4gIHdoaWxlKG4pIHtcbiAgICB2YXIgZCA9IGNtcChrZXksIG4ua2V5KVxuICAgIHN0YWNrLnB1c2gobilcbiAgICBpZihkID4gMCkge1xuICAgICAgbGFzdF9wdHIgPSBzdGFjay5sZW5ndGhcbiAgICB9XG4gICAgaWYoZCA8PSAwKSB7XG4gICAgICBuID0gbi5sZWZ0XG4gICAgfSBlbHNlIHtcbiAgICAgIG4gPSBuLnJpZ2h0XG4gICAgfVxuICB9XG4gIHN0YWNrLmxlbmd0aCA9IGxhc3RfcHRyXG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgc3RhY2spXG59XG5cbnByb3RvLmxlID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIHZhciBuID0gdGhpcy5yb290XG4gIHZhciBzdGFjayA9IFtdXG4gIHZhciBsYXN0X3B0ciA9IDBcbiAgd2hpbGUobikge1xuICAgIHZhciBkID0gY21wKGtleSwgbi5rZXkpXG4gICAgc3RhY2sucHVzaChuKVxuICAgIGlmKGQgPj0gMCkge1xuICAgICAgbGFzdF9wdHIgPSBzdGFjay5sZW5ndGhcbiAgICB9XG4gICAgaWYoZCA8IDApIHtcbiAgICAgIG4gPSBuLmxlZnRcbiAgICB9IGVsc2Uge1xuICAgICAgbiA9IG4ucmlnaHRcbiAgICB9XG4gIH1cbiAgc3RhY2subGVuZ3RoID0gbGFzdF9wdHJcbiAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWVJdGVyYXRvcih0aGlzLCBzdGFjaylcbn1cblxuLy9GaW5kcyB0aGUgaXRlbSB3aXRoIGtleSBpZiBpdCBleGlzdHNcbnByb3RvLmZpbmQgPSBmdW5jdGlvbihrZXkpIHtcbiAgdmFyIGNtcCA9IHRoaXMuX2NvbXBhcmVcbiAgdmFyIG4gPSB0aGlzLnJvb3RcbiAgdmFyIHN0YWNrID0gW11cbiAgd2hpbGUobikge1xuICAgIHZhciBkID0gY21wKGtleSwgbi5rZXkpXG4gICAgc3RhY2sucHVzaChuKVxuICAgIGlmKGQgPT09IDApIHtcbiAgICAgIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgc3RhY2spXG4gICAgfVxuICAgIGlmKGQgPD0gMCkge1xuICAgICAgbiA9IG4ubGVmdFxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbi5yaWdodFxuICAgIH1cbiAgfVxuICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZUl0ZXJhdG9yKHRoaXMsIFtdKVxufVxuXG4vL1JlbW92ZXMgaXRlbSB3aXRoIGtleSBmcm9tIHRyZWVcbnByb3RvLnJlbW92ZSA9IGZ1bmN0aW9uKGtleSkge1xuICB2YXIgaXRlciA9IHRoaXMuZmluZChrZXkpXG4gIGlmKGl0ZXIpIHtcbiAgICByZXR1cm4gaXRlci5yZW1vdmUoKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbi8vUmV0dXJucyB0aGUgaXRlbSBhdCBga2V5YFxucHJvdG8uZ2V0ID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIHZhciBuID0gdGhpcy5yb290XG4gIHdoaWxlKG4pIHtcbiAgICB2YXIgZCA9IGNtcChrZXksIG4ua2V5KVxuICAgIGlmKGQgPT09IDApIHtcbiAgICAgIHJldHVybiBuLnZhbHVlXG4gICAgfVxuICAgIGlmKGQgPD0gMCkge1xuICAgICAgbiA9IG4ubGVmdFxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbi5yaWdodFxuICAgIH1cbiAgfVxuICByZXR1cm5cbn1cblxuLy9JdGVyYXRvciBmb3IgcmVkIGJsYWNrIHRyZWVcbmZ1bmN0aW9uIFJlZEJsYWNrVHJlZUl0ZXJhdG9yKHRyZWUsIHN0YWNrKSB7XG4gIHRoaXMudHJlZSA9IHRyZWVcbiAgdGhpcy5fc3RhY2sgPSBzdGFja1xufVxuXG52YXIgaXByb3RvID0gUmVkQmxhY2tUcmVlSXRlcmF0b3IucHJvdG90eXBlXG5cbi8vVGVzdCBpZiBpdGVyYXRvciBpcyB2YWxpZFxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGlwcm90bywgXCJ2YWxpZFwiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0YWNrLmxlbmd0aCA+IDBcbiAgfVxufSlcblxuLy9Ob2RlIG9mIHRoZSBpdGVyYXRvclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGlwcm90bywgXCJub2RlXCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICBpZih0aGlzLl9zdGFjay5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhY2tbdGhpcy5fc3RhY2subGVuZ3RoLTFdXG4gICAgfVxuICAgIHJldHVybiBudWxsXG4gIH0sXG4gIGVudW1lcmFibGU6IHRydWVcbn0pXG5cbi8vTWFrZXMgYSBjb3B5IG9mIGFuIGl0ZXJhdG9yXG5pcHJvdG8uY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWVJdGVyYXRvcih0aGlzLnRyZWUsIHRoaXMuX3N0YWNrLnNsaWNlKCkpXG59XG5cbi8vU3dhcHMgdHdvIG5vZGVzXG5mdW5jdGlvbiBzd2FwTm9kZShuLCB2KSB7XG4gIG4ua2V5ID0gdi5rZXlcbiAgbi52YWx1ZSA9IHYudmFsdWVcbiAgbi5sZWZ0ID0gdi5sZWZ0XG4gIG4ucmlnaHQgPSB2LnJpZ2h0XG4gIG4uX2NvbG9yID0gdi5fY29sb3JcbiAgbi5fY291bnQgPSB2Ll9jb3VudFxufVxuXG4vL0ZpeCB1cCBhIGRvdWJsZSBibGFjayBub2RlIGluIGEgdHJlZVxuZnVuY3Rpb24gZml4RG91YmxlQmxhY2soc3RhY2spIHtcbiAgdmFyIG4sIHAsIHMsIHpcbiAgZm9yKHZhciBpPXN0YWNrLmxlbmd0aC0xOyBpPj0wOyAtLWkpIHtcbiAgICBuID0gc3RhY2tbaV1cbiAgICBpZihpID09PSAwKSB7XG4gICAgICBuLl9jb2xvciA9IEJMQUNLXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgLy9jb25zb2xlLmxvZyhcInZpc2l0IG5vZGU6XCIsIG4ua2V5LCBpLCBzdGFja1tpXS5rZXksIHN0YWNrW2ktMV0ua2V5KVxuICAgIHAgPSBzdGFja1tpLTFdXG4gICAgaWYocC5sZWZ0ID09PSBuKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKFwibGVmdCBjaGlsZFwiKVxuICAgICAgcyA9IHAucmlnaHRcbiAgICAgIGlmKHMucmlnaHQgJiYgcy5yaWdodC5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiY2FzZSAxOiByaWdodCBzaWJsaW5nIGNoaWxkIHJlZFwiKVxuICAgICAgICBzID0gcC5yaWdodCA9IGNsb25lTm9kZShzKVxuICAgICAgICB6ID0gcy5yaWdodCA9IGNsb25lTm9kZShzLnJpZ2h0KVxuICAgICAgICBwLnJpZ2h0ID0gcy5sZWZ0XG4gICAgICAgIHMubGVmdCA9IHBcbiAgICAgICAgcy5yaWdodCA9IHpcbiAgICAgICAgcy5fY29sb3IgPSBwLl9jb2xvclxuICAgICAgICBuLl9jb2xvciA9IEJMQUNLXG4gICAgICAgIHAuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgei5fY29sb3IgPSBCTEFDS1xuICAgICAgICByZWNvdW50KHApXG4gICAgICAgIHJlY291bnQocylcbiAgICAgICAgaWYoaSA+IDEpIHtcbiAgICAgICAgICB2YXIgcHAgPSBzdGFja1tpLTJdXG4gICAgICAgICAgaWYocHAubGVmdCA9PT0gcCkge1xuICAgICAgICAgICAgcHAubGVmdCA9IHNcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHAucmlnaHQgPSBzXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0YWNrW2ktMV0gPSBzXG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIGlmKHMubGVmdCAmJiBzLmxlZnQuX2NvbG9yID09PSBSRUQpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImNhc2UgMTogbGVmdCBzaWJsaW5nIGNoaWxkIHJlZFwiKVxuICAgICAgICBzID0gcC5yaWdodCA9IGNsb25lTm9kZShzKVxuICAgICAgICB6ID0gcy5sZWZ0ID0gY2xvbmVOb2RlKHMubGVmdClcbiAgICAgICAgcC5yaWdodCA9IHoubGVmdFxuICAgICAgICBzLmxlZnQgPSB6LnJpZ2h0XG4gICAgICAgIHoubGVmdCA9IHBcbiAgICAgICAgei5yaWdodCA9IHNcbiAgICAgICAgei5fY29sb3IgPSBwLl9jb2xvclxuICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgIHMuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgbi5fY29sb3IgPSBCTEFDS1xuICAgICAgICByZWNvdW50KHApXG4gICAgICAgIHJlY291bnQocylcbiAgICAgICAgcmVjb3VudCh6KVxuICAgICAgICBpZihpID4gMSkge1xuICAgICAgICAgIHZhciBwcCA9IHN0YWNrW2ktMl1cbiAgICAgICAgICBpZihwcC5sZWZ0ID09PSBwKSB7XG4gICAgICAgICAgICBwcC5sZWZ0ID0gelxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcC5yaWdodCA9IHpcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2tbaS0xXSA9IHpcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBpZihzLl9jb2xvciA9PT0gQkxBQ0spIHtcbiAgICAgICAgaWYocC5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDI6IGJsYWNrIHNpYmxpbmcsIHJlZCBwYXJlbnRcIiwgcC5yaWdodC52YWx1ZSlcbiAgICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgICAgcC5yaWdodCA9IHJlcGFpbnQoUkVELCBzKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDI6IGJsYWNrIHNpYmxpbmcsIGJsYWNrIHBhcmVudFwiLCBwLnJpZ2h0LnZhbHVlKVxuICAgICAgICAgIHAucmlnaHQgPSByZXBhaW50KFJFRCwgcylcbiAgICAgICAgICBjb250aW51ZSAgXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDM6IHJlZCBzaWJsaW5nXCIpXG4gICAgICAgIHMgPSBjbG9uZU5vZGUocylcbiAgICAgICAgcC5yaWdodCA9IHMubGVmdFxuICAgICAgICBzLmxlZnQgPSBwXG4gICAgICAgIHMuX2NvbG9yID0gcC5fY29sb3JcbiAgICAgICAgcC5fY29sb3IgPSBSRURcbiAgICAgICAgcmVjb3VudChwKVxuICAgICAgICByZWNvdW50KHMpXG4gICAgICAgIGlmKGkgPiAxKSB7XG4gICAgICAgICAgdmFyIHBwID0gc3RhY2tbaS0yXVxuICAgICAgICAgIGlmKHBwLmxlZnQgPT09IHApIHtcbiAgICAgICAgICAgIHBwLmxlZnQgPSBzXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBwLnJpZ2h0ID0gc1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdGFja1tpLTFdID0gc1xuICAgICAgICBzdGFja1tpXSA9IHBcbiAgICAgICAgaWYoaSsxIDwgc3RhY2subGVuZ3RoKSB7XG4gICAgICAgICAgc3RhY2tbaSsxXSA9IG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdGFjay5wdXNoKG4pXG4gICAgICAgIH1cbiAgICAgICAgaSA9IGkrMlxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2NvbnNvbGUubG9nKFwicmlnaHQgY2hpbGRcIilcbiAgICAgIHMgPSBwLmxlZnRcbiAgICAgIGlmKHMubGVmdCAmJiBzLmxlZnQuX2NvbG9yID09PSBSRUQpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImNhc2UgMTogbGVmdCBzaWJsaW5nIGNoaWxkIHJlZFwiLCBwLnZhbHVlLCBwLl9jb2xvcilcbiAgICAgICAgcyA9IHAubGVmdCA9IGNsb25lTm9kZShzKVxuICAgICAgICB6ID0gcy5sZWZ0ID0gY2xvbmVOb2RlKHMubGVmdClcbiAgICAgICAgcC5sZWZ0ID0gcy5yaWdodFxuICAgICAgICBzLnJpZ2h0ID0gcFxuICAgICAgICBzLmxlZnQgPSB6XG4gICAgICAgIHMuX2NvbG9yID0gcC5fY29sb3JcbiAgICAgICAgbi5fY29sb3IgPSBCTEFDS1xuICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgIHouX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgcmVjb3VudChwKVxuICAgICAgICByZWNvdW50KHMpXG4gICAgICAgIGlmKGkgPiAxKSB7XG4gICAgICAgICAgdmFyIHBwID0gc3RhY2tbaS0yXVxuICAgICAgICAgIGlmKHBwLnJpZ2h0ID09PSBwKSB7XG4gICAgICAgICAgICBwcC5yaWdodCA9IHNcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHAubGVmdCA9IHNcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2tbaS0xXSA9IHNcbiAgICAgICAgcmV0dXJuXG4gICAgICB9IGVsc2UgaWYocy5yaWdodCAmJiBzLnJpZ2h0Ll9jb2xvciA9PT0gUkVEKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDE6IHJpZ2h0IHNpYmxpbmcgY2hpbGQgcmVkXCIpXG4gICAgICAgIHMgPSBwLmxlZnQgPSBjbG9uZU5vZGUocylcbiAgICAgICAgeiA9IHMucmlnaHQgPSBjbG9uZU5vZGUocy5yaWdodClcbiAgICAgICAgcC5sZWZ0ID0gei5yaWdodFxuICAgICAgICBzLnJpZ2h0ID0gei5sZWZ0XG4gICAgICAgIHoucmlnaHQgPSBwXG4gICAgICAgIHoubGVmdCA9IHNcbiAgICAgICAgei5fY29sb3IgPSBwLl9jb2xvclxuICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgIHMuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgbi5fY29sb3IgPSBCTEFDS1xuICAgICAgICByZWNvdW50KHApXG4gICAgICAgIHJlY291bnQocylcbiAgICAgICAgcmVjb3VudCh6KVxuICAgICAgICBpZihpID4gMSkge1xuICAgICAgICAgIHZhciBwcCA9IHN0YWNrW2ktMl1cbiAgICAgICAgICBpZihwcC5yaWdodCA9PT0gcCkge1xuICAgICAgICAgICAgcHAucmlnaHQgPSB6XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBwLmxlZnQgPSB6XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0YWNrW2ktMV0gPSB6XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgaWYocy5fY29sb3IgPT09IEJMQUNLKSB7XG4gICAgICAgIGlmKHAuX2NvbG9yID09PSBSRUQpIHtcbiAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiY2FzZSAyOiBibGFjayBzaWJsaW5nLCByZWQgcGFyZW50XCIpXG4gICAgICAgICAgcC5fY29sb3IgPSBCTEFDS1xuICAgICAgICAgIHAubGVmdCA9IHJlcGFpbnQoUkVELCBzKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDI6IGJsYWNrIHNpYmxpbmcsIGJsYWNrIHBhcmVudFwiKVxuICAgICAgICAgIHAubGVmdCA9IHJlcGFpbnQoUkVELCBzKVxuICAgICAgICAgIGNvbnRpbnVlICBcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImNhc2UgMzogcmVkIHNpYmxpbmdcIilcbiAgICAgICAgcyA9IGNsb25lTm9kZShzKVxuICAgICAgICBwLmxlZnQgPSBzLnJpZ2h0XG4gICAgICAgIHMucmlnaHQgPSBwXG4gICAgICAgIHMuX2NvbG9yID0gcC5fY29sb3JcbiAgICAgICAgcC5fY29sb3IgPSBSRURcbiAgICAgICAgcmVjb3VudChwKVxuICAgICAgICByZWNvdW50KHMpXG4gICAgICAgIGlmKGkgPiAxKSB7XG4gICAgICAgICAgdmFyIHBwID0gc3RhY2tbaS0yXVxuICAgICAgICAgIGlmKHBwLnJpZ2h0ID09PSBwKSB7XG4gICAgICAgICAgICBwcC5yaWdodCA9IHNcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHAubGVmdCA9IHNcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2tbaS0xXSA9IHNcbiAgICAgICAgc3RhY2tbaV0gPSBwXG4gICAgICAgIGlmKGkrMSA8IHN0YWNrLmxlbmd0aCkge1xuICAgICAgICAgIHN0YWNrW2krMV0gPSBuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgICB9XG4gICAgICAgIGkgPSBpKzJcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLy9SZW1vdmVzIGl0ZW0gYXQgaXRlcmF0b3IgZnJvbSB0cmVlXG5pcHJvdG8ucmVtb3ZlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGFjayA9IHRoaXMuX3N0YWNrXG4gIGlmKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB0aGlzLnRyZWVcbiAgfVxuICAvL0ZpcnN0IGNvcHkgcGF0aCB0byBub2RlXG4gIHZhciBjc3RhY2sgPSBuZXcgQXJyYXkoc3RhY2subGVuZ3RoKVxuICB2YXIgbiA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVxuICBjc3RhY2tbY3N0YWNrLmxlbmd0aC0xXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBuLmxlZnQsIG4ucmlnaHQsIG4uX2NvdW50KVxuICBmb3IodmFyIGk9c3RhY2subGVuZ3RoLTI7IGk+PTA7IC0taSkge1xuICAgIHZhciBuID0gc3RhY2tbaV1cbiAgICBpZihuLmxlZnQgPT09IHN0YWNrW2krMV0pIHtcbiAgICAgIGNzdGFja1tpXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBjc3RhY2tbaSsxXSwgbi5yaWdodCwgbi5fY291bnQpXG4gICAgfSBlbHNlIHtcbiAgICAgIGNzdGFja1tpXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBuLmxlZnQsIGNzdGFja1tpKzFdLCBuLl9jb3VudClcbiAgICB9XG4gIH1cblxuICAvL0dldCBub2RlXG4gIG4gPSBjc3RhY2tbY3N0YWNrLmxlbmd0aC0xXVxuICAvL2NvbnNvbGUubG9nKFwic3RhcnQgcmVtb3ZlOiBcIiwgbi52YWx1ZSlcblxuICAvL0lmIG5vdCBsZWFmLCB0aGVuIHN3YXAgd2l0aCBwcmV2aW91cyBub2RlXG4gIGlmKG4ubGVmdCAmJiBuLnJpZ2h0KSB7XG4gICAgLy9jb25zb2xlLmxvZyhcIm1vdmluZyB0byBsZWFmXCIpXG5cbiAgICAvL0ZpcnN0IHdhbGsgdG8gcHJldmlvdXMgbGVhZlxuICAgIHZhciBzcGxpdCA9IGNzdGFjay5sZW5ndGhcbiAgICBuID0gbi5sZWZ0XG4gICAgd2hpbGUobi5yaWdodCkge1xuICAgICAgY3N0YWNrLnB1c2gobilcbiAgICAgIG4gPSBuLnJpZ2h0XG4gICAgfVxuICAgIC8vQ29weSBwYXRoIHRvIGxlYWZcbiAgICB2YXIgdiA9IGNzdGFja1tzcGxpdC0xXVxuICAgIGNzdGFjay5wdXNoKG5ldyBSQk5vZGUobi5fY29sb3IsIHYua2V5LCB2LnZhbHVlLCBuLmxlZnQsIG4ucmlnaHQsIG4uX2NvdW50KSlcbiAgICBjc3RhY2tbc3BsaXQtMV0ua2V5ID0gbi5rZXlcbiAgICBjc3RhY2tbc3BsaXQtMV0udmFsdWUgPSBuLnZhbHVlXG5cbiAgICAvL0ZpeCB1cCBzdGFja1xuICAgIGZvcih2YXIgaT1jc3RhY2subGVuZ3RoLTI7IGk+PXNwbGl0OyAtLWkpIHtcbiAgICAgIG4gPSBjc3RhY2tbaV1cbiAgICAgIGNzdGFja1tpXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBuLmxlZnQsIGNzdGFja1tpKzFdLCBuLl9jb3VudClcbiAgICB9XG4gICAgY3N0YWNrW3NwbGl0LTFdLmxlZnQgPSBjc3RhY2tbc3BsaXRdXG4gIH1cbiAgLy9jb25zb2xlLmxvZyhcInN0YWNrPVwiLCBjc3RhY2subWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHYudmFsdWUgfSkpXG5cbiAgLy9SZW1vdmUgbGVhZiBub2RlXG4gIG4gPSBjc3RhY2tbY3N0YWNrLmxlbmd0aC0xXVxuICBpZihuLl9jb2xvciA9PT0gUkVEKSB7XG4gICAgLy9FYXN5IGNhc2U6IHJlbW92aW5nIHJlZCBsZWFmXG4gICAgLy9jb25zb2xlLmxvZyhcIlJFRCBsZWFmXCIpXG4gICAgdmFyIHAgPSBjc3RhY2tbY3N0YWNrLmxlbmd0aC0yXVxuICAgIGlmKHAubGVmdCA9PT0gbikge1xuICAgICAgcC5sZWZ0ID0gbnVsbFxuICAgIH0gZWxzZSBpZihwLnJpZ2h0ID09PSBuKSB7XG4gICAgICBwLnJpZ2h0ID0gbnVsbFxuICAgIH1cbiAgICBjc3RhY2sucG9wKClcbiAgICBmb3IodmFyIGk9MDsgaTxjc3RhY2subGVuZ3RoOyArK2kpIHtcbiAgICAgIGNzdGFja1tpXS5fY291bnQtLVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZSh0aGlzLnRyZWUuX2NvbXBhcmUsIGNzdGFja1swXSlcbiAgfSBlbHNlIHtcbiAgICBpZihuLmxlZnQgfHwgbi5yaWdodCkge1xuICAgICAgLy9TZWNvbmQgZWFzeSBjYXNlOiAgU2luZ2xlIGNoaWxkIGJsYWNrIHBhcmVudFxuICAgICAgLy9jb25zb2xlLmxvZyhcIkJMQUNLIHNpbmdsZSBjaGlsZFwiKVxuICAgICAgaWYobi5sZWZ0KSB7XG4gICAgICAgIHN3YXBOb2RlKG4sIG4ubGVmdClcbiAgICAgIH0gZWxzZSBpZihuLnJpZ2h0KSB7XG4gICAgICAgIHN3YXBOb2RlKG4sIG4ucmlnaHQpXG4gICAgICB9XG4gICAgICAvL0NoaWxkIG11c3QgYmUgcmVkLCBzbyByZXBhaW50IGl0IGJsYWNrIHRvIGJhbGFuY2UgY29sb3JcbiAgICAgIG4uX2NvbG9yID0gQkxBQ0tcbiAgICAgIGZvcih2YXIgaT0wOyBpPGNzdGFjay5sZW5ndGgtMTsgKytpKSB7XG4gICAgICAgIGNzdGFja1tpXS5fY291bnQtLVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWUodGhpcy50cmVlLl9jb21wYXJlLCBjc3RhY2tbMF0pXG4gICAgfSBlbHNlIGlmKGNzdGFjay5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vVGhpcmQgZWFzeSBjYXNlOiByb290XG4gICAgICAvL2NvbnNvbGUubG9nKFwiUk9PVFwiKVxuICAgICAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWUodGhpcy50cmVlLl9jb21wYXJlLCBudWxsKVxuICAgIH0gZWxzZSB7XG4gICAgICAvL0hhcmQgY2FzZTogUmVwYWludCBuLCBhbmQgdGhlbiBkbyBzb21lIG5hc3R5IHN0dWZmXG4gICAgICAvL2NvbnNvbGUubG9nKFwiQkxBQ0sgbGVhZiBubyBjaGlsZHJlblwiKVxuICAgICAgZm9yKHZhciBpPTA7IGk8Y3N0YWNrLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNzdGFja1tpXS5fY291bnQtLVxuICAgICAgfVxuICAgICAgdmFyIHBhcmVudCA9IGNzdGFja1tjc3RhY2subGVuZ3RoLTJdXG4gICAgICBmaXhEb3VibGVCbGFjayhjc3RhY2spXG4gICAgICAvL0ZpeCB1cCBsaW5rc1xuICAgICAgaWYocGFyZW50LmxlZnQgPT09IG4pIHtcbiAgICAgICAgcGFyZW50LmxlZnQgPSBudWxsXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnQucmlnaHQgPSBudWxsXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlKHRoaXMudHJlZS5fY29tcGFyZSwgY3N0YWNrWzBdKVxufVxuXG4vL1JldHVybnMga2V5XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoaXByb3RvLCBcImtleVwiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgaWYodGhpcy5fc3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YWNrW3RoaXMuX3N0YWNrLmxlbmd0aC0xXS5rZXlcbiAgICB9XG4gICAgcmV0dXJuXG4gIH0sXG4gIGVudW1lcmFibGU6IHRydWVcbn0pXG5cbi8vUmV0dXJucyB2YWx1ZVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGlwcm90bywgXCJ2YWx1ZVwiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgaWYodGhpcy5fc3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YWNrW3RoaXMuX3N0YWNrLmxlbmd0aC0xXS52YWx1ZVxuICAgIH1cbiAgICByZXR1cm5cbiAgfSxcbiAgZW51bWVyYWJsZTogdHJ1ZVxufSlcblxuXG4vL1JldHVybnMgdGhlIHBvc2l0aW9uIG9mIHRoaXMgaXRlcmF0b3IgaW4gdGhlIHNvcnRlZCBsaXN0XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoaXByb3RvLCBcImluZGV4XCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaWR4ID0gMFxuICAgIHZhciBzdGFjayA9IHRoaXMuX3N0YWNrXG4gICAgaWYoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICB2YXIgciA9IHRoaXMudHJlZS5yb290XG4gICAgICBpZihyKSB7XG4gICAgICAgIHJldHVybiByLl9jb3VudFxuICAgICAgfVxuICAgICAgcmV0dXJuIDBcbiAgICB9IGVsc2UgaWYoc3RhY2tbc3RhY2subGVuZ3RoLTFdLmxlZnQpIHtcbiAgICAgIGlkeCA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXS5sZWZ0Ll9jb3VudFxuICAgIH1cbiAgICBmb3IodmFyIHM9c3RhY2subGVuZ3RoLTI7IHM+PTA7IC0tcykge1xuICAgICAgaWYoc3RhY2tbcysxXSA9PT0gc3RhY2tbc10ucmlnaHQpIHtcbiAgICAgICAgKytpZHhcbiAgICAgICAgaWYoc3RhY2tbc10ubGVmdCkge1xuICAgICAgICAgIGlkeCArPSBzdGFja1tzXS5sZWZ0Ll9jb3VudFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpZHhcbiAgfSxcbiAgZW51bWVyYWJsZTogdHJ1ZVxufSlcblxuLy9BZHZhbmNlcyBpdGVyYXRvciB0byBuZXh0IGVsZW1lbnQgaW4gbGlzdFxuaXByb3RvLm5leHQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YWNrID0gdGhpcy5fc3RhY2tcbiAgaWYoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgdmFyIG4gPSBzdGFja1tzdGFjay5sZW5ndGgtMV1cbiAgaWYobi5yaWdodCkge1xuICAgIG4gPSBuLnJpZ2h0XG4gICAgd2hpbGUobikge1xuICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgbiA9IG4ubGVmdFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBzdGFjay5wb3AoKVxuICAgIHdoaWxlKHN0YWNrLmxlbmd0aCA+IDAgJiYgc3RhY2tbc3RhY2subGVuZ3RoLTFdLnJpZ2h0ID09PSBuKSB7XG4gICAgICBuID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdXG4gICAgICBzdGFjay5wb3AoKVxuICAgIH1cbiAgfVxufVxuXG4vL0NoZWNrcyBpZiBpdGVyYXRvciBpcyBhdCBlbmQgb2YgdHJlZVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGlwcm90bywgXCJoYXNOZXh0XCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhY2sgPSB0aGlzLl9zdGFja1xuICAgIGlmKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIGlmKHN0YWNrW3N0YWNrLmxlbmd0aC0xXS5yaWdodCkge1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgZm9yKHZhciBzPXN0YWNrLmxlbmd0aC0xOyBzPjA7IC0tcykge1xuICAgICAgaWYoc3RhY2tbcy0xXS5sZWZ0ID09PSBzdGFja1tzXSkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSlcblxuLy9VcGRhdGUgdmFsdWVcbmlwcm90by51cGRhdGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgc3RhY2sgPSB0aGlzLl9zdGFja1xuICBpZihzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCB1cGRhdGUgZW1wdHkgbm9kZSFcIilcbiAgfVxuICB2YXIgY3N0YWNrID0gbmV3IEFycmF5KHN0YWNrLmxlbmd0aClcbiAgdmFyIG4gPSBzdGFja1tzdGFjay5sZW5ndGgtMV1cbiAgY3N0YWNrW2NzdGFjay5sZW5ndGgtMV0gPSBuZXcgUkJOb2RlKG4uX2NvbG9yLCBuLmtleSwgdmFsdWUsIG4ubGVmdCwgbi5yaWdodCwgbi5fY291bnQpXG4gIGZvcih2YXIgaT1zdGFjay5sZW5ndGgtMjsgaT49MDsgLS1pKSB7XG4gICAgbiA9IHN0YWNrW2ldXG4gICAgaWYobi5sZWZ0ID09PSBzdGFja1tpKzFdKSB7XG4gICAgICBjc3RhY2tbaV0gPSBuZXcgUkJOb2RlKG4uX2NvbG9yLCBuLmtleSwgbi52YWx1ZSwgY3N0YWNrW2krMV0sIG4ucmlnaHQsIG4uX2NvdW50KVxuICAgIH0gZWxzZSB7XG4gICAgICBjc3RhY2tbaV0gPSBuZXcgUkJOb2RlKG4uX2NvbG9yLCBuLmtleSwgbi52YWx1ZSwgbi5sZWZ0LCBjc3RhY2tbaSsxXSwgbi5fY291bnQpXG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlKHRoaXMudHJlZS5fY29tcGFyZSwgY3N0YWNrWzBdKVxufVxuXG4vL01vdmVzIGl0ZXJhdG9yIGJhY2t3YXJkIG9uZSBlbGVtZW50XG5pcHJvdG8ucHJldiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhY2sgPSB0aGlzLl9zdGFja1xuICBpZihzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm5cbiAgfVxuICB2YXIgbiA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVxuICBpZihuLmxlZnQpIHtcbiAgICBuID0gbi5sZWZ0XG4gICAgd2hpbGUobikge1xuICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgbiA9IG4ucmlnaHRcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgc3RhY2sucG9wKClcbiAgICB3aGlsZShzdGFjay5sZW5ndGggPiAwICYmIHN0YWNrW3N0YWNrLmxlbmd0aC0xXS5sZWZ0ID09PSBuKSB7XG4gICAgICBuID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdXG4gICAgICBzdGFjay5wb3AoKVxuICAgIH1cbiAgfVxufVxuXG4vL0NoZWNrcyBpZiBpdGVyYXRvciBpcyBhdCBzdGFydCBvZiB0cmVlXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoaXByb3RvLCBcImhhc1ByZXZcIiwge1xuICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGFjayA9IHRoaXMuX3N0YWNrXG4gICAgaWYoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgaWYoc3RhY2tbc3RhY2subGVuZ3RoLTFdLmxlZnQpIHtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIGZvcih2YXIgcz1zdGFjay5sZW5ndGgtMTsgcz4wOyAtLXMpIHtcbiAgICAgIGlmKHN0YWNrW3MtMV0ucmlnaHQgPT09IHN0YWNrW3NdKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9XG59KVxuXG4vL0RlZmF1bHQgY29tcGFyaXNvbiBmdW5jdGlvblxuZnVuY3Rpb24gZGVmYXVsdENvbXBhcmUoYSwgYikge1xuICBpZihhIDwgYikge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmKGEgPiBiKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuICByZXR1cm4gMFxufVxuXG4vL0J1aWxkIGEgdHJlZVxuZnVuY3Rpb24gY3JlYXRlUkJUcmVlKGNvbXBhcmUpIHtcbiAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWUoY29tcGFyZSB8fCBkZWZhdWx0Q29tcGFyZSwgbnVsbClcbn0iLCIvKiBlc2xpbnQtZGlzYWJsZSBub2RlL25vLWRlcHJlY2F0ZWQtYXBpICovXG52YXIgYnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJylcbnZhciBCdWZmZXIgPSBidWZmZXIuQnVmZmVyXG5cbi8vIGFsdGVybmF0aXZlIHRvIHVzaW5nIE9iamVjdC5rZXlzIGZvciBvbGQgYnJvd3NlcnNcbmZ1bmN0aW9uIGNvcHlQcm9wcyAoc3JjLCBkc3QpIHtcbiAgZm9yICh2YXIga2V5IGluIHNyYykge1xuICAgIGRzdFtrZXldID0gc3JjW2tleV1cbiAgfVxufVxuaWYgKEJ1ZmZlci5mcm9tICYmIEJ1ZmZlci5hbGxvYyAmJiBCdWZmZXIuYWxsb2NVbnNhZmUgJiYgQnVmZmVyLmFsbG9jVW5zYWZlU2xvdykge1xuICBtb2R1bGUuZXhwb3J0cyA9IGJ1ZmZlclxufSBlbHNlIHtcbiAgLy8gQ29weSBwcm9wZXJ0aWVzIGZyb20gcmVxdWlyZSgnYnVmZmVyJylcbiAgY29weVByb3BzKGJ1ZmZlciwgZXhwb3J0cylcbiAgZXhwb3J0cy5CdWZmZXIgPSBTYWZlQnVmZmVyXG59XG5cbmZ1bmN0aW9uIFNhZmVCdWZmZXIgKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBCdWZmZXIoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbi8vIENvcHkgc3RhdGljIG1ldGhvZHMgZnJvbSBCdWZmZXJcbmNvcHlQcm9wcyhCdWZmZXIsIFNhZmVCdWZmZXIpXG5cblNhZmVCdWZmZXIuZnJvbSA9IGZ1bmN0aW9uIChhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IG5vdCBiZSBhIG51bWJlcicpXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlcihhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuU2FmZUJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIG51bWJlcicpXG4gIH1cbiAgdmFyIGJ1ZiA9IEJ1ZmZlcihzaXplKVxuICBpZiAoZmlsbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGJ1Zi5maWxsKGZpbGwsIGVuY29kaW5nKVxuICAgIH0gZWxzZSB7XG4gICAgICBidWYuZmlsbChmaWxsKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBidWYuZmlsbCgwKVxuICB9XG4gIHJldHVybiBidWZcbn1cblxuU2FmZUJ1ZmZlci5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgbnVtYmVyJylcbiAgfVxuICByZXR1cm4gQnVmZmVyKHNpemUpXG59XG5cblNhZmVCdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgaWYgKHR5cGVvZiBzaXplICE9PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBudW1iZXInKVxuICB9XG4gIHJldHVybiBidWZmZXIuU2xvd0J1ZmZlcihzaXplKVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCdpbW1lZGlhdGUnKVxuIiwidmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKVxudmFyIEFic3RyYWN0TGV2ZWxET1dOID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RMZXZlbERPV05cbnZhciBBYnN0cmFjdEl0ZXJhdG9yID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RJdGVyYXRvclxudmFyIGx0Z3QgPSByZXF1aXJlKCdsdGd0JylcbnZhciBjcmVhdGVSQlQgPSByZXF1aXJlKCdmdW5jdGlvbmFsLXJlZC1ibGFjay10cmVlJylcbnZhciBCdWZmZXIgPSByZXF1aXJlKCdzYWZlLWJ1ZmZlcicpLkJ1ZmZlclxudmFyIGdsb2JhbFN0b3JlID0ge31cblxuLy8gSW4gTm9kZSwgdXNlIGdsb2JhbC5zZXRJbW1lZGlhdGUuIEluIHRoZSBicm93c2VyLCB1c2UgYSBjb25zaXN0ZW50XG4vLyBtaWNyb3Rhc2sgbGlicmFyeSB0byBnaXZlIGNvbnNpc3RlbnQgbWljcm90YXNrIGV4cGVyaWVuY2UgdG8gYWxsIGJyb3dzZXJzXG52YXIgc2V0SW1tZWRpYXRlID0gcmVxdWlyZSgnLi9pbW1lZGlhdGUnKVxuXG5mdW5jdGlvbiBndCAodmFsdWUpIHtcbiAgcmV0dXJuIGx0Z3QuY29tcGFyZSh2YWx1ZSwgdGhpcy5fZW5kKSA+IDBcbn1cblxuZnVuY3Rpb24gZ3RlICh2YWx1ZSkge1xuICByZXR1cm4gbHRndC5jb21wYXJlKHZhbHVlLCB0aGlzLl9lbmQpID49IDBcbn1cblxuZnVuY3Rpb24gbHQgKHZhbHVlKSB7XG4gIHJldHVybiBsdGd0LmNvbXBhcmUodmFsdWUsIHRoaXMuX2VuZCkgPCAwXG59XG5cbmZ1bmN0aW9uIGx0ZSAodmFsdWUpIHtcbiAgcmV0dXJuIGx0Z3QuY29tcGFyZSh2YWx1ZSwgdGhpcy5fZW5kKSA8PSAwXG59XG5cbmZ1bmN0aW9uIE1lbUl0ZXJhdG9yIChkYiwgb3B0aW9ucykge1xuICBBYnN0cmFjdEl0ZXJhdG9yLmNhbGwodGhpcywgZGIpXG4gIHRoaXMuX2xpbWl0ID0gb3B0aW9ucy5saW1pdFxuXG4gIGlmICh0aGlzLl9saW1pdCA9PT0gLTEpIHRoaXMuX2xpbWl0ID0gSW5maW5pdHlcblxuICB2YXIgdHJlZSA9IGRiLl9zdG9yZVtkYi5fbG9jYXRpb25dXG5cbiAgdGhpcy5rZXlBc0J1ZmZlciA9IG9wdGlvbnMua2V5QXNCdWZmZXIgIT09IGZhbHNlXG4gIHRoaXMudmFsdWVBc0J1ZmZlciA9IG9wdGlvbnMudmFsdWVBc0J1ZmZlciAhPT0gZmFsc2VcbiAgdGhpcy5fcmV2ZXJzZSA9IG9wdGlvbnMucmV2ZXJzZVxuICB0aGlzLl9vcHRpb25zID0gb3B0aW9uc1xuICB0aGlzLl9kb25lID0gMFxuXG4gIGlmICghdGhpcy5fcmV2ZXJzZSkge1xuICAgIHRoaXMuX2luY3IgPSAnbmV4dCdcbiAgICB0aGlzLl9zdGFydCA9IGx0Z3QubG93ZXJCb3VuZChvcHRpb25zKVxuICAgIHRoaXMuX2VuZCA9IGx0Z3QudXBwZXJCb3VuZChvcHRpb25zKVxuXG4gICAgaWYgKHR5cGVvZiB0aGlzLl9zdGFydCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuX3RyZWUgPSB0cmVlLmJlZ2luXG4gICAgfSBlbHNlIGlmIChsdGd0Lmxvd2VyQm91bmRJbmNsdXNpdmUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3RyZWUgPSB0cmVlLmdlKHRoaXMuX3N0YXJ0KVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl90cmVlID0gdHJlZS5ndCh0aGlzLl9zdGFydClcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZW5kKSB7XG4gICAgICBpZiAobHRndC51cHBlckJvdW5kSW5jbHVzaXZlKG9wdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuX3Rlc3QgPSBsdGVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Rlc3QgPSBsdFxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLl9pbmNyID0gJ3ByZXYnXG4gICAgdGhpcy5fc3RhcnQgPSBsdGd0LnVwcGVyQm91bmQob3B0aW9ucylcbiAgICB0aGlzLl9lbmQgPSBsdGd0Lmxvd2VyQm91bmQob3B0aW9ucylcblxuICAgIGlmICh0eXBlb2YgdGhpcy5fc3RhcnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLl90cmVlID0gdHJlZS5lbmRcbiAgICB9IGVsc2UgaWYgKGx0Z3QudXBwZXJCb3VuZEluY2x1c2l2ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fdHJlZSA9IHRyZWUubGUodGhpcy5fc3RhcnQpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3RyZWUgPSB0cmVlLmx0KHRoaXMuX3N0YXJ0KVxuICAgIH1cblxuICAgIGlmICh0aGlzLl9lbmQpIHtcbiAgICAgIGlmIChsdGd0Lmxvd2VyQm91bmRJbmNsdXNpdmUob3B0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fdGVzdCA9IGd0ZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdGVzdCA9IGd0XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmluaGVyaXRzKE1lbUl0ZXJhdG9yLCBBYnN0cmFjdEl0ZXJhdG9yKVxuXG5NZW1JdGVyYXRvci5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdmFyIGtleVxuICB2YXIgdmFsdWVcblxuICBpZiAodGhpcy5fZG9uZSsrID49IHRoaXMuX2xpbWl0KSByZXR1cm4gc2V0SW1tZWRpYXRlKGNhbGxiYWNrKVxuICBpZiAoIXRoaXMuX3RyZWUudmFsaWQpIHJldHVybiBzZXRJbW1lZGlhdGUoY2FsbGJhY2spXG5cbiAga2V5ID0gdGhpcy5fdHJlZS5rZXlcbiAgdmFsdWUgPSB0aGlzLl90cmVlLnZhbHVlXG5cbiAgaWYgKCF0aGlzLl90ZXN0KGtleSkpIHJldHVybiBzZXRJbW1lZGlhdGUoY2FsbGJhY2spXG5cbiAgaWYgKHRoaXMua2V5QXNCdWZmZXIpIGtleSA9IEJ1ZmZlci5mcm9tKGtleSlcbiAgaWYgKHRoaXMudmFsdWVBc0J1ZmZlcikgdmFsdWUgPSBCdWZmZXIuZnJvbSh2YWx1ZSlcblxuICB0aGlzLl90cmVlW3RoaXMuX2luY3JdKClcblxuICBzZXRJbW1lZGlhdGUoZnVuY3Rpb24gY2FsbE5leHQgKCkge1xuICAgIGNhbGxiYWNrKG51bGwsIGtleSwgdmFsdWUpXG4gIH0pXG59XG5cbk1lbUl0ZXJhdG9yLnByb3RvdHlwZS5fdGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWVcbn1cblxuZnVuY3Rpb24gTWVtRE9XTiAobG9jYXRpb24pIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIE1lbURPV04pKSByZXR1cm4gbmV3IE1lbURPV04obG9jYXRpb24pXG5cbiAgQWJzdHJhY3RMZXZlbERPV04uY2FsbCh0aGlzLCB0eXBlb2YgbG9jYXRpb24gPT09ICdzdHJpbmcnID8gbG9jYXRpb24gOiAnJylcblxuICB0aGlzLl9sb2NhdGlvbiA9IHRoaXMubG9jYXRpb24gPyAnJCcgKyB0aGlzLmxvY2F0aW9uIDogJ190cmVlJ1xuICB0aGlzLl9zdG9yZSA9IHRoaXMubG9jYXRpb24gPyBnbG9iYWxTdG9yZSA6IHRoaXNcbiAgdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dID1cbiAgICB0aGlzLl9zdG9yZVt0aGlzLl9sb2NhdGlvbl0gfHwgY3JlYXRlUkJUKGx0Z3QuY29tcGFyZSlcbn1cblxuTWVtRE9XTi5jbGVhckdsb2JhbFN0b3JlID0gZnVuY3Rpb24gKHN0cmljdCkge1xuICBpZiAoc3RyaWN0KSB7XG4gICAgT2JqZWN0LmtleXMoZ2xvYmFsU3RvcmUpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgZGVsZXRlIGdsb2JhbFN0b3JlW2tleV1cbiAgICB9KVxuICB9IGVsc2Uge1xuICAgIGdsb2JhbFN0b3JlID0ge31cbiAgfVxufVxuXG5pbmhlcml0cyhNZW1ET1dOLCBBYnN0cmFjdExldmVsRE9XTilcblxuTWVtRE9XTi5wcm90b3R5cGUuX29wZW4gPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHNldEltbWVkaWF0ZShmdW5jdGlvbiBjYWxsTmV4dCAoKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgc2VsZilcbiAgfSlcbn1cblxuTWVtRE9XTi5wcm90b3R5cGUuX3B1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJyB8fCB2YWx1ZSA9PT0gbnVsbCkgdmFsdWUgPSAnJ1xuXG4gIHZhciBpdGVyID0gdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dLmZpbmQoa2V5KVxuXG4gIGlmIChpdGVyLnZhbGlkKSB7XG4gICAgdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dID0gaXRlci51cGRhdGUodmFsdWUpXG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dID0gdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dLmluc2VydChrZXksIHZhbHVlKVxuICB9XG5cbiAgc2V0SW1tZWRpYXRlKGNhbGxiYWNrKVxufVxuXG5NZW1ET1dOLnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIHZhbHVlID0gdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dLmdldChrZXkpXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvLyAnTm90Rm91bmQnIGVycm9yLCBjb25zaXN0ZW50IHdpdGggTGV2ZWxET1dOIEFQSVxuICAgIHJldHVybiBzZXRJbW1lZGlhdGUoZnVuY3Rpb24gY2FsbE5leHQgKCkge1xuICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdOb3RGb3VuZCcpKVxuICAgIH0pXG4gIH1cblxuICBpZiAob3B0aW9ucy5hc0J1ZmZlciAhPT0gZmFsc2UgJiYgIXRoaXMuX2lzQnVmZmVyKHZhbHVlKSkge1xuICAgIHZhbHVlID0gQnVmZmVyLmZyb20oU3RyaW5nKHZhbHVlKSlcbiAgfVxuXG4gIHNldEltbWVkaWF0ZShmdW5jdGlvbiBjYWxsTmV4dCAoKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgdmFsdWUpXG4gIH0pXG59XG5cbk1lbURPV04ucHJvdG90eXBlLl9kZWwgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICB0aGlzLl9zdG9yZVt0aGlzLl9sb2NhdGlvbl0gPSB0aGlzLl9zdG9yZVt0aGlzLl9sb2NhdGlvbl0ucmVtb3ZlKGtleSlcbiAgc2V0SW1tZWRpYXRlKGNhbGxiYWNrKVxufVxuXG5NZW1ET1dOLnByb3RvdHlwZS5fYmF0Y2ggPSBmdW5jdGlvbiAoYXJyYXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBpID0gLTFcbiAgdmFyIGtleVxuICB2YXIgdmFsdWVcbiAgdmFyIGl0ZXJcbiAgdmFyIGxlbiA9IGFycmF5Lmxlbmd0aFxuICB2YXIgdHJlZSA9IHRoaXMuX3N0b3JlW3RoaXMuX2xvY2F0aW9uXVxuXG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBpZiAoIWFycmF5W2ldKSBjb250aW51ZVxuXG4gICAga2V5ID0gdGhpcy5faXNCdWZmZXIoYXJyYXlbaV0ua2V5KSA/IGFycmF5W2ldLmtleSA6IFN0cmluZyhhcnJheVtpXS5rZXkpXG4gICAgaXRlciA9IHRyZWUuZmluZChrZXkpXG5cbiAgICBpZiAoYXJyYXlbaV0udHlwZSA9PT0gJ3B1dCcpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5faXNCdWZmZXIoYXJyYXlbaV0udmFsdWUpXG4gICAgICAgID8gYXJyYXlbaV0udmFsdWVcbiAgICAgICAgOiBTdHJpbmcoYXJyYXlbaV0udmFsdWUpXG4gICAgICB0cmVlID0gaXRlci52YWxpZCA/IGl0ZXIudXBkYXRlKHZhbHVlKSA6IHRyZWUuaW5zZXJ0KGtleSwgdmFsdWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRyZWUgPSBpdGVyLnJlbW92ZSgpXG4gICAgfVxuICB9XG5cbiAgdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dID0gdHJlZVxuXG4gIHNldEltbWVkaWF0ZShjYWxsYmFjaylcbn1cblxuTWVtRE9XTi5wcm90b3R5cGUuX2l0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBNZW1JdGVyYXRvcih0aGlzLCBvcHRpb25zKVxufVxuXG5NZW1ET1dOLnByb3RvdHlwZS5faXNCdWZmZXIgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiBCdWZmZXIuaXNCdWZmZXIob2JqKVxufVxuXG5NZW1ET1dOLmRlc3Ryb3kgPSBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcbiAgdmFyIGtleSA9ICckJyArIG5hbWVcblxuICBpZiAoa2V5IGluIGdsb2JhbFN0b3JlKSB7XG4gICAgZGVsZXRlIGdsb2JhbFN0b3JlW2tleV1cbiAgfVxuXG4gIHNldEltbWVkaWF0ZShjYWxsYmFjaylcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBNZW1ET1dOLmRlZmF1bHQgPSBNZW1ET1dOXG4iLCJpbXBvcnQgQ29yZUxldmVsUG91Y2ggZnJvbSAncG91Y2hkYi1hZGFwdGVyLWxldmVsZGItY29yZSc7XG5cblxuaW1wb3J0IG1lbWRvd24gZnJvbSAnbWVtZG93bic7XG5cbmZ1bmN0aW9uIE1lbURvd25Qb3VjaChvcHRzLCBjYWxsYmFjaykge1xuICB2YXIgX29wdHMgPSBPYmplY3QuYXNzaWduKHtcbiAgICBkYjogbWVtZG93blxuICB9LCBvcHRzKTtcblxuICBDb3JlTGV2ZWxQb3VjaC5jYWxsKHRoaXMsIF9vcHRzLCBjYWxsYmFjayk7XG59XG5cbi8vIG92ZXJyaWRlcyBmb3Igbm9ybWFsIExldmVsREIgYmVoYXZpb3Igb24gTm9kZVxuTWVtRG93blBvdWNoLnZhbGlkID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5NZW1Eb3duUG91Y2gudXNlX3ByZWZpeCA9IGZhbHNlO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoUG91Y2hEQikge1xuICBQb3VjaERCLmFkYXB0ZXIoJ21lbW9yeScsIE1lbURvd25Qb3VjaCwgdHJ1ZSk7XG59Il0sIm5hbWVzIjpbIkFic3RyYWN0SXRlcmF0b3IiLCJBYnN0cmFjdENoYWluZWRCYXRjaCIsInJlcXVpcmUkJDAiLCJyZXF1aXJlJCQxIiwicmVxdWlyZSQkMiIsIkFic3RyYWN0TGV2ZWxET1dOIiwiYWJzdHJhY3RMZXZlbGRvd24iLCJyZXF1aXJlJCQzIiwiYnVmZmVyIiwiQnVmZmVyIiwicmVxdWlyZSQkNCIsInJlcXVpcmUkJDUiLCJtZW1kb3duIiwiQ29yZUxldmVsUG91Y2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQSxTQUFTQSxrQkFBZ0IsRUFBRSxFQUFFLEVBQUU7QUFDL0IsRUFBRSxJQUFJLENBQUMsRUFBRSxHQUFHLEdBQUU7QUFDZCxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBSztBQUNyQixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBSztBQUN2QixDQUFDO0FBQ0Q7QUFDQUEsa0JBQWdCLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFVLFFBQVEsRUFBRTtBQUN0RCxFQUFFLElBQUksSUFBSSxHQUFHLEtBQUk7QUFDakI7QUFDQSxFQUFFLElBQUksT0FBTyxRQUFRLElBQUksVUFBVTtBQUNuQyxJQUFJLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUM7QUFDMUQ7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU07QUFDakIsSUFBSSxPQUFPLFFBQVEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0FBQ2hFLEVBQUUsSUFBSSxJQUFJLENBQUMsUUFBUTtBQUNuQixJQUFJLE9BQU8sUUFBUSxDQUFDLElBQUksS0FBSyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7QUFDekY7QUFDQSxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSTtB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MEJBQTBCLENBQUM7QUFDL0MsR0FBRztBQUNILEVBQUUsSUFBSSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBQztBQUN0QyxFQUFFLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBQztBQUMvQixFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFDekYsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDdkMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBQztBQUNoQixJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzlCLE1BQU0sTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFDO0FBQ3RGLEtBQUssTUFBTTtBQUNYLE1BQU0sTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMs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
