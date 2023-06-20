pouchdb-seamless-auth
=====================

Seamless switching between online (CouchDB) and offline (PouchDB)
authentication.

**WARNING**: This plug-in stores password hashes in a local PouchDB. In
for example internet cafes, this is not a smart thing to do. In your
app, you should include a checkbox 'I trust this computer' and only use
**pouchdb-seamless-auth** when it is checked. Otherwise, you can fall
back to **pouchdb-auth**. This functionality might be implemented as
part of the plug-in in the future.

API
---

**NodeJS package name:** `pouchdb-seamless-auth`

**Browser object name:** `window.SeamlessAuth`

This plug-in provides a convenience layer on top of the PouchDB Auth
plug-in. By default, it users a local database named `_users` as
backend for its log in, log out and get session actions. But, when you
set a remote database, that local database is synced with the given
database. In other words, it allows you to let your user log in one
time using the remote database, and from that moment on you can also the
session functions while offline! Very handy when using a per-user
database set up that PouchDB syncs.

Instead of passing this plug-in to the `PouchDB.plugin()` function, install
it like this:

``javascript
//NodeJS
require("pouchdb-seamless-auth")(PouchDB)

//Browser
SeamlessAuth(PouchDB)
``

After that is finished (a promise is returned to help determine when that is),
all functions documented below are available on the `PouchDB` object.

### PouchDB.setSeamlessAuthRemoteDB(remoteName[, remoteOptions[, callback]])

Set a remote database to be seamlessly synced to.

**Parameters**:

- *string* remoteName: The url to the remote database. Passed to the
  `PouchDB` constructor as the first argument.
- *object* remoteOptions: Options to pass on to the `PouchDB` constructor
  as its second argument.
- *function* callback: An alternative for the returned promise.

**Returns**: a promise, which resolves to nothing when the remote database is
completely set up.

### PouchDB.unsetSeamlessAuthRemoteDB()

A synchronous function. Undos what `PouchDB.setSeamlessAuthRemoteDB()` did.

**Returns**: nothing.

### PouchDB.seamlessSession([opts[, callback]])

See **pouchdb-auth**'s `db.session()`.

### PouchDB.seamlessLogIn(username, password, [opts[, callback]])

See **pouchdb-auth**'s `db.logIn()`.

### PouchDB.seamlessLogOut([opts[, callback]])

See **pouchdb-auth**'s `db.logOut()`.

### PouchDB.seamlessSignUp(username, password, [opts[, callback]])

See **pouchdb-auth**'s `db.signUp()`.

### PouchDB.invalidateSeamlessAuthCache()

Used to invalidate the cache manually.

This is a synchronous function. Because an application might call
`PouchDB.seamlessSession()` a lot of times, that method is cached. For most
of the time, you don't have to worry about that, because log in, log out and
sign up all invalidate that cache, making it pretty much unnoticable. There is
one known exception: when changing the user document in `_users` manually.
Call this to invalidate the cache when you do that.

**Returns**: nothing.

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
