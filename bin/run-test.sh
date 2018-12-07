#!/bin/bash

: ${CLIENT:="node"}
: ${COUCH_HOST:="http://127.0.0.1:5984"}

if [[ ! -z $SERVER ]]; then
  if [ "$SERVER" == "pouchdb-server" ]; then
    export COUCH_HOST='http://127.0.0.1:6984'
    if [[ "$TRAVIS_REPO_SLUG" == "pouchdb/pouchdb" || "$COVERAGE" == 1 ]]; then
      # in travis, link pouchdb-servers dependencies on pouchdb
      # modules to the current implementations
      mkdir pouchdb-server-install
      cd pouchdb-server-install
      npm init -y
      npm install pouchdb-server
      cd ..
      PKGS=$(ls packages/node_modules);
      for pkg in $PKGS; do
        cd packages/node_modules/${pkg}
        npm link
        cd ../../../pouchdb-server-install/
        # node_modules of pouchdb-server-install
        if [ -d "node_modules/${pkg}" ]; then
          echo -e "\nnpm link ${pkg} for pouchdb-server-install"
        npm link ${pkg}
        fi
        # internal node_modules of other packages
        for subPkg in $(ls -d node_modules/**/node_modules/${pkg}/ 2>/dev/null); do
          cd ${subPkg}../..
          echo -e "\nnpm link ${pkg} for ${subPkg}"
        npm link ${pkg}
          cd ../..
        done
        cd ..
      done
      TESTDIR=./tests/pouchdb_server
      rm -rf $TESTDIR && mkdir -p $TESTDIR
      FLAGS="$POUCHDB_SERVER_FLAGS --dir $TESTDIR"
      echo -e "Starting up pouchdb-server with flags: $FLAGS \n"
      ./pouchdb-server-install/node_modules/.bin/pouchdb-server -n -p 6984 $FLAGS &
      export SERVER_PID=$!
    else
      echo -e "pouchdb-server should be running on $COUCH_HOST\n"
    fi
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
  else
    # I mistype pouchdb-server a lot
    echo -e "Unknown SERVER $SERVER. Did you mean pouchdb-server?\n"
    exit 1
  fi
fi

if [ ! -z $TRAVIS ]; then
  source ./bin/run-couchdb-on-travis.sh
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
