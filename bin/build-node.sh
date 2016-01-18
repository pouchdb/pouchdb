#!/usr/bin/env bash

# Don't rebuild in Travis; only during development. This screws with
# our coverage/unit tests (https://github.com/pouchdb/pouchdb/issues/4767)
if [[ -z $TRAVIS ]]; then
  node ./bin/build.js node
fi