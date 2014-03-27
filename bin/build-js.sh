#!/bin/bash

if [ -n "$LEVEL_BACKEND" ]; then
    node_modules/.bin/browserify lib/index-levelalt.js \
      --require ./lib/index:./lib/index-levelalt.js \
      --standalone PouchDB \
      --outfile dist/pouchdb-$LEVEL_BACKEND.js

    node_modules/.bin/uglifyjs dist/pouchdb-$LEVEL_BACKEND.js -mc \
      > dist/pouchdb-$LEVEL_BACKEND.min.js
else
    node_modules/.bin/browserify lib/index.js \
      --exclude ./adapters/leveldb \
      --exclude ./adapters/levelalt \
      --ignore levelup \
      --ignore crypto \
      --ignore level-sublevel \
      --standalone PouchDB \
      --outfile dist/pouchdb-nightly.js
    
    node_modules/.bin/uglifyjs dist/pouchdb-nightly.js -mc \
      > dist/pouchdb-nightly.min.js
fi
