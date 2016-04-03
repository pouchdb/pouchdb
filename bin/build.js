#!/usr/bin/env node

'use strict';

var lie = require('lie');
if (typeof Promise === 'undefined') {
  global.Promise = lie; // required for denodeify in node 0.10
}
var denodeify = require('denodeify');
var browserify = require('browserify');
var collapse = require('bundle-collapser/plugin');
var es3ify = require('es3ify');
var rollup = require('rollup');
var derequire = require('derequire');
var fs = require('fs');
var writeFileAsync = denodeify(fs.writeFile);
var renameAsync = denodeify(fs.rename);
var ncp = denodeify(require('ncp').ncp);
var rimraf = denodeify(require('rimraf'));
var mkdirp = denodeify(require('mkdirp'));
var streamToPromise = require('stream-to-promise');
var findit = require('findit');
var spawn = require('child_process').spawn;

var pkg = require('../package.json');
var version = pkg.version;
var external = Object.keys(pkg.dependencies).concat([
 'fs', 'crypto', 'events', 'path', 'pouchdb'
]);

var plugins = ['fruitdown', 'localstorage', 'memory'];
var extras = {
  'src/deps/promise.js': 'promise.js',
  'src/replicate/checkpointer.js': 'checkpointer.js',
  'src/replicate/generateReplicationId.js': 'generateReplicationId.js',
  'src/deps/ajax/prequest.js': 'ajax.js',
  'src/plugins/websql/index.js': 'websql.js',
  'src_browser/deps/ajax/prequest.js': 'ajax-browser.js',
  'src_browser/replicate/checkpointer.js': 'checkpointer-browser.js',
  'src_browser/replicate/generateReplicationId.js':
    'generateReplicationId-browser.js'
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
  return writeFileAsync(tmp, contents, 'utf-8').then(function () {
    return renameAsync(tmp, filename);
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
  child.stdin.setEncoding('utf-8');
  child.stdin.write(code);
  child.stdin.end();
  return streamToPromise(child.stdout).then(function (min) {
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
  return mkdirp('lib').then(function() {
    return doRollup('src/index.js', 'lib/index.js');
  });
}

// build for Browserify/Webpack (index-browser.js)
function buildForBrowserify() {
  return ncp('src', 'src_browser').then(function () {
    return new Promise(function (resolve, reject) {
      var files = [];
      findit('src_browser').on('file', function (file) {
        if (/-browser.js$/.test(file)) {
          files.push(file);
        }
      }).on('end', function () {
        resolve(files);
      }).on('error', reject);
    });
  }).then(function (files) {
    return Promise.all(files.map(function (file) {
      return renameAsync(file, file.replace('-browser', ''));
    }));
  }).then(function () {
    return doRollup('src_browser/index.js', 'lib/index-browser.js');
  });
}

// build for the browser (dist)
function buildForBrowser() {
  return mkdirp('dist').then(function() {
    return doBrowserify('.', {standalone: 'PouchDB'});
  }).then(function (code) {
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
  return mkdirp('lib/extras').then(function() {
    return Promise.all(plugins.map(function (plugin) {
      return doRollup('src_browser/plugins/' + plugin + '/index.js',
                      'lib/extras/' + plugin + '.js');
    }));
  });
}

function buildExtras() {
  return mkdirp('lib/extras').then(function() {
    return Promise.all(Object.keys(extras).map(function (entry) {
      var target = extras[entry];
      return doRollup(entry, 'lib/extras/' + target);
    }));
  });
}

function buildPluginsForBrowser() {
  return mkdirp('lib/extras').then(function() {
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
  });
}

if (process.argv[2] === 'node') {
  rimraf('lib').then(buildForNode).then(function () {
    process.exit(0);
  }).catch(function (err) {
    console.log(err.stack);
    process.exit(1);
  });
} else {
  Promise.resolve()
    .then(function () { return rimraf('lib'); })
    .then(function () { return rimraf('dist'); })
    .then(buildForNode)
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
}
