'use strict';

var uuid = require('./../uuid');
var Md5 = require('spark-md5');

module.exports = function (doc) {
	var docJSON = JSON.stringify(doc);

	if (!doc._rev) {
		return uuid(32, 16).toLowerCase();
	}
	return Md5.hash(docJSON);
};