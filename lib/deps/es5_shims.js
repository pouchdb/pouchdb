// some small shims for es5 just for the features we commonly use
// some of this is copied from 
// https://github.com/kriskowal/es5-shim/blob/master/es5-shim.js
'use strict';

if (!Object.keys) {
  Object.keys = function keys(object) {

    if ((typeof object !== 'object' &&
         typeof object !== 'function') ||
         object === null) {
      throw new TypeError('Object.keys called on a non-object');
    }

    var mykeys = [];
    for (var name in object) {
      if (Object.prototype.hasOwnProperty.call(object, name)) {
        mykeys.push(name);
      }
    }
    return mykeys;
  };
}

if (!Array.isArray) {
  Array.isArray = function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
  };
}

if (!('forEach' in Array.prototype)) {
  Array.prototype.forEach = function (action, that /*opt*/) {
    for (var i = 0, n = this.length; i < n; i++) {
      if (i in this) {
        action.call(that, this[i], i, this);
      }
    }
  };
}

if (!('map' in Array.prototype)) {
  Array.prototype.map = function (mapper, that /*opt*/) {
    var other = new Array(this.length);
    for (var i = 0, n = this.length; i < n; i++) {
      if (i in this) {
        other[i] = mapper.call(that, this[i], i, this);
      }
    }
    return other;
  };
}
