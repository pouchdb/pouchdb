(function () {
  'use strict';

  // shim for browsers that don't have these, like IE9
  var keys = [
    'ArrayBuffer',
    'DataView',
    'Float32Array',
    'Float64Array',
    'Int8Array',
    'Int16Array',
    'Int32Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Uint16Array',
    'Uint32Array'
  ];

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!(key in window)) {
      window[key] = TypedArrayShim[key];
    }
  }

})();
