#!/bin/sh

# Verify various aspects of the build to make sure everything was
# built correctly.

npm run build

node ./bin/verify-dependencies.js
sh ./bin/verify-bundle-size.sh