#!/bin/bash

if ! gem list bundler -i > /dev/null 2>&1; then
    echo "bundler is not installed.  You need to do: gem install bundler"
    exit 1
fi

cd docs && bundle install
