const stuff = require('../testutils');
const Rewrite = require('../../packages/node_modules/pouchdb-rewrite');

const List = require('../../packages/node_modules/pouchdb-list');
const Security = require('../../packages/node_modules/pouchdb-security');
const Show = require('../../packages/node_modules/pouchdb-show');
const Update = require('pouchdb-update');
const Validation = require('pouchdb-validation');

const AllDbs = require('pouchdb-all-dbs');
const SeamlessAuth = require('pouchdb-seamless-auth');

stuff.PouchDB.plugin(Rewrite);

stuff.PouchDB.plugin(List);
stuff.PouchDB.plugin(Security);
stuff.PouchDB.plugin(Show);
stuff.PouchDB.plugin(Update);
stuff.PouchDB.plugin(Validation);

AllDbs(stuff.PouchDB);
SeamlessAuth(stuff.PouchDB);

stuff.rewriteDocument = {
  _id: '_design/test',
  rewrites: [
    {
      from: '/test/all',
      to: '_list/test/ids'
    }
  ]
};

stuff.checkUuid = uuid => {
  uuid.should.be.a('string');
  uuid.length.should.be.greaterThan(30);
};

module.exports = stuff;
