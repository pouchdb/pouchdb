pouchdb-adapter-indexeddb
======

PouchDB adapter using IndexedDB as its data store. Designed to run in the browser. Its adapter name is `'indexeddb'`.

### Usage

```bash
npm install pouchdb-adapter-indexeddb
```

```js
PouchDB.plugin(require('pouchdb-adapter-indexeddb'));
var db = new PouchDB('mydb', {adapter: 'indexeddb'});
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).

### Differences between CouchDB and PouchDB's find implementations under IndexedDb

*These should be merged into some part of the external PouchDB documentation when this becomes a publicly usable adapter, if it's the default adapter or if it's one you can mix in manually.*

PouchDB attempts to be 100% compatible with CouchDB. However, there are some subtle differences you should be aware of between CouchDB and PouchDB running on IndexedDB.

First, note that these differences only exist in the native indexeddb index implementation. You can run an explain query to determine which index you're using. **TODO: example.**

#### Data type ordering

In upper bounded ranged queries (e.g, `{foo: {$lt: 10}}`) the returned order of `null`, `true` and `false` alongside very small integers (Number.MIN_SAFE_INTEGER + 2 and below) may be inconsistent with CouchDB's ordering.

This may be fixed in the future. See:
 - **TODO ticket**
 - https://github.com/pouchdb/pouchdb/blob/master/tests/find/test-suite-1/test.data-type-order.js#L131

#### Object indexing in Mango

CouchDB supports `null`, booleans, numbers, strings, arrays and objects in its indexes, and ranged queries operate in that order.

Unfortunately IndexedDB does not support objects in indexes. If an object is present on indexed keypath that document will not be present in the index.

This will manifest in two ways:
 - If you are trying to use an object as a key to an index you will not get the correct results
 - If you are doing a lower bounded ranged query (eg. `{foo: {$gt: 10}}`) objects on this keypath (here `foo`) will not return their documents.

This is highly unlikely to be fixed in the future by PouchDB, as it would require improvements to IndexedDB. See:
 - https://github.com/pouchdb/pouchdb/blob/master/tests/find/test-suite-1/test.data-type-order.js#L66
