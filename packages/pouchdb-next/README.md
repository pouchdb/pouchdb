pouchdb-browser
======

PouchDB, the browser-only edition. A preset representing the PouchDB code that runs in the browser, without any of the code required to run it in Node.js.

The `pouchdb-browser` preset contains the version of PouchDB that is designed for the browser. In particular, it ships with the IndexedDB and WebSQL adapters as its default adapters. It also contains the replication, HTTP, and map/reduce plugins.

Use this preset if you only want to use PouchDB in the browser,
and don't want to use it in Node.js. (E.g. to avoid installing LevelDB.)

### Usage

```bash
npm install pouchdb-browser
```

```js
var PouchDB = require('pouchdb-browser');
var db = new PouchDB('mydb');
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


