'use strict';

var request = require('request');

export default function (opts, callback) {
  var req = request(opts, callback);
  return {
    abort: function () {
      process.nextTick(function () {
        req.abort();
      });
    }
  };
}
