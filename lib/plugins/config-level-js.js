'use strict';

module.exports = {
  name: 'idb-alt',
  valid: function () {
    return 'idb' in window.PouchDB.adapters &&
      window.PouchDB.adapters.idb.valid();
  },
  use_prefix: true
};