'use strict';

var nodeResolve = require('rollup-plugin-node-resolve');
var replace = require('rollup-plugin-replace');
var inject = require('rollup-plugin-inject');

function rollupPlugins(nodeResolveConfig, includePolyfills) {
  return [
    nodeResolve(nodeResolveConfig),
    replace({
      // we have switches for coverage; don't ship this to consumers
      'process.env.COVERAGE': JSON.stringify(!!process.env.COVERAGE),
      // test for fetch vs xhr
      'process.env.FETCH': JSON.stringify(!!process.env.FETCH)
    }),
    includePolyfills && inject({
      exclude: [
        '**/pouchdb-utils/src/assign.js',
        '**/pouchdb-promise/src/index.js',
        '**/pouchdb-collections/src/**'
      ],
      Map: ['pouchdb-collections', 'Map'],
      Set: ['pouchdb-collections', 'Set'],
      'Object.assign': ['pouchdb-utils', 'assign'],
      Promise: 'pouchdb-promise'
    })
  ];
}

module.exports = rollupPlugins;