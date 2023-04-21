pouchdb-adapter-http
======

PouchDB adapter using HTTP (e.g. a remote CouchDB or CouchDB-like database) as its data store. Designed to run in either Node or the browser. Its adapter name is `'http'` or `'https'` depending on the protocol.

### Usage

```bash
npm install pouchdb-adapter-http
```

```js
PouchDB.plugin(require('pouchdb-adapter-http'));
var db = new PouchDB('http://127.0.0.1:5984/mydb');
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).
