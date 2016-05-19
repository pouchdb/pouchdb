#!/bin/bash

#make sure deps are up to date
rm -fr node_modules packages/*/node_modules
npm install

# get current version
VERSION=$(node --eval "console.log(require('./packages/pouchdb/package.json').version);")

# Build
git checkout -b build

# Publish all modules with Lerna
./node_modules/.bin/lerna publish --skip-git

# Create git tag, which is also the Bower/Github release
cp -r packages/pouchdb/dist dist
cp packages/pouchdb/{bower,component}.json
git add -f dist bower.json component.json
git rm -r packages bin docs scripts tests

git commit -m "build $VERSION"

# Tag and push
git tag $VERSION
git push --tags git@github.com:pouchdb/pouchdb.git $VERSION

# Cleanup
git checkout master
git branch -D build
