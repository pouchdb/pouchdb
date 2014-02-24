---
layout: learn
title: PouchDB, the JavaScript Database that Syncs!
---

# Common Errors

### PouchDB is throwing `InvalidStateError`

Are you in private browsing mode? IndexedDB is [disabled in private browsing mode](https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB) in Firefox.

### Can't open second database on Android WebView with Cordova/Phone Gap

There is a limit of one database per app in some versions of the Android WebView. Install the [SQLite plugin][sqlite], then PouchDB will use that if it is available.

  [sqlite]: https://github.com/lite4cordova/Cordova-SQLitePlugin

### Database size limitation of ~5MB on iOS with Cordova/Phone Gap

If you're storing large amounts of data, such as PNG attachments, the [SQLite plugin][sqlite] is again your friend. (See [issue #1260](https://github.com/daleharvey/pouchdb/issues/1260) for details.)

### CouchDB returns a 404 for GETs from a CouchApp

Certain URL rewrites are broken by PouchDB's cache-busting; try adding `{cache : false}` to the PouchDB constructor. (See [issue #1233](https://github.com/daleharvey/pouchdb/issues/1233) for details.)
