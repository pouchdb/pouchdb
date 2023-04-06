#!/usr/bin/env node

// Build all modules in the packages/ folder
import('node:path').then((path)=>import('node:fs')
.then(async ({promises:{stat,readdir:readDir}}) => readDir('packages/node_modules').then(packages => Promise.all(packages.map((pkg) => {
  const nodeModulesPath = path.resolve('packages/node_modules', pkg));
  return (await stat(nodeModulesPath)).isDirectory()) && console.log(`Building ${pkg}...`) || (pkg === 'pouchdb') 
    ? import('./build-pouchdb').then(({ default: buildPouchDB })=>buildPouchDB())
    : import('./build-module').then(({ default: buildModule})=>buildModule(nodeModulesPath))  
  );
},({stack}) => {
  console.error('build error');
  console.error(stack);
  process.exit(1);
});
