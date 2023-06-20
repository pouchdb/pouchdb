#!/usr/bin/env node

'use strict';

// build just the "pouchdb" package. This build script is different
// from the others due to legacy support (dist/, extras/, etc.).

var DEV_MODE = process.env.CLIENT === 'dev';

var path = require('node:path');
var denodeify = require('denodeify');
var rollup = require('rollup');
var rollupPlugins = require('./rollupPlugins');
var rimraf = denodeify(require('rimraf'));
var mkdirp = denodeify(require('mkdirp'));
var buildUtils = require('./build-utils');
var doUglify = buildUtils.doUglify;
var doBrowserify = buildUtils.doBrowserify;
var writeFile = buildUtils.writeFile;

var pkg = require('../packages/pouchdb/package.json');
var version = pkg.version;

var builtInModules = require('builtin-modules');
var external = Object.keys(require('../package.json').dependencies)
  .concat(builtInModules);

var plugins = ['indexeddb', 'localstorage', 'memory', 'find'];

var currentYear = new Date().getFullYear();

var comments = {
  'pouchdb': '// PouchDB ' + version +
  '\n// ' +
  '\n// (c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
  '\n// PouchDB may be freely distributed under the Apache license, ' +
  'version 2.0.' +
  '\n// For all details and documentation:' +
  '\n// http://pouchdb.com\n',

  'indexeddb': '// PouchDB indexeddb plugin ' + version + '\n',

  'memory': '// PouchDB in-memory plugin ' + version +
  '\n// Based on MemDOWN: https://github.com/rvagg/memdown' +
  '\n// ' +
  '\n// (c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
  '\n// PouchDB may be freely distributed under the Apache license, ' +
  'version 2.0.' +
  '\n// For all details and documentation:' +
  '\n// http://pouchdb.com\n',

  'localstorage': '// PouchDB localStorage plugin ' + version +
  '\n// Based on localstorage-down: https://github.com/No9/localstorage-down' +
  '\n// ' +
  '\n// (c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
  '\n// PouchDB may be freely distributed under the Apache license, ' +
  'version 2.0.' +
  '\n// For all details and documentation:' +
  '\n// http://pouchdb.com\n',

  'find': '// pouchdb-find plugin ' + version +
  '\n// Based on Mango: https://github.com/cloudant/mango' +
  '\n// ' +
  '\n// (c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
  '\n// PouchDB may be freely distributed under the Apache license, ' +
  'version 2.0.' +
  '\n// For all details and documentation:' +
  '\n// http://pouchdb.com\n',
};

async function doRollup(inputPath, browser, formatsToFiles) {
  var start = process.hrtime();
  console.log('ROLLUP:',{ inputPath });
  const input = path.resolve('packages/' + 'pouchdb/' + inputPath);
  const bundle = (await rollup.rollup({
    input,
    external,
    plugins: rollupPlugins({
      //mainFields: ["module"],
      browser
    })
  }));
  
  return Promise.all(Object.keys(formatsToFiles).map(function (format) {
    return bundle.generate({format: format}).then(function (bundle) {
      if (DEV_MODE) {
        var ms = Math.round(process.hrtime(start)[1] / 1000000);
        console.log('    took ' + ms + ' ms to rollup ' +
          path.dirname(input) + '/' + path.basename(input));
      }
      
      return writeFile(path.resolve('packages/' + 'pouchdb/' + formatsToFiles[format]), bundle.output[0].code);
    });
  }));
  
}
// true == isBrowser
const builds = [['src/index.js', false, {
  cjs: 'lib/index.js',
  es: 'lib/index.es.js'
}],['src/index.js', true, {
  cjs: 'lib/index-browser.js',
  es: 'lib/index-browser.es.js'
}]];


// build for Node (index.js)
function buildForNode() {
  return doRollup(...builds[0]);
}

// build for Browserify/Webpack (index-browser.js)
async function buildForBrowserify() {
  return true;
  //return doRollup(...builds[1]);
}

// build for the browser (dist)
function buildForBrowser() {
  return doBrowserify('pouchdb', 'lib/index-browser.js', {
    standalone: 'PouchDB'
  }).then(function (code) {
    code = comments.pouchdb + code;
    //console.log('comments:',{code});
    return Promise.all([
      writeFile(path.resolve('packages/' + 'pouchdb/' + 'dist/pouchdb.js'), code),
      doUglify('pouchdb', code, comments.pouchdb, 'dist/pouchdb.min.js')
    ]);
  });
}

function buildPluginsForBrowserify() {
  return plugins.map(async (plugin) => await doRollup('src/plugins/' + plugin + '.js', true, {
    cjs: 'lib/plugins/' + plugin + '.js'
  }));
}

function buildPluginsForBrowser() {
  return Promise.all(plugins.map(function (plugin) {
    var source = 'lib/plugins/' + plugin + '.js';
    return doBrowserify('pouchdb', source, {}, 'pouchdb').then(function (code) {
      code = comments[plugin] + code;
      return Promise.all([
        writeFile('packages/pouchdb/dist/pouchdb.' + plugin + '.js', code),
        doUglify('pouchdb', code, comments[plugin], 'dist/pouchdb.' + plugin + '.min.js')
      ]);
    });
  })).then(function () {
    return rimraf(path.resolve('packages/' + 'pouchdb/' + 'lib/plugins')); // no need for this after building dist/
  });
}

var rimrafMkdirp = function (...args) {
  return Promise.all(args.map(function (otherPath) {
    return rimraf(path.resolve('packages/' + 'pouchdb/' + otherPath));
  })).then(function () {
    return Promise.all(args.map(function (otherPath) {
      return mkdirp(path.resolve('packages/' + 'pouchdb/' + otherPath));
    }));
  });
};

async function doBuildNode() {
  await mkdirp(path.resolve('packages/' + 'pouchdb/' + 'lib/plugins'));
  buildForNode();
}

async function doBuildAll() {
  await rimrafMkdirp('lib', 'dist', 'lib/plugins');
  Promise.all([
    buildForNode,
    //buildForBrowserify,
    buildForBrowser,
    //buildPluginsForBrowserify,
    //buildPluginsForBrowser
  ].map((fn) => fn()));  
  
    
}

function doBuild() {
  //return doBuildNode();
  if (process.env.BUILD_NODE) { // rebuild before "npm test"
    return doBuildNode();
  } else { // normal, full build
    return doBuildAll();
  }
}

if (require.main === module) {
  doBuild().then(function () {
    console.log('build-pouchdb complete');
    process.exit(0);
  }).catch(function (err) {
    console.error('build-pouchdb error');
    console.error(err.stack);
    process.exit(1);
  });
} else {
  module.exports = doBuild;
}

