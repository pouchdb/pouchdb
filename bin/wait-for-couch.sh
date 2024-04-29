#!/usr/bin/env -S bash -eu

maxWait="${1:-0}"

printf "Waiting for host to start on %s..." "$COUCH_HOST"

WAITING=0
until [[ '200' = "$(curl -s -o /dev/null -w '%{http_code}' "$COUCH_HOST")" ]]; do
  ((WAITING=WAITING+1))
  if [ $WAITING -eq "$maxWait" ]; then
    printf '\nHost failed to start\n'
    exit 1
  fi
  printf '.'
  sleep 1
done

printf '\nHost started :)'
