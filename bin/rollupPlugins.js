'use strict';

var nodeResolve = require('rollup-plugin-node-resolve');
var replace = require('rollup-plugin-replace');

function rollupPlugins(nodeResolveConfig) {
  return [
    nodeResolve(nodeResolveConfig),
    replace({
      // we have switches for coverage; don't ship this to consumers
      'process.env.COVERAGE': JSON.stringify(!!process.env.COVERAGE),
      // test for fetch vs xhr
      'process.env.FETCH': JSON.stringify(!!process.env.FETCH)
    })
  ];
}

module.exports = rollupPlugins;
