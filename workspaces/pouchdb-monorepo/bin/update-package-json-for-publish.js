'use strict';

// Update all the dependencies inside packages/node_modules/*/package.json
// to reflect the true dependencies (automatically determined by require())
// and update the version numbers to reflect the version from the top-level
// dependencies list. Also throw an error if a dep is not declared top-level.
// Also add necessary "browser" switches to each package.json, as well as
// other fields like "jsnext:main" and "files".

var fs = require('fs');
var path = require('path');
var glob = require('glob');
var findRequires = require('find-requires');
var builtinModules = require('builtin-modules');
var uniq = require('lodash.uniq');
var flatten = require('lodash.flatten');

var topPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
var modules = fs.readdirSync('./packages/node_modules');

modules.forEach(function (mod) {
  var pkgDir = path.join('./packages/node_modules', mod);
  var pkgPath = path.join(pkgDir, 'package.json');
  var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // for the dependencies, find all require() calls
  var srcFiles = glob.sync(path.join(pkgDir, 'lib/**/*.js'));
  var uniqDeps = uniq(flatten(srcFiles.map(function (srcFile) {
    var code = fs.readFileSync(srcFile, 'utf8');
    try {
      return findRequires(code);
    } catch (e) {
      return []; // happens if this is an es6 module, parsing fails
    }
  }))).filter(function (dep) {
    // some modules require() themselves, e.g. for plugins
    return dep !== pkg.name &&
      // exclude built-ins like 'inherits', 'fs', etc.
      builtinModules.indexOf(dep) === -1;
  }).sort();

  var deps = pkg.dependencies = {};
  uniqDeps.forEach(function (dep) {
    if (topPkg.dependencies[dep]) {
      deps[dep] = topPkg.dependencies[dep];
    } else if (modules.indexOf(dep) !== -1) { // core pouchdb-* module
      deps[dep] = topPkg.version;
    } else {
      throw new Error('Unknown dependency ' + dep);
    }
  });

  // add "browser" switches for both CJS and ES modules
  if (pkg.browser) {
    pkg.browser = {
      './lib/index.js': './lib/index-browser.js',
      './lib/index.es.js': './lib/index-browser.es.js',
    };
  }
  // Update "jsnext:main" to point to `lib/` rather than `src/`.
  // `src/` is only used for building, not publishing.
  // Also add "module" member: https://github.com/rollup/rollup/wiki/pkg.module
  pkg['jsnext:main'] = pkg.module = './lib/index.es.js';
  // whitelist the files we'll actually publish
  pkg.files = ['lib', 'dist', 'tonic-example.js'];

  var jsonString = JSON.stringify(pkg, null, '  ') + '\n';
  fs.writeFileSync(pkgPath, jsonString, 'utf8');
});
