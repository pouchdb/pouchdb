pouchdb-changes-filter
======

Plugin to add the ability to use the `"filter"`, `"selector"`, `"doc_ids"`, `"query_params"`, and `"query"` fields in the `changes()`, `replicate()`, and `sync()` APIs.

This is extract as a separate plugin because 1) it's fairly heavyweight, and 2) it contains `eval()`, which some environments disallow. So if you're not using filtered changes/replication, then you don't need this module.

### Usage

```bash
npm install pouchdb-changes-filter
```

```js
var PouchDB = require('pouchdb');
var changesFilter = require('pouchdb-changes-filter');
PouchDB.plugin(changesFilter);
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


