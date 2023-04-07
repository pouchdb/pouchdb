---
layout: post

title: PouchDB 3.3.1&#58; A quick one while he's away
author: Nolan Lawson

---

This is a quick release, ahead of our normal monthly release schedule, to fix some critical bugs and ship them out sooner to our eager PouchDB fanbase.

### Bugfixes

* Fixed live replication of conflicting revisions ([#3179](https://github.com/pouchdb/pouchdb/issues/3179))
* Fixed in-memory/localStorage plugins ([#3528](https://github.com/pouchdb/pouchdb/issues/3528))
* Fixed [SQLite Plugin][] support ([#3505](https://github.com/pouchdb/pouchdb/issues/3505))
* Fixed web worker support (beware [cross-browser issues](https://github.com/pouchdb/pouchdb/issues/2806), though) ([#3314](https://github.com/pouchdb/pouchdb/issues/3314))

### New stuff

* Debugging details added to `db.info()` ([#3398](https://github.com/pouchdb/pouchdb/issues/3398))
* PouchDB blog as an RSS feed ([#3516](https://github.com/pouchdb/pouchdb/issues/3516))
* Testing Couchbase Sync Gateway in Travis ([#3526](https://github.com/pouchdb/pouchdb/issues/3526))

### Debugging details

As noted above, `db.info()` now provides adapter-specific debugging info, such as:

* `idb_attachment_format`: (IndexedDB) either `'base64'` or `'binary'`, depending on whether the browser [supports binary blobs](/faq.html#data_types).
* `sqlite_plugin`: (WebSQL) true if the [SQLite Plugin][] is being used.
* `websql_encoding`: (WebSQL) either `'UTF-8'` or `'UTF-16'`, depending on the [WebSQL implementation](http://pouchdb.com/faq.html#data_types)

This should not be considered a stable API, since it's only for debugging and could change at any time.

### RSS feed

Thanks to Nick Colley, the PouchDB blog is now available as an RSS feed! Point your RSS reader over to [pouchdb.com/feed.xml](http://pouchdb.com/feed.xml) and get notified whenever a new PouchDB version is released.

### Couchbase Sync Gateway

The goal of PouchDB is to work seamlessly with any server that's CouchDB-compliant. And thanks to some help from J. Chris Anderson over at Couchbase, we are slowly improving our support for Couchbase Sync Gateway!

The current status is that CSG is being tested in Travis, but not all the tests are succeeding yet. So the next step is to start whittling away the failing tests. In the meantime, we recommend that CSG users who experience any problems (most likely with [attachment support](https://github.com/pouchdb/pouchdb/issues/2832)) should replicate from PouchDB to CouchDB, then from CouchDB to CSG.


### Get in touch

Please [file issues](https://github.com/pouchdb/pouchdb/issues) or [tell us what you think](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md#get-in-touch). And as always, a big thanks to all of our [new and existing contributors](https://github.com/pouchdb/pouchdb/graphs/contributors)!

[SQLite Plugin]: https://github.com/brodysoft/Cordova-SQLitePlugin
