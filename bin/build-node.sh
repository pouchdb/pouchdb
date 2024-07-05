#!/usr/bin/env -S bash -e

# don't bother doing this in GHA because it's already been built
if [ -z "$GITHUB_REPOSITORY" ]; then
  BUILD_NODE=1 npm run build-modules
fi
