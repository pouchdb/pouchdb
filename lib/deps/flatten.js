'use strict';

// flatten an array of arrays, with optional non-arrays inside
module.exports = function flatten(arrays) {
  var res = [];
  arrays.forEach(function (array) {
    if (Array.isArray(array)) {
      res = res.concat(array);
    } else {
      res.push(array);
    }
  });
  return res;
};