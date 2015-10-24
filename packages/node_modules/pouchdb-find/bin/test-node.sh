#!/usr/bin/env bash

if [ ! $COVERAGE ]; then
  ./node_modules/.bin/mocha \
    --grep=$GREP \
    test/test.js
else
  ./node_modules/.bin/istanbul cover \
    ./node_modules/mocha/bin/_mocha \
    test/test.js
fi
