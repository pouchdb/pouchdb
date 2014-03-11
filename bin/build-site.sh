#!/bin/bash
# Builds /docs

# Install jekyll if it doesnt exist.
if ! gem list jekyll -i; then
  echo "Install Jekyll"
  exit 1;
fi

# Install npm dependancies
npm install

# Install bower dependancies
bower install

# Make the directory for the css to live in.
mkdir -p docs/static/css

# Pre-process the less into it's final form.
node_modules/less/bin/lessc docs/static/less/pouchdb/pouchdb.less > docs/static/css/pouchdb.css

# Build the site using jekyll
cd docs

if [ ! $BUILD ]; then
    jekyll -w serve --baseurl=''
else
    jekyll build
fi
