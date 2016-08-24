pouchdb-core
======

The core of PouchDB as a standalone package. This is a `preset` designed to be combined with other plugins to create new `presets`. By itself, it is not very useful.

### Usage

```bash
npm install pouchdb-core
```

```js
var PouchDB = require('pouchdb-core');
PouchDB.plugin(/* attach plugins to make me more interesting! */);
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


