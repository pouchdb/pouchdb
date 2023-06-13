pouchdb-replicator
==================

A PouchDB plug-in that simulates CouchDB's replicator database daemon. A
browser version is available.

Version 2.0.0 onward uses prefixed replication fields (_replication_state
instead of replication_state). This requires a version of PouchDB in which
[issue 2442](https://github.com/pouchdb/pouchdb/issues/2442) is solved.

API
---

**NodeJS package name:** `pouchdb-replicator`

**Browser object name:** `window.Replicator`

First, make sure you understand the CouchDB replicator database. A good
starting point is [its documentation](http://docs.couchdb.org/en/latest/replication/replicator.html).

### Replicator.startReplicator([callback])

Starts a CouchDB-like replication 'daemon' which listens on the
current database like CouchDB does on the ``_replicator`` database.

This allows you to persist replications past a page refresh, and
provides an alternative api for :js:func:`PouchDB.replicate` and
friends.

### Replicator.stopReplicator([callback])

Stops the 'daemon' that :js:func:`Replicator.startReplicator`
started.

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
