#!/bin/bash
# publish requires jam and tin installed
# install with npm install tin jamjs

# Build
git checkout -b build
./node_modules/tin/bin/tin -v $1
echo "module.exports = '"$1"';" > src/version.js
npm run build
git add dist -f
git add src/version.js package.json bower.json component.json
git commit -m "build $1"

# Tag and push
git tag $1
git push --tags git@github.com:daleharvey/pouchdb.git $1

# Publish JS modules
npm publish
./node_modules/jamjs/bin/jam.js publish

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
