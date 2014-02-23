"use strict";

var PouchDB = require("./constructor");
var utils = require('./utils');
PouchDB.adapters = {};
PouchDB.plugins = {};

PouchDB.prefix = '_pouch_';

PouchDB.parseAdapter = function (name) {
  var match = name.match(/([a-z\-]*):\/\/(.*)/);
  var adapter;
  if (match) {
    // the http adapter expects the fully qualified name
    name = /http(s?)/.test(match[1]) ? match[1] + '://' + match[2] : match[2];
    adapter = match[1];
    if (!PouchDB.adapters[adapter].valid()) {
      throw 'Invalid adapter';
    }
    return {name: name, adapter: match[1]};
  }

  var preferredAdapters = ['idb', 'leveldb', 'websql'];
  for (var i = 0; i < preferredAdapters.length; ++i) {
    if (preferredAdapters[i] in PouchDB.adapters) {
      adapter = PouchDB.adapters[preferredAdapters[i]];
      var use_prefix = 'use_prefix' in adapter ? adapter.use_prefix : true;

      return {
        name: use_prefix ? PouchDB.prefix + name : name,
        adapter: preferredAdapters[i]
      };
    }
  }

  throw 'No valid adapter found';
};

PouchDB.destroy = utils.toPromise(function (name, opts, callback) {
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (typeof name === 'object') {
    opts = name;
    name = undefined;
  }

  var backend = PouchDB.parseAdapter(opts.name || name);
  var dbName = backend.name;

  for (var plugin in PouchDB.plugins) {
    if (PouchDB.plugins.hasOwnProperty(plugin)) {
      PouchDB.plugins[plugin]._delete(dbName);
    }
  }

  // call destroy method of the particular adaptor
  PouchDB.adapters[backend.adapter].destroy(dbName, opts, callback);
});

PouchDB.adapter = function (id, obj) {
  if (obj.valid()) {
    PouchDB.adapters[id] = obj;
  }
};

PouchDB.plugin = function (id, obj) {
  PouchDB.plugins[id] = obj;
};

module.exports = PouchDB;
