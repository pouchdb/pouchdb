#!/bin/sh

DEREQUIRE=./node_modules/.bin/derequire
BROWSERIFY=./node_modules/.bin/browserify
UGLIFY=./node_modules/.bin/uglifyjs

for plugin in memory localstorage idb-alt; do
  $BROWSERIFY ./extras/${plugin} \
      -x pouchdb \
      -p bundle-collapser/plugin \
      | ./bin/es3ify.js \
      | $DEREQUIRE > ./dist/pouchdb.${plugin}.js
  $UGLIFY dist/pouchdb.${plugin}.js -mc > dist/pouchdb.${plugin}.min.js
done