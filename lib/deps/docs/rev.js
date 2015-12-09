'use strict';

var uuid = require('./../uuid');
var crypto = require('crypto');

module.exports = function (doc) {
	var docJSON = JSON.stringify(doc);

	if (!doc._rev) {
		return uuid(32, 16).toLowerCase();
	}

	return crypto.createHash('md5').update(docJSON)
		.digest('base64').toLowerCase();
};