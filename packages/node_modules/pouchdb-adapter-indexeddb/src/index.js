'use strict';

import { changesHandler } from 'pouchdb-utils';

import setup from './setup';

// API implementations
import info from './info';
import get from './get';
import getAttachment from './getAttachment';
import bulkDocs from './bulkDocs';
import allDocs from './allDocs';
import changes from './changes';
import getRevisionTree from './getRevisionTree';
import doCompaction from './doCompaction';
import destroy from './destroy';

var ADAPTER_NAME = 'indexeddb';

// TODO: Constructor should be capitalised
var idbChanges = new changesHandler();

// A shared list of database handles
var openDatabases = {};

function IdbPouch(dbOpts, callback) {

  var api = this;
  var metadata = {};

  // This is a wrapper function for any methods that need an
  // active database handle it will recall itself but with
  // the database handle as the first argument
  var $ = function (fun) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      setup(openDatabases, api, dbOpts).then(function (res) {
        metadata = res.metadata;
        args.unshift(res.idb);
        fun.apply(api, args);
      });
    };
  };

  api.type = function () { return ADAPTER_NAME; };

  api._id = $(function (idb, cb) {
    cb(null, metadata.db_uuid);
  });

  api._info = $(function (idb, cb) {
    return info(idb, metadata, cb);
  });

  api._get = $(get);

  api._bulkDocs = $(function (idb, req, opts, callback) {
    return bulkDocs(idb, req, opts, metadata, dbOpts, idbChanges, callback);
  });

  api._allDocs = $(function (idb, opts, cb) {
    return allDocs(idb, metadata, opts, cb);
  });

  api._getAttachment = $(function (idb, docId, attachId, attachment, opts, cb) {
    return getAttachment(idb, docId, attachId, opts, cb);
  });

  api._changes = $(function (idb, opts) {
    return changes(idb, idbChanges, api, dbOpts, opts);
  });

  api._getRevisionTree = $(getRevisionTree);
  api._doCompaction = $(doCompaction);

  api._destroy = function (opts, callback) {
    return destroy(dbOpts, openDatabases, idbChanges, callback);
  };

  api._close = $(function (db, cb) {
    delete openDatabases[dbOpts.name];
    db.close();
    cb();
  });

  // TODO: this setTimeout seems nasty, if its needed lets
  // figure out / explain why
  setTimeout(function () {
    callback(null, api);
  });
}

// TODO: this isnt really valid permanently, just being lazy to start
IdbPouch.valid = function () {
  return true;
};

export default function (PouchDB) {
  PouchDB.adapter(ADAPTER_NAME, IdbPouch, true);
}
