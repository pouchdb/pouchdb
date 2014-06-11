#!/bin/bash

: ${TIMEOUT:=50000}
: ${REPORTER:="spec"}

if [ $PERF ]; then
    node tests/performance/index.js
elif [ ! $COVERAGE ]; then
    ./node_modules/.bin/mocha \
        --bail \
        --timeout $TIMEOUT \
        --require=./tests/node.setup.js \
        --reporter=$REPORTER \
        --grep=$GREP \
        tests/test.*.js
else
    ./node_modules/.bin/istanbul cover ./node_modules/mocha/bin/_mocha -- \
        --bail \
        --timeout $TIMEOUT \
        --require=./tests/node.setup.js \
        --reporter=$REPORTER \
        --grep=$GREP \
        tests/test.*.js
fi

