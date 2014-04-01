'use strict';

var LevelPouch = require('./leveldb');
var levelalt = require('level-js');
var utils = require('../utils');

function LevelPouchAlt(opts, callback) {
  var _opts = utils.extend({
    db: levelalt
  }, opts);

  LevelPouch.call(this, _opts, callback);
}

LevelPouchAlt.valid = function () {
  return LevelPouch.valid();
};

module.exports = LevelPouchAlt;
