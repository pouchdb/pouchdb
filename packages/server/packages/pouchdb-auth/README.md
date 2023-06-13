pouchdb-auth
=============

A PouchDB plug-in that simulates CouchDB's authentication daemon.

Includes a users db that functions like CouchDB's. Also works in the browser.

API
---

**NodeJS package name:** `pouchdb-auth`

**Browser object name:** `window.Auth`

```
# npm install --save pouchdb-auth
var PouchDB = require('pouchdb')
var Auth = require('pouchdb-auth')
PouchDB.plugin(Auth)

var db = new PouchDB('_users')
```

`pouchdb-auth` adds 3 methods to the PouchDB API

1. `db.hashAdminPasswords(admins)`
2. `db.generateSecret()`
3. `db.useAsAuthenticationDB()`
4. `db.stopUsingAsAuthenticationDB`

### db.hashAdminPasswords(admins[, options[, callback]])

`admins` is an object in the form of `'username': 'password'`.

Returns a promise, unless `callback` is passed.
Resolves with object with all values being hashed.

```js
db.hashAdminPasswords({ 'admin': 'secret' }
.then(function (hashed) {
  // hashed.admin now looks like '-pbkdf2-243ba92f8f575c70d3d607b408…21731411301c11cb1d81481f51d1108,10'
})
```

- `options.iterations`: The number of pbkdf2 iterations to use when hashing the
  passwords. Defaults to CouchDB's 10.

See below ("How it works") for more background information

### db.generateSecret()

Generates a secret that you can use for useAsAuthenticationDB(). This is a
synchronous method.

### db.useAsAuthenticationDB([options[, callback]])

This function transforms the database on which it is called into an
authentication database. It does that by installing strict validation
rules, making sure passwords are hashed in user documents before
they're written into the db, and by adding the following methods
to the db (documented below):

- `db.signUp(username, password[, options[, callback]])`
- `db.logIn(username, password[, options[, callback]])`
- `db.logOut([options[, callback]])`
- `db.session([options[, callback]])`
- `db.multiUserLogIn([callback])`
- `db.multiUserSession([sessionID[, callback]])`

- `options.isOnlineAuthDB`: If `true`, password hashing, keeping
  track of the session and doc validation is all handled by the
  CouchDB on the other end. Defaults to `true` if called on an http
  database, otherwise `false`. An online db currently doesn't provide the
  `db.multiUser*` methods.
- `options.timeout`: By default, a session is valid for 600 seconds. If you want
  to renew the session, call ``db.session()`` within this time window, or set
  the expiration time higher (or to 0, which sets it to infinite), by changing
  this value.
- `options.secret`: To calculate the session keys, a secret is necessary. You
  can pass in your own using this parameter. Otherwise, a random one is
  generated for the authentication db.
- `options.admins` (optional): Allows to pass in an admins object that looks
  like the one defined in CouchDB's `_config`.
- `options.iterations`: The number of pbkdf2 iterations to use when hashing the
  passwords. Defaults to CouchDB's 10.

Returns a promise, unless `callback` is passed. Resolves with nothing.

```js
db.useAsAuthenticationDB()
.then(function () {
  // db is now ready to be used as users database, with all behavior
  // of CouchDB's `_users` database applied

})
```

### db.stopUsingAsAuthenticationDB()

Removes custom behavior and methods applied by `db.useAsAuthenticationDB()`.

Returns nothing. This is a synchronous method.

```js
db.stopUsingAsAuthenticationDB();
```


### db.signUp(username, password[, options[, callback]])

A small helper function: pretty much equivalent to saving a
CouchDB user document with the passed in values in the database
using PouchDB.

`username` and `password` are both strings and required.

`options.roles` (optional) is an array of strings with roles
names, used for authorizing access to databases, see "How it
works" below.

