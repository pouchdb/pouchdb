// this code only runs in the browser, as its own dist/ script

import FruitdownPouchPlugin from '../../pouchdb-adapter-fruitdown';


if (typeof PouchDB === 'undefined') {
  console.error('fruitdown adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(FruitdownPouchPlugin);
}