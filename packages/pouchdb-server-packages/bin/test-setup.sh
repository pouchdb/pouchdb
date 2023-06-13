#!/bin/bash

# Check out PouchDB itself from master and build it, so that we can
# run its test suite.
# Note: this will start to fail randomly if something changes in
# PouchDB master. In those cases, just pin it to a specific Git commit.

DIRECTORY='pouchdb-tests'

if [ ! -d "$DIRECTORY" ]; then
  # Control will enter here if $DIRECTORY exists.
  git clone --single-branch --branch master \
    --depth 500 \
    https://github.com/pouchdb/pouchdb.git ${DIRECTORY}
fi

cd "$DIRECTORY"
git checkout de54c62f99d028593059e615b5702131864b6dd4 # 6.4.1
npm install
cd ..
