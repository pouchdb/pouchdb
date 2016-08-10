#!/usr/bin/env bash
# do an `npm pack` and then set the correct node/npm version
# this allows us to compile in one version of node and then test in another,
# while also ensuring that we're testing *exactly* the thing our npm users
# will use.
npm pack packages/node_modules/pouchdb
tar -xzf pouchdb-*.tgz
rm -rf packages/node_modules/pouchdb
mv package packages/node_modules/pouchdb
if [ ! -z $NODE_VERSION ]; then
  source ~/.nvm/nvm.sh
  nvm install $NODE_VERSION
  nvm use $NODE_VERSION
fi
node --version
npm --version
cd packages/node_modules/pouchdb
npm install --production
cd -
rm -fr node_modules
npm install
