// 'use strict'; is default when ESM

// Update all the dependencies inside packages/node_modules/*/package.json
// to reflect the true dependencies (automatically determined by require())
// and update the version numbers to reflect the version from the top-level
// package.json.

var fs = require('node:fs');
var path = require('node:path');
var glob = require('glob');
var findRequires = require('find-requires');
var builtinModules = require('builtin-modules');
var uniq = require('lodash.uniq');
var flatten = require('lodash.flatten');

var topPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
var modules = fs.readdirSync('./packages/node_modules');
var version = topPkg.version;

modules.forEach(function (mod) {
  var pkgDir = path.join('./packages/node_modules', mod);
  var pkgPath = path.join(pkgDir, 'package.json');
  var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // all packages get the same version as the top package.json
  pkg.version = version;

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
      // exclude built-ins like 'inherits', 'node:fs', etc.
      builtinModules.indexOf(dep) === -1;
  }).sort();

  //find dependencies and igonore if we referencing a local file
  var newPkg = uniqDeps.reduce(function (deps, dep) {
    if (/^\.\//.test(dep) || /^\.\.\//.test(dep)) {
      return deps; // do nothing its a local file
    }

    if (dep[0] !== '@') {
      dep = dep.split('/')[0]; // split colors/safe to be colors
    }

    if (topPkg.dependencies[dep]) {
      if (modules.indexOf(dep) !== -1) { // core pouchdb-* module
        deps.dependencies[dep] = topPkg.version;
      } else {
        deps.dependencies[dep] = topPkg.dependencies[dep];
      }
    } else if (topPkg.optionalDependencies[dep]) {
      deps.optionalDependencies[dep] = topPkg.optionalDependencies[dep];
    } else {
      throw new Error('Unknown dependency ' + dep);
    }

    return deps;
  }, {
    dependencies: {},
    optionalDependencies: {}
  });

  // special case – `pouchdb-fauxton` is included using `require.resolve()`,
  // meaning that `find-requires` doesn't find it. so we have to do it manually
  if (pkg.name === 'express-pouchdb') {
    newPkg.dependencies['pouchdb-fauxton'] =
      topPkg.dependencies['pouchdb-fauxton'];
  }

  Object.assign(pkg, newPkg);

  var jsonString = JSON.stringify(pkg, null, '  ') + '\n';
  fs.writeFileSync(pkgPath, jsonString, 'utf8');
});
