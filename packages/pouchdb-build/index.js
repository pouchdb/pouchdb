#!/usr/bin/env node

var rollup = require('rollup').rollup;
var nodeResolve = require('rollup-plugin-node-resolve');

var isBrowser = process.argv.indexOf('browser') !== -1;

rollup({
  entry: isBrowser ? './src/index-browser.js' : './src/index.js',
  plugins: [
    nodeResolve({
      jsnext: true,  // Default: false
      browser: isBrowser
    })
  ]
}).then(function (bundle) {
  var code = bundle.generate({
    format: 'cjs'
  }).code;
  console.log(code);
}).catch(console.log.bind(console));
