"use strict"

/*
 * A generic pouch adapter
 */
var PouchAdapter = function(opts, callback) {
  var adapter = {};

  var adapter = Pouch.adapters[opts.adapter](opts, callback);

  adapter.replicate = {};

  adapter.replicate.from = function (url, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, adapter, opts, callback);
  };

  adapter.replicate.to = function (dbName, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(adapter, dbName, opts, callback);
  };

  return adapter;
};
