#!/usr/bin/env -S bash -eu

scriptName="$(basename "$0")"
log() { echo "[$scriptName] $*"; }

npm_install() {
  # Don't use npm ci, as it requires package-lock.json to be in sync.  This is
  # probably not the case when switching branches, especially as it's ignored by
  # git.
  npm install --no-fund --ignore-scripts --no-audit --prefer-offline --progress=false
}

mkdir -p ./perf-test-results
flagFileDevServerRunning=./perf-test-results/.dev-server-started
cleanup() {
  if [[ -n ${SERVER_PID-} ]] && ps --pid "$SERVER_PID" >/dev/null; then
    log "Shutting down dev server..."
    kill "$SERVER_PID"
    log "Shutdown complete."
  fi
  ! [[ -f "$flagFileDevServerRunning" ]] || rm "$flagFileDevServerRunning"
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
      [PERF_REPEATS=<N>] $0 ...tree-ish:adapter

EOF
  exit 1
fi

echo
if [[ -z "${PERF_REPEATS-}" ]]; then
  log "Running perf tests ENDLESSLY on:"
else
  log "Running perf tests $PERF_REPEATS times on:"
fi
log
declare -a commits
i=0
for treeish_adapter in "$@"; do
  adapter="${treeish_adapter#*:}"
  treeish="${treeish_adapter%:*}"
  adapters[i]="$adapter"
  commits[i]="$(git rev-parse "$treeish")"
  description="$(git show --oneline --no-patch "$treeish")"
  log "  $((i=i+1)). $adapter: $description ($treeish)"
done
log
log "!!! This may cause strange issues if you have uncomitted changes. !!!"
log
log "Press <enter> to continue."
echo
read -r

./bin/wait-for-couch.sh 20

mkdir -p dist-bundles

log "Building bundles..."
for commit in "${commits[@]}"; do
  targetDir="dist-bundles/$commit"
  if [[ -d "$targetDir" ]]; then
    log "Skipping build for $commit - dist files already found at $targetDir."
  else
    log "Building commit $commit..."
    git checkout "$commit"
    npm_install # in case of different deps on different branches
    npm run build

    mkdir -p "$targetDir"
    cp -r packages/node_modules/pouchdb/dist/. "$targetDir/"

    git checkout -
  fi
done

log "Building tests..."
npm_install # in case of different deps on different branches
npm run build-test

iterate_tests() {
  for i in "${!commits[@]}"; do
    commit="${commits[$i]}"
    adapter="${adapters[$i]}"
    log "Running perf tests on $commit with adapter-$adapter..."
    SRC_ROOT="../../dist-bundles/$commit" \
    JSON_REPORTER=1 \
    TYPE=performance \
    USE_MINIFIED=1 \
    MANUAL_DEV_SERVER=1 \
    ADAPTERS="$adapter" \
    node ./bin/test-browser.js

    sleep 1
  done
}

log "Installing playwright brower..."
npx playwright install "${CLIENT:-firefox}"

log "Starting dev server..."
NO_REBUILD=1 node -e "
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
if [[ -z "${PERF_REPEATS-}" ]]; then
  while true; do
    iterate_tests
  done
else
  while ((PERF_REPEATS-- > 0)); do
    iterate_tests
    log "Iterations remaining: $PERF_REPEATS"
  done
fi

log "All tests complete."
