import LevelPouch from '../adapters/leveldb/index';
import toPromise from '../deps/toPromise';
import { extend as extend } from 'js-extend';

function altFactory(adapterConfig, downAdapter) {

  function LevelPouchAlt(opts, callback) {
    var _opts = extend({
      db: downAdapter
    }, opts);

    LevelPouch.call(this, _opts, callback);
  }

  // overrides for normal LevelDB behavior on Node
  LevelPouchAlt.valid = function () {
    return adapterConfig.valid();
  };
  LevelPouchAlt.use_prefix = adapterConfig.use_prefix;

  LevelPouchAlt.destroy = toPromise(function (name, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    var _opts = extend({
      db: downAdapter
    }, opts);

    return LevelPouch.destroy(name, _opts, callback);
  });
  return LevelPouchAlt;
}

export default altFactory;