pouchdb-vhost
=============

A PouchDB plug-in that allows you to re-use your CouchDB vhost config on
the client side. A browser version is available.

API
---

**NodeJS package name:** `pouchdb-vhost`

**Browser object name:** `window.VirtualeHost`

This plug-in is a single function which requires a ``PouchDB`` object as
its first argument. Following that, these extra methods become
available.

### PouchDB.virtualHost(req, vhosts[, options[, callback]])

### PouchDB.resolveVirtualHost(req, vhosts)

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
