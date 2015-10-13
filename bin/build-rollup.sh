#!/usr/bin/env bash

rm -fr lib_staging

cp -r lib lib_staging

for file in `find lib_staging | grep '\-browser.js'`; do
  mv -f $file `echo $file | sed 's/-browser//g'`;
done


./node_modules/.bin/rollup \
  --name PouchDB --format umd \
  --external events,inherits,argsarray,debug,double-ended-queue,es3ify,fruitdown,inherits,level-sublevel,level-write-stream,levelup,lie,localstorage-down,memdown,pouchdb-collate,pouchdb-collections,request,spark-md5,through2,vuvuzela \
  lib_staging/index.js > dist/pouchdb.js
