---
layout: learn
title: PouchDB, the JavaScript Database that Syncs!
---

# Common Errors

### PouchDB is throwing `InvalidStateError`

Are you in private browsing mode? IndexedDB is [disabled in private browsing mode](https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB) in Firefox.

### Can't open second database on Android WebView/Cordova/Phone Gap

There is a limit of one database per app in some versions of the Android WebView. Install the [SQLite plugin](https://github.com/lite4cordova/Cordova-SQLitePlugin), then PouchDB will use that if it is available.

### `put()` is throwing 412: "_id is required for puts"

As in CouchDB, documents are `put` with an `_id` and `post`ed without an `_id`.  Document IDs must be unique strings that do not start with the reserved underscore character `'_'`.

### CouchDB returns a 404 for GETs from a CouchApp

Certain URL rewrites are broken by PouchDB's cache-busting; try adding `{cache : false}` to the PouchDB constructor. (See [issue #1233](https://github.com/daleharvey/pouchdb/issues/1233) for details.)