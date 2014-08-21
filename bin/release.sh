#!/bin/bash

#make sure deps are up to date
rm -r node_modules
npm install

# get current version
VERSION=$(node --eval "console.log(require('./package.json').version);")

# Build
git checkout -b build

npm run build

# Publish npm release with tests/scripts/goodies
npm publish

# Create git tag, which is also the Bower/Github release
git add dist -f
git add bower.json component.json package.json lib/version-browser.js
git rm -r bin docs scripts tests vendor

git commit -m "build $VERSION"

# Tag and push
git tag $VERSION
git push --tags git@github.com:pouchdb/pouchdb.git $VERSION

# Cleanup
git checkout master
git branch -D build
