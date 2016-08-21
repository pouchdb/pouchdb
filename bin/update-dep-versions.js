'use strict';

// update all the dependencies inside packages/node_modules/*/package.json to reflect
// the version numbers in the top-level package.json

var fs = require('fs');

var topPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

var modules = fs.readdirSync('./packages/node_modules');
modules.forEach(function (mod) {
  var pkgPath = './packages/node_modules/' + mod + '/package.json';
  var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  var depLists = [
    pkg.dependencies, 
    pkg.optionalDependencies
  ];
  depLists.forEach(function (deps) {
    if (!deps) {
      return;
    }
    Object.keys(deps).forEach(function (dep) {
      if (topPkg.dependencies[dep]) {
        deps[dep] = topPkg.dependencies[dep];
      } else { // core pouchdb-* module
        deps[dep] = topPkg.version
      }
    });
  });
  var jsonString = JSON.stringify(pkg, null, '  ') + '\n';
  fs.writeFileSync(pkgPath, jsonString, 'utf8');
});
