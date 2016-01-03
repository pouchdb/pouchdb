#!/usr/bin/env node

'use strict';

var browserify = require('browserify');
var collapse = require('bundle-collapser/plugin');
var es3ify = require('es3ify');
var rollup = require('rollup');
var derequire = require('derequire');
var bluebird = require('bluebird');
var fs = bluebird.promisifyAll(require('fs'));
var ncp = bluebird.promisify(require('ncp').ncp);
var glob = bluebird.promisify(require('glob'));
var rimraf = bluebird.promisify(require('rimraf'));
var mkdirp = bluebird.promisify(require('mkdirp'));
var streamToPromise = require('stream-to-promise');
var duplexify = require('duplexify');
var spawn = require('child_process').spawn;
bluebird.longStackTraces();
var Promise = bluebird;

var pkg = require('../package.json');
var version = pkg.version;
var external = Object.keys(pkg.dependencies).concat([
 'fs', 'crypto', 'events', 'inherits', 'path', 'pouchdb', 
 'level-sublevel/legacy'
]);

var plugins = ['fruitdown', 'localstorage', 'memory'];
var extras = {
  'deps/promise.js': 'promise.js',
  'replicate/checkpointer.js': 'checkpointer.js',
  'deps/ajax/prequest.js': 'ajax.js',
  'replicate/generateReplicationId.js': 'generateReplicationId.js'
};

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

function writeFile(filename, contents) {
  var tmp = filename + '.tmp';
  return fs.writeFileAsync(tmp, contents, 'utf-8').then(function () {
    return fs.renameAsync(tmp, filename);
  }).then(function () {
    console.log('Wrote ' + filename);
  });
}

function addVersion(code) {
  return code.replace('__VERSION__', version);
}

// do uglify in a separate process for better perf
function doUglify(code, prepend, fileOut) {
  var binPath = require.resolve('uglify-js/bin/uglifyjs');
  var args = [binPath, '-c', '-m', 'warnings=false', '-'];

  var child = spawn(process.execPath, args, {stdio: 'pipe'});
  var stream = duplexify(child.stdin, child.stdout);
  child.stdin.setEncoding('utf-8');
  child.stdin.write(code);
  child.stdin.end();
  return streamToPromise(stream).then(function (min) {
    min = prepend + min;
    return writeFile(fileOut, min);
  });
}

function doBrowserify(path, opts, exclude) {
  var b = browserify(path, opts);
  b.transform(es3ify).plugin(collapse);

  if (exclude) {
    b.external(exclude);
  }

  return streamToPromise(b.bundle()).then(function (code) {
    code = derequire(code);
    return code;
  });
}

function doRollup(entry, fileOut) {
  return rollup.rollup({
    entry: entry,
    external: external
  }).then(function (bundle) {
    var code = bundle.generate({format: 'cjs'}).code;
    return writeFile(fileOut, addVersion(code));
  });
}

// build for Node (index.js)
function buildForNode() {
  return doRollup('src/index.js', 'lib/index.js');
}

// build for Browserify/Webpack (index-browser.js)
function buildForBrowserify() {
  return ncp('src', 'src_browser').then(function () {
    return glob('src_browser/**/*-browser.js');
  }).then(function (files) {
    return Promise.all(files.map(function (file) {
      return fs.renameAsync(file, file.replace('-browser', ''));
    }));
  }).then(function () {
    return doRollup('src_browser/index.js', 'lib/index-browser.js');
  });
}

// build for the browser (dist)
function buildForBrowser() {
  return doBrowserify('.', {standalone: 'PouchDB'}).then(function (code) {
    code = comments.pouchdb + code;
    return Promise.all([
      writeFile('dist/pouchdb.js', code),
      doUglify(code, comments.pouchdb, 'dist/pouchdb.min.js')
    ]);
  });
}

function buildPerformanceBundle() {
  return doBrowserify('tests/performance', {
    debug: true,
    fullPaths: true
  }).then(function (code) {
    return writeFile('tests/performance-bundle.js', code);
  });
}

function cleanup() {
  return rimraf('src_browser');
}

function buildPluginsForBrowserify() {
  return Promise.all(plugins.map(function (plugin) {
    return doRollup('src_browser/plugins/' + plugin + '/index.js',
      'lib/extras/' + plugin + '.js');
  }));
}

function buildExtras() {
  return Promise.all(Object.keys(extras).map(function (entry) {
    var target = extras[entry];
    return doRollup('src_browser/' + entry, 'lib/extras/' + target);
  }));
}

function buildPluginsForBrowser() {
  return Promise.all(plugins.map(function (plugin) {
    var source = 'lib/extras/' + plugin + '.js';
    return doBrowserify(source, {}, 'pouchdb').then(function (code) {
      code = comments[plugin] + code;
      return Promise.all([
        writeFile('dist/pouchdb.' + plugin + '.js', code),
        doUglify(code, comments[plugin], 'dist/pouchdb.' + plugin + '.min.js')
      ]);
    });
  }));
}

Promise.resolve().then(function () {
  return Promise.all(['dist', 'lib', 'src_browser'].map(function (file) {
    return rimraf(file);
  }));
}).then(function () {
  return Promise.all(['dist', 'lib/plugins', 'lib/extras'].map(function (file) {
    return mkdirp(file);
  }));
}).then(buildForNode)
  .then(buildForBrowserify)
  .then(buildForBrowser)
  .then(buildPluginsForBrowserify)
  .then(buildPluginsForBrowser)
  .then(buildExtras)
  .then(buildPerformanceBundle)
  .then(cleanup)
  .catch(function (err) {
    console.log(err.stack);
    process.exit(1);
  }
);
