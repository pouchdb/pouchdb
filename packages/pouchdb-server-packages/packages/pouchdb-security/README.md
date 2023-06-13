pouchdb-security
================

PouchDB database access restrictions using a security document. Like
_security in CouchDB (and when used on an http database, that url is
checked.)

API
---

**NodeJS package name:** `pouchdb-security`

**Browser object name:** `window.Security`

First, make sure you understand how security objects work in CouchDB.
A good start is [their HTTP documentation](http://docs.couchdb.org/en/latest/api/database/security.html).

### Security.putSecurity(secObj[, callback])

Equivalent to PUTting a document to /db/_security in CouchDB.
Replaces the current security object for the database with the given
one.

For example:

```javascript
{
  "admins": {
    "names": [
      "your_name"
    ],
    "roles": []
  },
  "members": {
    "names": [],
    "roles": [
      "app_users"
    ]
  }
}
```

**Returns**: `{ok: true}`.

### Security.getSecurity([callback])

Equivalent to going to /db/_security in CouchDB.

**Returns**: the security object for the current database.
(`{}` when none has been set, like in CouchDB.)

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
