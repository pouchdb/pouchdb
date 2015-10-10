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
git rm -r bin docs scripts tests

git commit -m "build $VERSION"

# Tag and push
git tag $VERSION
git push --tags git@github.com:pouchdb/pouchdb.git $VERSION

# Build the site and custom builds for posterity
npm run build-custom
BUILD=1 npm run build-site
git add -f docs
git commit -m "build $VERSION with custom builds"
git tag ${VERSION}-with-custom
git push --tags git@github.com:pouchdb/pouchdb.git $VERSION-with-custom

# Cleanup
git checkout master
git branch -D build
