#!/bin/bash
# publish-site requires jekyll
# install with gem install jekyll

npm run build

VERSION=$(npm ls --json=true pouchdb | grep version | awk '{ print $2}'| sed -e 's/^"//'  -e 's/"$//')
echo "version: $VERSION" >> docs/_config.yml

# Build pouchdb.com
cd docs
jekyll build
cd ..

# Publish pouchdb.com + nightly
scp -r docs/_site/* pouchdb.com:www/pouchdb.com
scp dist/* pouchdb.com:www/download.pouchdb.com
