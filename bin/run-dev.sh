#!/bin/bash -e

node ./bin/build-pouchdb.js
npm run build-test
CLIENT=dev ./bin/run-test.sh
