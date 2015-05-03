'use strict';
/* global PouchDB */

function pluginBase(adapterConfig, downAdapter) {
  var adapterName = adapterConfig.name;
  var adapter = require('./levelalt')(adapterConfig, downAdapter);
  // use global PouchDB if it's there (e.g. window.PouchDB)
  var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
  if (!PDB) {
    console.error(adapterConfig.name + ' adapter plugin error: ' +
      'Cannot find global "PouchDB" object! ' +
      'Did you remember to include pouchdb.js?');
  } else {
    PDB.adapter(adapterName, adapter, true);
  }
}

module.exports = pluginBase;