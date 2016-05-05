#!/usr/bin/env node

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
  'crypto', 'fs', 'events', 'inherits', 'path'
]);

return rimraf('lib').then(function () {
  return mkdirp('lib');
}).then(function () {
  return Promise.all([false, true].map(function (isBrowser) {
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
      return bundle.write({
        format: 'cjs',
        dest: isBrowser ? 'lib/index-browser.js' : 'lib/index.js'
      });
    })
  }));
}).then(function () {
  var basename = path.basename(process.cwd());
  console.log('wrote ' +
    basename + '/lib/index.js and ' +
    basename + '/lib/index-browser.js');
}).catch(console.log.bind(console));
