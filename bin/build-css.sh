#!/bin/bash

# Make the directory for the css to live in.
mkdir -p docs/static/css

# Pre-process the less into it's final form.
node_modules/less/bin/lessc --clean-css docs/static/less/pouchdb/pouchdb.less > docs/static/css/pouchdb.css