const path = require('path');

module.exports = {
  entry: './packages/node_modules/pouchdb',
  mode: 'production',
  resolve: {
    fallback: {
      "stream-browserify": false,
      "crypto": false,
      "path": false ,
      "vm": false,
      "stream": false,
      "os": false,
      "fs": false,
    },
  },
  output: {
    library: {
      name: 'PouchDB',
      export: 'default',
      type: 'umd',
    },
    globalObject: 'this',
    path: path.resolve(__dirname, '.'),
    filename: 'pouchdb-webpack.js',
  },
};
