#!/usr/bin/env node
'use strict';
var version = require('../package.json').version;
var fs = require('fs');
var file =  'module.exports = "' + version + '";\n';
fs.writeFileSync('./lib/version-browser.js', file, {
  encoding: 'utf8'
});
