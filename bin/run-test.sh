#!/usr/bin/env -S bash -e
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

pouchdb-setup-server() {
  # in CI, link pouchdb-servers dependencies on pouchdb
  # modules to the current implementations
  if [ -d "pouchdb-server-install" ]; then
    rm -rf pouchdb-server-install
  fi
  mkdir pouchdb-server-install
  cd pouchdb-server-install
  npm init -y
  npm install pouchdb-server
  cd ..

  for pkg in packages/node_modules/* ; do
    pouchdb-link-server-modules "$(basename "$pkg")"
  done

  TESTDIR=./tests/pouchdb_server
  rm -rf $TESTDIR && mkdir -p $TESTDIR
  FLAGS=("$POUCHDB_SERVER_FLAGS" --dir "$TESTDIR")
  echo -e "Starting up pouchdb-server with flags: ${FLAGS[*]} \n"
  ./pouchdb-server-install/node_modules/.bin/pouchdb-server -n -p 6984 "${FLAGS[@]}" &
  export SERVER_PID=$!
}

pouchdb-link-server-modules() {
  local pkg="$1"

  cd "packages/node_modules/${pkg}"
  npm link
  cd ../../../pouchdb-server-install/

  # node_modules of pouchdb-server-install
  if [ -d "node_modules/${pkg}" ]; then
    echo -e "\nnpm link ${pkg} for pouchdb-server-install"
    npm link "${pkg}"
  fi

  # internal node_modules of other packages
  for subPkg in node_modules/**/node_modules/"$pkg"; do
    cd "$subPkg/../.."
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

if [[ $CI = true ]] && [[ $CLIENT != node ]]; then
  npx playwright install --with-deps "$CLIENT"
fi

if [[ -n $SERVER ]]; then
  if [ "$SERVER" == "pouchdb-server" ]; then
    export COUCH_HOST='http://127.0.0.1:6984'
    if [[ -n "$GITHUB_REPOSITORY" || "$COVERAGE" == 1 ]]; then
      pouchdb-setup-server
    else
      echo -e "pouchdb-server should be running on $COUCH_HOST\n"
    fi
  elif [ "$SERVER" == "couchdb-master" ]; then
    if [ -z "$COUCH_HOST" ]; then
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

./bin/wait-for-couch.sh 20

if [ "$SERVER" == "couchdb-master" ]; then
  printf '\nEnabling CORS...'
  ./node_modules/.bin/add-cors-to-couchdb "$COUCH_HOST"
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
