#!/bin/bash -e
shopt -s nullglob

cleanup() {
  if [[ -n $SERVER_PID ]]; then
    kill "$SERVER_PID"
  fi
}
trap cleanup EXIT

# Run tests against a local setup of pouchdb-express-router
# by default unless COUCH_HOST is specified.
if [ -z "$COUCH_HOST" ] && [ -z "$SERVER"  ]; then
  SERVER="pouchdb-express-router"
fi

: "${CLIENT:=node}"
: "${COUCH_HOST:=http://127.0.0.1:5984}"
: "${VIEW_ADAPTERS:=memory}"
export VIEW_ADAPTERS

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

if [[ $CI = true ]] && [[ $CLIENT != node ]]; then
  npx playwright install --with-deps "$CLIENT"
fi

if [[ -n $SERVER ]]; then
  if [ "$SERVER" == "couchdb-master" ]; then
    if [ -z $COUCH_HOST ]; then
      export COUCH_HOST="http://127.0.0.1:5984"
    fi
  elif [ "$SERVER" == "pouchdb-express-router" ]; then
    pouchdb-build-node
    search-free-port
    node ./tests/misc/pouchdb-express-router.js &
    export SERVER_PID=$!
    export COUCH_HOST="http://127.0.0.1:${PORT}"
  else
    echo -e "Unknown SERVER $SERVER.\n"
    exit 1
  fi
fi

./bin/wait-for-couch.sh 20

if [ "$SERVER" == "couchdb-master" ]; then
  printf '\nEnabling CORS...'
  ./node_modules/.bin/add-cors-to-couchdb $COUCH_HOST
fi

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
