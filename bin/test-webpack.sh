#!/bin/bash -e

#
# Build PouchDB with Webpack instead of Browserify, and test that.
# We have this test because there are enough differences between
# Webpack and Browserify to justify it.
#

# If this script is run _after_ bin/update-package-json-for-publish.js is run,
# `npm run build` may fail with:
#
# > Error: 'default' is not exported by node_modules/inherits/inherits.js
#
# To avoid this, fail if this script is run in a non-clean git repo:
git_status="$(git status --untracked-files=no --porcelain)"
if [[ "$git_status" != "" ]]; then
  git status --untracked-files=no
  echo "!!!"
  echo "!!! Your git working directory is dirty  !!!"
  echo "!!! Please clean, and re-run the command !!!"
  echo "!!!"
  exit 1
fi

npm run build
npm i webpack@5.66.0 -D webpack-cli@4.9.2 # do this on-demand to avoid slow installs
node bin/update-package-json-for-publish.js
./node_modules/.bin/webpack
BUILD_NODE_DONE=0 POUCHDB_SRC='../../pouchdb-webpack.js' npm test
