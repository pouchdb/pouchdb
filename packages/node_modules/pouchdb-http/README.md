pouchdb-http
======

PouchDB as an HTTP-only package.

The `pouchdb-http` preset only contains the HTTP adapter, i.e. the adapter that
allows PouchDB to talk to CouchDB using the format `new PouchDB('http://127.0.0.1:5984/mydb')`. Note that
this preset does not come with map/reduce, so you cannot use the `query()` API.

Use this preset if you only want to use PouchDB as an interface to CouchDB (or a Couch-compatible server).

### Usage

```bash
npm install pouchdb-http
```

```js
var PouchDB = require('pouchdb-http');
var db = new PouchDB('http://127.0.0.1:5984/mydb');
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


