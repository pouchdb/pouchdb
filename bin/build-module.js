#!/usr/bin/env node

// Build a single module using a generic Rollup-based build script.
// Reads in a src/index.js, writes to a lib/index.js. Might write
// index-browser.js if it detects that it needs to support a "browser" version.
//
// You can use this on the CLI by doing:
// build-module.js path/to/module

'use strict';

var rollup = require('rollup').rollup;
var rollupPlugins = require('./rollupPlugins');

var path = require('path');
var lie = require('lie');
if (typeof Promise === 'undefined') {
  global.Promise = lie; // required for denodeify in node 0.10
}
var Promise = lie;
var denodeify = require('denodeify');
var mkdirp = denodeify(require('mkdirp'));
var rimraf = denodeify(require('rimraf'));
var builtInModules = require('builtin-modules');
var fs = require('fs');

function buildModule(filepath) {
  var pkg = require(path.resolve(filepath, 'package.json'));
  var topPkg = require(path.resolve(filepath, '../../../package.json'));
  var pouchdbPackages = fs.readdirSync(path.resolve(filepath, '..'));
  // All external modules are assumed to be CommonJS, and therefore should
  // be skipped by Rollup. We may revisit this later.
  var depsToSkip = Object.keys(topPkg.dependencies || {})
    .concat(builtInModules);

  var bundledPkgs = ['pouchdb-for-coverage', 'pouchdb-node', 'pouchdb-browser'];
  if (bundledPkgs.indexOf(pkg.name) === -1) {
    // special case - pouchdb-for-coverage is heavily optimized because it's
    // simpler to run the coverage reports that way.
    // as for pouchdb-node/pouchdb-browser, these are heavily optimized 
    // through aggressive bundling, ala pouchdb, because it's assumed that
    // for these packages bundle size is more important than modular deduping
    depsToSkip = depsToSkip.concat(pouchdbPackages);
  }

  // browser & node vs one single vanilla version
  var versions = pkg.browser ? [false, true] : [false];

  // special case for "pouchdb-browser" - there is only one index.js,
  // and it's built in "browser mode"
  var forceBrowser = pkg.name === 'pouchdb-browser';

  return Promise.resolve().then(function () {
    return rimraf(path.resolve(filepath, 'lib'));
  }).then(function () {
    return mkdirp(path.resolve(filepath, 'lib'));
  }).then(function () {
    return Promise.all(versions.map(function (isBrowser) {
      return rollup({
        entry: path.resolve(filepath, './src/index.js'),
        external: depsToSkip,
        plugins: rollupPlugins({
          skip: depsToSkip,
          jsnext: true,
          browser: isBrowser || forceBrowser
        })
      }).then(function (bundle) {
        var formats = ['cjs', 'es'];
        return Promise.all(formats.map(function (format) {
          var dest = (isBrowser ? 'lib/index-browser' : 'lib/index') +
            (format === 'es' ? '.es.js' : '.js');
          return bundle.write({
            format: format,
            dest: path.resolve(filepath, dest)
          }).then(function () {
            console.log('  \u2713' + ' wrote ' +
              path.basename(filepath) + '/' + dest + ' in ' +
                (isBrowser ? 'browser' :
                versions.length > 1 ? 'node' : 'vanilla') +
              ' mode');
          });
        }));
      });
    }));
  });
}
if (require.main === module) {
  buildModule(process.argv[process.argv.length - 1]).catch(function (err) {
    console.error('build-module.js error');
    console.error(err.stack);
    process.exit(1);
  });
} else {
  module.exports = buildModule;
}
