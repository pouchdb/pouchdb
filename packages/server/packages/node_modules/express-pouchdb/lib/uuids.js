"use strict";

var uuid = require('uuid/v4');

module.exports = function generate(limit) {
  var output = [];
  var i = -1;
  while (++i < limit) {
    output.push(uuid());
  }
  return output;
};
