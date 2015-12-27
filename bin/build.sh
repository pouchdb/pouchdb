#!/usr/bin/env bash

RIMRAF=./node_modules/.bin/rimraf
MKDIRP=./node_modules/.bin/mkdirp
BROWSERIFY=./node_modules/.bin/browserify
ROLLUP=./node_modules/.bin/rollup
REPLACE=./node_modules/.bin/replace
DEREQUIRE=./node_modules/.bin/derequire

VERSION=$(node -e "console.log(require('./package.json').version)")

$RIMRAF lib
$MKDIRP lib

EXTERNAL='argsarray,crypto,debug,double-ended-queue,es3ify,events,fruitdown,fs,inherits,inherits,js-extend,level-sublevel,level-sublevel/legacy,level-write-stream,levelup,lie,localstorage-down,memdown,path,pouchdb-collate,pouchdb-collections,request,spark-md5,through2,vuvuzela'

# build for Node

$ROLLUP --format=cjs --external $EXTERNAL \
  src/index.js \
  --output=lib/index.js

# build for browserify/webpack

$RIMRAF src_browser
cp -r src src_browser

for file in `find src_browser | grep '\-browser.js'`; do
  cp $file `echo $file | sed 's/-browser//g'`;
done

$ROLLUP --format=cjs --external $EXTERNAL \
  src_browser/index.js \
  --output=lib/index-browser.js

# add a version number to both files
$REPLACE 5.1.1-prerelease $VERSION lib/*

# build for the browser (dist)

$BROWSERIFY . -s PouchDB -p bundle-collapser/plugin \
  | node ./bin/es3ify.js \
  | $DEREQUIRE \
  > dist/pouchdb.js

# build browser plugins

$MKDIRP lib/plugins

for plugin in fruitdown localstorage memory; do
  $ROLLUP --format=cjs --external $EXTERNAL \
    src_browser/plugins/${plugin}/index.js \
    > lib/plugins/${plugin}.js
done

# cleanup
$RIMRAF src_browser