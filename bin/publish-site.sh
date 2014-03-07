#!/bin/bash

git checkout master

# Store current branch hash 
CRT=`git rev-parse --abbrev-ref HEAD`

# Checkout staging branch
git checkout -b build-site

# Remove built files just incase
if [ -d docs/static/css ]; then
    rm -rf docs/static/css
fi

# Build site
npm run build-site

# Check the css is built
if [ ! -f docs/static/css/pouchdb.css ]; then
   echo 'CSS wasnt built properly'
   exit 1
fi

# Force add the .gitignored built css
git add docs/static/css/pouchdb.css -f
git commit -m 'pouchdb.css deploy build'
git rm --cache docs/static/css/pouchdb.css
git commit -m 'reignore pouchdb.css'

# Deploy to gh-pages
git subtree push --prefix docs origin gh-pages

# Return to previous branch
git checkout $CRT

# Delete staging branch
git branch -D build-site
