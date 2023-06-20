#!/bin/bash

node ./bin/express-pouchdb-minimum-for-pouchdb.js &
POUCHDB_SERVER_PID=$!

cd ./pouchdb-tests

COUCH_HOST=http://127.0.0.1:6984 TIMEOUT=120000 npm run test-node

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
