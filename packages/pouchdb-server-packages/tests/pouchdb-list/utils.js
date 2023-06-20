const stuff = require('../testutils');
const List = require('../../packages/node_modules/pouchdb-list');

stuff.PouchDB.plugin(List);

stuff.listDocument = {
  _id: '_design/test',
  views: {
    ids: {
      map: `function (doc) {
        emit(doc._id, "value");
      }`
    }
  },
  lists: {
    args: `function (head, req) {
      return toJSON({args: [head, req]});
    }`,
    'use-list-api': `function (head, req) {
      start({code: 500});
      send(JSON.stringify(getRow()));
      send("\\n");
      send("test");
      return "Hello World!";
    }`,
    'test-coucheval': `function (head, req) {
      var result = sum([1, 2, 3]);
      return result + " - " + require("lib/thingy").data;
    }`
  },
  lib: {
    thingy: `exports.data = 'Hello World!';`
  }
};

module.exports = stuff;
