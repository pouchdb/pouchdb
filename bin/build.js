const rollup = require('rollup');
const fs = require('node:fs');
const nodeResolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const alias = require('@rollup/plugin-alias');
fs.readdirSync('packages').forEach(pkg => rollup.rollup({ 
    input: { [pkg+'.es']: pkg },
    plugins: [alias({
        customResolver: nodeResolve({
            extensions: ['.mjs', '.js', '.jsx', '.json', '.sass', '.scss']
        }),
        entries: [
        {
          find: 'zlib',
          replacement: 'node:zlib'// path.resolve(projectRootDir, 'src')
          // OR place `customResolver` here. See explanation below.
        }
      ]}),nodeResolve({preferBuiltins: true}),json(),commonjs()]
}).then(bundle=>bundle.write({ dir: 'lib' })));