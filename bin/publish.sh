#!/bin/bash

VERSION=$1

if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Usage: ./bin/publish.sh 0.0.1"
    exit 2
fi

# Build
git checkout -b build
./node_modules/tin/bin/tin -v $VERSION
echo "module.exports = '"$VERSION"';" > lib/version.js
npm run build
git add dist -f
git add lib/version.js package.json bower.json component.json
git commit -m "build $VERSION"

# Tag and push
git tag $VERSION
git push --tags git@github.com:daleharvey/pouchdb.git $VERSION

# Publish JS modules
npm publish

# Build pouchdb.com
cd docs
jekyll build
cd ..

# Publish pouchdb.com + nightly
scp -r docs/_site/* pouchdb.com:www/pouchdb.com
scp dist/* pouchdb.com:www/download.pouchdb.com

# Cleanup
git checkout master
git branch -D build
