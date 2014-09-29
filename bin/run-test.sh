#!/bin/bash

: ${CLIENT:="node"}

if [[ ! -z $SERVER ]]; then
  if [ "$SERVER" == "pouchdb-server" ]; then
    if [[ "$TRAVIS_REPO_SLUG" == "pouchdb/pouchdb" ]]; then
      # for pouchdb-server to link to pouchdb, only in travis
      rm -fr ./node_modules/pouchdb-server/node_modules/pouchdb
      ln -s ../../.. ./node_modules/pouchdb-server/node_modules/pouchdb
    fi
    export COUCH_HOST='http://127.0.0.1:6984'
    echo -e "Starting up pouchdb-server\n"
    TESTDIR=./tests/pouchdb_server
    rm -rf $TESTDIR && mkdir -p $TESTDIR
    if [[ "$SERVER_ADAPTER" == "memory" ]]; then
      FLAGS='--in-memory'
    else
      FLAGS="-d $TESTDIR"
    fi
    ./node_modules/.bin/pouchdb-server -p 6984 $FLAGS &
    export POUCHDB_SERVER_PID=$!
    sleep 15 # give it a chance to start up
  else
    # I mistype pouchdb-server a lot
    echo -e "Unknown SERVER $SERVER. Did you mean pouchdb-server?\n"
    exit 1
  fi
fi

if [ "$CLIENT" == "unit" ]; then
    npm run test-unit
elif [ "$CLIENT" == "node" ]; then
    npm run test-node
else
    npm run test-browser
fi

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then 
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
