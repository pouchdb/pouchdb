pouchdb-size
============

Adds disk_size to info()'s output for your *down backed PouchDB's.

Tested with leveldown, sqldown, jsondown, locket and medeadown. When it
can't determine the database size, it falls back to the default
``info()`` output.

Example
-------

```javascript
//index.js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-size'));

var db = new PouchDB('test');
db.installSizeWrapper();
db.info().then(function (resp) {
	//resp will contain disk_size
})
```

API
---

### db.installSizeWrapper()

wraps ``db.info()`` in such a way that it will include a ``disk_size``
property in its output for supported database backends.

### `db.getDiskSize([callback])

like PouchDB, this method both returns a Promise and accepts a
callback. Either returns an error or the disk size of the current db.

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
