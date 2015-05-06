---
layout: 2ColLeft
title: Plugins and External Projects
sidebar: nav.html
---

Below is a list of known plugins, tools and projects can be used with PouchDB. [Fork this page](https://github.com/pouchdb/pouchdb/blob/master/docs/external.md) to add your own!

{% include anchor.html title="Plugins" hash="plugins" %}

#### [PouchDB allDbs()](https://github.com/nolanlawson/pouchdb-all-dbs)

Revives the `allDbs()` function, which lists all PouchDB databases.

#### [PouchDB Authentication](https://github.com/nolanlawson/pouchdb-authentication)

Plugin for CouchDB's authentication system.

#### [Pouch Box](https://github.com/jo/pouch-box)

Allows decentralized authentication and access control per document, using asymmetric encryption.

#### [PouchDB Collate](https://github.com/pouchdb/collate)

Collation utilities, so you can use complex keys as doc IDs.

#### [Crypto Pouch](https://github.com/calvinmetcalf/crypto-pouch)

Encrypt a PouchDB/CouchDB database.

#### [Pouch Dat](https://github.com/calvinmetcalf/pouch-dat)

Replicate from PouchDB to Dat.

#### [Pouch Datalog](https://github.com/dahjelle/pouch-datalog)

Implement the Datalog query language on PouchDB, with indexes.

#### [PouchDB Dump](https://github.com/nolanlawson/pouchdb-dump-cli) and [PouchDB Load](https://github.com/nolanlawson/pouchdb-load)

Dump a PouchDB/CouchDB to a file, then load it wholesale. Designed for fast initial replication.

#### [Delta Pouch](https://github.com/redgeoff/delta-pouch)

Implements the handy "every document is a delta" pattern, so you don't have to deal with conflicts.

#### [PouchDB Erase](https://github.com/marten-de-vries/pouchdb-erase)

A replicating `db.destroy()` alternative.

#### [PouchDB Find](https://github.com/nolanlawson/pouchdb-find)

MongoDB-like query language, based on CouchDB 2.0. ([Live demo](http://nolanlawson.github.io/pouchdb-find/))

#### [PouchDB Full Sync](https://github.com/nolanlawson/pouchdb-full-sync)

Fully replicate two PouchDB/CouchDB databases, preserving absolutely all revision history.

#### [PouchDB GQL](https://github.com/pouchdb/GQL)

Google Query Language (GQL) queries with PouchDB. ([Documentation](http://pouchdb.com/gql.html))

#### [PouchDB Hoodie API](https://github.com/hoodiehq/pouchdb-hoodie-api)

Hoodie-like API for PouchDB. ([Documentation](http://hoodiehq.github.io/pouchdb-hoodie-api/))

#### [PouchDB List](http://python-pouchdb.marten-de-vries.nl/plugins.html)

Allows you to re-use your CouchDB list functions on the client side. ([Documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-rewrite-plug-in))

#### [Pouch Mirror](https://github.com/colinskow/pouch-mirror)

Creates a synced in-memory mirror of a remote CouchDB for faster reads.

#### [PouchDB No-Eval Map/Reduce](https://github.com/evidenceprime/pouchdb.mapreduce.noeval)

Allows you to use the `query()` API in environments that disallow `eval()`, like Chrome packaged apps.

#### [Peer Pouch](https://github.com/natevw/PeerPouch)

PouchDB over WebRTC. (Note: only works with PouchDB 1.1.)

#### [PouchDB Resolve Conflicts](https://github.com/jo/pouch-resolve-conflicts)

Plugin to assist in PouchDB conflict resolving.

#### [PouchDB Migrate](https://github.com/eHealthAfrica/pouchdb-migrate)

PouchDB plugin for running data migrations.

#### [PouchDB Quick Search](https://github.com/nolanlawson/pouchdb-quick-search)

Full-text search engine on top of PouchDB.

#### [Relational Pouch](https://github.com/nolanlawson/relational-pouch)

A relational database API on top of PouchDB/CouchDB.

#### [PouchDB Replication Stream](https://github.com/nolanlawson/pouchdb-replication-stream)

Replicate between CouchDB/PouchDB using streams.

#### [PouchDB Rewrite](http://python-pouchdb.marten-de-vries.nl/plugins.html)

A PouchDB plugin that allows you to re-use your CouchDB rewrites on the client side. ([Documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-list-plug-in))

#### [PouchDB Show](http://python-pouchdb.marten-de-vries.nl/plugins.html)

A PouchDB plugin that allows you to re-use your CouchDB show functions on the client side. ([Documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-show-plug-in))

#### [SocketPouch](https://github.com/nolanlawson/socket-pouch)

PouchDB/CouchDB replication over WebSockets, using Engine.io (Socket.io).

#### [PouchDB Spatial](https://github.com/pouchdb/geopouch)

Multidimensional and spatial queries with PouchDB.

#### [Store.PouchDB](https://github.com/chunksnbits/store.pouchdb)

ORM-style storage plugin for PouchDB.

#### [Pouch Stream](https://github.com/calvinmetcalf/PouchStream)

A plugin to let PouchDB talk streams.

#### [Transform Pouch](https://github.com/nolanlawson/transform-pouch)

Transforms documents before and after storage, e.g. for encryption, compression, or massaging data.


#### [PouchDB Update](http://python-pouchdb.marten-de-vries.nl/plugins.html)

A PouchDB plugin that allows you to re-use your CouchDB update functions on the client side. ([Documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-update-plug-in))

#### [PouchDB Upsert](https://github.com/nolanlawson/pouchdb-upsert)

Convenience functions for working with documents: `upsert()` and `putIfNotExists()`.

#### [PouchDB Validation](http://python-pouchdb.marten-de-vries.nl/plugins.html)

A PouchDB plugin that allows you to re-use your CouchDB `validate_doc_update` functions on the client side. ([Documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-validation-plug-in))

{% include anchor.html title="Server Side" hash="Server Side" %}

#### [PouchDB Server](https://github.com/pouchdb/pouchdb-server)

A standalone CouchDB-style REST interface server to PouchDB.

#### [Express PouchDB](https://github.com/pouchdb/express-pouchdb)

An Express submodule with a CouchDB-style REST interface to PouchDB. Powers PouchDB Server.

#### [Express PouchDB Replication Stream](https://github.com/conor-mac-aoidh/express-pouchdb-replication-stream)

Server-side Express endpoint to deliver a stream from [PouchDB Replication Stream](https://github.com/nolanlawson/pouchdb-replication-stream).

{% include anchor.html title="Framework adapters" hash="framework_adapters" %}

### Angular

#### [angular-pouchdb](https://github.com/angular-pouchdb/angular-pouchdb)

Wrapper for using PouchDB within Angular.js.

#### [Factoryng - AngularJS Adapter](https://github.com/redgeoff/factoryng)

An all-in-one AngularJS factory that wraps PouchDB and Delta Pouch.

#### [ngPouch](https://github.com/jrhicks/ngPouch)

Angular service to persist remote connection settings and maintain continuous replication.

#### [ng-pouchdb](https://github.com/danielzen/ng-pouchdb)

AngularJS binding for PouchDB.

### Ampersand

#### [ampersand-collection-pouchdb-mixin](https://github.com/svnlto/ampersand-collection-pouchdb-mixin)

A mixin for extending ampersand-collection with pouchdb persistance.

### Backbone

#### [Backbone PouchDB](https://github.com/jo/backbone-pouch)

Backbone PouchDB Sync Adapter.

### Ember

#### [Ember Pouch](https://github.com/nolanlawson/ember-pouch)

Ember Data adapter for PouchDB/CouchDB.

#### [ember-pouchdb](https://github.com/taras/ember-pouchdb)

Promisy PouchDB wrapper for Ember.js

### Kendo UI

#### [kendo-pouchdb](https://github.com/terikon/kendo-pouchdb)

Kendo UI DataSource adapter.

{% include anchor.html title="Other languages" hash="Other languages" %}

#### [Python-PouchDB](http://python-pouchdb.marten-de-vries.nl/)
A Python interface to PouchDB, with both a synchronous and an asynchronous API. Uses QtWebKit internally (via either PySide, PyQt4 or PyQt5). Some PouchDB plugins are also wrapped. ([Documentation](http://pythonhosted.org/Python-PouchDB/) / [Launchpad](https://launchpad.net/python-pouchdb))

#### [PouchDroid](https://github.com/nolanlawson/PouchDroid/)

Android adapter with a native Java interface to PouchDB.

{% include anchor.html title="Tools" hash="Tools" %}

#### [blob-util](https://github.com/nolanlawson/blob-util)

Shims and utils for working with binary Blobs in the browser.

#### [Puton](http://puton.jit.su/)

A bookmarklet for inspecting PouchDB databases within the browser. ([Github](http://github.com/ymichael/puton))

#### [Revision Tree Visualizer](http://neojski.github.io/visualizeRevTree)

A tool drawing revision tree of a couchdb document. You can see what is a conflict, which revisions are deleted and which is winning. ([Github](https://github.com/neojski/visualizeRevTree))
