#!/bin/bash

: ${CLIENT:="node"}
: ${COUCH_HOST:="http://127.0.0.1:5984"}

if [[ ! -z $SERVER ]]; then
  if [ "$SERVER" == "pouchdb-server" ]; then
    if [[ "$TRAVIS_REPO_SLUG" == "pouchdb/pouchdb" ]]; then
      # for pouchdb-server to link to pouchdb, only in travis
      rm -fr ./node_modules/pouchdb-server/node_modules/pouchdb
      ln -s ../../.. ./node_modules/pouchdb-server/node_modules/pouchdb
    fi
    export COUCH_HOST='http://127.0.0.1:6984'
    TESTDIR=./tests/pouchdb_server
    rm -rf $TESTDIR && mkdir -p $TESTDIR
    FLAGS="--dir $TESTDIR"
    if [[ ! -z $SERVER_ADAPTER ]]; then
      FLAGS="$FLAGS --level-backend $SERVER_ADAPTER"
    fi
    if [[ ! -z $SERVER_PREFIX ]]; then
      FLAGS="$FLAGS --level-prefix $SERVER_PREFIX"
    fi
    echo -e "Starting up pouchdb-server with flags: $FLAGS \n"
    ./node_modules/.bin/pouchdb-server -n -p 6984 $FLAGS &
    export SERVER_PID=$!
  elif [ "$SERVER" == "couchdb-master" ]; then
    if [ -z $COUCH_HOST ]; then
      export COUCH_HOST='http://127.0.0.1:15984'
    fi
  elif [ "$SERVER" == "pouchdb-express-router" ]; then
    node ./tests/misc/pouchdb-express-router.js &
    export SERVER_PID=$!
    export COUCH_HOST='http://127.0.0.1:3000'
  elif [ "$SERVER" == "express-pouchdb-minimum" ]; then
    node ./tests/misc/express-pouchdb-minimum-for-pouchdb.js &
    export SERVER_PID=$!
    export COUCH_HOST='http://127.0.0.1:3000'
  elif [ "$SERVER" == "sync-gateway" ]; then
    if [[ -z $COUCH_HOST ]]; then
      export COUCH_HOST='http://127.0.0.1:4985'
    fi
    if [[ "$TRAVIS_REPO_SLUG" == "pouchdb/pouchdb" ]]; then
      ./bin/run-csg-on-travis.sh
    fi
    node ./tests/misc/sync-gateway-config-server.js &
    # not the Sync Gateway pid, the config server pid
    export SERVER_PID=$!
  else
    # I mistype pouchdb-server a lot
    echo -e "Unknown SERVER $SERVER. Did you mean pouchdb-server?\n"
    exit 1
  fi
fi

printf 'Waiting for host to start .'
WAITING=0
until $(curl --output /dev/null --silent --head --fail --max-time 2 $COUCH_HOST); do
    if [ $WAITING -eq 4 ]; then
        printf '\nHost failed to start\n'
        exit 1
    fi
    let WAITING=WAITING+1
    printf '.'
    sleep 5
done
printf '\nHost started :)'

if [ "$CLIENT" == "unit" ]; then
    npm run test-unit
elif [ "$CLIENT" == "node" ]; then
    npm run test-node
elif [ "$CLIENT" == "dev" ]; then
    npm run launch-dev-server
else
    npm run test-browser
fi

EXIT_STATUS=$?
if [[ ! -z $SERVER_PID ]]; then
  kill $SERVER_PID
fi
exit $EXIT_STATUS
