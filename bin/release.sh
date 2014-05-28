#!/bin/bash

#make sure deps are up to date
rm -r node_modules
npm install

# get current version
VERSION=$(node --eval "console.log(require('./package.json').version);")

# Build
git checkout -b build

npm run build
git add dist -f
git add lib/version-browser.js
git commit -m "build $VERSION"

# Tag and push
git tag $VERSION
git push --tags git@github.com:pouchdb/pouchdb.git $VERSION

# Publish JS modules
npm publish

# Cleanup
git checkout master
git branch -D build
