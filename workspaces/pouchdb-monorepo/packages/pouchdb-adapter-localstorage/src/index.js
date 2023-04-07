import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';
import localstoragedown from 'localstorage-down';

function LocalStoragePouch(opts, callback) {
  var _opts = Object.assign({
    db: localstoragedown
  }, opts);

  CoreLevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
LocalStoragePouch.valid = function () {
  return typeof localStorage !== 'undefined';
};
LocalStoragePouch.use_prefix = true;

export default function (PouchDB) {
  PouchDB.adapter('localstorage', LocalStoragePouch, true);
}