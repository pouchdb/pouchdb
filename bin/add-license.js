#!/usr/bin/env node

// prepend a license to the beginning of all the output files

'use strict';

var version = require('../package.json').version;
var fs = require('fs');
var currentYear = new Date().getFullYear();

/* jshint maxlen:100 */
var comments = {

  'pouchdb': 'PouchDB ' + version +
    '\n' +
    '\n(c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
    '\nPouchDB may be freely distributed under the Apache license, version 2.0.' +
    '\nFor all details and documentation:' +
    '\nhttp://pouchdb.com',

  'pouchdb.idb-alt': 'PouchDB alternative IndexedDB plugin ' + version +
    '\nBased on level.js: https://github.com/maxogden/level.js' +
    '\n' +
    '\n(c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
    '\nPouchDB may be freely distributed under the Apache license, version 2.0.' +
    '\nFor all details and documentation:' +
    '\nhttp://pouchdb.com',

  'pouchdb.memory': 'PouchDB in-memory plugin ' + version +
    '\nBased on MemDOWN: https://github.com/rvagg/memdown' +
    '\n' +
    '\n(c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
    '\nPouchDB may be freely distributed under the Apache license, version 2.0.' +
    '\nFor all details and documentation:' +
    '\nhttp://pouchdb.com',

  'pouchdb.localstorage': 'PouchDB localStorage plugin ' + version +
    '\nBased on localstorage-down: https://github.com/No9/localstorage-down' +
    '\n' +
    '\n(c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
    '\nPouchDB may be freely distributed under the Apache license, version 2.0.' +
    '\nFor all details and documentation:' +
    '\nhttp://pouchdb.com'
};

Object.keys(comments).forEach(function (name) {
  var comment = comments[name];
  comment = comment.replace(/(^|\n)/g, '$1//    ');

  var filenames = [name + '.js', name + '.min.js'];

  filenames.forEach(function (filename) {
    filename = './dist/' + filename;
    var contents = fs.readFileSync(filename);
    contents = comment + '\n' + contents;

    fs.writeFileSync(filename, contents);
  });
});



