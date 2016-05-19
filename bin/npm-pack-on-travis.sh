#!/usr/bin/env bash
# do an `npm pack` and then set the correct node/npm version
# this allows us to compile in one version of node and then test in another,
# while also ensuring that we're testing *exactly* the thing our npm users
# will use.
npm pack packages/pouchdb
tar -xzf pouchdb-*.tgz
rm -rf packages/pouchdb
mv package packages/pouchdb
if [ ! -z $NODE_VERSION ]; then
  source ~/.nvm/nvm.sh
  nvm install $NODE_VERSION
  nvm use $NODE_VERSION
fi
node --version
npm --version
cd packages/pouchdb
npm install --production
cd ../..
rm -fr node_modules
npm install --production
