pouchdb-adapter-node-websql
======

PouchDB adapter using Node-based SQLite (via [node-websql](https://github.com/nolanlawson/node-websql)) as its data store. Designed to run in Node.js. Its adapter name is `'websql'`.

### Usage

```bash
npm install pouchdb-adapter-node-websql
```

```js
PouchDB.plugin(require('pouchdb-adapter-node-websql'));
var db = new PouchDB('mydb', {adapter: 'websql'});
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


