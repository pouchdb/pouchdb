#!/bin/sh
REPLACE=./node_modules/replace/bin/replace.js

$REPLACE "\.continue\(" "['continue'](" dist/pouchdb-nightly.js
$REPLACE "\.catch\(" "['catch'](" dist/pouchdb-nightly.js
