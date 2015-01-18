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

#### [Filter Pouch](https://github.com/nolanlawson/filter-pouch)

Applies filter functions to documents before and after storage, e.g. for encryption, compression, or massaging data.

#### [PouchDB GQL](https://github.com/pouchdb/GQL)

Google Query Language (GQL) queries with PouchDB. ([Documentation](http://pouchdb.com/gql.html))

#### [PouchDB List](http://python-pouchdb.marten-de-vries.nl/plugins.html)

Allows you to re-use your CouchDB list functions on the client side. ([Documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-rewrite-plug-in))

#### [Pouch Mirror](https://github.com/colinskow/pouch-mirror)

Creates a synced in-memory mirror of a remote CouchDB for faster reads.

#### [PouchDB No-Eval Map/Reduce](https://github.com/evidenceprime/pouchdb.mapreduce.noeval)

Allows you to use the `query()` API in environments that disallow `eval()`, like Chrome packaged apps.

#### [Peer Pouch](https://github.com/natevw/PeerPouch)

PouchDB over WebRTC.

#### [PouchDB Quick Search](https://github.com/nolanlawson/pouchdb-quick-search)

Full-text search engine on top of PouchDB.

#### [Relational Pouch](https://github.com/nolanlawson/relational-pouch)

A relational database API on top of PouchDB/CouchDB.

#### [PouchDB Rewrite](http://python-pouchdb.marten-de-vries.nl/plugins.html)

A PouchDB plugin that allows you to re-use your CouchDB rewrites on the client side. ([Documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-list-plug-in))

#### [PouchDB Show](http://python-pouchdb.marten-de-vries.nl/plugins.html)

A PouchDB plugin that allows you to re-use your CouchDB show functions on the client side. ([Documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-show-plug-in))

#### [PouchDB Spatial](https://github.com/pouchdb/geopouch)

Multidimensional and spatial queries with PouchDB.

#### [Pouch Stream](https://github.com/calvinmetcalf/PouchStream)

A plugin to let PouchDB talk streams.

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

An express submodule with a CouchDB-style REST interface to PouchDB. Powers PouchDB Server.

{% include anchor.html title="Framework adapters" hash="framework_adapters" %}

### Angular

#### [angular-pouchdb](https://github.com/wspringer/angular-pouchdb)

Wrapper for using PouchDB within Angular.js.

#### [Factoryng - AngularJS Adapter](https://github.com/redgeoff/factoryng)

An all-in-one AngularJS factory that wraps PouchDB and Delta Pouch.

#### [ngPouch](https://github.com/jrhicks/ngPouch)

Angular service to persist remote connection settings and maintain continuous replication.

#### [ng-pouchdb](https://github.com/danielzen/ng-pouchdb)

AngularJS binding for PouchDB.

### Backbone

#### [Backbone PouchDB](https://github.com/jo/backbone-pouch)

Backbone PouchDB Sync Adapter.

### Ember

#### [Ember Pouch](https://github.com/nolanlawson/ember-pouch)

Ember Data adapter for PouchDB/CouchDB.

#### [ember-pouchdb](https://github.com/taras/ember-pouchdb)

Promisy PouchDB wrapper for Ember.js

{% include anchor.html title="Other languages" hash="Other languages" %}

#### [Python-PouchDB](http://python-pouchdb.marten-de-vries.nl/)
A Python interface to PouchDB, with both a synchronous and an asynchronous API. Uses QtWebKit internally (via either PySide, PyQt4 or PyQt5). Some PouchDB plugins are also wrapped. ([Documentation](http://pythonhosted.org/Python-PouchDB/) / [Launchpad](https://launchpad.net/python-pouchdb))

#### [PouchDroid](https://github.com/nolanlawson/PouchDroid/)

Android adapter with a native Java interface to PouchDB.

{% include anchor.html title="Tools" hash="Tools" %}

#### [blob-util](https://github.com/nolanlawson/blob-util)

Not strictly PouchDB-related, but a useful set of shims and utility functions for working with Blobs in the browser.

#### [Puton](http://puton.jit.su/)

A bookmarklet for inspecting PouchDB databases within the browser. ([Github](http://github.com/ymichael/puton))

#### [Revision Tree Visualizer](http://neojski.github.io/visualizeRevTree)

A tool drawing revision tree of a couchdb document. You can see what is a conflict, which revisions are deleted and which is winning. ([Github](https://github.com/neojski/visualizeRevTree))
