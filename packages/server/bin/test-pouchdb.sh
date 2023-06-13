#!/bin/bash

./packages/node_modules/pouchdb-server/bin/pouchdb-server -n -p 6984 $SERVER_ARGS &
POUCHDB_SERVER_PID=$!

cd ./pouchdb-tests

COUCH_HOST=http://localhost:6984 TIMEOUT=120000 npm run test-node

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS