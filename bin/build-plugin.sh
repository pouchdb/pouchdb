#!/bin/bash

if [ -z "$LEVEL_BACKEND" ]; then
    echo "Error: must specify LEVEL_BACKEND parameter."
    exit 1
fi

if [ -z "$OUTPUT_FILENAME" ]; then
    echo "Error: must specify OUTPUT_FILENAME parameter."
    exit 1
fi
DEREQUIRE=./node_modules/.bin/derequire

./node_modules/.bin/browserify lib/plugins/index.js \
    -r $LEVEL_BACKEND \
    -x pouchdb \
    -r ./lib/plugins/config-$LEVEL_BACKEND.js:adapter-config \
    -r ./lib/plugins/migrate-browser.js:migrate \
    | $DEREQUIRE > ./dist/$OUTPUT_FILENAME
