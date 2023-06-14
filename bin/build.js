const rollup = require('rollup');
const fs = require('node:fs');
const nodeResolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const alias = require('@rollup/plugin-alias');
const eslint = require('@rollup/plugin-eslint')({
  include: ["*.js","*.mjs"],
  exclude: [],
  fix:true,
});

const { resolve } = require('node:path/posix');
const pathResolve = (prefix)=>(name) => resolve(prefix,name);
const customResolver = nodeResolve({
  extensions: ['.mjs', '.js', '.jsx', '.json', '.sass', '.scss'],
});

const entries = [
  { find: 'zlib', replacement: 'node:zlib'// path.resolve(projectRootDir, 'src')
    // OR place `customResolver` here. See explanation below.
  }
];

const updateLibs = Promise.allSettled(fs.readdirSync('packages').map(pkg=>[rollup.rollup({ 
  input: { [pkg+'.es']: pkg },
  plugins: [
    eslint,
    alias({
      customResolver, entries,
    }),
    nodeResolve({preferBuiltins: true}),json(),commonjs()
  ],
}).then(bundle=>bundle.write({ dir: 'lib' })),rollup.rollup({ 
  input: { [pkg+'.browser.es']: pkg },
  plugins: [eslint,alias({
      customResolver, entries,
    }),nodeResolve({preferBuiltins:false,browser:true}),json(),commonjs()
  ],
}).then(bundle=>bundle.write({ dir: 'lib' }))]));
  
updateLibs.then(async () =>
(await rollup.rollup({ 
  input: fs.readdirSync('lib').map(pathResolve('lib')),
  plugins: [
    eslint,
    alias({
      customResolver, entries,
    }),
    nodeResolve({preferBuiltins: true})
  ],
})).write({ dir: 'dist/node' }));

