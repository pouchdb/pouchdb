// TODO: Switch complet to rollup
var nodeResolve = require('rollup-plugin-node-resolve');
var replace = require('rollup-plugin-replace');
var inject = require('rollup-plugin-inject');

function rollupPlugins(nodeResolveConfig) {
  return [
    nodeResolve(nodeResolveConfig),
    replace({
      // we have switches for coverage; don't ship this to consumers
      'process.env.COVERAGE': JSON.stringify(!!process.env.COVERAGE),
      // test for fetch vs xhr
      'process.env.FETCH': JSON.stringify(!!process.env.FETCH)
    }),
    inject({
      exclude: [
        '**/pouchdb-utils/src/assign.js',
        '**/pouchdb-collections/src/**'
      ],
      Map: ['pouchdb-collections', 'Map'],
      Set: ['pouchdb-collections', 'Set'],
      'Object.assign': ['pouchdb-utils', 'assign']
    })
  ];
}
