#!/bin/bash

DBHOST="https://pouchdbvw.couchappy.com/test/"
DBHOST1="http://vw52.cloudant.com/test"

COVERAGE=1 npm test;

POST -sS $DBHOST -c "application/json" < coverage/coverage.json
