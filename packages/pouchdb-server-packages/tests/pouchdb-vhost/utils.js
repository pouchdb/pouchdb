const stuff = require('../testutils');
const Show = require('../../packages/node_modules/pouchdb-show');
const Rewrite = require('pouchdb-rewrite');
const VirtualHost = require('../../packages/node_modules/pouchdb-vhost');

stuff.PouchDB.plugin(Show);
stuff.PouchDB.plugin(Rewrite);
VirtualHost(stuff.PouchDB);

module.exports = stuff;
