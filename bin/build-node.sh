#!/usr/bin/env bash

# don't bother doing this in travis because it's already been built
if [ ! -z $TRAVIS ]; then
  BUILD_NODE=1 npm run build-modules
fi
