'use strict';

module.exports = [
  {
    name: 'Replication',
    code: 'require(\'pouchdb/custom/replication\');',
    info: "PouchDB's replication module, including the " +
    "<code>replicate()</code> and <code>sync()</code> APIs."
  },
  {
    name: 'HTTP',
    code: 'require(\'pouchdb/custom/http\');',
    info: "The HTTP module, which allows you to use PouchDB as an " +
    "interface to a remote database. Required if you want " +
    "to sync remotely."
  },
  {
    name: 'IndexedDB',
    code: 'require(\'pouchdb/custom/idb\');',
    info: "PouchDB's default adapter. See " +
    "<a href='http://caniuse.com/#feat=indexeddb'>CanIUse</a> or " +
    "<a href='adapters.html'>Adapters</a> for details."
  },
  {
    name: 'WebSQL',
    code: 'require(\'pouchdb/custom/websql\');',
    info: "A backup adapter used for non-IndexedDB browsers and " +
    "the SQLite Plugin. See " +
    "<a href='http://caniuse.com/#feat=sql-storage'>CanIUse</a> or " +
    "<a href='adapters.html'>Adapters</a> for details."
  },
  {
    name: 'Map/Reduce',
    code: 'require(\'pouchdb/custom/mapreduce\');',
    info: "The map/reduce module, including the <code>query()</code> and " +
    "<code>viewCleanup()</code> APIs. If you're using " +
    "<a href='https://github.com/nolanlawson/pouchdb-find'>pouchdb-find</a> " +
    "instead, then you can skip it."
  },
  {
    name: 'Promise',
    code: 'require(\'pouchdb/custom/promise\');',
    info: "An internal shim for Promises using " +
    "<a href='http://github.com/calvinmetcalf/lie'>lie</a>. " +
    "If you are using your own window.Promise shim or don't need to support " +
    "<a href='http://caniuse.com/#feat=promises'>Promise-less browsers</a>, " +
    "you can omit this."
  }
];