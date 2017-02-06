#!/usr/bin/env node

'use strict';

// build just the "pouchdb" package. This build script is different
// from the others due to legacy support (dist/, extras/, etc.).

var DEV_MODE = process.env.CLIENT === 'dev';
var TRAVIS = process.env.TRAVIS;

var lie = require('lie');
if (typeof Promise === 'undefined') {
  global.Promise = lie; // required for denodeify in node 0.10
}
var path = require('path');
var denodeify = require('denodeify');
var browserify = require('browserify');
var browserifyIncremental = require('browserify-incremental');
var rollup = require('rollup');
var rollupPlugins = require('./rollupPlugins');
var derequire = require('derequire');
var fs = require('fs');
var writeFileAsync = denodeify(fs.writeFile);
var renameAsync = denodeify(fs.rename);
var rimraf = denodeify(require('rimraf'));
var mkdirp = denodeify(require('mkdirp'));
var streamToPromise = require('stream-to-promise');
var spawn = require('child_process').spawn;
var all = Promise.all.bind(Promise);
var argsarray = require('argsarray');

var pkg = require('../packages/node_modules/pouchdb/package.json');
var version = pkg.version;

var builtInModules = require('builtin-modules');
var external = Object.keys(require('../package.json').dependencies)
  .concat(builtInModules);

var plugins = ['fruitdown', 'localstorage', 'memory'];

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
  '\n// http://pouchdb.com\n'
};

function addPath(otherPath) {
  return path.resolve('packages/node_modules/pouchdb', otherPath);
}

function writeFile(filename, contents) {
  var tmp = filename + '.tmp';
  return writeFileAsync(tmp, contents, 'utf-8').then(function () {
    return renameAsync(tmp, filename);
  }).then(function () {
    console.log('  \u2713' + ' wrote ' +
      filename.match(/packages[\/\\]node_modules[\/\\]pouchdb[\/\\].*/)[0]);
  });
}

// do uglify in a separate process for better perf
function doUglify(code, prepend, fileOut) {
  if (DEV_MODE || TRAVIS) { // skip uglify in "npm run dev" mode and on Travis
    return Promise.resolve();
  }
  var binPath = require.resolve('uglify-js/bin/uglifyjs');
  var args = [binPath, '-c', '-m', 'warnings=false', '-'];

  var child = spawn(process.execPath, args, {stdio: 'pipe'});
  child.stdin.setEncoding('utf-8');
  child.stdin.write(code);
  child.stdin.end();
  return streamToPromise(child.stdout).then(function (min) {
    min = prepend + min;
    return writeFile(addPath(fileOut), min);
  });
}

var browserifyCache = {};

function doBrowserify(filepath, opts, exclude) {

  var bundler = browserifyCache[filepath];

  if (!bundler) {
    if (DEV_MODE) {
      opts.debug = true;
      bundler = browserifyIncremental(addPath(filepath), opts)
        .on('time', function (time) {
          console.log('    took ' + time + ' ms to browserify ' +
            path.dirname(filepath) + '/' + path.basename(filepath));
        });
    } else {
      bundler = browserify(addPath(filepath), opts)
        .transform('es3ify')
        .plugin('bundle-collapser/plugin');
    }

    if (exclude) {
      bundler.external(exclude);
    }
    browserifyCache[filepath] = bundler;
  }

  return streamToPromise(bundler.bundle()).then(function (code) {
    if (!DEV_MODE) {
      code = derequire(code);
    }
    return code;
  });
}

function doRollup(entry, browser, formatsToFiles) {
  var start = process.hrtime();
  return rollup.rollup({
    entry: addPath(entry),
    external: external,
    plugins: rollupPlugins({
      skip: external,
      jsnext: true,
      browser: browser,
      main: false  // don't use "main"s that are CJS
    })
  }).then(function (bundle) {
    return Promise.all(Object.keys(formatsToFiles).map(function (format) {
      var fileOut = formatsToFiles[format];
      var code = bundle.generate({format: format}).code;
      if (DEV_MODE) {
        var ms = Math.round(process.hrtime(start)[1] / 1000000);
        console.log('    took ' + ms + ' ms to rollup ' +
          path.dirname(entry) + '/' + path.basename(entry));
      }
      return writeFile(addPath(fileOut), code);
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
  return doBrowserify('lib/index-browser.js', {
    standalone: 'PouchDB'
  }).then(function (code) {
    code = comments.pouchdb + code;
    return all([
      writeFile(addPath('dist/pouchdb.js'), code),
      doUglify(code, comments.pouchdb, 'dist/pouchdb.min.js')
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
    return doBrowserify(source, {}, 'pouchdb').then(function (code) {
      code = comments[plugin] + code;
      return all([
        writeFile('packages/node_modules/pouchdb/dist/pouchdb.' + plugin + '.js', code),
        doUglify(code, comments[plugin], 'dist/pouchdb.' + plugin + '.min.js')
      ]);
    });
  })).then(function () {
    return rimraf(addPath('lib/plugins')); // no need for this after building dist/
  });
}

function buildPouchDBNext() {
  return doBrowserify('src/next.js', {standalone: 'PouchDB'}).then(function (code) {
    return writeFile('packages/node_modules/pouchdb/dist/pouchdb-next.js', code);
  });
}

var rimrafMkdirp = argsarray(function (args) {
  return all(args.map(function (otherPath) {
    return rimraf(addPath(otherPath));
  })).then(function () {
    return all(args.map(function (otherPath) {
      return mkdirp(addPath(otherPath));
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
  return mkdirp(addPath('lib/plugins'))
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

