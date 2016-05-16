import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';
import { toPromise } from 'pouchdb-utils';
import { extend as extend } from 'js-extend';

import memdown from 'memdown';

function MemDownPouch(opts, callback) {
  var _opts = extend({
    db: memdown
  }, opts);

  CoreLevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
MemDownPouch.valid = function () {
  return true;
};
MemDownPouch.use_prefix = false;

MemDownPouch.destroy = toPromise(function (name, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  var _opts = extend({
    db: memdown
  }, opts);

  return memdown.destroy(name, _opts, callback);
});
export default function (PouchDB) {
  PouchDB.adapter('memory', MemDownPouch, true);
}