import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';
import { extend } from 'js-extend';

import fruitdown from 'fruitdown';

function FruitDownPouch(opts, callback) {
  var _opts = extend({
    db: fruitdown
  }, opts);

  CoreLevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
FruitDownPouch.valid = function () {
  return !!global.indexedDB;
};
FruitDownPouch.use_prefix = true;

export default function (PouchDB) {
  PouchDB.adapter('fruitdown', FruitDownPouch, true);
}