// TODO: Switch complet to rollup
const { rollup } = await import('rollup')
const {nodeResolve} = await import('@rollup/plugin-node-resolve');


  const fsPromises = await import('node:fs/promises');
  // console.log(
  //   (await fsPromises.readdir('node_modules/pouchdb-monorepo/packages/pouchdb/src/plugins')).map(plugin=>[`pouchdb-plugins-${plugin}`,`node_modules/pouchdb-monorepo/packages/pouchdb/src/plugins/${plugin}`])
  // )
  // process.exit()
  
  
  const input = Object.fromEntries(await fsPromises.readdir('node_modules/pouchdb-monorepo/packages').then(async pkgs=>{
    return pkgs.filter(x => !['pouchdb-fetch','node_modules','package.json','package-lock.json'].includes(x))
    .map(pkgName=>[pkgName,`pouchdb-monorepo/packages/${pkgName}`])
    .concat([])
  }))

const step2 = async () => {
  const inputModules = Object.fromEntries(await (await import('node:fs/promises')).readdir('modules').then(pkgs=>{
    return pkgs.filter(x => !['node_modules','package.json','package-lock.json'].includes(x))
  }))

  const external = id => !id.startsWith('\0') && !id.startsWith('.') && !id.startsWith('/') || 
    ['node-fetch','whatwg-url'].includes(id);
  rollup({ 
    input: inputModules,
    external,
    plugins:[{ name: "resolve-pouchdb-modules",resolveId(id,importeer ){
      //console.log(``,id,importeer)
    }},
      // nodeResolve({ 
      // main: true, // don't use "main"s that are CJS for PouchDB Standalone build only maybe
      // jsnext: true, browser: false, module: true })
    ]
  }).then(async (bundle)=>bundle.generate({
    "format": "es",
    "dir": "modules"
  })).then(console.log)
  //Promise.([,require('node:fs').promises.readdir('../pouchdb-server-monorepo/packages')]).then(([pouchdbPackages,pouchdbServerPackages])=>
    //pouchdbPackages.filter(x => !pouchdbServerPackages.includes(x)).concat(pouchdbServerPackages).filter(x => !['node_modules','package.json','package-lock.json'].includes(x))
  //);
}
const step1 = async ()=>{
  console.log({input})
  const external = id => !id.startsWith('\0') && !id.startsWith('.') && !id.startsWith('/') || 
    ['node_modules/','pouchdb-fetch','node-fetch','whatwg-url'].find(exc => id.indexOf(exc) > -1);
  rollup({ 
    input,
    external,
    plugins:[{ name: "resolve-pouchdb-modules",resolveId(id,importeer ){
      console.log(id,importeer)
    }},
      nodeResolve({ 
      main: true, // don't use "main"s that are CJS for PouchDB Standalone build only maybe
      jsnext: true, browser: false, module: true })
    ]
    
  }).then((bundle)=>bundle.write({
    "format": "es",
    "dir": "modules"
  })).then(console.log)

}
step1()
export default []
// var replace = require('rollup-plugin-replace');
// var inject = require('rollup-plugin-inject');

// function rollupPlugins(nodeResolveConfig) {
//   return [
//     nodeResolve(nodeResolveConfig),
//     replace({
//       // we have switches for coverage; don't ship this to consumers
//       'process.env.COVERAGE': JSON.stringify(!!process.env.COVERAGE),
//       // test for fetch vs xhr
//       'process.env.FETCH': JSON.stringify(!!process.env.FETCH)
//     }),
//     inject({
//       exclude: [
//         '**/pouchdb-utils/src/assign.js',
//         '**/pouchdb-collections/src/**'
//       ],
//       Map: ['pouchdb-collections', 'Map'],
//       Set: ['pouchdb-collections', 'Set'],
//       'Object.assign': ['pouchdb-utils', 'assign']
//     })
//   ];
// }
