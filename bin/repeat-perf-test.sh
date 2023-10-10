#!/bin/bash -eu

scriptName="$(basename "$0")"
log() { echo "[$scriptName] $*"; }

mkdir -p ./perf-test-results
flagFileDevServerRunning=./perf-test-results/.dev-server-started
cleanup() {
  if [[ -n ${SERVER_PID-} ]] && ps --pid "$SERVER_PID"; then
    log "Shutting down dev server..."
    kill "-$SERVER_PID"
    log "Shutdown complete."
  fi
  rm "$flagFileDevServerRunning"
}
trap cleanup EXIT

if [[ -f "$flagFileDevServerRunning" ]]; then
  log "!!!"
  log "!!! Cannot start tests - flag file already exists at $flagFileDevServerRunning"
  log "!!! Are tests running in another process?"
  log "!!!"
  exit 1
fi

if [[ "$#" -lt 1 ]]; then
  cat <<EOF

    DESCRIPTION
      Repeatedly run the performance test suite against one or more versions of the codebase.

    USAGE
      $scriptName ...tree-ish

EOF
  exit 1
fi

echo
if [[ -z "${TEST_ITERATIONS-}" ]]; then
  log "Running perf tests endlessly on:"
else
  log "Running perf tests $TEST_ITERATIONS times on:"
fi
log
declare -a commits
i=0
for treeish in "$@"; do
  commits[i]="$(git rev-parse "$treeish")"
  log "  $((i=i+1)). $(git show --oneline --no-patch "$treeish") ($treeish)"
done
log
log "Press <enter> to continue."
echo
read -r

mkdir -p dist-bundles

log "Building bundles..."
for commit in "${commits[@]}"; do
  targetDir="dist-bundles/$commit"
  if [[ -d "$targetDir" ]]; then
    log "Skipping build for $commit - dist files already found at $targetDir."
  else
    log "Building commit $commit..."
    git checkout "$commit"
    npm run build

    mkdir -p "$targetDir"
    cp -r packages/node_modules/pouchdb/dist/. "$targetDir/"

    git checkout -
  fi
done

log "Building tests..."
npm run build-test

iterate_tests() {
  log "Pausing..."
  read -r
  for commit in "${commits[@]}"; do
    log "Running perf tests on $commit..."
    set -x
    SRC_ROOT="../../dist-bundles/$commit" \
    JSON_REPORTER=1 \
    PERF=1 \
    USE_MINIFIED=1 \
    MANUAL_DEV_SERVER=1 \
    NO_REBUILD_POUCHDB=1 \
    node ./bin/test-browser.js
    set +x

    sleep 1
  done
}

log "Starting dev server..."
NO_REBUILD_POUCHDB=1 node -e "
const { start } = require('./bin/dev-server.js');
start(() => {
  console.log('[$scriptName] Dev server ready.');
  require('fs').writeFileSync('$flagFileDevServerRunning', '');
});
" &
SERVER_PID=$!

until [[ -f "$flagFileDevServerRunning" ]]; do sleep 1; done
log "Dev server started OK!"

log "Running tests..."
if [[ -z "${TEST_ITERATIONS-}" ]]; then
  while true; do
    iterate_tests
  done
else
  while ((TEST_ITERATIONS-- > 0)); do
    iterate_tests
    log "Iterations remaining: $TEST_ITERATIONS"
  done
fi

log "All tests complete."
