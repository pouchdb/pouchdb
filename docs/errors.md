---
layout: 2ColLeft
title: Common Errors
sidebar: nav.html
---
### PouchDB throws 404 (Object Not Found) for '_local' document

Don't worry, nothing is amiss, this is expected behaviour:
During PouchDB's initial replication PouchDB will check for a checkpoint, if it doesn't exist a 404 will be returned and a checkpoint will subsequently be written.

### PouchDB is throwing `InvalidStateError`

Are you in private browsing mode? IndexedDB is [disabled in private browsing mode](https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB) in Firefox.

### Can't open second database on Android WebView with Cordova/Phone Gap

There is a limit of one database per app in some versions of the Android WebView. Install the [SQLite plugin][sqlite], then PouchDB will use that if it is available.

  [sqlite]: https://github.com/lite4cordova/Cordova-SQLitePlugin

### Database size limitation of ~5MB on iOS with Cordova/Phone Gap

If you're storing large amounts of data, such as PNG attachments, the [SQLite plugin][sqlite] is again your friend. (See [issue #1260](https://github.com/daleharvey/pouchdb/issues/1260) for details.)

### CouchDB returns a 404 for GETs from a CouchApp

Certain URL rewrites are broken by PouchDB's cache-busting; try adding `{cache : false}` to the PouchDB constructor. (See [issue #1233](https://github.com/daleharvey/pouchdb/issues/1233) for details.)

### Uncaught TypeError: object is not a function

Did you include the [es6-promise shim library](https://github.com/jakearchibald/es6-promise)?  Not every browser implements ES6 Promises correctly. (See [issue #1747](https://github.com/daleharvey/pouchdb/issues/1747) for details.)

### SyntaxError: Parse error (Cordova on Android)

Did you include the [es5-shim library](https://github.com/es-shims/es5-shim)?  PouchDB is written in ES5, which is supported by modern browsers, but requires shims for older browsers (e.g. IE 9, Android 2.1 WebView).

In Android, if you're loading PouchDB directly via `webView.loadUrl('javascript://' + js')`, you should prefer the minified PouchDB javascript file to the unminified one, since code comments can also cause parse errors.

### PouchDB object fails silently (Safari)

Safari requires users to confirm that they want to allow an app to store data locally ("Allow this website to use space on your disk?").  If PouchDB is loaded in an `iframe` or some other unusual way, the dialog might not be shown, and the database will silently fail.
