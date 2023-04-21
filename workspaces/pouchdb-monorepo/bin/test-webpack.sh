#!/usr/bin/env bash

#
# Build PouchDB with Webpack instead of Browserify, and test that.
# We have this test because there are enough differences between
# Webpack and Browserify to justify it.
#

npm run build
npm i webpack@5.66.0 -D webpack-cli@4.9.2 # do this on-demand to avoid slow installs
node bin/update-package-json-for-publish.js
./node_modules/.bin/webpack
BUILD_NODE_DONE=0 POUCHDB_SRC='../../pouchdb-webpack.js' npm test
