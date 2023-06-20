#!/bin/bash

./packages/node_modules/pouchdb-server/bin/pouchdb-server -m -n -p 5984 $SERVER_ARGS &
POUCHDB_SERVER_PID=$!

COUCH_HOST=http://localhost:5984 TIMEOUT=120000 mocha ./tests/**/* $1

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
