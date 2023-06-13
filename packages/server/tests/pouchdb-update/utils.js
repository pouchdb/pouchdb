const stuff = require('../testutils');
const Update = require('../../packages/node_modules/pouchdb-update');

stuff.PouchDB.plugin(Update);

stuff.updateDocument = {
  _id: "_design/test",
  updates: {
    args: `function (doc, req) {
      return [null, toJSON([doc, req])];
    }`,
    exception: `function (doc, req) {
      return abc;
    }`,
    'save-adding-date': `function (oldDoc, req) {
      var doc = JSON.parse(req.body);
      doc.updated = new Date();
      return [doc, "Hello World!"];
    }`
  }
};

module.exports = stuff;
