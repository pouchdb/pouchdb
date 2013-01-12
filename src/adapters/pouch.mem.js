/*
 * in-memory pouchdb storage adapter
 *
 * John Chesley <john@chesl.es>
 * December 2012
 */

if (typeof module !== 'undefined' && module.exports) {
  var pouchdir = '../'
    , Pouch = require(pouchdir + 'pouch.js')
    , PouchAdapter = require(pouchdir + 'pouch.adapter.js')

  require(pouchdir + 'deps/uuid.js');

  var call = Pouch.utils.call;

  module.exports = MemPouch;
}

// global cache of stores so that opening the same db twice uses the same objects
var STORES = {}

function MemPouch(opts) {
  if (!this instanceof MemPouch)
    return new MemPouch(opts);

  this.name = opts.name;
  this.stores = STORES[this.name] || {max_seq:0, meta: {}, byseq: [], attachments: {}}

  if (!(this.name in STORES)) {
    STORES[this.name] = this.stores;
  }
}


MemPouch.prototype = {
  id: function() {
    return this.name;
  },
  type: function() {
    return 'mem';
  },
  init: function(callback) {
    call(callback, null);
  },
  getMetadata: function(id, callback) {
    if (id in this.stores.meta) {
      call(callback, null, JSON.parse(this.stores.meta[id]));
    }
    else {
      call(callback, new Error('no metadata found:'+id));
    }
  },
  getBulkMetadata: function(opts, callback) {
    var results = []
      , ids = [];
    Object.keys(this.stores.meta).forEach(function(key) {
      // skip keys that are outside of the requested range
      if ((opts.startkey && key < opts.startkey)
        || (opts.endkey && key > opts.endkey)) {
          return;
      }
      ids.push(key);
    });
    ids.sort();
    for(var i=0; i<ids.length; i++) {
      results.push(JSON.parse(this.stores.meta[ids[i]]));
    }
    call(callback, null, results);
  },
  writeMetadata: function(id, meta, callback) {
    this.stores.meta[id] = JSON.stringify(meta);
    call(callback, null);
  },
  getUpdateSeq: function(callback) {
    call(callback, null, this.stores.max_seq);
  },
  getSequence: function(seq, callback) {
    if (seq in this.stores.byseq) {
      call(callback, null, JSON.parse(this.stores.byseq[seq]));
    }
    else {
      call(callback, new Error('sequence not found:'+seq));
    }
  },
  getBulkSequence: function(opts, callback) {
    var seqs = this.stores.byseq.slice(opts.since + 1);
    if (opts.descending) {
      seqs.reverse();
    }
    call(callback, null, seqs.map(JSON.parse));
  },
  writeSequence: function(seq, doc, callback) {
    if (seq > this.stores.max_seq) {
      this.stores.max_seq = seq;
    }
    this.stores.byseq[seq] = JSON.stringify(doc);
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
  call(callback, null);
}

Pouch.adapter('mem', mempouch);
