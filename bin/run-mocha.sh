#!/bin/bash

if [ ! $COVERAGE ]; then
    ./node_modules/.bin/mocha \
        -t 50000 \
        -r ./tests/node.setup.js \
        -R spec \
        --grep=$GREP \
        tests/test.*.js
else
    ./node_modules/.bin/istanbul cover ./node_modules/mocha/bin/_mocha -- \
        -t 50000 \
        -r ./tests/node.setup.js \
        -R spec \
        --grep=$GREP \
        tests/test.*.js
fi

