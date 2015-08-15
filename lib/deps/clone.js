'use strict';

function isPlainObject(object) {
  // dead-simple "is this a straight-up object" test, taken
  // from pouchdb-extend ala jQuery 1.9.0
  // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.

  if (typeof object.hasOwnProperty !== 'function') {
    return false;
  }

  var key;
  for (key in object) {}
  return key === undefined || object.hasOwnProperty(key);
}

module.exports = function clone(object) {
  var newObject;
  var i;
  var len;

  if (!object || typeof object !== 'object') {
    return object;
  }

  if (Array.isArray(object)) {
    newObject = [];
    for (i = 0, len = object.length; i < len; i++) {
      newObject[i] = clone(object[i]);
    }
    return newObject;
  }

  // special case: to avoid inconsistencies between IndexedDB
  // and other backends, we automatically stringify Dates
  if (object instanceof Date) {
    return object.toISOString();
  }

  if (!isPlainObject(object)) {
    return object;
  }

  newObject = {};
  for (i in object) {
    if (object.hasOwnProperty(i)) {
      var value = clone(object[i]);
      if (typeof value !== 'undefined') {
        newObject[i] = value;
      }
    }
  }
  return newObject;
};