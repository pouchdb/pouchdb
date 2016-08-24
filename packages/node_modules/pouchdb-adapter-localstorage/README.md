pouchdb-adapter-localstorage
======

PouchDB adapter using LocalStorage as its data store. Designed to run in the browser. Its adapter name is `'localstorage'`.

### Usage

```bash
npm install pouchdb-adapter-localstorage
```

```js
PouchDB.plugin(require('pouchdb-adapter-localstorage'));
var db = new PouchDB('mydb', {adapter: 'localstorage'});
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


