import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';
import { toPromise } from 'pouchdb-utils';
import { extend as extend } from 'js-extend';

import localstoragedown from 'localstorage-down';

function LocalStoragePouch(opts, callback) {
  var _opts = extend({
    db: localstoragedown
  }, opts);

  CoreLevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
LocalStoragePouch.valid = function () {
  return typeof localStorage !== 'undefined';
};
LocalStoragePouch.use_prefix = true;

LocalStoragePouch.destroy = toPromise(function (name, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  var _opts = extend({
    db: localstoragedown
  }, opts);

  return localstoragedown.destroy(name, _opts, callback);
});
export default LocalStoragePouch;