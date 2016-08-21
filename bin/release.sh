#!/bin/bash

if [ ! -z $DRY_RUN ]; then
  echo "Doing a dry run release..."
else
  echo "Doing a real release! Use DRY_RUN=1 for a dry run instead."
fi

#make sure deps are up to date
rm -fr node_modules
npm install

# get current version
VERSION=$(node --eval "console.log(require('./packages/node_modules/pouchdb/package.json').version);")

# Build
git checkout -b build

# Update dependency versions inside each package.json (replace the "*")
node bin/update-dep-versions.js

# Publish all modules with Lerna
for pkg in $(ls packages/node_modules); do
  if [ ! -d "packages/node_modules/$pkg" ]; then
    continue
  elif [ "true" = $(node --eval "console.log(require('./packages/node_modules/$pkg/package.json').private);") ]; then
    continue
  fi
  cd packages/node_modules/$pkg
  echo "Publishing $pkg..."
  if [ -z $DRY_RUN ]; then
    npm publish
  fi
  cd -
done

# Create git tag, which is also the Bower/Github release
rm -fr lib src dist bower.json component.json package.json
cp -r packages/node_modules/pouchdb/{src,lib,dist,bower.json,component.json,package.json} .
git add -f lib src dist bower.json component.json package.json lerna.json
git rm -fr packages bin docs scripts tests

git commit -m "build $VERSION"

if [ -z $DRY_RUN ]; then
  # Tag and push
  git tag $VERSION
  git push --tags git@github.com:pouchdb/pouchdb.git $VERSION

  # Cleanup
  git checkout master
  git branch -D build
fi
