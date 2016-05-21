import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';
import { extend } from 'js-extend';

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

export default function (PouchDB) {
  PouchDB.adapter('memory', MemDownPouch, true);
}