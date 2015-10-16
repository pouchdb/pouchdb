#!/bin/bash -x

# Run PouchDB test suite, expect a global couchdb command to be installed
#
# Run as:
#
# ./scripts/baldrick-test.sh

# tmp directory to store CouchDB data files
TMP=./tmp
COUCH_URI_FILE=$TMP/couch.uri

# Install PouchDB dependancies
npm install

# Provision a CouchDB instance just for this test
./scripts/start_standalone_couch.sh $TMP > /dev/null 2>&1 &
COUCH_PID=$!

# Wait for CouchDB to start by polling for the uri file
# Not nasty at all :)
while [ ! -f $COUCH_URI_FILE ]
do
  sleep 2
done
COUCH_HOST=$(cat $COUCH_URI_FILE)

# Run tests
grunt test --couch-host=$COUCH_HOST
EXIT_STATUS=$?

# Cleanup
kill $COUCH_PID

# Make sure we exit with the right status
exit $EXIT_STATUS