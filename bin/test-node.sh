#!/usr/bin/env -S bash -e

: "${TIMEOUT:=5000}"
: "${REPORTER:="spec"}"
: "${BAIL:=1}"
: "${TYPE:="integration"}"

if [ "$BAIL" -eq 1 ]; then
    BAIL_OPT="--bail"
else
    BAIL_OPT=""
fi

if [ "$TYPE" = "integration" ]; then
    if  (: < /dev/tcp/127.0.0.1/3010) 2>/dev/null; then
        echo "down-server port already in use"
    else
        node bin/down-server.js 3010 & export DOWN_SERVER_PID=$!
    fi

    TESTS_PATH="tests/integration/test.*.js"
fi
if [ "$TYPE" = "fuzzy" ]; then
    TESTS_PATH="tests/fuzzy/test.*.js"
fi
if [ "$TYPE" = "mapreduce" ]; then
    TESTS_PATH="tests/mapreduce/test.*.js"
fi
if [ "$TYPE" = "find" ]; then
    TESTS_PATH="tests/find/*/test.*.js"
fi
if [ "$COVERAGE" ]; then
    # run all tests when testing for coverage
    TESTS_PATH="tests/{unit,integration,mapreduce,component}/test*.js tests/find/*/test.*.js"
fi

if [ "$TYPE" = "performance" ]; then
    node tests/performance/index.js
elif [ ! "$COVERAGE" ]; then
    # --exit required to workaround #8839
    ./node_modules/.bin/mocha \
        --exit \
        "$BAIL_OPT" \
        --timeout "$TIMEOUT" \
        --require=./tests/integration/node.setup.js \
        --reporter="$REPORTER" \
        --grep="$GREP" \
        "$TESTS_PATH"
else
    # --exit required to workaround #8839
    ./node_modules/.bin/istanbul cover \
       --no-default-excludes -x 'tests/**' -x 'node_modules/**' \
       ./node_modules/mocha/bin/_mocha -- \
        --exit \
        "$BAIL_OPT" \
        --timeout "$TIMEOUT" \
        --require=./tests/integration/node.setup.js \
        --reporter="$REPORTER" \
        --grep="$GREP" \
        "$TESTS_PATH"

    ./node_modules/.bin/istanbul check-coverage --line 100
fi

EXIT_STATUS=$?
if [[ -n $DOWN_SERVER_PID ]]; then
  kill "$DOWN_SERVER_PID"
fi
exit $EXIT_STATUS
