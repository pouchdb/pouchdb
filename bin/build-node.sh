#!/usr/bin/env bash

# Don't rebuild when testing in travis or coverage. This screws with
# our coverage/unit tests (https://github.com/pouchdb/pouchdb/issues/4767)
if [ -z "$TRAVIS" ] && [ -z "$COVERAGE" ]; then
  node ./bin/build.js node
fi
