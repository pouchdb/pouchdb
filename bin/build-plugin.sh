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
    -r ./lib/plugins/migrate-browser.js:../deps/migrate \
    -r ./lib/plugins/migrate-browser.js:../adapters/../deps/migrate \
    -o ./dist/$OUTPUT_FILENAME
