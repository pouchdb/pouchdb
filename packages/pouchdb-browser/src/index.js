import PouchDB from 'pouchdb-core';

import HttpPouch from 'pouchdb-adapter-http';

PouchDB
  .plugin(HttpPouch)

export default PouchDB;
