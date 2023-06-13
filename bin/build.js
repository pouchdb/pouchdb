const rollup = require('rollup');
const fs = require('node:fs');
const nodeResolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');

fs.readdirSync('packages').forEach(pkg => rollup.rollup({ 
    input: { [pkg]: pkg },
    plugins: [nodeResolve({preferBuiltins: true}),json(),commonjs()]
}).then(bundle=>bundle.write({ dir: 'lib' })));