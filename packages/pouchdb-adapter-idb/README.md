pouchdb-adapter-idb
======

PouchDB adapter using IndexedDB as its data store. Designed to run in the browser. Its adapter name
is `'idb'`.

### Usage

```bash
npm install pouchdb-adapter-idb
```

```js
PouchDB.plugin(require('pouchdb-adapter-idb'));
var db = new PouchDB('mydb', {adapter: 'idb'});
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


