#!/usr/bin/env node

// Build script shared amongst all the Lerna sub-modules

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

var pkg = require(path.resolve(process.cwd(), 'package.json'));

// All external modules are assumed to be CommonJS, and therefore should
// be skipped by Rollup. We may revisit this later.
var depsToSkip = Object.keys(pkg.dependencies || {});
depsToSkip = depsToSkip.concat([
  'crypto', 'fs', 'events', 'path'
]);

// browser & node vs one single version
var versions = pkg.browser ? [false, true] : [false];

Promise.resolve().then(function () {
  return rimraf('lib');
}).then(function () {
  return mkdirp('lib');
}).then(function () {
  return Promise.all(versions.map(function (isBrowser) {
    return rollup({
      entry: './src/index.js',
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
        dest: dest
      }).then(function () {
        console.log('  \u2713' + ' wrote ' +
          path.basename(process.cwd() +
          '/' + dest) + ' in ' +
          (isBrowser ? 'browser' :
            versions.length > 1 ? 'node' : 'vanilla') +
          ' mode');
      });
    });
  }));
}).catch(function (err) {
  console.error('Error: build-module.js');
  console.error(err.stack);
  process.exit(1);
});
