#!/bin/bash -eu

scriptName="$(basename "$0")"
log() { echo "[$scriptName] $*"; }

if [[ "$#" -lt 1 ]]; then
  cat <<EOF

    DESCRIPTION
      Repeatedly run the performance test suite against one or more versions of the codebase.

    USAGE
      $scriptName ...commits

EOF
  exit 1
fi

echo
log "Running perf tests endlessly on:"
log
i=0
for commit in "$@"; do
  log "  $((i=i+1)). $(git show --oneline --no-patch "$commit")"
done
log
log "Press <enter> to continue."
echo
read -r

mkdir -p dist-bundles

log "Building bundles..."
for commit in "$@"; do
  log "Checking out $commit..."
  git checkout "$commit"
  npm run build

  targetDir="dist-bundles/$commit"
  mkdir -p "$targetDir"
  cp -r packages/node_modules/pouchdb/dist/. "$targetDir/"

  git checkout -
done

log "Building tests..."
npm run build-test

while true; do
  for commit in "$@"; do
    log "Checking out $commit..."
    git checkout "$commit"

    log "Running perf tests on $commit..."
    set -x
    SRC_ROOT="../../dist-bundles/$commit" \
    ADAPTERS="${ADAPTERS:-idb}" \
    CLIENT="${CLIENT:-firefox}" \
    COUCH_HOST="${COUCH_HOST:-http://admin:password@127.0.0.1:5984}" \
    JSON_REPORTER=1 \
    PERF=1 \
    node ./bin/test-browser.js
    set +x

    sleep 1
  done
done

log "All tests complete."
