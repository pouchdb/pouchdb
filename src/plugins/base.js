/* global PouchDB */

import altFactory from './levelalt';

function pluginBase(adapterConfig, downAdapter) {
  var adapterName = adapterConfig.name;
  var adapter = altFactory(adapterConfig, downAdapter);
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

export default pluginBase;