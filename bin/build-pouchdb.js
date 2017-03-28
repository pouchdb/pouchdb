#!/usr/bin/env node

'use strict';

// build just the "pouchdb" package. This build script is different
// from the others due to legacy support (dist/, extras/, etc.).

var DEV_MODE = process.env.CLIENT === 'dev';

var lie = require('lie');
if (typeof Promise === 'undefined') {
  global.Promise = lie; // required for denodeify in node 0.10
}
var path = require('path');
var denodeify = require('denodeify');
var rollup = require('rollup');
var rollupPlugins = require('./rollupPlugins');
var rimraf = denodeify(require('rimraf'));
var mkdirp = denodeify(require('mkdirp'));
var all = Promise.all.bind(Promise);
var argsarray = require('argsarray');
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

var plugins = ['fruitdown', 'localstorage', 'memory', 'find', 'lite'];

var currentYear = new Date().getFullYear();

var comments = {
  'pouchdb': '// PouchDB ' + version +
  '\n// ' +
  '\n// (c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
  '\n// PouchDB may be freely distributed under the Apache license, ' +
  'version 2.0.' +
  '\n// For all details and documentation:' +
  '\n// http://pouchdb.com\n',

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

  'fruitdown': '// PouchDB fruitdown plugin ' + version +
  '\n// Based on FruitDOWN: https://github.com/nolanlawson/fruitdown' +
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

  'lite': '// pouchdb-lite ' + version +
  '\n// This is a special build of PouchDB excluding some features.' +
  '\n// For details: http://pouchdb.com/custom.html' +
  '\n// ' +
  '\n// (c) 2012-' + currentYear + ' Dale Harvey and the PouchDB team' +
  '\n// PouchDB may be freely distributed under the Apache license, ' +
  'version 2.0.' +
  '\n// For all details and documentation:' +
  '\n// http://pouchdb.com\n'
};

function doRollup(entry, browser, formatsToFiles) {
  var includePolyfills = entry !== 'src/plugins/lite.js';
  var start = process.hrtime();
  return rollup.rollup({
    entry: addPath('pouchdb', entry),
    external: external,
    plugins: rollupPlugins({
      skip: external,
      jsnext: true,
      browser: browser,
      main: false  // don't use "main"s that are CJS
    }, includePolyfills)
  }).then(function (bundle) {
    return Promise.all(Object.keys(formatsToFiles).map(function (format) {
      var fileOut = formatsToFiles[format];
      var code = bundle.generate({format: format}).code;
      if (DEV_MODE) {
        var ms = Math.round(process.hrtime(start)[1] / 1000000);
        console.log('    took ' + ms + ' ms to rollup ' +
          path.dirname(entry) + '/' + path.basename(entry));
      }
      return writeFile(addPath('pouchdb', fileOut), code);
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

function buildPouchDBNext() {
  return doRollup('src/next.js', true, {
    cjs: 'lib/next.js'
  }).then(function () {
    return doBrowserify('pouchdb', 'lib/next.js', {standalone: 'PouchDB'});
  }).then(function (code) {
    return writeFile('packages/node_modules/pouchdb/dist/pouchdb-next.js', code);
  });
}

var rimrafMkdirp = argsarray(function (args) {
  return all(args.map(function (otherPath) {
    return rimraf(addPath('pouchdb', otherPath));
  })).then(function () {
    return all(args.map(function (otherPath) {
      return mkdirp(addPath('pouchdb', otherPath));
    }));
  });
});

var doAll = argsarray(function (args) {
  return function () {
    return all(args.map(function (promiseFactory) {
      return promiseFactory();
    }));
  };
});

function doBuildNode() {
  return mkdirp(addPath('pouchdb', 'lib/plugins'))
    .then(buildForNode);
}

function doBuildDev() {
  return doAll(buildForNode, buildForBrowserify)()
    .then(doAll(buildForBrowser, buildPluginsForBrowserify, buildPouchDBNext))
    .then(buildPluginsForBrowser);
}

function doBuildAll() {
  return rimrafMkdirp('lib', 'dist', 'lib/plugins')
    .then(doAll(buildForNode, buildForBrowserify))
    .then(doAll(buildForBrowser, buildPluginsForBrowserify, buildPouchDBNext))
    .then(doAll(buildPluginsForBrowser));
}

function doBuild() {
  if (process.env.BUILD_NODE) { // rebuild before "npm test"
    return doBuildNode();
  } else if (DEV_MODE) { // rebuild during "npm run dev"
    return doBuildDev();
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

