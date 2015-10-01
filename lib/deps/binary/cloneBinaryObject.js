'use strict';

module.exports = function cloneBinaryObject(object) {
  var copy = new Buffer(object.length);
  object.copy(copy);
  return copy;
};