const Auth = require('../../packages/node_modules/pouchdb-auth');
const stuff = require('../testutils');
const extend = require('extend');

stuff.PouchDB.plugin(Auth);

module.exports = extend({Auth}, stuff, {
  BASE_URL: process.env.COUCH_HOST || stuff.BASE_URL
});
