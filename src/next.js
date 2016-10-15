module.exports = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-indexeddb'))
  .plugin(require('pouchdb-adapter-http'))
  .plugin(require('pouchdb-replication'));