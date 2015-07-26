'use strict';

var getArguments = require('argsarray');

// Pretty dumb name for a function, just wraps callback calls so we dont
// to if (callback) callback() everywhere
module.exports = getArguments(function (args) {
  var fun = args.shift();
  fun.apply(this, args);
});