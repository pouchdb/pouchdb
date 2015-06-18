#!/bin/bash

: ${TIMEOUT:=50000}
: ${REPORTER:="spec"}
: ${BAIL:=1}
: ${TYPE:="integration"}

if [ $BAIL -eq 1 ]; then
    BAIL_OPT="--bail"
else
    BAIL_OPT=""
fi

if [ $TYPE = "integration" ]; then
    TESTS_PATH="tests/integration/test.*.js"
fi
if [ $TYPE = "fuzzy" ]; then
    TESTS_PATH="tests/fuzzy/test.*.js"
fi
if [ $TYPE = "mapreduce" ]; then
    TESTS_PATH="tests/mapreduce/test.*.js"
fi


if [ $PERF ]; then
    node tests/performance/index.js
elif [ ! $COVERAGE ]; then
    ./node_modules/.bin/mocha \
        $BAIL_OPT \
        --timeout $TIMEOUT \
        --require=./tests/integration/node.setup.js \
        --reporter=$REPORTER \
        --grep=$GREP \
        $TESTS_PATH
else
    ./node_modules/.bin/istanbul cover ./node_modules/mocha/bin/_mocha -- \
        $BAIL_OPT \
        --timeout $TIMEOUT \
        --require=./tests/integration/node.setup.js \
        --reporter=$REPORTER \
        --grep=$GREP \
        $TESTS_PATH
fi

