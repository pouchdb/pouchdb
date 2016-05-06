import CoreLevelPouch from '../adapters/leveldb/index';
import toPromise from '../deps/toPromise';
import { extend as extend } from 'js-extend';
import requireLeveldown from './requireLeveldown';

var leveldown = requireLeveldown();

function LevelDownPouch(opts, callback) {

  /* istanbul ignore if */
  if (leveldown instanceof Error) {
    return callback(leveldown);
  }

  var _opts = extend({
    db: leveldown
  }, opts);

  CoreLevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
LevelDownPouch.valid = function () {
  return true;
};
LevelDownPouch.use_prefix = false;

LevelDownPouch.destroy = toPromise(function (name, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  var _opts = extend({
    db: leveldown
  }, opts);

  return CoreLevelPouch.destroy(name, _opts, callback);
});
export default LevelDownPouch;