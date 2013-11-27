#!/bin/bash
# publish requires jam and tin installed
# install with npm install tin jamjs
git checkout -b build
./node_modules/tin/bin/tin -v $1
echo "module.exports = '"$1"';" > src/version.js
npm run build
git add dist -f
git add src/version.js
git add package.json
git add bower.json
git add component.json
git commit -m "build $1"
git tag $1
git push --tags git@github.com:daleharvey/pouchdb.git $1
npm publish
./node_modules/jamjs/bin/jam.js publish
git checkout master
git branch -D build