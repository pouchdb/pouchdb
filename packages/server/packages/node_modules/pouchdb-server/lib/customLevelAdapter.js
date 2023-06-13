'use strict';

var CoreLevelPouch = require('pouchdb-adapter-leveldb-core');
var assign = Object.assign || require('object-assign');

// create a PouchDb plugin from any *down database
function customLevelAdapter(db) {

  function CustomLevelPouch(opts, callback) {
    var _opts = assign({
      db: db
    }, opts);

    CoreLevelPouch.call(this, _opts, callback);
  }

  CustomLevelPouch.valid = function () {
    return true;
  };
  CustomLevelPouch.use_prefix = false;

  return function (PouchDB) {
    PouchDB.adapter('custom-leveldb', CustomLevelPouch, true);
  };
}

module.exports = customLevelAdapter;