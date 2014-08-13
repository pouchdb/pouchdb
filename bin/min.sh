#!/bin/bash

BROWSERIFY=./node_modules/.bin/browserify
DEREQUIRE=./node_modules/.bin/derequire
UGLIFY=./node_modules/.bin/uglifyjs
CCJS=./node_modules/.bin/ccjs

# use uglifyify and bundle-collapser for best compression
# for the pre-minified bundle

# then uglify, ccjs, then uglify again for best compression
# (yes really)

$BROWSERIFY \
    -p bundle-collapser/plugin \
    -p uglifyify \
    -s PouchDB . \
    | $DEREQUIRE \
    | $UGLIFY - -mc \
    | $CCJS - --warning_level=QUIET \
    | $UGLIFY - -mc > dist/pouchdb.min.js
