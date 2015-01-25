'use strict';

exports.sortById = function sortById(left, right) {
  return left._id < right._id ? -1 : 1;
};

var chai = require('chai');
chai.use(require("chai-as-promised"));

exports.should = chai.should();
exports.Promise = require('bluebird');
