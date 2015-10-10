'use strict';

var options = require('./options');

// generate a nice short hext code for the given option
module.exports = function generateName(combo) {
  var str = '';
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    str += combo.indexOf(option) === -1 ? '0' : '1';
  }
  // binary -> hex
  return parseInt(str, 2).toString(16);
};