'use strict';

function getKey(obj) {
  return Object.keys(obj)[0];
}

function getValue(obj) {
  return obj[getKey(obj)];
}

function getSize(obj) {
  return Object.keys(obj).length;
}

// normalize the "sort" value
function massageSort(sort) {
  return sort && sort.map(function (sorting) {
    if (typeof sorting === 'string') {
      var obj = {};
      obj[sorting] = 'asc';
      return obj;
    } else {
      return sorting;
    }
  });
}

module.exports = {
  getKey: getKey,
  getValue: getValue,
  getSize: getSize,
  massageSort: massageSort
};