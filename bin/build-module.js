#!/usr/bin/env node

// Build a single module using a generic Rollup-based build script.
// Reads in a src/index.js, writes to a lib/index.js. Might write
// index-browser.js if it detects that it needs to support a "browser" version.

'use strict';

var rollup = require('rollup').rollup;
var nodeResolve = require('rollup-plugin-node-resolve');

var path = require('path');
var lie = require('lie');
if (typeof Promise === 'undefined') {
  global.Promise = lie; // required for denodeify in node 0.10
}
var Promise = lie;
var denodeify = require('denodeify');
var mkdirp = denodeify(require('mkdirp'));
var rimraf = denodeify(require('rimraf'));
var externalDeps = require('./external-deps');

function buildModule(filepath) {
  var pkg = require(path.resolve(filepath, 'package.json'));

  // All external modules are assumed to be CommonJS, and therefore should
  // be skipped by Rollup. We may revisit this later.
  var depsToSkip = Object.keys(pkg.dependencies || {});
  depsToSkip = depsToSkip.concat([
    'crypto', 'fs', 'events', 'path'
  ]);

  if (pkg.name === 'pouchdb-for-coverage') {
    // special case - for the coverage reports, the whole thing is
    // bundled into one index.js. so we don't want to externalize
    // the pouchdb repos
    depsToSkip = depsToSkip.filter(function (dep) {
      return !/^pouchdb/.test(dep);
    }).concat(externalDeps.filter(function (dep) {
      return dep !== 'pouchdb'; // don't exclude pouchdb itself
    }));
  }

  // browser & node vs one single version
  var versions = pkg.browser ? [false, true] : [false];

  return Promise.resolve().then(function () {
    return rimraf(path.resolve(filepath, 'lib'));
  }).then(function () {
    return mkdirp(path.resolve(filepath, 'lib'));
  }).then(function () {
    return Promise.all(versions.map(function (isBrowser) {
      return rollup({
        entry: path.resolve(filepath, './src/index.js'),
        external: depsToSkip,
        plugins: [
          nodeResolve({
            skip: depsToSkip,
            jsnext: true,
            browser: isBrowser
          })
        ]
      }).then(function (bundle) {
        var dest = isBrowser ? 'lib/index-browser.js' : 'lib/index.js';
        return bundle.write({
          format: 'cjs',
          dest: path.resolve(filepath, dest)
        }).then(function () {
          console.log('  \u2713' + ' wrote ' +
            path.basename(filepath) + '/' + dest + ' in ' +
              (isBrowser ? 'browser' :
              versions.length > 1 ? 'node' : 'vanilla') +
            ' mode');
        });
      });
    }));
  });
}

module.exports = buildModule;