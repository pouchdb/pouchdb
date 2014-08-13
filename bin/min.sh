#!/bin/bash

UGLIFY=./node_modules/.bin/uglifyjs
CCJS=./node_modules/.bin/ccjs

# best compression is to uglify, then ccjs, then uglify again
# (yes really)

$UGLIFY dist/pouchdb.js -mc > dist/pouchdb-1.js
$CCJS dist/pouchdb-1.js --warning_level=QUIET > dist/pouchdb-2.js
$UGLIFY dist/pouchdb-2.js -mc > dist/pouchdb.min.js
rm -f dist/pouchdb-1.js dist/pouchdb-2.js
