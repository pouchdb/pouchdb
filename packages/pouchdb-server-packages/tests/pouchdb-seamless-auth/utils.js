const stuff = require('../testutils');
const SeamlessAuth = require('../../packages/node_modules/pouchdb-seamless-auth');

stuff.waitUntilReady = () => SeamlessAuth(stuff.PouchDB);

stuff.cleanup = () => {
  return new stuff.PouchDB('_users').destroy();
};

module.exports = stuff;
