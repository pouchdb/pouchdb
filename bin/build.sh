#!/usr/bin/env bash

RIMRAF=./node_modules/.bin/rimraf
MKDIRP=./node_modules/.bin/mkdirp
BROWSERIFY=./node_modules/.bin/browserify
ROLLUP=./node_modules/.bin/rollup
REPLACE=./node_modules/.bin/replace
DEREQUIRE=./node_modules/.bin/derequire

VERSION=$(node -e "console.log(require('./package.json').version)")

$RIMRAF lib_staging
$MKDIRP lib_staging

EXTERNAL='argsarray,crypto,debug,double-ended-queue,es3ify,events,fruitdown,fs,inherits,inherits,js-extend,level-sublevel,level-sublevel/legacy,level-write-stream,levelup,lie,localstorage-down,memdown,path,pouchdb,pouchdb-collate,pouchdb-collections,request,scope-eval,spark-md5,through2,vuvuzela'

# build for Node

$ROLLUP --format=cjs --external $EXTERNAL \
  src/index.js \
  --output=lib_staging/index.js

# build for browserify/webpack

$RIMRAF src_browser
cp -r src src_browser

for file in `find src_browser | grep '\-browser.js'`; do
  cp $file `echo $file | sed 's/-browser//g'`;
done

$ROLLUP --format=cjs --external $EXTERNAL \
  src_browser/index.js \
  --output=lib_staging/index-browser.js

# add a version number to both files
$REPLACE --silent __VERSION__ $VERSION lib_staging/*

# rename to avoid concurrency issues in dev server
$MKDIRP lib
mv lib_staging/* lib/
$RIMRAF lib_staging

echo Built lib/*

# build for the browser (dist)

$BROWSERIFY . -s PouchDB -p bundle-collapser/plugin \
  | node ./bin/es3ify.js \
  | $DEREQUIRE \
  > dist/pouchdb.js

echo Built dist/pouchdb.js

# build browser plugins

$MKDIRP lib_staging/plugins

for plugin in fruitdown localstorage memory; do
  $ROLLUP --format=cjs --external $EXTERNAL \
    src_browser/plugins/${plugin}/index.js \
    > lib_staging/plugins/${plugin}.js
done

$MKDIRP lib/plugins
mv lib_staging/plugins/* lib/plugins/
$RIMRAF lib_staging

echo Built lib/plugins/*

# build extras API

$MKDIRP lib_staging/extras

$ROLLUP --format=cjs --external $EXTERNAL \
    src_browser/deps/promise.js \
    > lib_staging/extras/promise.js

$ROLLUP --format=cjs --external $EXTERNAL \
    src_browser/replicate/checkpointer.js \
    > lib_staging/extras/checkpointer.js

$ROLLUP --format=cjs --external $EXTERNAL \
    src_browser/deps/ajax/prequest.js \
    > lib_staging/extras/ajax.js

$ROLLUP --format=cjs --external $EXTERNAL \
    src_browser/replicate/generateReplicationId.js \
    > lib_staging/extras/generateReplicationId.js

$MKDIRP lib/extras
mv lib_staging/extras/* lib/extras/
$RIMRAF lib_staging

echo Built lib/extras/*

# cleanup
$RIMRAF src_browser