import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';
import { toPromise } from 'pouchdb-utils';
import { extend as extend } from 'js-extend';

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

FruitDownPouch.destroy = toPromise(function (name, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  var _opts = extend({
    db: fruitdown
  }, opts);

  return fruitdown.destroy(name, _opts, callback);
});
export default function (PouchDB) {
  PouchDB.adapter('fruitdown', FruitDownPouch, true);
}