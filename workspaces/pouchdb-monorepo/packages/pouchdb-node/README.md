pouchdb-node
======

PouchDB, the Node-only edition. A preset representing the PouchDB code that runs in Node.js, without any of the code required to run it in the browser.

The `pouchdb-node` preset contains the version of PouchDB that is designed for
Node.js. In particular, it uses the LevelDB adapter and doesn't ship with the
IndexedDB or WebSQL adapters. It also contains the replication, HTTP, and map/reduce plugins.

Use this preset if you are only using PouchDB in Node, and not in the browser.

### Usage

```bash
npm install pouchdb-node
```

```js
var PouchDB = require('pouchdb-node');
var db = new PouchDB('mydb');
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


