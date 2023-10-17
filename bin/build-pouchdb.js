#!/usr/bin/env node

'use strict';

// build just the "pouchdb" package. This build script is different
// from the others due to legacy support (dist/, extras/, etc.).

var DEV_MODE = process.env.CLIENT === 'dev';

var path = require('path');
var denodeify = require('denodeify');
var rollup = require('rollup');
var rollupPlugins = require('./rollupPlugins');
var rimraf = denodeify(require('rimraf'));
var mkdirp = denodeify(require('mkdirp'));
var all = Promise.all.bind(Promise);
var buildUtils = require('./build-utils');
var addPath = buildUtils.addPath;
var doUglify = buildUtils.doUglify;
var doBrowserify = buildUtils.doBrowserify;
var writeFile = buildUtils.writeFile;

var pkg = require('../packages/node_modules/pouchdb/package.json');
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

function doRollup(input, browser, formatsToFiles) {
  var start = process.hrtime();
  return rollup.rollup({
    input: addPath('pouchdb', input),
    external: external,
    plugins: rollupPlugins({
      mainFields: ["module"],
      browser: browser
    })
  }).then(function (bundle) {
    return Promise.all(Object.keys(formatsToFiles).map(function (format) {
      var fileOut = formatsToFiles[format];
      return bundle.generate({format: format}).then(function (bundle) {
        if (DEV_MODE) {
          var ms = Math.round(process.hrtime(start)[1] / 1000000);
          console.log('    took ' + ms + ' ms to rollup ' +
                      path.dirname(input) + '/' + path.basename(input));
        }
        return writeFile(addPath('pouchdb', fileOut), bundle.code);
      });
    }));
  });
}

// build for Node (index.js)
function buildForNode() {
  return doRollup('src/index.js', false, {
    cjs: 'lib/index.js',
    es: 'lib/index.es.js'
  });
}

// build for Browserify/Webpack (index-browser.js)
function buildForBrowserify() {
  return doRollup('src/index.js', true, {
    cjs: 'lib/index-browser.js',
    es: 'lib/index-browser.es.js'
  });
}

// build for the browser (dist)
function buildForBrowser() {
  return doBrowserify('pouchdb', 'lib/index-browser.js', {
    standalone: 'PouchDB'
  }).then(function (code) {
    code = comments.pouchdb + code;
    return all([
      writeFile(addPath('pouchdb', 'dist/pouchdb.js'), code),
      doUglify('pouchdb', code, comments.pouchdb, 'dist/pouchdb.min.js')
    ]);
  });
}

function buildPluginsForBrowserify() {
  return all(plugins.map(function (plugin) {
    return doRollup('src/plugins/' + plugin + '.js', true, {
      cjs: 'lib/plugins/' + plugin + '.js'
    });
  }));
}

function buildPluginsForBrowser() {
  return all(plugins.map(function (plugin) {
    var source = 'lib/plugins/' + plugin + '.js';
    return doBrowserify('pouchdb', source, {}, 'pouchdb').then(function (code) {
      code = comments[plugin] + code;
      return all([
        writeFile('packages/node_modules/pouchdb/dist/pouchdb.' + plugin + '.js', code),
        doUglify('pouchdb', code, comments[plugin], 'dist/pouchdb.' + plugin + '.min.js')
      ]);
    });
  })).then(function () {
    return rimraf(addPath('pouchdb', 'lib/plugins')); // no need for this after building dist/
  });
}

var rimrafMkdirp = function (...args) {
  return all(args.map(function (otherPath) {
    return rimraf(addPath('pouchdb', otherPath));
  })).then(function () {
    return all(args.map(function (otherPath) {
      return mkdirp(addPath('pouchdb', otherPath));
    }));
  });
};

var doAll = function (...args) {
  return function () {
    return all(args.map(function (promiseFactory) {
      return promiseFactory();
    }));
  };
};

function doBuildNode() {
  return mkdirp(addPath('pouchdb', 'lib/plugins'))
    .then(buildForNode);
}

function doBuildAll() {
  return rimrafMkdirp('lib', 'dist', 'lib/plugins')
    .then(doAll(buildForNode, buildForBrowserify))
    .then(doAll(buildForBrowser, buildPluginsForBrowserify))
    .then(doAll(buildPluginsForBrowser));
}

function doBuild() {
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

