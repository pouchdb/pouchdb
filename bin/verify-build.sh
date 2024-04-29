#!/usr/bin/env -S bash -e

# Verify various aspects of the build to make sure everything was
# built correctly.

npm run build

node ./bin/verify-dependencies.js
./bin/verify-bundle-size.sh
