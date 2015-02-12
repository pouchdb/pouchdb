'use strict';

var LevelPouch = require('../adapters/leveldb/leveldb');
var utils = require('../utils');
module.exports = altFactory;
function altFactory(adapterConfig) {
  var leveldown = require(adapterConfig.require);

  function LevelPouchAlt(opts, callback) {
    var _opts = utils.extend({
      db: leveldown
    }, opts);

    LevelPouch.call(this, _opts, callback);
  }

  // overrides for normal LevelDB behavior on Node
  LevelPouchAlt.valid = function () {
    return adapterConfig.valid();
  };
  LevelPouchAlt.use_prefix = adapterConfig.use_prefix;

  LevelPouchAlt.destroy = utils.toPromise(function (name, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    var _opts = utils.extend({
      db: leveldown
    }, opts);

    return LevelPouch.destroy(name, _opts, callback);
  });
  return LevelPouchAlt;

}
