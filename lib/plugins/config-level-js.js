'use strict';

module.exports = {
  name: 'idb-alt',
  require: 'level-js',
  valid: function () {
    var PouchDB = global.PouchDB || require('pouchdb');
    return 'idb' in PouchDB.adapters &&
      PouchDB.adapters.idb.valid();
  },
  use_prefix: true
};
