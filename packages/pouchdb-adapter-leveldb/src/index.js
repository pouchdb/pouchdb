import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';
import { extend } from 'js-extend';
import requireLeveldown from './requireLeveldown';

var leveldown = requireLeveldown();

function LevelDownPouch(opts, callback) {

  /* istanbul ignore if */
  if (leveldown instanceof Error) {
    return callback(leveldown);
  }

  var _opts = extend({
    db: leveldown,
    migrate: true
  }, opts);

  CoreLevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
LevelDownPouch.valid = function () {
  return true;
};
LevelDownPouch.use_prefix = false;

export default function (PouchDB) {
  PouchDB.adapter('leveldb', LevelDownPouch, true);
}