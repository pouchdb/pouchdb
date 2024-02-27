#!/bin/bash -e

node ./build-pouchdb
npm run build-test
CLIENT=dev ./bin/run-test.sh
