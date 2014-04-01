#!/bin/bash

# Store current branch hash
CRT=`git rev-parse --abbrev-ref HEAD`

# Build the website
BUILD=1 npm run build-site

# Checkout gh-pages and clean everything up
git checkout gh-pages

# Copy the docs in and git add them, we need to make sure if
# any more top level parts directories get introduced they are
# added here
cp -R docs/_site/* ./
echo "pouchdb.com" > CNAME

git add CNAME *.html static 2014

# Push updates
git commit -m "Site Update"
git push origin gh-pages

# Go back to our old branch
git checkout $CRT
