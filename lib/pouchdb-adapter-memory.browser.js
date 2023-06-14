import { i as immutable, L as LevelPouch } from './index-4472578e.js';
import { g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';
import { b as buffer, i as inherits_browserExports, l as ltgt$1 } from './index-340bf460.js';
import './functionName-4d6db487.js';
import './__node-resolve_empty-b1d43ca8.js';
import './pouchdb-core.browser.js';
import './bulkGetShim-75479c95.js';
import './toPromise-06b5d6a8.js';
import './clone-f35bcc51.js';
import 'node:events';
import './guardedConsole-f54e5a40.js';
import './pouchdb-errors.browser.js';
import './rev-d51344b8.js';
import './spark-md5-2c57e5fc.js';
import './stringMd5-browser-5aecd2bd.js';
import './isRemote-f9121da9.js';
import './upsert-331b6913.js';
import './collectConflicts-6afe46fc.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
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
import './parseDoc-e17a8c17.js';
import './latest-0521537f.js';
import './binaryStringToBlobOrBuffer-browser-2c8e268c.js';
import './binaryMd5-browser-ff2f482d.js';
import './readAsArrayBuffer-625b2d33.js';
import './processDocs-e4ed6d00.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLW1lbW9yeS5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvbWVtZG93bi9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL2Fic3RyYWN0LWl0ZXJhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL21lbWRvd24vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1jaGFpbmVkLWJhdGNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL21lbWRvd24vbm9kZV9tb2R1bGVzL2Fic3RyYWN0LWxldmVsZG93bi9hYnN0cmFjdC1sZXZlbGRvd24uanMiLCIuLi9ub2RlX21vZHVsZXMvbWVtZG93bi9ub2RlX21vZHVsZXMvYWJzdHJhY3QtbGV2ZWxkb3duL2lzLWxldmVsZG93bi5qcyIsIi4uL25vZGVfbW9kdWxlcy9tZW1kb3duL25vZGVfbW9kdWxlcy9hYnN0cmFjdC1sZXZlbGRvd24vaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZnVuY3Rpb25hbC1yZWQtYmxhY2stdHJlZS9yYnRyZWUuanMiLCIuLi9ub2RlX21vZHVsZXMvbWVtZG93bi9ub2RlX21vZHVsZXMvc2FmZS1idWZmZXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvbWVtZG93bi9pbW1lZGlhdGUtYnJvd3Nlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9tZW1kb3duL21lbWRvd24uanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItbWVtb3J5L3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgKGMpIDIwMTcgUm9kIFZhZ2csIE1JVCBMaWNlbnNlICovXG5cbmZ1bmN0aW9uIEFic3RyYWN0SXRlcmF0b3IgKGRiKSB7XG4gIHRoaXMuZGIgPSBkYlxuICB0aGlzLl9lbmRlZCA9IGZhbHNlXG4gIHRoaXMuX25leHRpbmcgPSBmYWxzZVxufVxuXG5BYnN0cmFjdEl0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ25leHQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAoc2VsZi5fZW5kZWQpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignY2Fubm90IGNhbGwgbmV4dCgpIGFmdGVyIGVuZCgpJykpXG4gIGlmIChzZWxmLl9uZXh0aW5nKVxuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ2Nhbm5vdCBjYWxsIG5leHQoKSBiZWZvcmUgcHJldmlvdXMgbmV4dCgpIGhhcyBjb21wbGV0ZWQnKSlcblxuICBzZWxmLl9uZXh0aW5nID0gdHJ1ZVxuICBpZiAodHlwZW9mIHNlbGYuX25leHQgPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBzZWxmLl9uZXh0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX25leHRpbmcgPSBmYWxzZVxuICAgICAgY2FsbGJhY2suYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH0pXG4gIH1cblxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLl9uZXh0aW5nID0gZmFsc2VcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG5cbkFic3RyYWN0SXRlcmF0b3IucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdlbmQoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAodGhpcy5fZW5kZWQpXG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignZW5kKCkgYWxyZWFkeSBjYWxsZWQgb24gaXRlcmF0b3InKSlcblxuICB0aGlzLl9lbmRlZCA9IHRydWVcblxuICBpZiAodHlwZW9mIHRoaXMuX2VuZCA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9lbmQoY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdEl0ZXJhdG9yXG4iLCIvKiBDb3B5cmlnaHQgKGMpIDIwMTcgUm9kIFZhZ2csIE1JVCBMaWNlbnNlICovXG5cbmZ1bmN0aW9uIEFic3RyYWN0Q2hhaW5lZEJhdGNoIChkYikge1xuICB0aGlzLl9kYiAgICAgICAgID0gZGJcbiAgdGhpcy5fb3BlcmF0aW9ucyA9IFtdXG4gIHRoaXMuX3dyaXR0ZW4gICAgPSBmYWxzZVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX3NlcmlhbGl6ZUtleSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgcmV0dXJuIHRoaXMuX2RiLl9zZXJpYWxpemVLZXkoa2V5KVxufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUuX3NlcmlhbGl6ZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB0aGlzLl9kYi5fc2VyaWFsaXplVmFsdWUodmFsdWUpXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5fY2hlY2tXcml0dGVuID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5fd3JpdHRlbilcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dyaXRlKCkgYWxyZWFkeSBjYWxsZWQgb24gdGhpcyBiYXRjaCcpXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICB0aGlzLl9jaGVja1dyaXR0ZW4oKVxuXG4gIHZhciBlcnIgPSB0aGlzLl9kYi5fY2hlY2tLZXkoa2V5LCAna2V5JywgdGhpcy5fZGIuX2lzQnVmZmVyKVxuICBpZiAoZXJyKVxuICAgIHRocm93IGVyclxuXG4gIGtleSA9IHRoaXMuX3NlcmlhbGl6ZUtleShrZXkpXG4gIHZhbHVlID0gdGhpcy5fc2VyaWFsaXplVmFsdWUodmFsdWUpXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9wdXQgPT0gJ2Z1bmN0aW9uJyApXG4gICAgdGhpcy5fcHV0KGtleSwgdmFsdWUpXG4gIGVsc2VcbiAgICB0aGlzLl9vcGVyYXRpb25zLnB1c2goeyB0eXBlOiAncHV0Jywga2V5OiBrZXksIHZhbHVlOiB2YWx1ZSB9KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIHRoaXMuX2NoZWNrV3JpdHRlbigpXG5cbiAgdmFyIGVyciA9IHRoaXMuX2RiLl9jaGVja0tleShrZXksICdrZXknLCB0aGlzLl9kYi5faXNCdWZmZXIpXG4gIGlmIChlcnIpIHRocm93IGVyclxuXG4gIGtleSA9IHRoaXMuX3NlcmlhbGl6ZUtleShrZXkpXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9kZWwgPT0gJ2Z1bmN0aW9uJyApXG4gICAgdGhpcy5fZGVsKGtleSlcbiAgZWxzZVxuICAgIHRoaXMuX29wZXJhdGlvbnMucHVzaCh7IHR5cGU6ICdkZWwnLCBrZXk6IGtleSB9KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkFic3RyYWN0Q2hhaW5lZEJhdGNoLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICB0aGlzLl9vcGVyYXRpb25zID0gW11cblxuICBpZiAodHlwZW9mIHRoaXMuX2NsZWFyID09ICdmdW5jdGlvbicgKVxuICAgIHRoaXMuX2NsZWFyKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5BYnN0cmFjdENoYWluZWRCYXRjaC5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdGhpcy5fY2hlY2tXcml0dGVuKClcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT0gJ2Z1bmN0aW9uJylcbiAgICBjYWxsYmFjayA9IG9wdGlvbnNcbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcignd3JpdGUoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIHRoaXMuX3dyaXR0ZW4gPSB0cnVlXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl93cml0ZSA9PSAnZnVuY3Rpb24nIClcbiAgICByZXR1cm4gdGhpcy5fd3JpdGUoY2FsbGJhY2spXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9kYi5fYmF0Y2ggPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fZGIuX2JhdGNoKHRoaXMuX29wZXJhdGlvbnMsIG9wdGlvbnMsIGNhbGxiYWNrKVxuXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spXG59XG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RDaGFpbmVkQmF0Y2hcbiIsIi8qIENvcHlyaWdodCAoYykgMjAxNyBSb2QgVmFnZywgTUlUIExpY2Vuc2UgKi9cblxudmFyIHh0ZW5kICAgICAgICAgICAgICAgID0gcmVxdWlyZSgneHRlbmQnKVxuICAsIEFic3RyYWN0SXRlcmF0b3IgICAgID0gcmVxdWlyZSgnLi9hYnN0cmFjdC1pdGVyYXRvcicpXG4gICwgQWJzdHJhY3RDaGFpbmVkQmF0Y2ggPSByZXF1aXJlKCcuL2Fic3RyYWN0LWNoYWluZWQtYmF0Y2gnKVxuXG5mdW5jdGlvbiBBYnN0cmFjdExldmVsRE9XTiAobG9jYXRpb24pIHtcbiAgaWYgKCFhcmd1bWVudHMubGVuZ3RoIHx8IGxvY2F0aW9uID09PSB1bmRlZmluZWQpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjb25zdHJ1Y3RvciByZXF1aXJlcyBhdCBsZWFzdCBhIGxvY2F0aW9uIGFyZ3VtZW50JylcblxuICBpZiAodHlwZW9mIGxvY2F0aW9uICE9ICdzdHJpbmcnKVxuICAgIHRocm93IG5ldyBFcnJvcignY29uc3RydWN0b3IgcmVxdWlyZXMgYSBsb2NhdGlvbiBzdHJpbmcgYXJndW1lbnQnKVxuXG4gIHRoaXMubG9jYXRpb24gPSBsb2NhdGlvblxuICB0aGlzLnN0YXR1cyA9ICduZXcnXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmICAgICAgPSB0aGlzXG4gICAgLCBvbGRTdGF0dXMgPSB0aGlzLnN0YXR1c1xuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ29wZW4oKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgb3B0aW9ucy5jcmVhdGVJZk1pc3NpbmcgPSBvcHRpb25zLmNyZWF0ZUlmTWlzc2luZyAhPSBmYWxzZVxuICBvcHRpb25zLmVycm9ySWZFeGlzdHMgPSAhIW9wdGlvbnMuZXJyb3JJZkV4aXN0c1xuXG4gIGlmICh0eXBlb2YgdGhpcy5fb3BlbiA9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5zdGF0dXMgPSAnb3BlbmluZydcbiAgICB0aGlzLl9vcGVuKG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgc2VsZi5zdGF0dXMgPSBvbGRTdGF0dXNcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgICAgIH1cbiAgICAgIHNlbGYuc3RhdHVzID0gJ29wZW4nXG4gICAgICBjYWxsYmFjaygpXG4gICAgfSlcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnN0YXR1cyA9ICdvcGVuJ1xuICAgIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spXG4gIH1cbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmICAgICAgPSB0aGlzXG4gICAgLCBvbGRTdGF0dXMgPSB0aGlzLnN0YXR1c1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nsb3NlKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9jbG9zZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5zdGF0dXMgPSAnY2xvc2luZydcbiAgICB0aGlzLl9jbG9zZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHNlbGYuc3RhdHVzID0gb2xkU3RhdHVzXG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG4gICAgICB9XG4gICAgICBzZWxmLnN0YXR1cyA9ICdjbG9zZWQnXG4gICAgICBjYWxsYmFjaygpXG4gICAgfSlcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnN0YXR1cyA9ICdjbG9zZWQnXG4gICAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbiAgfVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIGVyclxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldCgpIHJlcXVpcmVzIGEgY2FsbGJhY2sgYXJndW1lbnQnKVxuXG4gIGlmIChlcnIgPSB0aGlzLl9jaGVja0tleShrZXksICdrZXknKSlcbiAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuXG4gIGtleSA9IHRoaXMuX3NlcmlhbGl6ZUtleShrZXkpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIG9wdGlvbnMuYXNCdWZmZXIgPSBvcHRpb25zLmFzQnVmZmVyICE9IGZhbHNlXG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9nZXQgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fZ2V0KGtleSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7IGNhbGxiYWNrKG5ldyBFcnJvcignTm90Rm91bmQnKSkgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLnB1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICB2YXIgZXJyXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcigncHV0KCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSwgJ2tleScpKVxuICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcbiAgdmFsdWUgPSB0aGlzLl9zZXJpYWxpemVWYWx1ZSh2YWx1ZSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9wdXQgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fcHV0KGtleSwgdmFsdWUsIG9wdGlvbnMsIGNhbGxiYWNrKVxuXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICB2YXIgZXJyXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcignZGVsKCkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKGVyciA9IHRoaXMuX2NoZWNrS2V5KGtleSwgJ2tleScpKVxuICAgIHJldHVybiBjYWxsYmFjayhlcnIpXG5cbiAga2V5ID0gdGhpcy5fc2VyaWFsaXplS2V5KGtleSlcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgaWYgKHR5cGVvZiB0aGlzLl9kZWwgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fZGVsKGtleSwgb3B0aW9ucywgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmJhdGNoID0gZnVuY3Rpb24gKGFycmF5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpXG4gICAgcmV0dXJuIHRoaXMuX2NoYWluZWRCYXRjaCgpXG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdmdW5jdGlvbicpXG4gICAgY2FsbGJhY2sgPSBvcHRpb25zXG5cbiAgaWYgKHR5cGVvZiBhcnJheSA9PSAnZnVuY3Rpb24nKVxuICAgIGNhbGxiYWNrID0gYXJyYXlcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdiYXRjaChhcnJheSkgcmVxdWlyZXMgYSBjYWxsYmFjayBhcmd1bWVudCcpXG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICByZXR1cm4gY2FsbGJhY2sobmV3IEVycm9yKCdiYXRjaChhcnJheSkgcmVxdWlyZXMgYW4gYXJyYXkgYXJndW1lbnQnKSlcblxuICBpZiAoIW9wdGlvbnMgfHwgdHlwZW9mIG9wdGlvbnMgIT0gJ29iamVjdCcpXG4gICAgb3B0aW9ucyA9IHt9XG5cbiAgdmFyIGkgPSAwXG4gICAgLCBsID0gYXJyYXkubGVuZ3RoXG4gICAgLCBlXG4gICAgLCBlcnJcblxuICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgIGUgPSBhcnJheVtpXVxuICAgIGlmICh0eXBlb2YgZSAhPSAnb2JqZWN0JylcbiAgICAgIGNvbnRpbnVlXG5cbiAgICBpZiAoZXJyID0gdGhpcy5fY2hlY2tLZXkoZS50eXBlLCAndHlwZScpKVxuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcblxuICAgIGlmIChlcnIgPSB0aGlzLl9jaGVja0tleShlLmtleSwgJ2tleScpKVxuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgfVxuXG4gIGlmICh0eXBlb2YgdGhpcy5fYmF0Y2ggPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5fYmF0Y2goYXJyYXksIG9wdGlvbnMsIGNhbGxiYWNrKVxuXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spXG59XG5cbi8vVE9ETzogcmVtb3ZlIGZyb20gaGVyZSwgbm90IGEgbmVjZXNzYXJ5IHByaW1pdGl2ZVxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLmFwcHJveGltYXRlU2l6ZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCBjYWxsYmFjaykge1xuICBpZiAoICAgc3RhcnQgPT0gbnVsbFxuICAgICAgfHwgZW5kID09IG51bGxcbiAgICAgIHx8IHR5cGVvZiBzdGFydCA9PSAnZnVuY3Rpb24nXG4gICAgICB8fCB0eXBlb2YgZW5kID09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FwcHJveGltYXRlU2l6ZSgpIHJlcXVpcmVzIHZhbGlkIGBzdGFydGAsIGBlbmRgIGFuZCBgY2FsbGJhY2tgIGFyZ3VtZW50cycpXG4gIH1cblxuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdhcHByb3hpbWF0ZVNpemUoKSByZXF1aXJlcyBhIGNhbGxiYWNrIGFyZ3VtZW50JylcblxuICBzdGFydCA9IHRoaXMuX3NlcmlhbGl6ZUtleShzdGFydClcbiAgZW5kID0gdGhpcy5fc2VyaWFsaXplS2V5KGVuZClcblxuICBpZiAodHlwZW9mIHRoaXMuX2FwcHJveGltYXRlU2l6ZSA9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB0aGlzLl9hcHByb3hpbWF0ZVNpemUoc3RhcnQsIGVuZCwgY2FsbGJhY2spXG5cbiAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgMClcbiAgfSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9zZXR1cEl0ZXJhdG9yT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIG9wdGlvbnMgPSB4dGVuZChvcHRpb25zKVxuXG4gIDtbICdzdGFydCcsICdlbmQnLCAnZ3QnLCAnZ3RlJywgJ2x0JywgJ2x0ZScgXS5mb3JFYWNoKGZ1bmN0aW9uIChvKSB7XG4gICAgaWYgKG9wdGlvbnNbb10gJiYgc2VsZi5faXNCdWZmZXIob3B0aW9uc1tvXSkgJiYgb3B0aW9uc1tvXS5sZW5ndGggPT09IDApXG4gICAgICBkZWxldGUgb3B0aW9uc1tvXVxuICB9KVxuXG4gIG9wdGlvbnMucmV2ZXJzZSA9ICEhb3B0aW9ucy5yZXZlcnNlXG4gIG9wdGlvbnMua2V5cyA9IG9wdGlvbnMua2V5cyAhPSBmYWxzZVxuICBvcHRpb25zLnZhbHVlcyA9IG9wdGlvbnMudmFsdWVzICE9IGZhbHNlXG4gIG9wdGlvbnMubGltaXQgPSAnbGltaXQnIGluIG9wdGlvbnMgPyBvcHRpb25zLmxpbWl0IDogLTFcbiAgb3B0aW9ucy5rZXlBc0J1ZmZlciA9IG9wdGlvbnMua2V5QXNCdWZmZXIgIT0gZmFsc2VcbiAgb3B0aW9ucy52YWx1ZUFzQnVmZmVyID0gb3B0aW9ucy52YWx1ZUFzQnVmZmVyICE9IGZhbHNlXG5cbiAgcmV0dXJuIG9wdGlvbnNcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLml0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zICE9ICdvYmplY3QnKVxuICAgIG9wdGlvbnMgPSB7fVxuXG4gIG9wdGlvbnMgPSB0aGlzLl9zZXR1cEl0ZXJhdG9yT3B0aW9ucyhvcHRpb25zKVxuXG4gIGlmICh0eXBlb2YgdGhpcy5faXRlcmF0b3IgPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gdGhpcy5faXRlcmF0b3Iob3B0aW9ucylcblxuICByZXR1cm4gbmV3IEFic3RyYWN0SXRlcmF0b3IodGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGFpbmVkQmF0Y2ggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgQWJzdHJhY3RDaGFpbmVkQmF0Y2godGhpcylcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9pc0J1ZmZlciA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihvYmopXG59XG5cbkFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZS5fc2VyaWFsaXplS2V5ID0gZnVuY3Rpb24gKGtleSkge1xuICByZXR1cm4gdGhpcy5faXNCdWZmZXIoa2V5KVxuICAgID8ga2V5XG4gICAgOiBTdHJpbmcoa2V5KVxufVxuXG5BYnN0cmFjdExldmVsRE9XTi5wcm90b3R5cGUuX3NlcmlhbGl6ZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gJydcbiAgcmV0dXJuIHRoaXMuX2lzQnVmZmVyKHZhbHVlKSB8fCBwcm9jZXNzLmJyb3dzZXIgPyB2YWx1ZSA6IFN0cmluZyh2YWx1ZSlcbn1cblxuQWJzdHJhY3RMZXZlbERPV04ucHJvdG90eXBlLl9jaGVja0tleSA9IGZ1bmN0aW9uIChvYmosIHR5cGUpIHtcbiAgaWYgKG9iaiA9PT0gbnVsbCB8fCBvYmogPT09IHVuZGVmaW5lZClcbiAgICByZXR1cm4gbmV3IEVycm9yKHR5cGUgKyAnIGNhbm5vdCBiZSBgbnVsbGAgb3IgYHVuZGVmaW5lZGAnKVxuXG4gIGlmICh0aGlzLl9pc0J1ZmZlcihvYmopICYmIG9iai5sZW5ndGggPT09IDApXG4gICAgcmV0dXJuIG5ldyBFcnJvcih0eXBlICsgJyBjYW5ub3QgYmUgYW4gZW1wdHkgQnVmZmVyJylcbiAgZWxzZSBpZiAoU3RyaW5nKG9iaikgPT09ICcnKVxuICAgIHJldHVybiBuZXcgRXJyb3IodHlwZSArICcgY2Fubm90IGJlIGFuIGVtcHR5IFN0cmluZycpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RMZXZlbERPV05cbiIsInZhciBBYnN0cmFjdExldmVsRE9XTiA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtbGV2ZWxkb3duJylcblxuZnVuY3Rpb24gaXNMZXZlbERPV04gKGRiKSB7XG4gIGlmICghZGIgfHwgdHlwZW9mIGRiICE9PSAnb2JqZWN0JylcbiAgICByZXR1cm4gZmFsc2VcbiAgcmV0dXJuIE9iamVjdC5rZXlzKEFic3RyYWN0TGV2ZWxET1dOLnByb3RvdHlwZSkuZmlsdGVyKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgLy8gVE9ETyByZW1vdmUgYXBwcm94aW1hdGVTaXplIGNoZWNrIHdoZW4gbWV0aG9kIGlzIGdvbmVcbiAgICByZXR1cm4gbmFtZVswXSAhPSAnXycgJiYgbmFtZSAhPSAnYXBwcm94aW1hdGVTaXplJ1xuICB9KS5ldmVyeShmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiB0eXBlb2YgZGJbbmFtZV0gPT0gJ2Z1bmN0aW9uJ1xuICB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzTGV2ZWxET1dOXG4iLCJleHBvcnRzLkFic3RyYWN0TGV2ZWxET1dOICAgID0gcmVxdWlyZSgnLi9hYnN0cmFjdC1sZXZlbGRvd24nKVxuZXhwb3J0cy5BYnN0cmFjdEl0ZXJhdG9yICAgICA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtaXRlcmF0b3InKVxuZXhwb3J0cy5BYnN0cmFjdENoYWluZWRCYXRjaCA9IHJlcXVpcmUoJy4vYWJzdHJhY3QtY2hhaW5lZC1iYXRjaCcpXG5leHBvcnRzLmlzTGV2ZWxET1dOICAgICAgICAgID0gcmVxdWlyZSgnLi9pcy1sZXZlbGRvd24nKVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVSQlRyZWVcblxudmFyIFJFRCAgID0gMFxudmFyIEJMQUNLID0gMVxuXG5mdW5jdGlvbiBSQk5vZGUoY29sb3IsIGtleSwgdmFsdWUsIGxlZnQsIHJpZ2h0LCBjb3VudCkge1xuICB0aGlzLl9jb2xvciA9IGNvbG9yXG4gIHRoaXMua2V5ID0ga2V5XG4gIHRoaXMudmFsdWUgPSB2YWx1ZVxuICB0aGlzLmxlZnQgPSBsZWZ0XG4gIHRoaXMucmlnaHQgPSByaWdodFxuICB0aGlzLl9jb3VudCA9IGNvdW50XG59XG5cbmZ1bmN0aW9uIGNsb25lTm9kZShub2RlKSB7XG4gIHJldHVybiBuZXcgUkJOb2RlKG5vZGUuX2NvbG9yLCBub2RlLmtleSwgbm9kZS52YWx1ZSwgbm9kZS5sZWZ0LCBub2RlLnJpZ2h0LCBub2RlLl9jb3VudClcbn1cblxuZnVuY3Rpb24gcmVwYWludChjb2xvciwgbm9kZSkge1xuICByZXR1cm4gbmV3IFJCTm9kZShjb2xvciwgbm9kZS5rZXksIG5vZGUudmFsdWUsIG5vZGUubGVmdCwgbm9kZS5yaWdodCwgbm9kZS5fY291bnQpXG59XG5cbmZ1bmN0aW9uIHJlY291bnQobm9kZSkge1xuICBub2RlLl9jb3VudCA9IDEgKyAobm9kZS5sZWZ0ID8gbm9kZS5sZWZ0Ll9jb3VudCA6IDApICsgKG5vZGUucmlnaHQgPyBub2RlLnJpZ2h0Ll9jb3VudCA6IDApXG59XG5cbmZ1bmN0aW9uIFJlZEJsYWNrVHJlZShjb21wYXJlLCByb290KSB7XG4gIHRoaXMuX2NvbXBhcmUgPSBjb21wYXJlXG4gIHRoaXMucm9vdCA9IHJvb3Rcbn1cblxudmFyIHByb3RvID0gUmVkQmxhY2tUcmVlLnByb3RvdHlwZVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sIFwia2V5c1wiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGssdikge1xuICAgICAgcmVzdWx0LnB1c2goaylcbiAgICB9KVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxufSlcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCBcInZhbHVlc1wiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGssdikge1xuICAgICAgcmVzdWx0LnB1c2godilcbiAgICB9KVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxufSlcblxuLy9SZXR1cm5zIHRoZSBudW1iZXIgb2Ygbm9kZXMgaW4gdGhlIHRyZWVcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgXCJsZW5ndGhcIiwge1xuICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmKHRoaXMucm9vdCkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vdC5fY291bnRcbiAgICB9XG4gICAgcmV0dXJuIDBcbiAgfVxufSlcblxuLy9JbnNlcnQgYSBuZXcgaXRlbSBpbnRvIHRoZSB0cmVlXG5wcm90by5pbnNlcnQgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIC8vRmluZCBwb2ludCB0byBpbnNlcnQgbmV3IG5vZGUgYXRcbiAgdmFyIG4gPSB0aGlzLnJvb3RcbiAgdmFyIG5fc3RhY2sgPSBbXVxuICB2YXIgZF9zdGFjayA9IFtdXG4gIHdoaWxlKG4pIHtcbiAgICB2YXIgZCA9IGNtcChrZXksIG4ua2V5KVxuICAgIG5fc3RhY2sucHVzaChuKVxuICAgIGRfc3RhY2sucHVzaChkKVxuICAgIGlmKGQgPD0gMCkge1xuICAgICAgbiA9IG4ubGVmdFxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbi5yaWdodFxuICAgIH1cbiAgfVxuICAvL1JlYnVpbGQgcGF0aCB0byBsZWFmIG5vZGVcbiAgbl9zdGFjay5wdXNoKG5ldyBSQk5vZGUoUkVELCBrZXksIHZhbHVlLCBudWxsLCBudWxsLCAxKSlcbiAgZm9yKHZhciBzPW5fc3RhY2subGVuZ3RoLTI7IHM+PTA7IC0tcykge1xuICAgIHZhciBuID0gbl9zdGFja1tzXVxuICAgIGlmKGRfc3RhY2tbc10gPD0gMCkge1xuICAgICAgbl9zdGFja1tzXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBuX3N0YWNrW3MrMV0sIG4ucmlnaHQsIG4uX2NvdW50KzEpXG4gICAgfSBlbHNlIHtcbiAgICAgIG5fc3RhY2tbc10gPSBuZXcgUkJOb2RlKG4uX2NvbG9yLCBuLmtleSwgbi52YWx1ZSwgbi5sZWZ0LCBuX3N0YWNrW3MrMV0sIG4uX2NvdW50KzEpXG4gICAgfVxuICB9XG4gIC8vUmViYWxhbmNlIHRyZWUgdXNpbmcgcm90YXRpb25zXG4gIC8vY29uc29sZS5sb2coXCJzdGFydCBpbnNlcnRcIiwga2V5LCBkX3N0YWNrKVxuICBmb3IodmFyIHM9bl9zdGFjay5sZW5ndGgtMTsgcz4xOyAtLXMpIHtcbiAgICB2YXIgcCA9IG5fc3RhY2tbcy0xXVxuICAgIHZhciBuID0gbl9zdGFja1tzXVxuICAgIGlmKHAuX2NvbG9yID09PSBCTEFDSyB8fCBuLl9jb2xvciA9PT0gQkxBQ0spIHtcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIHZhciBwcCA9IG5fc3RhY2tbcy0yXVxuICAgIGlmKHBwLmxlZnQgPT09IHApIHtcbiAgICAgIGlmKHAubGVmdCA9PT0gbikge1xuICAgICAgICB2YXIgeSA9IHBwLnJpZ2h0XG4gICAgICAgIGlmKHkgJiYgeS5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJMTHJcIilcbiAgICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgICAgcHAucmlnaHQgPSByZXBhaW50KEJMQUNLLCB5KVxuICAgICAgICAgIHBwLl9jb2xvciA9IFJFRFxuICAgICAgICAgIHMgLT0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJMTGJcIilcbiAgICAgICAgICBwcC5fY29sb3IgPSBSRURcbiAgICAgICAgICBwcC5sZWZ0ID0gcC5yaWdodFxuICAgICAgICAgIHAuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgICBwLnJpZ2h0ID0gcHBcbiAgICAgICAgICBuX3N0YWNrW3MtMl0gPSBwXG4gICAgICAgICAgbl9zdGFja1tzLTFdID0gblxuICAgICAgICAgIHJlY291bnQocHApXG4gICAgICAgICAgcmVjb3VudChwKVxuICAgICAgICAgIGlmKHMgPj0gMykge1xuICAgICAgICAgICAgdmFyIHBwcCA9IG5fc3RhY2tbcy0zXVxuICAgICAgICAgICAgaWYocHBwLmxlZnQgPT09IHBwKSB7XG4gICAgICAgICAgICAgIHBwcC5sZWZ0ID0gcFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcHBwLnJpZ2h0ID0gcFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgeSA9IHBwLnJpZ2h0XG4gICAgICAgIGlmKHkgJiYgeS5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJMUnJcIilcbiAgICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgICAgcHAucmlnaHQgPSByZXBhaW50KEJMQUNLLCB5KVxuICAgICAgICAgIHBwLl9jb2xvciA9IFJFRFxuICAgICAgICAgIHMgLT0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJMUmJcIilcbiAgICAgICAgICBwLnJpZ2h0ID0gbi5sZWZ0XG4gICAgICAgICAgcHAuX2NvbG9yID0gUkVEXG4gICAgICAgICAgcHAubGVmdCA9IG4ucmlnaHRcbiAgICAgICAgICBuLl9jb2xvciA9IEJMQUNLXG4gICAgICAgICAgbi5sZWZ0ID0gcFxuICAgICAgICAgIG4ucmlnaHQgPSBwcFxuICAgICAgICAgIG5fc3RhY2tbcy0yXSA9IG5cbiAgICAgICAgICBuX3N0YWNrW3MtMV0gPSBwXG4gICAgICAgICAgcmVjb3VudChwcClcbiAgICAgICAgICByZWNvdW50KHApXG4gICAgICAgICAgcmVjb3VudChuKVxuICAgICAgICAgIGlmKHMgPj0gMykge1xuICAgICAgICAgICAgdmFyIHBwcCA9IG5fc3RhY2tbcy0zXVxuICAgICAgICAgICAgaWYocHBwLmxlZnQgPT09IHBwKSB7XG4gICAgICAgICAgICAgIHBwcC5sZWZ0ID0gblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcHBwLnJpZ2h0ID0gblxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmKHAucmlnaHQgPT09IG4pIHtcbiAgICAgICAgdmFyIHkgPSBwcC5sZWZ0XG4gICAgICAgIGlmKHkgJiYgeS5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJSUnJcIiwgeS5rZXkpXG4gICAgICAgICAgcC5fY29sb3IgPSBCTEFDS1xuICAgICAgICAgIHBwLmxlZnQgPSByZXBhaW50KEJMQUNLLCB5KVxuICAgICAgICAgIHBwLl9jb2xvciA9IFJFRFxuICAgICAgICAgIHMgLT0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJSUmJcIilcbiAgICAgICAgICBwcC5fY29sb3IgPSBSRURcbiAgICAgICAgICBwcC5yaWdodCA9IHAubGVmdFxuICAgICAgICAgIHAuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgICBwLmxlZnQgPSBwcFxuICAgICAgICAgIG5fc3RhY2tbcy0yXSA9IHBcbiAgICAgICAgICBuX3N0YWNrW3MtMV0gPSBuXG4gICAgICAgICAgcmVjb3VudChwcClcbiAgICAgICAgICByZWNvdW50KHApXG4gICAgICAgICAgaWYocyA+PSAzKSB7XG4gICAgICAgICAgICB2YXIgcHBwID0gbl9zdGFja1tzLTNdXG4gICAgICAgICAgICBpZihwcHAucmlnaHQgPT09IHBwKSB7XG4gICAgICAgICAgICAgIHBwcC5yaWdodCA9IHBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBwcC5sZWZ0ID0gcFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgeSA9IHBwLmxlZnRcbiAgICAgICAgaWYoeSAmJiB5Ll9jb2xvciA9PT0gUkVEKSB7XG4gICAgICAgICAgLy9jb25zb2xlLmxvZyhcIlJMclwiKVxuICAgICAgICAgIHAuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgICBwcC5sZWZ0ID0gcmVwYWludChCTEFDSywgeSlcbiAgICAgICAgICBwcC5fY29sb3IgPSBSRURcbiAgICAgICAgICBzIC09IDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiUkxiXCIpXG4gICAgICAgICAgcC5sZWZ0ID0gbi5yaWdodFxuICAgICAgICAgIHBwLl9jb2xvciA9IFJFRFxuICAgICAgICAgIHBwLnJpZ2h0ID0gbi5sZWZ0XG4gICAgICAgICAgbi5fY29sb3IgPSBCTEFDS1xuICAgICAgICAgIG4ucmlnaHQgPSBwXG4gICAgICAgICAgbi5sZWZ0ID0gcHBcbiAgICAgICAgICBuX3N0YWNrW3MtMl0gPSBuXG4gICAgICAgICAgbl9zdGFja1tzLTFdID0gcFxuICAgICAgICAgIHJlY291bnQocHApXG4gICAgICAgICAgcmVjb3VudChwKVxuICAgICAgICAgIHJlY291bnQobilcbiAgICAgICAgICBpZihzID49IDMpIHtcbiAgICAgICAgICAgIHZhciBwcHAgPSBuX3N0YWNrW3MtM11cbiAgICAgICAgICAgIGlmKHBwcC5yaWdodCA9PT0gcHApIHtcbiAgICAgICAgICAgICAgcHBwLnJpZ2h0ID0gblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcHBwLmxlZnQgPSBuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy9SZXR1cm4gbmV3IHRyZWVcbiAgbl9zdGFja1swXS5fY29sb3IgPSBCTEFDS1xuICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZShjbXAsIG5fc3RhY2tbMF0pXG59XG5cblxuLy9WaXNpdCBhbGwgbm9kZXMgaW5vcmRlclxuZnVuY3Rpb24gZG9WaXNpdEZ1bGwodmlzaXQsIG5vZGUpIHtcbiAgaWYobm9kZS5sZWZ0KSB7XG4gICAgdmFyIHYgPSBkb1Zpc2l0RnVsbCh2aXNpdCwgbm9kZS5sZWZ0KVxuICAgIGlmKHYpIHsgcmV0dXJuIHYgfVxuICB9XG4gIHZhciB2ID0gdmlzaXQobm9kZS5rZXksIG5vZGUudmFsdWUpXG4gIGlmKHYpIHsgcmV0dXJuIHYgfVxuICBpZihub2RlLnJpZ2h0KSB7XG4gICAgcmV0dXJuIGRvVmlzaXRGdWxsKHZpc2l0LCBub2RlLnJpZ2h0KVxuICB9XG59XG5cbi8vVmlzaXQgaGFsZiBub2RlcyBpbiBvcmRlclxuZnVuY3Rpb24gZG9WaXNpdEhhbGYobG8sIGNvbXBhcmUsIHZpc2l0LCBub2RlKSB7XG4gIHZhciBsID0gY29tcGFyZShsbywgbm9kZS5rZXkpXG4gIGlmKGwgPD0gMCkge1xuICAgIGlmKG5vZGUubGVmdCkge1xuICAgICAgdmFyIHYgPSBkb1Zpc2l0SGFsZihsbywgY29tcGFyZSwgdmlzaXQsIG5vZGUubGVmdClcbiAgICAgIGlmKHYpIHsgcmV0dXJuIHYgfVxuICAgIH1cbiAgICB2YXIgdiA9IHZpc2l0KG5vZGUua2V5LCBub2RlLnZhbHVlKVxuICAgIGlmKHYpIHsgcmV0dXJuIHYgfVxuICB9XG4gIGlmKG5vZGUucmlnaHQpIHtcbiAgICByZXR1cm4gZG9WaXNpdEhhbGYobG8sIGNvbXBhcmUsIHZpc2l0LCBub2RlLnJpZ2h0KVxuICB9XG59XG5cbi8vVmlzaXQgYWxsIG5vZGVzIHdpdGhpbiBhIHJhbmdlXG5mdW5jdGlvbiBkb1Zpc2l0KGxvLCBoaSwgY29tcGFyZSwgdmlzaXQsIG5vZGUpIHtcbiAgdmFyIGwgPSBjb21wYXJlKGxvLCBub2RlLmtleSlcbiAgdmFyIGggPSBjb21wYXJlKGhpLCBub2RlLmtleSlcbiAgdmFyIHZcbiAgaWYobCA8PSAwKSB7XG4gICAgaWYobm9kZS5sZWZ0KSB7XG4gICAgICB2ID0gZG9WaXNpdChsbywgaGksIGNvbXBhcmUsIHZpc2l0LCBub2RlLmxlZnQpXG4gICAgICBpZih2KSB7IHJldHVybiB2IH1cbiAgICB9XG4gICAgaWYoaCA+IDApIHtcbiAgICAgIHYgPSB2aXNpdChub2RlLmtleSwgbm9kZS52YWx1ZSlcbiAgICAgIGlmKHYpIHsgcmV0dXJuIHYgfVxuICAgIH1cbiAgfVxuICBpZihoID4gMCAmJiBub2RlLnJpZ2h0KSB7XG4gICAgcmV0dXJuIGRvVmlzaXQobG8sIGhpLCBjb21wYXJlLCB2aXNpdCwgbm9kZS5yaWdodClcbiAgfVxufVxuXG5cbnByb3RvLmZvckVhY2ggPSBmdW5jdGlvbiByYlRyZWVGb3JFYWNoKHZpc2l0LCBsbywgaGkpIHtcbiAgaWYoIXRoaXMucm9vdCkge1xuICAgIHJldHVyblxuICB9XG4gIHN3aXRjaChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIGRvVmlzaXRGdWxsKHZpc2l0LCB0aGlzLnJvb3QpXG4gICAgYnJlYWtcblxuICAgIGNhc2UgMjpcbiAgICAgIHJldHVybiBkb1Zpc2l0SGFsZihsbywgdGhpcy5fY29tcGFyZSwgdmlzaXQsIHRoaXMucm9vdClcbiAgICBicmVha1xuXG4gICAgY2FzZSAzOlxuICAgICAgaWYodGhpcy5fY29tcGFyZShsbywgaGkpID49IDApIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICByZXR1cm4gZG9WaXNpdChsbywgaGksIHRoaXMuX2NvbXBhcmUsIHZpc2l0LCB0aGlzLnJvb3QpXG4gICAgYnJlYWtcbiAgfVxufVxuXG4vL0ZpcnN0IGl0ZW0gaW4gbGlzdFxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCBcImJlZ2luXCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhY2sgPSBbXVxuICAgIHZhciBuID0gdGhpcy5yb290XG4gICAgd2hpbGUobikge1xuICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgbiA9IG4ubGVmdFxuICAgIH1cbiAgICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZUl0ZXJhdG9yKHRoaXMsIHN0YWNrKVxuICB9XG59KVxuXG4vL0xhc3QgaXRlbSBpbiBsaXN0XG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sIFwiZW5kXCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhY2sgPSBbXVxuICAgIHZhciBuID0gdGhpcy5yb290XG4gICAgd2hpbGUobikge1xuICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgbiA9IG4ucmlnaHRcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWVJdGVyYXRvcih0aGlzLCBzdGFjaylcbiAgfVxufSlcblxuLy9GaW5kIHRoZSBpdGggaXRlbSBpbiB0aGUgdHJlZVxucHJvdG8uYXQgPSBmdW5jdGlvbihpZHgpIHtcbiAgaWYoaWR4IDwgMCkge1xuICAgIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgW10pXG4gIH1cbiAgdmFyIG4gPSB0aGlzLnJvb3RcbiAgdmFyIHN0YWNrID0gW11cbiAgd2hpbGUodHJ1ZSkge1xuICAgIHN0YWNrLnB1c2gobilcbiAgICBpZihuLmxlZnQpIHtcbiAgICAgIGlmKGlkeCA8IG4ubGVmdC5fY291bnQpIHtcbiAgICAgICAgbiA9IG4ubGVmdFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgaWR4IC09IG4ubGVmdC5fY291bnRcbiAgICB9XG4gICAgaWYoIWlkeCkge1xuICAgICAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWVJdGVyYXRvcih0aGlzLCBzdGFjaylcbiAgICB9XG4gICAgaWR4IC09IDFcbiAgICBpZihuLnJpZ2h0KSB7XG4gICAgICBpZihpZHggPj0gbi5yaWdodC5fY291bnQpIHtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIG4gPSBuLnJpZ2h0XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgW10pXG59XG5cbnByb3RvLmdlID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIHZhciBuID0gdGhpcy5yb290XG4gIHZhciBzdGFjayA9IFtdXG4gIHZhciBsYXN0X3B0ciA9IDBcbiAgd2hpbGUobikge1xuICAgIHZhciBkID0gY21wKGtleSwgbi5rZXkpXG4gICAgc3RhY2sucHVzaChuKVxuICAgIGlmKGQgPD0gMCkge1xuICAgICAgbGFzdF9wdHIgPSBzdGFjay5sZW5ndGhcbiAgICB9XG4gICAgaWYoZCA8PSAwKSB7XG4gICAgICBuID0gbi5sZWZ0XG4gICAgfSBlbHNlIHtcbiAgICAgIG4gPSBuLnJpZ2h0XG4gICAgfVxuICB9XG4gIHN0YWNrLmxlbmd0aCA9IGxhc3RfcHRyXG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgc3RhY2spXG59XG5cbnByb3RvLmd0ID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIHZhciBuID0gdGhpcy5yb290XG4gIHZhciBzdGFjayA9IFtdXG4gIHZhciBsYXN0X3B0ciA9IDBcbiAgd2hpbGUobikge1xuICAgIHZhciBkID0gY21wKGtleSwgbi5rZXkpXG4gICAgc3RhY2sucHVzaChuKVxuICAgIGlmKGQgPCAwKSB7XG4gICAgICBsYXN0X3B0ciA9IHN0YWNrLmxlbmd0aFxuICAgIH1cbiAgICBpZihkIDwgMCkge1xuICAgICAgbiA9IG4ubGVmdFxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbi5yaWdodFxuICAgIH1cbiAgfVxuICBzdGFjay5sZW5ndGggPSBsYXN0X3B0clxuICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZUl0ZXJhdG9yKHRoaXMsIHN0YWNrKVxufVxuXG5wcm90by5sdCA9IGZ1bmN0aW9uKGtleSkge1xuICB2YXIgY21wID0gdGhpcy5fY29tcGFyZVxuICB2YXIgbiA9IHRoaXMucm9vdFxuICB2YXIgc3RhY2sgPSBbXVxuICB2YXIgbGFzdF9wdHIgPSAwXG4gIHdoaWxlKG4pIHtcbiAgICB2YXIgZCA9IGNtcChrZXksIG4ua2V5KVxuICAgIHN0YWNrLnB1c2gobilcbiAgICBpZihkID4gMCkge1xuICAgICAgbGFzdF9wdHIgPSBzdGFjay5sZW5ndGhcbiAgICB9XG4gICAgaWYoZCA8PSAwKSB7XG4gICAgICBuID0gbi5sZWZ0XG4gICAgfSBlbHNlIHtcbiAgICAgIG4gPSBuLnJpZ2h0XG4gICAgfVxuICB9XG4gIHN0YWNrLmxlbmd0aCA9IGxhc3RfcHRyXG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgc3RhY2spXG59XG5cbnByb3RvLmxlID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIHZhciBuID0gdGhpcy5yb290XG4gIHZhciBzdGFjayA9IFtdXG4gIHZhciBsYXN0X3B0ciA9IDBcbiAgd2hpbGUobikge1xuICAgIHZhciBkID0gY21wKGtleSwgbi5rZXkpXG4gICAgc3RhY2sucHVzaChuKVxuICAgIGlmKGQgPj0gMCkge1xuICAgICAgbGFzdF9wdHIgPSBzdGFjay5sZW5ndGhcbiAgICB9XG4gICAgaWYoZCA8IDApIHtcbiAgICAgIG4gPSBuLmxlZnRcbiAgICB9IGVsc2Uge1xuICAgICAgbiA9IG4ucmlnaHRcbiAgICB9XG4gIH1cbiAgc3RhY2subGVuZ3RoID0gbGFzdF9wdHJcbiAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWVJdGVyYXRvcih0aGlzLCBzdGFjaylcbn1cblxuLy9GaW5kcyB0aGUgaXRlbSB3aXRoIGtleSBpZiBpdCBleGlzdHNcbnByb3RvLmZpbmQgPSBmdW5jdGlvbihrZXkpIHtcbiAgdmFyIGNtcCA9IHRoaXMuX2NvbXBhcmVcbiAgdmFyIG4gPSB0aGlzLnJvb3RcbiAgdmFyIHN0YWNrID0gW11cbiAgd2hpbGUobikge1xuICAgIHZhciBkID0gY21wKGtleSwgbi5rZXkpXG4gICAgc3RhY2sucHVzaChuKVxuICAgIGlmKGQgPT09IDApIHtcbiAgICAgIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlSXRlcmF0b3IodGhpcywgc3RhY2spXG4gICAgfVxuICAgIGlmKGQgPD0gMCkge1xuICAgICAgbiA9IG4ubGVmdFxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbi5yaWdodFxuICAgIH1cbiAgfVxuICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZUl0ZXJhdG9yKHRoaXMsIFtdKVxufVxuXG4vL1JlbW92ZXMgaXRlbSB3aXRoIGtleSBmcm9tIHRyZWVcbnByb3RvLnJlbW92ZSA9IGZ1bmN0aW9uKGtleSkge1xuICB2YXIgaXRlciA9IHRoaXMuZmluZChrZXkpXG4gIGlmKGl0ZXIpIHtcbiAgICByZXR1cm4gaXRlci5yZW1vdmUoKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbi8vUmV0dXJucyB0aGUgaXRlbSBhdCBga2V5YFxucHJvdG8uZ2V0ID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBjbXAgPSB0aGlzLl9jb21wYXJlXG4gIHZhciBuID0gdGhpcy5yb290XG4gIHdoaWxlKG4pIHtcbiAgICB2YXIgZCA9IGNtcChrZXksIG4ua2V5KVxuICAgIGlmKGQgPT09IDApIHtcbiAgICAgIHJldHVybiBuLnZhbHVlXG4gICAgfVxuICAgIGlmKGQgPD0gMCkge1xuICAgICAgbiA9IG4ubGVmdFxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbi5yaWdodFxuICAgIH1cbiAgfVxuICByZXR1cm5cbn1cblxuLy9JdGVyYXRvciBmb3IgcmVkIGJsYWNrIHRyZWVcbmZ1bmN0aW9uIFJlZEJsYWNrVHJlZUl0ZXJhdG9yKHRyZWUsIHN0YWNrKSB7XG4gIHRoaXMudHJlZSA9IHRyZWVcbiAgdGhpcy5fc3RhY2sgPSBzdGFja1xufVxuXG52YXIgaXByb3RvID0gUmVkQmxhY2tUcmVlSXRlcmF0b3IucHJvdG90eXBlXG5cbi8vVGVzdCBpZiBpdGVyYXRvciBpcyB2YWxpZFxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGlwcm90bywgXCJ2YWxpZFwiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0YWNrLmxlbmd0aCA+IDBcbiAgfVxufSlcblxuLy9Ob2RlIG9mIHRoZSBpdGVyYXRvclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGlwcm90bywgXCJub2RlXCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICBpZih0aGlzLl9zdGFjay5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhY2tbdGhpcy5fc3RhY2subGVuZ3RoLTFdXG4gICAgfVxuICAgIHJldHVybiBudWxsXG4gIH0sXG4gIGVudW1lcmFibGU6IHRydWVcbn0pXG5cbi8vTWFrZXMgYSBjb3B5IG9mIGFuIGl0ZXJhdG9yXG5pcHJvdG8uY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWVJdGVyYXRvcih0aGlzLnRyZWUsIHRoaXMuX3N0YWNrLnNsaWNlKCkpXG59XG5cbi8vU3dhcHMgdHdvIG5vZGVzXG5mdW5jdGlvbiBzd2FwTm9kZShuLCB2KSB7XG4gIG4ua2V5ID0gdi5rZXlcbiAgbi52YWx1ZSA9IHYudmFsdWVcbiAgbi5sZWZ0ID0gdi5sZWZ0XG4gIG4ucmlnaHQgPSB2LnJpZ2h0XG4gIG4uX2NvbG9yID0gdi5fY29sb3JcbiAgbi5fY291bnQgPSB2Ll9jb3VudFxufVxuXG4vL0ZpeCB1cCBhIGRvdWJsZSBibGFjayBub2RlIGluIGEgdHJlZVxuZnVuY3Rpb24gZml4RG91YmxlQmxhY2soc3RhY2spIHtcbiAgdmFyIG4sIHAsIHMsIHpcbiAgZm9yKHZhciBpPXN0YWNrLmxlbmd0aC0xOyBpPj0wOyAtLWkpIHtcbiAgICBuID0gc3RhY2tbaV1cbiAgICBpZihpID09PSAwKSB7XG4gICAgICBuLl9jb2xvciA9IEJMQUNLXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgLy9jb25zb2xlLmxvZyhcInZpc2l0IG5vZGU6XCIsIG4ua2V5LCBpLCBzdGFja1tpXS5rZXksIHN0YWNrW2ktMV0ua2V5KVxuICAgIHAgPSBzdGFja1tpLTFdXG4gICAgaWYocC5sZWZ0ID09PSBuKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKFwibGVmdCBjaGlsZFwiKVxuICAgICAgcyA9IHAucmlnaHRcbiAgICAgIGlmKHMucmlnaHQgJiYgcy5yaWdodC5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiY2FzZSAxOiByaWdodCBzaWJsaW5nIGNoaWxkIHJlZFwiKVxuICAgICAgICBzID0gcC5yaWdodCA9IGNsb25lTm9kZShzKVxuICAgICAgICB6ID0gcy5yaWdodCA9IGNsb25lTm9kZShzLnJpZ2h0KVxuICAgICAgICBwLnJpZ2h0ID0gcy5sZWZ0XG4gICAgICAgIHMubGVmdCA9IHBcbiAgICAgICAgcy5yaWdodCA9IHpcbiAgICAgICAgcy5fY29sb3IgPSBwLl9jb2xvclxuICAgICAgICBuLl9jb2xvciA9IEJMQUNLXG4gICAgICAgIHAuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgei5fY29sb3IgPSBCTEFDS1xuICAgICAgICByZWNvdW50KHApXG4gICAgICAgIHJlY291bnQocylcbiAgICAgICAgaWYoaSA+IDEpIHtcbiAgICAgICAgICB2YXIgcHAgPSBzdGFja1tpLTJdXG4gICAgICAgICAgaWYocHAubGVmdCA9PT0gcCkge1xuICAgICAgICAgICAgcHAubGVmdCA9IHNcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHAucmlnaHQgPSBzXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0YWNrW2ktMV0gPSBzXG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIGlmKHMubGVmdCAmJiBzLmxlZnQuX2NvbG9yID09PSBSRUQpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImNhc2UgMTogbGVmdCBzaWJsaW5nIGNoaWxkIHJlZFwiKVxuICAgICAgICBzID0gcC5yaWdodCA9IGNsb25lTm9kZShzKVxuICAgICAgICB6ID0gcy5sZWZ0ID0gY2xvbmVOb2RlKHMubGVmdClcbiAgICAgICAgcC5yaWdodCA9IHoubGVmdFxuICAgICAgICBzLmxlZnQgPSB6LnJpZ2h0XG4gICAgICAgIHoubGVmdCA9IHBcbiAgICAgICAgei5yaWdodCA9IHNcbiAgICAgICAgei5fY29sb3IgPSBwLl9jb2xvclxuICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgIHMuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgbi5fY29sb3IgPSBCTEFDS1xuICAgICAgICByZWNvdW50KHApXG4gICAgICAgIHJlY291bnQocylcbiAgICAgICAgcmVjb3VudCh6KVxuICAgICAgICBpZihpID4gMSkge1xuICAgICAgICAgIHZhciBwcCA9IHN0YWNrW2ktMl1cbiAgICAgICAgICBpZihwcC5sZWZ0ID09PSBwKSB7XG4gICAgICAgICAgICBwcC5sZWZ0ID0gelxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcC5yaWdodCA9IHpcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2tbaS0xXSA9IHpcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBpZihzLl9jb2xvciA9PT0gQkxBQ0spIHtcbiAgICAgICAgaWYocC5fY29sb3IgPT09IFJFRCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDI6IGJsYWNrIHNpYmxpbmcsIHJlZCBwYXJlbnRcIiwgcC5yaWdodC52YWx1ZSlcbiAgICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgICAgcC5yaWdodCA9IHJlcGFpbnQoUkVELCBzKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDI6IGJsYWNrIHNpYmxpbmcsIGJsYWNrIHBhcmVudFwiLCBwLnJpZ2h0LnZhbHVlKVxuICAgICAgICAgIHAucmlnaHQgPSByZXBhaW50KFJFRCwgcylcbiAgICAgICAgICBjb250aW51ZSAgXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDM6IHJlZCBzaWJsaW5nXCIpXG4gICAgICAgIHMgPSBjbG9uZU5vZGUocylcbiAgICAgICAgcC5yaWdodCA9IHMubGVmdFxuICAgICAgICBzLmxlZnQgPSBwXG4gICAgICAgIHMuX2NvbG9yID0gcC5fY29sb3JcbiAgICAgICAgcC5fY29sb3IgPSBSRURcbiAgICAgICAgcmVjb3VudChwKVxuICAgICAgICByZWNvdW50KHMpXG4gICAgICAgIGlmKGkgPiAxKSB7XG4gICAgICAgICAgdmFyIHBwID0gc3RhY2tbaS0yXVxuICAgICAgICAgIGlmKHBwLmxlZnQgPT09IHApIHtcbiAgICAgICAgICAgIHBwLmxlZnQgPSBzXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBwLnJpZ2h0ID0gc1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdGFja1tpLTFdID0gc1xuICAgICAgICBzdGFja1tpXSA9IHBcbiAgICAgICAgaWYoaSsxIDwgc3RhY2subGVuZ3RoKSB7XG4gICAgICAgICAgc3RhY2tbaSsxXSA9IG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdGFjay5wdXNoKG4pXG4gICAgICAgIH1cbiAgICAgICAgaSA9IGkrMlxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2NvbnNvbGUubG9nKFwicmlnaHQgY2hpbGRcIilcbiAgICAgIHMgPSBwLmxlZnRcbiAgICAgIGlmKHMubGVmdCAmJiBzLmxlZnQuX2NvbG9yID09PSBSRUQpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImNhc2UgMTogbGVmdCBzaWJsaW5nIGNoaWxkIHJlZFwiLCBwLnZhbHVlLCBwLl9jb2xvcilcbiAgICAgICAgcyA9IHAubGVmdCA9IGNsb25lTm9kZShzKVxuICAgICAgICB6ID0gcy5sZWZ0ID0gY2xvbmVOb2RlKHMubGVmdClcbiAgICAgICAgcC5sZWZ0ID0gcy5yaWdodFxuICAgICAgICBzLnJpZ2h0ID0gcFxuICAgICAgICBzLmxlZnQgPSB6XG4gICAgICAgIHMuX2NvbG9yID0gcC5fY29sb3JcbiAgICAgICAgbi5fY29sb3IgPSBCTEFDS1xuICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgIHouX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgcmVjb3VudChwKVxuICAgICAgICByZWNvdW50KHMpXG4gICAgICAgIGlmKGkgPiAxKSB7XG4gICAgICAgICAgdmFyIHBwID0gc3RhY2tbaS0yXVxuICAgICAgICAgIGlmKHBwLnJpZ2h0ID09PSBwKSB7XG4gICAgICAgICAgICBwcC5yaWdodCA9IHNcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHAubGVmdCA9IHNcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2tbaS0xXSA9IHNcbiAgICAgICAgcmV0dXJuXG4gICAgICB9IGVsc2UgaWYocy5yaWdodCAmJiBzLnJpZ2h0Ll9jb2xvciA9PT0gUkVEKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDE6IHJpZ2h0IHNpYmxpbmcgY2hpbGQgcmVkXCIpXG4gICAgICAgIHMgPSBwLmxlZnQgPSBjbG9uZU5vZGUocylcbiAgICAgICAgeiA9IHMucmlnaHQgPSBjbG9uZU5vZGUocy5yaWdodClcbiAgICAgICAgcC5sZWZ0ID0gei5yaWdodFxuICAgICAgICBzLnJpZ2h0ID0gei5sZWZ0XG4gICAgICAgIHoucmlnaHQgPSBwXG4gICAgICAgIHoubGVmdCA9IHNcbiAgICAgICAgei5fY29sb3IgPSBwLl9jb2xvclxuICAgICAgICBwLl9jb2xvciA9IEJMQUNLXG4gICAgICAgIHMuX2NvbG9yID0gQkxBQ0tcbiAgICAgICAgbi5fY29sb3IgPSBCTEFDS1xuICAgICAgICByZWNvdW50KHApXG4gICAgICAgIHJlY291bnQocylcbiAgICAgICAgcmVjb3VudCh6KVxuICAgICAgICBpZihpID4gMSkge1xuICAgICAgICAgIHZhciBwcCA9IHN0YWNrW2ktMl1cbiAgICAgICAgICBpZihwcC5yaWdodCA9PT0gcCkge1xuICAgICAgICAgICAgcHAucmlnaHQgPSB6XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBwLmxlZnQgPSB6XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0YWNrW2ktMV0gPSB6XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgaWYocy5fY29sb3IgPT09IEJMQUNLKSB7XG4gICAgICAgIGlmKHAuX2NvbG9yID09PSBSRUQpIHtcbiAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiY2FzZSAyOiBibGFjayBzaWJsaW5nLCByZWQgcGFyZW50XCIpXG4gICAgICAgICAgcC5fY29sb3IgPSBCTEFDS1xuICAgICAgICAgIHAubGVmdCA9IHJlcGFpbnQoUkVELCBzKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coXCJjYXNlIDI6IGJsYWNrIHNpYmxpbmcsIGJsYWNrIHBhcmVudFwiKVxuICAgICAgICAgIHAubGVmdCA9IHJlcGFpbnQoUkVELCBzKVxuICAgICAgICAgIGNvbnRpbnVlICBcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImNhc2UgMzogcmVkIHNpYmxpbmdcIilcbiAgICAgICAgcyA9IGNsb25lTm9kZShzKVxuICAgICAgICBwLmxlZnQgPSBzLnJpZ2h0XG4gICAgICAgIHMucmlnaHQgPSBwXG4gICAgICAgIHMuX2NvbG9yID0gcC5fY29sb3JcbiAgICAgICAgcC5fY29sb3IgPSBSRURcbiAgICAgICAgcmVjb3VudChwKVxuICAgICAgICByZWNvdW50KHMpXG4gICAgICAgIGlmKGkgPiAxKSB7XG4gICAgICAgICAgdmFyIHBwID0gc3RhY2tbaS0yXVxuICAgICAgICAgIGlmKHBwLnJpZ2h0ID09PSBwKSB7XG4gICAgICAgICAgICBwcC5yaWdodCA9IHNcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHAubGVmdCA9IHNcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2tbaS0xXSA9IHNcbiAgICAgICAgc3RhY2tbaV0gPSBwXG4gICAgICAgIGlmKGkrMSA8IHN0YWNrLmxlbmd0aCkge1xuICAgICAgICAgIHN0YWNrW2krMV0gPSBuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgICB9XG4gICAgICAgIGkgPSBpKzJcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLy9SZW1vdmVzIGl0ZW0gYXQgaXRlcmF0b3IgZnJvbSB0cmVlXG5pcHJvdG8ucmVtb3ZlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGFjayA9IHRoaXMuX3N0YWNrXG4gIGlmKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB0aGlzLnRyZWVcbiAgfVxuICAvL0ZpcnN0IGNvcHkgcGF0aCB0byBub2RlXG4gIHZhciBjc3RhY2sgPSBuZXcgQXJyYXkoc3RhY2subGVuZ3RoKVxuICB2YXIgbiA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVxuICBjc3RhY2tbY3N0YWNrLmxlbmd0aC0xXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBuLmxlZnQsIG4ucmlnaHQsIG4uX2NvdW50KVxuICBmb3IodmFyIGk9c3RhY2subGVuZ3RoLTI7IGk+PTA7IC0taSkge1xuICAgIHZhciBuID0gc3RhY2tbaV1cbiAgICBpZihuLmxlZnQgPT09IHN0YWNrW2krMV0pIHtcbiAgICAgIGNzdGFja1tpXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBjc3RhY2tbaSsxXSwgbi5yaWdodCwgbi5fY291bnQpXG4gICAgfSBlbHNlIHtcbiAgICAgIGNzdGFja1tpXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBuLmxlZnQsIGNzdGFja1tpKzFdLCBuLl9jb3VudClcbiAgICB9XG4gIH1cblxuICAvL0dldCBub2RlXG4gIG4gPSBjc3RhY2tbY3N0YWNrLmxlbmd0aC0xXVxuICAvL2NvbnNvbGUubG9nKFwic3RhcnQgcmVtb3ZlOiBcIiwgbi52YWx1ZSlcblxuICAvL0lmIG5vdCBsZWFmLCB0aGVuIHN3YXAgd2l0aCBwcmV2aW91cyBub2RlXG4gIGlmKG4ubGVmdCAmJiBuLnJpZ2h0KSB7XG4gICAgLy9jb25zb2xlLmxvZyhcIm1vdmluZyB0byBsZWFmXCIpXG5cbiAgICAvL0ZpcnN0IHdhbGsgdG8gcHJldmlvdXMgbGVhZlxuICAgIHZhciBzcGxpdCA9IGNzdGFjay5sZW5ndGhcbiAgICBuID0gbi5sZWZ0XG4gICAgd2hpbGUobi5yaWdodCkge1xuICAgICAgY3N0YWNrLnB1c2gobilcbiAgICAgIG4gPSBuLnJpZ2h0XG4gICAgfVxuICAgIC8vQ29weSBwYXRoIHRvIGxlYWZcbiAgICB2YXIgdiA9IGNzdGFja1tzcGxpdC0xXVxuICAgIGNzdGFjay5wdXNoKG5ldyBSQk5vZGUobi5fY29sb3IsIHYua2V5LCB2LnZhbHVlLCBuLmxlZnQsIG4ucmlnaHQsIG4uX2NvdW50KSlcbiAgICBjc3RhY2tbc3BsaXQtMV0ua2V5ID0gbi5rZXlcbiAgICBjc3RhY2tbc3BsaXQtMV0udmFsdWUgPSBuLnZhbHVlXG5cbiAgICAvL0ZpeCB1cCBzdGFja1xuICAgIGZvcih2YXIgaT1jc3RhY2subGVuZ3RoLTI7IGk+PXNwbGl0OyAtLWkpIHtcbiAgICAgIG4gPSBjc3RhY2tbaV1cbiAgICAgIGNzdGFja1tpXSA9IG5ldyBSQk5vZGUobi5fY29sb3IsIG4ua2V5LCBuLnZhbHVlLCBuLmxlZnQsIGNzdGFja1tpKzFdLCBuLl9jb3VudClcbiAgICB9XG4gICAgY3N0YWNrW3NwbGl0LTFdLmxlZnQgPSBjc3RhY2tbc3BsaXRdXG4gIH1cbiAgLy9jb25zb2xlLmxvZyhcInN0YWNrPVwiLCBjc3RhY2subWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHYudmFsdWUgfSkpXG5cbiAgLy9SZW1vdmUgbGVhZiBub2RlXG4gIG4gPSBjc3RhY2tbY3N0YWNrLmxlbmd0aC0xXVxuICBpZihuLl9jb2xvciA9PT0gUkVEKSB7XG4gICAgLy9FYXN5IGNhc2U6IHJlbW92aW5nIHJlZCBsZWFmXG4gICAgLy9jb25zb2xlLmxvZyhcIlJFRCBsZWFmXCIpXG4gICAgdmFyIHAgPSBjc3RhY2tbY3N0YWNrLmxlbmd0aC0yXVxuICAgIGlmKHAubGVmdCA9PT0gbikge1xuICAgICAgcC5sZWZ0ID0gbnVsbFxuICAgIH0gZWxzZSBpZihwLnJpZ2h0ID09PSBuKSB7XG4gICAgICBwLnJpZ2h0ID0gbnVsbFxuICAgIH1cbiAgICBjc3RhY2sucG9wKClcbiAgICBmb3IodmFyIGk9MDsgaTxjc3RhY2subGVuZ3RoOyArK2kpIHtcbiAgICAgIGNzdGFja1tpXS5fY291bnQtLVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFJlZEJsYWNrVHJlZSh0aGlzLnRyZWUuX2NvbXBhcmUsIGNzdGFja1swXSlcbiAgfSBlbHNlIHtcbiAgICBpZihuLmxlZnQgfHwgbi5yaWdodCkge1xuICAgICAgLy9TZWNvbmQgZWFzeSBjYXNlOiAgU2luZ2xlIGNoaWxkIGJsYWNrIHBhcmVudFxuICAgICAgLy9jb25zb2xlLmxvZyhcIkJMQUNLIHNpbmdsZSBjaGlsZFwiKVxuICAgICAgaWYobi5sZWZ0KSB7XG4gICAgICAgIHN3YXBOb2RlKG4sIG4ubGVmdClcbiAgICAgIH0gZWxzZSBpZihuLnJpZ2h0KSB7XG4gICAgICAgIHN3YXBOb2RlKG4sIG4ucmlnaHQpXG4gICAgICB9XG4gICAgICAvL0NoaWxkIG11c3QgYmUgcmVkLCBzbyByZXBhaW50IGl0IGJsYWNrIHRvIGJhbGFuY2UgY29sb3JcbiAgICAgIG4uX2NvbG9yID0gQkxBQ0tcbiAgICAgIGZvcih2YXIgaT0wOyBpPGNzdGFjay5sZW5ndGgtMTsgKytpKSB7XG4gICAgICAgIGNzdGFja1tpXS5fY291bnQtLVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWUodGhpcy50cmVlLl9jb21wYXJlLCBjc3RhY2tbMF0pXG4gICAgfSBlbHNlIGlmKGNzdGFjay5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vVGhpcmQgZWFzeSBjYXNlOiByb290XG4gICAgICAvL2NvbnNvbGUubG9nKFwiUk9PVFwiKVxuICAgICAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWUodGhpcy50cmVlLl9jb21wYXJlLCBudWxsKVxuICAgIH0gZWxzZSB7XG4gICAgICAvL0hhcmQgY2FzZTogUmVwYWludCBuLCBhbmQgdGhlbiBkbyBzb21lIG5hc3R5IHN0dWZmXG4gICAgICAvL2NvbnNvbGUubG9nKFwiQkxBQ0sgbGVhZiBubyBjaGlsZHJlblwiKVxuICAgICAgZm9yKHZhciBpPTA7IGk8Y3N0YWNrLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNzdGFja1tpXS5fY291bnQtLVxuICAgICAgfVxuICAgICAgdmFyIHBhcmVudCA9IGNzdGFja1tjc3RhY2subGVuZ3RoLTJdXG4gICAgICBmaXhEb3VibGVCbGFjayhjc3RhY2spXG4gICAgICAvL0ZpeCB1cCBsaW5rc1xuICAgICAgaWYocGFyZW50LmxlZnQgPT09IG4pIHtcbiAgICAgICAgcGFyZW50LmxlZnQgPSBudWxsXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnQucmlnaHQgPSBudWxsXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlKHRoaXMudHJlZS5fY29tcGFyZSwgY3N0YWNrWzBdKVxufVxuXG4vL1JldHVybnMga2V5XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoaXByb3RvLCBcImtleVwiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgaWYodGhpcy5fc3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YWNrW3RoaXMuX3N0YWNrLmxlbmd0aC0xXS5rZXlcbiAgICB9XG4gICAgcmV0dXJuXG4gIH0sXG4gIGVudW1lcmFibGU6IHRydWVcbn0pXG5cbi8vUmV0dXJucyB2YWx1ZVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGlwcm90bywgXCJ2YWx1ZVwiLCB7XG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgaWYodGhpcy5fc3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YWNrW3RoaXMuX3N0YWNrLmxlbmd0aC0xXS52YWx1ZVxuICAgIH1cbiAgICByZXR1cm5cbiAgfSxcbiAgZW51bWVyYWJsZTogdHJ1ZVxufSlcblxuXG4vL1JldHVybnMgdGhlIHBvc2l0aW9uIG9mIHRoaXMgaXRlcmF0b3IgaW4gdGhlIHNvcnRlZCBsaXN0XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoaXByb3RvLCBcImluZGV4XCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaWR4ID0gMFxuICAgIHZhciBzdGFjayA9IHRoaXMuX3N0YWNrXG4gICAgaWYoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICB2YXIgciA9IHRoaXMudHJlZS5yb290XG4gICAgICBpZihyKSB7XG4gICAgICAgIHJldHVybiByLl9jb3VudFxuICAgICAgfVxuICAgICAgcmV0dXJuIDBcbiAgICB9IGVsc2UgaWYoc3RhY2tbc3RhY2subGVuZ3RoLTFdLmxlZnQpIHtcbiAgICAgIGlkeCA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXS5sZWZ0Ll9jb3VudFxuICAgIH1cbiAgICBmb3IodmFyIHM9c3RhY2subGVuZ3RoLTI7IHM+PTA7IC0tcykge1xuICAgICAgaWYoc3RhY2tbcysxXSA9PT0gc3RhY2tbc10ucmlnaHQpIHtcbiAgICAgICAgKytpZHhcbiAgICAgICAgaWYoc3RhY2tbc10ubGVmdCkge1xuICAgICAgICAgIGlkeCArPSBzdGFja1tzXS5sZWZ0Ll9jb3VudFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpZHhcbiAgfSxcbiAgZW51bWVyYWJsZTogdHJ1ZVxufSlcblxuLy9BZHZhbmNlcyBpdGVyYXRvciB0byBuZXh0IGVsZW1lbnQgaW4gbGlzdFxuaXByb3RvLm5leHQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YWNrID0gdGhpcy5fc3RhY2tcbiAgaWYoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgdmFyIG4gPSBzdGFja1tzdGFjay5sZW5ndGgtMV1cbiAgaWYobi5yaWdodCkge1xuICAgIG4gPSBuLnJpZ2h0XG4gICAgd2hpbGUobikge1xuICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgbiA9IG4ubGVmdFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBzdGFjay5wb3AoKVxuICAgIHdoaWxlKHN0YWNrLmxlbmd0aCA+IDAgJiYgc3RhY2tbc3RhY2subGVuZ3RoLTFdLnJpZ2h0ID09PSBuKSB7XG4gICAgICBuID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdXG4gICAgICBzdGFjay5wb3AoKVxuICAgIH1cbiAgfVxufVxuXG4vL0NoZWNrcyBpZiBpdGVyYXRvciBpcyBhdCBlbmQgb2YgdHJlZVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGlwcm90bywgXCJoYXNOZXh0XCIsIHtcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhY2sgPSB0aGlzLl9zdGFja1xuICAgIGlmKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIGlmKHN0YWNrW3N0YWNrLmxlbmd0aC0xXS5yaWdodCkge1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgZm9yKHZhciBzPXN0YWNrLmxlbmd0aC0xOyBzPjA7IC0tcykge1xuICAgICAgaWYoc3RhY2tbcy0xXS5sZWZ0ID09PSBzdGFja1tzXSkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSlcblxuLy9VcGRhdGUgdmFsdWVcbmlwcm90by51cGRhdGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgc3RhY2sgPSB0aGlzLl9zdGFja1xuICBpZihzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCB1cGRhdGUgZW1wdHkgbm9kZSFcIilcbiAgfVxuICB2YXIgY3N0YWNrID0gbmV3IEFycmF5KHN0YWNrLmxlbmd0aClcbiAgdmFyIG4gPSBzdGFja1tzdGFjay5sZW5ndGgtMV1cbiAgY3N0YWNrW2NzdGFjay5sZW5ndGgtMV0gPSBuZXcgUkJOb2RlKG4uX2NvbG9yLCBuLmtleSwgdmFsdWUsIG4ubGVmdCwgbi5yaWdodCwgbi5fY291bnQpXG4gIGZvcih2YXIgaT1zdGFjay5sZW5ndGgtMjsgaT49MDsgLS1pKSB7XG4gICAgbiA9IHN0YWNrW2ldXG4gICAgaWYobi5sZWZ0ID09PSBzdGFja1tpKzFdKSB7XG4gICAgICBjc3RhY2tbaV0gPSBuZXcgUkJOb2RlKG4uX2NvbG9yLCBuLmtleSwgbi52YWx1ZSwgY3N0YWNrW2krMV0sIG4ucmlnaHQsIG4uX2NvdW50KVxuICAgIH0gZWxzZSB7XG4gICAgICBjc3RhY2tbaV0gPSBuZXcgUkJOb2RlKG4uX2NvbG9yLCBuLmtleSwgbi52YWx1ZSwgbi5sZWZ0LCBjc3RhY2tbaSsxXSwgbi5fY291bnQpXG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgUmVkQmxhY2tUcmVlKHRoaXMudHJlZS5fY29tcGFyZSwgY3N0YWNrWzBdKVxufVxuXG4vL01vdmVzIGl0ZXJhdG9yIGJhY2t3YXJkIG9uZSBlbGVtZW50XG5pcHJvdG8ucHJldiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhY2sgPSB0aGlzLl9zdGFja1xuICBpZihzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm5cbiAgfVxuICB2YXIgbiA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVxuICBpZihuLmxlZnQpIHtcbiAgICBuID0gbi5sZWZ0XG4gICAgd2hpbGUobikge1xuICAgICAgc3RhY2sucHVzaChuKVxuICAgICAgbiA9IG4ucmlnaHRcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgc3RhY2sucG9wKClcbiAgICB3aGlsZShzdGFjay5sZW5ndGggPiAwICYmIHN0YWNrW3N0YWNrLmxlbmd0aC0xXS5sZWZ0ID09PSBuKSB7XG4gICAgICBuID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdXG4gICAgICBzdGFjay5wb3AoKVxuICAgIH1cbiAgfVxufVxuXG4vL0NoZWNrcyBpZiBpdGVyYXRvciBpcyBhdCBzdGFydCBvZiB0cmVlXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoaXByb3RvLCBcImhhc1ByZXZcIiwge1xuICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGFjayA9IHRoaXMuX3N0YWNrXG4gICAgaWYoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgaWYoc3RhY2tbc3RhY2subGVuZ3RoLTFdLmxlZnQpIHtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIGZvcih2YXIgcz1zdGFjay5sZW5ndGgtMTsgcz4wOyAtLXMpIHtcbiAgICAgIGlmKHN0YWNrW3MtMV0ucmlnaHQgPT09IHN0YWNrW3NdKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9XG59KVxuXG4vL0RlZmF1bHQgY29tcGFyaXNvbiBmdW5jdGlvblxuZnVuY3Rpb24gZGVmYXVsdENvbXBhcmUoYSwgYikge1xuICBpZihhIDwgYikge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmKGEgPiBiKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuICByZXR1cm4gMFxufVxuXG4vL0J1aWxkIGEgdHJlZVxuZnVuY3Rpb24gY3JlYXRlUkJUcmVlKGNvbXBhcmUpIHtcbiAgcmV0dXJuIG5ldyBSZWRCbGFja1RyZWUoY29tcGFyZSB8fCBkZWZhdWx0Q29tcGFyZSwgbnVsbClcbn0iLCIvKiBlc2xpbnQtZGlzYWJsZSBub2RlL25vLWRlcHJlY2F0ZWQtYXBpICovXG52YXIgYnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJylcbnZhciBCdWZmZXIgPSBidWZmZXIuQnVmZmVyXG5cbi8vIGFsdGVybmF0aXZlIHRvIHVzaW5nIE9iamVjdC5rZXlzIGZvciBvbGQgYnJvd3NlcnNcbmZ1bmN0aW9uIGNvcHlQcm9wcyAoc3JjLCBkc3QpIHtcbiAgZm9yICh2YXIga2V5IGluIHNyYykge1xuICAgIGRzdFtrZXldID0gc3JjW2tleV1cbiAgfVxufVxuaWYgKEJ1ZmZlci5mcm9tICYmIEJ1ZmZlci5hbGxvYyAmJiBCdWZmZXIuYWxsb2NVbnNhZmUgJiYgQnVmZmVyLmFsbG9jVW5zYWZlU2xvdykge1xuICBtb2R1bGUuZXhwb3J0cyA9IGJ1ZmZlclxufSBlbHNlIHtcbiAgLy8gQ29weSBwcm9wZXJ0aWVzIGZyb20gcmVxdWlyZSgnYnVmZmVyJylcbiAgY29weVByb3BzKGJ1ZmZlciwgZXhwb3J0cylcbiAgZXhwb3J0cy5CdWZmZXIgPSBTYWZlQnVmZmVyXG59XG5cbmZ1bmN0aW9uIFNhZmVCdWZmZXIgKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBCdWZmZXIoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbi8vIENvcHkgc3RhdGljIG1ldGhvZHMgZnJvbSBCdWZmZXJcbmNvcHlQcm9wcyhCdWZmZXIsIFNhZmVCdWZmZXIpXG5cblNhZmVCdWZmZXIuZnJvbSA9IGZ1bmN0aW9uIChhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IG5vdCBiZSBhIG51bWJlcicpXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlcihhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuU2FmZUJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIG51bWJlcicpXG4gIH1cbiAgdmFyIGJ1ZiA9IEJ1ZmZlcihzaXplKVxuICBpZiAoZmlsbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGJ1Zi5maWxsKGZpbGwsIGVuY29kaW5nKVxuICAgIH0gZWxzZSB7XG4gICAgICBidWYuZmlsbChmaWxsKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBidWYuZmlsbCgwKVxuICB9XG4gIHJldHVybiBidWZcbn1cblxuU2FmZUJ1ZmZlci5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgbnVtYmVyJylcbiAgfVxuICByZXR1cm4gQnVmZmVyKHNpemUpXG59XG5cblNhZmVCdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgaWYgKHR5cGVvZiBzaXplICE9PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBudW1iZXInKVxuICB9XG4gIHJldHVybiBidWZmZXIuU2xvd0J1ZmZlcihzaXplKVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCdpbW1lZGlhdGUnKVxuIiwidmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKVxudmFyIEFic3RyYWN0TGV2ZWxET1dOID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RMZXZlbERPV05cbnZhciBBYnN0cmFjdEl0ZXJhdG9yID0gcmVxdWlyZSgnYWJzdHJhY3QtbGV2ZWxkb3duJykuQWJzdHJhY3RJdGVyYXRvclxudmFyIGx0Z3QgPSByZXF1aXJlKCdsdGd0JylcbnZhciBjcmVhdGVSQlQgPSByZXF1aXJlKCdmdW5jdGlvbmFsLXJlZC1ibGFjay10cmVlJylcbnZhciBCdWZmZXIgPSByZXF1aXJlKCdzYWZlLWJ1ZmZlcicpLkJ1ZmZlclxudmFyIGdsb2JhbFN0b3JlID0ge31cblxuLy8gSW4gTm9kZSwgdXNlIGdsb2JhbC5zZXRJbW1lZGlhdGUuIEluIHRoZSBicm93c2VyLCB1c2UgYSBjb25zaXN0ZW50XG4vLyBtaWNyb3Rhc2sgbGlicmFyeSB0byBnaXZlIGNvbnNpc3RlbnQgbWljcm90YXNrIGV4cGVyaWVuY2UgdG8gYWxsIGJyb3dzZXJzXG52YXIgc2V0SW1tZWRpYXRlID0gcmVxdWlyZSgnLi9pbW1lZGlhdGUnKVxuXG5mdW5jdGlvbiBndCAodmFsdWUpIHtcbiAgcmV0dXJuIGx0Z3QuY29tcGFyZSh2YWx1ZSwgdGhpcy5fZW5kKSA+IDBcbn1cblxuZnVuY3Rpb24gZ3RlICh2YWx1ZSkge1xuICByZXR1cm4gbHRndC5jb21wYXJlKHZhbHVlLCB0aGlzLl9lbmQpID49IDBcbn1cblxuZnVuY3Rpb24gbHQgKHZhbHVlKSB7XG4gIHJldHVybiBsdGd0LmNvbXBhcmUodmFsdWUsIHRoaXMuX2VuZCkgPCAwXG59XG5cbmZ1bmN0aW9uIGx0ZSAodmFsdWUpIHtcbiAgcmV0dXJuIGx0Z3QuY29tcGFyZSh2YWx1ZSwgdGhpcy5fZW5kKSA8PSAwXG59XG5cbmZ1bmN0aW9uIE1lbUl0ZXJhdG9yIChkYiwgb3B0aW9ucykge1xuICBBYnN0cmFjdEl0ZXJhdG9yLmNhbGwodGhpcywgZGIpXG4gIHRoaXMuX2xpbWl0ID0gb3B0aW9ucy5saW1pdFxuXG4gIGlmICh0aGlzLl9saW1pdCA9PT0gLTEpIHRoaXMuX2xpbWl0ID0gSW5maW5pdHlcblxuICB2YXIgdHJlZSA9IGRiLl9zdG9yZVtkYi5fbG9jYXRpb25dXG5cbiAgdGhpcy5rZXlBc0J1ZmZlciA9IG9wdGlvbnMua2V5QXNCdWZmZXIgIT09IGZhbHNlXG4gIHRoaXMudmFsdWVBc0J1ZmZlciA9IG9wdGlvbnMudmFsdWVBc0J1ZmZlciAhPT0gZmFsc2VcbiAgdGhpcy5fcmV2ZXJzZSA9IG9wdGlvbnMucmV2ZXJzZVxuICB0aGlzLl9vcHRpb25zID0gb3B0aW9uc1xuICB0aGlzLl9kb25lID0gMFxuXG4gIGlmICghdGhpcy5fcmV2ZXJzZSkge1xuICAgIHRoaXMuX2luY3IgPSAnbmV4dCdcbiAgICB0aGlzLl9zdGFydCA9IGx0Z3QubG93ZXJCb3VuZChvcHRpb25zKVxuICAgIHRoaXMuX2VuZCA9IGx0Z3QudXBwZXJCb3VuZChvcHRpb25zKVxuXG4gICAgaWYgKHR5cGVvZiB0aGlzLl9zdGFydCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuX3RyZWUgPSB0cmVlLmJlZ2luXG4gICAgfSBlbHNlIGlmIChsdGd0Lmxvd2VyQm91bmRJbmNsdXNpdmUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3RyZWUgPSB0cmVlLmdlKHRoaXMuX3N0YXJ0KVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl90cmVlID0gdHJlZS5ndCh0aGlzLl9zdGFydClcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZW5kKSB7XG4gICAgICBpZiAobHRndC51cHBlckJvdW5kSW5jbHVzaXZlKG9wdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuX3Rlc3QgPSBsdGVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Rlc3QgPSBsdFxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLl9pbmNyID0gJ3ByZXYnXG4gICAgdGhpcy5fc3RhcnQgPSBsdGd0LnVwcGVyQm91bmQob3B0aW9ucylcbiAgICB0aGlzLl9lbmQgPSBsdGd0Lmxvd2VyQm91bmQob3B0aW9ucylcblxuICAgIGlmICh0eXBlb2YgdGhpcy5fc3RhcnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLl90cmVlID0gdHJlZS5lbmRcbiAgICB9IGVsc2UgaWYgKGx0Z3QudXBwZXJCb3VuZEluY2x1c2l2ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fdHJlZSA9IHRyZWUubGUodGhpcy5fc3RhcnQpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3RyZWUgPSB0cmVlLmx0KHRoaXMuX3N0YXJ0KVxuICAgIH1cblxuICAgIGlmICh0aGlzLl9lbmQpIHtcbiAgICAgIGlmIChsdGd0Lmxvd2VyQm91bmRJbmNsdXNpdmUob3B0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fdGVzdCA9IGd0ZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdGVzdCA9IGd0XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmluaGVyaXRzKE1lbUl0ZXJhdG9yLCBBYnN0cmFjdEl0ZXJhdG9yKVxuXG5NZW1JdGVyYXRvci5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdmFyIGtleVxuICB2YXIgdmFsdWVcblxuICBpZiAodGhpcy5fZG9uZSsrID49IHRoaXMuX2xpbWl0KSByZXR1cm4gc2V0SW1tZWRpYXRlKGNhbGxiYWNrKVxuICBpZiAoIXRoaXMuX3RyZWUudmFsaWQpIHJldHVybiBzZXRJbW1lZGlhdGUoY2FsbGJhY2spXG5cbiAga2V5ID0gdGhpcy5fdHJlZS5rZXlcbiAgdmFsdWUgPSB0aGlzLl90cmVlLnZhbHVlXG5cbiAgaWYgKCF0aGlzLl90ZXN0KGtleSkpIHJldHVybiBzZXRJbW1lZGlhdGUoY2FsbGJhY2spXG5cbiAgaWYgKHRoaXMua2V5QXNCdWZmZXIpIGtleSA9IEJ1ZmZlci5mcm9tKGtleSlcbiAgaWYgKHRoaXMudmFsdWVBc0J1ZmZlcikgdmFsdWUgPSBCdWZmZXIuZnJvbSh2YWx1ZSlcblxuICB0aGlzLl90cmVlW3RoaXMuX2luY3JdKClcblxuICBzZXRJbW1lZGlhdGUoZnVuY3Rpb24gY2FsbE5leHQgKCkge1xuICAgIGNhbGxiYWNrKG51bGwsIGtleSwgdmFsdWUpXG4gIH0pXG59XG5cbk1lbUl0ZXJhdG9yLnByb3RvdHlwZS5fdGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWVcbn1cblxuZnVuY3Rpb24gTWVtRE9XTiAobG9jYXRpb24pIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIE1lbURPV04pKSByZXR1cm4gbmV3IE1lbURPV04obG9jYXRpb24pXG5cbiAgQWJzdHJhY3RMZXZlbERPV04uY2FsbCh0aGlzLCB0eXBlb2YgbG9jYXRpb24gPT09ICdzdHJpbmcnID8gbG9jYXRpb24gOiAnJylcblxuICB0aGlzLl9sb2NhdGlvbiA9IHRoaXMubG9jYXRpb24gPyAnJCcgKyB0aGlzLmxvY2F0aW9uIDogJ190cmVlJ1xuICB0aGlzLl9zdG9yZSA9IHRoaXMubG9jYXRpb24gPyBnbG9iYWxTdG9yZSA6IHRoaXNcbiAgdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dID1cbiAgICB0aGlzLl9zdG9yZVt0aGlzLl9sb2NhdGlvbl0gfHwgY3JlYXRlUkJUKGx0Z3QuY29tcGFyZSlcbn1cblxuTWVtRE9XTi5jbGVhckdsb2JhbFN0b3JlID0gZnVuY3Rpb24gKHN0cmljdCkge1xuICBpZiAoc3RyaWN0KSB7XG4gICAgT2JqZWN0LmtleXMoZ2xvYmFsU3RvcmUpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgZGVsZXRlIGdsb2JhbFN0b3JlW2tleV1cbiAgICB9KVxuICB9IGVsc2Uge1xuICAgIGdsb2JhbFN0b3JlID0ge31cbiAgfVxufVxuXG5pbmhlcml0cyhNZW1ET1dOLCBBYnN0cmFjdExldmVsRE9XTilcblxuTWVtRE9XTi5wcm90b3R5cGUuX29wZW4gPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHNldEltbWVkaWF0ZShmdW5jdGlvbiBjYWxsTmV4dCAoKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgc2VsZilcbiAgfSlcbn1cblxuTWVtRE9XTi5wcm90b3R5cGUuX3B1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJyB8fCB2YWx1ZSA9PT0gbnVsbCkgdmFsdWUgPSAnJ1xuXG4gIHZhciBpdGVyID0gdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dLmZpbmQoa2V5KVxuXG4gIGlmIChpdGVyLnZhbGlkKSB7XG4gICAgdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dID0gaXRlci51cGRhdGUodmFsdWUpXG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dID0gdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dLmluc2VydChrZXksIHZhbHVlKVxuICB9XG5cbiAgc2V0SW1tZWRpYXRlKGNhbGxiYWNrKVxufVxuXG5NZW1ET1dOLnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGtleSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgdmFyIHZhbHVlID0gdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dLmdldChrZXkpXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvLyAnTm90Rm91bmQnIGVycm9yLCBjb25zaXN0ZW50IHdpdGggTGV2ZWxET1dOIEFQSVxuICAgIHJldHVybiBzZXRJbW1lZGlhdGUoZnVuY3Rpb24gY2FsbE5leHQgKCkge1xuICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdOb3RGb3VuZCcpKVxuICAgIH0pXG4gIH1cblxuICBpZiAob3B0aW9ucy5hc0J1ZmZlciAhPT0gZmFsc2UgJiYgIXRoaXMuX2lzQnVmZmVyKHZhbHVlKSkge1xuICAgIHZhbHVlID0gQnVmZmVyLmZyb20oU3RyaW5nKHZhbHVlKSlcbiAgfVxuXG4gIHNldEltbWVkaWF0ZShmdW5jdGlvbiBjYWxsTmV4dCAoKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgdmFsdWUpXG4gIH0pXG59XG5cbk1lbURPV04ucHJvdG90eXBlLl9kZWwgPSBmdW5jdGlvbiAoa2V5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICB0aGlzLl9zdG9yZVt0aGlzLl9sb2NhdGlvbl0gPSB0aGlzLl9zdG9yZVt0aGlzLl9sb2NhdGlvbl0ucmVtb3ZlKGtleSlcbiAgc2V0SW1tZWRpYXRlKGNhbGxiYWNrKVxufVxuXG5NZW1ET1dOLnByb3RvdHlwZS5fYmF0Y2ggPSBmdW5jdGlvbiAoYXJyYXksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBpID0gLTFcbiAgdmFyIGtleVxuICB2YXIgdmFsdWVcbiAgdmFyIGl0ZXJcbiAgdmFyIGxlbiA9IGFycmF5Lmxlbmd0aFxuICB2YXIgdHJlZSA9IHRoaXMuX3N0b3JlW3RoaXMuX2xvY2F0aW9uXVxuXG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBpZiAoIWFycmF5W2ldKSBjb250aW51ZVxuXG4gICAga2V5ID0gdGhpcy5faXNCdWZmZXIoYXJyYXlbaV0ua2V5KSA/IGFycmF5W2ldLmtleSA6IFN0cmluZyhhcnJheVtpXS5rZXkpXG4gICAgaXRlciA9IHRyZWUuZmluZChrZXkpXG5cbiAgICBpZiAoYXJyYXlbaV0udHlwZSA9PT0gJ3B1dCcpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5faXNCdWZmZXIoYXJyYXlbaV0udmFsdWUpXG4gICAgICAgID8gYXJyYXlbaV0udmFsdWVcbiAgICAgICAgOiBTdHJpbmcoYXJyYXlbaV0udmFsdWUpXG4gICAgICB0cmVlID0gaXRlci52YWxpZCA/IGl0ZXIudXBkYXRlKHZhbHVlKSA6IHRyZWUuaW5zZXJ0KGtleSwgdmFsdWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRyZWUgPSBpdGVyLnJlbW92ZSgpXG4gICAgfVxuICB9XG5cbiAgdGhpcy5fc3RvcmVbdGhpcy5fbG9jYXRpb25dID0gdHJlZVxuXG4gIHNldEltbWVkaWF0ZShjYWxsYmFjaylcbn1cblxuTWVtRE9XTi5wcm90b3R5cGUuX2l0ZXJhdG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBNZW1JdGVyYXRvcih0aGlzLCBvcHRpb25zKVxufVxuXG5NZW1ET1dOLnByb3RvdHlwZS5faXNCdWZmZXIgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiBCdWZmZXIuaXNCdWZmZXIob2JqKVxufVxuXG5NZW1ET1dOLmRlc3Ryb3kgPSBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcbiAgdmFyIGtleSA9ICckJyArIG5hbWVcblxuICBpZiAoa2V5IGluIGdsb2JhbFN0b3JlKSB7XG4gICAgZGVsZXRlIGdsb2JhbFN0b3JlW2tleV1cbiAgfVxuXG4gIHNldEltbWVkaWF0ZShjYWxsYmFjaylcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBNZW1ET1dOLmRlZmF1bHQgPSBNZW1ET1dOXG4iLCJpbXBvcnQgQ29yZUxldmVsUG91Y2ggZnJvbSAncG91Y2hkYi1hZGFwdGVyLWxldmVsZGItY29yZSc7XG5cblxuaW1wb3J0IG1lbWRvd24gZnJvbSAnbWVtZG93bic7XG5cbmZ1bmN0aW9uIE1lbURvd25Qb3VjaChvcHRzLCBjYWxsYmFjaykge1xuICB2YXIgX29wdHMgPSBPYmplY3QuYXNzaWduKHtcbiAgICBkYjogbWVtZG93blxuICB9LCBvcHRzKTtcblxuICBDb3JlTGV2ZWxQb3VjaC5jYWxsKHRoaXMsIF9vcHRzLCBjYWxsYmFjayk7XG59XG5cbi8vIG92ZXJyaWRlcyBmb3Igbm9ybWFsIExldmVsREIgYmVoYXZpb3Igb24gTm9kZVxuTWVtRG93blBvdWNoLnZhbGlkID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5NZW1Eb3duUG91Y2gudXNlX3ByZWZpeCA9IGZhbHNlO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoUG91Y2hEQikge1xuICBQb3VjaERCLmFkYXB0ZXIoJ21lbW9yeScsIE1lbURvd25Qb3VjaCwgdHJ1ZSk7XG59Il0sIm5hbWVzIjpbIkFic3RyYWN0SXRlcmF0b3IiLCJBYnN0cmFjdENoYWluZWRCYXRjaCIsInJlcXVpcmUkJDAiLCJyZXF1aXJlJCQxIiwicmVxdWlyZSQkMiIsIkFic3RyYWN0TGV2ZWxET1dOIiwiYWJzdHJhY3RMZXZlbGRvd24iLCJyZXF1aXJlJCQzIiwiYnVmZmVyIiwiQnVmZmVyIiwicmVxdWlyZSQkNCIsInJlcXVpcmUkJDUiLCJtZW1kb3duIiwiQ29yZUxldmVsUG91Y2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVBLFNBQVNBLGtCQUFnQixFQUFFLEVBQUUsRUFBRTtBQUMvQixFQUFFLElBQUksQ0FBQyxFQUFFLEdBQUcsR0FBRTtBQUNkLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFLO0FBQ3JCLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFLO0FBQ3ZCLENBQUM7QUFDRDtBQUNBQSxrQkFBZ0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsUUFBUSxFQUFFO0FBQ3RELEVBQUUsSUFBSSxJQUFJLEdBQUcsS0FBSTtBQUNqQjtBQUNBLEVBQUUsSUFBSSxPQUFPLFFBQVEsSUFBSSxVQUFVO0FBQ25DLElBQUksTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQztBQUMxRDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTTtBQUNqQixJQUFJLE9BQU8sUUFBUSxDQUFDLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7QUFDaEUsRUFBRSxJQUFJLElBQUksQ0FBQyxRQUFRO0FBQ25CLElBQUksT0FBTyxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMseURBQXlELENBQUMsQ0FBQztBQUN6RjtBQUNBLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFJO0FB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VyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUU7QUFDbEMsRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDaEIsSUFBSSxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUM7QUFDekMsSUFBSSxHQUFHLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFO0FBQ3RCLEdBQUc7QUFDSCxFQUFFLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUM7QUFDckMsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFO0FBQ3BCLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ2pCLElBQUksT0FBTyxXQUFXLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDekMsR0FBRztBQUNILENBQUM7QUFDRDtBQUNBO0FBQ0EsU0FBUyxXQUFXLENBQUMsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0FBQy9DLEVBQUUsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFDO0FBQy9CLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ2IsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDbEIsTUFBTSxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBQztBQUN4RCxNQUFNLEdBQUcsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLEVBQUU7QUFDeEIsS0FBSztBQUNMLElBQUksSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBQztBQUN2QyxJQUFJLEdBQUcsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLEVBQUU7QUFDdEIsR0FB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QyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFDdEYsS0FBSyxNQUFNO0FBQ1gsTUFBTSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFDckYsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFDO0FBQzdCO0FBQ0E7QUFDQTtBQUNBLEVBQUUsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUU7QUFDeEI7QUFDQTtBQUNBO0FBQ0EsSUFBSSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsT0FBTTtBQUM3QixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSTtBQUNkLElBQUksTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFO0FBQ25CLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUM7QUFDcEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQUs7QUFDakIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBQztBQUMzQixJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBQztBQUNoRixJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxJQUFHO0FBQy9CLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLE1BQUs7QUFDbkM7QUFDQTtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQzlDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUM7QUFDbkIsTUFBTSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFDckYsS0FBSztBQUNMLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBQztBQUN4QyxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFDO0FBQzdCLEVBQUUsR0FBRyxDQUFDLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRTtBQUN2QjtBQUNBO0FBQ0EsSUFBSSxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUM7QUFDbkMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFO0FBQ3JCLE1BQU0sQ0FBQyxDQUFDLElBQUksR0FBRyxLQUFJO0FBQ25CLEtBQUssTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxFQUFFO0FBQzdCLE1BQU0sQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFJO0FBQ3BCLEtBQUs7QUFDTCxJQUFJLE1BQU0sQ0FBQyxHQUFHLEdBQUU7QUFDaEIsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtBQUN2QyxNQUFNLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUU7QUFDeEIsS0FBSztBQUNMLElBQUksT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDMUQsR0FBRyxNQUFNO0FBQ1QsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRTtBQUMxQjtBQUNBO0FBQ0EsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUU7QUFDakIsUUFBUSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUM7QUFDM0IsT0FBTyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRTtBQUN6QixRQUFRLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBQztBQUM1QixPQUFPO0FBQ1A7QUFDQSxNQUFNLENBQUMsQ0FBQyxNQUFNLEdBQUcsTUFBSztBQUN0QixNQUFNLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtBQUMzQyxRQUFRLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUU7QUFDMUIsT0FBTztBQUNQLE1BQU0sT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFD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QkFBMEIsQ0FBQztBQUMvQyxHQUFHO0FBQ0gsRUFBRSxJQUFJLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFDO0FBQ3RDLEVBQUUsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFDO0FBQy9CLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBQztBQUN6RixFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtBQUN2QyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFDO0FBQ2hCLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDOUIsTUFBTSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFDdEYsS0FBSyxNQUFNO0FBQ1gsTUFBTSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFDckYsS0FBSztBQUNMLEdBQUc7QUFDSCxFQUFFLE9BQU8sSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hELEVBQUM7QUFDRDtBQUNBO0FBQ0EsTUFBTSxDQUFDLElBQUksR0FBRyxXQUFXO0FBQ3pCLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU07QUFDekIsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ3pCLElBQUksTUFBTTtBQUNWLEdBQUc7QUFDSCxFQUFFLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBQztBQUMvQixFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRTtBQUNiLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFJO0FBQ2QsSUFBSSxNQUFNLENBQUMsRUFBRTtBQUNiLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUM7QUFDbkIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQUs7QUFDakIsS0FBSztBQUNMLEdBQUcsTUFBTTtBQUNULElBQUksS0FBSyxDQUFDLEdBQUcsR0FBRTtBQUNmLElBQUksTUFBTSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFO0FBQ2hFLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBQztBQUMvQixNQUFNLEtBQUssQ0FBQyxHQUFHLEdBQUU7QUFDakIsS0FBSztBQUNMLEdBQUc7QUFDSCxFQUFDO0FBQ0Q7QUFDQTtBQUNBLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRTtBQUN6QyxFQUFFLEdBQUcsRUFBRSxXQUFXO0FBQ2xCLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU07QUFDM0IsSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzNCLE1BQU0sT0FBTyxLQUFLO0FBQ2xCLEtBQUs7QUFDTCxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFO0FBQ25DLE1BQU0sT0FBTyxJQUFJO0FBQ2pCLEtBQUs7QUFDTCxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtBQUN4QyxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ3hDLFFBQVEsT0FBTyxJQUFJO0FBQ25CLE9BQU87QUFDUCxLQUFLO0FBQ0wsSUFBSSxPQUFPLEtBQUs7QUFDaEIsR0FBRztBQUNILENBQUMsRUFBQztBQUNGO0FBQ0E7QUFDQSxTQUFTLGNBQWMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQzlCLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ1osSUFBSSxPQUFPLENBQUMsQ0FBQztBQUNiLEdBQUc7QUFDSCxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUNaLElBQUksT0FBTyxDQUFDO0FBQ1osR0FBRztBQUNILEVBQUUsT0FBTyxDQUFDO0FBQ1YsQ0FBQztBQUNEO0FBQ0E7QUFDQSxTQUFTLFlBQVksQ0FBQyxPQUFPLEVBQUU7QUFDL0IsRUFBRSxPQUFPLElBQUksWUFBWSxDQUFDLE9BQU8sSUFBSSxjQUFjLEVBQUUsSUFBSSxDQUFDO0FBQzFEOzs7Ozs7O0NDbCtCQSxJQUFJQyxRQUFNLEdBQUdOLE9BQWlCO0FBQzlCLENBQUEsSUFBSSxNQUFNLEdBQUdNLFFBQU0sQ0FBQyxPQUFNO0FBQzFCO0FBQ0E7QUFDQSxDQUFBLFNBQVMsU0FBUyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUU7QUFDOUIsR0FBRSxLQUFLLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRTtLQUNuQixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBQztJQUNwQjtFQUNGO0FBQ0QsQ0FBQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQyxlQUFlLEVBQUU7QUFDakYsR0FBRSxpQkFBaUJBLFNBQU07QUFDekIsRUFBQyxNQUFNO0FBQ1A7QUFDQSxHQUFFLFNBQVMsQ0FBQ0EsUUFBTSxFQUFFLE9BQU8sRUFBQztBQUM1QixHQUFFLGlCQUFpQixXQUFVO0VBQzVCO0FBQ0Q7QUFDQSxDQUFBLFNBQVMsVUFBVSxFQUFFLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUU7R0FDbEQsT0FBTyxNQUFNLENBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sQ0FBQztFQUM3QztBQUNEO0FBQ0E7QUFDQSxDQUFBLFNBQVMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFDO0FBQzdCO0NBQ0EsVUFBVSxDQUFDLElBQUksR0FBRyxVQUFVLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUU7QUFDM0QsR0FBRSxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRTtBQUMvQixLQUFJLE1BQU0sSUFBSSxTQUFTLENBQUMsK0JBQStCLENBQUM7SUFDckQ7R0FDRCxPQUFPLE1BQU0sQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDO0dBQzdDO0FBQ0Q7Q0FDQSxVQUFVLENBQUMsS0FBSyxHQUFHLFVBQVUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDbkQsR0FBRSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRTtBQUNoQyxLQUFJLE1BQU0sSUFBSSxTQUFTLENBQUMsMkJBQTJCLENBQUM7SUFDakQ7QUFDSCxHQUFFLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEVBQUM7QUFDeEIsR0FBRSxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7QUFDMUIsS0FBSSxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRTtBQUN0QyxPQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBQztBQUM5QixNQUFLLE1BQU07QUFDWCxPQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO01BQ2Y7QUFDTCxJQUFHLE1BQU07QUFDVCxLQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFDO0lBQ1o7QUFDSCxHQUFFLE9BQU8sR0FBRztHQUNYO0FBQ0Q7QUFDQSxDQUFBLFVBQVUsQ0FBQyxXQUFXLEdBQUcsVUFBVSxJQUFJLEVBQUU7QUFDekMsR0FBRSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRTtBQUNoQyxLQUFJLE1BQU0sSUFBSSxTQUFTLENBQUMsMkJBQTJCLENBQUM7SUFDakQ7QUFDSCxHQUFFLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQztHQUNwQjtBQUNEO0FBQ0EsQ0FBQSxVQUFVLENBQUMsZUFBZSxHQUFHLFVBQVUsSUFBSSxFQUFFO0FBQzdDLEdBQUUsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDaEMsS0FBSSxNQUFNLElBQUksU0FBUyxDQUFDLDJCQUEyQixDQUFDO0lBQ2pEO0FBQ0gsR0FBRSxPQUFPQSxRQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztBQUNoQyxHQUFBOzs7Ozs7Ozs7OztBQzdEQSxDQUFBLGdCQUFjLEdBQUdOLHVCQUFBLEdBQUE7Ozs7QUNBakIsSUFBSSxRQUFRLEdBQUdBLHdCQUFtQjtBQUNsQyxJQUFJLGlCQUFpQixHQUFHQyxtQkFBNkIsQ0FBQyxrQkFBaUI7QUFDdkUsSUFBSSxnQkFBZ0IsR0FBR0EsbUJBQTZCLENBQUMsaUJBQWdCO0FBQ3JFLElBQUksSUFBSSxHQUFHQyxPQUFlO0FBQzFCLElBQUksU0FBUyxHQUFHRyxPQUFvQztBQUNwRCxJQUFJRSxRQUFNLEdBQUdDLGlCQUFzQixDQUFDLE9BQU07QUFDMUMsSUFBSSxXQUFXLEdBQUcsR0FBRTtBQUNwQjtBQUNBO0FBQ0E7QUFDQSxJQUFJLFlBQVksR0FBR0MsdUJBQXNCLEdBQUE7QUFDekM7QUFDQSxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUU7QUFDcEIsRUFBRSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQzNDLENBQUM7QUFDRDtBQUNBLFNBQVMsR0FBRyxFQUFFLEtBQUssRUFBRTtBQUNyQixFQUFFLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDNUMsQ0FBQztBQUNEO0FBQ0EsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFO0FBQ3BCLEVBQUUsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUMzQyxDQUFDO0FBQ0Q7QUFDQSxTQUFTLEdBQUcsRUFBRSxLQUFLLEVBQUU7QUFDckIsRUFBRSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQzVDLENBQUM7QUFDRDtBQUNBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUU7QUFDbkMsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBQztBQUNqQyxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQUs7QUFDN0I7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLFNBQVE7QUFDaEQ7QUFDQSxFQUFFLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBQztBQUNwQztBQUNBLEVBQUUsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxLQUFLLE1BQUs7QUFDbEQsRUFBRSxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLEtBQUssTUFBSztBQUN0RCxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQU87QUFDakMsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQU87QUFDekIsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUM7QUFDaEI7QUFDQSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFO0FBQ3RCLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxPQUFNO0FBQ3ZCLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBQztBQUMxQyxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUM7QUFDeEM7QUFDQSxJQUFJLElBQUksT0FBTyxJQUFJLENBQUMsTUFBTSxLQUFLLFdBQVcsRUFBRTtBQUM1QyxNQUFNLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQUs7QUFDN0IsS0FBSyxNQUFNLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2xELE1BQU0sSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUM7QUFDdkMsS0FBSyxNQUFNO0FBQ1gsTUFBTSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUN2QyxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtBQUNuQixNQUFNLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQzdDLFFBQVEsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFHO0FBQ3hCLE9BQU8sTUFBTTtBQUNiLFFBQVEsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFFO0FBQ3ZCLE9BQU87QUFDUCxLQUFLO0FBQ0wsR0FBRyxNQUFNO0FBQ1QsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLE9BQU07QUFDdkIsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFDO0FBQzFDLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBQztBQUN4QztBQUNBLElBQUksSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLEtBQUssV0FBVyxFQUFFO0FBQzVDLE1BQU0sSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBRztBQUMzQixLQUFLLE1BQU0sSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDbEQsTUFBTSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQztBQUN2QyxLQUFLLE1BQU07QUFDWCxNQUFNLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFDO0FBQ3ZDLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO0FBQ25CLE1BQU0sSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDN0MsUUFBUSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUc7QUFDeEIsT0FBTyxNQUFNO0FBQ2IsUUFBUSxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUU7QUFDdkIsT0FBTztBQUNQLEtBQUs7QUFDTCxHQUFHO0FBQ0gsQ0FBQztBQUNEO0FBQ0EsUUFBUSxDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsRUFBQztBQUN2QztBQUNBLFdBQVcsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFVBQVUsUUFBUSxFQUFFO0FBQ2xELEVBQUUsSUFBSSxJQUFHO0FBQ1QsRUFBRSxJQUFJLE1BQUs7QUFDWDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxPQUFPLFlBQVksQ0FBQyxRQUFRLENBQUM7QUFDaEUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsT0FBTyxZQUFZLENBQUMsUUFBUSxDQUFDO0FBQ3REO0FBQ0EsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFHO0FBQ3RCLEVBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBSztBQUMxQjtBQUNBLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsT0FBTyxZQUFZLENBQUMsUUFBUSxDQUFDO0FBQ3JEO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsR0FBRyxHQUFHRixRQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBQztBQUM5QyxFQUFFLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxLQUFLLEdBQUdBLFFBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFDO0FBQ3BEO0FBQ0EsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRTtBQUMxQjtBQUNBLEVBQUUsWUFBWSxDQUFDLFNBQVMsUUFBUSxJQUFJO0FBQ3BDLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFDO0FBQzlCLEdBQUcsRUFBQztBQUNKLEVBQUM7QUFDRDtBQUNBLFdBQVcsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFlBQVk7QUFDMUMsRUFBRSxPQUFPLElBQUk7QUFDYixFQUFDO0FBQ0Q7QUFDQSxTQUFTLE9BQU8sRUFBRSxRQUFRLEVBQUU7QUFDNUIsRUFBRSxJQUFJLEVBQUUsSUFBSSxZQUFZLE9BQU8sQ0FBQyxFQUFFLE9BQU8sSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDO0FBQzlEO0FBQ0EsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sUUFBUSxLQUFLLFFBQVEsR0FBRyxRQUFRLEdBQUcsRUFBRSxFQUFDO0FBQzVFO0FBQ0EsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBTztBQUNoRSxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxXQUFXLEdBQUcsS0FBSTtBQUNsRCxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztBQUM3QixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFDO0FBQzFELENBQUM7QUFDRDtBQUNBLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRyxVQUFVLE1BQU0sRUFBRTtBQUM3QyxFQUFFLElBQUksTUFBTSxFQUFFO0FBQ2QsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUNwRCxNQUFNLE9BQU8sV0FBVyxDQUFDLEdBQUcsRUFBQztBQUM3QixLQUFLLEVBQUM7QUFDTixHQUFHLE1BQU07QUFDVCxJQUFJLFdBQVcsR0FBRyxHQUFFO0FBQ3BCLEdBQUc7QUFDSCxFQUFDO0FBQ0Q7QUFDQSxRQUFRLENBQUMsT0FBTyxFQUFFLGlCQUFpQixFQUFDO0FBQ3BDO0FBQ0EsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxPQUFPLEVBQUUsUUFBUSxFQUFFO0FBQ3ZELEVBQUUsSUFBSSxJQUFJLEdBQUcsS0FBSTtBQUNqQixFQUFFLFlBQVksQ0FBQyxTQUFTLFFBQVEsSUFBSTtBQUNwQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFDO0FBQ3hCLEdBQUcsRUFBQztBQUNKLEVBQUM7QUFDRDtBQUNBLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFO0FBQ2xFLEVBQUUsSUFBSSxPQUFPLEtBQUssS0FBSyxXQUFXLElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxLQUFLLEdBQUcsR0FBRTtBQUNoRTtBQUNBLEVBQUUsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBQztBQUNsRDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ2xCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7QUFDcEQsR0FBRyxNQUFNO0FBQ1QsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBQztBQUNoRixHQUFHO0FBQ0g7QUFDQSxFQUFFLFlBQVksQ0FBQyxRQUFRLEVBQUM7QUFDeEIsRUFBQztBQUNEO0FBQ0EsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsVUFBVSxHQUFHLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRTtBQUMzRCxFQUFFLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUM7QUFDbEQ7QUFDQSxFQUFFLElBQUksT0FBTyxLQUFLLEtBQUssV0FBVyxFQUFFO0FBQ3BDO0FBQ0EsSUFBSSxPQUFPLFlBQVksQ0FBQyxTQUFTLFFBQVEsSUFBSTtBQUM3QyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBQztBQUNyQyxLQUFLLENBQUM7QUFDTixHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQzVELElBQUksS0FBSyxHQUFHQSxRQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBQztBQUN0QyxHQUFHO0FBQ0g7QUFDQSxFQUFFLFlBQVksQ0FBQyxTQUFTLFFBQVEsSUFBSTtBQUNwQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFDO0FBQ3pCLEdBQUcsRUFBQztBQUNKLEVBQUM7QUFDRDtBQUNBLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsR0FBRyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUU7QUFDM0QsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFDO0FBQ3ZFLEVBQUUsWUFBWSxDQUFDLFFBQVEsRUFBQztBQUN4QixFQUFDO0FBQ0Q7QUFDQSxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxVQUFVLEtBQUssRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFO0FBQy9ELEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFDO0FBQ1osRUFBRSxJQUFJLElBQUc7QUFDVCxFQUFFLElBQUksTUFBSztBQUNYLEVBQUUsSUFBSSxLQUFJO0FBQ1YsRUFBRSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsT0FBTTtBQUN4QixFQUFFLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQztBQUN4QztBQUNBLEVBQUUsT0FBTyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFDcEIsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVE7QUFDM0I7QUFDQSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFDO0FBQzVFLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFDO0FBQ3pCO0FBQ0EsSUFBSSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssS0FBSyxFQUFFO0FBQ2pDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUM1QyxVQUFVLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLO0FBQ3hCLFVBQVUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUM7QUFDaEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBQztBQUN0RSxLQUFLLE1BQU07QUFDWCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFFO0FBQzFCLEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEtBQUk7QUFDcEM7QUFDQSxFQUFFLFlBQVksQ0FBQyxRQUFRLEVBQUM7QUFDeEIsRUFBQztBQUNEO0FBQ0EsT0FBTyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsVUFBVSxPQUFPLEVBQUU7QUFDakQsRUFBRSxPQUFPLElBQUksV0FBVyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUM7QUFDdkMsRUFBQztBQUNEO0FBQ0EsT0FBTyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsVUFBVSxHQUFHLEVBQUU7QUFDN0MsRUFBRSxPQUFPQSxRQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQztBQUM3QixFQUFDO0FBQ0Q7QUFDQSxPQUFPLENBQUMsT0FBTyxHQUFHLFVBQVUsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUM1QyxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxLQUFJO0FBQ3RCO0FBQ0EsRUFBRSxJQUFJLEdBQUcsSUFBSSxXQUFXLEVBQUU7QUFDMUIsSUFBSSxPQUFPLFdBQVcsQ0FBQyxHQUFHLEVBQUM7QUFDM0IsR0FBRztBQUNIO0FBQ0EsRUFBRSxZQUFZLENBQUMsUUFBUSxFQUFDO0FBQ3hCLEVBQUM7QUFDRDtBQUNBLElBQUEsT0FBYyxHQUFHLE9BQU8sQ0FBQyxPQUFPLEdBQUcsUUFBQTs7OztBQy9ObkMsU0FBUyxZQUFZLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUN0QyxFQUFFLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDNUIsSUFBSSxFQUFFLEVBQUVHLFNBQU87QUFDZixHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDWDtBQUNBLEVBQUVDLFVBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBQ0Q7QUFDQTtBQUNBLFlBQVksQ0FBQyxLQUFLLEdBQUcsWUFBWTtBQUNqQyxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyxDQUFDO0FBQ0YsWUFBWSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDaEM7QUFDZSxjQUFRLEVBQUUsT0FBTyxFQUFFO0FBQ2xDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2hEOzs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDEsMiwzLDQsNSw2LDcsOF19
