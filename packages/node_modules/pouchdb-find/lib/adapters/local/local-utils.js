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

module.exports = {
  getKey: getKey,
  getValue: getValue,
  getSize: getSize
};