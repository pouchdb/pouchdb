'use strict';

module.exports = function isBinaryObject(object) {
  return object instanceof Buffer;
};