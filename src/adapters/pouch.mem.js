/*
 * in-memory pouchdb storage adapter
 *
 * John Chesley <john@chesl.es>
 * December 2012
 */

var pouchdir = '../'
  , Pouch = require(pouchdir + 'pouch.js')
  , PouchAdapter = require(pouchdir + 'pouch.adapter.js')

require(pouchdir + 'deps/uuid.js');

var call = Pouch.utils.call;

var EventEmitter = require('events').EventEmitter

// global cache of stores and change EventEmitter objects so opening the same
// db twice uses the same objects
var STORES = {}
  , CHANGES = {}

function MemPouch(opts) {
  if (!this instanceof MemPouch)
    return new MemPouch(opts, callback);

  this.name = opts.name;
  this.stores = STORES[this.name] || {meta: {}, byseq: [], attachments: {}}
  this.changeEmitter = CHANGES[this.name] || new EventEmitter();

  if (!(this.name in STORES)) {
    STORES[this.name] = this.stores;
  }
  if (!(this.name in CHANGES)) {
    CHANGES[this.name] = this.changeEmitter;
  }
}

module.exports = MemPouch;

MemPouch.prototype = {
  init: function(callback) {
    call(callback, null);
  },
  getMetadata: function(id, callback) {
    if (id in this.stores.meta) {
      call(callback, null, this.stores.meta[id])
    }
    else {
      call(callback, new Error('no metadata found:'+id));
    }
  },
  writeMetadata: function(id, meta, callback) {
    this.stores.meta[id] = meta;
    call(callback, null);
  },
  getSequence: function(seq, callback) {
    if (seq in this.stores.byseq) {
      call(callback, null, this.stores.byseq[seq]);
    }
    else {
      call(callback, new Error('sequence not found:'+seq));
    }
  },
  writeSequence: function(seq, doc, callback) {
    this.stores.byseq[seq] = doc;
    call(callback, null);
  },
  getAttachment: function(digest, callback) {
    if (digest in this.stores.attachments) {
      call(callback, null, this.stores.attachments[digest])
    }
    else {
      call(callback, new Error('attachment not found:'+digest));
    }
  },
  writeAttachment: function(digest, attachment, callback) {
    this.stores.attachments[digest] = attachment;
    call(callback, null);
  },
  getDocCount: function(callback) {
  }
}

var mempouch = function(opts, callback) {
  var backend = new MemPouch(opts)
    , adapter = PouchAdapter(backend)

  adapter.open(function(err) {
    call(callback, err, adapter);
  });

  return adapter;
}

mempouch.valid = function() {
  return true;
}
mempouch.destroy = function(name, callback) {
  delete STORES[name];
  delete CHANGES[name];
  call(callback, null);
}

Pouch.adapter('mem', mempouch);
