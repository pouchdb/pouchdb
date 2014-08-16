#!/bin/bash

# Build the website
BUILD=1 npm run build-site

# Push the site live, requires credentials, open a bug
# if you need to be able to push the site
scp -r docs/_site/* pouchdb@pouchdb.com:/home/pouchdb/www/pouchdb.com/
