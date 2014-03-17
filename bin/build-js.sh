#!/bin/bash

: ${INDEX_FILE:="index.js"}

if [ "$INDEX_FILE" == "index-levelalt.js" ]; then
    node_modules/.bin/browserify lib/index-levelalt.js \
      --require ./lib/index:./lib/index-levelalt.js \
      --standalone PouchDB \
      --outfile dist/pouchdb-nightly.js
else
    node_modules/.bin/browserify lib/index.js \
      --exclude ./adapters/leveldb \
      --exclude ./adapters/levelalt \
      --ignore levelup \
      --ignore crypto \
      --ignore level-sublevel \
      --standalone PouchDB \
      --outfile dist/pouchdb-nightly.js
fi
