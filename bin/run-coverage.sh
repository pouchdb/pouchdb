#!/bin/bash

: ${DASH_HOST:="http://localhost:5984/coverage_results"}
: ${DASH_USER:=""}
: ${DASH_PASS:=""}

COVERAGE=1 npm test;

POST -sS $DASH_HOST -c "application/json" < coverage/coverage.json
