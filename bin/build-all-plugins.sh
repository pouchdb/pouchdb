#!/bin/sh

LEVEL_BACKEND=memdown \
  OUTPUT_FILENAME=pouchdb.memory.js \
  ./bin/build-plugin.sh

LEVEL_BACKEND=localstorage-down \
  OUTPUT_FILENAME=pouchdb.localstorage.js \
  ./bin/build-plugin.sh

LEVEL_BACKEND=level-js \
  OUTPUT_FILENAME=pouchdb.idb-alt.js \
  ./bin/build-plugin.sh

UGLIFY=./node_modules/uglify-js/bin/uglifyjs

$UGLIFY dist/pouchdb.memory.js -mc > dist/pouchdb.memory.min.js
$UGLIFY dist/pouchdb.localstorage.js -mc > dist/pouchdb.localstorage.min.js
$UGLIFY dist/pouchdb.idb-alt.js -mc > dist/pouchdb.idb-alt.min.js