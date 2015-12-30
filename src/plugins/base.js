/* global PouchDB */

import altFactory from './levelalt';
import PouchDB from 'pouchdb';

function pluginBase(adapterConfig, downAdapter) {
  var adapterName = adapterConfig.name;
  var adapter = altFactory(adapterConfig, downAdapter);
  var PDB = typeof PouchDB === 'undefined' ? PouchDB : window.PouchDB;
  if (!PDB) {
    console.error(adapterConfig.name + ' adapter plugin error: ' +
      'Cannot find global "PouchDB" object! ' +
      'Did you remember to include pouchdb.js?');
  } else {
    PDB.adapter(adapterName, adapter, true);
  }
}

export default pluginBase;