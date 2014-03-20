#!/bin/bash

: ${DASH_HOST:="localhost:5984/coverage_results"}
: ${DASH_USER:=""}
: ${DASH_PASS:=""}

COVERAGE=1 npm test;

if [ $DASH_HOST = "" ]; then
  echo "Empty DASH_HOST"
elif [ "$DASH_PASS" = "" ] || [ "$DASH_USER" = "" ]; then
  curl -X POST \
    -sS "http://$DASH_HOST" \
    -H "Content-Type: application/json" \
    -d @coverage/coverage.json
else 
  curl -X POST 
    -sS "http://$DASH_USER:$DASH_PASS@$DASH_HOST" \
    -H "Content-Type: application/json" \
    -d @coverage/coverage.json
fi

