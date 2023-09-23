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

while true; do
  for commit in "$@"; do
    log "Checking out $commit..."
    git checkout "$commit"

    log "Running perf tests on $commit..."
    set -x
    ADAPTERS="${ADAPTERS:-idb}" \
    CLIENT="${CLIENT:-firefox}" \
    COUCH_HOST="${COUCH_HOST:-http://admin:password@127.0.0.1:5984}" \
    JSON_REPORTER=1 \
    PERF=1 \
    npm run test
    set +x

    sleep 1
  done
done

log "All tests complete."
