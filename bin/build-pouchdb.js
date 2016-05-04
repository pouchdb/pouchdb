#!/usr/bin/env node

'use strict';

// build just the "pouchdb" package. This build script is different
// from the others due to legacy support (dist/, extras/, etc.).

var lie = require('lie');
if (typeof Promise === 'undefined') {
  global.Promise = lie; // required for denodeify in node 0.10
}
var path = require('path');
var denodeify = require('denodeify');
var browserify = require('browserify');
var collapse = require('bundle-collapser/plugin');
var es3ify = require('es3ify');
var rollup = require('rollup');
var nodeResolve = require('rollup-plugin-node-resolve');
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

var pkg = require('../packages/pouchdb/package.json');
var version = pkg.version;

// these modules should be treated as external by Rollup
var external = require('./external-deps');

var plugins = ['fruitdown', 'localstorage', 'memory'];
var browserExtras = {
  'src/extras/ajax.js': 'ajax-browser.js',
  'src/extras/checkpointer.js': 'checkpointer-browser.js',
  'src/extras/generateReplicationId.js': 'generateReplicationId-browser.js'
};
var nodeExtras = {
  'src/extras/promise.js': 'promise.js',
  'src/extras/checkpointer.js': 'checkpointer.js',
  'src/extras/generateReplicationId.js': 'generateReplicationId.js',
  'src/extras/ajax.js': 'ajax.js',
  'src/extras/websql.js': 'websql.js'
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

function addPath(otherPath) {
  return path.resolve('packages/pouchdb', otherPath);
}

function writeFile(filename, contents) {
  var tmp = filename + '.tmp';
  return writeFileAsync(tmp, contents, 'utf-8').then(function () {
    return renameAsync(tmp, filename);
  }).then(function () {
    console.log('  \u2713' + ' wrote ' +
      filename.match(/packages\/pouchdb\/.*/)[0]);
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
  child.stdin.setEncoding('utf-8');
  child.stdin.write(code);
  child.stdin.end();
  return streamToPromise(child.stdout).then(function (min) {
    min = prepend + min;
    return writeFile(addPath(fileOut), min);
  });
}

function doBrowserify(filepath, opts, exclude) {
  var b = browserify(addPath(filepath), opts);
  b.transform(es3ify).plugin(collapse);

  if (exclude) {
    b.external(exclude);
  }

  return streamToPromise(b.bundle()).then(function (code) {
    code = derequire(code);
    return code;
  });
}

function doRollup(entry, fileOut, browser) {
  return rollup.rollup({
    entry: addPath(entry),
    external: external,
    plugins: [
      nodeResolve({
        skip: external,
        jsnext: true,
        browser: browser,
        main: false  // don't use "main"s that are CJS
      })
    ]
  }).then(function (bundle) {
    var code = bundle.generate({format: 'cjs'}).code;
    return writeFile(addPath(fileOut),
      addVersion(code));
  });
}

// build for Node (index.js)
function buildForNode() {
  return doRollup('src/index.js', 'lib/index.js');
}

// build for Browserify/Webpack (index-browser.js)
function buildForBrowserify() {
  return doRollup('src/index.js', 'lib/index-browser.js', true);
}

// build for the browser (dist)
function buildForBrowser() {
  return doBrowserify('.', {standalone: 'PouchDB'}).then(function (code) {
    code = comments.pouchdb + code;
    return Promise.all([
      writeFile(addPath('dist/pouchdb.js'), code),
      doUglify(code, comments.pouchdb, 'dist/pouchdb.min.js')
    ]);
  });
}

function buildPluginsForBrowserify() {
  return Promise.all(plugins.map(function (plugin) {
    return doRollup('src/extras/' + plugin + '.js',
                    'lib/extras/' + plugin + '.js', true);
  }));
}

function buildNodeExtras() {
  return Promise.all(Object.keys(nodeExtras).map(function (entry) {
    var target = nodeExtras[entry];
    return doRollup(entry, 'lib/extras/' + target);
  }));
}

function buildBrowserExtras() {
  return Promise.all(Object.keys(browserExtras).map(function (entry) {
    var target = browserExtras[entry];
    return doRollup(entry, 'lib/extras/' + target, true);
  }));
}

function buildPluginsForBrowser() {
  return Promise.all(plugins.map(function (plugin) {
    var source = 'lib/extras/' + plugin + '.js';
    return doBrowserify(source, {}, 'pouchdb').then(function (code) {
      code = comments[plugin] + code;
      return Promise.all([
        writeFile('packages/pouchdb/dist/pouchdb.' + plugin + '.js', code),
        doUglify(code, comments[plugin], 'dist/pouchdb.' + plugin + '.min.js')
      ]);
    });
  }));
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

function doBuildNode() {
  return rimrafMkdirp('lib', 'lib/extras')
    .then(buildForNode)
    .then(buildNodeExtras);
}

function doBuildAll() {
  return rimrafMkdirp('lib', 'dist', 'lib/extras')
    .then(function () {
      return all([buildForNode(), buildForBrowserify()]);
    })
    .then(function () {
      return all([buildForBrowser(), buildPluginsForBrowserify()]);
    })
    .then(function () {
      return all([
        buildPluginsForBrowser(),
        buildNodeExtras(),
        buildBrowserExtras()
      ]);
    });
}

function doBuild() {
  if (process.env.BUILD_NODE) {
    return doBuildNode();
  } else {
    return doBuildAll();
  }
}

if (require.main === module) {
  doBuild().then(function () {
    process.exit(0);
  }).catch(function (err) {
    console.error('build-pouchdb error');
    console.error(err.stack);
    process.exit(1);
  });
} else {
  module.exports = doBuild;
}

