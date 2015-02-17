'use strict';

var utils = require('../../utils');
var callbackify = utils.callbackify;

exports.createIndex = callbackify(require('./create-index'));
exports.find = callbackify(require('./find'));
exports.getIndexes = callbackify(require('./get-indexes'));
exports.deleteIndex = callbackify(require('./delete-index'));