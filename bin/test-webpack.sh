#!/usr/bin/env bash

#
# Build PouchDB with Webpack instead of Browserify, and test that.
# We have this test because there are enough differences between
# Webpack and Browserify to justify it.
#

npm run build
npm install webpack@1.13.1 # do this on-demand to avoid slow installs
./node_modules/.bin/webpack \
  --output-library PouchDB --output-library-target umd \
  ./packages/pouchdb pouchdb-webpack.js
POUCHDB_SRC='../../pouchdb-webpack.js' npm test
