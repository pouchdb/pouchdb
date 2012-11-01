/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
var requirejs = require('requirejs');
var path = require('path');

requirejs.config({
  paths: {
    'source-map': path.join(__dirname, 'source-map')
  },
  nodeRequire: require
});

requirejs([
  'source-map/source-map-generator',
  'source-map/source-map-consumer',
  'source-map/source-node'
], function (generatorModule, consumerModule, sourceNodeModule) {
  exports.SourceMapGenerator = generatorModule.SourceMapGenerator;
  exports.SourceMapConsumer = consumerModule.SourceMapConsumer;
  exports.SourceNode = sourceNodeModule.SourceNode;
});
