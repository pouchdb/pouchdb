#!/bin/bash

if [ -z "$LEVEL_BACKEND" ]; then
    echo "Error: must specify LEVEL_BACKEND parameter with build-alt."
    exit 1
fi

../node_modules/.bin/browserify . \
    -r ./index-alt:./index \
    -r $LEVEL_BACKEND:levelalt \
    -s PouchDB \
    -o ../dist/pouchdb-$LEVEL_BACKEND.js