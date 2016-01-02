#!/usr/bin/env bash

#
# This script builds `src` to `lib` in a modular style that preserves the
# original file structure. This is useful for things like 1) unit tests, which
# need to "reach inside" the bundle, and 2) coverage reports, which need to be
# able to run all tests against the codebase, including the unit tests.
#

npm run build

# In this case, Babel is roughly equivalent to what Rollup would do.
# "add-module-exports" gives us a backwards-compatible CJS module structure
# that doesn't oblige use to do require('foo').default for every module.

./node_modules/.bin/babel \
  --plugins add-module-exports,transform-es2015-modules-commonjs \
  --out-dir lib src

# Add a version number to both files (equivalent to build.sh)

VERSION=$(node -e "console.log(require('./package.json').version)")
./node_modules/.bin/replace --silent __VERSION__ $VERSION lib/*

# Make the extras point back to the modular code (instead of being bundles).

echo "module.exports = require('../deps/promise');" \
    > lib/extras/promise.js

echo "module.exports = require('../replicate/checkpointer');" \
    > lib/extras/checkpointer.js

echo "module.exports = require('../deps/ajax/prequest');" \
    > lib/extras/ajax.js

echo "module.exports = require('../replicate/generateReplicationId');" \
    > lib/extras/generateReplicationId.js