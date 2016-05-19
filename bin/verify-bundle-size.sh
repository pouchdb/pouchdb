#!/bin/sh

# Max size in bytes that we find acceptable.
# We might have to change this later.
MAX=50000

npm run build
SIZE=`gzip -c packages/pouchdb/dist/pouchdb.min.js | wc -c`

echo "Checking that pouchdb.min.js size $SIZE is less than $MAX"

if [ "$SIZE" -lt "$MAX" ]; then
  echo Success
  exit 0
else
  echo Failure
  exit 1
fi