#!/bin/bash

#make sure deps are up to date
rm -r node_modules
npm install

# get current version
VERSION=$(npm ls --json=true pouchdb | grep version | awk '{ print $2}'| sed -e 's/^"//'  -e 's/"$//')

# Build
git checkout -b build
npm run build
git add dist -f
git commit -m "build $VERSION"

# Tag and push
git tag $VERSION
git push --tags git@github.com:daleharvey/pouchdb.git $VERSION

# Publish JS modules
npm publish

npm run publish-site

# Cleanup
git checkout master
git branch -D build
