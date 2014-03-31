#!/bin/bash
# Builds /docs

# Install jekyll if it doesnt exist.
if ! gem list jekyll -i; then
  echo "Install Jekyll"
  exit 1;
fi

# Install npm dependancies
npm install

npm run build-css

# Build the site using jekyll
cd docs

if [ ! $BUILD ]; then
    jekyll -w serve --baseurl=''
else
    jekyll build
fi
