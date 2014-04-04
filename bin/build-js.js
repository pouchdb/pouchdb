#!/usr/bin/env node
'use strict';

var backend = process.env.LEVEL_BACKEND;
var browserify = require('browserify');
var outName = 'dist/pouchdb-' + backend + '.js';
var fs = require('fs');
var b = browserify('./lib/index-levelalt.js');
b.ignore('requrest');
b.require('level-js', {
  expose: 'leveldown'
});

var out = fs.createWriteStream(outName);
b.bundle({standalone: 'PouchDB'}).pipe(out);