#!/bin/sh

# Max size in bytes that we find acceptable.
# We might have to change this later.
MAX=50000

# testing pouchdb.js instead of pouchdb.min.js because minification isn't run in Travis
# in order to make our builds faster
SIZE=`./node_modules/.bin/uglifyjs -mc < packages/node_modules/pouchdb/dist/pouchdb.js 2>/dev/null | gzip -c | wc -c`

echo "Checking that pouchdb.min.js size $SIZE is less than $MAX and greater than 20"

if [ "$SIZE" -lt 21 ]; then
  echo Failure
  exit 1
elif [ "$SIZE" -lt "$MAX" ]; then
  echo Success
  exit 0
else
  echo Failure
  exit 1
fi
