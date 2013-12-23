#!/bin/bash

# Tests browser/node with a temporarily created standalone couch. Uses
# `scripts/start_standalone_couch.sh` to run a couchdb server instance on the
# fly.
# Run as:
#
#     ./scripts/test-with-standalone-couch [browser|node]
#
# The default environment is browser.

COUCH_DIR=/tmp/pouchdb/couch-standalone-$RANDOM
COUCH_URI_FILE=$COUCH_DIR/couch.uri
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

$DIR/start_standalone_couch.sh $COUCH_DIR &
COUCH_PID=$!

while [[ ! -f $COUCH_URI_FILE ]]
do
    # Waiting for couchdb to boot up
    sleep 1
done

export COUCH_HOST=`cat $COUCH_URI_FILE`
$DIR/../bin/test-${1:-"browser"}.js

kill $COUCH_PID &> /dev/null
rm -r $COUCH_DIR
