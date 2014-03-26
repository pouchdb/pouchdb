#!/bin/bash

: ${TIMEOUT:=50000}
: ${REPORTER:="spec"}

if [ ! $COVERAGE ]; then
    mocha \
        --bail \
        --timeout $TIMEOUT \
        --require=./tests/node.setup.js \
        --reporter=$REPORTER \
        --grep=$GREP \
        tests/test.*.js
else
    istanbul cover ./node_modules/mocha/bin/_mocha -- \
        --bail \
        --timeout $TIMEOUT \
        --require=./tests/node.setup.js \
        --reporter=$REPORTER \
        --grep=$GREP \
        tests/test.*.js
fi

