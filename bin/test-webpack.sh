#!/usr/bin/env bash

#
# Build PouchDB with Webpack instead of Browserify, and test that.
# We have this test because there are enough differences between
# Webpack and Browserify to justify it.
#

npm run build
./node_modules/.bin/webpack \
  --module-bind json \
  --output-library PouchDB --output-library-target umd \
  . pouchdb-webpack.js
POUCHDB_SRC='../../pouchdb-webpack.js' npm test