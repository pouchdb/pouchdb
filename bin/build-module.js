#!/usr/bin/env node

'use strict';

var rollup = require('rollup').rollup;
var nodeResolve = require('rollup-plugin-node-resolve');

var path = require('path');
var denodeify = require('denodeify');
var mkdirp = denodeify(require('mkdirp'));
var rimraf = denodeify(require('rimraf'));
var Promise = require('lie');

var pkg = require(path.resolve(process.cwd(), 'package.json'));
var deps = Object.keys(pkg.dependencies || {});
deps = deps.concat([
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
      external: deps,
      plugins: [
        nodeResolve({
          skip: deps,
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
        console.log('wrote ' + path.basename(process.cwd()) + '/' + dest +
          ' in ' +
          (isBrowser ? 'browser' : versions.length > 1 ? 'node' : 'vanilla') +
          ' mode');
      });
    });
  }));
}).catch(console.log.bind(console));