Returns a promise, unless `callback` is passed. Resolves with
[put](http://pouchdb.com/api.html#create_document) response.

```js
db.signUp('john', 'secret')
.then(function (response) {
  // {
  //   ok: true,
  //   id: 'org.couchdb.user:john',
  //   rev: '1-A6157A5EA545C99B00FF904EEF05FD9F'
  // }
})
```

### db.logIn(username, password[, callback])

Tries to get the user specified by `username` from the database,
if its `password` (after hashing) matches, the user is considered
to be logged in. This fact is then stored in memory, allowing the
other methods (`db.logOut` & `db.session`) to use it later on.

Returns a promise, unless `callback` is passed. Resolves with `name`
and `roles`. If username and/or password is incorrect, rejects with
`unauthorized` error.

```js
db.logIn('john', 'secret')
.then(function (response) {
  // {
  //   ok: true,
  //   name: 'john',
  //   roles: ['roles', 'here']
  // }
});

db.logIn('john', 'wrongsecret')
.catch(function (error) {
  // error.name === `unauthorized`
  // error.status === 401
  // error.message === 'Name or password is incorrect.'
});
```


### db.logOut(callback)

Removes the current session.

Returns a promise that resolves to `{ok: true}`, to match a CouchDB logout. This
method never fails, it works even if there is no session.

```js
db.logOut()
.then(function (resp) {
  // { ok: true }
});
```

### db.session([callback])

Reads the current session from the db.

Returns a promise, unless `callback` is passed. Note that
`db.session()` does not return an error if the current
user has no valid session, just like CouchDB returns a `200` status to a
`GET /_session` request. To determine whether the current user has a valid
session or not, check if `response.userCtx.name` is set.

```js
db.session()
.then(function (response) {
  // {
  //   "ok": true,
  //   "userCtx": {
  //     "name": null,
  //     "roles": [],
  //   },
  //   "info": {
  //     "authentication_handlers": ["api"]
  //   }
  // }
})
```

### db.multiUserLogIn(username, password[, callback])

This works the same as ``db.logIn()``, but returns an extra property
(``sessionID``), so multiple sessions can be managed at the same time. You pass
in this property to the ``db.multiUserSession`` function as a reminder which
session you are talking about.

As a matter of fact, the normal functions are just a small wrapper over the
``db.multiUser*`` functions. They just store and re-use the last sessionID
internally.

```js
db.multiUserLogIn('john', 'secret')
.then(response) {
  // {
  //   ok: true,
  //   name: 'username',
  //   roles: ['roles', 'here'],
  //   sessionID: 'amFuOjU2Njg4MkI5OkEK3-1SRseo6yNRHfk-mmk6zOxm'
  // }
});
```

### db.multiUserSession(sessionID[, callback])

The same as ``db.session()``, but supporting multiple sessions at the same time.
Pass in a ``sessionID`` obtained from a ``db.multiUserLogIn()`` call. If
``sessionID`` is not given, a normal non-logged in session will be returned.
A new updated ``sessionID`` is generated and included to prevent the session
from expiring.

```js
db.multiUserSession('amFuOjU2Njg4MkI5OkEK3-1SRseo6yNRHfk-mmk6zOxm')
.then(response) {
  // {
  //   "ok": true,
  //   "userCtx": {
  //     "name": 'john',
  //     "roles": [],
  //   },
  //   "info": {
  //     "authentication_handlers": ["api"]
  //   },
  //   sessionID: 'some-new-session-id'
  // }
}
```

### db.multiUserLogOut()

Contrary to what you might expect, this method **does not exist**. Multi user
logouts are as simple as just forgetting the ``sessionID``. That is the only
thing the ``db.logOut()`` method does internally. No other state is kept.

How it works
------------

First, make sure you understand how the `_users` database works in
CouchDB. A good start is [the CouchDB documentation on the
authentication database](http://docs.couchdb.org/en/latest/intro/security.html#authentication-database)

Admin users are not stored in the `_users` database, but in the `[admins]` section
of couch.ini, see http://docs.couchdb.org/en/latest/config/auth.html

When setting passwords clear text, CouchDB will automatically overwrite
them with hashed passwords on restart. the ``hashAdminPasswords`` function
can be used to emulate that behaviour with PouchDB-Auth.

The `roles` property of `_users` documents is used by CouchDB to determine access to databases,
which can be set in the `_security` setting of each database. There are now default roles by CouchDB,
so you are free to set your own (With the excepion of system roles starting with a `_`). The
`roles` property can only be changed by CouchDB admin users. More on authorization in CouchDB:
http://docs.couchdb.org/en/latest/intro/security.html#authorization

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
