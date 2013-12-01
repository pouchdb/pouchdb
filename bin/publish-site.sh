#!/bin/bash
# publish-site requires jekyll
# install with gem install jekyll

npm run build

# Build pouchdb.com
cd docs
jekyll build
cd ..

# Publish pouchdb.com + nightly
scp -r docs/_site/* pouchdb.com:www/pouchdb.com
scp dist/* pouchdb.com:www/download.pouchdb.com
