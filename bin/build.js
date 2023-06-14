const rollup = require('rollup');
const fs = require('node:fs');
const nodeResolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const alias = require('@rollup/plugin-alias');
const eslint = require('@rollup/plugin-eslint')({
  fix:true,
});
const customResolver = nodeResolve({
  extensions: ['.mjs', '.js', '.jsx', '.json', '.sass', '.scss'],
});

const entries = [
  { find: 'zlib', replacement: 'node:zlib'// path.resolve(projectRootDir, 'src')
    // OR place `customResolver` here. See explanation below.
  }
];

fs.readdirSync('packages').map(pkg=>[rollup.rollup({ 
  input: { [pkg+'.es']: pkg },
  plugins: [
    alias({
      customResolver, entries,
    }),
    nodeResolve({preferBuiltins: true}),json(),commonjs(),eslint
  ],
}).then(bundle=>bundle.write({ dir: 'lib' })),rollup.rollup({ 
  input: { [pkg+'.browser.es']: pkg },
  plugins: [alias({
      customResolver, entries,
    }),nodeResolve({preferBuiltins:false,browser:true}),json(),commonjs(),eslint
  ],
}).then(bundle=>bundle.write({ dir: 'lib' }))]);
