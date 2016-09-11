#!/bin/sh

# Max size in bytes that we find acceptable.
# We might have to change this later.
MAX=50000

SIZE=`gzip -c packages/node_modules/pouchdb/dist/pouchdb.min.js | wc -c`

echo "Checking that pouchdb.min.js size $SIZE is less than $MAX"

if [ "$SIZE" -lt "$MAX" ]; then
  echo Success
  exit 0
else
  echo Failure
  exit 1
fi
