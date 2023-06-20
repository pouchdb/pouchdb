#!/usr/bin/env node

// Build all modules in the packages/ folder

var path = require('path');
var denodeify = require('denodeify');
var fs = require('node:fs');
const fsPromises = fs.promises;
var readDir = denodeify(fs.readdir);

var buildModule = require('./build-module');
var buildPouchDB = require('./build-pouchdb');

readDir('packages').then(function (packages) {
  console.log(packages);
  return Promise.all(packages.map(async (pkg) => {
    const isDir = pkg !== 'server' && 
    pkg.startsWith('pouchdb') && 
    (await fsPromises.stat(path.resolve('packages', pkg))).isDirectory();
    isDir && console.log('Building ' + pkg + '...');
    return isDir && pkg === 'pouchdb' ? buildPouchDB() : buildModule(path.resolve('./packages', pkg));
    
  })).catch(function (err) {
    console.error('build error');
    console.error(err.stack);
    process.exit(1);
  });
});
