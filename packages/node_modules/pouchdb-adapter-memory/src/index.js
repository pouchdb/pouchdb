import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';


import memdown from 'memdown';

function MemDownPouch(opts, callback) {
  var _opts = Object.assign({
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
