// const rollup = require('rollup');
const fs = require('node:fs');
const nodeResolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const alias = require('@rollup/plugin-alias');
const replace = require('@rollup/plugin-replace');
const eslint = require('@rollup/plugin-eslint')({
  include: ["*.js","*.mjs"],
  exclude: [],
  fix:true,
});

//const { resolve } = require('node:path/posix');
//const pathResolve = (prefix)=>(name) => resolve(prefix,name);
const customResolver = nodeResolve({
  // Order matters Injection happens via local /node_modules
  modulePaths: ['../','node_modules','../../node_modules'],
  extensions: ['.mjs', '.js', '.jsx', '.json', '.sass', '.scss'],
});

const entries = [
  { find: 'zlib', replacement: 'node:zlib'// path.resolve(projectRootDir, 'src')
    // OR place `customResolver` here. See explanation below.
  },
  { find: 'vm', replacement: 'node:vm' },
  { find: 'buffer', replacement: 'node:buffer' },
];

// Promise.resolve().then(async () =>
// [(await rollup.rollup())].map(b=>[b.write({ dir: 'lib' })]));

// .then(async ()=>(await rollup.rollup({ 
//   input: Object.fromEntries(fs.readdirSync('packages').map(pkg=>[pkg+'.browser',pkg])),
//   plugins: [
//     eslint,
//     alias({
//       customResolver, entries,
//     }),
//     nodeResolve({preferBuiltins: false, browser: true}), json(), commonjs()
//   ],
// })).write({ dir: 'lib', }));

const input = Object.fromEntries(fs.readdirSync('../../packages').map(pkg=>[pkg,pkg]).concat(
  fs.readdirSync('../../packages/pouchdb/src/plugins').map(plg=>[`pouchdb-plugin-${plg.slice(0,-3)}`,'../../packages/pouchdb/src/plugins/'+plg])
).concat([
  ['hash-wasm','hash-wasm']
]).filter( // here we filter out the node_modules folder package.json 
  (entrie)=>entrie[0].startsWith('pouchdb') && !entrie[0].includes('pouchdb-lib')
  ));

module.exports = [{ 
  input,
  //external: (name="") => console.log(name,name.includes('pouchdb-lib')) || name.includes('pouchdb-lib'),
  plugins: [
    eslint,
    {
      name: 'emit-module-package-file',
      generateBundle() {
        this.emitFile({ fileName: 'package.json', source: `{"type":"module"}`, type: 'asset' });
        this.emitFile({ fileName: 'pouchdb-lib.js', // index.js exports lib/pouchdb-*.js
           source: `${Object.keys(input).map((key) => 
           `export * as ${key.replaceAll('-','_')} from '${key}';`).join('\n')}`,
            type: 'asset' 
        });
      },
    },
    alias({
      customResolver, entries,
    }),
    nodeResolve({preferBuiltins: true,
      modulePaths: ['../','node_modules','../../node_modules'],
    }), json(), commonjs()
  ],
  output: [{ dir: 'lib' }]
},{ 
  input: { "pouchdb-modules": "lib/pouchdb-lib.js" },
  plugins: [
    replace({
      '("vm")': `('node:vm')`,
      [`from 'buffer'`]: `from 'node:buffer'`,
      [`from 'vm'`]: `from 'node:vm'`,
      __buildVersion: 15
    }),
    alias({
      customResolver, entries,
    }),
    nodeResolve({preferBuiltins: true,
      //modulePaths: ['../','node_modules','../../node_modules','./'],
    }), json(), commonjs()
  ],
  output: [{ dir: 'dist' }]
}];