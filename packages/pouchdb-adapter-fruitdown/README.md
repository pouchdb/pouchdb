pouchdb-adapter-fruitdown
======

PouchDB adapter using [fruitdown](https://github.com/nolanlawson/fruitdown) as the data store. Designed to run in the browser. Its adapter name is `'fruitdown'`.

### Usage

```bash
npm install pouchdb-adapter-fruitdown
```

```js
PouchDB.plugin(require('pouchdb-adapter-fruitdown'));
var db = new PouchDB('mydb', {adapter: 'fruitdown'});
```

For full API documentation and guides on PouchDB, see [PouchDB.com](http://pouchdb.com/). For details on PouchDB sub-packages, see the [Custom Builds documentation](http://pouchdb.com/custom.html).

### Source

PouchDB and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb/tree/master/packages).


