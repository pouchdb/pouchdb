#!/bin/bash

if [ -z "$LEVEL_BACKEND" ]; then
    echo "Error: must specify LEVEL_BACKEND parameter."
    exit 1
fi

if [ -z "$OUTPUT_FILENAME" ]; then
    echo "Error: must specify OUTPUT_FILENAME parameter."
    exit 1
fi

./node_modules/.bin/browserify lib/plugins/index.js \
    -r $LEVEL_BACKEND:leveldown \
    -r ./lib/plugins/config-$LEVEL_BACKEND.js:adapter-config \
    -r ./lib/plugins/utils-browser.js:../utils \
    -r ./lib/plugins/utils-browser.js:../adapters/../utils \
    -r ./lib/plugins/merge-browser.js:../merge \
    -r ./lib/plugins/merge-browser.js:../adapters/../merge \
    -r ./lib/plugins/errors-browser.js:../deps/errors \
    -r ./lib/plugins/errors-browser.js:../adapters/../deps/errors \
    -r ./lib/plugins/migrate-browser.js:../deps/migrate \
    -r ./lib/plugins/migrate-browser.js:../adapters/../deps/migrate \
    -r ./lib/plugins/events-browser.js:events \
    -o ./dist/$OUTPUT_FILENAME