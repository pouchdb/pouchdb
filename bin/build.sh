#!/usr/bin/env bash

./node_modules/.bin/rimraf lib
./node_modules/.bin/mkdirp lib


EXTERNAL='argsarray,crypto,debug,double-ended-queue,es3ify,events,fruitdown,fs,inherits,inherits,js-extend,level-sublevel,level-write-stream,levelup,lie,localstorage-down,memdown,path,pouchdb-collate,pouchdb-collections,request,spark-md5,through2,vuvuzela'

./node_modules/.bin/rollup --format=cjs --external $EXTERNAL \
  --output=lib/index.js \
  src/index.js


./node_modules/.bin/rimraf src_browser
./node_modules/.bin/ncp src src_browser

for file in `find src_browser | grep '\-browser.js'`; do
  mv $file `echo $file | sed 's/-browser//g'`;
done

./node_modules/.bin/rollup  --format=cjs --external $EXTERNAL \
  --output=lib/index-browser.js \
  src_browser/index.js

./node_modules/.bin/rimraf src_browser

./node_modules/.bin/browserify . -s PouchDB -p bundle-collapser/plugin | node ./bin/es3ify.js | derequire > dist/pouchdb.js