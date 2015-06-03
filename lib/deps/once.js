'use strict';

var getArguments = require('argsarray');

function once(fun) {
  var called = false;
  return getArguments(function (args) {
    if (called) {
      throw new Error('once called more than once');
    } else {
      called = true;
      fun.apply(this, args);
    }
  });
}

module.exports = once;