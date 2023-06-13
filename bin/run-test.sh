#!/bin/bash -e

# Run tests against a local setup of pouchdb-express-router
# by default unless COUCH_HOST is specified.
[ -z "$COUCH_HOST" -a -z "$SERVER"  ] && SERVER="pouchdb-express-router"

: ${CLIENT:="node"}
: ${COUCH_HOST:="http://127.0.0.1:5984"}
: ${VIEW_ADAPTERS:="memory"}
export VIEW_ADAPTERS

pouchdb-setup-server() {
  # in CI, link pouchdb-servers dependencies on pouchdb
  # modules to the current implementations
  if [ -d "pouchdb-server-install" ]; then
    # pouchdb server already running
    exit 0
  fi
  mkdir pouchdb-server-install
  cd pouchdb-server-install
  npm init -y
  npm install pouchdb-server
  cd ..

  for pkg in packages/* ; do
    pouchdb-link-server-modules "$(basename "$pkg")"
  done

  TESTDIR=./tests/pouchdb_server
  rm -rf $TESTDIR && mkdir -p $TESTDIR
  FLAGS="$POUCHDB_SERVER_FLAGS --dir $TESTDIR"
  echo -e "Starting up pouchdb-server with flags: $FLAGS \n"
  ./pouchdb-server-install/node_modules/.bin/pouchdb-server -n -p 6984 $FLAGS &
  export SERVER_PID=$!
}

pouchdb-link-server-modules() {
  local pkg="$1"

  cd "packages/${pkg}"
  npm link
  cd ../../../pouchdb-server-install/

  # node_modules of pouchdb-server-install
  if [ -d "node_modules/${pkg}" ]; then
    echo -e "\nnpm link ${pkg} for pouchdb-server-install"
    npm link "${pkg}"
  fi

  # internal node_modules of other packages
  for subPkg in $(ls -d node_modules/**/node_modules/${pkg}/ 2>/dev/null); do
    cd ${subPkg}../..
    echo -e "\nnpm link ${pkg} for ${subPkg}"
    npm link "${pkg}"
    cd ../..
  done

  cd ..
}

search-free-port() {
  EXPRESS_PORT=3000
  while (: < /dev/tcp/127.0.0.1/$EXPRESS_PORT) 2>/dev/null; do
    ((EXPRESS_PORT++))
  done
  export PORT=$EXPRESS_PORT
}

pouchdb-build-node() {
  if [[ $BUILD_NODE_DONE -ne 1 ]]; then
    npm run build-node
    BUILD_NODE_DONE=1
  fi
}

if [[ ! -z $SERVER ]]; then
  if [ "$SERVER" == "pouchdb-server" ]; then
    export COUCH_HOST='http://127.0.0.1:6984'
    if [[ -n "$GITHUB_REPOSITORY" || "$COVERAGE" == 1 ]]; then
      pouchdb-setup-server
    else
      echo -e "pouchdb-server should be running on $COUCH_HOST\n"
    fi
  elif [ "$SERVER" == "couchdb-master" ]; then
    if [ -z $COUCH_HOST ]; then
      export COUCH_HOST="http://127.0.0.1:5984"
    fi
  elif [ "$SERVER" == "pouchdb-express-router" ]; then
    pouchdb-build-node
    search-free-port
    node ./tests/misc/pouchdb-express-router.js &
    export SERVER_PID=$!
    export COUCH_HOST="http://127.0.0.1:${PORT}"
  elif [ "$SERVER" == "express-pouchdb-minimum" ]; then
    pouchdb-build-node
    node ./tests/misc/express-pouchdb-minimum-for-pouchdb.js &
    export SERVER_PID=$!
    export COUCH_HOST='http://127.0.0.1:3000'
  else
    # I mistype pouchdb-server a lot
    echo -e "Unknown SERVER $SERVER. Did you mean pouchdb-server?\n"
    exit 1
  fi
fi

if [ "$SERVER" == "couchdb-master" ]; then
  while [ '200' != $(curl -s -o /dev/null -w %{http_code} ${COUCH_HOST}) ]; do
    echo waiting for couch to load... ;
    sleep 1;
  done

  ./node_modules/.bin/add-cors-to-couchdb $COUCH_HOST
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
    pouchdb-build-node
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
