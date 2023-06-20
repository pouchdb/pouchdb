http-pouchdb
============

Access remote CouchDB databases like you would access your local PouchDB
ones. Tested support for ``new PouchDB('name')``,
``PouchDB.replicate('name', 'name')``, ``PouchDB.destroy('name')`` and,
as a bonus, ``PouchDB.allDbs()``.

Example
-------

```bash
npm install pouchdb http-pouchdb
```

```javascript
var PouchDB = require('pouchdb');
var HttpPouchDB = require('http-pouchdb')(PouchDB, 'http://localhost:5984');

var db = new HttpPouchdb('_users');
console.log(HttpPouchDB.isHTTPPouchDB) //-> true
// 'db' will be backed by http://localhost:5984/_users ; You can use it
// like any PouchDB database.
```

API
---

**NodeJS package name:** `http-pouchdb`

**Browser object name:** `window.buildHTTPPouchDB`

Browser usage
-------------

```html
<script src='somewhere/pouchdb.min.js'></script>
<script src='dist/http-pouchdb.min.js'></script>
<script>
  var HttpPouchDB = buildHTTPPouchDB(PouchDB, 'http://localhost:5984/test');
  // use HttpPouchdb as above.
</script>
```

API
---

- ``module.exports = function (PouchDB, name, opts) -> PouchDB2``
- ``name``: The base url you want to use. Needs a trailing '/'.
- ``opts``: ``opts.headers`` and ``opts.auth``.

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
