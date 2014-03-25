#!/bin/bash

if [ "$LEVEL_BACKEND" == "leveljs" ]; then
    browserify lib/index-levelalt.js \
      --require ./lib/index:./lib/index-levelalt.js \
      --standalone PouchDB \
      --outfile dist/pouchdb-$LEVEL_BACKEND.js

    uglifyjs dist/pouchdb-$LEVEL_BACKEND.js -mc \
      > dist/pouchdb-$LEVEL_BACKEND.min.js
else
    browserify lib/index.js \
      --exclude ./adapters/leveldb \
      --exclude ./adapters/levelalt \
      --ignore levelup \
      --ignore crypto \
      --ignore level-sublevel \
      --standalone PouchDB \
      --outfile dist/pouchdb-nightly.js
    
    uglifyjs dist/pouchdb-nightly.js -mc \
      > dist/pouchdb-nightly.min.js
fi
