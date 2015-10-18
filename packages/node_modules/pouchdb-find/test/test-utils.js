'use strict';

exports.sortById = function sortById(left, right) {
  return left._id < right._id ? -1 : 1;
};

var chai = require('chai');
chai.use(require("chai-as-promised"));

exports.should = chai.should();
var Promise = require('bluebird');
exports.Promise = Promise;

exports.fin = function (promise, cb) {
  return promise.then(function (res) {
    var promise2 = cb();
    if (typeof promise2.then === 'function') {
      return promise2.then(function () {
        return res;
      });
    }
    return res;
  }, function (reason) {
    var promise2 = cb();
    if (typeof promise2.then === 'function') {
      return promise2.then(function () {
        throw reason;
      });
    }
    throw reason;
  });
};

exports.promisify = function (fun, context) {
  return function() {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }
    return new Promise(function (resolve, reject) {
      args.push(function (err, res) {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
      fun.apply(context, args);
    });
  };
};