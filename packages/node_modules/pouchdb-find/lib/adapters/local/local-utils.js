'use strict';

var utils = require('../../utils');

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

function massageSelector(selector) {
  var result = utils.clone(selector);
  if ('$and' in result) {
    result = utils.mergeObjects(result.$and);
  }
  return result;
}

module.exports = {
  getKey: getKey,
  getValue: getValue,
  getSize: getSize,
  massageSort: massageSort,
  massageSelector: massageSelector
};